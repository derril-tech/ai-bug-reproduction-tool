import asyncio
import json
import logging
import os
import tarfile
import tempfile
from pathlib import Path
from typing import Dict, List, Optional
import psycopg2
import psycopg2.extras
from psycopg2.extras import RealDictCursor
import nats
import redis.asyncio as redis
import requests
from github import Github
import docker
from jinja2 import Environment, FileSystemLoader
import yaml
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet
from config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ExportWorker:
    def __init__(self):
        self.db_conn = None
        self.nats_client = None
        self.redis_client = None
        self.github_client = None
        self.docker_client = None
        
    async def connect(self):
        """Connect to all services"""
        # Database
        self.db_conn = psycopg2.connect(settings.DATABASE_URL)
        
        # NATS
        self.nats_client = await nats.connect(settings.NATS_URL)
        
        # Redis
        self.redis_client = redis.from_url(settings.REDIS_URL)
        
        # GitHub
        if settings.GITHUB_TOKEN:
            self.github_client = Github(settings.GITHUB_TOKEN)
        
        # Docker
        try:
            self.docker_client = docker.from_env()
        except:
            logger.warning("Docker client not available")
        
        logger.info("Export worker connected to all services")
    
    async def disconnect(self):
        """Disconnect from all services"""
        if self.db_conn:
            self.db_conn.close()
        if self.nats_client:
            await self.nats_client.close()
        if self.redis_client:
            await self.redis_client.close()
    
    async def create_pull_request(self, repro_id: str, repo_url: str, branch_name: str) -> Dict:
        """Create a pull request with the reproduction"""
        try:
            # Get reproduction data
            repro_data = await self._get_reproduction_data(repro_id)
            
            # Parse repo URL
            repo_parts = repo_url.replace("https://github.com/", "").split("/")
            owner, repo_name = repo_parts[0], repo_parts[1]
            
            # Get GitHub repo
            repo = self.github_client.get_repo(f"{owner}/{repo_name}")
            
            # Create branch
            main_branch = repo.default_branch
            main_sha = repo.get_branch(main_branch).commit.sha
            
            try:
                repo.create_git_ref(f"refs/heads/{branch_name}", main_sha)
            except:
                logger.info(f"Branch {branch_name} already exists")
            
            # Create test file
            test_content = self._generate_test_file(repro_data)
            test_path = f"tests/regressions/{repro_data['id']}.spec.js"
            
            # Create commit
            repo.create_file(
                test_path,
                f"Add regression test for {repro_data['title']}",
                test_content,
                branch=branch_name
            )
            
            # Create PR
            pr = repo.create_pull(
                title=f"🐛 Add regression test: {repro_data['title']}",
                body=self._generate_pr_body(repro_data),
                base=main_branch,
                head=branch_name
            )
            
            return {
                "pr_url": pr.html_url,
                "pr_number": pr.number,
                "branch_name": branch_name,
                "test_path": test_path
            }
            
        except Exception as e:
            logger.error(f"Error creating pull request: {e}")
            raise
    
    async def create_sandbox(self, repro_id: str, platform: str = "codesandbox") -> Dict:
        """Create a sandbox environment"""
        try:
            repro_data = await self._get_reproduction_data(repro_id)
            
            if platform == "codesandbox":
                return await self._create_codesandbox(repro_data)
            elif platform == "stackblitz":
                return await self._create_stackblitz(repro_data)
            else:
                raise ValueError(f"Unsupported platform: {platform}")
                
        except Exception as e:
            logger.error(f"Error creating sandbox: {e}")
            raise
    
    async def _create_codesandbox(self, repro_data: Dict) -> Dict:
        """Create CodeSandbox environment"""
        # Prepare files for CodeSandbox
        files = {
            "package.json": {
                "content": self._generate_package_json(repro_data)
            },
            "playwright.config.js": {
                "content": self._generate_playwright_config()
            },
            "tests/regression.spec.js": {
                "content": self._generate_test_file(repro_data)
            },
            "README.md": {
                "content": self._generate_readme(repro_data)
            }
        }
        
        # Add any additional files from reproduction
        if "fixtures" in repro_data:
            for fixture_name, fixture_content in repro_data["fixtures"].items():
                files[f"fixtures/{fixture_name}"] = {
                    "content": fixture_content
                }
        
        # Create CodeSandbox
        response = requests.post(
            f"{settings.CODESANDBOX_API_URL}/sandboxes/create",
            json={
                "files": files,
                "template": "node"
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            return {
                "sandbox_url": data["sandbox"]["url"],
                "sandbox_id": data["sandbox"]["id"],
                "platform": "codesandbox"
            }
        else:
            raise Exception(f"CodeSandbox API error: {response.text}")
    
    async def _create_stackblitz(self, repro_data: Dict) -> Dict:
        """Create StackBlitz environment"""
        # Similar to CodeSandbox but for StackBlitz
        files = {
            "package.json": self._generate_package_json(repro_data),
            "playwright.config.js": self._generate_playwright_config(),
            "tests/regression.spec.js": self._generate_test_file(repro_data),
            "README.md": self._generate_readme(repro_data)
        }
        
        response = requests.post(
            f"{settings.STACKBLITZ_API_URL}/projects/create",
            json={
                "files": files,
                "template": "node",
                "title": f"Bug Reproduction: {repro_data['title']}"
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            return {
                "sandbox_url": data["url"],
                "sandbox_id": data["id"],
                "platform": "stackblitz"
            }
        else:
            raise Exception(f"StackBlitz API error: {response.text}")
    
    async def create_docker_tarball(self, repro_id: str) -> str:
        """Create a Docker tarball for the reproduction"""
        try:
            repro_data = await self._get_reproduction_data(repro_id)
            
            # Create temporary directory
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)
                
                # Create reproduction files
                self._create_reproduction_files(repro_data, temp_path)
                
                # Create Dockerfile
                dockerfile_content = self._generate_dockerfile(repro_data)
                with open(temp_path / "Dockerfile", "w") as f:
                    f.write(dockerfile_content)
                
                # Create docker-compose.yml
                compose_content = self._generate_docker_compose(repro_data)
                with open(temp_path / "docker-compose.yml", "w") as f:
                    f.write(compose_content)
                
                # Create tarball
                tarball_path = f"/tmp/repro_{repro_id}.tar.gz"
                with tarfile.open(tarball_path, "w:gz") as tar:
                    tar.add(temp_path, arcname=".")
                
                return tarball_path
                
        except Exception as e:
            logger.error(f"Error creating Docker tarball: {e}")
            raise
    
    async def generate_report(self, repro_id: str, format: str = "pdf") -> str:
        """Generate a report for the reproduction"""
        try:
            repro_data = await self._get_reproduction_data(repro_id)
            
            if format == "pdf":
                return await self._generate_pdf_report(repro_data)
            elif format == "json":
                return await self._generate_json_report(repro_data)
            else:
                raise ValueError(f"Unsupported format: {format}")
                
        except Exception as e:
            logger.error(f"Error generating report: {e}")
            raise
    
    async def _generate_pdf_report(self, repro_data: Dict) -> str:
        """Generate PDF report"""
        report_path = f"/tmp/repro_{repro_data['id']}_report.pdf"
        
        doc = SimpleDocTemplate(report_path, pagesize=letter)
        styles = getSampleStyleSheet()
        story = []
        
        # Title
        title = Paragraph(f"Bug Reproduction Report: {repro_data['title']}", styles['Title'])
        story.append(title)
        story.append(Spacer(1, 12))
        
        # Summary
        summary = Paragraph(f"<b>Summary:</b> {repro_data.get('description', 'No description')}", styles['Normal'])
        story.append(summary)
        story.append(Spacer(1, 12))
        
        # Test details
        test_details = [
            ["Property", "Value"],
            ["Reproduction ID", repro_data['id']],
            ["Created", repro_data.get('created_at', 'Unknown')],
            ["Status", repro_data.get('status', 'Unknown')],
            ["Stability Score", str(repro_data.get('stability_score', 'N/A'))]
        ]
        
        test_table = Table(test_details)
        test_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), '#CCCCCC'),
            ('TEXTCOLOR', (0, 0), (-1, 0), '#000000'),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), '#F9F9F9'),
            ('GRID', (0, 0), (-1, -1), 1, '#000000')
        ]))
        
        story.append(test_table)
        story.append(Spacer(1, 12))
        
        # Test code
        if 'test_code' in repro_data:
            story.append(Paragraph("<b>Test Code:</b>", styles['Heading2']))
            test_code = Paragraph(f"<pre>{repro_data['test_code']}</pre>", styles['Code'])
            story.append(test_code)
        
        doc.build(story)
        return report_path
    
    async def _generate_json_report(self, repro_data: Dict) -> str:
        """Generate JSON report"""
        report_path = f"/tmp/repro_{repro_data['id']}_report.json"
        
        report = {
            "reproduction": repro_data,
            "export_info": {
                "exported_at": "2024-01-01T00:00:00Z",
                "format": "json",
                "version": "1.0"
            }
        }
        
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        
        return report_path
    
    async def _get_reproduction_data(self, repro_id: str) -> Dict:
        """Get reproduction data from database"""
        with self.db_conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT r.*, p.name as project_name, p.repo_url
                FROM repros r
                JOIN projects p ON r.project_id = p.id
                WHERE r.id = %s
            """, (repro_id,))
            
            repro = cur.fetchone()
            if not repro:
                raise ValueError(f"Reproduction {repro_id} not found")
            
            # Get steps
            cur.execute("SELECT * FROM steps WHERE repro_id = %s ORDER BY step_order", (repro_id,))
            steps = cur.fetchall()
            
            # Get runs
            cur.execute("SELECT * FROM runs WHERE repro_id = %s ORDER BY created_at DESC LIMIT 5", (repro_id,))
            runs = cur.fetchall()
            
            return {
                "id": repro["id"],
                "title": repro["title"],
                "description": repro["description"],
                "test_code": repro["test_code"],
                "status": repro["status"],
                "stability_score": repro["stability_score"],
                "created_at": repro["created_at"].isoformat(),
                "project_name": repro["project_name"],
                "repo_url": repro["repo_url"],
                "steps": [dict(step) for step in steps],
                "runs": [dict(run) for run in runs]
            }
    
    def _generate_test_file(self, repro_data: Dict) -> str:
        """Generate test file content"""
        return f"""
