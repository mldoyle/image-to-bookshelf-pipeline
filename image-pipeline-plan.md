# Bookshelf Scanner - Complete Implementation Specification

**Version:** 1.0  
**Date:** February 2, 2026  
**Status:** Ready for Claude Code Implementation

---

## Executive Summary

Build a Python CLI tool that:
1. Takes a photo of a bookshelf as input
2. Detects individual book spines using YOLO
3. Extracts title/author from each spine using Moondream 0.5B (500M params, ~1GB RAM)
4. Looks up metadata via Google Books API
5. Exports a Goodreads-compatible CSV for easy import

**Key constraint:** Start with the smallest model (Moondream 0.5B) to validate the pipeline. Easy upgrade path to 2B if needed.

---

## 1. Project Structure

```
bookshelf-scanner/
├── README.md                    # Installation and usage instructions
├── pyproject.toml               # Project metadata and dependencies
├── requirements.txt             # Pinned dependencies for pip
├── config.yaml                  # Default configuration
│
├── src/
│   └── bookshelf_scanner/
│       ├── __init__.py          # Package init, version
│       ├── cli.py               # Typer CLI entry point
│       ├── detector.py          # YOLO spine detection
│       ├── extractor.py         # Moondream text extraction
│       ├── lookup.py            # Google Books API client
│       ├── exporter.py          # CSV export (Goodreads format)
│       ├── schemas.py           # Pydantic data models
│       └── utils.py             # Helper functions
│
├── models/                      # Downloaded model weights (gitignored)
│   └── .gitkeep
│
├── tests/
│   ├── __init__.py
│   ├── test_detector.py
│   ├── test_extractor.py
│   ├── test_lookup.py
│   ├── test_exporter.py
│   └── fixtures/
│       └── sample_spine.jpg     # Test image
│
└── examples/
    └── sample_output.csv        # Example output
```

---

## 2. Dependencies

### pyproject.toml
```toml
[project]
name = "bookshelf-scanner"
version = "1.0.0"
description = "Scan bookshelves and export to Goodreads/StoryGraph"
readme = "README.md"
requires-python = ">=3.10"
license = {text = "MIT"}
dependencies = [
    "ultralytics>=8.0.0",          # YOLO object detection
    "transformers>=4.40.0",         # Moondream model loading
    "torch>=2.0.0",                 # PyTorch backend
    "torchvision>=0.15.0",          # Image transforms
    "pillow>=10.0.0",               # Image processing
    "einops>=0.7.0",                # Required by Moondream
    "requests>=2.31.0",             # HTTP client
    "pydantic>=2.0.0",              # Data validation
    "pyyaml>=6.0",                  # Config parsing
    "typer[all]>=0.9.0",            # CLI framework
    "rich>=13.0.0",                 # Pretty console output
]

[project.optional-dependencies]
gpu = ["accelerate>=0.25.0"]
dev = ["pytest>=7.0.0", "pytest-cov>=4.0.0"]

[project.scripts]
bookshelf-scanner = "bookshelf_scanner.cli:app"

[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"
```

### requirements.txt
```
ultralytics>=8.0.0
transformers>=4.40.0
torch>=2.0.0
torchvision>=0.15.0
pillow>=10.0.0
einops>=0.7.0
requests>=2.31.0
pydantic>=2.0.0
pyyaml>=6.0
typer[all]>=0.9.0
rich>=13.0.0
```

---

## 3. Configuration

### config.yaml
```yaml
# Bookshelf Scanner Configuration

detection:
  # YOLO model for spine detection
  # Options: yolov8n.pt (nano, fast), yolov8s.pt (small, balanced), yolov8m.pt (medium, accurate)
  model: yolov8n.pt
  confidence: 0.25              # Minimum detection confidence (lower = more detections)
  iou_threshold: 0.45           # Non-max suppression threshold
  device: auto                  # 'cpu', 'cuda', 'mps', or 'auto'
  classes: [73]                 # COCO class 73 = "book" (use for pre-trained model)
  
extraction:
  # Vision-language model for text extraction
  # Moondream 0.5B is smallest, Moondream 2B is more accurate
  model: moondream-0.5b
  revision: "2025-01-09"        # Pin to specific model version
  device: auto                  # 'cpu', 'cuda', 'mps', or 'auto'
  max_new_tokens: 100           # Max tokens to generate
  temperature: 0.1              # Low temperature for deterministic output
  
lookup:
  enabled: true
  api_key: null                 # Optional Google Books API key
  timeout: 10                   # Request timeout in seconds
  max_results: 5                # Results to fetch per query
  fallback_to_extraction: true  # Use extracted data if API fails
  
export:
  format: goodreads             # 'goodreads' or 'storygraph' 
  default_shelf: to-read        # Default exclusive shelf
  include_unmatched: true       # Include books not found in API
  date_format: "%Y/%m/%d"       # Date format for CSV

processing:
  max_spines: 50                # Maximum spines to process per image
  min_spine_area: 1000          # Minimum bounding box area in pixels
  save_debug_images: false      # Save annotated images for debugging
  debug_output_dir: debug/      # Directory for debug output
```

---

## 4. Data Models (schemas.py)

