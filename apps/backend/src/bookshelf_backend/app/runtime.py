"""Shared runtime state for route handlers."""

from __future__ import annotations

from dataclasses import dataclass

from flask import Flask, current_app

from ..services import DetectorService, ExtractorService, GoogleBooksService


RUNTIME_KEY = "bookshelf_backend_runtime"


@dataclass
class RuntimeState:
    detector: DetectorService
    extractor: ExtractorService
    books: GoogleBooksService
    request_count: int = 0

    def next_request_id(self) -> int:
        self.request_count += 1
        return self.request_count


def set_runtime_state(app: Flask, state: RuntimeState) -> None:
    app.extensions[RUNTIME_KEY] = state


def get_runtime_state() -> RuntimeState:
    runtime = current_app.extensions.get(RUNTIME_KEY)
    if runtime is None:
        raise RuntimeError("Application runtime state is not initialized.")
    return runtime
