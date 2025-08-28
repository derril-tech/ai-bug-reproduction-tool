"""
Configuration for Determinism Controller Worker
"""

import os
from typing import Optional
from datetime import timedelta
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
    max_concurrent_tasks: int = int(os.getenv('MAX_CONCURRENT_TASKS', '3'))
    temp_dir: str = os.getenv('TEMP_DIR', '/tmp/determinism-controller')

    # Determinism settings
    network_interface: str = os.getenv('NETWORK_INTERFACE', 'eth0')
    fake_time_offset = timedelta(hours=int(os.getenv('FAKE_TIME_OFFSET_HOURS', '0')))
    network_latency_ms: int = int(os.getenv('NETWORK_LATENCY_MS', '50'))
    network_bandwidth_kbps: int = int(os.getenv('NETWORK_BANDWIDTH_KBPS', '1000'))
    retry_max_attempts: int = int(os.getenv('RETRY_MAX_ATTEMPTS', '3'))

    # Resource limits
    cpu_limit: float = float(os.getenv('CPU_LIMIT', '0.8'))  # 80% of CPU
    memory_limit_mb: int = int(os.getenv('MEMORY_LIMIT_MB', '1024'))
    disk_quota_mb: int = int(os.getenv('DISK_QUOTA_MB', '500'))

    # Monitoring settings
    monitoring_interval: int = int(os.getenv('MONITORING_INTERVAL', '5'))

    # Logging
    log_level: str = os.getenv('LOG_LEVEL', 'INFO')

    class Config:
        env_file = '.env'
        case_sensitive = False


# Global config instance
config = WorkerConfig()
