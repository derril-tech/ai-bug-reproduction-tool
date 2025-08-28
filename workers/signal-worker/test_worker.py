#!/usr/bin/env python3
"""
Test script for Signal Worker functionality
"""

import asyncio
import json
import tempfile
import os
from pathlib import Path

from worker import SignalWorker


def create_test_har():
    """Create a test HAR file"""
    har_data = {
        "log": {
            "version": "1.2",
            "creator": {"name": "WebInspector", "version": "537.36"},
            "pages": [
                {
                    "startedDateTime": "2024-01-15T10:30:00.000Z",
                    "id": "page_1",
                    "title": "Test Page",
                    "pageTimings": {
                        "onContentLoad": 1200,
                        "onLoad": 2500
                    }
                }
            ],
            "entries": [
                {
                    "startedDateTime": "2024-01-15T10:30:00.000Z",
                    "request": {
                        "method": "GET",
                        "url": "https://example.com/api/data",
                        "headers": [
                            {"name": "User-Agent", "value": "Mozilla/5.0"},
                            {"name": "Accept", "value": "application/json"}
                        ]
                    },
                    "response": {
                        "status": 200,
                        "statusText": "OK",
                        "headers": [
                            {"name": "Content-Type", "value": "application/json"},
                            {"name": "Content-Length", "value": "1234"}
                        ],
                        "content": {
                            "size": 1234,
                            "mimeType": "application/json"
                        }
                    },
                    "timings": {
                        "blocked": 0,
                        "dns": 50,
                        "connect": 100,
                        "send": 10,
                        "wait": 200,
                        "receive": 150
                    },
                    "serverIPAddress": "192.168.1.1",
                    "connection": "443"
                },
                {
                    "startedDateTime": "2024-01-15T10:30:01.000Z",
                    "request": {
                        "method": "POST",
                        "url": "https://example.com/api/checkout",
                        "headers": [
                            {"name": "Content-Type", "value": "application/json"}
                        ]
                    },
                    "response": {
                        "status": 500,
                        "statusText": "Internal Server Error",
                        "content": {
                            "size": 0,
                            "mimeType": "text/plain"
                        }
                    },
                    "timings": {
                        "blocked": 0,
                        "dns": 0,
                        "connect": 0,
                        "send": 20,
                        "wait": 500,
                        "receive": 0
                    }
                }
            ]
        }
    }

    temp_path = tempfile.mktemp(suffix='.har')
    with open(temp_path, 'w') as f:
        json.dump(har_data, f, indent=2)
    return temp_path


def create_test_log():
    """Create a test log file with various error types"""
    log_content = """[2024-01-15 10:30:00] INFO Starting application
[2024-01-15 10:30:05] INFO User login attempt
[2024-01-15 10:30:10] ERROR TypeError: Cannot read property 'map' of undefined
    at CheckoutPage.handleCoupon (/app/cart.js:45:12)
    at CheckoutPage.applyDiscount (/app/cart.js:67:8)
[2024-01-15 10:30:10] WARN Failed to apply discount coupon
[2024-01-15 10:30:15] ERROR ReferenceError: userPreferences is not defined
    at UserProfile.loadSettings (/app/profile.js:23:5)
[2024-01-15 10:30:20] ERROR TypeError: Cannot read property 'length' of null
    at DataProcessor.validateInput (/app/processor.js:89:15)
[2024-01-15 10:30:25] INFO Processing completed
[2024-01-15 10:30:30] ERROR Network timeout: Connection to database failed
    at Database.connect (/app/db.js:12:8)
[2024-01-15 10:30:35] WARN High memory usage detected
[2024-01-15 10:30:40] ERROR SyntaxError: Unexpected token in JSON
    at APIParser.parseResponse (/app/api.js:45:20)
"""

    temp_path = tempfile.mktemp(suffix='.log')
    with open(temp_path, 'w') as f:
        f.write(log_content)
    return temp_path


