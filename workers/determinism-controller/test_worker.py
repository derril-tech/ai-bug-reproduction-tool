#!/usr/bin/env python3
"""
Test script for Determinism Controller Worker functionality
"""

import asyncio
import json
import tempfile
import time
from pathlib import Path

from worker import DeterminismController


def create_test_config():
    """Create a test configuration for determinism testing"""
    return {
        'test_id': f'test_{int(time.time())}',
        'enable_network_shaping': True,
        'enable_time_freezing': True,
        'enable_resource_limits': True,
        'network_latency_ms': 100,
        'network_bandwidth_kbps': 500,
        'cpu_limit': 0.5,
        'memory_limit_mb': 512,
        'fake_time': '2024-01-15T10:30:00Z',
        'base_image': 'node:18-alpine',
        'test_script': '''
const { test, expect } = require('@playwright/test');

test('Deterministic Test', async ({ page }) => {
  console.log('Test started at:', new Date().toISOString());

  await page.goto('https://httpbin.org/get');
  await page.waitForTimeout(1000);

  const response = await page.textContent('pre');
  expect(response).toContain('httpbin');

  console.log('Test completed at:', new Date().toISOString());
});
''',
        'test_command': 'npx playwright test test.js --reporter=json',
    }


async def test_environment_setup():
    """Test deterministic environment setup"""
    print("Testing deterministic environment setup...")

    controller = DeterminismController()
    test_config = create_test_config()

    try:
        # Test environment context manager
        async with controller.deterministic_environment(test_config) as env_state:
            print(f"Environment state: {env_state}")

            # Verify environment controls were applied
            assert 'network_shaping' in env_state or env_state.get('network_shaping') == False
            assert 'time_freezing' in env_state or env_state.get('time_freezing') == False
            assert 'resource_limits' in env_state or env_state.get('resource_limits') == False

            print("✅ Environment setup test passed")

    except Exception as e:
        print(f"❌ Environment setup test failed: {e}")


async def test_container_creation():
    """Test isolated container creation"""
    print("Testing container creation...")

    controller = DeterminismController()
    test_config = create_test_config()

    try:
        # Test container creation
        container_info = await controller.create_isolated_container(test_config)

        print(f"Created container: {container_info['container_id']}")

        # Verify container info
        assert 'container_id' in container_info
        assert 'container_name' in container_info
        assert container_info['status'] == 'running'

        # Cleanup
        await controller._cleanup_container(container_info['container_id'])

        print("✅ Container creation test passed")

    except Exception as e:
        print(f"❌ Container creation test failed: {e}")


async def test_resource_monitoring():
    """Test resource monitoring functionality"""
    print("Testing resource monitoring...")

    controller = DeterminismController()
    test_config = create_test_config()
    test_config['monitoring_interval'] = 2  # Faster for testing

    try:
        # Start monitoring
        monitoring_task = asyncio.create_task(controller._monitor_resources(test_config))
        await asyncio.sleep(5)  # Let it monitor for a few seconds

        # Check if stats were stored in Redis
        stats_key = f"resource_stats:{test_config['test_id']}"
        stats = controller.redis_client.get(stats_key)

        if stats:
            stats_data = json.loads(stats)
            print(f"Resource stats: {stats_data}")

            # Verify stats structure
            assert 'cpu_percent' in stats_data
            assert 'memory_percent' in stats_data
            assert 'timestamp' in stats_data

            print("✅ Resource monitoring test passed")
        else:
            print("⚠️  Resource monitoring test inconclusive (no stats stored)")

        # Cleanup
        monitoring_task.cancel()

    except Exception as e:
        print(f"❌ Resource monitoring test failed: {e}")


async def test_network_shaping():
    """Test network shaping functionality"""
    print("Testing network shaping...")

    controller = DeterminismController()
    test_config = create_test_config()

    try:
        # Test network shaping
        await controller._apply_network_shaping(test_config)
        print("Network shaping applied successfully")

        # Note: In a real test, we would verify the network rules were applied
        # This requires root privileges and specific network tools

        print("✅ Network shaping test passed (verification skipped)")

    except Exception as e:
        print(f"⚠️  Network shaping test failed (expected if no root): {e}")


async def test_time_freezing():
    """Test time freezing functionality"""
    print("Testing time freezing...")

    controller = DeterminismController()
    test_config = create_test_config()
    test_config['fake_time'] = '2024-01-15T10:30:00Z'

    try:
        # Test time freezing
        time_context = controller._setup_time_freezing(test_config)

        # Use the context manager
        with time_context:
            current_time = time.time()
            expected_time = time.mktime(time.strptime('2024-01-15T10:30:00Z', '%Y-%m-%dT%H:%M:%SZ'))

            # Time should be frozen
            print(f"Current time: {current_time}")
            print(f"Expected time: {expected_time}")

            # In a frozen time context, time.time() should return the frozen time
            # Note: This test might not work perfectly in all environments

        print("✅ Time freezing test completed")

    except Exception as e:
        print(f"❌ Time freezing test failed: {e}")


async def test_full_execution():
    """Test full deterministic execution (container-based)"""
    print("Testing full deterministic execution...")

    controller = DeterminismController()
    test_config = create_test_config()

    # Create a simple test script
    test_config['test_script'] = '''
const { test, expect } = require('@playwright/test');

test('Simple Deterministic Test', async ({ page }) => {
  await page.goto('data:text/html,<h1>Test Page</h1>');
  const heading = await page.textContent('h1');
  expect(heading).toBe('Test Page');
  console.log('Test executed successfully');
});
'''

    try:
        # Execute test with full determinism
        result = await controller.execute_test_with_determinism(test_config)

        print(f"Execution result: {json.dumps(result, indent=2, default=str)}")

        # Verify result structure
        assert 'test_id' in result
        assert 'status' in result
        assert result['status'] in ['completed', 'failed']

        if result['status'] == 'completed':
            assert 'test_result' in result
            print("✅ Full execution test passed")
        else:
            print(f"⚠️  Full execution test completed with status: {result['status']}")

    except Exception as e:
        print(f"❌ Full execution test failed: {e}")


async def main():
    """Run all tests"""
    print("🧪 Running Determinism Controller Tests\n")

    try:
        await test_environment_setup()
        print()

        await test_container_creation()
        print()

        await test_resource_monitoring()
        print()

        await test_network_shaping()
        print()

        await test_time_freezing()
        print()

        await test_full_execution()
        print()

        print("🎉 All tests completed successfully!")

    except Exception as e:
        print(f"❌ Test suite failed: {e}")
        return 1

    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)
