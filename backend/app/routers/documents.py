from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session as DBSession, select
from app.database import get_db
from app.models.document import Document
from app.models.chunk import Chunk
from app.models.session import Session
from app.models.user import User
from app.services.vector_store import VectorStore
from app.services.auth import get_current_user
from app.config import settings
import os

router = APIRouter()

@router.get("/documents")
def list_documents(session_id: str, db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Verify session belongs to current user
    session = db.get(Session, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    docs = db.exec(select(Document).where(Document.session_id == session_id)).all()
    return [{"id": d.id, "name": d.file_name, "pages": d.pages, "chunks": d.chunks} for d in docs]

@router.delete("/documents/{doc_id}")
def delete_document(doc_id: str, db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    # Verify ownership via session
    session = db.get(Session, doc.session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")

    # Get chunks to remove from FAISS
    chunks = db.exec(select(Chunk).where(Chunk.doc_id == doc_id)).all()
    faiss_ids = [c.faiss_id for c in chunks if c.faiss_id is not None]

    # Remove from FAISS index
    import pathlib
    index_path = (pathlib.Path(settings.faiss_index_dir) / f"{doc.session_id}.index").resolve()
    allowed = pathlib.Path(settings.faiss_index_dir).resolve()
    if str(index_path).startswith(str(allowed)) and faiss_ids and os.path.exists(str(index_path)):
        store = VectorStore(index_path=str(index_path))
        store.load()
        store.remove_by_ids(faiss_ids)
        if store.total_vectors() == 0:
            os.remove(str(index_path))
        else:
            store.save()

    # Remove from SQLite
    for chunk in chunks:
        db.delete(chunk)
    db.delete(doc)
    db.commit()

    return {"success": True, "chunks_removed": len(chunks)}
