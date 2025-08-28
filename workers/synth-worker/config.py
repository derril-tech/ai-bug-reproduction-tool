"""
Configuration for Synth Worker
"""

import os
from typing import Optional
from pydantic import BaseSettings


class WorkerConfig(BaseSettings):
    """Worker configuration using Pydantic settings"""

    # Database settings
    db_host: str = os.getenv('DB_HOST', 'localhost')
    db_port: int = int(os.getenv('DB_PORT', '5432'))
    db_name: str = os.getenv('DB_NAME', 'bug_repro')
    db_username: str = os.getenv('DB_USERNAME', 'postgres')
    db_password: str = os.getenv('DB_PASSWORD', 'postgres')

    # Redis settings
    redis_host: str = os.getenv('REDIS_HOST', 'localhost')
    redis_port: int = int(os.getenv('REDIS_PORT', '6379'))

    # NATS settings
    nats_url: str = os.getenv('NATS_URL', 'nats://localhost:4222')

    # S3/Minio settings
    s3_endpoint: Optional[str] = os.getenv('S3_ENDPOINT')
    s3_access_key: Optional[str] = os.getenv('S3_ACCESS_KEY')
    s3_secret_key: Optional[str] = os.getenv('S3_SECRET_KEY')
    s3_bucket: str = os.getenv('S3_BUCKET', 'bug-repro-artifacts')

    # Worker settings
    max_concurrent_tasks: int = int(os.getenv('MAX_CONCURRENT_TASKS', '5'))
    temp_dir: str = os.getenv('TEMP_DIR', '/tmp/synth-worker')

    # Playwright settings
    browser_timeout: int = int(os.getenv('BROWSER_TIMEOUT', '30000'))
    page_load_timeout: int = int(os.getenv('PAGE_LOAD_TIMEOUT', '10000'))
    element_wait_timeout: int = int(os.getenv('ELEMENT_WAIT_TIMEOUT', '5000'))

    # Test generation settings
    max_test_steps: int = int(os.getenv('MAX_TEST_STEPS', '50'))
    enable_screenshots: bool = os.getenv('ENABLE_SCREENSHOTS', 'true').lower() == 'true'
    enable_video_recording: bool = os.getenv('ENABLE_VIDEO_RECORDING', 'false').lower() == 'true'

    # Selector strategies
    preferred_selectors: list = ['role_aria', 'data_testid', 'semantic', 'css_fallback', 'xpath_fallback']

    # Logging
    log_level: str = os.getenv('LOG_LEVEL', 'INFO')

    class Config:
        env_file = '.env'
        case_sensitive = False


# Global config instance
config = WorkerConfig()
