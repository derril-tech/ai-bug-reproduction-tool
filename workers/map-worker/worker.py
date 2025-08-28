import asyncio
import json
import logging
import os
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import psycopg2
import psycopg2.extras
from psycopg2.extras import RealDictCursor
import nats
import redis.asyncio as redis
from sentence_transformers import SentenceTransformer
import numpy as np
from git import Repo
import yaml
import markdown
from bs4 import BeautifulSoup
from config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MapWorker:
    def __init__(self):
        self.db_conn = None
        self.nats_client = None
        self.redis_client = None
        self.embedding_model = None
        
    async def connect(self):
        """Connect to all services"""
        # Database
        self.db_conn = psycopg2.connect(settings.DATABASE_URL)
        
        # NATS
        self.nats_client = await nats.connect(settings.NATS_URL)
        
        # Redis
        self.redis_client = redis.from_url(settings.REDIS_URL)
        
        # Embedding model
        self.embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL)
        
        logger.info("Map worker connected to all services")
    
    async def disconnect(self):
        """Disconnect from all services"""
        if self.db_conn:
            self.db_conn.close()
        if self.nats_client:
            await self.nats_client.close()
        if self.redis_client:
            await self.redis_client.close()
    
    def detect_framework(self, repo_path: str) -> Dict[str, float]:
        """Detect frameworks used in the repository"""
        scores = {framework: 0.0 for framework in settings.FRAMEWORK_PATTERNS.keys()}
        
        try:
            repo = Repo(repo_path)
            for file_path in repo.git.ls_files().split('\n'):
                if not file_path:
                    continue
                    
                full_path = os.path.join(repo_path, file_path)
                if not os.path.isfile(full_path):
                    continue
                
                # Check file name patterns
                for framework, patterns in settings.FRAMEWORK_PATTERNS.items():
                    for pattern in patterns:
                        if pattern in file_path.lower():
                            scores[framework] += 1.0
                
                # Check file content for patterns
                try:
                    with open(full_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        for framework, patterns in settings.FRAMEWORK_PATTERNS.items():
                            for pattern in patterns:
                                if pattern in content:
                                    scores[framework] += 0.5
                except:
                    continue
            
            # Normalize scores
            total = sum(scores.values())
            if total > 0:
                scores = {k: v / total for k, v in scores.items()}
                
        except Exception as e:
            logger.error(f"Error detecting frameworks: {e}")
            
        return scores
    
    def guess_module_path(self, query: str, repo_path: str) -> List[Tuple[str, float]]:
        """Guess relevant module paths based on query"""
        suggestions = []
        
        try:
            repo = Repo(repo_path)
            
            # Extract keywords from query
            keywords = re.findall(r'\b\w+\b', query.lower())
            
            for file_path in repo.git.ls_files().split('\n'):
                if not file_path:
                    continue
                
                # Calculate relevance score
                score = 0.0
                file_lower = file_path.lower()
                
                for keyword in keywords:
                    if keyword in file_lower:
                        score += 1.0
                
                # Boost test files
                if 'test' in file_lower or 'spec' in file_lower:
                    score += 0.5
                
                # Boost config files
                if 'config' in file_lower or 'setup' in file_lower:
                    score += 0.3
                
                if score > 0:
                    suggestions.append((file_path, score))
            
            # Sort by score and return top 10
            suggestions.sort(key=lambda x: x[1], reverse=True)
            return suggestions[:10]
            
        except Exception as e:
            logger.error(f"Error guessing module paths: {e}")
            return []
    
    async def index_repository(self, project_id: str, repo_path: str):
        """Index repository documents into pgvector"""
        try:
            repo = Repo(repo_path)
            
            # Get all files
            files = []
            for file_path in repo.git.ls_files().split('\n'):
                if not file_path:
                    continue
                
                ext = Path(file_path).suffix.lower()
                if ext in settings.INDEXABLE_EXTENSIONS:
                    files.append(file_path)
            
            # Process files in chunks
            for i in range(0, len(files), 10):
                chunk = files[i:i+10]
                await self._process_file_chunk(project_id, repo_path, chunk)
                
        except Exception as e:
            logger.error(f"Error indexing repository: {e}")
    
    async def _process_file_chunk(self, project_id: str, repo_path: str, files: List[str]):
        """Process a chunk of files for indexing"""
        for file_path in files:
            try:
                full_path = os.path.join(repo_path, file_path)
                if not os.path.isfile(full_path):
                    continue
                
                with open(full_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Split content into chunks
                chunks = self._split_content(content)
                
                # Generate embeddings and store
                for chunk_text in chunks:
                    embedding = self.embedding_model.encode(chunk_text)
                    
                    with self.db_conn.cursor(cursor_factory=RealDictCursor) as cur:
                        cur.execute("""
                            INSERT INTO doc_chunks (project_id, file_path, chunk_text, embedding, meta)
                            VALUES (%s, %s, %s, %s, %s)
                        """, (
                            project_id,
                            file_path,
                            chunk_text,
                            embedding.tolist(),
                            json.dumps({"file_size": len(content)})
                        ))
                
                self.db_conn.commit()
                
            except Exception as e:
                logger.error(f"Error processing file {file_path}: {e}")
    
    def _split_content(self, content: str) -> List[str]:
        """Split content into overlapping chunks"""
        chunks = []
        start = 0
        
        while start < len(content):
            end = start + settings.CHUNK_SIZE
            chunk = content[start:end]
            
            # Try to break at sentence boundaries
            if end < len(content):
                last_period = chunk.rfind('.')
                last_newline = chunk.rfind('\n')
                break_point = max(last_period, last_newline)
                
                if break_point > start + settings.CHUNK_SIZE * 0.7:
                    chunk = content[start:start + break_point + 1]
                    end = start + break_point + 1
            
            chunks.append(chunk.strip())
            start = end - settings.CHUNK_OVERLAP
            
            if start >= len(content):
                break
        
        return chunks
    
    async def search_documents(self, project_id: str, query: str, limit: int = 5) -> List[Dict]:
        """Search documents using vector similarity with pgvector"""
        try:
            query_embedding = self.embedding_model.encode(query)
            
            with self.db_conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Use pgvector cosine similarity
                cur.execute("""
                    SELECT file_path, chunk_text, meta,
                           1 - (embedding <=> %s) as similarity
                    FROM doc_chunks 
                    WHERE project_id = %s
                    ORDER BY embedding <=> %s
                    LIMIT %s
                """, (query_embedding.tolist(), project_id, query_embedding.tolist(), limit))
                
                results = []
                for row in cur.fetchall():
                    results.append({
                        "file_path": row["file_path"],
                        "chunk_text": row["chunk_text"],
                        "meta": row["meta"],
                        "similarity": float(row["similarity"])
                    })
                
                return results
                
        except Exception as e:
            logger.error(f"Error searching documents: {e}")
            return []
    
    async def handle_mapping_request(self, msg):
        """Handle mapping request from NATS"""
        try:
            data = json.loads(msg.data.decode())
            mapping_id = data["mapping_id"]
            project_id = data["project_id"]
            report_id = data["report_id"]
            query = data.get("query", "")
            repo_path = data.get("repo_path", "")
            
            logger.info(f"Processing mapping request for project {project_id}")
            
            # Detect frameworks
            framework_scores = self.detect_framework(repo_path) if repo_path else {}
            
            # Guess module paths
            module_suggestions = self.guess_module_path(query, repo_path) if repo_path else []
            
            # Search documents
            doc_results = await self.search_documents(project_id, query)
            
            # Update mapping results in database
            with self.db_conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    UPDATE mappings 
                    SET framework_scores = %s, module_suggestions = %s, 
                        doc_results = %s, confidence_score = %s
                    WHERE id = %s
                """, (
                    json.dumps(framework_scores),
                    json.dumps(module_suggestions),
                    json.dumps(doc_results),
                    self._calculate_confidence(framework_scores, doc_results),
                    mapping_id
                ))
                
                self.db_conn.commit()
            
            # Publish completion event
            await self.nats_client.publish("mapping.completed", json.dumps({
                "mapping_id": mapping_id,
                "report_id": report_id,
                "framework_scores": framework_scores,
                "module_suggestions": module_suggestions,
                "doc_results": doc_results
            }).encode())
            
            # Acknowledge message
            await msg.ack()
            
        except Exception as e:
            logger.error(f"Error handling mapping request: {e}")
            await msg.nak()
    
    def _calculate_confidence(self, framework_scores: Dict, doc_results: List) -> float:
        """Calculate confidence score for mapping results"""
        confidence = 0.0
        
        # Framework detection confidence
        if framework_scores:
            max_framework_score = max(framework_scores.values())
            confidence += max_framework_score * 0.4
        
        # Document search confidence
        if doc_results:
            avg_similarity = sum(r["similarity"] for r in doc_results) / len(doc_results)
            confidence += avg_similarity * 0.6
        
        return min(confidence, 1.0)
    
    async def run(self):
        """Main worker loop"""
        await self.connect()
        
        try:
            # Subscribe to mapping requests
            await self.nats_client.subscribe("mapping.request", cb=self.handle_mapping_request)
            
            logger.info("Map worker started, listening for mapping requests")
            
            # Keep running
            while True:
                await asyncio.sleep(1)
                
        except KeyboardInterrupt:
            logger.info("Shutting down map worker")
        finally:
            await self.disconnect()

if __name__ == "__main__":
    worker = MapWorker()
    asyncio.run(worker.run())
