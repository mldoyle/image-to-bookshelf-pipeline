"""Pydantic data models for the bookshelf scanner pipeline."""

from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class SpineExtraction(BaseModel):
    """Structured text extracted from a single book spine image."""

    title: str = Field(..., min_length=1, max_length=500)
    author: Optional[str] = Field(default=None, max_length=200)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    raw_response: str | None = None

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("title cannot be empty")
        return cleaned

    @field_validator("author")
    @classmethod
    def clean_author(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = " ".join(value.split())
        return cleaned or None


class SpineExtractionResult(BaseModel):
    """Extraction payload tied to an individual segmented spine image."""

    spine_index: int = Field(ge=0)
    image_path: Path
    extraction: SpineExtraction


class DetectedSpine(BaseModel):
    """A detected book spine with bounding box metadata."""

    bbox: tuple[int, int, int, int]
    confidence: float = Field(ge=0.0, le=1.0)
    index: int

    @property
    def width(self) -> int:
        return self.bbox[2] - self.bbox[0]

    @property
    def height(self) -> int:
        return self.bbox[3] - self.bbox[1]

    @property
    def area(self) -> int:
        return self.width * self.height
