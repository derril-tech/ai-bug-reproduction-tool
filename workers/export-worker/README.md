# Export Worker

The Export Worker is responsible for creating various export formats from bug reproductions, including pull requests, sandbox environments, Docker tarballs, and reports.

## Features

- **GitHub PR Creation**: Automatically creates pull requests with regression tests
- **Sandbox Generation**: Creates CodeSandbox and StackBlitz environments
- **Docker Export**: Generates Docker tarballs with reproduction environments
- **Report Generation**: Creates PDF and JSON reports
- **Multi-format Support**: Supports various export formats and platforms

## Configuration

Set the following environment variables:

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/ai_bug_tool
NATS_URL=nats://localhost:4222
REDIS_URL=redis://localhost:6379
GITHUB_TOKEN=your_github_token
S3_BUCKET=ai-bug-tool-artifacts
S3_ACCESS_KEY=your_s3_key
S3_SECRET_KEY=your_s3_secret
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
docker build -t export-worker .

# Run the container
docker run -e DATABASE_URL=... -e NATS_URL=... export-worker
```

## API

The worker listens for NATS messages on the `export.request` topic:

```json
{
  "export_id": "uuid",
  "repro_id": "uuid",
  "export_type": "pr|sandbox|docker|report",
  "options": {
    "repo_url": "https://github.com/owner/repo",
    "branch_name": "bug-repro-123",
    "platform": "codesandbox",
    "format": "pdf"
  }
}
```

It publishes results to the `export.completed` topic:

```json
{
  "export_id": "uuid",
  "repro_id": "uuid",
  "export_type": "pr",
  "result": {
    "pr_url": "https://github.com/owner/repo/pull/123",
    "pr_number": 123,
    "branch_name": "bug-repro-123",
    "test_path": "tests/regressions/123.spec.js"
  }
}
```

## Export Types

### Pull Request Export
- Creates a new branch in the target repository
- Adds a regression test file
- Creates a pull request with detailed description
- Links back to the original bug report

### Sandbox Export
- **CodeSandbox**: Creates a Node.js environment with Playwright
- **StackBlitz**: Creates a similar environment in StackBlitz
- Includes all necessary dependencies and configuration
- Provides one-click reproduction environment

### Docker Export
- Creates a Dockerfile with Playwright setup
- Includes docker-compose.yml for easy deployment
- Packages all reproduction files in a tarball
- Ready for containerized execution

### Report Export
- **PDF**: Professional report with test details and metadata
- **JSON**: Machine-readable export with full reproduction data
- Includes stability scores and validation results
- Suitable for documentation and analysis

## Database Schema

The worker uses the `exports` table:

```sql
CREATE TABLE exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repro_id UUID REFERENCES repros(id) ON DELETE CASCADE,
    export_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    result JSONB,
    error_message TEXT,
    options JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```
