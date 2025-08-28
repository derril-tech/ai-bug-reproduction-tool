# Signal Worker

The Signal Worker processes HAR files and log files to extract structured data and error signatures. It uses machine learning to cluster similar error signatures and stores them in the database for analysis and pattern detection.

## Features

- **HAR File Parsing**: Extracts request/response data, timings, and error patterns
- **Log File Analysis**: Parses log entries and extracts error signatures
- **Error Classification**: Automatically categorizes errors by type (TypeError, ReferenceError, etc.)
- **Signature Clustering**: Uses vector embeddings to group similar errors
- **Database Integration**: Stores clustered signatures with pgvector for similarity search
- **Concurrent Processing**: Handles multiple signals simultaneously

## Configuration

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bug_repro
DB_USERNAME=postgres
DB_PASSWORD=postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# NATS
NATS_URL=nats://localhost:4222

# S3/Minio
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=bug-repro-artifacts

# Worker Settings
MAX_CONCURRENT_TASKS=5
TEMP_DIR=/tmp/signal-worker
LOG_LEVEL=INFO

# Clustering Settings
SIMILARITY_THRESHOLD=0.3
MIN_SAMPLES_CLUSTER=2
```

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Download NLTK data (for text processing):
```bash
python -c "import nltk; nltk.download('punkt'); nltk.download('stopwords')"
```

## Usage

### Running the Worker

```bash
python worker.py
```

### Testing

Run the test suite:

```bash
python test_worker.py
```

This will test:
- HAR file parsing
- Log file analysis
- Error classification
- Signature clustering (if ML models are available)

### Docker

```bash
# Build
docker build -t signal-worker .

# Run
docker run -e DB_HOST=postgres -e REDIS_HOST=redis -e NATS_URL=nats://nats:4222 signal-worker
```

## Processing Flow

1. **Receive Message**: Worker receives signal processing request for a report
2. **Fetch Signals**: Query database for HAR and log signals
3. **Download Files**: Download signal files from S3 storage
4. **Parse Files**:
   - HAR files → Extract requests, responses, timings
   - Log files → Parse entries, extract error signatures
5. **Classify Errors**: Categorize errors by type and severity
6. **Cluster Signatures**: Group similar errors using vector embeddings
7. **Store Results**: Save clustered signatures to database with embeddings

## Error Classification

The worker automatically classifies errors into types:

- **TypeError**: Property access on undefined/null
- **ReferenceError**: Undefined variable access
- **SyntaxError**: JavaScript syntax errors
- **NetworkError**: Connection/timeout issues
- **DatabaseError**: Database-related errors
- **AuthenticationError**: Auth/permission issues
- **TimeoutError**: Request timeouts
- **GenericError**: Other errors

## Signature Clustering

Similar error signatures are grouped using:

1. **Text Embeddings**: Convert error messages to vector embeddings
2. **Similarity Calculation**: Use cosine similarity to find similar errors
3. **Density Clustering**: DBSCAN algorithm to group similar signatures
4. **Frequency Tracking**: Count occurrences of each signature cluster

## Database Schema

The worker creates error signatures in the database:

```sql
CREATE TABLE error_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES reports(id),
    signature_hash VARCHAR(255) UNIQUE,
    error_type VARCHAR(100),
    message TEXT,
    details TEXT,
    stack_trace TEXT,
    key_components JSONB,
    severity VARCHAR(20),
    frequency INTEGER DEFAULT 1,
    embedding vector(384),  -- For similarity search
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for similarity search
CREATE INDEX error_signatures_embedding_idx ON error_signatures
USING hnsw (embedding vector_cosine_ops);
```

## Message Format

The worker listens for messages on the `report.signals` NATS subject:

```json
{
  "report_id": "uuid-of-the-report"
}
```

## Performance Considerations

- **Batch Processing**: Multiple signals processed concurrently
- **Memory Management**: Temporary files cleaned up after processing
- **Model Caching**: Embeddings model loaded once at startup
- **Configurable Limits**: Concurrent task limits prevent resource exhaustion
- **Efficient Clustering**: DBSCAN algorithm scales well with data size

## Monitoring

The worker provides:

- **Health Checks**: Service availability monitoring
- **Processing Metrics**: Success rates, processing times, error counts
- **Clustering Stats**: Number of clusters, signature frequencies
- **Database Metrics**: Storage usage, query performance

## Troubleshooting

### Common Issues

1. **NLTK Data Missing**: Run `python -c "import nltk; nltk.download('punkt')"`
2. **ML Models Not Loading**: Check available memory and disk space
3. **Database Connection**: Verify connection string and credentials
4. **S3 Access**: Check endpoint, credentials, and bucket permissions

### Debug Mode

Enable detailed logging:

```bash
LOG_LEVEL=DEBUG python worker.py
```

### Manual Processing

Process individual files:

```python
from worker import SignalWorker

worker = SignalWorker()

# Process HAR file
har_data = worker.parse_har_file('path/to/file.har')
print(f"Parsed {len(har_data.get('entries', []))} requests")

# Process log file
log_data = worker.parse_log_file('path/to/file.log')
print(f"Found {len(log_data.get('error_signatures', []))} error signatures")
```

## Integration

The Signal Worker integrates with:

- **API Gateway**: Receives processing requests via NATS
- **S3 Storage**: Downloads signal files for processing
- **PostgreSQL**: Stores clustered signatures with vector embeddings
- **Redis**: Caches processing results and metadata
- **Ingest Worker**: Processes the same signals for text extraction

## Scaling

For high-volume processing:

1. **Horizontal Scaling**: Run multiple worker instances
2. **Queue Partitioning**: Process different report types separately
3. **Batch Processing**: Group similar signals for efficient processing
4. **Resource Allocation**: Adjust concurrent task limits based on available resources
