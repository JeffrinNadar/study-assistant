from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List
from sqlmodel import Session as DBSession, select
import json
import os
import pathlib

from app.database import get_db, engine
from app.config import settings
from app.models.chunk import Chunk
from app.models.session import Session
from app.models.user import User
from app.services.embedder import embed_texts
from app.services.vector_store import VectorStore
from app.services.llm import stream_answer
from app.services.auth import get_current_user
from app.models.chat_message import ChatMessage
from app.services.rate_limiter import chat_limiter

router = APIRouter()

LOW_CONFIDENCE_THRESHOLD = 0.70

class ChatRequest(BaseModel):
    session_id: str
    question: str

@router.post("/chat")
async def chat(request: ChatRequest, db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Verify session belongs to current user
    session = db.get(Session, request.session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    # Rate limit
    if not chat_limiter.check(current_user.id):
        raise HTTPException(
            status_code=429,
            detail=f"Too many requests. Try again in {chat_limiter.retry_after(current_user.id)} seconds.",
            headers={"Retry-After": str(chat_limiter.retry_after(current_user.id))},
        )

    index_path = (pathlib.Path(settings.faiss_index_dir) / f"{request.session_id}.index").resolve()
    allowed = pathlib.Path(settings.faiss_index_dir).resolve()
    if not str(index_path).startswith(str(allowed)):
        raise HTTPException(status_code=400, detail="Invalid session_id")
    index_path = str(index_path)

    if not os.path.exists(index_path):
        raise HTTPException(status_code=404, detail="No documents in this session. Upload a PDF first.")

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

    # Eagerly extract chunk data as plain dicts to avoid detached-instance errors in generator
    chunk_dicts = [
        {"file": c.file_name, "page": c.page_num, "text": c.text, "score": id_to_score.get(c.id, 0)}
        for c in chunks
    ]

    # Auto-name session from first user question
    if session.name == "New Session":
        session.name = request.question[:100]
        db.add(session)

    # Save user message
    user_msg = ChatMessage(session_id=request.session_id, role="user", content=request.question)
    db.add(user_msg)
    db.commit()

    # Load history from DB (last 10 messages before the one we just saved)
    history_rows = db.exec(
        select(ChatMessage)
        .where(ChatMessage.session_id == request.session_id)
        .order_by(ChatMessage.created_at)
    ).all()
    history = [{"role": m.role, "content": m.content} for m in history_rows[-11:-1]]

    session_id = request.session_id
    question = request.question

    def event_stream():
        try:
            full_response = []
            for token in stream_answer(question, chunk_dicts, history):
                full_response.append(token)
                yield f"event: token\ndata: {json.dumps({'content': token})}\n\n"

            yield f"event: citations\ndata: {json.dumps({'citations': chunk_dicts, 'low_confidence': low_confidence})}\n\n"

            # Save assistant message using a fresh DB session
            with DBSession(engine) as save_db:
                assistant_msg = ChatMessage(
                    session_id=session_id,
                    role="assistant",
                    content="".join(full_response),
                    citations=json.dumps(chunk_dicts),
                    low_confidence=low_confidence,
                )
                save_db.add(assistant_msg)
                save_db.commit()

            yield f"event: done\ndata: {json.dumps({})}\n\n"
        except Exception as exc:
            yield f"event: error\ndata: {json.dumps({'detail': str(exc)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