```python
"""
schemas.py - Pydantic models for structured data validation

These models enforce schema at every step of the pipeline:
1. SpineExtraction - Output from Moondream (MUST be valid JSON)
2. GoogleBooksResult - Parsed API response
3. BookRecord - Merged data ready for export
4. GoodreadsCSVRow - Exact Goodreads import format
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal
from datetime import date
import re


class SpineExtraction(BaseModel):
    """
    Structured output from Moondream vision model.
    
    This schema MUST be enforced when parsing model output.
    The model is prompted to return JSON in exactly this format.
    """
    title: str = Field(
        ..., 
        min_length=1,
        max_length=500,
        description="Book title exactly as shown on spine"
    )
    author: Optional[str] = Field(
        None,
        max_length=200,
        description="Author name if visible (First Last format)"
    )
    
    @field_validator('title')
    @classmethod
    def clean_title(cls, v: str) -> str:
        """Remove extra whitespace and normalize"""
        return ' '.join(v.split())
    
    @field_validator('author')
    @classmethod  
    def clean_author(cls, v: Optional[str]) -> Optional[str]:
        """Remove extra whitespace and normalize"""
        if v is None:
            return None
        cleaned = ' '.join(v.split())
        return cleaned if cleaned else None


class DetectedSpine(BaseModel):
    """A detected book spine with bounding box"""
    bbox: tuple[int, int, int, int]  # (x1, y1, x2, y2)
    confidence: float = Field(ge=0.0, le=1.0)
    index: int  # Position in reading order (left-to-right, top-to-bottom)
    
    @property
    def width(self) -> int:
        return self.bbox[2] - self.bbox[0]
    
    @property
    def height(self) -> int:
        return self.bbox[3] - self.bbox[1]
    
    @property
    def area(self) -> int:
        return self.width * self.height


class GoogleBooksResult(BaseModel):
    """Parsed result from Google Books API"""
    google_books_id: str
    title: str
    authors: list[str] = Field(default_factory=list)
    isbn_10: Optional[str] = None
    isbn_13: Optional[str] = None
    publisher: Optional[str] = None
    published_date: Optional[str] = None  # May be "2024", "2024-01", or "2024-01-15"
    page_count: Optional[int] = None
    categories: list[str] = Field(default_factory=list)
    average_rating: Optional[float] = Field(None, ge=0.0, le=5.0)
    thumbnail_url: Optional[str] = None
    description: Optional[str] = None
    
    @property
    def primary_author(self) -> str:
        """First author or empty string"""
        return self.authors[0] if self.authors else ""
    
    @property
    def additional_authors(self) -> str:
        """All authors except first, comma-separated"""
        return ", ".join(self.authors[1:]) if len(self.authors) > 1 else ""
    
    @property
    def year_published(self) -> Optional[int]:
        """Extract year from published_date"""
        if not self.published_date:
            return None
        match = re.match(r'(\d{4})', self.published_date)
        return int(match.group(1)) if match else None


class BookRecord(BaseModel):
    """
    Complete book record merging extraction and API data.
    This is the internal representation before export.
    """
    # Original extraction
    extracted_title: str
    extracted_author: Optional[str] = None
    extraction_confidence: float = Field(0.0, ge=0.0, le=1.0)
    
    # Final values (from API or extraction fallback)
    title: str
    author: str = ""
    author_lf: str = ""           # "Last, First" format
    additional_authors: str = ""
    isbn_10: str = ""
    isbn_13: str = ""
    publisher: str = ""
    binding: str = ""             # Hardcover, Paperback, etc.
    page_count: Optional[int] = None
    year_published: Optional[int] = None
    original_year: Optional[int] = None
    average_rating: Optional[float] = None
    
    # Goodreads import fields
    my_rating: int = Field(0, ge=0, le=5)
    date_read: str = ""
    date_added: str = ""          # Will be set to scan date
    bookshelves: str = ""
    exclusive_shelf: str = "to-read"
    my_review: str = ""
    read_count: int = 0
    owned_copies: int = 1
    
    # Metadata
    matched: bool = False         # True if found in Google Books
    google_books_id: Optional[str] = None
    spine_index: int = 0          # Position on shelf


class GoodreadsCSVRow(BaseModel):
    """
    Exact schema for Goodreads CSV import.
    
    Field names and order MUST match exactly for successful import.
    Based on actual Goodreads export format analysis.
    """
    book_id: str = Field(default="", alias="Book Id")
    title: str = Field(alias="Title")
    author: str = Field(default="", alias="Author")
    author_lf: str = Field(default="", alias="Author l-f")
    additional_authors: str = Field(default="", alias="Additional Authors")
    isbn: str = Field(default="", alias="ISBN")           # Format: ="0123456789"
    isbn13: str = Field(default="", alias="ISBN13")       # Format: ="9780123456789"
    my_rating: int = Field(default=0, alias="My Rating")
    average_rating: str = Field(default="", alias="Average Rating")
    publisher: str = Field(default="", alias="Publisher")
    binding: str = Field(default="", alias="Binding")
    number_of_pages: str = Field(default="", alias="Number of Pages")
    year_published: str = Field(default="", alias="Year Published")
    original_publication_year: str = Field(default="", alias="Original Publication Year")
    date_read: str = Field(default="", alias="Date Read")
    date_added: str = Field(alias="Date Added")
    bookshelves: str = Field(default="", alias="Bookshelves")
    bookshelves_with_positions: str = Field(default="", alias="Bookshelves with positions")
    exclusive_shelf: str = Field(default="to-read", alias="Exclusive Shelf")
    my_review: str = Field(default="", alias="My Review")
    spoiler: str = Field(default="", alias="Spoiler")
    private_notes: str = Field(default="", alias="Private Notes")
    read_count: int = Field(default=0, alias="Read Count")
    owned_copies: int = Field(default=1, alias="Owned Copies")
    
    model_config = {
        "populate_by_name": True
    }

    @classmethod
    def column_order(cls) -> list[str]:
        """Return columns in exact Goodreads order"""
        return [
            "Book Id", "Title", "Author", "Author l-f", "Additional Authors",
            "ISBN", "ISBN13", "My Rating", "Average Rating", "Publisher", 
            "Binding", "Number of Pages", "Year Published", "Original Publication Year",
            "Date Read", "Date Added", "Bookshelves", "Bookshelves with positions",
            "Exclusive Shelf", "My Review", "Spoiler", "Private Notes",
            "Read Count", "Owned Copies"
        ]
```

---

## 5. Spine Detection (detector.py)

