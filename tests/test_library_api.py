"""Tests for DB-backed library endpoints."""

from __future__ import annotations

from pathlib import Path

import pytest
from PIL import Image

pytest.importorskip("flask_sqlalchemy")

from bookshelf_scanner.web_api import create_app


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


def _build_test_client(db_path: Path):
    app = create_app(
        detector_factory=lambda: _FakeDetector(),
        extractor_factory=lambda: _FakeExtractor(),
        books_client_factory=lambda: _FakeBooksClient(),
        config_overrides={
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{db_path}",
            "BOOKSHELF_DB_AUTO_CREATE": True,
            "SQLALCHEMY_ECHO": False,
        },
    )
    return app.test_client()


def test_library_books_list_empty(tmp_path):
    client = _build_test_client(tmp_path / "library-empty.db")

    response = client.get("/library/me/books")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["count"] == 0
    assert payload["items"] == []


def test_library_books_add_and_list(tmp_path):
    client = _build_test_client(tmp_path / "library-add.db")

    add_response = client.post(
        "/library/me/books",
        json={
            "title": "Dune",
            "author": "Frank Herbert",
            "publishedYear": 1965,
            "genres": ["Science Fiction"],
            "rating": 4.5,
            "review": "Classic.",
            "googleBooksId": "dune-gid",
            "coverThumbnail": "https://example.com/dune.jpg",
            "source": "search",
        },
    )
    assert add_response.status_code == 201

    list_response = client.get("/library/me/books")
    assert list_response.status_code == 200

    payload = list_response.get_json()
    assert payload["count"] == 1
    item = payload["items"][0]
    assert item["title"] == "Dune"
    assert item["author"] == "Frank Herbert"
    assert item["rating"] == 4.5
    assert item["review"] == "Classic."
    assert item["googleBooksId"] == "dune-gid"
    assert item["source"] == "search"


def test_library_books_batch_upsert_dedupes_by_google_books_id(tmp_path):
    client = _build_test_client(tmp_path / "library-batch.db")

    response = client.post(
        "/library/me/books/batch",
        json={
            "items": [
                {
                    "title": "Dune",
                    "author": "Frank Herbert",
                    "publishedYear": 1965,
                    "genres": ["Science Fiction"],
                    "rating": 4.6,
                    "googleBooksId": "dune-gid",
                    "source": "scan",
                },
                {
                    "title": "Dune",
                    "author": "Frank Herbert",
                    "publishedYear": 1965,
                    "genres": ["Science Fiction"],
                    "rating": 4.1,
                    "googleBooksId": "dune-gid",
                    "source": "search",
                },
            ]
        },
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["count"] == 2

    list_response = client.get("/library/me/books")
    list_payload = list_response.get_json()
    assert list_payload["count"] == 1
    assert list_payload["items"][0]["rating"] == 4.1
    assert list_payload["items"][0]["source"] == "search"


def test_library_book_patch_and_delete(tmp_path):
    client = _build_test_client(tmp_path / "library-patch.db")

    add_response = client.post(
        "/library/me/books",
        json={
            "title": "Project Hail Mary",
            "author": "Andy Weir",
            "publishedYear": 2021,
            "genres": ["Science Fiction"],
            "rating": 4.2,
            "googleBooksId": "phm-gid",
        },
    )
    added = add_response.get_json()["item"]

    patch_response = client.patch(
        f"/library/me/books/{added['id']}",
        json={"loaned": True, "review": "Fun read", "rating": 4.8},
    )

    assert patch_response.status_code == 200
    patched = patch_response.get_json()["item"]
    assert patched["loaned"] is True
    assert patched["review"] == "Fun read"
    assert patched["rating"] == 4.8

    delete_response = client.delete(f"/library/me/books/{added['id']}")
    assert delete_response.status_code == 200

    list_response = client.get("/library/me/books")
    assert list_response.get_json()["count"] == 0


def test_library_profile_patch_and_fetch(tmp_path):
    client = _build_test_client(tmp_path / "library-profile.db")

    patch_response = client.patch(
        "/library/me/profile",
        json={
            "displayName": "Jordan Diaz",
            "bio": "Reading every day.",
            "location": "Brooklyn, NY",
            "website": "jordanreads.blog",
            "badge": "PATRON",
        },
    )
    assert patch_response.status_code == 200
    profile = patch_response.get_json()["profile"]
    assert profile["displayName"] == "Jordan Diaz"
    assert profile["bio"] == "Reading every day."
    assert profile["location"] == "Brooklyn, NY"
    assert profile["website"] == "jordanreads.blog"
    assert profile["badge"] == "PATRON"

    get_response = client.get("/library/me/profile")
    assert get_response.status_code == 200
    assert get_response.get_json()["profile"]["displayName"] == "Jordan Diaz"


def test_library_friends_crud(tmp_path):
    client = _build_test_client(tmp_path / "library-friends.db")

    create_response = client.post(
        "/library/me/friends",
        json={
            "name": "Sarah Mitchell",
            "email": "sarah@example.com",
        },
    )
    assert create_response.status_code == 201
    created = create_response.get_json()["item"]
    assert created["name"] == "Sarah Mitchell"
    assert created["initials"] == "SM"

    list_response = client.get("/library/me/friends")
    assert list_response.status_code == 200
    assert list_response.get_json()["count"] == 1

    patch_response = client.patch(
        f"/library/me/friends/{created['id']}",
        json={"status": "blocked"},
    )
    assert patch_response.status_code == 200
    assert patch_response.get_json()["item"]["status"] == "blocked"

    delete_response = client.delete(f"/library/me/friends/{created['id']}")
    assert delete_response.status_code == 200

    assert client.get("/library/me/friends").get_json()["count"] == 0


def test_library_loans_workflow(tmp_path):
    client = _build_test_client(tmp_path / "library-loans.db")

    add_book_response = client.post(
        "/library/me/books",
        json={
            "title": "Dune",
            "author": "Frank Herbert",
            "publishedYear": 1965,
            "genres": ["Science Fiction"],
            "googleBooksId": "dune-loan-gid",
        },
    )
    assert add_book_response.status_code == 201
    added_book = add_book_response.get_json()["item"]

    add_friend_response = client.post(
        "/library/me/friends",
        json={"name": "James Kim"},
    )
    assert add_friend_response.status_code == 201
    friend = add_friend_response.get_json()["item"]

    create_loan_response = client.post(
        "/library/me/loans",
        json={
            "userBookId": added_book["id"],
            "friendId": friend["id"],
            "dueDate": "2026-03-15T00:00:00+00:00",
        },
    )
    assert create_loan_response.status_code == 201
    loan = create_loan_response.get_json()["item"]
    assert loan["status"] == "active"
    assert loan["borrowerName"] == "James Kim"

    books_after_loan = client.get("/library/me/books").get_json()["items"]
    assert books_after_loan[0]["loaned"] is True

    patch_loan_response = client.patch(
        f"/library/me/loans/{loan['id']}",
        json={"status": "returned"},
    )
    assert patch_loan_response.status_code == 200
    assert patch_loan_response.get_json()["item"]["status"] == "returned"

    books_after_return = client.get("/library/me/books").get_json()["items"]
    assert books_after_return[0]["loaned"] is False
