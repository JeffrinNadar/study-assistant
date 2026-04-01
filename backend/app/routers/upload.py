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

router = APIRouter()

@router.post("/upload")
async def upload(
    files: List[UploadFile] = File(...),
    session_id: Optional[str] = Form(None),
    db: DBSession = Depends(get_db),
):
    # Create or fetch session
    if session_id:
        session = db.get(Session, session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
    else:
        session = Session(name="New Session")
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
        content = await upload_file.read()
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