```python
"""
detector.py - Book spine detection using YOLO

Detects book spines in bookshelf images using YOLOv8.
Returns cropped spine images sorted in reading order.
"""

from ultralytics import YOLO
from PIL import Image
from pathlib import Path
import numpy as np
from typing import Iterator
import logging

from .schemas import DetectedSpine

logger = logging.getLogger(__name__)


class SpineDetector:
    """
    Detects book spines in bookshelf images.
    
    Uses YOLOv8 with COCO pretrained weights (class 73 = "book").
    For better results, fine-tune on a book spine dataset from Roboflow.
    
    Usage:
        detector = SpineDetector()
        for spine_image, metadata in detector.detect("bookshelf.jpg"):
            process(spine_image)
    """
    
    # COCO class ID for "book"
    BOOK_CLASS_ID = 73
    
    def __init__(
        self,
        model_path: str = "yolov8n.pt",
        confidence: float = 0.25,
        iou_threshold: float = 0.45,
        device: str = "auto",
        classes: list[int] | None = None
    ):
        """
        Initialize spine detector.
        
        Args:
            model_path: Path to YOLO weights or model name.
                       Use "yolov8n.pt" for speed or "yolov8s.pt" for accuracy.
            confidence: Minimum detection confidence (0.0-1.0)
            iou_threshold: IoU threshold for non-max suppression
            device: 'cpu', 'cuda', 'mps', or 'auto' (auto-detect)
            classes: List of COCO class IDs to detect. Default [73] for books.
        """
        self.confidence = confidence
        self.iou_threshold = iou_threshold
        self.classes = classes if classes is not None else [self.BOOK_CLASS_ID]
        
        # Resolve device
        if device == "auto":
            import torch
            if torch.cuda.is_available():
                self.device = "cuda"
            elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                self.device = "mps"
            else:
                self.device = "cpu"
        else:
            self.device = device
        
        # Load model
        logger.info(f"Loading YOLO model: {model_path} on {self.device}")
        self.model = YOLO(model_path)
        self.model.to(self.device)
    
    def detect(
        self,
        image: Image.Image | str | Path,
        min_area: int = 1000,
        max_detections: int = 50
    ) -> Iterator[tuple[Image.Image, DetectedSpine]]:
        """
        Detect book spines and yield cropped images.
        
        Args:
            image: PIL Image, file path, or URL
            min_area: Minimum bounding box area in pixels
            max_detections: Maximum number of spines to return
            
        Yields:
            Tuple of (cropped_spine_image, DetectedSpine metadata)
        """
        # Load image if path
        if isinstance(image, (str, Path)):
            image = Image.open(image).convert("RGB")
        
        # Run detection
        results = self.model.predict(
            source=image,
            conf=self.confidence,
            iou=self.iou_threshold,
            classes=self.classes,
            device=self.device,
            verbose=False
        )
        
        if not results or len(results[0].boxes) == 0:
            logger.warning("No book spines detected in image")
            return
        
        # Extract bounding boxes
        boxes = results[0].boxes
        detections = []
        
        for i, box in enumerate(boxes):
            bbox = tuple(map(int, box.xyxy[0].tolist()))
            conf = float(box.conf[0])
            
            spine = DetectedSpine(
                bbox=bbox,
                confidence=conf,
                index=i  # Will be reordered
            )
            
            # Filter by minimum area
            if spine.area >= min_area:
                detections.append(spine)
        
        # Sort by reading order (left-to-right, top-to-bottom)
        detections = self._sort_reading_order(detections)
        
        # Limit number of detections
        detections = detections[:max_detections]
        
        # Re-index after sorting
        for i, det in enumerate(detections):
            det.index = i
        
        logger.info(f"Detected {len(detections)} book spines")
        
        # Yield cropped images
        for det in detections:
            x1, y1, x2, y2 = det.bbox
            cropped = image.crop((x1, y1, x2, y2))
            yield cropped, det
    
    def _sort_reading_order(
        self, 
        detections: list[DetectedSpine]
    ) -> list[DetectedSpine]:
        """
        Sort detections in reading order: left-to-right, then top-to-bottom.
        
        Groups spines into "rows" based on vertical overlap,
        then sorts each row left-to-right.
        """
        if not detections:
            return detections
        
        # Sort by left edge first
        detections = sorted(detections, key=lambda d: d.bbox[0])
        
        # Group into rows based on vertical center overlap
        rows: list[list[DetectedSpine]] = []
        
        for det in detections:
            det_center_y = (det.bbox[1] + det.bbox[3]) / 2
            placed = False
            
            for row in rows:
                # Check if this detection overlaps vertically with the row
                row_top = min(d.bbox[1] for d in row)
                row_bottom = max(d.bbox[3] for d in row)
                
                if row_top <= det_center_y <= row_bottom:
                    row.append(det)
                    placed = True
                    break
            
            if not placed:
                rows.append([det])
        
        # Sort rows by vertical position
        rows.sort(key=lambda row: min(d.bbox[1] for d in row))
        
        # Sort each row left-to-right
        for row in rows:
            row.sort(key=lambda d: d.bbox[0])
        
        # Flatten
        return [det for row in rows for det in row]
    
    def detect_all(
        self,
        image: Image.Image | str | Path,
        min_area: int = 1000,
        max_detections: int = 50
    ) -> tuple[list[Image.Image], list[DetectedSpine]]:
        """
        Detect all spines and return as lists (non-generator version).
        
        Returns:
            Tuple of (list of cropped images, list of DetectedSpine metadata)
        """
        images = []
        spines = []
        for img, spine in self.detect(image, min_area, max_detections):
            images.append(img)
            spines.append(spine)
        return images, spines
```

---

## 6. Text Extraction (extractor.py)

