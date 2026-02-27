"""Extractor service wiring for lazy-initialized extraction backend."""

from __future__ import annotations

from typing import Callable

from ..extractor import BookExtractor


class ExtractorService:
    """Lazy extractor lifecycle for route handlers."""

    def __init__(self, extractor_factory: Callable[[], BookExtractor]) -> None:
        self._extractor_factory = extractor_factory
        self._extractor: BookExtractor | None = None

    def get_extractor(self) -> BookExtractor:
        if self._extractor is None:
            self._extractor = self._extractor_factory()
        return self._extractor


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
