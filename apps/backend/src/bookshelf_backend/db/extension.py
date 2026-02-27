"""Flask-SQLAlchemy/Flask-Migrate extension and DB configuration."""

from __future__ import annotations

from typing import Any

from flask import Flask
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.pool import StaticPool


db = SQLAlchemy()
migrate = Migrate()

def _normalize_database_url(raw_url: str | None, *, fallback: str) -> str:
    value = (raw_url or "").strip()
    if not value:
        return fallback
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
    fallback_uri = str(app.config.get("DATABASE_URL") or "")
    database_uri = _normalize_database_url(
        app.config.get("SQLALCHEMY_DATABASE_URI") or fallback_uri,
        fallback=fallback_uri,
    )

    app.config["SQLALCHEMY_DATABASE_URI"] = database_uri
    app.config.setdefault("DATABASE_URL", database_uri)
    app.config.setdefault("SQLALCHEMY_TRACK_MODIFICATIONS", False)
    app.config.setdefault("SQLALCHEMY_ECHO", False)
    app.config.setdefault(
        "SQLALCHEMY_ENGINE_OPTIONS",
        _engine_options_for_uri(app.config["SQLALCHEMY_DATABASE_URI"]),
    )

    db.init_app(app)
    migrate.init_app(app, db, directory="migrations")