const {{ test, expect }} = require('@playwright/test');

test('Regression: {repro_data["title"]}', async {{ page }}) => {{
  // Bug reproduction test
  {repro_data.get('test_code', '// Test code not available')}
  
  // Assert the failure
  await expect(page.locator('body')).toContainText('expected text');
}});
"""
    
    def _generate_package_json(self, repro_data: Dict) -> str:
        """Generate package.json for sandbox"""
        return json.dumps({
            "name": f"bug-repro-{repro_data['id']}",
            "version": "1.0.0",
            "description": f"Bug reproduction: {repro_data['title']}",
            "scripts": {
                "test": "playwright test",
                "test:headed": "playwright test --headed"
            },
            "devDependencies": {
                "@playwright/test": "^1.40.0"
            }
        }, indent=2)
    
    def _generate_playwright_config(self) -> str:
        """Generate Playwright config"""
        return """
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    video: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' }
    }
  ]
});
"""
    
    def _generate_readme(self, repro_data: Dict) -> str:
        """Generate README for sandbox"""
        return f"""# Bug Reproduction: {repro_data['title']}

This is an automated reproduction of a bug report.

## Description
{repro_data.get('description', 'No description available')}

## Running the Test
```bash
npm install
npm test
```

## Expected Behavior
The test should fail, reproducing the reported bug.

