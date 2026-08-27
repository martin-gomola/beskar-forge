"""
Health check and version endpoints.
"""
import logging
from fastapi import APIRouter

from config import settings
from config.settings import APP_VERSION

logger = logging.getLogger(__name__)

system_router = APIRouter()
api_router = APIRouter()


@system_router.get("/")
async def root():
    return {
        "status": "healthy",
        "service": "API",
        "version": APP_VERSION,
        "docs_url": f"{settings.API_PREFIX}/docs",
    }


@system_router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "API",
        "version": APP_VERSION,
    }


@api_router.get("/health")
async def api_health_check():
    return {
        "status": "healthy",
        "service": "API",
        "version": APP_VERSION,
    }


@api_router.get("/version")
async def version():
    return {
        "service": "API",
        "version": APP_VERSION,
    }
