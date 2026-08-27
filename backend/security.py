"""
Security helpers and middleware registration.
"""
import logging
from urllib.parse import urlparse

from fastapi import Request
from fastapi.responses import JSONResponse


def normalize_origin(url: str) -> str:
    """
    Normalize a browser origin or referer to scheme://host[:port].
    """
    if not url:
        return ""

    parsed = urlparse(url)
    if not parsed.scheme or not parsed.hostname:
        return ""

    port = f":{parsed.port}" if parsed.port else ""
    return f"{parsed.scheme}://{parsed.hostname}{port}"


def is_trusted_browser_request(origin: str, referer: str, trusted_origins: list[str]) -> bool:
    """Trust only explicit browser origins, not raw Host headers."""
    normalized_trusted_origins = {
        normalized
        for normalized in (normalize_origin(value) for value in trusted_origins)
        if normalized
    }
    request_origins = {
        normalized
        for normalized in (normalize_origin(origin), normalize_origin(referer))
        if normalized
    }
    return bool(request_origins & normalized_trusted_origins)


def register_security_middleware(app, settings) -> None:
    """
    Register request-level security checks for browser and external traffic.
    """
    logger = logging.getLogger(__name__)

    @app.middleware("http")
    async def security_middleware(request: Request, call_next):
        """
        - Always allows /health, /, /api/docs, /api/openapi.json
        - Allows requests from trusted browser origins (same-origin app / docs)
        - Requires X-API-Key for external requests when APP_API_KEY is set
        """
        docs_prefix = f"{settings.API_PREFIX}/docs"
        public_paths = {
            "/",
            "/health",
            f"{settings.API_PREFIX}/health",
            f"{settings.API_PREFIX}/openapi.json",
        }
        if request.url.path in public_paths or request.url.path.startswith(docs_prefix):
            return await call_next(request)

        origin = request.headers.get("origin", "")
        referer = request.headers.get("referer", "")

        if is_trusted_browser_request(origin, referer, settings.CORS_ORIGINS):
            return await call_next(request)

        if settings.API_KEY:
            api_key = request.headers.get("X-API-Key", "")
            if api_key != settings.API_KEY:
                logger.warning("Unauthorized request to %s from %s", request.url.path, request.client.host)
                return JSONResponse(
                    status_code=401,
                    content={"error": "Unauthorized", "message": "API key required. Add X-API-Key header."},
                )

        return await call_next(request)