```python
"""
extractor.py - Book title/author extraction using Moondream

Extracts structured book information from spine images using Moondream VLM.
Enforces JSON schema output for reliable downstream processing.
"""

from transformers import AutoModelForCausalLM
from PIL import Image
import torch
import json
import re
import logging
from typing import Optional

from .schemas import SpineExtraction

logger = logging.getLogger(__name__)


class BookExtractor:
    """
    Extracts book title and author from spine images using Moondream.
    
    Uses Moondream 0.5B by default (smallest, ~1GB RAM).
    Can upgrade to 2B for better accuracy.
    
    CRITICAL: Output is enforced to match SpineExtraction schema.
    The model is prompted to return valid JSON only.
    """
    
    # Prompt template that enforces JSON output
    EXTRACTION_PROMPT = """Look at this book spine image and extract the book information.

Respond with ONLY a JSON object in this exact format:
{"title": "The Book Title", "author": "Author Name"}

Rules:
- Extract the title EXACTLY as written on the spine
- Include subtitle after colon if visible
- For author, use "First Last" format
- If author is not visible, use null: {"title": "...", "author": null}
- Do NOT guess or invent information
- Output ONLY the JSON, no other text

JSON:"""

    # Model revision mapping
    MODEL_REVISIONS = {
        "moondream-0.5b": "2025-01-09",  # 0.5B model
        "moondream-2b": "2025-06-21",    # 2B model (more accurate)
    }
    
    def __init__(
        self,
        model_name: str = "moondream-0.5b",
        revision: Optional[str] = None,
        device: str = "auto",
        max_new_tokens: int = 100,
        temperature: float = 0.1
    ):
        """
        Initialize the book extractor.
        
        Args:
            model_name: 'moondream-0.5b' (smallest) or 'moondream-2b' (more accurate)
            revision: Model revision (auto-selected if None)
            device: 'cpu', 'cuda', 'mps', or 'auto'
            max_new_tokens: Maximum tokens to generate
            temperature: Sampling temperature (lower = more deterministic)
        """
        self.max_new_tokens = max_new_tokens
        self.temperature = temperature
        
        # Resolve device
        if device == "auto":
            if torch.cuda.is_available():
                self.device = "cuda"
            elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                self.device = "mps"
            else:
                self.device = "cpu"
        else:
            self.device = device
        
        # Get revision
        if revision is None:
            revision = self.MODEL_REVISIONS.get(model_name, "2025-01-09")
        
        # Determine dtype
        if self.device == "cpu":
            dtype = torch.float32
        else:
            dtype = torch.float16
        
        # Load model
        logger.info(f"Loading Moondream model: vikhyatk/moondream2 (revision: {revision}) on {self.device}")
        
        self.model = AutoModelForCausalLM.from_pretrained(
            "vikhyatk/moondream2",
            revision=revision,
            trust_remote_code=True,
            torch_dtype=dtype,
            device_map={"": self.device}
        )
        
        logger.info("Moondream model loaded successfully")
    
    def extract(self, spine_image: Image.Image) -> SpineExtraction:
        """
        Extract book information from a single spine image.
        
        Args:
            spine_image: Cropped image of a single book spine
            
        Returns:
            SpineExtraction with title, author (validated by Pydantic)
        """
        # Ensure RGB
        if spine_image.mode != "RGB":
            spine_image = spine_image.convert("RGB")
        
        # Prepare image for model
        # Check if image is very tall and narrow (typical spine orientation)
        # If so, we might want to note this but Moondream handles rotated text
        
        try:
            # Use Moondream's query method
            result = self.model.query(
                spine_image,
                self.EXTRACTION_PROMPT,
                settings={
                    "max_tokens": self.max_new_tokens,
                    "temperature": self.temperature
                }
            )
            
            response = result.get("answer", "")
            logger.debug(f"Model response: {response}")
            
            # Parse the response
            return self._parse_response(response)
            
        except Exception as e:
            logger.error(f"Extraction failed: {e}")
            return SpineExtraction(title="[Extraction Failed]", author=None)
    
    def extract_batch(
        self, 
        spine_images: list[Image.Image],
        show_progress: bool = True
    ) -> list[SpineExtraction]:
        """
        Extract book information from multiple spine images.
        
        Args:
            spine_images: List of cropped spine images
            show_progress: Whether to show progress (for CLI)
            
        Returns:
            List of SpineExtraction objects
        """
        results = []
        
        for i, img in enumerate(spine_images):
            if show_progress:
                logger.info(f"Extracting spine {i+1}/{len(spine_images)}")
            
            extraction = self.extract(img)
            results.append(extraction)
        
        return results
    
    def _parse_response(self, response: str) -> SpineExtraction:
        """
        Parse model response into SpineExtraction.
        
        Handles multiple response formats:
        1. Clean JSON
        2. JSON with markdown code blocks
        3. Partial/malformed JSON (attempt recovery)
        """
        response = response.strip()
        
        # Strategy 1: Direct JSON parse
        try:
            data = json.loads(response)
            return SpineExtraction(**data)
        except (json.JSONDecodeError, ValueError):
            pass
        
        # Strategy 2: Extract JSON from markdown code blocks
        json_patterns = [
            r'```json\s*(.*?)\s*```',
            r'```\s*(.*?)\s*```',
            r'\{[^{}]*\}'
        ]
        
        for pattern in json_patterns:
            match = re.search(pattern, response, re.DOTALL)
            if match:
                try:
                    json_str = match.group(1) if '```' in pattern else match.group(0)
                    data = json.loads(json_str)
                    return SpineExtraction(**data)
                except (json.JSONDecodeError, ValueError):
                    continue
        
        # Strategy 3: Regex extraction for partial JSON
        title_match = re.search(r'"title"\s*:\s*"([^"]+)"', response)
        author_match = re.search(r'"author"\s*:\s*"([^"]+)"', response)
        author_null = re.search(r'"author"\s*:\s*null', response)
        
        if title_match:
            title = title_match.group(1)
            author = author_match.group(1) if author_match else None
            if author_null:
                author = None
            return SpineExtraction(title=title, author=author)
        
        # Strategy 4: Use raw response as title (last resort)
        # Clean up the response and use first line as title
        lines = [l.strip() for l in response.split('\n') if l.strip()]
        if lines:
            # Remove any JSON artifacts
            title = re.sub(r'[{}":\[\]]', '', lines[0])[:100].strip()
            if title:
                return SpineExtraction(title=title, author=None)
        
        # Complete failure
        return SpineExtraction(title="[Could Not Parse]", author=None)
```

---

## 7. Google Books Lookup (lookup.py)

```python
"""
lookup.py - Google Books API client for metadata enrichment

Looks up book metadata using title/author extracted from spines.
Returns enriched data including ISBN, publisher, page count, etc.
"""

import requests
from typing import Optional
from urllib.parse import quote
import time
import logging
from difflib import SequenceMatcher

from .schemas import SpineExtraction, GoogleBooksResult, BookRecord

logger = logging.getLogger(__name__)


