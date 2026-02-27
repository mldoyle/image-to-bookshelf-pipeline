"""Google Books service wrappers used by API routes."""

from __future__ import annotations

from typing import Any, Callable

from ..lookup import GoogleBooksClient


def compact_lookup_item(item: dict[str, Any]) -> dict[str, Any]:
    volume_info = item.get("volumeInfo") or {}
    return {
        "id": item.get("id"),
        "title": volume_info.get("title"),
        "authors": volume_info.get("authors") or [],
        "publishedDate": volume_info.get("publishedDate"),
        "categories": volume_info.get("categories") or [],
        "averageRating": volume_info.get("averageRating"),
        "ratingsCount": volume_info.get("ratingsCount"),
        "pageCount": volume_info.get("pageCount"),
        "imageLinks": {
            "thumbnail": (volume_info.get("imageLinks") or {}).get("thumbnail"),
            "smallThumbnail": (volume_info.get("imageLinks") or {}).get("smallThumbnail"),
        },
        "publisher": volume_info.get("publisher"),
        "infoLink": volume_info.get("infoLink"),
        "previewLink": volume_info.get("previewLink"),
        "descriptionSnippet": (volume_info.get("description") or "")[:280],
    }


def has_books_api_key(books_client: Any) -> bool:
    # Custom test doubles may not expose api_key; only enforce for clients that do.
    if not hasattr(books_client, "api_key"):
        return True
    value = getattr(books_client, "api_key")
    if value is None:
        return False
    return bool(str(value).strip())


def missing_api_key_message() -> str:
    return "Google Books API key is not configured. Set GOOGLE_BOOKS_API_KEY in secrets/.env."


class GoogleBooksService:
    """Lazy Google Books client lifecycle for route handlers."""

    def __init__(self, books_client_factory: Callable[[], GoogleBooksClient]) -> None:
        self._books_client_factory = books_client_factory
        self._books_client: GoogleBooksClient | None = None

    def get_client(self) -> GoogleBooksClient:
        if self._books_client is None:
            self._books_client = self._books_client_factory()
        return self._books_client


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
