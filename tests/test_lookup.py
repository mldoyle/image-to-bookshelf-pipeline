"""Tests for Google Books lookup and CSV export."""

from __future__ import annotations

import csv
import os
from pathlib import Path

import pytest

from bookshelf_scanner.lookup import (
    GoogleBooksClient,
    _load_env_file,
    _lookup_rows,
    _read_extractions_csv,
    _write_output_csv,
    run_lookup,
)


class _FakeResponse:
    def __init__(self, payload: dict) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self._payload


def test_load_env_file_sets_missing_key(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "# comment line\nGOOGLE_BOOKS_API_KEY=test-key\nEMPTY=\nQUOTED='value'\n",
        encoding="utf-8",
    )
    monkeypatch.delenv("GOOGLE_BOOKS_API_KEY", raising=False)

    _load_env_file(env_file)

    assert os.getenv("GOOGLE_BOOKS_API_KEY") == "test-key"
    assert os.getenv("EMPTY") == ""
    assert os.getenv("QUOTED") == "value"


def test_lookup_rows_flattens_all_items(monkeypatch: pytest.MonkeyPatch):
    rows = [{"spine_index": "1", "image_path": "a.jpg", "title": "Dune", "author": "Frank Herbert"}]
    client = GoogleBooksClient(api_key="abc", max_results=2)

    def fake_get(url: str, params: dict, timeout: int):
        assert "intitle" in params["q"]
        assert "inauthor" in params["q"]
        payload = {
            "totalItems": 1,
            "items": [
                {
                    "id": "book123",
                    "volumeInfo": {
                        "title": "Dune",
                        "authors": ["Frank Herbert"],
                        "industryIdentifiers": [{"type": "ISBN_13", "identifier": "9780441172719"}],
                    },
                }
            ],
        }
        return _FakeResponse(payload)

    monkeypatch.setattr(client.session, "get", fake_get)
    out = _lookup_rows(rows, client)

    assert len(out) == 1
    assert out[0]["match_found"] == "true"
    assert out[0]["item.id"] == "book123"
    assert out[0]["item.volumeInfo.title"] == "Dune"
    assert out[0]["item.volumeInfo.authors[0]"] == "Frank Herbert"
    assert out[0]["item.volumeInfo.industryIdentifiers[0].identifier"] == "9780441172719"


def test_run_lookup_reads_extraction_csv_and_writes_output(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    input_csv = tmp_path / "input.csv"
    output_csv = tmp_path / "lookup_outputs.csv"
    input_csv.write_text(
        "spine_index,image_path,title,author,confidence,raw_response\n"
        "0,spine0.jpg,Dune,Frank Herbert,0.9,{}\n"
        "1,spine1.jpg,Hyperion,Dan Simmons,0.8,{}\n",
        encoding="utf-8",
    )

    def fake_get(url: str, params: dict, timeout: int):
        q = params["q"]
        if "Hyperion" in q:
            return _FakeResponse({"totalItems": 0, "items": []})
        return _FakeResponse(
            {
                "totalItems": 1,
                "items": [{"id": "dune-id", "volumeInfo": {"title": "Dune"}}],
            }
        )

    class _FakeSession:
        def get(self, url: str, params: dict, timeout: int):
            return fake_get(url, params, timeout)

    monkeypatch.setattr("bookshelf_scanner.lookup.requests.Session", lambda: _FakeSession())

    row_count = run_lookup(input_csv=input_csv, output_csv=output_csv, api_key="x", max_results=3)

    assert row_count == 2
    assert output_csv.exists()
    with output_csv.open("r", encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    assert len(rows) == 2
    assert rows[0]["input_title"] == "Dune"
    assert rows[0]["match_found"] == "true"
    assert rows[0]["item.id"] == "dune-id"
    assert rows[1]["input_title"] == "Hyperion"
    assert rows[1]["match_found"] == "false"
    assert rows[1]["raw_item_json"] == ""


def test_read_extractions_csv_requires_title_column(tmp_path: Path):
    bad_csv = tmp_path / "bad.csv"
    bad_csv.write_text("author\nFrank Herbert\n", encoding="utf-8")

    with pytest.raises(ValueError):
        _read_extractions_csv(bad_csv)


def test_write_output_csv_handles_empty_rows(tmp_path: Path):
    out_csv = tmp_path / "empty.csv"
    _write_output_csv(out_csv, [])
    with out_csv.open("r", encoding="utf-8", newline="") as handle:
        rows = list(csv.reader(handle))
    assert rows[0][0] == "input_spine_index"
