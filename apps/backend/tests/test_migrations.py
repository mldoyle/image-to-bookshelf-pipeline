"""Migration behavior checks for fresh and legacy SQLite databases."""

from __future__ import annotations

import sqlite3
from pathlib import Path

from flask_migrate import upgrade as migrate_upgrade
from PIL import Image

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


def _build_app(db_uri: str):
    return create_app(
        detector_factory=lambda: _FakeDetector(),
        extractor_factory=lambda: _FakeExtractor(),
        books_client_factory=lambda: _FakeBooksClient(),
        config_overrides={
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": db_uri,
            "DATABASE_URL": db_uri,
            "BOOKSHELF_ENABLE_DEV_IDENTITY_FALLBACK": True,
        },
    )


def _create_legacy_schema(path: Path) -> None:
    with sqlite3.connect(path) as connection:
        connection.executescript(
            """
            CREATE TABLE users (
                id VARCHAR(36) NOT NULL PRIMARY KEY,
                email VARCHAR(320) NOT NULL,
                username VARCHAR(80) NOT NULL,
                password_hash VARCHAR(255),
                display_name VARCHAR(120),
                avatar_url TEXT,
                is_active BOOLEAN NOT NULL DEFAULT 1,
                library_visibility VARCHAR(16) NOT NULL DEFAULT 'private',
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL
            );

            CREATE TABLE books (
                id VARCHAR(36) NOT NULL PRIMARY KEY,
                google_books_id VARCHAR(128),
                isbn_10 VARCHAR(10),
                isbn_13 VARCHAR(13),
                title VARCHAR(500) NOT NULL,
                title_normalized VARCHAR(500) NOT NULL,
                subtitle VARCHAR(500),
                primary_author VARCHAR(255),
                authors_json JSON NOT NULL,
                categories_json JSON NOT NULL,
                publisher VARCHAR(255),
                published_date VARCHAR(32),
                published_year INTEGER,
                thumbnail_url TEXT,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL
            );

            CREATE TABLE user_books (
                id VARCHAR(36) NOT NULL PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                book_id VARCHAR(36) NOT NULL,
                shelf VARCHAR(32) NOT NULL DEFAULT 'read',
                status VARCHAR(32) NOT NULL DEFAULT 'owned',
                source VARCHAR(32) NOT NULL DEFAULT 'scan',
                loaned BOOLEAN NOT NULL DEFAULT 0,
                rating FLOAT,
                review TEXT,
                started_at DATETIME,
                finished_at DATETIME,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL
            );
            """
        )


def test_migration_upgrades_legacy_sqlite_schema(tmp_path: Path):
    db_path = tmp_path / "legacy.db"
    _create_legacy_schema(db_path)

    app = _build_app(f"sqlite:///{db_path}")
    with app.app_context():
        migrate_upgrade(directory=str(Path(__file__).resolve().parents[1] / "migrations"))

    with sqlite3.connect(db_path) as connection:
        users_cols = {
            row[1] for row in connection.execute("PRAGMA table_info('users')").fetchall()
        }
        books_cols = {
            row[1] for row in connection.execute("PRAGMA table_info('books')").fetchall()
        }
        user_books_cols = {
            row[1] for row in connection.execute("PRAGMA table_info('user_books')").fetchall()
        }
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }

    assert "bio" in users_cols
    assert "location" in users_cols
    assert "website" in users_cols
    assert "badge" in users_cols

    assert "page_count" in books_cols
    assert "synopsis" in books_cols
    assert "info_link" in books_cols

    assert "liked" in user_books_cols
    assert "reread" in user_books_cols

    assert "friends" in tables
    assert "loans" in tables
