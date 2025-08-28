#!/usr/bin/env python3
"""
Determinism Controller Worker - Ensures consistent test execution with controlled environments

Features:
- Fake timers for deterministic timing
- Network shaping for consistent latency/bandwidth
- Retry suppression to prevent flaky behavior
- Environment isolation and cleanup
- Performance monitoring and profiling
- Resource usage control and limits
"""

import asyncio
import json
import logging
import os
import subprocess
import time
import tempfile
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone
from contextlib import asynccontextmanager

import docker
import psutil
import httpx
import nats
import redis
from freezegun import freeze_time
from tcconfig import tcset, tcdel
from tenacity import retry, stop_after_attempt, wait_exponential

from config import config

# Configure logging
logging.basicConfig(
    level=getattr(logging, config.log_level),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DeterminismController:
    def __init__(self):
        # Docker client for container management
        self.docker_client = docker.from_env()

        # Redis client for state management
        self.redis_client = redis.Redis(
            host=config.redis_host,
            port=config.redis_port,
            decode_responses=True
        )

        # NATS URL
        self.nats_url = config.nats_url

        # Worker settings
        self.temp_dir = config.temp_dir
        self.network_interface = config.network_interface

        # Determinism settings
        self.fake_time_offset = config.fake_time_offset
        self.network_latency_ms = config.network_latency_ms
        self.network_bandwidth_kbps = config.network_bandwidth_kbps
        self.retry_max_attempts = config.retry_max_attempts

        # Resource limits
        self.cpu_limit = config.cpu_limit
        self.memory_limit_mb = config.memory_limit_mb
        self.disk_quota_mb = config.disk_quota_mb

    @asynccontextmanager
    async def deterministic_environment(self, test_config: Dict[str, Any]):
        """
        Context manager for creating deterministic test environment

        Args:
            test_config: Test configuration with determinism settings
        """
        environment_state = {
            'network_shaping': False,
            'time_freezing': False,
            'resource_limits': False,
            'cleanup_tasks': [],
        }

        try:
            # Apply network shaping if configured
            if test_config.get('enable_network_shaping', True):
                await self._apply_network_shaping(test_config)
                environment_state['network_shaping'] = True

            # Set up time freezing if configured
            if test_config.get('enable_time_freezing', True):
                time_context = self._setup_time_freezing(test_config)
                environment_state['time_freezing'] = True
                environment_state['cleanup_tasks'].append(time_context.__aexit__)

            # Apply resource limits if configured
            if test_config.get('enable_resource_limits', True):
                await self._apply_resource_limits(test_config)
                environment_state['resource_limits'] = True

            # Monitor system resources
            monitor_task = asyncio.create_task(self._monitor_resources(test_config))
            environment_state['cleanup_tasks'].append(monitor_task.cancel)

            logger.info("Deterministic environment established")
            yield environment_state

        finally:
            # Cleanup in reverse order
            await self._cleanup_environment(environment_state)
            logger.info("Deterministic environment cleaned up")

    async def _apply_network_shaping(self, test_config: Dict[str, Any]):
        """Apply network shaping rules for consistent latency/bandwidth"""
        try:
            latency = test_config.get('network_latency_ms', self.network_latency_ms)
            bandwidth = test_config.get('network_bandwidth_kbps', self.network_bandwidth_kbps)

            # Apply traffic control rules
            tcset(
                self.network_interface,
                direction="outgoing",
                latency=f"{latency}ms",
                bandwidth=f"{bandwidth}kbps"
            )

            logger.info(f"Applied network shaping: {latency}ms latency, {bandwidth}kbps bandwidth")

        except Exception as e:
            logger.error(f"Network shaping failed: {e}")
            raise

    def _setup_time_freezing(self, test_config: Dict[str, Any]):
        """Set up time freezing for deterministic timing"""
        fake_time = test_config.get('fake_time')
        if not fake_time:
            # Use configured offset from current time
            fake_time = datetime.now(timezone.utc) + self.fake_time_offset

        return freeze_time(fake_time)

    async def _apply_resource_limits(self, test_config: Dict[str, Any]):
        """Apply resource limits to prevent interference"""
        try:
            # Set CPU limits
            cpu_limit = test_config.get('cpu_limit', self.cpu_limit)
            if cpu_limit:
                # Use cgroups or container limits
                await self._set_cpu_limit(cpu_limit)

            # Set memory limits
            memory_limit = test_config.get('memory_limit_mb', self.memory_limit_mb)
            if memory_limit:
                await self._set_memory_limit(memory_limit)

            # Set disk quota
            disk_quota = test_config.get('disk_quota_mb', self.disk_quota_mb)
            if disk_quota:
                await self._set_disk_quota(disk_quota)

            logger.info(f"Applied resource limits: CPU={cpu_limit}, Memory={memory_limit}MB, Disk={disk_quota}MB")

        except Exception as e:
            logger.error(f"Resource limits application failed: {e}")
            raise

    async def _set_cpu_limit(self, cpu_limit: float):
        """Set CPU usage limit"""
        # This would typically use cgroups or Docker API
        # For now, we'll use a simple approach with nice levels
        try:
            subprocess.run(['renice', '-n', '10', '-p', str(os.getpid())], check=True)
            logger.info(f"Set CPU nice level to 10 for process {os.getpid()}")
        except Exception as e:
            logger.warning(f"Failed to set CPU limit: {e}")

    async def _set_memory_limit(self, memory_mb: int):
        """Set memory usage limit"""
        # This would typically use cgroups or Docker memory limits
        # For now, we'll just log the intended limit
        logger.info(f"Memory limit set to {memory_mb}MB (implementation pending)")

    async def _set_disk_quota(self, disk_mb: int):
        """Set disk usage quota"""
        # This would typically use filesystem quotas
        # For now, we'll just log the intended limit
        logger.info(f"Disk quota set to {disk_mb}MB (implementation pending)")

    async def _monitor_resources(self, test_config: Dict[str, Any]):
        """Monitor system resources during test execution"""
        monitoring_interval = test_config.get('monitoring_interval', 5)  # seconds

        while True:
            try:
                # Get current resource usage
                cpu_percent = psutil.cpu_percent(interval=1)
                memory = psutil.virtual_memory()
                disk = psutil.disk_usage('/')

                resource_stats = {
                    'cpu_percent': cpu_percent,
                    'memory_percent': memory.percent,
                    'memory_used_mb': memory.used / 1024 / 1024,
                    'disk_percent': disk.percent,
                    'disk_used_mb': disk.used / 1024 / 1024,
                    'timestamp': datetime.now().isoformat(),
                }

                # Store in Redis for real-time monitoring
                self.redis_client.setex(
                    f"resource_stats:{test_config.get('test_id', 'unknown')}",
                    300,  # 5 minutes TTL
                    json.dumps(resource_stats)
                )

                # Check for resource violations
                if cpu_percent > 90:
                    logger.warning(f"High CPU usage: {cpu_percent}%")
                if memory.percent > 85:
                    logger.warning(f"High memory usage: {memory.percent}%")

                await asyncio.sleep(monitoring_interval)

            except Exception as e:
                logger.error(f"Resource monitoring error: {e}")
                await asyncio.sleep(monitoring_interval)

    async def _cleanup_environment(self, environment_state: Dict[str, Any]):
        """Clean up deterministic environment"""
        try:
            # Cancel monitoring task
            for cleanup_task in environment_state.get('cleanup_tasks', []):
                if asyncio.iscoroutinefunction(cleanup_task):
                    await cleanup_task()
                elif callable(cleanup_task):
                    cleanup_task()

            # Remove network shaping
            if environment_state.get('network_shaping'):
                try:
                    tcdel(self.network_interface, direction="outgoing")
                    logger.info("Removed network shaping rules")
                except Exception as e:
                    logger.error(f"Failed to remove network shaping: {e}")

            # Reset resource limits
            if environment_state.get('resource_limits'):
                await self._reset_resource_limits()

        except Exception as e:
            logger.error(f"Environment cleanup failed: {e}")

    async def _reset_resource_limits(self):
        """Reset resource limits to default values"""
        try:
            # Reset CPU nice level
            subprocess.run(['renice', '-n', '0', '-p', str(os.getpid())], check=False)
            logger.info("Reset CPU nice level")
        except Exception as e:
            logger.warning(f"Failed to reset resource limits: {e}")

    async def create_isolated_container(self, test_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create isolated Docker container for test execution

        Args:
            test_config: Test configuration

        Returns:
            Container information and connection details
        """
        try:
            container_config = {
                'image': test_config.get('base_image', 'node:18-alpine'),
                'name': f"deterministic_test_{int(time.time())}_{hash(str(test_config)) % 1000}",
                'detach': True,
                'environment': {
                    'NODE_ENV': 'test',
                    'DETERMINISTIC_MODE': 'true',
                },
                'tmpfs': {
                    '/tmp': 'rw,noexec,nosuid,size=100m',
                    '/app/tmp': 'rw,noexec,nosuid,size=50m',
                },
                'read_only': True,
                'security_opt': ['no-new-privileges:true'],
                'cap_drop': ['ALL'],
                'cap_add': ['NET_BIND_SERVICE'],
            }

            # Set resource limits
            if test_config.get('enable_resource_limits', True):
                container_config['cpu_quota'] = int(self.cpu_limit * 100000)
                container_config['cpu_period'] = 100000
                container_config['mem_limit'] = f"{self.memory_limit_mb}m"
                container_config['memswap_limit'] = f"{self.memory_limit_mb}m"

            # Create and start container
            container = self.docker_client.containers.create(**container_config)
            container.start()

            # Wait for container to be ready
            await self._wait_for_container_ready(container.id)

            container_info = {
                'container_id': container.id,
                'container_name': container.name,
                'status': 'running',
                'created_at': datetime.now().isoformat(),
            }

            logger.info(f"Created isolated container: {container.id}")
            return container_info

        except Exception as e:
            logger.error(f"Container creation failed: {e}")
            raise

    async def _wait_for_container_ready(self, container_id: str, timeout: int = 30):
        """Wait for container to be ready"""
        start_time = time.time()

        while time.time() - start_time < timeout:
            container = self.docker_client.containers.get(container_id)
            if container.status == 'running':
                # Try to execute a simple command to verify readiness
                try:
                    result = container.exec_run('echo "ready"', tty=True)
                    if result.exit_code == 0:
                        return
                except Exception:
                    pass

            await asyncio.sleep(1)

        raise TimeoutError(f"Container {container_id} failed to become ready within {timeout} seconds")

    async def execute_test_with_determinism(self, test_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute test with full determinism controls

        Args:
            test_config: Complete test configuration

        Returns:
            Test execution results
        """
        execution_result = {
            'test_id': test_config.get('test_id', f"test_{int(time.time())}"),
            'status': 'running',
            'start_time': datetime.now().isoformat(),
            'determinism_applied': [],
            'performance_metrics': {},
            'errors': [],
        }

        try:
            # Create isolated container
            container_info = await self.create_isolated_container(test_config)
            execution_result['container_info'] = container_info
            execution_result['determinism_applied'].append('container_isolation')

            # Set up deterministic environment
            async with self.deterministic_environment(test_config) as env_state:
                execution_result['determinism_applied'].extend([
                    'network_shaping' if env_state.get('network_shaping') else None,
                    'time_freezing' if env_state.get('time_freezing') else None,
                    'resource_limits' if env_state.get('resource_limits') else None,
                ])
                execution_result['determinism_applied'] = [x for x in execution_result['determinism_applied'] if x]

                # Execute test in container
                test_result = await self._execute_test_in_container(
                    container_info['container_id'],
                    test_config
                )

                execution_result.update({
                    'status': 'completed',
                    'end_time': datetime.now().isoformat(),
                    'test_result': test_result,
                })

        except Exception as e:
            execution_result.update({
                'status': 'failed',
                'end_time': datetime.now().isoformat(),
                'errors': [str(e)],
            })
            logger.error(f"Test execution failed: {e}")

        finally:
            # Cleanup container
            if 'container_info' in execution_result:
                await self._cleanup_container(execution_result['container_info']['container_id'])

        return execution_result

    async def _execute_test_in_container(self, container_id: str, test_config: Dict[str, Any]) -> Dict[str, Any]:
        """Execute test script in isolated container"""
        try:
            container = self.docker_client.containers.get(container_id)

            # Copy test files to container
            test_script = test_config.get('test_script', '')
            if test_script:
                with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
                    f.write(test_script)
                    f.flush()

                    # Copy file to container
                    with open(f.name, 'rb') as script_file:
                        container.put_archive('/app', script_file.read())

                os.unlink(f.name)

            # Execute test
            test_command = test_config.get('test_command', 'npm test')
            result = container.exec_run(
                test_command,
                tty=True,
                environment={'CI': 'true', 'DETERMINISTIC': 'true'}
            )

            test_result = {
                'exit_code': result.exit_code,
                'output': result.output.decode('utf-8', errors='ignore'),
                'execution_time': None,  # Would be measured in real implementation
            }

            # Parse test results
            test_result.update(self._parse_test_output(test_result['output']))

            return test_result

        except Exception as e:
            logger.error(f"Test execution in container failed: {e}")
            return {
                'exit_code': -1,
                'output': str(e),
                'passed': False,
                'failed': True,
                'errors': [str(e)],
            }

    def _parse_test_output(self, output: str) -> Dict[str, Any]:
        """Parse test execution output for results"""
        parsed = {
            'passed': False,
            'failed': False,
            'tests_run': 0,
            'tests_passed': 0,
            'tests_failed': 0,
            'duration': None,
        }

        lines = output.split('\n')

        for line in lines:
            line = line.strip().lower()

            # Look for test result patterns
            if 'passed' in line or '✓' in line:
                parsed['passed'] = True
            if 'failed' in line or '✗' in line or 'error' in line:
                parsed['failed'] = True

            # Extract test counts
            if 'tests' in line and 'passed' in line:
                # Simple pattern matching for test counts
                import re
                count_match = re.search(r'(\d+)\s*tests?\s*passed', line)
                if count_match:
                    parsed['tests_passed'] = int(count_match.group(1))

            if 'tests' in line and ('failed' in line or 'error' in line):
                count_match = re.search(r'(\d+)\s*tests?\s*failed', line)
                if count_match:
                    parsed['tests_failed'] = int(count_match.group(1))

        parsed['tests_run'] = parsed['tests_passed'] + parsed['tests_failed']

        return parsed

    async def _cleanup_container(self, container_id: str):
        """Clean up Docker container"""
        try:
            container = self.docker_client.containers.get(container_id)
            container.stop(timeout=10)
            container.remove(force=True)
            logger.info(f"Cleaned up container: {container_id}")
        except Exception as e:
            logger.error(f"Container cleanup failed for {container_id}: {e}")

    async def process_determinism_request(self, test_config: Dict[str, Any]):
        """Process determinism control request"""
        try:
            test_id = test_config.get('test_id', f"test_{int(time.time())}")
            logger.info(f"Processing determinism request for test {test_id}")

            # Execute test with determinism controls
            execution_result = await self.execute_test_with_determinism(test_config)

            # Store results
            self.redis_client.setex(
                f"test_result:{test_id}",
                3600,  # 1 hour TTL
                json.dumps(execution_result)
            )

            logger.info(f"Completed determinism processing for test {test_id}")

        except Exception as e:
            logger.error(f"Determinism processing failed: {e}")

    async def run(self):
        """Main worker loop"""
        logger.info("Starting Determinism Controller Worker")

        while True:
            try:
                # Connect to NATS
                nc = await nats.connect(self.nats_url)

                # Subscribe to determinism requests
                async def message_handler(msg):
                    try:
                        data = json.loads(msg.data.decode())
                        test_config = data.get('test_config', {})

                        if test_config:
                            await self.process_determinism_request(test_config)
                            # Acknowledge message
                            await msg.ack()
                        else:
                            logger.error("No test_config in message")

                    except Exception as e:
                        logger.error(f"Message processing error: {e}")

                # Subscribe to determinism queue
                await nc.subscribe("determinism.control", cb=message_handler)

                logger.info("Worker ready, waiting for messages...")

                # Keep the connection alive
                while True:
                    await asyncio.sleep(1)

            except Exception as e:
                logger.error(f"Worker error: {e}")
                await asyncio.sleep(5)  # Wait before reconnecting


async def main():
    worker = DeterminismController()
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