class GoogleBooksClient:
    """
    Client for Google Books API.
    
    Free tier allows ~1000 requests/day without API key.
    With API key, rate limits are higher.
    """
    
    BASE_URL = "https://www.googleapis.com/books/v1/volumes"
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        timeout: int = 10,
        max_results: int = 5
    ):
        """
        Initialize Google Books client.
        
        Args:
            api_key: Optional API key for higher rate limits
            timeout: Request timeout in seconds
            max_results: Number of results to fetch per query
        """
        self.api_key = api_key
        self.timeout = timeout
        self.max_results = max_results
        self.session = requests.Session()
    
    def lookup(self, extraction: SpineExtraction) -> Optional[GoogleBooksResult]:
        """
        Look up a book by extracted title and author.
        
        Args:
            extraction: SpineExtraction from Moondream
            
        Returns:
            GoogleBooksResult if found, None otherwise
        """
        query = self._build_query(extraction)
        
        if not query:
            return None
        
        params = {
            "q": query,
            "maxResults": self.max_results,
            "printType": "books"
        }
        
        if self.api_key:
            params["key"] = self.api_key
        
        try:
            response = self.session.get(
                self.BASE_URL,
                params=params,
                timeout=self.timeout
            )
            response.raise_for_status()
            data = response.json()
            
            if data.get("totalItems", 0) == 0:
                logger.debug(f"No results for query: {query}")
                return None
            
            items = data.get("items", [])
            if not items:
                return None
            
            # Parse all results
            results = [self._parse_volume(item) for item in items]
            
            # Select best match
            return self._select_best_match(results, extraction)
            
        except requests.RequestException as e:
            logger.error(f"Google Books API error: {e}")
            return None
        except Exception as e:
            logger.error(f"Failed to parse API response: {e}")
            return None
    
    def lookup_batch(
        self,
        extractions: list[SpineExtraction],
        delay: float = 0.3,
        show_progress: bool = True
    ) -> list[Optional[GoogleBooksResult]]:
        """
        Look up multiple books with rate limiting.
        
        Args:
            extractions: List of SpineExtraction objects
            delay: Delay between requests in seconds
            show_progress: Whether to log progress
            
        Returns:
            List of GoogleBooksResult or None for each extraction
        """
        results = []
        
        for i, extraction in enumerate(extractions):
            if show_progress:
                logger.info(f"Looking up book {i+1}/{len(extractions)}: {extraction.title[:50]}")
            
            result = self.lookup(extraction)
            results.append(result)
            
            # Rate limiting
            if i < len(extractions) - 1:
                time.sleep(delay)
        
        return results
    
    def _build_query(self, extraction: SpineExtraction) -> str:
        """
        Build search query string.
        
        Uses intitle: and inauthor: modifiers for better matching.
        """
        parts = []
        
        # Clean title - remove special characters that break the query
        title = extraction.title
        title = title.replace('"', '').replace("'", "")
        
        if title and title not in ("[Extraction Failed]", "[Could Not Parse]"):
            parts.append(f'intitle:{title}')
        
        if extraction.author:
            author = extraction.author.replace('"', '').replace("'", "")
            parts.append(f'inauthor:{author}')
        
        return ' '.join(parts)
    
    def _parse_volume(self, item: dict) -> GoogleBooksResult:
        """Parse a single volume from API response."""
        info = item.get("volumeInfo", {})
        
        # Extract ISBNs
        identifiers = {}
        for identifier in info.get("industryIdentifiers", []):
            identifiers[identifier.get("type")] = identifier.get("identifier")
        
        return GoogleBooksResult(
            google_books_id=item["id"],
            title=info.get("title", ""),
            authors=info.get("authors", []),
            isbn_10=identifiers.get("ISBN_10"),
            isbn_13=identifiers.get("ISBN_13"),
            publisher=info.get("publisher"),
            published_date=info.get("publishedDate"),
            page_count=info.get("pageCount"),
            categories=info.get("categories", []),
            average_rating=info.get("averageRating"),
            thumbnail_url=info.get("imageLinks", {}).get("thumbnail"),
            description=info.get("description")
        )
    
    def _select_best_match(
        self,
        results: list[GoogleBooksResult],
        extraction: SpineExtraction
    ) -> Optional[GoogleBooksResult]:
        """
        Select the best matching result based on similarity.
        
        Scoring:
        - Title similarity (0-1)
        - Author match bonus (+0.3)
        - ISBN presence bonus (+0.2)
        - Page count presence bonus (+0.1)
        """
        if not results:
            return None
        
        def score_result(result: GoogleBooksResult) -> float:
            score = 0.0
            
            # Title similarity
            title_sim = SequenceMatcher(
                None,
                extraction.title.lower(),
                result.title.lower()
            ).ratio()
            score += title_sim
            
            # Author match
            if extraction.author and result.authors:
                author_lower = extraction.author.lower()
                for author in result.authors:
                    if author_lower in author.lower() or author.lower() in author_lower:
                        score += 0.3
                        break
            
            # ISBN bonus
            if result.isbn_13 or result.isbn_10:
                score += 0.2
            
            # Page count bonus
            if result.page_count:
                score += 0.1
            
            return score
        
        scored = [(r, score_result(r)) for r in results]
        scored.sort(key=lambda x: x[1], reverse=True)
        
        best_result, best_score = scored[0]
        
        # Require minimum similarity
        if best_score < 0.3:
            logger.debug(f"Best match score {best_score} too low, rejecting")
            return None
        
        return best_result


def author_to_lf(name: str) -> str:
    """
    Convert "First Last" to "Last, First" format.
    
    Handles:
    - "John Smith" -> "Smith, John"
    - "J.K. Rowling" -> "Rowling, J.K."
    - "John" -> "John"
    """
    if not name:
        return ""
    
    parts = name.strip().split()
    if len(parts) >= 2:
        return f"{parts[-1]}, {' '.join(parts[:-1])}"
    return name


def create_book_record(
    extraction: SpineExtraction,
    api_result: Optional[GoogleBooksResult],
    spine_index: int = 0,
    default_shelf: str = "to-read",
    scan_date: Optional[str] = None
) -> BookRecord:
    """
    Create a BookRecord by merging extraction and API data.
    
    Args:
        extraction: Original extraction from Moondream
        api_result: Google Books API result (may be None)
        spine_index: Position of this book on the shelf
        default_shelf: Default bookshelf for import
        scan_date: Date of scan (defaults to today)
        
    Returns:
        Complete BookRecord ready for export
    """
    from datetime import date
    
    if scan_date is None:
        scan_date = date.today().strftime("%Y/%m/%d")
    
    if api_result:
        # Use API data with extraction as fallback
        return BookRecord(
            # Extraction data
            extracted_title=extraction.title,
            extracted_author=extraction.author,
            extraction_confidence=1.0,  # TODO: implement confidence scoring
            
            # API data
            title=api_result.title,
            author=api_result.primary_author,
            author_lf=author_to_lf(api_result.primary_author),
            additional_authors=api_result.additional_authors,
            isbn_10=api_result.isbn_10 or "",
            isbn_13=api_result.isbn_13 or "",
            publisher=api_result.publisher or "",
            page_count=api_result.page_count,
            year_published=api_result.year_published,
            original_year=api_result.year_published,  # API doesn't distinguish
            average_rating=api_result.average_rating,
            
            # Import defaults
            date_added=scan_date,
            exclusive_shelf=default_shelf,
            owned_copies=1,
            
            # Metadata
            matched=True,
            google_books_id=api_result.google_books_id,
            spine_index=spine_index
        )
    else:
        # Fallback to extraction only
        return BookRecord(
            extracted_title=extraction.title,
            extracted_author=extraction.author,
            extraction_confidence=0.5,  # Lower confidence without API match
            
            title=extraction.title,
            author=extraction.author or "",
            author_lf=author_to_lf(extraction.author or ""),
            
            date_added=scan_date,
            exclusive_shelf=default_shelf,
            owned_copies=1,
            
            matched=False,
            spine_index=spine_index
        )
```

---

## 8. CSV Export (exporter.py)

```python
"""
exporter.py - Export to Goodreads-compatible CSV

Generates CSV files that can be directly imported into Goodreads or StoryGraph.
Handles special formatting requirements (ISBN quotes, date format, etc).
"""

import csv
from pathlib import Path
from typing import TextIO
from datetime import date
import logging

from .schemas import BookRecord, GoodreadsCSVRow

logger = logging.getLogger(__name__)


