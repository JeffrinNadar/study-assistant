import pytest
import json
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import numpy as np
import fitz
import io
from app.main import app

@pytest.fixture
def client():
    return TestClient(app)

def mock_embed(texts):
    vecs = np.random.randn(len(texts), 1536).astype(np.float32)
    norms = np.linalg.norm(vecs, axis=1, keepdims=True)
    return vecs / norms

def test_chat_returns_sse_stream(client):
    """Integration test: mock embed + LLM, verify SSE event format."""
    # First, upload a PDF to get a session
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Gradient descent minimizes a loss function. " * 50)
    buf = io.BytesIO()
    doc.save(buf)
    pdf_bytes = buf.getvalue()

    with patch("app.routers.upload.embed_texts", side_effect=mock_embed):
        upload_resp = client.post(
            "/upload",
            files=[("files", ("notes.pdf", pdf_bytes, "application/pdf"))],
        )
    session_id = upload_resp.json()["session_id"]

    mock_stream_answer = MagicMock(return_value=iter(["Gradient", " descent", " minimizes loss."]))

    with patch("app.routers.chat.embed_texts", side_effect=mock_embed), \
         patch("app.routers.chat.stream_answer", mock_stream_answer):
        resp = client.post(
            "/chat",
            json={"session_id": session_id, "question": "What is gradient descent?", "history": []},
            headers={"Accept": "text/event-stream"},
        )

    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers["content-type"]
    body = resp.text
    assert "event: token" in body
    assert "event: citations" in body
    assert "event: done" in body
