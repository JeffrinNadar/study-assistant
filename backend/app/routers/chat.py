from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List
from sqlmodel import Session as DBSession, select
import json
import os

from app.database import get_db
from app.config import settings
from app.models.chunk import Chunk
from app.services.embedder import embed_texts
from app.services.vector_store import VectorStore
from app.services.llm import stream_answer

router = APIRouter()

LOW_CONFIDENCE_THRESHOLD = 0.70

class ChatRequest(BaseModel):
    session_id: str
    question: str
    history: List[dict] = []

@router.post("/chat")
async def chat(request: ChatRequest, db: DBSession = Depends(get_db)):
    index_path = f"{settings.faiss_index_dir}/{request.session_id}.index"
    if not os.path.exists(index_path):
        raise HTTPException(status_code=404, detail="Session index not found")

    store = VectorStore(index_path=index_path)
    store.load()

    # Embed the question
    query_vector = embed_texts([request.question])
    chunk_ids, scores = store.search(query_vector, k=5)

    if not chunk_ids:
        raise HTTPException(status_code=422, detail="No indexed content in session")

    # Fetch chunks from SQLite
    chunks = db.exec(select(Chunk).where(Chunk.id.in_(chunk_ids))).all()
    # Order by score (FAISS returns in score order, but SQLite .in_ may reorder)
    id_to_score = dict(zip(chunk_ids, scores))
    chunks.sort(key=lambda c: id_to_score.get(c.id, 0), reverse=True)

    top_score = scores[0] if scores else 0.0
    low_confidence = top_score < LOW_CONFIDENCE_THRESHOLD

    def event_stream():
        # Stream tokens
        for token in stream_answer(request.question, chunks, request.history):
            yield f"event: token\ndata: {json.dumps({'content': token})}\n\n"

        # Emit citations event
        citations = [
            {"file": c.file_name, "page": c.page_num, "text": c.text, "score": id_to_score.get(c.id, 0)}
            for c in chunks
        ]
        yield f"event: citations\ndata: {json.dumps({'citations': citations, 'low_confidence': low_confidence})}\n\n"

        # Done
        yield f"event: done\ndata: {{}}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
