from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.chat import ChatRequest, ChatResponse, PreviewChatRequest
from app.services.chat_service import ChatService

router = APIRouter(prefix="/chat", tags=["chat"])
chat_service = ChatService()


@router.post("", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
) -> ChatResponse:
    return chat_service.handle(db, payload)


@router.post("/preview", response_model=ChatResponse)
async def preview_chat(
    payload: PreviewChatRequest,
    db: Session = Depends(get_db),
) -> ChatResponse:
    return chat_service.handle_preview(db, payload)