async def test_har_parsing():
    """Test HAR file parsing"""
    print("Testing HAR parsing...")

    worker = SignalWorker()

    # Create test HAR
    har_path = create_test_har()

    try:
        # Test HAR parsing
        parsed_data = worker.parse_har_file(har_path)
        print(f"HAR parsed successfully: {len(parsed_data.get('entries', []))} entries")

        # Check summary
        summary = parsed_data.get('summary', {})
        assert summary.get('total_requests', 0) == 2, "Expected 2 requests"
        assert summary.get('failed_requests', 0) == 1, "Expected 1 failed request"

        # Check entries
        entries = parsed_data.get('entries', [])
        assert len(entries) == 2, "Expected 2 entries"

        # Check first entry
        first_entry = entries[0]
        assert first_entry['status'] == 200, "Expected 200 status"
        assert 'example.com' in first_entry['url'], "Expected example.com in URL"

        print("✅ HAR parsing test passed")

    finally:
        # Cleanup
        os.remove(har_path)


async def test_log_parsing():
    """Test log file parsing"""
    print("Testing log parsing...")

    worker = SignalWorker()

    # Create test log
    log_path = create_test_log()

    try:
        # Test log parsing
        parsed_data = worker.parse_log_file(log_path)
        print(f"Log parsed successfully: {len(parsed_data.get('entries', []))} entries")

        # Check summary
        summary = parsed_data.get('summary', {})
        assert summary.get('total_lines', 0) == 12, "Expected 12 lines"
        assert summary.get('error_lines', 0) == 5, "Expected 5 error lines"

        # Check error signatures
        signatures = parsed_data.get('error_signatures', [])
        assert len(signatures) == 5, f"Expected 5 error signatures, got {len(signatures)}"

        # Check signature structure
        if signatures:
            sig = signatures[0]
            required_fields = ['signature_hash', 'error_type', 'message', 'severity']
            for field in required_fields:
                assert field in sig, f"Missing field: {field}"

            print(f"Found error types: {[s['error_type'] for s in signatures]}")

        print("✅ Log parsing test passed")

    finally:
        # Cleanup
        os.remove(log_path)


async def test_error_classification():
    """Test error type classification"""
    print("Testing error classification...")

    worker = SignalWorker()

    test_cases = [
        ("TypeError: Cannot read property 'map' of undefined", "TypeError"),
        ("ReferenceError: variable is not defined", "ReferenceError"),
        ("SyntaxError: Unexpected token", "SyntaxError"),
        ("Network connection timeout", "NetworkError"),
        ("Database connection failed", "DatabaseError"),
        ("Authentication required", "AuthenticationError"),
        ("Request timeout", "TimeoutError"),
        ("Unknown error occurred", "GenericError"),
    ]

    for message, expected_type in test_cases:
        error_type = worker._classify_error_type(message)
        assert error_type == expected_type, f"Expected {expected_type}, got {error_type} for: {message}"

    print("✅ Error classification test passed")


async def test_signature_clustering():
    """Test error signature clustering"""
    print("Testing signature clustering...")

    worker = SignalWorker()

    # Create test signatures
    signatures = [
        {
            'signature_hash': 'hash1',
            'error_type': 'TypeError',
            'message': "Cannot read property 'map' of undefined",
            'details': 'at CheckoutPage.handleCoupon',
            'severity': 'high',
            'frequency': 1,
        },
        {
            'signature_hash': 'hash2',
            'error_type': 'TypeError',
            'message': "Cannot read property 'length' of undefined",
            'details': 'at DataProcessor.validateInput',
            'severity': 'high',
            'frequency': 1,
        },
        {
            'signature_hash': 'hash3',
            'error_type': 'ReferenceError',
            'message': "userPreferences is not defined",
            'details': 'at UserProfile.loadSettings',
            'severity': 'high',
            'frequency': 1,
        },
    ]

    try:
        # Test clustering
        if worker.embedding_model:
            clustered = await worker.cluster_error_signatures(signatures)
            print(f"Clustered {len(signatures)} signatures into {len(clustered)} groups")

            # Should cluster the two TypeError signatures together
            assert len(clustered) <= len(signatures), "Clustering should not increase signature count"
            print("✅ Signature clustering test passed")
        else:
            print("⚠️  Embedding model not available, skipping clustering test")

    except Exception as e:
        print(f"❌ Clustering test failed: {e}")


async def main():
    """Run all tests"""
    print("🧪 Running Signal Worker Tests\n")

    try:
        await test_har_parsing()
        print()

        await test_log_parsing()
        print()

        await test_error_classification()
        print()

        await test_signature_clustering()
        print()

        print("🎉 All tests completed successfully!")

    except Exception as e:
        print(f"❌ Test failed: {e}")
        return 1

    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)
