"""
Centralized configuration — all environment variables and constants defined here.
"""
import os
import re
from typing import List, Optional

APP_VERSION = "0.1.0"
API_PREFIX = "/api"
ALLOWED_LOG_LEVELS = ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL")


def parse_log_level(value: str) -> str:
    """Normalize and validate a Python logging level."""
    normalized = value.strip().upper()
    if normalized not in ALLOWED_LOG_LEVELS:
        allowed = ", ".join(ALLOWED_LOG_LEVELS)
        raise ValueError(f"LOG_LEVEL must be one of: {allowed}")
    return normalized


class Settings:
    """Application settings from environment variables with safe defaults."""

    # ── Security ──────────────────────────────────────────────────────────
    API_KEY: Optional[str] = os.getenv("APP_API_KEY", "").strip() or None

    _cors_env = os.getenv("CORS_ORIGINS", "http://localhost:3020,http://localhost:8082")
    CORS_ORIGINS: List[str] = [o.strip() for o in _cors_env.split(",") if o.strip()]

    _trusted_env = os.getenv("TRUSTED_HOSTS", "localhost,127.0.0.1")
    TRUSTED_HOSTS: List[str] = [h.strip() for h in _trusted_env.split(",") if h.strip()]

    # ── API ────────────────────────────────────────────────────────────────
    API_PREFIX: str = API_PREFIX

    # ── Paths ─────────────────────────────────────────────────────────────
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DATA_DIR = os.path.join(BASE_DIR, "data")

    # ── Logging ───────────────────────────────────────────────────────────
    LOG_LEVEL: str = parse_log_level(os.getenv("LOG_LEVEL", "INFO"))

    # ── Helpers ───────────────────────────────────────────────────────────
    @classmethod
    def sanitize_input(cls, value: str, allowed_pattern: str = r"[^a-zA-Z0-9._-]") -> str:
        """
        Sanitize user-supplied input against path traversal and injection.

        Removes path separators and characters outside the allowed pattern,
        strips leading dots, and caps length at 64.
        """
        if not value:
            return ""
        sanitized = value.replace("/", "").replace("\\", "").replace("..", "")
        sanitized = re.sub(allowed_pattern, "", sanitized)
        sanitized = sanitized.strip(".")
        return sanitized[:64]


settings = Settings()
