import json
from unittest.mock import patch, MagicMock
import numpy as np
import fitz
import io


def mock_embed(texts):
    vecs = np.random.randn(len(texts), 3072).astype(np.float32)
    norms = np.linalg.norm(vecs, axis=1, keepdims=True)
    return vecs / norms


def test_export_returns_markdown(client, auth_headers):
    """GET /sessions/{id}/export returns a markdown file."""
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Test content for export. " * 50)
    buf = io.BytesIO()
    doc.save(buf)
    pdf_bytes = buf.getvalue()

    with patch("app.routers.upload.embed_texts", side_effect=mock_embed):
        upload_resp = client.post(
            "/upload",
            files=[("files", ("notes.pdf", pdf_bytes, "application/pdf"))],
            headers=auth_headers,
        )
    session_id = upload_resp.json()["session_id"]

    # Send a chat message
    mock_stream = MagicMock(return_value=iter(["Test", " answer."]))
    with patch("app.routers.chat.embed_texts", side_effect=mock_embed), \
        patch("app.routers.chat.stream_answer", mock_stream):
        client.post(
            "/chat",
            json={"session_id": session_id, "question": "What is this about?"},
            headers={**auth_headers, "Accept": "text/event-stream"},
        )

    # Export
    resp = client.get(f"/sessions/{session_id}/export", headers=auth_headers)
    assert resp.status_code == 200
    assert "text/markdown" in resp.headers["content-type"]
    body = resp.text
    assert "# Study Session:" in body
    assert "What is this about?" in body
    assert "Test answer." in body
    assert "notes.pdf" in body


def test_export_requires_auth(client):
    resp = client.get("/sessions/fake-id/export")
    assert resp.status_code == 401
