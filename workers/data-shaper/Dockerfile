# Data Shaper Worker Dockerfile
FROM python:3.11-slim

# Install system dependencies for NLP and ML
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download spaCy model for PII detection
RUN python -m spacy download en_core_web_sm

# Create app user
RUN useradd -m -u 1001 -s /bin/bash worker

# Set working directory
WORKDIR /app

# Copy application code
COPY . .

# Create directories for processing
RUN mkdir -p /app/temp /app/logs /app/cache

# Set ownership
RUN chown -R worker:worker /app

# Switch to non-root user
USER worker

# Environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD python -c "print('Data shaper healthy')" || exit 1

# Default command
CMD ["python", "worker.py"]
