"""Relational data models for users, books, and user libraries."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import CheckConstraint, UniqueConstraint

from .extension import db


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return str(uuid4())


class TimestampMixin:
    created_at = db.Column(db.DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=_utcnow,
        onupdate=_utcnow,
        nullable=False,
    )


class User(TimestampMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.String(36), primary_key=True, default=_new_id)
    email = db.Column(db.String(320), unique=True, index=True, nullable=False)
    username = db.Column(db.String(80), unique=True, index=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=True)
    display_name = db.Column(db.String(120), nullable=True)
    avatar_url = db.Column(db.Text, nullable=True)
    bio = db.Column(db.Text, nullable=True)
    location = db.Column(db.String(120), nullable=True)
    website = db.Column(db.String(255), nullable=True)
    badge = db.Column(db.String(32), default="PATRON", nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    library_visibility = db.Column(db.String(16), default="private", nullable=False)

    user_books = db.relationship("UserBook", back_populates="user", cascade="all, delete-orphan")
    friends = db.relationship(
        "Friend",
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="Friend.user_id",
    )
    loans = db.relationship("Loan", back_populates="user", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint(
            "library_visibility IN ('public', 'private')",
            name="ck_users_library_visibility",
        ),
    )


class Book(TimestampMixin, db.Model):
    __tablename__ = "books"

    id = db.Column(db.String(36), primary_key=True, default=_new_id)
    google_books_id = db.Column(db.String(128), unique=True, index=True, nullable=True)
    isbn_10 = db.Column(db.String(10), index=True, nullable=True)
    isbn_13 = db.Column(db.String(13), index=True, nullable=True)

    title = db.Column(db.String(500), nullable=False)
    title_normalized = db.Column(db.String(500), index=True, nullable=False)
    subtitle = db.Column(db.String(500), nullable=True)
    primary_author = db.Column(db.String(255), index=True, nullable=True)
    authors_json = db.Column(db.JSON, nullable=False, default=list)
    categories_json = db.Column(db.JSON, nullable=False, default=list)
    publisher = db.Column(db.String(255), nullable=True)
    published_date = db.Column(db.String(32), nullable=True)
    published_year = db.Column(db.Integer, index=True, nullable=True)
    thumbnail_url = db.Column(db.Text, nullable=True)
    page_count = db.Column(db.Integer, nullable=True)
    synopsis = db.Column(db.Text, nullable=True)
    info_link = db.Column(db.Text, nullable=True)

    user_books = db.relationship("UserBook", back_populates="book", cascade="all, delete-orphan")


class UserBook(TimestampMixin, db.Model):
    __tablename__ = "user_books"

    id = db.Column(db.String(36), primary_key=True, default=_new_id)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    book_id = db.Column(db.String(36), db.ForeignKey("books.id", ondelete="CASCADE"), index=True, nullable=False)

    shelf = db.Column(db.String(32), default="read", nullable=False)
    status = db.Column(db.String(32), default="owned", nullable=False)
    source = db.Column(db.String(32), default="scan", nullable=False)

    loaned = db.Column(db.Boolean, default=False, nullable=False)
    rating = db.Column(db.Float, nullable=True)
    review = db.Column(db.Text, nullable=True)
    liked = db.Column(db.Boolean, default=False, nullable=False)
    reread = db.Column(db.Boolean, default=False, nullable=False)
    started_at = db.Column(db.DateTime(timezone=True), nullable=True)
    finished_at = db.Column(db.DateTime(timezone=True), nullable=True)

    user = db.relationship("User", back_populates="user_books")
    book = db.relationship("Book", back_populates="user_books")
    loans = db.relationship("Loan", back_populates="user_book", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("user_id", "book_id", name="uq_user_books_user_book"),
        CheckConstraint("shelf IN ('want_to_read', 'reading', 'read', 'custom')", name="ck_user_books_shelf"),
    )


class Friend(TimestampMixin, db.Model):
    __tablename__ = "friends"

    id = db.Column(db.String(36), primary_key=True, default=_new_id)
    user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    friend_user_id = db.Column(
        db.String(36),
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(320), nullable=True)
    avatar_url = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(16), default="active", nullable=False)

    user = db.relationship("User", foreign_keys=[user_id], back_populates="friends")

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "name",
            name="uq_friends_user_name",
        ),
        CheckConstraint(
            "status IN ('active', 'blocked')",
            name="ck_friends_status",
        ),
    )


class Loan(TimestampMixin, db.Model):
    __tablename__ = "loans"

    id = db.Column(db.String(36), primary_key=True, default=_new_id)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    user_book_id = db.Column(
        db.String(36),
        db.ForeignKey("user_books.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    friend_id = db.Column(
        db.String(36),
        db.ForeignKey("friends.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    borrower_name = db.Column(db.String(120), nullable=False)
    borrower_contact = db.Column(db.String(320), nullable=True)
    lent_at = db.Column(db.DateTime(timezone=True), default=_utcnow, nullable=False)
    due_at = db.Column(db.DateTime(timezone=True), nullable=True)
    returned_at = db.Column(db.DateTime(timezone=True), nullable=True)
    note = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(16), default="active", nullable=False)

    user = db.relationship("User", back_populates="loans")
    user_book = db.relationship("UserBook", back_populates="loans")
    friend = db.relationship("Friend", foreign_keys=[friend_id])

    __table_args__ = (
        CheckConstraint("status IN ('active', 'returned')", name="ck_loans_status"),
    )
