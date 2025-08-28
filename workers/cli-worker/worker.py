import asyncio
import json
import logging
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, List, Optional
import psycopg2
import psycopg2.extras
from psycopg2.extras import RealDictCursor
import nats
import redis.asyncio as redis
import docker
import yaml
from jinja2 import Environment, FileSystemLoader
from config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CLIWorker:
    def __init__(self):
        self.db_conn = None
        self.nats_client = None
        self.redis_client = None
        self.docker_client = None
        
    async def connect(self):
        """Connect to all services"""
        # Database
        self.db_conn = psycopg2.connect(settings.DATABASE_URL)
        
        # NATS
        self.nats_client = await nats.connect(settings.NATS_URL)
        
        # Redis
        self.redis_client = redis.from_url(settings.REDIS_URL)
        
        # Docker
        try:
            self.docker_client = docker.from_env()
        except:
            logger.warning("Docker client not available")
        
        logger.info("CLI worker connected to all services")
    
    async def disconnect(self):
        """Disconnect from all services"""
        if self.db_conn:
            self.db_conn.close()
        if self.nats_client:
            await self.nats_client.close()
        if self.redis_client:
            await self.redis_client.close()
    
    def detect_ecosystem(self, repo_path: str) -> str:
        """Detect the programming ecosystem (JVM, Go, etc.)"""
        try:
            # Check for Java/Maven
            if os.path.exists(os.path.join(repo_path, "pom.xml")):
                return "jvm-maven"
            if os.path.exists(os.path.join(repo_path, "build.gradle")):
                return "jvm-gradle"
            
            # Check for Go
            if os.path.exists(os.path.join(repo_path, "go.mod")):
                return "go"
            
            # Check for .NET
            if os.path.exists(os.path.join(repo_path, "*.csproj")):
                return "dotnet"
            
            # Check for Python
            if os.path.exists(os.path.join(repo_path, "requirements.txt")):
                return "python"
            
            return "unknown"
        except Exception as e:
            logger.error(f"Error detecting ecosystem: {e}")
            return "unknown"
    
    async def create_jvm_reproduction(self, repro_id: str, test_code: str, ecosystem: str) -> Dict:
        """Create JVM-based reproduction"""
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)
                
                if ecosystem == "jvm-maven":
                    return await self._create_maven_reproduction(temp_path, repro_id, test_code)
                elif ecosystem == "jvm-gradle":
                    return await self._create_gradle_reproduction(temp_path, repro_id, test_code)
                else:
                    raise ValueError(f"Unsupported JVM ecosystem: {ecosystem}")
                    
        except Exception as e:
            logger.error(f"Error creating JVM reproduction: {e}")
            raise
    
    async def _create_maven_reproduction(self, temp_path: Path, repro_id: str, test_code: str) -> Dict:
        """Create Maven-based reproduction"""
        # Create pom.xml
        pom_content = self._generate_maven_pom()
        with open(temp_path / "pom.xml", "w") as f:
            f.write(pom_content)
        
        # Create test directory
        test_dir = temp_path / "src" / "test" / "java" / "com" / "bugrepro"
        test_dir.mkdir(parents=True, exist_ok=True)
        
        # Create test file
        test_file = test_dir / f"Reproduction{repro_id}.java"
        with open(test_file, "w") as f:
            f.write(test_code)
        
        # Create Dockerfile
        dockerfile_content = self._generate_jvm_dockerfile("maven")
        with open(temp_path / "Dockerfile", "w") as f:
            f.write(dockerfile_content)
        
        # Create docker-compose.yml
        compose_content = self._generate_jvm_compose("maven", repro_id)
        with open(temp_path / "docker-compose.yml", "w") as f:
            f.write(compose_content)
        
        return {
            "type": "jvm-maven",
            "test_file": str(test_file),
            "build_command": "mvn test",
            "dockerfile": str(temp_path / "Dockerfile"),
            "compose_file": str(temp_path / "docker-compose.yml")
        }
    
    async def _create_gradle_reproduction(self, temp_path: Path, repro_id: str, test_code: str) -> Dict:
        """Create Gradle-based reproduction"""
        # Create build.gradle
        gradle_content = self._generate_gradle_build()
        with open(temp_path / "build.gradle", "w") as f:
            f.write(gradle_content)
        
        # Create test directory
        test_dir = temp_path / "src" / "test" / "java" / "com" / "bugrepro"
        test_dir.mkdir(parents=True, exist_ok=True)
        
        # Create test file
        test_file = test_dir / f"Reproduction{repro_id}.java"
        with open(test_file, "w") as f:
            f.write(test_code)
        
        # Create Dockerfile
        dockerfile_content = self._generate_jvm_dockerfile("gradle")
        with open(temp_path / "Dockerfile", "w") as f:
            f.write(dockerfile_content)
        
        # Create docker-compose.yml
        compose_content = self._generate_jvm_compose("gradle", repro_id)
        with open(temp_path / "docker-compose.yml", "w") as f:
            f.write(compose_content)
        
        return {
            "type": "jvm-gradle",
            "test_file": str(test_file),
            "build_command": "./gradlew test",
            "dockerfile": str(temp_path / "Dockerfile"),
            "compose_file": str(temp_path / "docker-compose.yml")
        }
    
    async def create_go_reproduction(self, repro_id: str, test_code: str) -> Dict:
        """Create Go-based reproduction"""
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)
                
                # Create go.mod
                go_mod_content = self._generate_go_mod()
                with open(temp_path / "go.mod", "w") as f:
                    f.write(go_mod_content)
                
                # Create test file
                test_file = temp_path / f"reproduction_{repro_id}_test.go"
                with open(test_file, "w") as f:
                    f.write(test_code)
                
                # Create Dockerfile
                dockerfile_content = self._generate_go_dockerfile()
                with open(temp_path / "Dockerfile", "w") as f:
                    f.write(dockerfile_content)
                
                # Create docker-compose.yml
                compose_content = self._generate_go_compose(repro_id)
                with open(temp_path / "docker-compose.yml", "w") as f:
                    f.write(compose_content)
                
                return {
                    "type": "go",
                    "test_file": str(test_file),
                    "build_command": "go test -v",
                    "dockerfile": str(temp_path / "Dockerfile"),
                    "compose_file": str(temp_path / "docker-compose.yml")
                }
                
        except Exception as e:
            logger.error(f"Error creating Go reproduction: {e}")
            raise
    
    def _generate_maven_pom(self) -> str:
        """Generate Maven pom.xml"""
        return """<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    
    <groupId>com.bugrepro</groupId>
    <artifactId>bug-reproduction</artifactId>
    <version>1.0.0</version>
    
    <properties>
        <maven.compiler.source>11</maven.compiler.source>
        <maven.compiler.target>11</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>
    
    <dependencies>
        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter</artifactId>
            <version>5.9.2</version>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.seleniumhq.selenium</groupId>
            <artifactId>selenium-java</artifactId>
            <version>4.8.1</version>
            <scope>test</scope>
        </dependency>
    </dependencies>
    
    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-surefire-plugin</artifactId>
                <version>3.0.0</version>
            </plugin>
        </plugins>
    </build>
</project>"""
    
    def _generate_gradle_build(self) -> str:
        """Generate Gradle build.gradle"""
        return """plugins {
    id 'java'
    id 'application'
}

group = 'com.bugrepro'
version = '1.0.0'

repositories {
    mavenCentral()
}

dependencies {
    testImplementation 'org.junit.jupiter:junit-jupiter:5.9.2'
    testImplementation 'org.seleniumhq.selenium:selenium-java:4.8.1'
}

test {
    useJUnitPlatform()
}

java {
    sourceCompatibility = JavaVersion.VERSION_11
    targetCompatibility = JavaVersion.VERSION_11
}"""
    
    def _generate_go_mod(self) -> str:
        """Generate Go go.mod"""
        return """module bug-reproduction

go 1.21

require (
    github.com/stretchr/testify v1.8.4
    github.com/tebeka/selenium v0.9.9
)"""
    
    def _generate_jvm_dockerfile(self, build_tool: str) -> str:
        """Generate JVM Dockerfile"""
        if build_tool == "maven":
            return """FROM openjdk:11-jdk-slim

WORKDIR /app

# Install Maven
RUN apt-get update && apt-get install -y maven

# Copy pom.xml and download dependencies
COPY pom.xml .
RUN mvn dependency:go-offline

# Copy source code
COPY src ./src

# Run tests
CMD ["mvn", "test"]"""
        else:  # gradle
            return """FROM openjdk:11-jdk-slim

WORKDIR /app

# Install Gradle
RUN apt-get update && apt-get install -y gradle

# Copy build files
COPY build.gradle .
COPY gradle ./gradle
COPY gradlew .

# Download dependencies
RUN ./gradlew dependencies

# Copy source code
COPY src ./src

# Run tests
CMD ["./gradlew", "test"]"""
    
    def _generate_go_dockerfile(self) -> str:
        """Generate Go Dockerfile"""
        return """FROM golang:1.21-alpine

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Run tests
CMD ["go", "test", "-v"]"""
    
    def _generate_jvm_compose(self, build_tool: str, repro_id: str) -> str:
        """Generate JVM docker-compose.yml"""
        return f"""version: '3.8'

services:
  jvm-repro-{repro_id}:
    build: .
    environment:
      - JAVA_OPTS=-Xmx2g
    volumes:
      - ./test-results:/app/test-results
    depends_on:
      - selenium-hub
      
  selenium-hub:
    image: selenium/hub:4.8.1
    ports:
      - "4444:4444"
      
  chrome:
    image: selenium/node-chrome:4.8.1
    environment:
      - SE_NODE_MAX_SESSIONS=4
      - SE_NODE_OVERRIDE_MAX_SESSIONS=true
    depends_on:
      - selenium-hub
    shm_size: 2gb"""
    
    def _generate_go_compose(self, repro_id: str) -> str:
        """Generate Go docker-compose.yml"""
        return f"""version: '3.8'

services:
  go-repro-{repro_id}:
    build: .
    environment:
      - CGO_ENABLED=0
    volumes:
      - ./test-results:/app/test-results"""
    
    async def handle_cli_request(self, msg):
        """Handle CLI reproduction request from NATS"""
        try:
            data = json.loads(msg.data.decode())
            repro_id = data["repro_id"]
            test_code = data["test_code"]
            ecosystem = data.get("ecosystem", "auto")
            
            logger.info(f"Processing CLI reproduction request for {ecosystem}")
            
            # Detect ecosystem if auto
            if ecosystem == "auto":
                ecosystem = self.detect_ecosystem(data.get("repo_path", ""))
            
            result = {}
            
            if ecosystem.startswith("jvm"):
                result = await self.create_jvm_reproduction(repro_id, test_code, ecosystem)
            elif ecosystem == "go":
                result = await self.create_go_reproduction(repro_id, test_code)
            else:
                raise ValueError(f"Unsupported ecosystem: {ecosystem}")
            
            # Store CLI reproduction record
            with self.db_conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    INSERT INTO cli_repros (repro_id, ecosystem, test_file, build_command, 
                                          dockerfile, compose_file, status)
                    VALUES (%s, %s, %s, %s, %s, %s, 'created')
                    RETURNING id
                """, (
                    repro_id,
                    ecosystem,
                    result["test_file"],
                    result["build_command"],
                    result["dockerfile"],
                    result["compose_file"]
                ))
                
                cli_repro_id = cur.fetchone()["id"]
                self.db_conn.commit()
            
            # Publish completion event
            await self.nats_client.publish("cli.completed", json.dumps({
                "cli_repro_id": cli_repro_id,
                "repro_id": repro_id,
                "ecosystem": ecosystem,
                "result": result
            }).encode())
            
            # Acknowledge message
            await msg.ack()
            
        except Exception as e:
            logger.error(f"Error handling CLI request: {e}")
            await msg.nak()
    
    async def run(self):
        """Main worker loop"""
        await self.connect()
        
        try:
            # Subscribe to CLI requests
            await self.nats_client.subscribe("cli.request", cb=self.handle_cli_request)
            
            logger.info("CLI worker started, listening for CLI requests")
            
            # Keep running
            while True:
                await asyncio.sleep(1)
                
        except KeyboardInterrupt:
            logger.info("Shutting down CLI worker")
        finally:
            await self.disconnect()

if __name__ == "__main__":
    worker = CLIWorker()
    asyncio.run(worker.run())
