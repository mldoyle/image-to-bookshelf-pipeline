"""Flask API for webcam spine detection and one-shot capture lookup flows."""

from __future__ import annotations

import argparse
import logging
import os
import time
from io import BytesIO
from pathlib import Path
from typing import Any, Callable

import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
from PIL import Image

from .detector import SpineDetector
from .extractor import BookExtractor
from .lookup import GoogleBooksClient

logger = logging.getLogger(__name__)


def _repo_model_path() -> str:
    return str(Path(__file__).resolve().parents[2] / "yolov8n.pt")


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key:
            os.environ.setdefault(key, value)


def _read_bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "y", "on"}


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


def build_extractor_factory(
    *,
    model_name: str,
    device: str,
    local_files_only: bool | None,
) -> Callable[[], BookExtractor]:
    def _factory() -> BookExtractor:
        return BookExtractor(
            model_name=model_name,
            device=device,
            local_files_only=local_files_only,
        )

    return _factory


def build_books_client_factory(
    *,
    api_key: str | None,
    timeout: int,
    max_results: int,
) -> Callable[[], GoogleBooksClient]:
    def _factory() -> GoogleBooksClient:
        return GoogleBooksClient(
            api_key=api_key,
            timeout=timeout,
            max_results=max_results,
        )

    return _factory


