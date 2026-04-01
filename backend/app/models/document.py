from sqlmodel import SQLModel, Field
from uuid import uuid4

class Document(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    session_id: str = Field(index=True)
    file_name: str
    pages: int
    chunks: int = 0
