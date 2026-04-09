import json
import shutil
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session as DBSession, select
from app.database import get_db
from app.models.session import Session
from app.models.document import Document
from app.models.chunk import Chunk
from app.models.chat_message import ChatMessage
from app.config import settings
from app.models.user import User
from app.services.auth import get_current_user

router = APIRouter()


@router.get("/sessions")
def list_sessions(db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    sessions = db.exec(select(Session).where(Session.user_id == current_user.id).order_by(Session.created_at.desc())).all()
    result = []
    for s in sessions:
        doc_count = len(db.exec(select(Document).where(Document.session_id == s.id)).all())
        if doc_count == 0:
            # Auto-prune empty sessions and their leftover data
            _delete_session_data(s.id, db)
            continue
        result.append({
            "id": s.id,
            "name": s.name,
            "created_at": s.created_at.isoformat(),
            "doc_count": doc_count,
        })
    return result


@router.post("/sessions")
def create_session(name: str, db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = Session(name=name, user_id=current_user.id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"id": session.id, "name": session.name, "created_at": session.created_at.isoformat(), "doc_count": 0}


class RenameRequest(BaseModel):
    name: str


@router.patch("/sessions/{session_id}")
def rename_session(session_id: str, body: RenameRequest, db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = db.get(Session, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    session.name = body.name[:100]  # cap at 100 chars
    db.commit()
    db.refresh(session)
    return {"id": session.id, "name": session.name}


@router.delete("/sessions/{session_id}")
def delete_session(session_id: str, db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = db.get(Session, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    _delete_session_data(session_id, db)
    return {"success": True}


@router.get("/messages")
def list_messages(session_id: str, db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = db.get(Session, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    messages = db.exec(
        select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at)
    ).all()
    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "citations": json.loads(m.citations) if m.citations else None,
            "low_confidence": m.low_confidence,
            "created_at": m.created_at.isoformat(),
        }
        for m in messages
    ]


def _delete_session_data(session_id: str, db: DBSession):
    """Remove all data associated with a session: chunks, documents, FAISS index, uploads, and the session row."""
    # Delete chat messages
    chat_messages = db.exec(select(ChatMessage).where(ChatMessage.session_id == session_id)).all()
    for m in chat_messages:
        db.delete(m)

    # Delete chunks
    chunks = db.exec(select(Chunk).where(Chunk.session_id == session_id)).all()
    for c in chunks:
        db.delete(c)

    # Delete documents
    docs = db.exec(select(Document).where(Document.session_id == session_id)).all()
    for d in docs:
        db.delete(d)

    # Delete session
    session = db.get(Session, session_id)
    if session:
        db.delete(session)

    db.commit()

    # Remove FAISS index file
    index_path = Path(settings.faiss_index_dir) / f"{session_id}.index"
    if index_path.exists():
        index_path.unlink()

    # Remove uploaded files directory
    upload_path = Path(settings.upload_dir) / session_id
    if upload_path.exists():
        shutil.rmtree(upload_path)
