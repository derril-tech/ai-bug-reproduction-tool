# Ingest Worker

The Ingest Worker processes uploaded signals (screenshots, videos, HAR files, logs) and extracts text content using AI/ML models. The extracted text is then merged back into the bug report for better context and analysis.

## Features

- **OCR for Screenshots**: Uses Tesseract to extract text from images
- **ASR for Videos**: Uses OpenAI Whisper to transcribe speech from videos
- **HAR File Parsing**: Extracts URLs, headers, and response data
- **Log Analysis**: Identifies errors and relevant information from log files
- **Concurrent Processing**: Handles multiple signals simultaneously with configurable limits
- **S3 Integration**: Downloads files from S3/Minio storage
- **Database Updates**: Merges extracted text back into reports

## Configuration

The worker uses the following environment variables:

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
TEMP_DIR=/tmp/ingest-worker
LOG_LEVEL=INFO

# AI Models
WHISPER_MODEL_SIZE=small
TESSERACT_LANG=eng
```

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Install system dependencies (Ubuntu/Debian):
```bash
sudo apt-get install tesseract-ocr tesseract-ocr-eng ffmpeg libsm6 libxext6 libgl1-mesa-glx
```

3. For GPU acceleration (optional):
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

## Usage

### Running the Worker

```bash
python worker.py
```

### Testing

Run the test suite to verify functionality:

```bash
python test_worker.py
```

This will test:
- OCR functionality with sample images
- HAR file parsing
- Log file analysis
- Video processing (if Whisper is available)

### Docker

Build and run with Docker:

```bash
# Build
docker build -t ingest-worker .

# Run
docker run -e DB_HOST=postgres -e REDIS_HOST=redis -e NATS_URL=nats://nats:4222 ingest-worker
```

## Message Format

The worker listens for messages on the `report.ingest` NATS subject with the following format:

```json
{
  "report_id": "uuid-of-the-report"
}
```

## Processing Flow

1. **Receive Message**: Worker receives ingestion request for a report
2. **Fetch Signals**: Query database for all signals associated with the report
3. **Download Files**: Download signal files from S3 storage
4. **Extract Text**:
   - Screenshots → OCR with Tesseract
   - Videos → ASR with Whisper
   - HAR files → Parse JSON and extract relevant data
   - Logs → Analyze for errors and patterns
5. **Update Report**: Merge extracted text into report description
6. **Cleanup**: Remove temporary files

## Error Handling

- **Retry Logic**: Failed downloads are retried up to 3 times with exponential backoff
- **Graceful Degradation**: If AI models fail to load, processing continues without those features
- **Logging**: Comprehensive logging for monitoring and debugging
- **Exception Handling**: Individual signal processing errors don't stop batch processing

## Performance Considerations

- **Concurrency Control**: Configurable concurrent task limit prevents resource exhaustion
- **Memory Management**: Temporary files are cleaned up after processing
- **Model Caching**: AI models are loaded once at startup
- **Batch Processing**: Multiple signals for a report are processed concurrently

## Monitoring

The worker provides health checks and metrics:

- **Health Endpoint**: Check if worker is running and models are loaded
- **Processing Metrics**: Track success rates and processing times
- **Error Logging**: Detailed logs for troubleshooting
- **Database Monitoring**: Track report updates and signal processing status

## Troubleshooting

### Common Issues

1. **Tesseract not found**: Install `tesseract-ocr` package
2. **Whisper model loading fails**: Check available disk space and memory
3. **S3 connection issues**: Verify endpoint and credentials
4. **Database connection fails**: Check network connectivity and credentials

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=DEBUG python worker.py
```

### Manual Testing

Test individual components:

```python
from worker import IngestWorker

worker = IngestWorker()

# Test OCR
text = worker.extract_text_from_image('path/to/image.png')
print(f"Extracted text: {text}")

# Test HAR parsing
data = worker.extract_text_from_har('path/to/file.har')
print(f"HAR data: {data}")
```