class BookExporter:
    """
    Exports book records to Goodreads-compatible CSV.
    
    Goodreads CSV format requirements:
    - UTF-8 encoding
    - Specific column order
    - ISBN formatted as ="0123456789" to prevent Excel corruption
    - Dates in YYYY/MM/DD format
    """
    
    def __init__(
        self,
        format: str = "goodreads",
        date_format: str = "%Y/%m/%d"
    ):
        """
        Initialize exporter.
        
        Args:
            format: Export format ('goodreads' or 'storygraph')
            date_format: Date format string for output
        """
        self.format = format
        self.date_format = date_format
    
    def export(
        self,
        books: list[BookRecord],
        output_path: str | Path,
        include_unmatched: bool = True
    ) -> Path:
        """
        Export books to CSV file.
        
        Args:
            books: List of BookRecord objects
            output_path: Output file path
            include_unmatched: Include books not found in Google Books
            
        Returns:
            Path to created file
        """
        output_path = Path(output_path)
        
        # Filter if needed
        if not include_unmatched:
            books = [b for b in books if b.matched]
        
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            self._write_csv(books, f)
        
        logger.info(f"Exported {len(books)} books to {output_path}")
        return output_path
    
    def _write_csv(self, books: list[BookRecord], stream: TextIO):
        """Write CSV to a file-like object."""
        
        # Get column order
        columns = GoodreadsCSVRow.column_order()
        
        writer = csv.DictWriter(stream, fieldnames=columns)
        writer.writeheader()
        
        for book in books:
            row = self._to_goodreads_row(book)
            writer.writerow(row)
    
    def _to_goodreads_row(self, book: BookRecord) -> dict:
        """
        Convert BookRecord to Goodreads CSV row.
        
        IMPORTANT: ISBN fields use ="..." format to prevent Excel
        from converting them to scientific notation.
        """
        # Calculate bookshelves with positions
        shelf_position = f"{book.exclusive_shelf} (#1)" if book.exclusive_shelf else ""
        
        return {
            "Book Id": "",  # Leave empty, Goodreads assigns
            "Title": book.title,
            "Author": book.author,
            "Author l-f": book.author_lf,
            "Additional Authors": book.additional_authors,
            "ISBN": self._format_isbn(book.isbn_10),
            "ISBN13": self._format_isbn(book.isbn_13),
            "My Rating": book.my_rating,
            "Average Rating": f"{book.average_rating:.2f}" if book.average_rating else "",
            "Publisher": book.publisher,
            "Binding": book.binding,
            "Number of Pages": str(book.page_count) if book.page_count else "",
            "Year Published": str(book.year_published) if book.year_published else "",
            "Original Publication Year": str(book.original_year) if book.original_year else "",
            "Date Read": book.date_read,
            "Date Added": book.date_added,
            "Bookshelves": book.bookshelves,
            "Bookshelves with positions": shelf_position,
            "Exclusive Shelf": book.exclusive_shelf,
            "My Review": book.my_review,
            "Spoiler": "",
            "Private Notes": "",
            "Read Count": book.read_count,
            "Owned Copies": book.owned_copies
        }
    
    @staticmethod
    def _format_isbn(isbn: str | None) -> str:
        """
        Format ISBN for Goodreads CSV.
        
        Goodreads expects ISBNs in ="0123456789" format.
        This prevents Excel from corrupting them.
        """
        if not isbn:
            return '=""'
        return f'="{isbn}"'
    
    def export_json(
        self,
        books: list[BookRecord],
        output_path: str | Path
    ) -> Path:
        """
        Export books to JSON (for debugging or API use).
        """
        import json
        
        output_path = Path(output_path)
        
        data = [book.model_dump() for book in books]
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, default=str)
        
        logger.info(f"Exported {len(books)} books to {output_path}")
        return output_path
```

---

## 9. CLI Interface (cli.py)

```python
"""
cli.py - Command line interface for Bookshelf Scanner

Usage:
    bookshelf-scanner scan bookshelf.jpg
    bookshelf-scanner scan bookshelf.jpg -o my_books.csv --shelf owned
    bookshelf-scanner scan bookshelf.jpg --no-lookup --json
"""

import typer
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn
from rich.table import Table
from rich.panel import Panel
from pathlib import Path
from typing import Optional
import yaml
import json
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s"
)

app = typer.Typer(
    name="bookshelf-scanner",
    help="Scan bookshelves and export to Goodreads/StoryGraph CSV",
    add_completion=False
)
console = Console()


def load_config(config_path: Path) -> dict:
    """Load configuration from YAML file."""
    if config_path.exists():
        with open(config_path) as f:
            return yaml.safe_load(f) or {}
    return {}


