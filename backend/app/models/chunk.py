from sqlmodel import SQLModel, Field
from typing import Optional

class Chunk(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: str = Field(index=True)
    doc_id: str = Field(index=True)
    file_name: str
    page_num: int
    chunk_index: int
    text: str
    faiss_id: Optional[int] = None
