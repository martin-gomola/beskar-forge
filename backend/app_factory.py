"""
FastAPI application factory and bootstrap wiring.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from starlette.middleware.trustedhost import TrustedHostMiddleware

from api import field_notes, routes
from config import settings
from config.settings import APP_VERSION
from security import register_security_middleware


limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])


def configure_logging() -> None:
    """
    Configure the root logger once.
    """
    logging.basicConfig(
        level=getattr(logging, settings.LOG_LEVEL),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[logging.StreamHandler()],
    )


@asynccontextmanager
async def lifespan(_: FastAPI):
    """
    Log startup configuration when the application boots.
    """
    logger = logging.getLogger(__name__)
    logger.info("API started (v%s)", APP_VERSION)
    logger.info("API prefix: %s", settings.API_PREFIX)
    logger.info("CORS origins: %s", settings.CORS_ORIGINS)
    logger.info("Allowed hosts: %s", settings.TRUSTED_HOSTS)
    if settings.API_KEY:
        logger.info("API key protection: ENABLED")
    else:
        logger.warning("API key protection: DISABLED (set APP_API_KEY to enable)")
    yield


def create_app() -> FastAPI:
    """
    Build the FastAPI application with middleware, routes, and startup hooks.
    """
    configure_logging()
    app = FastAPI(
        title="API",
        description="Stateless API backend",
        version=APP_VERSION,
        docs_url=f"{settings.API_PREFIX}/docs",
        openapi_url=f"{settings.API_PREFIX}/openapi.json",
        lifespan=lifespan,
    )

    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "X-API-Key", "Authorization"],
    )
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.TRUSTED_HOSTS)

    register_security_middleware(app, settings)

    app.include_router(routes.system_router)
    app.include_router(routes.api_router, prefix=settings.API_PREFIX)
    app.include_router(field_notes.router, prefix=settings.API_PREFIX)
    # Add your route modules here:
    # app.include_router(your_module.router, prefix=settings.API_PREFIX)

    return app
