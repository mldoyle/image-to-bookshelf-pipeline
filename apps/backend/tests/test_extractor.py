"""Tests for text extraction stage and parser fallbacks."""

from pathlib import Path

from PIL import Image

from bookshelf_backend.extractor import BookExtractor


class FakeBackend:
    """Minimal backend stub for extractor tests."""

    def __init__(self, answer: str, confidence: float = 0.0) -> None:
        self.answer = answer
        self.confidence = confidence

    def extract(self, spine_image: Image.Image) -> dict:
        return {"answer": self.answer, "confidence": self.confidence}


def _blank_spine() -> Image.Image:
    return Image.new("RGB", (60, 220), color="white")


def test_extract_parses_clean_json():
    backend = FakeBackend('{"title":"Dune","author":"Frank Herbert"}', confidence=0.91)
    extractor = BookExtractor(backend=backend)

    result = extractor.extract(_blank_spine())
    assert result.title == "Dune"
    assert result.author == "Frank Herbert"
    assert result.confidence == 0.91


def test_extract_parses_json_code_block():
    backend = FakeBackend('```json\n{"title":"Hyperion","author":null}\n```')
    extractor = BookExtractor(backend=backend)

    result = extractor.extract(_blank_spine())
    assert result.title == "Hyperion"
    assert result.author is None


def test_extract_falls_back_to_first_line():
    backend = FakeBackend("The Left Hand of Darkness\nby Ursula K. Le Guin")
    extractor = BookExtractor(backend=backend)

    result = extractor.extract(_blank_spine())
    assert result.title == "The Left Hand of Darkness"
    assert result.author is None


def test_extract_from_paths_returns_indexed_results(tmp_path: Path):
    image_paths = []
    for i in range(2):
        path = tmp_path / f"spine_{i:02d}.jpg"
        _blank_spine().save(path)
        image_paths.append(path)

    backend = FakeBackend('{"title":"Snow Crash","author":"Neal Stephenson"}')
    extractor = BookExtractor(backend=backend)
    results = extractor.extract_from_paths(image_paths)

    assert len(results) == 2
    assert results[0].spine_index == 0
    assert results[1].spine_index == 1
    assert results[0].image_path == image_paths[0]
    assert results[0].extraction.title == "Snow Crash"
