from sqlalchemy import asc, desc, select
from sqlalchemy.orm import Session

from app.models.chat_message import ChatMessage


class ChatRepository:
    def list_recent(self, db: Session, run_id: str, limit: int = 10) -> list[ChatMessage]:
        subquery = (
            select(ChatMessage)
            .where(ChatMessage.run_id == run_id)
            .order_by(desc(ChatMessage.created_at))
            .limit(limit)
            .subquery()
        )
        statement = select(subquery).order_by(asc(subquery.c.created_at))
        return [ChatMessage(**row._mapping) for row in db.execute(statement).all()]

    def create(self, db: Session, run_id: str, role: str, message: str, intent: str | None = None) -> ChatMessage:
        chat_message = ChatMessage(run_id=run_id, role=role, message=message, intent=intent)
        db.add(chat_message)
        db.commit()
        db.refresh(chat_message)
        return chat_message
