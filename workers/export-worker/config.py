import os
from typing import Optional
from pydantic import BaseSettings

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/ai_bug_tool")
    
    # NATS
    NATS_URL: str = os.getenv("NATS_URL", "nats://localhost:4222")
    NATS_CLUSTER_ID: str = os.getenv("NATS_CLUSTER_ID", "ai-bug-tool")
    NATS_CLIENT_ID: str = os.getenv("NATS_CLIENT_ID", "export-worker")
    
    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    
    # GitHub
    GITHUB_TOKEN: Optional[str] = os.getenv("GITHUB_TOKEN")
    GITHUB_API_URL: str = os.getenv("GITHUB_API_URL", "https://api.github.com")
    
    # S3/Storage
    S3_BUCKET: str = os.getenv("S3_BUCKET", "ai-bug-tool-artifacts")
    S3_ENDPOINT: str = os.getenv("S3_ENDPOINT", "http://localhost:9000")
    S3_ACCESS_KEY: str = os.getenv("S3_ACCESS_KEY", "minioadmin")
    S3_SECRET_KEY: str = os.getenv("S3_SECRET_KEY", "minioadmin")
    
    # Export settings
    EXPORT_TEMP_DIR: str = os.getenv("EXPORT_TEMP_DIR", "/tmp/exports")
    MAX_EXPORT_SIZE: int = int(os.getenv("MAX_EXPORT_SIZE", "100000000"))  # 100MB
    
    # Sandbox settings
    CODESANDBOX_API_URL: str = os.getenv("CODESANDBOX_API_URL", "https://codesandbox.io/api/v1")
    STACKBLITZ_API_URL: str = os.getenv("STACKBLITZ_API_URL", "https://stackblitz.com/api")
    
    # Docker settings
    DOCKER_REGISTRY: str = os.getenv("DOCKER_REGISTRY", "localhost:5000")
    DOCKER_IMAGE_PREFIX: str = os.getenv("DOCKER_IMAGE_PREFIX", "ai-bug-tool")
    
    # Report templates
    REPORT_TEMPLATE_DIR: str = os.getenv("REPORT_TEMPLATE_DIR", "/app/templates")
    
    class Config:
        env_file = ".env"

settings = Settings()
