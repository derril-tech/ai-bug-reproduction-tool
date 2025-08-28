#!/usr/bin/env python3
"""
Test script for Ingest Worker functionality
"""

import asyncio
import json
import tempfile
import os
from pathlib import Path
from PIL import Image, ImageDraw
import cv2
import numpy as np

from worker import IngestWorker


def create_test_screenshot():
    """Create a test screenshot with text"""
    img = Image.new('RGB', (800, 600), color='white')
    draw = ImageDraw.Draw(img)

    # Add some text
    text = "Error: Cannot read property 'map' of undefined\nat CheckoutPage.handleCoupon\nStack trace shows issue in cart.js:45"
    draw.text((50, 50), text, fill='black')

    # Save to temp file
    temp_path = tempfile.mktemp(suffix='.png')
    img.save(temp_path)
    return temp_path


def create_test_har():
    """Create a test HAR file"""
    har_data = {
        "log": {
            "version": "1.2",
            "entries": [
                {
                    "request": {
                        "url": "https://example.com/api/checkout",
                        "method": "POST",
                        "headers": [
                            {"name": "User-Agent", "value": "Mozilla/5.0"},
                            {"name": "Content-Type", "value": "application/json"}
                        ]
                    },
                    "response": {
                        "status": 500,
                        "content": {
                            "mimeType": "application/json"
                        }
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
    """Create a test log file"""
    log_content = """[2024-01-15 10:30:00] INFO Starting checkout process
[2024-01-15 10:30:05] ERROR TypeError: Cannot read property 'map' of undefined
    at CheckoutPage.handleCoupon (/app/cart.js:45:12)
    at CheckoutPage.applyDiscount (/app/cart.js:67:8)
[2024-01-15 10:30:05] WARN Failed to process coupon application
[2024-01-15 10:30:10] INFO User session ended
"""

    temp_path = tempfile.mktemp(suffix='.log')
    with open(temp_path, 'w') as f:
        f.write(log_content)
    return temp_path


async def test_ocr():
    """Test OCR functionality"""
    print("Testing OCR functionality...")

    worker = IngestWorker()

    # Create test screenshot
    screenshot_path = create_test_screenshot()

    try:
        # Test OCR
        extracted_text = worker.extract_text_from_image(screenshot_path)
        print(f"OCR Result: {extracted_text[:100]}...")

        # Check if text was extracted
        assert len(extracted_text) > 0, "No text extracted from image"
        assert "Error" in extracted_text, "Expected error text not found"
        print("✅ OCR test passed")

    finally:
        # Cleanup
        os.remove(screenshot_path)


async def test_har_processing():
    """Test HAR file processing"""
    print("Testing HAR processing...")

    worker = IngestWorker()

    # Create test HAR
    har_path = create_test_har()

    try:
        # Test HAR processing
        extracted_text = worker.extract_text_from_har(har_path)
        print(f"HAR Result: {extracted_text[:100]}...")

        # Check if data was extracted
        assert len(extracted_text) > 0, "No data extracted from HAR"
        assert "checkout" in extracted_text.lower(), "Expected checkout URL not found"
        print("✅ HAR processing test passed")

    finally:
        # Cleanup
        os.remove(har_path)


async def test_log_processing():
    """Test log file processing"""
    print("Testing log processing...")

    worker = IngestWorker()

    # Create test log
    log_path = create_test_log()

    try:
        # Test log processing
        extracted_text = worker.extract_text_from_log(log_path)
        print(f"Log Result: {extracted_text[:100]}...")

        # Check if errors were extracted
        assert len(extracted_text) > 0, "No data extracted from log"
        assert "ERROR" in extracted_text, "Expected error not found"
        assert "TypeError" in extracted_text, "Expected TypeError not found"
        print("✅ Log processing test passed")

    finally:
        # Cleanup
        os.remove(log_path)


async def test_video_processing():
    """Test video processing (if Whisper is available)"""
    print("Testing video processing...")

    worker = IngestWorker()

    if worker.whisper_model:
        print("Whisper model available, but skipping video test (would require actual video file)")
        print("✅ Video processing dependency check passed")
    else:
        print("⚠️  Whisper model not available, skipping video test")
        print("Note: Install torch and openai-whisper to enable video processing")


async def main():
    """Run all tests"""
    print("🧪 Running Ingest Worker Tests\n")

    try:
        await test_ocr()
        print()

        await test_har_processing()
        print()

        await test_log_processing()
        print()

        await test_video_processing()
        print()

        print("🎉 All tests completed successfully!")

    except Exception as e:
        print(f"❌ Test failed: {e}")
        return 1

    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)
