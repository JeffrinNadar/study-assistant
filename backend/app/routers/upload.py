import os
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlmodel import Session as DBSession
from app.database import get_db
from app.config import settings
from app.models.document import Document
from app.models.session import Session
from app.models.chunk import Chunk
from app.services.pdf_parser import parse_pdf
from app.services.chunker import chunk_pages
from app.services.embedder import embed_texts
from app.services.vector_store import VectorStore
from app.models.user import User
from app.services.auth import get_current_user
from app.services.rate_limiter import upload_limiter

router = APIRouter()

MAX_FILES = 5
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

@router.post("/upload")
async def upload(
    files: List[UploadFile] = File(...),
    session_id: Optional[str] = Form(None),
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if len(files) > MAX_FILES:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_FILES} files per upload")

    # Rate limit
    if not upload_limiter.check(current_user.id):
        raise HTTPException(
            status_code=429,
            detail=f"Upload limit reached. Try again in {upload_limiter.retry_after(current_user.id)} seconds.",
            headers={"Retry-After": str(upload_limiter.retry_after(current_user.id))},
        )

    # Check file sizes (read content, then check size)
    file_contents = {}
    for upload_file in files:
        content = await upload_file.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"{upload_file.filename} exceeds 20 MB limit"
            )
        file_contents[upload_file.filename] = content
        await upload_file.seek(0)  # reset for later reading

    # Create or fetch session (scoped to current user)
    if session_id:
        session = db.get(Session, session_id)
        if not session or session.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Session not found")
    else:
        session = Session(name="New Session", user_id=current_user.id)
        db.add(session)
        db.commit()
        db.refresh(session)
        session_id = session.id

    # Load or create FAISS index for this session
    index_path = f"{settings.faiss_index_dir}/{session_id}.index"
    store = VectorStore(index_path=index_path)
    if os.path.exists(index_path):
        store.load()

    result_files = []
    total_chunks = 0

    for upload_file in files:
        # Save uploaded file to disk
        session_upload_dir = os.path.join(settings.upload_dir, session_id)
        os.makedirs(session_upload_dir, exist_ok=True)
        file_path = os.path.join(session_upload_dir, upload_file.filename)
        content = file_contents[upload_file.filename]
        with open(file_path, "wb") as f:
            f.write(content)

        # Parse → chunk → embed
        pages = parse_pdf(file_path)
        text_chunks = chunk_pages(pages)
        if not text_chunks:
            continue

        texts = [c.text for c in text_chunks]
        vectors = embed_texts(texts)

        # Create Document record
        doc = Document(
            session_id=session_id,
            file_name=upload_file.filename,
            pages=len(pages),
            chunks=len(text_chunks),
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        # Insert Chunk records
        chunk_objects = []
        for tc in text_chunks:
            chunk = Chunk(
                session_id=session_id,
                doc_id=doc.id,
                file_name=upload_file.filename,
                page_num=tc.page_num,
                chunk_index=tc.chunk_index,
                text=tc.text,
            )
            db.add(chunk)
            chunk_objects.append(chunk)
        db.commit()
        for chunk in chunk_objects:
            db.refresh(chunk)

        # Use SQLite chunk IDs as FAISS external IDs
        faiss_ids = [c.id for c in chunk_objects]
        store.add_vectors(vectors, external_ids=faiss_ids)

        # Store faiss_ids on chunk rows
        for chunk, fid in zip(chunk_objects, faiss_ids):
            chunk.faiss_id = fid
        db.commit()

        # Update document chunk count
        doc.chunks = len(chunk_objects)
        db.commit()

        result_files.append({
            "name": upload_file.filename,
            "pages": len(pages),
            "chunks": len(chunk_objects),
            "status": "indexed",
        })
        total_chunks += len(chunk_objects)

    store.save()

    return {
        "session_id": session_id,
        "files": result_files,
        "total_chunks": total_chunks,
    }
