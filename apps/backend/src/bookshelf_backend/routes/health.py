"""Health and index routes."""

from __future__ import annotations

from flask import Blueprint


health_bp = Blueprint("health", __name__)


@health_bp.get("/health")
def health() -> tuple[dict[str, str], int]:
    return {"status": "ok"}, 200


@health_bp.get("/")
def index() -> tuple[dict[str, str], int]:
    return {"status": "ok", "message": "Use POST /detect/spines or /scan/capture"}, 200
