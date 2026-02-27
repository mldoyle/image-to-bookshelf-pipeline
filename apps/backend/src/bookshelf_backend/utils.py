"""Utility helpers for the bookshelf scanner."""

from pathlib import Path
from PIL import Image


def load_image(path: str | Path) -> Image.Image:
    """Load an image file and return a PIL Image in RGB mode."""
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Image not found: {path}")
    image = Image.open(path)
    if image.mode != "RGB":
        image = image.convert("RGB")
    return image

