#!/usr/bin/env python3
"""
Signal Worker - Parses HAR files, logs, and clusters error signatures

Features:
- HAR file parsing and structured data extraction
- Log file parsing and error signature extraction
- Error signature clustering using vector similarity
- Database storage of clustered signatures
- Integration with pgvector for similarity search
"""

import asyncio
import json
import logging
import os
import re
import hashlib
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from urllib.parse import urlparse, parse_qs

import boto3
import nats
import psycopg2
import psycopg2.extras
import pandas as pd
import numpy as np
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler
from sentence_transformers import SentenceTransformer
import redis
from tenacity import retry, stop_after_attempt, wait_exponential

from config import config

# Configure logging
logging.basicConfig(
    level=getattr(logging, config.log_level),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SignalWorker:
    def __init__(self):
        # Database configuration
        self.db_config = {
            'host': config.db_host,
            'port': config.db_port,
            'database': config.db_name,
            'user': config.db_username,
            'password': config.db_password,
        }

        # Redis client
        self.redis_client = redis.Redis(
            host=config.redis_host,
            port=config.redis_port,
            decode_responses=True
        )

        # NATS URL
        self.nats_url = config.nats_url

        # S3/Minio client
        self.s3_client = boto3.client(
            's3',
            endpoint_url=config.s3_endpoint,
            aws_access_key_id=config.s3_access_key,
            aws_secret_access_key=config.s3_secret_key,
        )
        self.s3_bucket = config.s3_bucket

        # Worker settings
        self.max_concurrent_tasks = config.max_concurrent_tasks
        self.temp_dir = config.temp_dir
        self.similarity_threshold = config.similarity_threshold
        self.min_samples_cluster = config.min_samples_cluster

        # Initialize ML models
        self.embedding_model = None
        self._load_models()

    def _load_models(self):
        """Load ML models on startup"""
        try:
            logger.info("Loading sentence transformer model...")
            self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("Embedding model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            self.embedding_model = None

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def download_file(self, s3_key: str) -> Optional[str]:
        """Download file from S3 to temporary location"""
        try:
            # Create temp file in configured directory
            os.makedirs(self.temp_dir, exist_ok=True)
            temp_path = os.path.join(self.temp_dir, f"signal_{hash(s3_key) % 1000}_{Path(s3_key).name}")

            # Download from S3
            self.s3_client.download_file(self.s3_bucket, s3_key, temp_path)
            logger.info(f"Downloaded file from S3: {s3_key}")
            return temp_path

        except Exception as e:
            logger.error(f"Failed to download file {s3_key}: {e}")
            return None

    def parse_har_file(self, har_path: str) -> Dict[str, Any]:
        """Parse HAR file and extract structured data"""
        try:
            with open(har_path, 'r', encoding='utf-8') as f:
                har_data = json.load(f)

            parsed_data = {
                'pages': [],
                'entries': [],
                'summary': {
                    'total_requests': 0,
                    'failed_requests': 0,
                    'total_size': 0,
                    'load_time': 0,
                }
            }

            # Parse pages
            for page in har_data.get('log', {}).get('pages', []):
                parsed_data['pages'].append({
                    'id': page.get('id'),
                    'title': page.get('title'),
                    'startedDateTime': page.get('startedDateTime'),
                    'pageTimings': page.get('pageTimings', {}),
                })

            # Parse entries (requests/responses)
            entries = []
            total_requests = 0
            failed_requests = 0
            total_size = 0

            for entry in har_data.get('log', {}).get('entries', []):
                total_requests += 1

                request = entry.get('request', {})
                response = entry.get('response', {})
                timings = entry.get('timings', {})

                # Check for failed requests
                status = response.get('status', 0)
                if status >= 400:
                    failed_requests += 1

                # Calculate response size
                content = response.get('content', {})
                size = content.get('size', 0)
                if size > 0:
                    total_size += size

                parsed_entry = {
                    'url': request.get('url'),
                    'method': request.get('method'),
                    'status': status,
                    'statusText': response.get('statusText'),
                    'requestHeaders': len(request.get('headers', [])),
                    'responseHeaders': len(response.get('headers', [])),
                    'requestSize': sum(
                        len(str(h.get('value', ''))) + len(str(h.get('name', '')))
                        for h in request.get('headers', [])
                    ),
                    'responseSize': size,
                    'timings': timings,
                    'serverIPAddress': entry.get('serverIPAddress'),
                    'connection': entry.get('connection'),
                }

                entries.append(parsed_entry)

            parsed_data['entries'] = entries
            parsed_data['summary'].update({
                'total_requests': total_requests,
                'failed_requests': failed_requests,
                'total_size': total_size,
            })

            # Calculate total load time from pages
            if parsed_data['pages']:
                load_times = [
                    page.get('pageTimings', {}).get('onLoad', 0)
                    for page in parsed_data['pages']
                    if page.get('pageTimings', {}).get('onLoad', 0) > 0
                ]
                if load_times:
                    parsed_data['summary']['load_time'] = max(load_times)

            logger.info(f"Parsed HAR file: {total_requests} requests, {failed_requests} failed")
            return parsed_data

        except Exception as e:
            logger.error(f"HAR parsing failed for {har_path}: {e}")
            return {}

    def parse_log_file(self, log_path: str) -> Dict[str, Any]:
        """Parse log file and extract error signatures"""
        try:
            with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()

            parsed_data = {
                'entries': [],
                'error_signatures': [],
                'summary': {
                    'total_lines': 0,
                    'error_lines': 0,
                    'warning_lines': 0,
                    'info_lines': 0,
                }
            }

            lines = content.split('\n')
            parsed_data['summary']['total_lines'] = len(lines)

            # Parse log entries
            log_entries = []
            error_lines = []
            warning_lines = []
            info_lines = []

            log_pattern = re.compile(
                r'(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?)\s*'
                r'(?:\[([^\]]+)\])?\s*'
                r'(ERROR|WARN|WARNING|INFO|DEBUG)\s*'
                r'(.*?)(?:\s*:\s*(.*))?$',
                re.IGNORECASE
            )

            for i, line in enumerate(lines):
                if not line.strip():
                    continue

                match = log_pattern.search(line)
                if match:
                    timestamp, logger_name, level, message, details = match.groups()

                    entry = {
                        'line_number': i + 1,
                        'timestamp': timestamp,
                        'logger': logger_name,
                        'level': level.upper(),
                        'message': message.strip(),
                        'details': details.strip() if details else None,
                        'raw_line': line,
                    }

                    log_entries.append(entry)

                    # Categorize by level
                    if level.upper() == 'ERROR':
                        error_lines.append(entry)
                    elif level.upper() in ['WARN', 'WARNING']:
                        warning_lines.append(entry)
                    elif level.upper() == 'INFO':
                        info_lines.append(entry)

            parsed_data['entries'] = log_entries
            parsed_data['summary'].update({
                'error_lines': len(error_lines),
                'warning_lines': len(warning_lines),
                'info_lines': len(info_lines),
            })

            # Extract error signatures from error lines
            error_signatures = []
            for error in error_lines:
                signature = self._extract_error_signature(error)
                if signature:
                    error_signatures.append(signature)

            parsed_data['error_signatures'] = error_signatures

            logger.info(f"Parsed log file: {len(log_entries)} entries, {len(error_signatures)} error signatures")
            return parsed_data

        except Exception as e:
            logger.error(f"Log parsing failed for {log_path}: {e}")
            return {}

    def _extract_error_signature(self, error_entry: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Extract error signature from log entry"""
        try:
            message = error_entry.get('message', '')
            details = error_entry.get('details', '')

            # Combine message and details for signature generation
            full_text = f"{message} {details}".strip()

            # Generate signature components
            error_type = self._classify_error_type(full_text)
            stack_trace = self._extract_stack_trace(full_text)
            key_components = self._extract_key_components(full_text)

            signature = {
                'signature_hash': hashlib.md5(full_text.encode()).hexdigest(),
                'error_type': error_type,
                'message': message,
                'details': details,
                'stack_trace': stack_trace,
                'key_components': key_components,
                'severity': self._calculate_severity(error_entry),
                'frequency': 1,  # Will be updated during clustering
            }

            return signature

        except Exception as e:
            logger.error(f"Error signature extraction failed: {e}")
            return None

    def _classify_error_type(self, text: str) -> str:
        """Classify error type based on content"""
        text_lower = text.lower()

        if 'syntaxerror' in text_lower or 'syntax error' in text_lower:
            return 'SyntaxError'
        elif 'referenceerror' in text_lower or 'reference error' in text_lower:
            return 'ReferenceError'
        elif 'typeerror' in text_lower or 'type error' in text_lower:
            return 'TypeError'
        elif 'network' in text_lower or 'connection' in text_lower:
            return 'NetworkError'
        elif 'database' in text_lower or 'sql' in text_lower:
            return 'DatabaseError'
        elif 'authentication' in text_lower or 'unauthorized' in text_lower:
            return 'AuthenticationError'
        elif 'timeout' in text_lower:
            return 'TimeoutError'
        else:
            return 'GenericError'

    def _extract_stack_trace(self, text: str) -> Optional[str]:
        """Extract stack trace from error text"""
        # Look for common stack trace patterns
        stack_patterns = [
            r'at\s+[^\n]+\n(?:\s+at\s+[^\n]+\n)+',
            r'Traceback\s*\([^)]*\):\s*\n(?:\s+[^\n]+\n)+',
            r'Stack\s+trace:\s*\n(?:\s+[^\n]+\n)+',
        ]

        for pattern in stack_patterns:
            match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
            if match:
                return match.group(0).strip()

        return None

    def _extract_key_components(self, text: str) -> List[str]:
        """Extract key components from error text"""
        components = []

        # Extract quoted strings
        quotes = re.findall(r'"([^"]*)"', text) + re.findall(r"'([^']*)'", text)
        components.extend(quotes)

        # Extract file paths
        paths = re.findall(r'/[^\s]+\.[a-zA-Z]{2,4}', text)
        components.extend(paths)

        # Extract function names
        functions = re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_]*\([^)]*\)', text)
        components.extend(functions)

        # Extract error codes
        codes = re.findall(r'\b\d{3,4}\b', text)
        components.extend(codes)

        return list(set(components))  # Remove duplicates

    def _calculate_severity(self, error_entry: Dict[str, Any]) -> str:
        """Calculate severity score for error"""
        level = error_entry.get('level', 'ERROR')

        if level == 'ERROR':
            return 'high'
        elif level in ['WARN', 'WARNING']:
            return 'medium'
        else:
            return 'low'

    async def cluster_error_signatures(self, signatures: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Cluster similar error signatures using vector embeddings"""
        if not signatures or not self.embedding_model:
            logger.warning("No signatures to cluster or embedding model not available")
            return signatures

        try:
            # Generate embeddings for signature messages
            texts = [sig['message'] + ' ' + (sig.get('details') or '') for sig in signatures]
            embeddings = self.embedding_model.encode(texts)

            # Convert to numpy array
            embeddings_array = np.array(embeddings)

            # Normalize embeddings
            scaler = StandardScaler()
            embeddings_normalized = scaler.fit_transform(embeddings_array)

            # Perform clustering
            clustering = DBSCAN(
                eps=self.similarity_threshold,
                min_samples=self.min_samples_cluster,
                metric='cosine'
            )

            cluster_labels = clustering.fit_predict(embeddings_normalized)

            # Group signatures by cluster
            clustered_signatures = {}
            for i, signature in enumerate(signatures):
                cluster_id = cluster_labels[i]
                if cluster_id == -1:  # Noise points
                    cluster_id = f"noise_{i}"

                if cluster_id not in clustered_signatures:
                    clustered_signatures[cluster_id] = []

                signature_copy = signature.copy()
                signature_copy['cluster_id'] = str(cluster_id)
                clustered_signatures[cluster_id].append(signature_copy)

            # Merge signatures within each cluster
            merged_signatures = []
            for cluster_id, cluster_sigs in clustered_signatures.items():
                if len(cluster_sigs) > 1:
                    # Merge similar signatures
                    merged = self._merge_cluster_signatures(cluster_sigs)
                    merged_signatures.append(merged)
                else:
                    merged_signatures.extend(cluster_sigs)

            logger.info(f"Clustered {len(signatures)} signatures into {len(merged_signatures)} groups")
            return merged_signatures

        except Exception as e:
            logger.error(f"Error clustering failed: {e}")
            return signatures

    def _merge_cluster_signatures(self, signatures: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Merge similar signatures within a cluster"""
        # Use the most common values
        primary_signature = signatures[0].copy()

        # Combine key components
        all_components = []
        for sig in signatures:
            all_components.extend(sig.get('key_components', []))

        primary_signature['key_components'] = list(set(all_components))
        primary_signature['frequency'] = len(signatures)

        # Update message to be more generic if needed
        messages = [sig['message'] for sig in signatures]
        if len(set(messages)) > 1:
            # Find common pattern
            primary_signature['message'] = self._find_common_pattern(messages)

        return primary_signature

    def _find_common_pattern(self, messages: List[str]) -> str:
        """Find common pattern in error messages"""
        # Simple approach: take the shortest message as representative
        return min(messages, key=len)

    async def save_clustered_signatures(self, report_id: str, signatures: List[Dict[str, Any]]):
        """Save clustered signatures to database"""
        try:
            conn = psycopg2.connect(**self.db_config)
            cursor = conn.cursor()

            for signature in signatures:
                # Generate embedding for the signature
                text_for_embedding = f"{signature['message']} {signature.get('details', '')}"
                if self.embedding_model:
                    embedding = self.embedding_model.encode([text_for_embedding])[0]
                    embedding_vector = embedding.tolist()
                else:
                    embedding_vector = [0.0] * 384  # Default dimension for sentence transformers

                # Insert or update signature
                cursor.execute("""
                    INSERT INTO error_signatures (
                        report_id, signature_hash, error_type, message, details,
                        stack_trace, key_components, severity, frequency,
                        embedding, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (signature_hash)
                    DO UPDATE SET
                        frequency = error_signatures.frequency + 1,
                        updated_at = NOW()
                """, (
                    report_id,
                    signature['signature_hash'],
                    signature['error_type'],
                    signature['message'],
                    signature.get('details'),
                    signature.get('stack_trace'),
                    json.dumps(signature.get('key_components', [])),
                    signature['severity'],
                    signature['frequency'],
                    embedding_vector,
                ))

            conn.commit()
            cursor.close()
            conn.close()

            logger.info(f"Saved {len(signatures)} clustered signatures for report {report_id}")

        except Exception as e:
            logger.error(f"Failed to save signatures for report {report_id}: {e}")

    async def process_signal(self, signal_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process a single signal and extract signatures"""
        signal_id = signal_data['id']
        s3_key = signal_data['s3_key']
        kind = signal_data['kind']

        logger.info(f"Processing signal {signal_id} of type {kind}")

        # Download file from S3
        local_path = await self.download_file(s3_key)
        if not local_path:
            return {'signal_id': signal_id, 'error': 'Failed to download file'}

        try:
            parsed_data = {}

            if kind == 'har':
                parsed_data = self.parse_har_file(local_path)
            elif kind == 'log':
                parsed_data = self.parse_log_file(local_path)
            else:
                logger.info(f"Skipping unsupported signal type: {kind}")
                return {'signal_id': signal_id, 'status': 'skipped'}

            # Clean up temp file
            os.remove(local_path)

            return {
                'signal_id': signal_id,
                'parsed_data': parsed_data,
                'status': 'processed'
            }

        except Exception as e:
            logger.error(f"Processing failed for signal {signal_id}: {e}")
            return {'signal_id': signal_id, 'error': str(e)}

    async def process_signals_request(self, report_id: str):
        """Process signals request for a report"""
        try:
            logger.info(f"Processing signals request for report {report_id}")

            # Get all signals for the report
            conn = psycopg2.connect(**self.db_config)
            cursor = conn.cursor()

            cursor.execute(
                'SELECT id, s3_key, kind FROM signals WHERE report_id = %s',
                (report_id,)
            )

            signals = cursor.fetchall()
            cursor.close()
            conn.close()

            if not signals:
                logger.info(f"No signals found for report {report_id}")
                return

            # Process signals concurrently with concurrency limit
            semaphore = asyncio.Semaphore(self.max_concurrent_tasks)

            async def process_with_limit(signal_data):
                async with semaphore:
                    return await self.process_signal(signal_data)

            signal_data_list = [
                {'id': row[0], 's3_key': row[1], 'kind': row[2]}
                for row in signals
            ]

            tasks = [process_with_limit(signal_data) for signal_data in signal_data_list]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Collect all error signatures
            all_signatures = []

            for result in results:
                if isinstance(result, Exception):
                    logger.error(f"Signal processing error: {result}")
                elif 'parsed_data' in result and result['parsed_data']:
                    parsed_data = result['parsed_data']
                    if 'error_signatures' in parsed_data:
                        all_signatures.extend(parsed_data['error_signatures'])

            # Cluster signatures if we have any
            if all_signatures:
                clustered_signatures = await self.cluster_error_signatures(all_signatures)
                await self.save_clustered_signatures(report_id, clustered_signatures)

            logger.info(f"Completed signals processing for report {report_id}")

        except Exception as e:
            logger.error(f"Signals processing failed for report {report_id}: {e}")

    async def run(self):
        """Main worker loop"""
        logger.info("Starting Signal Worker")

        while True:
            try:
                # Connect to NATS
                nc = await nats.connect(self.nats_url)

                # Subscribe to signals processing requests
                async def message_handler(msg):
                    try:
                        data = json.loads(msg.data.decode())
                        report_id = data.get('report_id')

                        if report_id:
                            await self.process_signals_request(report_id)
                            # Acknowledge message
                            await msg.ack()
                        else:
                            logger.error("No report_id in message")

                    except Exception as e:
                        logger.error(f"Message processing error: {e}")

                # Subscribe to signals queue
                await nc.subscribe("report.signals", cb=message_handler)

                logger.info("Worker ready, waiting for messages...")

                # Keep the connection alive
                while True:
                    await asyncio.sleep(1)

            except Exception as e:
                logger.error(f"Worker error: {e}")
                await asyncio.sleep(5)  # Wait before reconnecting


async def main():
    worker = SignalWorker()
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
