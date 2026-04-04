from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.exceptions import UnsupportedPersistenceModeError
from app.schemas.chat import ChatRequest, ChatResponse, PreviewChatRequest
from app.services.chat_service import ChatService

router = APIRouter(prefix="/chat", tags=["chat"])
chat_service = ChatService()
settings = get_settings()


@router.post("", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
) -> ChatResponse:
    if settings.persistence_mode == "local":
        raise UnsupportedPersistenceModeError(
            "Saved plan chat is disabled in local persistence mode. Use /api/v1/chat/preview instead."
        )
    return chat_service.handle(db, payload)


@router.post("/preview", response_model=ChatResponse)
async def preview_chat(
    payload: PreviewChatRequest,
    db: Session = Depends(get_db),
) -> ChatResponse:
    return chat_service.handle_preview(db, payload)
