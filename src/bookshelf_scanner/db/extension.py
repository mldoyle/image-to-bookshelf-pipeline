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


def _sqlite_table_exists(connection: Any, table_name: str) -> bool:
    row = connection.exec_driver_sql(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = :name",
        {"name": table_name},
    ).first()
    return row is not None


def _sqlite_table_columns(connection: Any, table_name: str) -> set[str]:
    rows = connection.exec_driver_sql(f"PRAGMA table_info('{table_name}')").fetchall()
    return {str(row[1]) for row in rows}


def _sqlite_add_column_if_missing(connection: Any, table_name: str, column_name: str, definition: str) -> None:
    columns = _sqlite_table_columns(connection, table_name)
    if column_name in columns:
        return
    connection.exec_driver_sql(f"ALTER TABLE {table_name} ADD COLUMN {definition}")


def _apply_sqlite_schema_upgrades(app: Flask) -> None:
    database_uri = str(app.config.get("SQLALCHEMY_DATABASE_URI") or "")
    if "sqlite" not in database_uri:
        return

    engine = db.engine
    with engine.begin() as connection:
        if _sqlite_table_exists(connection, "users"):
            _sqlite_add_column_if_missing(connection, "users", "bio", "bio TEXT")
            _sqlite_add_column_if_missing(connection, "users", "location", "location VARCHAR(120)")
            _sqlite_add_column_if_missing(connection, "users", "website", "website VARCHAR(255)")
            _sqlite_add_column_if_missing(
                connection,
                "users",
                "badge",
                "badge VARCHAR(32) NOT NULL DEFAULT 'PATRON'",
            )

        if _sqlite_table_exists(connection, "books"):
            _sqlite_add_column_if_missing(connection, "books", "page_count", "page_count INTEGER")
            _sqlite_add_column_if_missing(connection, "books", "synopsis", "synopsis TEXT")
            _sqlite_add_column_if_missing(connection, "books", "info_link", "info_link TEXT")

        if _sqlite_table_exists(connection, "user_books"):
            _sqlite_add_column_if_missing(connection, "user_books", "liked", "liked BOOLEAN NOT NULL DEFAULT 0")
            _sqlite_add_column_if_missing(connection, "user_books", "reread", "reread BOOLEAN NOT NULL DEFAULT 0")

        if not _sqlite_table_exists(connection, "friends"):
            connection.exec_driver_sql(
                """
                CREATE TABLE friends (
                    id VARCHAR(36) NOT NULL PRIMARY KEY,
                    user_id VARCHAR(36) NOT NULL,
                    friend_user_id VARCHAR(36),
                    name VARCHAR(120) NOT NULL,
                    email VARCHAR(320),
                    avatar_url TEXT,
                    status VARCHAR(16) NOT NULL DEFAULT 'active',
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NOT NULL,
                    CONSTRAINT uq_friends_user_name UNIQUE (user_id, name),
                    CONSTRAINT ck_friends_status CHECK (status IN ('active', 'blocked')),
                    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE,
                    FOREIGN KEY(friend_user_id) REFERENCES users (id) ON DELETE CASCADE
                )
                """
            )
            connection.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_friends_user_id ON friends (user_id)")
            connection.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_friends_friend_user_id ON friends (friend_user_id)"
            )

        if not _sqlite_table_exists(connection, "loans"):
            connection.exec_driver_sql(
                """
                CREATE TABLE loans (
                    id VARCHAR(36) NOT NULL PRIMARY KEY,
                    user_id VARCHAR(36) NOT NULL,
                    user_book_id VARCHAR(36) NOT NULL,
                    friend_id VARCHAR(36),
                    borrower_name VARCHAR(120) NOT NULL,
                    borrower_contact VARCHAR(320),
                    lent_at DATETIME NOT NULL,
                    due_at DATETIME,
                    returned_at DATETIME,
                    note TEXT,
                    status VARCHAR(16) NOT NULL DEFAULT 'active',
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NOT NULL,
                    CONSTRAINT ck_loans_status CHECK (status IN ('active', 'returned')),
                    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE,
                    FOREIGN KEY(user_book_id) REFERENCES user_books (id) ON DELETE CASCADE,
                    FOREIGN KEY(friend_id) REFERENCES friends (id) ON DELETE SET NULL
                )
                """
            )
            connection.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_loans_user_id ON loans (user_id)")
            connection.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_loans_user_book_id ON loans (user_book_id)")
            connection.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_loans_friend_id ON loans (friend_id)")

        if _sqlite_table_exists(connection, "library_memberships"):
            # Migrate any legacy relationships to the new friends table.
            connection.exec_driver_sql(
                """
                INSERT INTO friends (
                    id,
                    user_id,
                    friend_user_id,
                    name,
                    email,
                    avatar_url,
                    status,
                    created_at,
                    updated_at
                )
                SELECT
                    lm.id,
                    lm.follower_user_id,
                    lm.followed_user_id,
                    COALESCE(u.display_name, u.username, u.email, 'Friend'),
                    u.email,
                    u.avatar_url,
                    CASE WHEN lm.status IN ('active', 'blocked') THEN lm.status ELSE 'active' END,
                    lm.created_at,
                    lm.updated_at
                FROM library_memberships lm
                LEFT JOIN users u ON u.id = lm.followed_user_id
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM friends f
                    WHERE f.id = lm.id
                )
                """
            )


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
            _apply_sqlite_schema_upgrades(app)
