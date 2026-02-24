"""Flask-SQLAlchemy extension and app-level DB configuration."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.pool import StaticPool


db = SQLAlchemy()


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _default_sqlite_uri() -> str:
    db_path = _repo_root() / "data" / "dev.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{db_path}"


def _normalize_database_url(raw_url: str | None) -> str:
    value = (raw_url or "").strip()
    if not value:
        return _default_sqlite_uri()
    if value.startswith("postgres://"):
        return "postgresql://" + value[len("postgres://") :]
    return value


def _engine_options_for_uri(database_uri: str) -> dict[str, Any]:
    if "sqlite" not in database_uri:
        return {"pool_pre_ping": True}

    options: dict[str, Any] = {
        "connect_args": {"check_same_thread": False},
    }
    if ":memory:" in database_uri:
        options["poolclass"] = StaticPool
    return options


def init_database(app: Flask) -> None:
    """Configure and initialize SQLAlchemy for this Flask app."""
    database_uri = _normalize_database_url(os.getenv("DATABASE_URL"))

    app.config.setdefault("SQLALCHEMY_DATABASE_URI", database_uri)
    app.config.setdefault("SQLALCHEMY_TRACK_MODIFICATIONS", False)
    app.config.setdefault("SQLALCHEMY_ECHO", False)
    app.config.setdefault(
        "SQLALCHEMY_ENGINE_OPTIONS",
        _engine_options_for_uri(app.config["SQLALCHEMY_DATABASE_URI"]),
    )
    app.config.setdefault("BOOKSHELF_DB_AUTO_CREATE", True)
    app.config.setdefault("BOOKSHELF_DEV_USER_EMAIL", "localdev@bookshelf.local")
    app.config.setdefault("BOOKSHELF_DEV_USER_USERNAME", "localdev")

    db.init_app(app)

    if app.config.get("BOOKSHELF_DB_AUTO_CREATE", True):
        with app.app_context():
            db.create_all()
