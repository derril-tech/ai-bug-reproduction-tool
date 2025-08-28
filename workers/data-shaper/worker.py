#!/usr/bin/env python3
"""
Data Shaper Worker - Generates test fixtures with PII scrubbing and referential integrity

Features:
- Faker-based realistic data generation
- PII detection and scrubbing using Presidio
- Referential integrity validation
- Schema-aware data generation
- Cross-table relationship management
- Data consistency validation
"""

import asyncio
import json
import logging
import os
import re
import hashlib
from pathlib import Path
from typing import Dict, Any, List, Optional, Set, Tuple
from datetime import datetime, timedelta

import boto3
import nats
import psycopg2
import psycopg2.extras
from faker import Faker
from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine
import pandas as pd
import redis
from tenacity import retry, stop_after_attempt, wait_exponential

from config import config

# Configure logging
logging.basicConfig(
    level=getattr(logging, config.log_level),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DataShaperWorker:
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
        self.temp_dir = config.temp_dir

        # Initialize engines
        self.faker = Faker(config.locale)
        self.analyzer = AnalyzerEngine()
        self.anonymizer = AnonymizerEngine()

        # Data generation settings
        self.max_records_per_table = config.max_records_per_table
        self.pii_confidence_threshold = config.pii_confidence_threshold

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def download_file(self, s3_key: str) -> Optional[str]:
        """Download file from S3 to temporary location"""
        try:
            # Create temp file in configured directory
            os.makedirs(self.temp_dir, exist_ok=True)
            temp_path = os.path.join(self.temp_dir, f"data_{hash(s3_key) % 1000}_{Path(s3_key).name}")

            # Download from S3
            self.s3_client.download_file(self.s3_bucket, s3_key, temp_path)
            logger.info(f"Downloaded file from S3: {s3_key}")
            return temp_path

        except Exception as e:
            logger.error(f"Failed to download file {s3_key}: {e}")
            return None

    def detect_and_scrub_pii(self, data: Any, context: str = "general") -> Tuple[Any, Dict[str, Any]]:
        """
        Detect and scrub PII from data

        Args:
            data: Input data (string, dict, list)
            context: Context for PII detection (e.g., 'user_data', 'payment')

        Returns:
            Tuple of (scrubbed_data, pii_report)
        """
        pii_report = {
            'detected_entities': [],
            'scrubbed_count': 0,
            'original_length': 0,
            'scrubbed_length': 0,
        }

        if isinstance(data, str):
            return self._scrub_text_pii(data, context, pii_report)
        elif isinstance(data, dict):
            return self._scrub_dict_pii(data, context, pii_report)
        elif isinstance(data, list):
            return self._scrub_list_pii(data, context, pii_report)
        else:
            return data, pii_report

    def _scrub_text_pii(self, text: str, context: str, pii_report: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        """Scrub PII from text content"""
        try:
            pii_report['original_length'] = len(text)

            # Analyze text for PII
            analyzer_results = self.analyzer.analyze(
                text=text,
                language='en',
                entities=config.pii_entities_to_check
            )

            if analyzer_results:
                # Filter by confidence threshold
                high_confidence_results = [
                    result for result in analyzer_results
                    if result.score >= self.pii_confidence_threshold
                ]

                if high_confidence_results:
                    # Anonymize the text
                    anonymized_result = self.anonymizer.anonymize(
                        text=text,
                        analyzer_results=high_confidence_results
                    )

                    scrubbed_text = anonymized_result.text

                    # Update report
                    pii_report['detected_entities'] = [
                        {
                            'entity_type': result.entity_type,
                            'start': result.start,
                            'end': result.end,
                            'confidence': result.score,
                        }
                        for result in high_confidence_results
                    ]
                    pii_report['scrubbed_count'] = len(high_confidence_results)
                    pii_report['scrubbed_length'] = len(scrubbed_text)

                    return scrubbed_text, pii_report

            return text, pii_report

        except Exception as e:
            logger.error(f"PII scrubbing failed for text: {e}")
            return text, pii_report

    def _scrub_dict_pii(self, data: Dict[str, Any], context: str, pii_report: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """Scrub PII from dictionary"""
        scrubbed_data = {}

        for key, value in data.items():
            if isinstance(value, (str, dict, list)):
                scrubbed_value, value_report = self.detect_and_scrub_pii(value, context)

                # Merge PII reports
                for entity in value_report.get('detected_entities', []):
                    pii_report['detected_entities'].append({
                        **entity,
                        'field': key,
                    })

                pii_report['scrubbed_count'] += value_report.get('scrubbed_count', 0)
                pii_report['original_length'] += value_report.get('original_length', 0)
                pii_report['scrubbed_length'] += value_report.get('scrubbed_length', 0)

                scrubbed_data[key] = scrubbed_value
            else:
                scrubbed_data[key] = value

        return scrubbed_data, pii_report

    def _scrub_list_pii(self, data: List[Any], context: str, pii_report: Dict[str, Any]) -> Tuple[List[Any], Dict[str, Any]]:
        """Scrub PII from list"""
        scrubbed_data = []

        for item in data:
            scrubbed_item, item_report = self.detect_and_scrub_pii(item, context)

            # Merge PII reports
            pii_report['detected_entities'].extend(item_report.get('detected_entities', []))
            pii_report['scrubbed_count'] += item_report.get('scrubbed_count', 0)
            pii_report['original_length'] += item_report.get('original_length', 0)
            pii_report['scrubbed_length'] += item_report.get('scrubbed_length', 0)

            scrubbed_data.append(scrubbed_item)

        return scrubbed_data, pii_report

    def generate_fixtures(self, schema: Dict[str, Any], count: int = 10) -> Dict[str, Any]:
        """
        Generate faker-based fixtures based on schema

        Args:
            schema: Data schema definition
            count: Number of records to generate

        Returns:
            Generated fixtures with PII scrubbing
        """
        fixtures = []
        pii_reports = []

        for i in range(count):
            record = self._generate_record(schema)
            scrubbed_record, pii_report = self.detect_and_scrub_pii(record, schema.get('context', 'general'))

            fixtures.append(scrubbed_record)
            pii_reports.append(pii_report)

        return {
            'fixtures': fixtures,
            'pii_reports': pii_reports,
            'metadata': {
                'total_records': len(fixtures),
                'schema_used': schema.get('name', 'unknown'),
                'generation_timestamp': datetime.now().isoformat(),
            }
        }

    def _generate_record(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        """Generate a single record based on schema"""
        record = {}

        for field_name, field_schema in schema.get('fields', {}).items():
            field_type = field_schema.get('type', 'string')
            constraints = field_schema.get('constraints', {})

            # Generate value based on field type
            if field_type == 'string':
                record[field_name] = self._generate_string_field(field_schema)
            elif field_type == 'email':
                record[field_name] = self.faker.email()
            elif field_type == 'name':
                record[field_name] = self.faker.name()
            elif field_type == 'address':
                record[field_name] = self.faker.address()
            elif field_type == 'phone':
                record[field_name] = self.faker.phone_number()
            elif field_type == 'date':
                record[field_name] = self._generate_date_field(field_schema)
            elif field_type == 'number':
                record[field_name] = self._generate_number_field(field_schema)
            elif field_type == 'boolean':
                record[field_name] = self.faker.boolean()
            elif field_type == 'uuid':
                record[field_name] = str(self.faker.uuid4())
            elif field_type == 'foreign_key':
                record[field_name] = self._generate_foreign_key(field_schema)
            else:
                record[field_name] = self._generate_string_field(field_schema)

        return record

    def _generate_string_field(self, field_schema: Dict[str, Any]) -> str:
        """Generate string field value"""
        constraints = field_schema.get('constraints', {})

        # Check for specific faker providers
        if 'faker_provider' in field_schema:
            provider = field_schema['faker_provider']
            if hasattr(self.faker, provider):
                return getattr(self.faker, provider)()

        # Check for patterns
        if 'pattern' in constraints:
            # For now, return a simple string matching length constraints
            min_length = constraints.get('min_length', 1)
            max_length = constraints.get('max_length', 50)
            length = self.faker.random_int(min_length, max_length)
            return self.faker.pystr(min_chars=length, max_chars=length)

        # Default string generation
        return self.faker.sentence()

    def _generate_date_field(self, field_schema: Dict[str, Any]) -> str:
        """Generate date field value"""
        constraints = field_schema.get('constraints', {})

        if constraints.get('past', False):
            return self.faker.date_time_between(start_date='-30d', end_date='now').isoformat()
        elif constraints.get('future', False):
            return self.faker.date_time_between(start_date='now', end_date='+30d').isoformat()
        else:
            return self.faker.date_time_this_year().isoformat()

    def _generate_number_field(self, field_schema: Dict[str, Any]) -> float:
        """Generate number field value"""
        constraints = field_schema.get('constraints', {})

        min_value = constraints.get('min', 0)
        max_value = constraints.get('max', 1000)
        decimal_places = constraints.get('decimal_places', 0)

        if decimal_places > 0:
            return round(self.faker.pyfloat(min_value=min_value, max_value=max_value), decimal_places)
        else:
            return self.faker.random_int(min_value, max_value)

    def _generate_foreign_key(self, field_schema: Dict[str, Any]) -> str:
        """Generate foreign key value"""
        # For now, generate a random UUID
        # In a real implementation, this would reference existing records
        return str(self.faker.uuid4())

    def validate_referential_integrity(self, fixtures: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate referential integrity across fixtures

        Args:
            fixtures: Dictionary of table fixtures

        Returns:
            Validation report
        """
        validation_report = {
            'is_valid': True,
            'violations': [],
            'warnings': [],
            'summary': {
                'total_tables': len(fixtures),
                'total_records': sum(len(records) for records in fixtures.values()),
            }
        }

        # Extract foreign key relationships
        foreign_keys = self._extract_foreign_keys(fixtures)

        # Check for orphaned records
        for table_name, records in fixtures.items():
            for i, record in enumerate(records):
                for field_name, field_value in record.items():
                    if field_name in foreign_keys.get(table_name, {}):
                        fk_info = foreign_keys[table_name][field_name]
                        referenced_table = fk_info['references']

                        if referenced_table in fixtures:
                            # Check if referenced record exists
                            referenced_records = fixtures[referenced_table]
                            referenced_ids = {r.get(fk_info['referenced_field'], r.get('id')) for r in referenced_records}

                            if field_value not in referenced_ids:
                                validation_report['violations'].append({
                                    'table': table_name,
                                    'record_index': i,
                                    'field': field_name,
                                    'value': field_value,
                                    'referenced_table': referenced_table,
                                    'message': f'Foreign key violation: {field_value} not found in {referenced_table}',
                                })

        validation_report['is_valid'] = len(validation_report['violations']) == 0
        return validation_report

    def _extract_foreign_keys(self, fixtures: Dict[str, Any]) -> Dict[str, Dict[str, Dict[str, Any]]]:
        """Extract foreign key relationships from fixtures"""
        foreign_keys = {}

        # This is a simplified implementation
        # In a real system, this would come from database schema or configuration
        for table_name in fixtures.keys():
            foreign_keys[table_name] = {}

            # Common foreign key patterns
            if table_name.endswith('s') and not table_name.endswith('ss'):
                singular = table_name[:-1]
                if f'{singular}_id' in fixtures.get(table_name, [{}])[0]:
                    foreign_keys[table_name][f'{singular}_id'] = {
                        'references': f'{singular}s' if not singular.endswith('s') else singular,
                        'referenced_field': 'id',
                    }

        return foreign_keys

    def generate_test_schema(self, har_data: Dict[str, Any], context: str = 'web') -> Dict[str, Any]:
        """
        Generate test data schema from HAR file analysis

        Args:
            har_data: Parsed HAR data
            context: Test context (web, api, etc.)

        Returns:
            Generated schema for test data
        """
        schema = {
            'name': f'{context}_test_schema',
            'context': context,
            'fields': {},
        }

        # Analyze HAR data to infer schema
        if 'entries' in har_data:
            for entry in har_data['entries']:
                request = entry.get('request', {})
                post_data = request.get('postData', {})

                if 'params' in post_data:
                    # Form data
                    for param in post_data['params']:
                        field_name = param.get('name', '')
                        if field_name:
                            schema['fields'][field_name] = {
                                'type': self._infer_field_type(field_name, param.get('value', '')),
                                'constraints': {},
                            }

        # Add common test fields
        if context == 'web':
            schema['fields'].update({
                'user_id': {'type': 'uuid'},
                'session_id': {'type': 'string', 'constraints': {'min_length': 32, 'max_length': 32}},
                'timestamp': {'type': 'date'},
                'user_agent': {'type': 'string'},
            })
        elif context == 'api':
            schema['fields'].update({
                'request_id': {'type': 'uuid'},
                'api_key': {'type': 'string'},
                'endpoint': {'type': 'string'},
                'response_time': {'type': 'number', 'constraints': {'min': 0, 'max': 10000}},
            })

        return schema

    def _infer_field_type(self, field_name: str, sample_value: str) -> str:
        """Infer field type from field name and sample value"""
        field_name_lower = field_name.lower()

        # Email fields
        if 'email' in field_name_lower:
            return 'email'

        # Name fields
        if any(word in field_name_lower for word in ['name', 'firstname', 'lastname', 'fullname']):
            return 'name'

        # Phone fields
        if any(word in field_name_lower for word in ['phone', 'mobile', 'tel']):
            return 'phone'

        # Address fields
        if any(word in field_name_lower for word in ['address', 'street', 'city', 'country', 'zip']):
            return 'address'

        # Date fields
        if any(word in field_name_lower for word in ['date', 'time', 'timestamp', 'created', 'updated']):
            return 'date'

        # Boolean fields
        if any(word in field_name_lower for word in ['is_', 'has_', 'active', 'enabled', 'valid']):
            return 'boolean'

        # Number fields
        if any(word in field_name_lower for word in ['count', 'amount', 'price', 'quantity', 'age']):
            return 'number'

        # ID fields
        if any(word in field_name_lower for word in ['_id', 'id_']):
            return 'uuid'

        # Default to string
        return 'string'

    async def process_data_shaping_request(self, report_id: str, options: Dict[str, Any] = None):
        """Process data shaping request for a report"""
        try:
            logger.info(f"Processing data shaping request for report {report_id}")

            if options is None:
                options = {}

            # Get report data and signals
            report_data, signals = await self._get_report_data(report_id)

            if not signals:
                logger.warning(f"No signals found for report {report_id}")
                return

            # Process signals for data extraction
            extracted_data = await self._extract_data_from_signals(signals)

            # Generate test schema
            schema = self.generate_test_schema(extracted_data, options.get('context', 'web'))

            # Generate fixtures
            fixtures_result = self.generate_fixtures(
                schema,
                count=options.get('record_count', 10)
            )

            # Validate referential integrity
            integrity_report = self.validate_referential_integrity({
                'test_data': fixtures_result['fixtures']
            })

            # Save shaped data
            await self._save_shaped_data(report_id, {
                'schema': schema,
                'fixtures': fixtures_result,
                'integrity_report': integrity_report,
                'extracted_data': extracted_data,
            })

            logger.info(f"Completed data shaping for report {report_id}")

        except Exception as e:
            logger.error(f"Data shaping failed for report {report_id}: {e}")

    async def _extract_data_from_signals(self, signals: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Extract data patterns from signals"""
        extracted_data = {
            'form_fields': [],
            'api_endpoints': [],
            'data_patterns': [],
        }

        for signal in signals:
            signal_type = signal['kind']
            s3_key = signal['s3_key']

            if signal_type == 'har':
                # Download and analyze HAR file
                har_path = await self.download_file(s3_key)
                if har_path:
                    # Parse HAR for data patterns
                    har_data = self._parse_har_for_data(har_path)
                    extracted_data['api_endpoints'].extend(har_data.get('endpoints', []))
                    extracted_data['form_fields'].extend(har_data.get('forms', []))
                    os.remove(har_path)

        return extracted_data

    def _parse_har_for_data(self, har_path: str) -> Dict[str, Any]:
        """Parse HAR file for data patterns"""
        try:
            with open(har_path, 'r', encoding='utf-8') as f:
                har_data = json.load(f)

            endpoints = []
            forms = []

            for entry in har_data.get('log', {}).get('entries', []):
                request = entry.get('request', {})
                url = request.get('url', '')
                method = request.get('method', '')

                if method in ['GET', 'POST', 'PUT', 'DELETE']:
                    endpoints.append({
                        'url': url,
                        'method': method,
                        'headers': dict(request.get('headers', [])),
                    })

                # Extract form data
                post_data = request.get('postData', {})
                if 'params' in post_data:
                    for param in post_data['params']:
                        forms.append({
                            'name': param.get('name', ''),
                            'value': param.get('value', ''),
                            'type': 'form_field',
                        })

            return {'endpoints': endpoints, 'forms': forms}

        except Exception as e:
            logger.error(f"HAR data parsing failed: {e}")
            return {'endpoints': [], 'forms': []}

    async def _get_report_data(self, report_id: str) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        """Get report data and associated signals"""
        conn = psycopg2.connect(**self.db_config)
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        try:
            # Get report
            cursor.execute('SELECT * FROM reports WHERE id = %s', (report_id,))
            report = cursor.fetchone()

            if not report:
                raise ValueError(f"Report {report_id} not found")

            # Get signals
            cursor.execute('SELECT * FROM signals WHERE report_id = %s', (report_id,))
            signals = cursor.fetchall()

            return dict(report), [dict(signal) for signal in signals]

        finally:
            cursor.close()
            conn.close()

    async def _save_shaped_data(self, report_id: str, shaped_data: Dict[str, Any]):
        """Save shaped data to S3"""
        try:
            # Generate S3 key
            s3_key = f"shaped-data/{report_id}/fixtures.json"

            # Upload to S3
            self.s3_client.put_object(
                Bucket=self.s3_bucket,
                Key=s3_key,
                Body=json.dumps(shaped_data, indent=2, default=str).encode('utf-8'),
                ContentType='application/json'
            )

            logger.info(f"Saved shaped data for report {report_id} to {s3_key}")

        except Exception as e:
            logger.error(f"Failed to save shaped data for report {report_id}: {e}")
            raise

    async def run(self):
        """Main worker loop"""
        logger.info("Starting Data Shaper Worker")

        while True:
            try:
                # Connect to NATS
                nc = await nats.connect(self.nats_url)

                # Subscribe to data shaping requests
                async def message_handler(msg):
                    try:
                        data = json.loads(msg.data.decode())
                        report_id = data.get('report_id')
                        options = data.get('options', {})

                        if report_id:
                            await self.process_data_shaping_request(report_id, options)
                            # Acknowledge message
                            await msg.ack()
                        else:
                            logger.error("No report_id in message")

                    except Exception as e:
                        logger.error(f"Message processing error: {e}")

                # Subscribe to data shaping queue
                await nc.subscribe("data.shape", cb=message_handler)

                logger.info("Worker ready, waiting for messages...")

                # Keep the connection alive
                while True:
                    await asyncio.sleep(1)

            except Exception as e:
                logger.error(f"Worker error: {e}")
                await asyncio.sleep(5)  # Wait before reconnecting


async def main():
    worker = DataShaperWorker()
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
