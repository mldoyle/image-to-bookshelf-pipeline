"""Image scan routes for detection and one-shot capture lookup."""

from __future__ import annotations

import logging
import time
from io import BytesIO
from typing import Any

from flask import Blueprint, current_app, jsonify, request
from PIL import Image

from ..app.runtime import get_runtime_state
from ..services.google_books_service import (
    compact_lookup_item,
    has_books_api_key,
    missing_api_key_message,
)


logger = logging.getLogger(__name__)
scan_bp = Blueprint("scan", __name__)


def _normalized_extracted_title(title: str) -> str:
    return " ".join((title or "").strip().lower().split())


def _scan_enabled() -> bool:
    return bool(current_app.config.get("BOOKSHELF_SCAN_ENABLED", True))


def _model_error_payload(exc: Exception) -> tuple[dict[str, str], int]:
    return {
        "error": "model_unavailable",
        "message": f"{type(exc).__name__}: {exc}",
    }, 503


@scan_bp.post("/detect/spines")
def detect_spines():
    if not _scan_enabled():
        return jsonify({"error": "scan_disabled"}), 503

    if "image" not in request.files:
        return jsonify({"error": "missing_image_file"}), 400

    uploaded = request.files["image"]
    if not uploaded or uploaded.filename == "":
        return jsonify({"error": "empty_image_file"}), 400

    try:
        image = Image.open(BytesIO(uploaded.read())).convert("RGB")
    except Exception as exc:  # pragma: no cover - PIL internals vary by input
        return jsonify({"error": f"invalid_image:{exc}"}), 400

    min_area = int(request.form.get("minArea", "250"))
    max_detections = int(request.form.get("maxDetections", "50"))
    runtime = get_runtime_state()
    try:
        detector = runtime.detector.get_detector()
    except Exception as exc:
        payload, status = _model_error_payload(exc)
        return jsonify(payload), status

    started_at = time.perf_counter()
    _, spines = detector.detect_all(
        image=image,
        min_area=min_area,
        max_detections=max_detections,
    )
    inference_ms = (time.perf_counter() - started_at) * 1000

    boxes = []
    for spine in spines:
        x1, y1, x2, y2 = spine.bbox
        boxes.append(
            {
                "index": spine.index,
                "bbox": [x1, y1, x2, y2],
                "x1": x1,
                "y1": y1,
                "x2": x2,
                "y2": y2,
                "x": x1,
                "y": y1,
                "w": max(0, x2 - x1),
                "h": max(0, y2 - y1),
                "confidence": spine.confidence,
            }
        )

    req_id = runtime.next_request_id()
    log_sample = req_id % 20 == 0 or len(boxes) == 0
    if log_sample:
        top_conf = sorted(
            [round(float(box["confidence"]), 3) for box in boxes],
            reverse=True,
        )[:3]
        logger.info(
            "detect/spines req=%s count=%s min_area=%s max_det=%s size=%sx%s inference_ms=%.1f top_conf=%s",
            req_id,
            len(boxes),
            min_area,
            max_detections,
            image.width,
            image.height,
            inference_ms,
            top_conf,
        )

    return jsonify(
        {
            "boxes": boxes,
            "count": len(boxes),
            "frameWidth": image.width,
            "frameHeight": image.height,
            "inferenceMs": round(inference_ms, 2),
        }
    )


@scan_bp.post("/scan/capture")
def scan_capture():
    if not _scan_enabled():
        return jsonify({"error": "scan_disabled"}), 503

    if "image" not in request.files:
        return jsonify({"error": "missing_image_file"}), 400

    uploaded = request.files["image"]
    if not uploaded or uploaded.filename == "":
        return jsonify({"error": "empty_image_file"}), 400

    try:
        image = Image.open(BytesIO(uploaded.read())).convert("RGB")
    except Exception as exc:  # pragma: no cover - PIL internals vary by input
        return jsonify({"error": f"invalid_image:{exc}"}), 400

    min_area = int(request.form.get("minArea", "250"))
    max_detections = int(request.form.get("maxDetections", "50"))
    max_lookup_results = max(1, min(10, int(request.form.get("maxLookupResults", "3"))))

    runtime = get_runtime_state()
    try:
        detector = runtime.detector.get_detector()
        extractor = runtime.extractor.get_extractor()
    except Exception as exc:
        payload, status = _model_error_payload(exc)
        return jsonify(payload), status
    books_client = runtime.books.get_client()
    has_books_key = has_books_api_key(books_client)

    started_total = time.perf_counter()
    started_detect = time.perf_counter()
    spine_images, spines = detector.detect_all(
        image=image,
        min_area=min_area,
        max_detections=max_detections,
    )
    detect_ms = (time.perf_counter() - started_detect) * 1000

    started_extract_lookup = time.perf_counter()
    spine_results: list[dict[str, Any]] = []
    seen_extracted_titles: set[str] = set()
    for crop_image, spine in zip(spine_images, spines):
        extraction = extractor.extract(crop_image)
        lookup_error: str | None = None
        lookup_total_items = 0
        lookup_items: list[dict[str, Any]] = []

        title = extraction.title.strip()
        author = (extraction.author or "").strip() or None
        normalized_title = _normalized_extracted_title(title)

        if normalized_title and not normalized_title.startswith("["):
            if normalized_title in seen_extracted_titles:
                logger.info(
                    "scan/capture dropping duplicate extracted title spine_index=%s title=%s",
                    spine.index,
                    title,
                )
                continue
            seen_extracted_titles.add(normalized_title)

        if title and not title.startswith("["):
            if not has_books_key:
                lookup_error = f"missing_api_key: {missing_api_key_message()}"
            else:
                try:
                    lookup_payload = books_client.lookup(title=title, author=author)
                    lookup_total_items = int(lookup_payload.get("totalItems") or 0)
                    raw_items = lookup_payload.get("items") or []
                    lookup_items = [compact_lookup_item(item) for item in raw_items[:max_lookup_results]]
                except Exception as exc:  # pragma: no cover - network/runtime dependent
                    lookup_error = f"{type(exc).__name__}: {exc}"

        x1, y1, x2, y2 = spine.bbox
        spine_results.append(
            {
                "spineIndex": spine.index,
                "bbox": [x1, y1, x2, y2],
                "confidence": float(spine.confidence),
                "extraction": {
                    "title": extraction.title,
                    "author": extraction.author,
                    "confidence": float(extraction.confidence),
                },
                "lookup": {
                    "totalItems": lookup_total_items,
                    "items": lookup_items,
                    "error": lookup_error,
                },
            }
        )

    extract_lookup_ms = (time.perf_counter() - started_extract_lookup) * 1000
    total_ms = (time.perf_counter() - started_total) * 1000

    req_id = runtime.next_request_id()
    logger.info(
        "scan/capture req=%s count=%s min_area=%s max_det=%s max_lookup_results=%s detect_ms=%.1f extract_lookup_ms=%.1f total_ms=%.1f",
        req_id,
        len(spine_results),
        min_area,
        max_detections,
        max_lookup_results,
        detect_ms,
        extract_lookup_ms,
        total_ms,
    )

    return jsonify(
        {
            "count": len(spine_results),
            "frameWidth": image.width,
            "frameHeight": image.height,
            "spines": spine_results,
            "timingsMs": {
                "detect": round(detect_ms, 2),
                "extractLookup": round(extract_lookup_ms, 2),
                "total": round(total_ms, 2),
            },
        }
    )
