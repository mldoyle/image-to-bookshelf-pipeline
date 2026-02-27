"""Flask API entry point for the Bookshelf backend service."""

from __future__ import annotations

import argparse
import logging

from .app.factory import create_app
from .config.settings import default_model_path
from .detector import SpineDetector
from .services.detector_service import build_detector_factory


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run bookshelf backend API server.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=5000, type=int)
    parser.add_argument("--model-path", default=default_model_path())
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