## Reproduction ID
{repro_data['id']}
"""
    
    def _generate_pr_body(self, repro_data: Dict) -> str:
        """Generate PR body"""
        return f"""## Bug Reproduction

This PR adds a regression test for the bug: **{repro_data['title']}**

### Description
{repro_data.get('description', 'No description available')}

### Test Details
- **Reproduction ID**: {repro_data['id']}
- **Stability Score**: {repro_data.get('stability_score', 'N/A')}
- **Status**: {repro_data.get('status', 'Unknown')}

### What This PR Does
- Adds a failing test that reproduces the bug
- Includes necessary fixtures and setup
- Test is placed in `tests/regressions/` directory

### How to Verify
1. Run the test: `npm test tests/regressions/{repro_data['id']}.spec.js`
2. The test should fail, reproducing the reported issue
3. Once the bug is fixed, this test should pass

### Generated by AI Bug Reproduction Tool
This test was automatically generated from a bug report using AI analysis.
"""
    
    def _generate_dockerfile(self, repro_data: Dict) -> str:
        """Generate Dockerfile"""
        return f"""FROM mcr.microsoft.com/playwright:v1.40.0

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

CMD ["npm", "test", "tests/regressions/{repro_data['id']}.spec.js"]
"""
    
    def _generate_docker_compose(self, repro_data: Dict) -> str:
        """Generate docker-compose.yml"""
        return f"""version: '3.8'

