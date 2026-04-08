from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime

class ChatMessage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: str = Field(index=True)
    role: str  # "user" or "assistant"
    content: str
    citations: Optional[str] = None  # JSON string, null for user messages
    low_confidence: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
