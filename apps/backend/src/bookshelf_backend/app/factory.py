"""Flask app factory and runtime wiring."""

from __future__ import annotations

import logging
import os
from typing import Any, Callable

from flask import Flask
from flask_cors import CORS

from ..config import (
    apply_settings_defaults,
    build_settings_from_env,
    cors_origins,
    validate_runtime_config,
)
from ..db import init_database
from ..detector import SpineDetector
from ..extractor import BookExtractor
from ..lookup import GoogleBooksClient
from ..routes.health import health_bp
from ..routes.library import library_bp
from ..routes.scan import scan_bp
from ..routes.search import search_bp
from ..services import (
    DetectorService,
    ExtractorService,
    GoogleBooksService,
    build_books_client_factory,
    build_detector_factory,
    build_extractor_factory,
)
from .runtime import RuntimeState, set_runtime_state


logger = logging.getLogger(__name__)


def create_app(
    detector_factory: Callable[[], SpineDetector] | None = None,
    extractor_factory: Callable[[], BookExtractor] | None = None,
    books_client_factory: Callable[[], GoogleBooksClient] | None = None,
    config_overrides: dict[str, Any] | None = None,
) -> Flask:
    app = Flask(__name__)

    settings = build_settings_from_env()
    apply_settings_defaults(app.config, settings)
    if config_overrides:
        app.config.update(config_overrides)
    validate_runtime_config(app.config)

    CORS(app, origins=cors_origins(app.config.get("BOOKSHELF_ALLOWED_ORIGINS")))
    init_database(app)

    detector_factory = detector_factory or build_detector_factory(
        model_path=str(app.config.get("BOOKSHELF_MODEL_PATH")),
        confidence=float(app.config.get("BOOKSHELF_DETECT_CONFIDENCE", 0.15)),
        iou_threshold=float(app.config.get("BOOKSHELF_DETECT_IOU", 0.45)),
        device=str(app.config.get("BOOKSHELF_DETECT_DEVICE", "auto")),
        classes=app.config.get("BOOKSHELF_DETECT_CLASSES") or [SpineDetector.BOOK_CLASS_ID],
    )
    extractor_factory = extractor_factory or build_extractor_factory(
        model_name=str(app.config.get("BOOKSHELF_EXTRACT_MODEL", "moondream-0.5b")),
        device=str(app.config.get("BOOKSHELF_EXTRACT_DEVICE", "auto")),
        local_files_only=app.config.get("BOOKSHELF_EXTRACT_LOCAL_ONLY"),
    )
    books_client_factory = books_client_factory or build_books_client_factory(
        api_key=os.getenv("GOOGLE_BOOKS_API_KEY"),
        timeout=int(app.config.get("BOOKSHELF_LOOKUP_TIMEOUT", 10)),
        max_results=int(app.config.get("BOOKSHELF_LOOKUP_MAX_RESULTS", 5)),
    )

    runtime_state = RuntimeState(
        detector=DetectorService(detector_factory),
        extractor=ExtractorService(extractor_factory),
        books=GoogleBooksService(books_client_factory),
    )
    set_runtime_state(app, runtime_state)

    app.register_blueprint(health_bp)
    app.register_blueprint(search_bp)
    app.register_blueprint(scan_bp)
    app.register_blueprint(library_bp)

    logger.info("bookshelf backend app initialized")
    return app
