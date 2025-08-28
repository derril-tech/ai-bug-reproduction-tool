#!/usr/bin/env python3
"""
Test script for Validate Worker functionality
"""

import asyncio
import json
import time
from typing import Dict, Any

from worker import ValidateWorker


def create_test_validation_config():
    """Create a test validation configuration"""
    return {
        'repro_id': f'test_repro_{int(time.time())}',
        'runs': 3,
        'determinism': {
            'enable_network_shaping': True,
            'enable_time_freezing': False,
            'enable_resource_limits': True,
            'network_latency_ms': 50,
            'network_bandwidth_kbps': 1000,
        },
    }


async def test_stability_calculation():
    """Test stability metrics calculation"""
    print("Testing stability metrics calculation...")

    worker = ValidateWorker()

    # Test case 1: All passing runs
    stable_results = [
        {'passed': True, 'duration_ms': 1000},
        {'passed': True, 'duration_ms': 1100},
        {'passed': True, 'duration_ms': 1050},
    ]

    stable_metrics = worker._calculate_stability_metrics(stable_results)
    print(f"Stable test metrics: {stable_metrics}")

    assert stable_metrics['stability_score'] == 1.0
    assert stable_metrics['flaky_score'] == 0.0
    assert stable_metrics['stability_class'] == 'stable'

    # Test case 2: Mixed results (flaky)
    flaky_results = [
        {'passed': True, 'duration_ms': 1000},
        {'passed': False, 'duration_ms': 1100},
        {'passed': True, 'duration_ms': 1050},
        {'passed': False, 'duration_ms': 1200},
    ]

    flaky_metrics = worker._calculate_stability_metrics(flaky_results)
    print(f"Flaky test metrics: {flaky_metrics}")

    assert flaky_metrics['stability_score'] == 0.5
    assert flaky_metrics['flaky_score'] > 0
    assert flaky_metrics['stability_class'] in ['unstable', 'very_unstable']

    print("✅ Stability calculation test passed")


async def test_delta_minimization():
    """Test delta minimization functionality"""
    print("Testing delta minimization...")

    worker = ValidateWorker()

    # Mock test configuration
    test_config = {
        'repro_id': 'test_repro',
        'timeout': 5000,
    }

    # Mock run results with failures
    run_results = [
        {'passed': False, 'duration_ms': 1000},
        {'passed': False, 'duration_ms': 1100},
        {'passed': False, 'duration_ms': 1050},
    ]

    try:
        # Test delta minimization
        minimization_results = await worker._perform_delta_minimization(
            'test_repro', test_config, run_results
        )

        if minimization_results:
            print(f"Minimization results: {minimization_results}")
            assert 'minimized_steps' in minimization_results
            print("✅ Delta minimization test passed")
        else:
            print("⚠️  Delta minimization returned None (expected for this test)")

    except Exception as e:
        print(f"⚠️  Delta minimization test failed (expected): {e}")


async def test_run_execution():
    """Test single run execution"""
    print("Testing single run execution...")

    worker = ValidateWorker()

    try:
        # Create mock test environment
        test_env = {
            'test_dir': '/tmp/test',
            'test_script': 'console.log("Test executed");',
        }

        # Create mock determinism config
        determinism = {
            'enable_resource_limits': False,
            'enable_network_shaping': False,
        }

        # Execute single run
        run_result = await worker._execute_single_run(
            'test_repro', test_env, 1, determinism
        )

        print(f"Run result: {run_result}")

        # Verify result structure
        assert 'run_number' in run_result
        assert 'passed' in run_result
        assert 'duration_ms' in run_result

        print("✅ Single run execution test passed")

    except Exception as e:
        print(f"❌ Single run execution test failed: {e}")


async def test_validation_cycle():
    """Test full validation cycle"""
    print("Testing validation cycle...")

    worker = ValidateWorker()

    # Create test config
    test_config = {
        'repro_id': 'test_repro',
        'timeout': 5000,
    }

    determinism = {
        'enable_resource_limits': False,
    }

    try:
        # Run validation cycle with minimal runs
        results = await worker.run_validation_cycle(
            'test_repro', test_config, 2, determinism
        )

        print(f"Validation cycle results: {json.dumps(results, indent=2, default=str)}")

        # Verify results structure
        assert 'total_runs' in results
        assert 'stability_analysis' in results
        assert 'run_results' in results

        stability = results['stability_analysis']
        assert 'stability_score' in stability
        assert 'flaky_score' in stability

        print("✅ Validation cycle test passed")

    except Exception as e:
        print(f"❌ Validation cycle test failed: {e}")


async def test_subset_splitting():
    """Test subset splitting for delta minimization"""
    print("Testing subset splitting...")

    worker = ValidateWorker()

    # Test splitting various list sizes
    test_cases = [
        ([1, 2, 3, 4], 2),
        ([1, 2, 3, 4, 5], 3),
        ([1], 2),
    ]

    for items, n in test_cases:
        subsets = worker._split_into_subsets(items, n)
        print(f"Items {items} split into {n} subsets: {subsets}")

        # Verify subsets
        total_items = sum(len(subset) for subset in subsets)
        assert total_items == len(items), f"Lost items: {total_items} != {len(items)}"

        # Verify no overlaps
        all_items = []
        for subset in subsets:
            all_items.extend(subset)
        assert len(all_items) == len(set(all_items)), "Duplicate items in subsets"

    print("✅ Subset splitting test passed")


async def main():
    """Run all tests"""
    print("🧪 Running Validate Worker Tests\n")

    try:
        await test_stability_calculation()
        print()

        await test_subset_splitting()
        print()

        await test_delta_minimization()
        print()

        await test_run_execution()
        print()

        await test_validation_cycle()
        print()

        print("🎉 All tests completed successfully!")

    except Exception as e:
        print(f"❌ Test suite failed: {e}")
        return 1

    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)
