"""Google Books lookup from extraction CSV output."""

from __future__ import annotations

import argparse
import csv
import json
import os
from pathlib import Path
from typing import Any

import requests


class GoogleBooksClient:
    """Thin Google Books API client."""

    BASE_URL = "https://www.googleapis.com/books/v1/volumes"

    def __init__(self, api_key: str | None = None, timeout: int = 10, max_results: int = 5) -> None:
        self.api_key = api_key
        self.timeout = timeout
        self.max_results = max_results
        self.session = requests.Session()

    def lookup(self, title: str, author: str | None = None) -> dict[str, Any]:
        """Fetch raw Google Books response for one title/author pair."""
        query = _build_query(title=title, author=author)
        if not query:
            return {"totalItems": 0, "items": []}

        params: dict[str, Any] = {"q": query, "printType": "books", "maxResults": self.max_results}
        if self.api_key:
            params["key"] = self.api_key

        response = self.session.get(self.BASE_URL, params=params, timeout=self.timeout)
        response.raise_for_status()
        return response.json()


def _build_query(title: str, author: str | None = None) -> str:
    title = (title or "").strip()
    author = (author or "").strip()
    if not title and not author:
        return ""
    if title and author:
        return f'intitle:"{title}" inauthor:"{author}"'
    if title:
        return f'intitle:"{title}"'
    return f'inauthor:"{author}"'


def _flatten_json(prefix: str, value: Any, out: dict[str, str]) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            child_prefix = f"{prefix}.{key}" if prefix else str(key)
            _flatten_json(child_prefix, child, out)
        return
    if isinstance(value, list):
        for index, child in enumerate(value):
            child_prefix = f"{prefix}[{index}]"
            _flatten_json(child_prefix, child, out)
        if not value:
            out[prefix] = "[]"
        return
    out[prefix] = "" if value is None else str(value)


def _load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key:
            os.environ.setdefault(key, value)


def _read_extractions_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            return []
        if "title" not in reader.fieldnames:
            raise ValueError("Input CSV must include a 'title' column.")
        rows: list[dict[str, str]] = []
        for row in reader:
            if not row:
                continue
            title = (row.get("title") or "").strip()
            if not title:
                continue
            rows.append(row)
    return rows


def _lookup_rows(rows: list[dict[str, str]], client: GoogleBooksClient) -> list[dict[str, str]]:
    output_rows: list[dict[str, str]] = []
    for input_row in rows:
        title = (input_row.get("title") or "").strip()
        author = (input_row.get("author") or "").strip() or None
        query = _build_query(title=title, author=author)
        payload = client.lookup(title=title, author=author)
        items = payload.get("items") or []

        if not items:
            output_rows.append(
                {
                    "input_spine_index": str(input_row.get("spine_index") or ""),
                    "input_image_path": str(input_row.get("image_path") or ""),
                    "input_title": title,
                    "input_author": author or "",
                    "query": query,
                    "response_total_items": str(payload.get("totalItems", 0)),
                    "match_found": "false",
                    "result_index": "",
                    "raw_item_json": "",
                }
            )
            continue

        for result_index, item in enumerate(items):
            row: dict[str, str] = {
                "input_spine_index": str(input_row.get("spine_index") or ""),
                "input_image_path": str(input_row.get("image_path") or ""),
                "input_title": title,
                "input_author": author or "",
                "query": query,
                "response_total_items": str(payload.get("totalItems", len(items))),
                "match_found": "true",
                "result_index": str(result_index),
                "raw_item_json": json.dumps(item, ensure_ascii=False),
            }
            _flatten_json("item", item, row)
            output_rows.append(row)
    return output_rows


def _write_output_csv(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(
                [
                    "input_spine_index",
                    "input_image_path",
                    "input_title",
                    "input_author",
                    "query",
                    "response_total_items",
                    "match_found",
                    "result_index",
                    "raw_item_json",
                ]
            )
        return

    preferred = [
        "input_spine_index",
        "input_image_path",
        "input_title",
        "input_author",
        "query",
        "response_total_items",
        "match_found",
        "result_index",
        "raw_item_json",
    ]
    all_keys = {key for row in rows for key in row.keys()}
    tail = sorted(key for key in all_keys if key not in preferred)
    fieldnames = [*preferred, *tail]

    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def run_lookup(
    input_csv: Path,
    output_csv: Path,
    api_key: str | None = None,
    timeout: int = 10,
    max_results: int = 5,
) -> int:
    rows = _read_extractions_csv(input_csv)
    client = GoogleBooksClient(api_key=api_key, timeout=timeout, max_results=max_results)
    output_rows = _lookup_rows(rows, client)
    _write_output_csv(output_csv, output_rows)
    return len(output_rows)


def _build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Look up extracted titles via Google Books API.")
    parser.add_argument("input", type=Path, help="CSV from extraction step (must include title/author columns).")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("lookup_outputs.csv"),
        help="Output CSV path for API lookup data.",
    )
    parser.add_argument(
        "--api-key",
        default=None,
        help="Google Books API key (defaults to GOOGLE_BOOKS_API_KEY from env/.env).",
    )
    parser.add_argument("--timeout", type=int, default=10, help="HTTP timeout in seconds.")
    parser.add_argument("--max-results", type=int, default=5, help="Max results per title query.")
    parser.add_argument(
        "--env-file",
        type=Path,
        default=Path("secrets/.env"),
        help="Optional env file path for GOOGLE_BOOKS_API_KEY.",
    )
    return parser


def _run_cli() -> int:
    parser = _build_arg_parser()
    args = parser.parse_args()

    _load_env_file(args.env_file)
    api_key = args.api_key or os.getenv("GOOGLE_BOOKS_API_KEY")

    try:
        row_count = run_lookup(
            input_csv=args.input,
            output_csv=args.output,
            api_key=api_key,
            timeout=args.timeout,
            max_results=args.max_results,
        )
    except Exception as exc:
        print(f"Lookup failed: {type(exc).__name__}: {exc}")
        return 1

    print(f"Wrote: {args.output} ({row_count} row(s))")
    return 0


if __name__ == "__main__":
    raise SystemExit(_run_cli())
