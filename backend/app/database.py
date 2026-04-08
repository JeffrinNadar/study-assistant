from sqlmodel import SQLModel, create_engine, Session as DBSession
from app.config import settings
from app.models.chunk import Chunk       # noqa: F401 — registers table
from app.models.document import Document  # noqa: F401
from app.models.session import Session    # noqa: F401
from app.models.user import User          # noqa: F401
from app.models.chat_message import ChatMessage  # noqa: F401

engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})

def create_db():
    SQLModel.metadata.create_all(engine)

def get_db():
    with DBSession(engine) as session:
        yield session
