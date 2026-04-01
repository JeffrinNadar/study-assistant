from fastapi import APIRouter, Depends
from sqlmodel import Session as DBSession, select
from app.database import get_db
from app.models.session import Session
from app.models.document import Document

router = APIRouter()

@router.get("/sessions")
def list_sessions(db: DBSession = Depends(get_db)):
    sessions = db.exec(select(Session).order_by(Session.created_at.desc())).all()
    result = []
    for s in sessions:
        doc_count = len(db.exec(select(Document).where(Document.session_id == s.id)).all())
        result.append({
            "id": s.id,
            "name": s.name,
            "created_at": s.created_at.isoformat(),
            "doc_count": doc_count,
        })
    return result

@router.post("/sessions")
def create_session(name: str, db: DBSession = Depends(get_db)):
    session = Session(name=name)
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"id": session.id, "name": session.name, "created_at": session.created_at.isoformat(), "doc_count": 0}
