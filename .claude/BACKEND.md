# Backend Context

Quick-reference for working on the backend (`backend/`). For full project overview, see [CLAUDE.md](CLAUDE.md).

## Quick Start

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload     # port 8000
pytest                            # 19 tests
```

## File Map

| File | Purpose |
|------|---------|
| `app/main.py` | FastAPI app, CORS (localhost:5173 + study-assistant.vercel.app), router registration, `create_db()` on startup, `GET /ping` |
| `app/config.py` | `pydantic_settings.BaseSettings`, resolves paths to absolute via `BACKEND_DIR`. Azure OpenAI config for both chat and embeddings. Auto-creates runtime dirs on import |
| `app/database.py` | SQLite engine (`check_same_thread=False`), `create_db()`, `get_db()` dependency |

### Routers

| Router | Endpoints | Key Details |
|--------|-----------|-------------|
| `routers/upload.py` | `POST /upload` | Accepts `files[]` + optional `session_id` (Form). Max 5 files, 20 MB each. Creates session if none. Pipeline: save PDF -> parse -> chunk -> embed -> FAISS + SQLite |
| `routers/chat.py` | `POST /chat` | Body: `{session_id, question, history}`. Path traversal guard. FAISS top-5 search. Low confidence if best score < 0.70. Returns SSE: token -> citations -> done (or error) |
| `routers/sessions.py` | `GET /sessions`, `POST /sessions`, `DELETE /sessions/{id}` | GET auto-prunes sessions with 0 docs. DELETE removes chunks, docs, FAISS index, uploaded files |
| `routers/documents.py` | `GET /documents`, `DELETE /documents/{id}` | GET requires `session_id` query param. DELETE removes chunks + FAISS vectors; deletes index file if empty |

### Services

| Service | Functions | Details |
|---------|-----------|---------|
| `services/pdf_parser.py` | `parse_pdf(file_path) -> List[ParsedPage]` | PyMuPDF (`fitz`), page-by-page extraction. `ParsedPage(page_num, text)` |
| `services/chunker.py` | `chunk_pages(pages, chunk_size=512, overlap=50) -> List[TextChunk]` | LangChain `RecursiveCharacterTextSplitter`. `TextChunk(text, page_num, chunk_index)` |
| `services/embedder.py` | `embed_texts(texts) -> np.ndarray` | Azure OpenAI `text-embedding-3-large`, returns L2-normalized `(N, 3072)` array. `EMBEDDING_DIM = 3072`. Raises `ValueError` on empty input |
| `services/vector_store.py` | `VectorStore` class | FAISS `IndexIDMap(IndexFlatIP(dim))`. Methods: `add_vectors`, `search(query, k=5)`, `remove_by_ids`, `save`, `load`. Property: `ntotal` |
| `services/llm.py` | `build_context(...)`, `stream_answer(...) -> Generator[str]` | Azure OpenAI GPT-4.1 streaming. System prompt instructs citation format `[Source: file, p.N]`. History capped at 10 turns |

### Models (SQLModel)

**Session**: `id: str` (uuid4 hex, PK), `name: str`, `created_at: datetime`

**Document**: `id: int` (auto PK), `session_id: str` (FK), `file_name: str`, `pages: int`, `chunks: int`

**Chunk**: `id: int` (auto PK), `session_id: str` (indexed), `doc_id: int` (FK), `file_name: str`, `page_num: int`, `chunk_index: int`, `text: str`

## Tests (19 total)

| File | Count | What's Tested |
|------|-------|---------------|
| `test_upload.py` | 4 | Upload creates session, upload to existing session, rejects non-PDF, rejects >20MB |
| `test_chat.py` | 5 | SSE stream with tokens/citations, 404 missing index, 422 missing session_id, low confidence flag, error event on LLM failure |
| `test_documents.py` | 4 | List docs, delete removes chunks/vectors, 404 non-existent, deleting last doc removes index file |
| `test_sessions.py` | 3 | List ordered by created_at, auto-prune empty sessions, delete removes all data |
| `test_pdf_parser.py` | 1 | Parse sample PDF returns correct pages |
| `test_chunker.py` | 1 | Chunks parsed pages correctly |
| `test_vector_store.py` | 1 | Add, search, remove vectors |

- All OpenAI calls mocked with `unittest.mock`
- `conftest.py` provides: `test_db` (in-memory SQLite), `client` (TestClient with DB override), `sample_pdf` (real tiny PDF via PyMuPDF)

## Dependencies (pinned)

fastapi 0.111.0, uvicorn 0.29.0, pymupdf 1.24.0, langchain 0.2.0, langchain-text-splitters 0.2.0, openai 1.30.0, faiss-cpu 1.13.0, sqlmodel 0.0.19, pydantic-settings 2.2.1, numpy 1.26.4, sse-starlette 2.1.0, python-multipart 0.0.9, httpx 0.27.0, pytest 8.2.0

## Environment Variables

```
# Azure OpenAI — Chat (GPT-4.1)
CHAT_API_KEY=...
CHAT_API_ENDPOINT=https://...openai.azure.com/
CHAT_DEPLOYMENT=gpt-4.1              # default
CHAT_API_VERSION=2024-12-01-preview   # default

# Azure OpenAI — Embeddings (text-embedding-3-large)
EMBEDDING_API_KEY=...
EMBEDDING_API_ENDPOINT=https://...openai.azure.com/
EMBEDDING_DEPLOYMENT=text-embedding-3-large   # default
EMBEDDING_API_VERSION=2024-12-01-preview      # default

# Storage (defaults resolve to absolute paths under backend/)
DATABASE_URL=sqlite:///{BACKEND_DIR}/data/study_assistant.db
FAISS_INDEX_DIR={BACKEND_DIR}/data/faiss_indices
UPLOAD_DIR={BACKEND_DIR}/uploads
```

All keys default to `""` so tests can import config without real credentials. Runtime dirs auto-created on config import.

## Deployment

Railway.app via `Dockerfile` (python:3.11-slim) and `railway.json`. Set env vars in Railway dashboard.

## Gotchas

- **Azure OpenAI** — uses `AzureOpenAI` client (not direct OpenAI). Separate keys/endpoints for chat vs embeddings
- **Embedding dim is 3072** — `text-embedding-3-large` produces 3072-dim vectors, not 1536
- **CORS origins** — explicitly lists `localhost:5173` and `study-assistant.vercel.app` (not wildcard `*`)
- FAISS version is `1.13.0` (not 1.8.0 — that doesn't exist on PyPI)
- Path traversal guards in `chat.py` and `documents.py` validate index paths stay within `faiss_index_dir`
- Empty FAISS index files are deleted (not saved) to prevent 422/404 on chat
- SSE error events are yielded on exception instead of silently closing the stream
- Session auto-prune happens on `GET /sessions`
- Config auto-creates `data/`, `data/faiss_indices/`, and `uploads/` dirs on import
