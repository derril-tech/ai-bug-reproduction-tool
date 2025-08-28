#!/usr/bin/env python3
"""
Ingest Worker - Processes uploaded signals and extracts text content

Features:
- OCR for screenshots using Tesseract
- ASR for videos using Whisper
- HAR file parsing and text extraction
- Log file analysis and error extraction
- Merges extracted text back into reports
"""

import asyncio
import json
import logging
import os
import tempfile
from pathlib import Path
from typing import Dict, Any, Optional
from urllib.parse import urlparse

import boto3
import httpx
import nats
import psycopg2
import pytesseract
from PIL import Image
import whisper
import ffmpeg
import redis
from tenacity import retry, stop_after_attempt, wait_exponential

from config import config

# Configure logging
logging.basicConfig(
    level=getattr(logging, config.log_level),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class IngestWorker:
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

        # Initialize AI models
        self.whisper_model = None
        self._load_models()

    def _load_models(self):
        """Load AI models on startup"""
        try:
            logger.info(f"Loading Whisper model ({config.whisper_model_size})...")
            self.whisper_model = whisper.load_model(config.whisper_model_size)
            logger.info("Whisper model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            self.whisper_model = None

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def download_file(self, s3_key: str) -> Optional[str]:
        """Download file from S3 to temporary location"""
        try:
            # Create temp file in configured directory
            os.makedirs(self.temp_dir, exist_ok=True)
            with tempfile.NamedTemporaryFile(
                delete=False,
                suffix=Path(s3_key).suffix,
                dir=self.temp_dir
            ) as tmp_file:
                temp_path = tmp_file.name

            # Download from S3
            self.s3_client.download_file(self.s3_bucket, s3_key, temp_path)
            logger.info(f"Downloaded file from S3: {s3_key}")
            return temp_path

        except Exception as e:
            logger.error(f"Failed to download file {s3_key}: {e}")
            return None

    def extract_text_from_image(self, image_path: str) -> str:
        """Extract text from image using OCR"""
        try:
            image = Image.open(image_path)

            # Preprocessing for better OCR
            if image.mode != 'RGB':
                image = image.convert('RGB')

            # Extract text using Tesseract with configured language
            text = pytesseract.image_to_string(image, lang=config.tesseract_lang)

            logger.info(f"Extracted {len(text)} characters from image")
            return text.strip()

        except Exception as e:
            logger.error(f"OCR failed for {image_path}: {e}")
            return ""

    def extract_text_from_video(self, video_path: str) -> str:
        """Extract speech from video using Whisper"""
        if not self.whisper_model:
            logger.warning("Whisper model not available, skipping video processing")
            return ""

        try:
            logger.info(f"Processing video with Whisper: {video_path}")

            # Extract audio from video
            audio_path = video_path.replace(Path(video_path).suffix, '.wav')

            # Use ffmpeg to extract audio
            stream = ffmpeg.input(video_path)
            stream = ffmpeg.output(stream, audio_path, acodec='pcm_s16le', ac=1, ar='16k')
            ffmpeg.run(stream, overwrite_output=True, quiet=True)

            # Transcribe audio
            result = self.whisper_model.transcribe(audio_path)

            # Clean up audio file
            if os.path.exists(audio_path):
                os.remove(audio_path)

            text = result['text'].strip()
            logger.info(f"Extracted {len(text)} characters from video")
            return text

        except Exception as e:
            logger.error(f"Video processing failed for {video_path}: {e}")
            return ""

    def extract_text_from_har(self, har_path: str) -> str:
        """Extract relevant text from HAR file"""
        try:
            with open(har_path, 'r', encoding='utf-8') as f:
                har_data = json.load(f)

            extracted_texts = []

            # Extract URLs, headers, and response data
            for entry in har_data.get('log', {}).get('entries', []):
                request = entry.get('request', {})
                response = entry.get('response', {})

                # Extract URL
                url = request.get('url', '')
                if url:
                    extracted_texts.append(f"URL: {url}")

                # Extract request headers
                for header in request.get('headers', []):
                    if header['name'].lower() in ['user-agent', 'referer', 'host']:
                        extracted_texts.append(f"Header {header['name']}: {header['value']}")

                # Extract response status and content type
                status = response.get('status', '')
                content = response.get('content', {})
                mime_type = content.get('mimeType', '')

                if status:
                    extracted_texts.append(f"Response Status: {status}")
                if mime_type:
                    extracted_texts.append(f"Content-Type: {mime_type}")

            return '\n'.join(extracted_texts)

        except Exception as e:
            logger.error(f"HAR processing failed for {har_path}: {e}")
            return ""

    def extract_text_from_log(self, log_path: str) -> str:
        """Extract error messages and relevant information from log files"""
        try:
            with open(log_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()

            # Extract error patterns
            error_patterns = [
                r'Error:', r'Exception:', r'Failed:', r'Traceback',
                r'ERROR', r'WARN', r'WARNING', r'FATAL'
            ]

            lines = content.split('\n')
            relevant_lines = []

            for line in lines:
                line_lower = line.lower()
                if any(pattern.lower() in line_lower for pattern in error_patterns):
                    relevant_lines.append(line.strip())

            # If no error patterns found, return first 1000 characters
            if not relevant_lines:
                return content[:1000]

            return '\n'.join(relevant_lines[:50])  # Limit to 50 lines

        except Exception as e:
            logger.error(f"Log processing failed for {log_path}: {e}")
            return ""

    async def process_signal(self, signal_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process a single signal and extract text content"""
        signal_id = signal_data['id']
        s3_key = signal_data['s3_key']
        kind = signal_data['kind']

        logger.info(f"Processing signal {signal_id} of type {kind}")

        # Download file from S3
        local_path = await self.download_file(s3_key)
        if not local_path:
            return {'signal_id': signal_id, 'error': 'Failed to download file'}

        try:
            # Extract text based on file type
            extracted_text = ""

            if kind == 'screenshot':
                extracted_text = self.extract_text_from_image(local_path)
            elif kind == 'video':
                extracted_text = self.extract_text_from_video(local_path)
            elif kind == 'har':
                extracted_text = self.extract_text_from_har(local_path)
            elif kind == 'log':
                extracted_text = self.extract_text_from_log(local_path)

            # Clean up temp file
            os.remove(local_path)

            return {
                'signal_id': signal_id,
                'extracted_text': extracted_text,
                'text_length': len(extracted_text)
            }

        except Exception as e:
            logger.error(f"Processing failed for signal {signal_id}: {e}")
            return {'signal_id': signal_id, 'error': str(e)}

    async def update_report_with_extracted_text(self, report_id: str, extracted_data: Dict[str, Any]):
        """Update report with extracted text content"""
        try:
            conn = psycopg2.connect(**self.db_config)
            cursor = conn.cursor()

            # Get current report
            cursor.execute('SELECT description FROM reports WHERE id = %s', (report_id,))
            result = cursor.fetchone()

            if not result:
                logger.error(f"Report {report_id} not found")
                return

            current_description = result[0] or ""

            # Prepare updated description
            updates = []

            for item in extracted_data:
                signal_id = item['signal_id']
                if 'extracted_text' in item and item['extracted_text']:
                    text = item['extracted_text'][:2000]  # Limit text length
                    updates.append(f"\n--- Signal {signal_id} ---\n{text}")

            if updates:
                new_description = current_description + '\n'.join(updates)

                # Update report
                cursor.execute(
                    'UPDATE reports SET description = %s WHERE id = %s',
                    (new_description, report_id)
                )

                conn.commit()
                logger.info(f"Updated report {report_id} with extracted text")

            cursor.close()
            conn.close()

        except Exception as e:
            logger.error(f"Failed to update report {report_id}: {e}")

    async def process_ingestion_request(self, report_id: str):
        """Process ingestion request for a report"""
        try:
            logger.info(f"Processing ingestion request for report {report_id}")

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

            # Process each signal
            signal_data_list = [
                {'id': row[0], 's3_key': row[1], 'kind': row[2]}
                for row in signals
            ]

            # Process signals concurrently with concurrency limit
            semaphore = asyncio.Semaphore(self.max_concurrent_tasks)

            async def process_with_limit(signal_data):
                async with semaphore:
                    return await self.process_signal(signal_data)

            tasks = [process_with_limit(signal_data) for signal_data in signal_data_list]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Filter out exceptions and collect results
            extracted_data = []
            for result in results:
                if isinstance(result, Exception):
                    logger.error(f"Signal processing error: {result}")
                else:
                    extracted_data.append(result)

            # Update report with extracted text
            if extracted_data:
                await self.update_report_with_extracted_text(report_id, extracted_data)

            logger.info(f"Completed ingestion for report {report_id}")

        except Exception as e:
            logger.error(f"Ingestion processing failed for report {report_id}: {e}")

    async def run(self):
        """Main worker loop"""
        logger.info("Starting Ingest Worker")

        while True:
            try:
                # Connect to NATS
                nc = await nats.connect(self.nats_url)

                # Subscribe to ingestion requests
                async def message_handler(msg):
                    try:
                        data = json.loads(msg.data.decode())
                        report_id = data.get('report_id')

                        if report_id:
                            await self.process_ingestion_request(report_id)
                            # Acknowledge message
                            await msg.ack()
                        else:
                            logger.error("No report_id in message")

                    except Exception as e:
                        logger.error(f"Message processing error: {e}")

                # Subscribe to ingestion queue
                await nc.subscribe("report.ingest", cb=message_handler)

                logger.info("Worker ready, waiting for messages...")

                # Keep the connection alive
                while True:
                    await asyncio.sleep(1)

            except Exception as e:
                logger.error(f"Worker error: {e}")
                await asyncio.sleep(5)  # Wait before reconnecting


async def main():
    worker = IngestWorker()
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
