# Map Worker

The Map Worker is responsible for RAG (Retrieval-Augmented Generation) operations, framework detection, and module path guessing for the AI Bug Reproduction Tool.

## Features

- **Framework Detection**: Automatically detects Playwright, Cypress, Pytest, Jest, and other testing frameworks
- **Module Path Guessing**: Suggests relevant module paths based on bug report queries
- **Document Indexing**: Indexes repository documents into pgvector for semantic search
- **Vector Search**: Performs similarity search on indexed documents
- **Confidence Scoring**: Calculates confidence scores for mapping results

## Configuration

Set the following environment variables:

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/ai_bug_tool
NATS_URL=nats://localhost:4222
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=your_openai_key
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
```

## Usage

### Running the Worker

```bash
# Install dependencies
pip install -r requirements.txt

# Run the worker
python worker.py
```

### Docker

```bash
# Build the image
docker build -t map-worker .

# Run the container
docker run -e DATABASE_URL=... -e NATS_URL=... map-worker
```

## API

The worker listens for NATS messages on the `mapping.request` topic:

```json
{
  "project_id": "uuid",
  "report_id": "uuid", 
  "query": "bug description",
  "repo_path": "/path/to/repo"
}
```

It publishes results to the `mapping.completed` topic:

```json
{
  "mapping_id": "uuid",
  "report_id": "uuid",
  "framework_scores": {
    "playwright": 0.8,
    "cypress": 0.2
  },
  "module_suggestions": [
    ["tests/login.spec.js", 0.9],
    ["src/components/Login.jsx", 0.7]
  ],
  "doc_results": [
    {
      "file_path": "README.md",
      "chunk_text": "...",
      "similarity": 0.85
    }
  ]
}
```

## Framework Detection

The worker detects frameworks by analyzing:

- File names and paths
- File content patterns
- Configuration files
- Import statements

Supported frameworks:
- Playwright
- Cypress  
- Pytest
- Jest
- And more...

## Module Path Guessing

Module path suggestions are based on:

- Keyword matching in file paths
- Test file detection
- Configuration file detection
- Relevance scoring

## Document Indexing

Documents are indexed with:

- Chunk-based splitting (1000 chars with 200 char overlap)
- Sentence boundary preservation
- Vector embeddings using sentence-transformers
- Metadata storage

## Database Schema

The worker uses the `doc_chunks` table:

```sql
CREATE TABLE doc_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding vector(384),
    meta JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);
```