services:
  bug-repro:
    build: .
    environment:
      - CI=true
    volumes:
      - ./test-results:/app/test-results
"""
    
    def _create_reproduction_files(self, repro_data: Dict, temp_path: Path):
        """Create reproduction files in temp directory"""
        # Create package.json
        with open(temp_path / "package.json", "w") as f:
            f.write(self._generate_package_json(repro_data))
        
        # Create Playwright config
        with open(temp_path / "playwright.config.js", "w") as f:
            f.write(self._generate_playwright_config())
        
        # Create test file
        tests_dir = temp_path / "tests" / "regressions"
        tests_dir.mkdir(parents=True, exist_ok=True)
        
        with open(tests_dir / f"{repro_data['id']}.spec.js", "w") as f:
            f.write(self._generate_test_file(repro_data))
        
        # Create README
        with open(temp_path / "README.md", "w") as f:
            f.write(self._generate_readme(repro_data))
    
    async def handle_export_request(self, msg):
        """Handle export request from NATS"""
        try:
            data = json.loads(msg.data.decode())
            repro_id = data["repro_id"]
            export_type = data["export_type"]
            options = data.get("options", {})
            
            logger.info(f"Processing export request for repro {repro_id}, type: {export_type}")
            
            result = {}
            
            if export_type == "pr":
                result = await self.create_pull_request(
                    repro_id, 
                    options.get("repo_url"), 
                    options.get("branch_name", f"bug-repro-{repro_id}")
                )
            elif export_type == "sandbox":
                result = await self.create_sandbox(
                    repro_id, 
                    options.get("platform", "codesandbox")
                )
            elif export_type == "docker":
                result = {"tarball_path": await self.create_docker_tarball(repro_id)}
            elif export_type == "report":
                result = {"report_path": await self.generate_report(
                    repro_id, 
                    options.get("format", "pdf")
                )}
            else:
                raise ValueError(f"Unsupported export type: {export_type}")
            
            # Store export record
            with self.db_conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    INSERT INTO exports (repro_id, export_type, result, status)
                    VALUES (%s, %s, %s, 'completed')
                    RETURNING id
                """, (repro_id, export_type, json.dumps(result)))
                
                export_id = cur.fetchone()["id"]
                self.db_conn.commit()
            
            # Publish completion event
            await self.nats_client.publish("export.completed", json.dumps({
                "export_id": export_id,
                "repro_id": repro_id,
                "export_type": export_type,
                "result": result
            }).encode())
            
            # Acknowledge message
            await msg.ack()
            
        except Exception as e:
            logger.error(f"Error handling export request: {e}")
            await msg.nak()
    
    async def run(self):
        """Main worker loop"""
        await self.connect()
        
        try:
            # Subscribe to export requests
            await self.nats_client.subscribe("export.request", cb=self.handle_export_request)
            
            logger.info("Export worker started, listening for export requests")
            
            # Keep running
            while True:
                await asyncio.sleep(1)
                
        except KeyboardInterrupt:
            logger.info("Shutting down export worker")
        finally:
            await self.disconnect()

if __name__ == "__main__":
    worker = ExportWorker()
    asyncio.run(worker.run())