def create_app(
    detector_factory: Callable[[], SpineDetector] | None = None,
    extractor_factory: Callable[[], BookExtractor] | None = None,
    books_client_factory: Callable[[], GoogleBooksClient] | None = None,
) -> Flask:
    app = Flask(__name__)
    CORS(app)

    _load_env_file(_repo_root() / "secrets" / ".env")

    if detector_factory is None:
        detector_factory = build_detector_factory(
            model_path=os.getenv("BOOKSHELF_MODEL_PATH", _repo_model_path()),
            confidence=float(os.getenv("BOOKSHELF_DETECT_CONFIDENCE", "0.15")),
            iou_threshold=float(os.getenv("BOOKSHELF_DETECT_IOU", "0.45")),
            device=os.getenv("BOOKSHELF_DETECT_DEVICE", "auto"),
            classes=[SpineDetector.BOOK_CLASS_ID],
        )
    if extractor_factory is None:
        extractor_factory = build_extractor_factory(
            model_name=os.getenv("BOOKSHELF_EXTRACT_MODEL", "moondream-0.5b"),
            device=os.getenv("BOOKSHELF_EXTRACT_DEVICE", "auto"),
            local_files_only=(
                True
                if _read_bool_env("BOOKSHELF_EXTRACT_LOCAL_ONLY", False)
                else None
            ),
        )
    if books_client_factory is None:
        books_client_factory = build_books_client_factory(
            api_key=os.getenv("GOOGLE_BOOKS_API_KEY"),
            timeout=int(os.getenv("BOOKSHELF_LOOKUP_TIMEOUT", "10")),
            max_results=int(os.getenv("BOOKSHELF_LOOKUP_MAX_RESULTS", "5")),
        )

    detector_cache: dict[str, SpineDetector] = {}
    extractor_cache: dict[str, BookExtractor] = {}
    books_client_cache: dict[str, GoogleBooksClient] = {}
    request_counter = {"count": 0}

    def get_detector() -> SpineDetector:
        # Lazy init keeps startup fast and avoids loading YOLO unless needed.
        detector = detector_cache.get("detector")
        if detector is None:
            detector = detector_factory()
            detector_cache["detector"] = detector
            logger.info("Detector initialized for web API")
        return detector

    def get_extractor() -> BookExtractor:
        # Extraction model is heavy; load once and reuse across capture requests.
        extractor = extractor_cache.get("extractor")
        if extractor is None:
            extractor = extractor_factory()
            extractor_cache["extractor"] = extractor
            logger.info("Extractor initialized for web API")
        return extractor

    def get_books_client() -> GoogleBooksClient:
        # Reuse a session-backed client for repeated Google Books calls.
        books_client = books_client_cache.get("books_client")
        if books_client is None:
            books_client = books_client_factory()
            books_client_cache["books_client"] = books_client
            logger.info("Google Books client initialized for web API")
        return books_client

    @app.get("/health")
    def health() -> tuple[dict[str, str], int]:
        return {"status": "ok"}, 200

    @app.get("/")
    def index() -> tuple[dict[str, str], int]:
        return {"status": "ok", "message": "Use POST /detect/spines or /scan/capture"}, 200

    def _compact_lookup_item(item: dict[str, Any]) -> dict[str, Any]:
        volume_info = item.get("volumeInfo") or {}
        return {
            "id": item.get("id"),
            "title": volume_info.get("title"),
            "authors": volume_info.get("authors") or [],
            "publishedDate": volume_info.get("publishedDate"),
            "categories": volume_info.get("categories") or [],
            "averageRating": volume_info.get("averageRating"),
            "ratingsCount": volume_info.get("ratingsCount"),
            "imageLinks": {
                "thumbnail": (volume_info.get("imageLinks") or {}).get("thumbnail"),
                "smallThumbnail": (volume_info.get("imageLinks") or {}).get("smallThumbnail"),
            },
            "publisher": volume_info.get("publisher"),
            "infoLink": volume_info.get("infoLink"),
            "previewLink": volume_info.get("previewLink"),
            "descriptionSnippet": (volume_info.get("description") or "")[:280],
        }

    @app.get("/books/search")
    def books_search():
        query = (request.args.get("q") or "").strip()
        if not query:
            return jsonify({"error": "missing_query"}), 400

        try:
            max_results = int(request.args.get("maxResults", "20"))
        except ValueError:
            return jsonify({"error": "invalid_max_results"}), 400
        max_results = max(1, min(40, max_results))

        books_client = get_books_client()
        try:
            payload = books_client.search(query=query, max_results=max_results)
        except requests.HTTPError as exc:
            status_code = exc.response.status_code if exc.response is not None else 502
            if status_code == 429:
                retry_after = (
                    (exc.response.headers or {}).get("Retry-After") if exc.response is not None else None
                )
                response_payload: dict[str, Any] = {
                    "error": "google_books_rate_limited",
                    "message": "Google Books API rate limit exceeded. Please retry shortly.",
                }
                if retry_after is not None:
                    response_payload["retryAfter"] = retry_after
                return jsonify(response_payload), 429
            logger.warning("Google Books lookup failed: %s", exc)
            return jsonify({"error": "google_books_upstream_error"}), 502

        raw_items = payload.get("items") or []
        return jsonify(
            {
                "totalItems": int(payload.get("totalItems") or 0),
                "items": [_compact_lookup_item(item) for item in raw_items],
            }
        )

    @app.post("/detect/spines")
    def detect_spines():
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

        detector = get_detector()
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

        request_counter["count"] += 1
        req_id = request_counter["count"]
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

    @app.post("/scan/capture")
    def scan_capture():
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

        detector = get_detector()
        extractor = get_extractor()
        books_client = get_books_client()

        started_total = time.perf_counter()
        started_detect = time.perf_counter()
        # Stage 1: detect candidate spines from full-frame capture.
        spine_images, spines = detector.detect_all(
            image=image,
            min_area=min_area,
            max_detections=max_detections,
        )
        detect_ms = (time.perf_counter() - started_detect) * 1000

        started_extract_lookup = time.perf_counter()
        spine_results: list[dict[str, Any]] = []
        for crop_image, spine in zip(spine_images, spines):
            # Stage 2: run OCR/extraction per cropped spine.
            extraction = extractor.extract(crop_image)
            lookup_error: str | None = None
            lookup_total_items = 0
            lookup_items: list[dict[str, Any]] = []

            title = extraction.title.strip()
            author = (extraction.author or "").strip() or None

            if title and not title.startswith("["):
                try:
                    # Stage 3: lookup best metadata candidates for extracted text.
                    lookup_payload = books_client.lookup(title=title, author=author)
                    lookup_total_items = int(lookup_payload.get("totalItems") or 0)
                    raw_items = lookup_payload.get("items") or []
                    lookup_items = [
                        _compact_lookup_item(item) for item in raw_items[:max_lookup_results]
                    ]
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

        request_counter["count"] += 1
        req_id = request_counter["count"]
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

    return app


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run webcam detection Flask API.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=5000, type=int)
    parser.add_argument("--model-path", default=_repo_model_path())
    parser.add_argument("--confidence", default=0.15, type=float)
    parser.add_argument("--iou-threshold", default=0.45, type=float)
    parser.add_argument("--device", default="auto")
    parser.add_argument("--classes", default=str(SpineDetector.BOOK_CLASS_ID))
    return parser.parse_args()


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    args = parse_args()

    classes = [int(value.strip()) for value in args.classes.split(",") if value.strip()]
    detector_factory = build_detector_factory(
        model_path=args.model_path,
        confidence=args.confidence,
        iou_threshold=args.iou_threshold,
        device=args.device,
        classes=classes or None,
    )

    app = create_app(detector_factory=detector_factory)
    app.run(host=args.host, port=args.port, debug=False)


if __name__ == "__main__":
    main()
