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
