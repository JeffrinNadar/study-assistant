import pytest
import io
import fitz
from unittest.mock import patch
import numpy as np


def make_pdf_bytes() -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Test content about machine learning. " * 100)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()

def mock_embed(texts):
    vecs = np.random.randn(len(texts), 3072).astype(np.float32)
    norms = np.linalg.norm(vecs, axis=1, keepdims=True)
    return vecs / norms

def test_upload_returns_session_id_and_chunks(client, auth_headers):
    pdf_bytes = make_pdf_bytes()
    with patch("app.routers.upload.embed_texts", side_effect=mock_embed):
        resp = client.post(
            "/upload",
            files=[("files", ("lecture.pdf", pdf_bytes, "application/pdf"))],
            headers=auth_headers,
        )
    assert resp.status_code == 200
    body = resp.json()
    assert "session_id" in body
    assert len(body["files"]) == 1
    assert body["files"][0]["name"] == "lecture.pdf"
    assert body["files"][0]["chunks"] > 0
    assert body["total_chunks"] > 0

def test_upload_creates_faiss_index(client, auth_headers):
    pdf_bytes = make_pdf_bytes()
    with patch("app.routers.upload.embed_texts", side_effect=mock_embed):
        resp = client.post(
            "/upload",
            files=[("files", ("lecture.pdf", pdf_bytes, "application/pdf"))],
            headers=auth_headers,
        )
    session_id = resp.json()["session_id"]
    import os
    from app.config import settings
    assert os.path.exists(f"{settings.faiss_index_dir}/{session_id}.index")

def test_upload_requires_auth(client):
    pdf_bytes = make_pdf_bytes()
    resp = client.post(
        "/upload",
        files=[("files", ("lecture.pdf", pdf_bytes, "application/pdf"))],
    )
    assert resp.status_code == 401
