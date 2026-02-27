"""Detector service wiring for lazy-initialized spine detection."""

from __future__ import annotations

from typing import Callable

from ..detector import SpineDetector


class DetectorService:
    """Lazy detector lifecycle for route handlers."""

    def __init__(self, detector_factory: Callable[[], SpineDetector]) -> None:
        self._detector_factory = detector_factory
        self._detector: SpineDetector | None = None

    def get_detector(self) -> SpineDetector:
        if self._detector is None:
            self._detector = self._detector_factory()
        return self._detector


def build_detector_factory(
    *,
    model_path: str,
    confidence: float,
    iou_threshold: float,
    device: str,
    classes: list[int] | None,
) -> Callable[[], SpineDetector]:
    def _factory() -> SpineDetector:
        return SpineDetector(
            model_path=model_path,
            confidence=confidence,
            iou_threshold=iou_threshold,
            device=device,
            classes=classes,
        )

    return _factory
