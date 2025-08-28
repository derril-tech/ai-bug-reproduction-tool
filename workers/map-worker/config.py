import os
from typing import Dict, List, Optional
from pydantic import BaseSettings

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/ai_bug_tool")
    
    # NATS
    NATS_URL: str = os.getenv("NATS_URL", "nats://localhost:4222")
    NATS_CLUSTER_ID: str = os.getenv("NATS_CLUSTER_ID", "ai-bug-tool")
    NATS_CLIENT_ID: str = os.getenv("NATS_CLIENT_ID", "map-worker")
    
    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    
    # OpenAI
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4")
    
    # Vector embeddings
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    VECTOR_DIMENSION: int = 384
    
    # Framework detection patterns
    FRAMEWORK_PATTERNS: Dict[str, List[str]] = {
        "playwright": [
            "playwright.config",
            "playwright",
            "page.goto",
            "page.click",
            "expect(page)"
        ],
        "cypress": [
            "cypress.config",
            "cypress",
            "cy.visit",
            "cy.get",
            "cy.should"
        ],
        "pytest": [
            "pytest.ini",
            "conftest.py",
            "test_",
            "pytest",
            "assert"
        ],
        "jest": [
            "jest.config",
            "package.json",
            "describe(",
            "it(",
            "test(",
            "expect("
        ]
    }
    
    # File extensions to index
    INDEXABLE_EXTENSIONS: List[str] = [
        ".md", ".txt", ".js", ".ts", ".jsx", ".tsx", 
        ".py", ".java", ".go", ".rb", ".php", ".cs",
        ".json", ".yaml", ".yml", ".toml", ".ini"
    ]
    
    # Chunk size for document splitting
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200
    
    class Config:
        env_file = ".env"

settings = Settings()
