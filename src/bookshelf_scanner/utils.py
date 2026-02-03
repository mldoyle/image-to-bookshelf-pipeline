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


def get_device() -> str:
    """Return the best available torch device."""
    import torch

    if torch.cuda.is_available():
        return "cuda"
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    return "cpu"
