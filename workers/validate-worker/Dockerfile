# Validate Worker Dockerfile
FROM python:3.11-slim

# Install system dependencies for browser automation and video processing
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libxss1 \
    libasound2 \
    ffmpeg \
    libsm6 \
    libxext6 \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers
RUN playwright install chromium

# Create app user
RUN useradd -m -u 1001 -s /bin/bash worker

# Set working directory
WORKDIR /app

# Copy application code
COPY . .

# Create directories for processing and recordings
RUN mkdir -p /app/temp /app/logs /app/recordings /app/traces

# Set ownership
RUN chown -R worker:worker /app

# Switch to non-root user
USER worker

# Environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD python -c "print('Validate worker healthy')" || exit 1

# Default command
CMD ["python", "worker.py"]
