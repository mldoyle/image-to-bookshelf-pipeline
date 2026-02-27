"""Initial relational schema for bookshelf backend.

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-02-27 16:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def _table_exists(inspector: sa.Inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _column_exists(inspector: sa.Inspector, table_name: str, column_name: str) -> bool:
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def _index_exists(inspector: sa.Inspector, table_name: str, index_name: str) -> bool:
    return any(index.get("name") == index_name for index in inspector.get_indexes(table_name))


def _create_users_table() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("username", sa.String(length=80), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=True),
        sa.Column("display_name", sa.String(length=120), nullable=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("location", sa.String(length=120), nullable=True),
        sa.Column("website", sa.String(length=255), nullable=True),
        sa.Column("badge", sa.String(length=32), nullable=False, server_default="PATRON"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("library_visibility", sa.String(length=16), nullable=False, server_default="private"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "library_visibility IN ('public', 'private')",
            name="ck_users_library_visibility",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_username", "users", ["username"], unique=True)


def _create_books_table() -> None:
    op.create_table(
        "books",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("google_books_id", sa.String(length=128), nullable=True),
        sa.Column("isbn_10", sa.String(length=10), nullable=True),
        sa.Column("isbn_13", sa.String(length=13), nullable=True),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("title_normalized", sa.String(length=500), nullable=False),
        sa.Column("subtitle", sa.String(length=500), nullable=True),
        sa.Column("primary_author", sa.String(length=255), nullable=True),
        sa.Column("authors_json", sa.JSON(), nullable=False),
        sa.Column("categories_json", sa.JSON(), nullable=False),
        sa.Column("publisher", sa.String(length=255), nullable=True),
        sa.Column("published_date", sa.String(length=32), nullable=True),
        sa.Column("published_year", sa.Integer(), nullable=True),
        sa.Column("thumbnail_url", sa.Text(), nullable=True),
        sa.Column("page_count", sa.Integer(), nullable=True),
        sa.Column("synopsis", sa.Text(), nullable=True),
        sa.Column("info_link", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_books_google_books_id", "books", ["google_books_id"], unique=True)
    op.create_index("ix_books_isbn_10", "books", ["isbn_10"], unique=False)
    op.create_index("ix_books_isbn_13", "books", ["isbn_13"], unique=False)
    op.create_index("ix_books_title_normalized", "books", ["title_normalized"], unique=False)
    op.create_index("ix_books_primary_author", "books", ["primary_author"], unique=False)
    op.create_index("ix_books_published_year", "books", ["published_year"], unique=False)


def _create_user_books_table() -> None:
    op.create_table(
        "user_books",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("book_id", sa.String(length=36), nullable=False),
        sa.Column("shelf", sa.String(length=32), nullable=False, server_default="read"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="owned"),
        sa.Column("source", sa.String(length=32), nullable=False, server_default="scan"),
        sa.Column("loaned", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("rating", sa.Float(), nullable=True),
        sa.Column("review", sa.Text(), nullable=True),
        sa.Column("liked", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("reread", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "shelf IN ('want_to_read', 'reading', 'read', 'custom')",
            name="ck_user_books_shelf",
        ),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "book_id", name="uq_user_books_user_book"),
    )
    op.create_index("ix_user_books_user_id", "user_books", ["user_id"], unique=False)
    op.create_index("ix_user_books_book_id", "user_books", ["book_id"], unique=False)


def _create_friends_table() -> None:
    op.create_table(
        "friends",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("friend_user_id", sa.String(length=36), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status IN ('active', 'blocked')", name="ck_friends_status"),
        sa.ForeignKeyConstraint(["friend_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", name="uq_friends_user_name"),
    )
    op.create_index("ix_friends_user_id", "friends", ["user_id"], unique=False)
    op.create_index("ix_friends_friend_user_id", "friends", ["friend_user_id"], unique=False)


def _create_loans_table() -> None:
    op.create_table(
        "loans",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("user_book_id", sa.String(length=36), nullable=False),
        sa.Column("friend_id", sa.String(length=36), nullable=True),
        sa.Column("borrower_name", sa.String(length=120), nullable=False),
        sa.Column("borrower_contact", sa.String(length=320), nullable=True),
        sa.Column("lent_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("returned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status IN ('active', 'returned')", name="ck_loans_status"),
        sa.ForeignKeyConstraint(["friend_id"], ["friends.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_book_id"], ["user_books.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_loans_user_id", "loans", ["user_id"], unique=False)
    op.create_index("ix_loans_user_book_id", "loans", ["user_book_id"], unique=False)
    op.create_index("ix_loans_friend_id", "loans", ["friend_id"], unique=False)


def _add_column_if_missing(
    inspector: sa.Inspector,
    table_name: str,
    column_name: str,
    column: sa.Column,
) -> None:
    if _column_exists(inspector, table_name, column_name):
        return
    op.add_column(table_name, column)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _table_exists(inspector, "users"):
        _create_users_table()
    else:
        _add_column_if_missing(inspector, "users", "bio", sa.Column("bio", sa.Text(), nullable=True))
        _add_column_if_missing(inspector, "users", "location", sa.Column("location", sa.String(length=120), nullable=True))
        _add_column_if_missing(inspector, "users", "website", sa.Column("website", sa.String(length=255), nullable=True))
        _add_column_if_missing(
            inspector,
            "users",
            "badge",
            sa.Column("badge", sa.String(length=32), nullable=False, server_default="PATRON"),
        )

    inspector = sa.inspect(bind)
    if not _index_exists(inspector, "users", "ix_users_email"):
        op.create_index("ix_users_email", "users", ["email"], unique=True)
    if not _index_exists(inspector, "users", "ix_users_username"):
        op.create_index("ix_users_username", "users", ["username"], unique=True)

    if not _table_exists(inspector, "books"):
        _create_books_table()
    else:
        _add_column_if_missing(inspector, "books", "page_count", sa.Column("page_count", sa.Integer(), nullable=True))
        _add_column_if_missing(inspector, "books", "synopsis", sa.Column("synopsis", sa.Text(), nullable=True))
        _add_column_if_missing(inspector, "books", "info_link", sa.Column("info_link", sa.Text(), nullable=True))

    inspector = sa.inspect(bind)
    for index_name, columns, unique in [
        ("ix_books_google_books_id", ["google_books_id"], True),
        ("ix_books_isbn_10", ["isbn_10"], False),
        ("ix_books_isbn_13", ["isbn_13"], False),
        ("ix_books_title_normalized", ["title_normalized"], False),
        ("ix_books_primary_author", ["primary_author"], False),
        ("ix_books_published_year", ["published_year"], False),
    ]:
        if not _index_exists(inspector, "books", index_name):
            op.create_index(index_name, "books", columns, unique=unique)

    if not _table_exists(inspector, "user_books"):
        _create_user_books_table()
    else:
        _add_column_if_missing(
            inspector,
            "user_books",
            "liked",
            sa.Column("liked", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        )
        _add_column_if_missing(
            inspector,
            "user_books",
            "reread",
            sa.Column("reread", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        )

    inspector = sa.inspect(bind)
    if not _index_exists(inspector, "user_books", "ix_user_books_user_id"):
        op.create_index("ix_user_books_user_id", "user_books", ["user_id"], unique=False)
    if not _index_exists(inspector, "user_books", "ix_user_books_book_id"):
        op.create_index("ix_user_books_book_id", "user_books", ["book_id"], unique=False)

    if not _table_exists(inspector, "friends"):
        _create_friends_table()

    inspector = sa.inspect(bind)
    if _table_exists(inspector, "friends"):
        if not _index_exists(inspector, "friends", "ix_friends_user_id"):
            op.create_index("ix_friends_user_id", "friends", ["user_id"], unique=False)
        if not _index_exists(inspector, "friends", "ix_friends_friend_user_id"):
            op.create_index("ix_friends_friend_user_id", "friends", ["friend_user_id"], unique=False)

    if not _table_exists(inspector, "loans"):
        _create_loans_table()

    inspector = sa.inspect(bind)
    if _table_exists(inspector, "loans"):
        if not _index_exists(inspector, "loans", "ix_loans_user_id"):
            op.create_index("ix_loans_user_id", "loans", ["user_id"], unique=False)
        if not _index_exists(inspector, "loans", "ix_loans_user_book_id"):
            op.create_index("ix_loans_user_book_id", "loans", ["user_book_id"], unique=False)
        if not _index_exists(inspector, "loans", "ix_loans_friend_id"):
            op.create_index("ix_loans_friend_id", "loans", ["friend_id"], unique=False)

    if _table_exists(inspector, "library_memberships") and _table_exists(inspector, "friends"):
        op.execute(
            sa.text(
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
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _table_exists(inspector, "loans"):
        op.drop_table("loans")
    inspector = sa.inspect(bind)

    if _table_exists(inspector, "friends"):
        op.drop_table("friends")
    inspector = sa.inspect(bind)

    if _table_exists(inspector, "user_books"):
        op.drop_table("user_books")
    inspector = sa.inspect(bind)

    if _table_exists(inspector, "books"):
        op.drop_table("books")
    inspector = sa.inspect(bind)

    if _table_exists(inspector, "users"):
        op.drop_table("users")
