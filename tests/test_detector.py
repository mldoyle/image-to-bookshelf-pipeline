"""Tests for spine detector ordering logic."""

from bookshelf_scanner.detector import SpineDetector
from bookshelf_scanner.schemas import DetectedSpine


def test_sort_reading_order_left_to_right():
    detections = [
        DetectedSpine(bbox=(100, 0, 150, 50), confidence=0.9, index=0),
        DetectedSpine(bbox=(10, 0, 60, 50), confidence=0.9, index=1),
    ]

    sorted_detections = SpineDetector._sort_reading_order(detections)
    assert sorted_detections[0].bbox[0] == 10
    assert sorted_detections[1].bbox[0] == 100
