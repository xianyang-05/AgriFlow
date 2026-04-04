from fastapi import APIRouter

from app.routes.chat import router as chat_router
from app.routes.crops import router as crops_router
from app.routes.health import router as health_router
from app.routes.measurements import router as measurements_router
from app.routes.recommendations import router as recommendations_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(crops_router)
api_router.include_router(measurements_router)
api_router.include_router(recommendations_router)
api_router.include_router(chat_router)

__all__ = ["api_router"]
