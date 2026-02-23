"""Tests for Flask web API routes and compact lookup payload shape."""

from __future__ import annotations

from io import BytesIO

from PIL import Image

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
    def __init__(self) -> None:
        self.search_calls: list[tuple[str, int | None]] = []

    @staticmethod
    def _payload() -> dict:
        return {
            "totalItems": 1,
            "items": [
                {
                    "id": "dune-id",
                    "volumeInfo": {
                        "title": "Dune",
                        "authors": ["Frank Herbert"],
                        "publishedDate": "1965-08-01",
                        "categories": ["Science Fiction"],
                        "averageRating": 4.6,
                        "ratingsCount": 1940,
                        "imageLinks": {
                            "thumbnail": "https://example.com/thumb.jpg",
                            "smallThumbnail": "https://example.com/small.jpg",
                        },
                        "publisher": "Ace",
                        "infoLink": "https://books.google.com/dune",
                        "previewLink": "https://books.google.com/dune-preview",
                        "description": "Classic sci-fi novel.",
                    },
                }
            ],
        }

    def lookup(self, title: str, author: str | None = None) -> dict:
        return self._payload()

    def search(self, query: str, max_results: int | None = None) -> dict:
        self.search_calls.append((query, max_results))
        return self._payload()


class _NoKeyBooksClient:
    api_key = None

    def lookup(self, title: str, author: str | None = None) -> dict:
        raise AssertionError("lookup should not be called without an API key")

    def search(self, query: str, max_results: int | None = None) -> dict:
        raise AssertionError("search should not be called without an API key")


def _build_test_client(books_client_factory=None):
    holder: dict[str, _FakeBooksClient] = {}

    def _books_factory():
        client = _FakeBooksClient() if books_client_factory is None else books_client_factory()
        holder["client"] = client
        return client

    app = create_app(
        detector_factory=lambda: _FakeDetector(),
        extractor_factory=lambda: _FakeExtractor(),
        books_client_factory=_books_factory,
    )
    app.config.update(TESTING=True)
    return app.test_client(), holder


def _build_image_payload() -> tuple[BytesIO, str]:
    image = Image.new("RGB", (32, 20), color=(255, 255, 255))
    buffer = BytesIO()
    image.save(buffer, format="JPEG")
    buffer.seek(0)
    return buffer, "capture.jpg"


def test_books_search_requires_query():
    client, _ = _build_test_client()

    response = client.get("/books/search")

    assert response.status_code == 400
    assert response.get_json()["error"] == "missing_query"


def test_books_search_returns_compact_payload():
    client, holder = _build_test_client()

    response = client.get("/books/search?q=dune&maxResults=7")
    payload = response.get_json()

    assert response.status_code == 200
    assert payload["totalItems"] == 1
    assert payload["items"][0]["title"] == "Dune"
    assert payload["items"][0]["categories"] == ["Science Fiction"]
    assert payload["items"][0]["averageRating"] == 4.6
    assert payload["items"][0]["ratingsCount"] == 1940
    assert payload["items"][0]["imageLinks"]["thumbnail"] == "https://example.com/thumb.jpg"
    assert holder["client"].search_calls == [("dune", 7)]


def test_books_search_returns_missing_api_key_when_unset():
    client, _ = _build_test_client(books_client_factory=lambda: _NoKeyBooksClient())

    response = client.get("/books/search?q=dune&maxResults=7")
    payload = response.get_json()

    assert response.status_code == 503
    assert payload["error"] == "missing_api_key"
    assert "GOOGLE_BOOKS_API_KEY" in payload["message"]


def test_scan_capture_compact_lookup_item_includes_extended_metadata():
    client, _ = _build_test_client()
    image_file, filename = _build_image_payload()

    response = client.post(
        "/scan/capture",
        data={
            "image": (image_file, filename),
            "minArea": "100",
            "maxDetections": "3",
            "maxLookupResults": "1",
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    payload = response.get_json()
    lookup_item = payload["spines"][0]["lookup"]["items"][0]
    assert lookup_item["id"] == "dune-id"
    assert lookup_item["title"] == "Dune"
    assert lookup_item["authors"] == ["Frank Herbert"]
    assert lookup_item["categories"] == ["Science Fiction"]
    assert lookup_item["averageRating"] == 4.6
    assert lookup_item["ratingsCount"] == 1940
    assert lookup_item["imageLinks"]["smallThumbnail"] == "https://example.com/small.jpg"
    assert lookup_item["publisher"] == "Ace"
    assert lookup_item["infoLink"] == "https://books.google.com/dune"


def test_scan_capture_returns_missing_api_key_error_when_unset():
    client, _ = _build_test_client(books_client_factory=lambda: _NoKeyBooksClient())
    image_file, filename = _build_image_payload()

    response = client.post(
        "/scan/capture",
        data={
            "image": (image_file, filename),
            "minArea": "100",
            "maxDetections": "3",
            "maxLookupResults": "1",
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    payload = response.get_json()
    lookup = payload["spines"][0]["lookup"]
    assert lookup["totalItems"] == 0
    assert lookup["items"] == []
    assert lookup["error"].startswith("missing_api_key:")
