"""Pydantic data models for the bookshelf scanner pipeline."""

from pydantic import BaseModel, Field


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
