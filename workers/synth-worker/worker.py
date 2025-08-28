#!/usr/bin/env python3
"""
Synth Worker - Generates reproducible test scripts from HAR files and signals

Features:
- Generate Playwright scripts with role/aria selectors
- Create fallback selectors (CSS, XPath)
- Extract user interactions from HAR files
- Generate deterministic test scenarios
- Handle different web frameworks
- Create test fixtures and data
"""

import asyncio
import json
import logging
import os
import re
import hashlib
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from urllib.parse import urlparse, parse_qs, urljoin

import boto3
import nats
import psycopg2
import psycopg2.extras
import httpx
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
from jinja2 import Environment, FileSystemLoader
import redis
from tenacity import retry, stop_after_attempt, wait_exponential

from config import config

# Configure logging
logging.basicConfig(
    level=getattr(logging, config.log_level),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SynthWorker:
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

        # Template engine
        template_dir = Path(__file__).parent / 'templates'
        self.template_env = Environment(loader=FileSystemLoader(template_dir))

        # Selector strategies
        self.selector_strategies = [
            'role_aria',  # Primary: role and aria attributes
            'data_testid',  # data-testid, data-cy, etc.
            'semantic',    # Semantic HTML elements
            'css_fallback', # CSS selectors
            'xpath_fallback', # XPath selectors
        ]

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def download_file(self, s3_key: str) -> Optional[str]:
        """Download file from S3 to temporary location"""
        try:
            # Create temp file in configured directory
            os.makedirs(self.temp_dir, exist_ok=True)
            temp_path = os.path.join(self.temp_dir, f"synth_{hash(s3_key) % 1000}_{Path(s3_key).name}")

            # Download from S3
            self.s3_client.download_file(self.s3_bucket, s3_key, temp_path)
            logger.info(f"Downloaded file from S3: {s3_key}")
            return temp_path

        except Exception as e:
            logger.error(f"Failed to download file {s3_key}: {e}")
            return None

    def parse_har_for_interactions(self, har_path: str) -> Dict[str, Any]:
        """Parse HAR file to extract user interactions and page flow"""
        try:
            with open(har_path, 'r', encoding='utf-8') as f:
                har_data = json.load(f)

            interactions = {
                'navigation': [],
                'form_submissions': [],
                'clicks': [],
                'inputs': [],
                'api_calls': [],
                'page_loads': [],
            }

            # Extract page information
            pages = har_data.get('log', {}).get('pages', [])
            for page in pages:
                interactions['page_loads'].append({
                    'url': page.get('title', ''),
                    'start_time': page.get('startedDateTime'),
                    'timings': page.get('pageTimings', {}),
                })

            # Analyze network requests for interactions
            entries = har_data.get('log', {}).get('entries', [])
            for entry in entries:
                request = entry.get('request', {})
                response = entry.get('response', {})
                method = request.get('method', '').upper()
                url = request.get('url', '')

                # Navigation requests (GET requests to HTML pages)
                if method == 'GET' and self._is_html_request(response):
                    interactions['navigation'].append({
                        'url': url,
                        'timestamp': entry.get('startedDateTime'),
                        'response_time': response.get('status'),
                    })

                # Form submissions (POST requests with form data)
                elif method == 'POST' and self._has_form_data(request):
                    interactions['form_submissions'].append({
                        'url': url,
                        'method': method,
                        'form_data': self._extract_form_data(request),
                        'timestamp': entry.get('startedDateTime'),
                    })

                # API calls (JSON requests)
                elif self._is_api_call(request, response):
                    interactions['api_calls'].append({
                        'url': url,
                        'method': method,
                        'headers': dict(request.get('headers', [])),
                        'request_body': request.get('postData', {}).get('text', ''),
                        'response_status': response.get('status'),
                        'timestamp': entry.get('startedDateTime'),
                    })

            logger.info(f"Extracted interactions from HAR: {sum(len(v) for v in interactions.values())} total")
            return interactions

        except Exception as e:
            logger.error(f"HAR parsing failed for {har_path}: {e}")
            return {}

    def _is_html_request(self, response: Dict[str, Any]) -> bool:
        """Check if response is HTML content"""
        content = response.get('content', {})
        mime_type = content.get('mimeType', '').lower()
        return 'text/html' in mime_type or mime_type == ''

    def _has_form_data(self, request: Dict[str, Any]) -> bool:
        """Check if request has form data"""
        post_data = request.get('postData', {})
        return 'text' in post_data or 'params' in post_data

    def _extract_form_data(self, request: Dict[str, Any]) -> Dict[str, str]:
        """Extract form data from request"""
        post_data = request.get('postData', {})
        form_data = {}

        # Handle URL-encoded form data
        if 'params' in post_data:
            for param in post_data['params']:
                form_data[param.get('name', '')] = param.get('value', '')

        # Handle raw text (JSON, etc.)
        elif 'text' in post_data:
            try:
                # Try to parse as JSON first
                parsed = json.loads(post_data['text'])
                if isinstance(parsed, dict):
                    form_data.update(parsed)
            except json.JSONDecodeError:
                # If not JSON, treat as raw text
                form_data['_raw'] = post_data['text']

        return form_data

    def _is_api_call(self, request: Dict[str, Any], response: Dict[str, Any]) -> bool:
        """Check if request is an API call"""
        headers = {h.get('name', '').lower(): h.get('value', '') for h in request.get('headers', [])}
        content_type = headers.get('content-type', '').lower()
        accept = headers.get('accept', '').lower()

        # Check for JSON content
        is_json = ('application/json' in content_type or
                  'application/json' in accept or
                  'json' in content_type or
                  'json' in accept)

        # Check for API-like URL patterns
        url = request.get('url', '')
        is_api_url = any(pattern in url.lower() for pattern in ['/api/', '/v1/', '/v2/', '/graphql'])

        return is_json or is_api_url

    def generate_playwright_script(self, interactions: Dict[str, Any], report_data: Dict[str, Any]) -> str:
        """Generate Playwright test script from interactions"""
        try:
            template = self.template_env.get_template('playwright_test.js.j2')

            # Prepare template variables
            template_vars = {
                'report_title': report_data.get('title', 'Generated Test'),
                'report_description': report_data.get('description', ''),
                'base_url': self._extract_base_url(interactions),
                'navigation_steps': self._generate_navigation_steps(interactions),
                'form_steps': self._generate_form_steps(interactions),
                'api_steps': self._generate_api_steps(interactions),
                'assertions': self._generate_assertions(interactions, report_data),
                'selectors': self._generate_selectors(interactions),
                'test_data': self._generate_test_data(interactions),
            }

            # Render template
            script = template.render(**template_vars)
            logger.info(f"Generated Playwright script with {len(template_vars['navigation_steps'])} steps")
            return script

        except Exception as e:
            logger.error(f"Playwright script generation failed: {e}")
            return self._generate_minimal_script()

    def _extract_base_url(self, interactions: Dict[str, Any]) -> str:
        """Extract base URL from interactions"""
        urls = []

        # Collect all URLs from different interaction types
        for interaction_type in ['navigation', 'form_submissions', 'api_calls']:
            for item in interactions.get(interaction_type, []):
                if 'url' in item:
                    urls.append(item['url'])

        if not urls:
            return 'https://example.com'

        # Find most common domain
        domains = [urlparse(url).netloc for url in urls if urlparse(url).netloc]
        if domains:
            return f"https://{max(set(domains), key=domains.count)}"

        return 'https://example.com'

    def _generate_navigation_steps(self, interactions: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate navigation steps from interactions"""
        steps = []

        for page_load in interactions.get('page_loads', []):
            url = page_load.get('url', '')
            if url:
                steps.append({
                    'type': 'navigation',
                    'url': url,
                    'description': f'Navigate to {url}',
                    'selector': None,
                    'action': 'goto',
                    'value': url,
                })

        return steps

    def _generate_form_steps(self, interactions: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate form interaction steps"""
        steps = []

        for form in interactions.get('form_submissions', []):
            url = form.get('url', '')
            form_data = form.get('form_data', {})

            # Add form field filling steps
            for field_name, field_value in form_data.items():
                if field_name != '_raw':
                    steps.append({
                        'type': 'input',
                        'selector': self._generate_selector('input', field_name),
                        'description': f'Fill {field_name} field',
                        'action': 'fill',
                        'value': field_value,
                        'field_name': field_name,
                    })

            # Add form submission step
            steps.append({
                'type': 'submit',
                'selector': self._generate_selector('form', 'submit'),
                'description': 'Submit form',
                'action': 'click',
                'value': None,
            })

        return steps

    def _generate_api_steps(self, interactions: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate API call verification steps"""
        steps = []

        for api_call in interactions.get('api_calls', []):
            steps.append({
                'type': 'api_verification',
                'url': api_call.get('url'),
                'method': api_call.get('method'),
                'description': f'Verify API call to {api_call.get("url")}',
                'expected_status': api_call.get('response_status'),
                'headers': api_call.get('headers', {}),
            })

        return steps

    def _generate_assertions(self, interactions: Dict[str, Any], report_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate test assertions based on expected behavior"""
        assertions = []

        # Basic page load assertion
        assertions.append({
            'type': 'page_load',
            'description': 'Page should load successfully',
            'assertion': 'expect(page).toHaveURL(/./)',
        })

        # Error-specific assertions based on report
        description = report_data.get('description', '').lower()
        if 'error' in description or 'fail' in description:
            assertions.append({
                'type': 'error_check',
                'description': 'Check for error messages',
                'assertion': 'await expect(page.locator("[class*="error"]")).toBeVisible()',
            })

        return assertions

    def _generate_selectors(self, interactions: Dict[str, Any]) -> Dict[str, str]:
        """Generate robust selectors for elements"""
        selectors = {}

        # Generate selectors for form fields
        for form in interactions.get('form_submissions', []):
            form_data = form.get('form_data', {})
            for field_name in form_data.keys():
                if field_name != '_raw':
                    selectors[f'input_{field_name}'] = self._generate_selector('input', field_name)

        return selectors

    def _generate_selector(self, element_type: str, identifier: str) -> str:
        """Generate a robust selector with fallbacks"""
        selectors = []

        # Role/ARIA selector (preferred)
        selectors.append(f'[role="{element_type}"]')
        selectors.append(f'[aria-label*="{identifier}"]')
        selectors.append(f'[aria-labelledby*="{identifier}"]')

        # Data attributes
        selectors.append(f'[data-testid="{identifier}"]')
        selectors.append(f'[data-cy="{identifier}"]')
        selectors.append(f'[data-test="{identifier}"]')

        # Semantic selectors
        if element_type == 'input':
            selectors.append(f'input[name="{identifier}"]')
            selectors.append(f'input[id="{identifier}"]')
            selectors.append(f'input[placeholder*="{identifier}"]')
        elif element_type == 'button':
            selectors.append(f'button:has-text("{identifier}")')
            selectors.append(f'[type="submit"]')
        elif element_type == 'form':
            selectors.append('form')

        # CSS fallback
        selectors.append(f'{element_type}[name="{identifier}"]')
        selectors.append(f'{element_type}[id="{identifier}"]')

        # XPath fallback
        selectors.append(f'//{element_type}[contains(@name, "{identifier}")]')
        selectors.append(f'//{element_type}[contains(@id, "{identifier}")]')

        # Return chained selector with fallbacks
        return ' >> '.join(f'page.locator("{sel}")' for sel in selectors)

    def _generate_test_data(self, interactions: Dict[str, Any]) -> Dict[str, Any]:
        """Generate test data for the scenario"""
        test_data = {
            'users': [],
            'form_data': {},
            'api_payloads': [],
        }

        # Extract form data patterns
        for form in interactions.get('form_submissions', []):
            form_data = form.get('form_data', {})
            test_data['form_data'].update(form_data)

        # Extract API payloads
        for api_call in interactions.get('api_calls', []):
            if api_call.get('request_body'):
                test_data['api_payloads'].append({
                    'url': api_call.get('url'),
                    'method': api_call.get('method'),
                    'body': api_call.get('request_body'),
                })

        return test_data

    def _generate_minimal_script(self) -> str:
        """Generate a minimal fallback script"""
        return '''const { test, expect } = require('@playwright/test');

test('Generated Test', async ({ page }) => {
  // Navigate to the application
  await page.goto('https://example.com');

  // Add your test steps here
  await expect(page).toHaveTitle(/./);
});
'''

    async def generate_test_scenario(self, report_id: str) -> Dict[str, Any]:
        """Generate complete test scenario for a report"""
        try:
            # Get report data and signals
            report_data, signals = await self._get_report_data(report_id)

            if not signals:
                logger.warning(f"No signals found for report {report_id}")
                return {'error': 'No signals available for test generation'}

            # Process HAR files and other signals
            all_interactions = {}
            extracted_texts = []

            for signal in signals:
                signal_type = signal['kind']
                s3_key = signal['s3_key']

                if signal_type == 'har':
                    # Download and parse HAR file
                    har_path = await self.download_file(s3_key)
                    if har_path:
                        interactions = self.parse_har_for_interactions(har_path)
                        all_interactions.update(interactions)
                        os.remove(har_path)

                elif signal_type in ['screenshot', 'log']:
                    # Extract text content (already processed by ingest worker)
                    if signal.get('meta', {}).get('extracted_text'):
                        extracted_texts.append(signal['meta']['extracted_text'])

            # Generate Playwright script
            playwright_script = self.generate_playwright_script(all_interactions, report_data)

            # Generate test fixtures and configuration
            fixtures = self._generate_fixtures(all_interactions)
            compose_config = self._generate_compose_config(all_interactions)

            return {
                'playwright_script': playwright_script,
                'fixtures': fixtures,
                'compose_config': compose_config,
                'interactions': all_interactions,
                'extracted_texts': extracted_texts,
            }

        except Exception as e:
            logger.error(f"Test scenario generation failed for report {report_id}: {e}")
            return {'error': str(e)}

    def _generate_fixtures(self, interactions: Dict[str, Any]) -> Dict[str, Any]:
        """Generate test fixtures"""
        fixtures = {
            'users': [
                {
                    'email': 'test@example.com',
                    'password': 'testpassword123',
                    'name': 'Test User',
                }
            ],
            'form_data': {},
            'api_responses': [],
        }

        # Extract form data patterns for fixtures
        for form in interactions.get('form_submissions', []):
            fixtures['form_data'].update(form.get('form_data', {}))

        # Add mock API responses
        for api_call in interactions.get('api_calls', []):
            fixtures['api_responses'].append({
                'url': api_call.get('url'),
                'method': api_call.get('method'),
                'status': api_call.get('response_status', 200),
                'body': {},
            })

        return fixtures

    def _generate_compose_config(self, interactions: Dict[str, Any]) -> Dict[str, Any]:
        """Generate Docker Compose configuration for test environment"""
        return {
            'version': '3.8',
            'services': {
                'web-app': {
                    'image': 'nginx:alpine',
                    'ports': ['8080:80'],
                    'volumes': ['./nginx.conf:/etc/nginx/nginx.conf'],
                },
                'database': {
                    'image': 'postgres:15-alpine',
                    'environment': {
                        'POSTGRES_DB': 'test_db',
                        'POSTGRES_USER': 'test_user',
                        'POSTGRES_PASSWORD': 'test_password',
                    },
                    'ports': ['5432:5432'],
                }
            }
        }

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

    async def save_generated_test(self, report_id: str, test_data: Dict[str, Any]) -> str:
        """Save generated test to S3 and database"""
        try:
            # Generate test file content
            test_content = test_data.get('playwright_script', '')
            fixtures = test_data.get('fixtures', {})
            compose_config = test_data.get('compose_config', {})

            # Create test package structure
            test_package = {
                'test.spec.ts': test_content,
                'fixtures.json': json.dumps(fixtures, indent=2),
                'docker-compose.yml': json.dumps(compose_config, indent=2),
                'README.md': self._generate_readme(test_data),
            }

            # Upload to S3
            s3_key = f"tests/generated/{report_id}/test-package.zip"

            # For now, store individual files
            uploaded_files = {}
            for filename, content in test_package.items():
                file_key = f"tests/generated/{report_id}/{filename}"
                self.s3_client.put_object(
                    Bucket=self.s3_bucket,
                    Key=file_key,
                    Body=content.encode('utf-8'),
                    ContentType='text/plain'
                )
                uploaded_files[filename] = file_key

            # Save to database
            conn = psycopg2.connect(**self.db_config)
            cursor = conn.cursor()

            # Insert into repros table
            cursor.execute("""
                INSERT INTO repros (
                    report_id, framework, entry, docker_compose, seed, status, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, NOW())
                RETURNING id
            """, (
                report_id,
                'playwright',
                'test.spec.ts',
                json.dumps(compose_config),
                json.dumps(fixtures),
                'completed',
            ))

            repro_id = cursor.fetchone()[0]

            # Insert test steps
            interactions = test_data.get('interactions', {})
            step_order = 0

            for step_type, steps in interactions.items():
                for step in steps:
                    cursor.execute("""
                        INSERT INTO steps (
                            repro_id, order_idx, kind, payload, created_at
                        ) VALUES (%s, %s, %s, %s, NOW())
                    """, (
                        repro_id,
                        step_order,
                        step_type,
                        json.dumps(step),
                    ))
                    step_order += 1

            conn.commit()
            cursor.close()
            conn.close()

            logger.info(f"Saved generated test for report {report_id}, repro ID: {repro_id}")
            return str(repro_id)

        except Exception as e:
            logger.error(f"Failed to save generated test for report {report_id}: {e}")
            raise

    def _generate_readme(self, test_data: Dict[str, Any]) -> str:
        """Generate README for the test package"""
        return f"""# Generated Test Case

This test case was automatically generated from bug report signals.

## Files

- `test.spec.ts` - Playwright test script
- `fixtures.json` - Test data fixtures
- `docker-compose.yml` - Test environment configuration

## Running the Test

1. Start the test environment:
   ```bash
   docker-compose up -d
   ```

2. Run the test:
   ```bash
   npx playwright test test.spec.ts
   ```

## Generated Steps

{len(test_data.get('interactions', {}).get('navigation', []))} navigation steps
{len(test_data.get('interactions', {}).get('form_submissions', []))} form submissions
{len(test_data.get('interactions', {}).get('api_calls', []))} API calls

## Notes

This test was generated automatically and may require manual adjustments.
"""

    async def process_synthesis_request(self, report_id: str):
        """Process synthesis request for a report"""
        try:
            logger.info(f"Processing synthesis request for report {report_id}")

            # Generate test scenario
            test_data = await self.generate_test_scenario(report_id)

            if 'error' in test_data:
                logger.error(f"Synthesis failed for report {report_id}: {test_data['error']}")
                return

            # Save generated test
            repro_id = await self.save_generated_test(report_id, test_data)

            logger.info(f"Completed synthesis for report {report_id}, created repro {repro_id}")

        except Exception as e:
            logger.error(f"Synthesis processing failed for report {report_id}: {e}")

    async def run(self):
        """Main worker loop"""
        logger.info("Starting Synth Worker")

        while True:
            try:
                # Connect to NATS
                nc = await nats.connect(self.nats_url)

                # Subscribe to synthesis requests
                async def message_handler(msg):
                    try:
                        data = json.loads(msg.data.decode())
                        report_id = data.get('report_id')

                        if report_id:
                            await self.process_synthesis_request(report_id)
                            # Acknowledge message
                            await msg.ack()
                        else:
                            logger.error("No report_id in message")

                    except Exception as e:
                        logger.error(f"Message processing error: {e}")

                # Subscribe to synthesis queue
                await nc.subscribe("report.synth", cb=message_handler)

                logger.info("Worker ready, waiting for messages...")

                # Keep the connection alive
                while True:
                    await asyncio.sleep(1)

            except Exception as e:
                logger.error(f"Worker error: {e}")
                await asyncio.sleep(5)  # Wait before reconnecting


async def main():
    worker = SynthWorker()
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