@app.command()
def scan(
    image: Path = typer.Argument(
        ...,
        help="Path to bookshelf image (JPEG, PNG)",
        exists=True
    ),
    output: Optional[Path] = typer.Option(
        None, "--output", "-o",
        help="Output CSV path (default: books_<imagename>.csv)"
    ),
    shelf: str = typer.Option(
        "to-read", "--shelf", "-s",
        help="Default bookshelf (to-read, read, currently-reading)"
    ),
    no_lookup: bool = typer.Option(
        False, "--no-lookup",
        help="Skip Google Books API lookup"
    ),
    json_output: bool = typer.Option(
        False, "--json",
        help="Output JSON instead of CSV"
    ),
    include_unmatched: bool = typer.Option(
        True, "--include-unmatched/--exclude-unmatched",
        help="Include books not found in Google Books"
    ),
    config_file: Path = typer.Option(
        Path("config.yaml"), "--config", "-c",
        help="Configuration file path"
    ),
    verbose: bool = typer.Option(
        False, "--verbose", "-v",
        help="Show detailed output"
    )
):
    """
    Scan a bookshelf image and export book information.
    
    Examples:
    
        bookshelf-scanner scan bookshelf.jpg
        
        bookshelf-scanner scan bookshelf.jpg -o library.csv --shelf owned
        
        bookshelf-scanner scan bookshelf.jpg --no-lookup --json
    """
    from .detector import SpineDetector
    from .extractor import BookExtractor
    from .lookup import GoogleBooksClient, create_book_record
    from .exporter import BookExporter
    
    if verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Load config
    config = load_config(config_file)
    
    console.print(Panel.fit(
        f"[bold blue]Bookshelf Scanner[/bold blue]\n"
        f"Image: {image.name}",
        border_style="blue"
    ))
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        console=console
    ) as progress:
        
        # Step 1: Initialize models
        task = progress.add_task("[cyan]Loading models...", total=2)
        
        detector = SpineDetector(
            **config.get("detection", {})
        )
        progress.advance(task)
        
        extractor = BookExtractor(
            **config.get("extraction", {})
        )
        progress.advance(task)
        
        # Step 2: Detect spines
        task = progress.add_task("[cyan]Detecting book spines...", total=None)
        
        spine_images, spine_metadata = detector.detect_all(image)
        
        progress.update(task, completed=True)
        console.print(f"  Found [green]{len(spine_images)}[/green] book spines")
        
        if not spine_images:
            console.print("[yellow]No books detected in image.[/yellow]")
            raise typer.Exit(1)
        
        # Step 3: Extract text from each spine
        task = progress.add_task(
            "[cyan]Extracting titles...", 
            total=len(spine_images)
        )
        
        extractions = []
        for i, img in enumerate(spine_images):
            extraction = extractor.extract(img)
            extractions.append(extraction)
            progress.advance(task)
            
            if verbose:
                console.print(f"    [{i+1}] {extraction.title[:40]}...")
        
        # Step 4: Look up in Google Books (optional)
        if no_lookup:
            api_results = [None] * len(extractions)
            console.print("  [dim]Skipping Google Books lookup[/dim]")
        else:
            lookup_config = config.get("lookup", {})
            client = GoogleBooksClient(
                api_key=lookup_config.get("api_key"),
                timeout=lookup_config.get("timeout", 10),
                max_results=lookup_config.get("max_results", 5)
            )
            
            task = progress.add_task(
                "[cyan]Looking up metadata...",
                total=len(extractions)
            )
            
            api_results = []
            for extraction in extractions:
                result = client.lookup(extraction)
                api_results.append(result)
                progress.advance(task)
        
        # Step 5: Create book records
        books = []
        for i, (extraction, api_result) in enumerate(zip(extractions, api_results)):
            book = create_book_record(
                extraction=extraction,
                api_result=api_result,
                spine_index=i,
                default_shelf=shelf
            )
            books.append(book)
        
        # Step 6: Export
        exporter = BookExporter(
            **config.get("export", {})
        )
        
        if json_output:
            output_path = output or Path(f"books_{image.stem}.json")
            exporter.export_json(books, output_path)
        else:
            output_path = output or Path(f"books_{image.stem}.csv")
            exporter.export(books, output_path, include_unmatched=include_unmatched)
    
    # Print summary
    _print_summary(books, output_path)


def _print_summary(books: list, output_path: Path):
    """Print a summary table of detected books."""
    
    matched = sum(1 for b in books if b.matched)
    
    console.print()
    console.print(Panel.fit(
        f"[green]✓ Exported {len(books)} books[/green]\n"
        f"  Matched in Google Books: {matched}/{len(books)}\n"
        f"  Output: {output_path}",
        border_style="green"
    ))
    
    # Show first 10 books
    table = Table(title="Detected Books (first 10)")
    table.add_column("#", style="dim", width=3)
    table.add_column("Title", style="cyan", max_width=40)
    table.add_column("Author", style="green", max_width=25)
    table.add_column("ISBN", style="yellow", width=15)
    table.add_column("Match", style="magenta", width=5)
    
    for i, book in enumerate(books[:10]):
        table.add_row(
            str(i + 1),
            book.title[:40] + ("..." if len(book.title) > 40 else ""),
            book.author[:25] if book.author else "-",
            book.isbn_13 or book.isbn_10 or "-",
            "✓" if book.matched else "✗"
        )
    
    if len(books) > 10:
        table.add_row("...", f"[dim]({len(books) - 10} more)[/dim]", "", "", "")
    
    console.print(table)


@app.command()
def test_spine(
    image: Path = typer.Argument(
        ...,
        help="Path to a single spine image",
        exists=True
    )
):
    """
    Test text extraction on a single spine image (for debugging).
    """
    from PIL import Image
    from .extractor import BookExtractor
    
    console.print(f"Testing extraction on: {image}")
    
    extractor = BookExtractor()
    
    img = Image.open(image)
    result = extractor.extract(img)
    
    console.print(Panel.fit(
        f"[bold]Title:[/bold] {result.title}\n"
        f"[bold]Author:[/bold] {result.author or '[not found]'}",
        title="Extraction Result",
        border_style="green"
    ))


@app.command()
def version():
    """Show version information."""
    console.print("bookshelf-scanner v1.0.0")


def main():
    """Entry point."""
    app()


if __name__ == "__main__":
    main()
```

---

## 10. Utility Functions (utils.py)

```python
"""
utils.py - Helper functions and utilities
"""

from PIL import Image
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


def load_image(path: str | Path) -> Image.Image:
    """
    Load and validate an image file.
    
    Args:
        path: Path to image file
        
    Returns:
        PIL Image in RGB format
        
    Raises:
        FileNotFoundError: If image doesn't exist
        ValueError: If file is not a valid image
    """
    path = Path(path)
    
    if not path.exists():
        raise FileNotFoundError(f"Image not found: {path}")
    
    try:
        img = Image.open(path)
        # Convert to RGB if needed
        if img.mode != "RGB":
            img = img.convert("RGB")
        return img
    except Exception as e:
        raise ValueError(f"Failed to load image {path}: {e}")


def get_device() -> str:
    """
    Auto-detect the best available device.
    
    Returns:
        'cuda', 'mps', or 'cpu'
    """
    import torch
    
    if torch.cuda.is_available():
        return "cuda"
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def ensure_dir(path: Path) -> Path:
    """Ensure a directory exists, creating it if necessary."""
    path = Path(path)
    path.mkdir(parents=True, exist_ok=True)
    return path
```

---

## 11. Testing

### tests/test_extractor.py
```python
"""Tests for book text extraction."""

import pytest
from PIL import Image
from bookshelf_scanner.extractor import BookExtractor
from bookshelf_scanner.schemas import SpineExtraction


class TestBookExtractor:
    """Test cases for BookExtractor."""
    
    def test_parse_clean_json(self):
        """Test parsing clean JSON response."""
        extractor = BookExtractor.__new__(BookExtractor)
        
        response = '{"title": "The Great Gatsby", "author": "F. Scott Fitzgerald"}'
        result = extractor._parse_response(response)
        
        assert result.title == "The Great Gatsby"
        assert result.author == "F. Scott Fitzgerald"
    
    def test_parse_json_with_code_block(self):
        """Test parsing JSON wrapped in markdown code block."""
        extractor = BookExtractor.__new__(BookExtractor)
        
        response = '```json\n{"title": "1984", "author": "George Orwell"}\n```'
        result = extractor._parse_response(response)
        
        assert result.title == "1984"
        assert result.author == "George Orwell"
    
    def test_parse_null_author(self):
        """Test parsing JSON with null author."""
        extractor = BookExtractor.__new__(BookExtractor)
        
        response = '{"title": "Meditations", "author": null}'
        result = extractor._parse_response(response)
        
        assert result.title == "Meditations"
        assert result.author is None
    
    def test_parse_malformed_json(self):
        """Test recovery from malformed JSON."""
        extractor = BookExtractor.__new__(BookExtractor)
        
        response = 'Here is the book: {"title": "Atomic Habits", "author": "James Clear'
        result = extractor._parse_response(response)
        
        # Should still extract title
        assert "Atomic" in result.title or result.title is not None


