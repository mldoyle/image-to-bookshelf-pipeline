"""
detector.py - Book spine detection using YOLO.

Detects book spines in bookshelf images using YOLOv8.
Returns cropped spine images sorted in reading order.
"""
# %%

from __future__ import annotations

import logging
from pathlib import Path
from typing import Iterator

from PIL import Image
from ultralytics import YOLO

from .schemas import DetectedSpine

logger = logging.getLogger(__name__)
# %%


class SpineDetector:
    """Detects book spines in bookshelf images using YOLOv8."""

    BOOK_CLASS_ID = 73

    def __init__(
        self,
        model_path: str = "yolov8n.pt",
        confidence: float = 0.25,
        iou_threshold: float = 0.45,
        device: str = "auto",
        classes: list[int] | None = None,
    ) -> None:
        self.confidence = confidence
        self.iou_threshold = iou_threshold
        self.classes = classes if classes is not None else [self.BOOK_CLASS_ID]

        self.device = self._resolve_device(device)

        logger.info("Loading YOLO model: %s on %s", model_path, self.device)
        self.model = YOLO(model_path)
        self.model.to(self.device)

    def detect(
        self,
        image: Image.Image | str | Path,
        min_area: int = 1000,
        max_detections: int = 50,
    ) -> Iterator[tuple[Image.Image, DetectedSpine]]:
        """Detect book spines and yield cropped images with metadata."""
        if isinstance(image, (str, Path)):
            image = Image.open(image).convert("RGB")

        results = self.model.predict(
            source=image,
            conf=self.confidence,
            iou=self.iou_threshold,
            classes=self.classes,
            device=self.device,
            verbose=False,
        )

        if not results or len(results[0].boxes) == 0:
            logger.warning("No book spines detected in image")
            return

        detections: list[DetectedSpine] = []
        for i, box in enumerate(results[0].boxes):
            bbox = tuple(map(int, box.xyxy[0].tolist()))
            spine = DetectedSpine(
                bbox=bbox,
                confidence=float(box.conf[0]),
                index=i,
            )
            if spine.area >= min_area:
                detections.append(spine)

        detections = self._sort_reading_order(detections)
        detections = detections[:max_detections]

        for i, det in enumerate(detections):
            det.index = i

        logger.info("Detected %s book spines", len(detections))

        for det in detections:
            x1, y1, x2, y2 = det.bbox
            cropped = image.crop((x1, y1, x2, y2))
            yield cropped, det

    def detect_all(
        self,
        image: Image.Image | str | Path,
        min_area: int = 1000,
        max_detections: int = 50,
    ) -> tuple[list[Image.Image], list[DetectedSpine]]:
        """Detect all spines and return lists."""
        images: list[Image.Image] = []
        spines: list[DetectedSpine] = []
        for img, spine in self.detect(image, min_area=min_area, max_detections=max_detections):
            images.append(img)
            spines.append(spine)
        return images, spines

    @staticmethod
    def _resolve_device(device: str) -> str:
        if device == "auto":
            import torch

            if torch.cuda.is_available():
                return "cuda"
            if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                return "mps"
            return "cpu"
        return device

    @staticmethod
    def _sort_reading_order(detections: list[DetectedSpine]) -> list[DetectedSpine]:
        if not detections:
            return detections

        detections = sorted(detections, key=lambda d: d.bbox[0])
        rows: list[list[DetectedSpine]] = []

        for det in detections:
            det_center_y = (det.bbox[1] + det.bbox[3]) / 2
            placed = False

            for row in rows:
                row_top = min(d.bbox[1] for d in row)
                row_bottom = max(d.bbox[3] for d in row)
                if row_top <= det_center_y <= row_bottom:
                    row.append(det)
                    placed = True
                    break

            if not placed:
                rows.append([det])

        rows.sort(key=lambda row: min(d.bbox[1] for d in row))
        for row in rows:
            row.sort(key=lambda d: d.bbox[0])

        return [det for row in rows for det in row]

# %%
