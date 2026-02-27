"""Tests for production safety guards in runtime settings and identity handling."""

from __future__ import annotations

from PIL import Image
import pytest

from bookshelf_backend.web_api import create_app


class _FakeSpine:
    def __init__(self, bbox: tuple[int, int, int, int], confidence: float, index: int) -> None:
        self.bbox = bbox
        self.confidence = confidence
        self.index = index


class _FakeExtraction:
    def __init__(self, title: str, author: str, confidence: float) -> None:
        self.title = title
        self.author = author
        self.confidence = confidence


class _FakeDetector:
    def detect_all(self, image: Image.Image, min_area: int, max_detections: int):
        return [image], [_FakeSpine((0, 0, image.width, image.height), 0.98, 0)]


class _FakeExtractor:
    def extract(self, spine_image: Image.Image) -> _FakeExtraction:
        return _FakeExtraction("Dune", "Frank Herbert", 0.91)


class _FakeBooksClient:
    api_key = "test-key"

    def lookup(self, title: str, author: str | None = None) -> dict:
        return {"totalItems": 0, "items": []}

    def search(self, query: str, max_results: int | None = None) -> dict:
        return {"totalItems": 0, "items": []}


def test_create_app_rejects_production_with_fallback_enabled():
    with pytest.raises(RuntimeError) as exc_info:
        create_app(
            detector_factory=lambda: _FakeDetector(),
            extractor_factory=lambda: _FakeExtractor(),
            books_client_factory=lambda: _FakeBooksClient(),
            config_overrides={
                "BOOKSHELF_ENV": "production",
                "BOOKSHELF_ENABLE_DEV_IDENTITY_FALLBACK": True,
                "DATABASE_URL": "sqlite:///:memory:",
                "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            },
        )
    assert "BOOKSHELF_ENABLE_DEV_IDENTITY_FALLBACK" in str(exc_info.value)


def test_library_requires_identity_when_fallback_disabled():
    app = create_app(
        detector_factory=lambda: _FakeDetector(),
        extractor_factory=lambda: _FakeExtractor(),
        books_client_factory=lambda: _FakeBooksClient(),
        config_overrides={
            "BOOKSHELF_ENV": "production",
            "BOOKSHELF_ENABLE_DEV_IDENTITY_FALLBACK": False,
            "DATABASE_URL": "sqlite:///:memory:",
            "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
            "TESTING": True,
        },
    )
    client = app.test_client()

    response = client.get("/library/me/profile")
    payload = response.get_json()

    assert response.status_code == 401
    assert payload["error"] == "missing_identity"
