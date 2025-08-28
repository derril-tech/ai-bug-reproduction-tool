# Signal Worker Dockerfile
FROM python:3.11-slim

# Install system dependencies for text processing and ML
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download NLTK data
RUN python -c "import nltk; nltk.download('punkt'); nltk.download('stopwords')"

# Create app user
RUN useradd -m -u 1001 -s /bin/bash worker

# Set working directory
WORKDIR /app

# Copy application code
COPY . .

# Create directories for processing
RUN mkdir -p /app/temp /app/logs /app/models

# Set ownership
RUN chown -R worker:worker /app

# Switch to non-root user
USER worker

# Environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD python -c "print('Signal worker healthy')" || exit 1

# Default command
CMD ["python", "worker.py"]
