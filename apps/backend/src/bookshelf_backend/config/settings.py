"""Environment and runtime settings for the Flask backend."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any


TRUE_VALUES = {"1", "true", "yes", "y", "on"}


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[5]


def _backend_root() -> Path:
    return Path(__file__).resolve().parents[3]


def default_model_path() -> str:
    return str(_repo_root() / "yolov8n.pt")


def _default_sqlite_uri() -> str:
    db_path = _backend_root() / ".local" / "dev.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{db_path}"


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


def _read_bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in TRUE_VALUES


@dataclass(frozen=True)
class Settings:
    env: str
    enable_dev_identity_fallback: bool
    scan_enabled: bool
    allowed_origins: str
    model_path: str
    detect_confidence: float
    detect_iou_threshold: float
    detect_device: str
    detect_classes: list[int] | None
    extract_model: str
    extract_device: str
    extract_local_only: bool | None
    lookup_timeout: int
    lookup_max_results: int
    database_url: str
    dev_user_email: str
    dev_user_username: str


def _parse_classes(raw_value: str) -> list[int] | None:
    chunks = [chunk.strip() for chunk in raw_value.split(",") if chunk.strip()]
    if not chunks:
        return None
    return [int(chunk) for chunk in chunks]


def build_settings_from_env() -> Settings:
    _load_env_file(_repo_root() / "secrets" / ".env")

    env = (os.getenv("BOOKSHELF_ENV") or "development").strip().lower() or "development"
    fallback_default = env != "production"
    enable_dev_identity_fallback = _read_bool_env(
        "BOOKSHELF_ENABLE_DEV_IDENTITY_FALLBACK",
        fallback_default,
    )
    scan_enabled = _read_bool_env("BOOKSHELF_SCAN_ENABLED", True)
    allowed_origins = (os.getenv("BOOKSHELF_ALLOWED_ORIGINS") or "*").strip() or "*"
    model_path = (os.getenv("BOOKSHELF_MODEL_PATH") or default_model_path()).strip()
    detect_confidence = float(os.getenv("BOOKSHELF_DETECT_CONFIDENCE", "0.15"))
    detect_iou_threshold = float(os.getenv("BOOKSHELF_DETECT_IOU", "0.45"))
    detect_device = (os.getenv("BOOKSHELF_DETECT_DEVICE") or "auto").strip() or "auto"
    detect_classes = _parse_classes(os.getenv("BOOKSHELF_DETECT_CLASSES", "0"))
    extract_model = (os.getenv("BOOKSHELF_EXTRACT_MODEL") or "moondream-0.5b").strip() or "moondream-0.5b"
    extract_device = (os.getenv("BOOKSHELF_EXTRACT_DEVICE") or "auto").strip() or "auto"
    extract_local_only = (
        True if _read_bool_env("BOOKSHELF_EXTRACT_LOCAL_ONLY", False) else None
    )
    lookup_timeout = int(os.getenv("BOOKSHELF_LOOKUP_TIMEOUT", "10"))
    lookup_max_results = int(os.getenv("BOOKSHELF_LOOKUP_MAX_RESULTS", "5"))
    raw_database_url = (os.getenv("DATABASE_URL") or "").strip()
    if raw_database_url:
        database_url = raw_database_url
    elif env == "production":
        database_url = ""
    else:
        database_url = _default_sqlite_uri()
    dev_user_email = (
        os.getenv("BOOKSHELF_DEV_USER_EMAIL") or "localdev@bookshelf.local"
    ).strip() or "localdev@bookshelf.local"
    dev_user_username = (os.getenv("BOOKSHELF_DEV_USER_USERNAME") or "localdev").strip() or "localdev"

    return Settings(
        env=env,
        enable_dev_identity_fallback=enable_dev_identity_fallback,
        scan_enabled=scan_enabled,
        allowed_origins=allowed_origins,
        model_path=model_path,
        detect_confidence=detect_confidence,
        detect_iou_threshold=detect_iou_threshold,
        detect_device=detect_device,
        detect_classes=detect_classes,
        extract_model=extract_model,
        extract_device=extract_device,
        extract_local_only=extract_local_only,
        lookup_timeout=lookup_timeout,
        lookup_max_results=lookup_max_results,
        database_url=database_url,
        dev_user_email=dev_user_email,
        dev_user_username=dev_user_username,
    )


def apply_settings_defaults(config: dict[str, Any], settings: Settings) -> None:
    config.setdefault("BOOKSHELF_ENV", settings.env)
    config.setdefault(
        "BOOKSHELF_ENABLE_DEV_IDENTITY_FALLBACK",
        settings.enable_dev_identity_fallback,
    )
    config.setdefault("BOOKSHELF_SCAN_ENABLED", settings.scan_enabled)
    config.setdefault("BOOKSHELF_ALLOWED_ORIGINS", settings.allowed_origins)
    config.setdefault("BOOKSHELF_MODEL_PATH", settings.model_path)
    config.setdefault("BOOKSHELF_DETECT_CONFIDENCE", settings.detect_confidence)
    config.setdefault("BOOKSHELF_DETECT_IOU", settings.detect_iou_threshold)
    config.setdefault("BOOKSHELF_DETECT_DEVICE", settings.detect_device)
    config.setdefault("BOOKSHELF_DETECT_CLASSES", settings.detect_classes)
    config.setdefault("BOOKSHELF_EXTRACT_MODEL", settings.extract_model)
    config.setdefault("BOOKSHELF_EXTRACT_DEVICE", settings.extract_device)
    config.setdefault("BOOKSHELF_EXTRACT_LOCAL_ONLY", settings.extract_local_only)
    config.setdefault("BOOKSHELF_LOOKUP_TIMEOUT", settings.lookup_timeout)
    config.setdefault("BOOKSHELF_LOOKUP_MAX_RESULTS", settings.lookup_max_results)
    config.setdefault("DATABASE_URL", settings.database_url)
    config.setdefault("BOOKSHELF_DEV_USER_EMAIL", settings.dev_user_email)
    config.setdefault("BOOKSHELF_DEV_USER_USERNAME", settings.dev_user_username)
    config.setdefault("SQLALCHEMY_DATABASE_URI", settings.database_url)
    config.setdefault("SQLALCHEMY_TRACK_MODIFICATIONS", False)
    config.setdefault("SQLALCHEMY_ECHO", False)


def validate_runtime_config(config: dict[str, Any]) -> None:
    env = str(config.get("BOOKSHELF_ENV", "development")).strip().lower() or "development"
    fallback_enabled = bool(config.get("BOOKSHELF_ENABLE_DEV_IDENTITY_FALLBACK", env != "production"))
    database_url = str(
        config.get("DATABASE_URL")
        or config.get("SQLALCHEMY_DATABASE_URI")
        or ""
    ).strip()

    if env == "production" and fallback_enabled:
        raise RuntimeError(
            "BOOKSHELF_ENABLE_DEV_IDENTITY_FALLBACK cannot be enabled in production."
        )
    if env == "production" and not database_url:
        raise RuntimeError("DATABASE_URL is required when BOOKSHELF_ENV=production.")


def cors_origins(raw_value: str | None) -> str | list[str]:
    value = (raw_value or "*").strip()
    if not value or value == "*":
        return "*"
    return [chunk.strip() for chunk in value.split(",") if chunk.strip()]