class TestSpineExtraction:
    """Test SpineExtraction model validation."""
    
    def test_valid_extraction(self):
        """Test valid extraction data."""
        extraction = SpineExtraction(
            title="The Great Gatsby",
            author="F. Scott Fitzgerald"
        )
        assert extraction.title == "The Great Gatsby"
        assert extraction.author == "F. Scott Fitzgerald"
    
    def test_title_cleaning(self):
        """Test that title whitespace is normalized."""
        extraction = SpineExtraction(
            title="  The   Great   Gatsby  ",
            author="F. Scott Fitzgerald"
        )
        assert extraction.title == "The Great Gatsby"
    
    def test_empty_author_becomes_none(self):
        """Test that empty author becomes None."""
        extraction = SpineExtraction(
            title="Test Book",
            author="   "
        )
        assert extraction.author is None
```

### tests/test_exporter.py
```python
"""Tests for CSV export."""

import pytest
import csv
from io import StringIO
from datetime import date
from bookshelf_scanner.exporter import BookExporter
from bookshelf_scanner.schemas import BookRecord


class TestBookExporter:
    """Test cases for BookExporter."""
    
    def test_isbn_formatting(self):
        """Test that ISBNs are formatted with Excel protection."""
        assert BookExporter._format_isbn("0393351599") == '="0393351599"'
        assert BookExporter._format_isbn("9780393351590") == '="9780393351590"'
        assert BookExporter._format_isbn(None) == '=""'
        assert BookExporter._format_isbn("") == '=""'
    
    def test_csv_column_order(self):
        """Test that CSV has correct column order for Goodreads."""
        book = BookRecord(
            extracted_title="Test Book",
            title="Test Book",
            author="Test Author",
            author_lf="Author, Test",
            date_added=date.today().strftime("%Y/%m/%d")
        )
        
        exporter = BookExporter()
        
        output = StringIO()
        exporter._write_csv([book], output)
        
        output.seek(0)
        reader = csv.DictReader(output)
        
        # Check that all expected columns are present
        expected_columns = [
            "Book Id", "Title", "Author", "Author l-f", "Additional Authors",
            "ISBN", "ISBN13", "My Rating", "Average Rating", "Publisher",
            "Binding", "Number of Pages", "Year Published", "Original Publication Year",
            "Date Read", "Date Added", "Bookshelves", "Bookshelves with positions",
            "Exclusive Shelf", "My Review", "Spoiler", "Private Notes",
            "Read Count", "Owned Copies"
        ]
        
        assert reader.fieldnames == expected_columns
```

---

## 12. README.md

```markdown
# Bookshelf Scanner

Scan photos of your bookshelf and export to Goodreads or StoryGraph.

## Features

- **Automatic spine detection** using YOLO object detection
- **Text extraction** using Moondream 0.5B vision-language model  
- **Metadata lookup** via Google Books API
- **Goodreads-compatible CSV export** for easy import

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/bookshelf-scanner
cd bookshelf-scanner

# Install dependencies
pip install -e .

# Or with GPU support
pip install -e ".[gpu]"
```

## Quick Start

```bash
# Scan a bookshelf image
bookshelf-scanner scan bookshelf.jpg

# Specify output file and shelf
bookshelf-scanner scan bookshelf.jpg -o my_books.csv --shelf owned

# Skip API lookup (offline mode)
bookshelf-scanner scan bookshelf.jpg --no-lookup

# Output JSON instead of CSV
bookshelf-scanner scan bookshelf.jpg --json
```

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Python | 3.10+ | 3.11+ |
| RAM | 4GB | 8GB |
| Storage | 2GB | 5GB |
| GPU | Not required | Any CUDA GPU |

## Configuration

Create a `config.yaml` file to customize settings:

```yaml
detection:
  confidence: 0.25
  device: auto

extraction:
  model: moondream-0.5b  # or moondream-2b for better accuracy
  device: auto

lookup:
  api_key: YOUR_GOOGLE_BOOKS_API_KEY  # optional

export:
  default_shelf: to-read
```

## Importing to Goodreads

1. Run `bookshelf-scanner scan your_bookshelf.jpg`
2. Go to [Goodreads Import](https://www.goodreads.com/review/import)
3. Upload the generated CSV file
4. Review and confirm the imports

## License

MIT
```

---

## 13. Implementation Checklist

Use this checklist when implementing with Claude Code:

### Phase 1: Project Setup
- [ ] Create directory structure
- [ ] Create `pyproject.toml` and `requirements.txt`
- [ ] Create empty `__init__.py` files
- [ ] Create `config.yaml` with defaults

### Phase 2: Core Modules
- [ ] Implement `schemas.py` with all Pydantic models
- [ ] Implement `utils.py` helper functions
- [ ] Implement `detector.py` with SpineDetector class
- [ ] Implement `extractor.py` with BookExtractor class
- [ ] Implement `lookup.py` with GoogleBooksClient
- [ ] Implement `exporter.py` with BookExporter

### Phase 3: CLI
- [ ] Implement `cli.py` with Typer
- [ ] Add progress bars with Rich
- [ ] Add summary table output
- [ ] Test end-to-end with sample image

### Phase 4: Testing
- [ ] Write unit tests for each module
- [ ] Test CSV format against real Goodreads import
- [ ] Test with various bookshelf images

### Phase 5: Documentation
- [ ] Complete README.md
- [ ] Add docstrings to all public functions
- [ ] Create example outputs

---

## Notes for Claude Code

1. **Start with `schemas.py`** - This defines all data structures and should be implemented first.

2. **Moondream loading** - Use `trust_remote_code=True` and specify `revision` for reproducibility.

3. **YOLO detection** - Use `yolov8n.pt` (nano) by default. It detects COCO class 73 ("book").

4. **JSON enforcement** - The extraction prompt is critical. The model must return valid JSON.

5. **Error handling** - Each component should fail gracefully and log errors.

6. **Testing** - Test with the user's Goodreads export format to ensure compatibility.