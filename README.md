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
# Extract title/author from a single spine image
python -m bookshelf_scanner.extractor data/spine.jpg

# Process a directory of spine crops and write CSV output
python -m bookshelf_scanner.extractor outputs/detections/my_shelf_crops --output outputs/extractions/my_shelf.csv

# Run in offline mode using only locally cached model files
python -m bookshelf_scanner.extractor outputs/detections/my_shelf_crops --local-files-only
```

## CLI Commands

### `python -m bookshelf_scanner.extractor`

Run Moondream extraction on one spine image or a directory of spine images.

```bash
python -m bookshelf_scanner.extractor INPUT [OPTIONS]
```

Arguments:

- `INPUT`: Path to a spine image file or a directory containing images.

Options:

- `--limit N`: Only process the first `N` images.
- `--output PATH`: Write extraction results to a CSV file.
- `--model-name NAME`: Model alias, Hugging Face repo ID, or local model path (default: `moondream-0.5b`).
- `--revision REV`: Model revision when loading from a repo.
- `--device DEVICE`: `auto`, `cpu`, `cuda`, or `mps` (default: `auto`).
- `--max-new-tokens N`: Max generated tokens per extraction (default: `100`).
- `--temperature FLOAT`: Decoding temperature (default: `0.1`).
- `--cache-dir PATH`: Optional Hugging Face model cache directory.
- `--modules-cache-dir PATH`: Cache directory for remote model Python modules (default: `.cache/huggingface/modules`).
- `--local-files-only`: Force offline mode and only use locally cached model files.

## Note on `bookshelf-scanner`

The packaged command `bookshelf-scanner scan ...` is currently a placeholder and not implemented yet. Use `python -m bookshelf_scanner.extractor ...` for the active CLI path.

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

1. Run extraction to produce your CSV, for example: `python -m bookshelf_scanner.extractor outputs/detections/my_shelf_crops --output outputs/extractions/my_shelf.csv`
2. Go to [Goodreads Import](https://www.goodreads.com/review/import)
3. Upload the generated CSV file
4. Review and confirm the imports

## License

MIT
