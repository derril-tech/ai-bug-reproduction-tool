"""
Configuration for Data Shaper Worker
"""

import os
from typing import Optional, List
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
    temp_dir: str = os.getenv('TEMP_DIR', '/tmp/data-shaper')

    # Data generation settings
    max_records_per_table: int = int(os.getenv('MAX_RECORDS_PER_TABLE', '100'))
    locale: str = os.getenv('FAKER_LOCALE', 'en_US')

    # PII scrubbing settings
    pii_confidence_threshold: float = float(os.getenv('PII_CONFIDENCE_THRESHOLD', '0.5'))
    pii_entities_to_check: List[str] = [
        'PERSON',
        'EMAIL_ADDRESS',
        'PHONE_NUMBER',
        'LOCATION',
        'CREDIT_CARD',
        'SSN',
        'DATE_TIME',
        'IP_ADDRESS',
    ]

    # Logging
    log_level: str = os.getenv('LOG_LEVEL', 'INFO')

    class Config:
        env_file = '.env'
        case_sensitive = False


# Global config instance
config = WorkerConfig()
