# Determinism Controller Worker Dockerfile
FROM python:3.11-slim

# Install system dependencies for network control and monitoring
RUN apt-get update && apt-get install -y \
    iproute2 \
    iptables \
    net-tools \
    procps \
    curl \
    build-essential \
    docker.io \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create app user
RUN useradd -m -u 1001 -s /bin/bash worker

# Set working directory
WORKDIR /app

# Copy application code
COPY . .

# Create directories for processing
RUN mkdir -p /app/temp /app/logs /app/monitoring

# Set ownership
RUN chown -R worker:worker /app

# Add Docker socket access (for container management)
# Note: In production, this should be handled more securely
RUN usermod -aG docker worker

# Switch to non-root user
USER worker

# Environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD python -c "print('Determinism controller healthy')" || exit 1

# Default command
CMD ["python", "worker.py"]
