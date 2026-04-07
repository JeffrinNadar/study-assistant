# Backend Context

Quick-reference for working on the backend (`backend/`). For full project overview, see [CLAUDE.md](CLAUDE.md).

## Quick Start

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload     # port 8000
pytest                            # 21 tests
```

## File Map

| File | Purpose |
|------|---------|
| `app/main.py` | FastAPI app, CORS (localhost:5173 + study-assistant.vercel.app), router registration, `create_db()` on startup, `GET /ping` |
| `app/config.py` | `pydantic_settings.BaseSettings`, resolves paths to absolute via `BACKEND_DIR`. Azure OpenAI config for both chat and embeddings. Auto-creates runtime dirs on import |
| `app/database.py` | SQLite engine (`check_same_thread=False`), `create_db()`, `get_db()` dependency. Imports all models (Chunk, Document, Session, User) to register tables |

### Routers

All endpoints (except `/ping` and `/auth/*`) require `Authorization: Bearer <token>`. Each protected endpoint takes `current_user: User = Depends(get_current_user)`.

| Router | Endpoints | Key Details |
|--------|-----------|-------------|
| `routers/auth.py` | `POST /auth/signup`, `POST /auth/login` | Accepts `{email, password}`. Returns `{access_token, token_type, user_id, email}`. Signup: 409 on duplicate email. Login: 401 on bad credentials |
| `routers/upload.py` | `POST /upload` | Auth required. Accepts `files[]` + optional `session_id` (Form). Max 5 files, 20 MB each. Creates session with `user_id` if none. Verifies session ownership. Pipeline: save PDF -> parse -> chunk -> embed -> FAISS + SQLite |
| `routers/chat.py` | `POST /chat` | Auth required. Body: `{session_id, question, history}`. Verifies session ownership. Path traversal guard. FAISS top-5 search. Low confidence if best score < 0.70. Returns SSE: token -> citations -> done (or error) |
| `routers/sessions.py` | `GET /sessions`, `POST /sessions`, `DELETE /sessions/{id}` | Auth required. All operations scoped to `current_user.id`. GET auto-prunes sessions with 0 docs. DELETE verifies ownership, removes chunks, docs, FAISS index, uploaded files |
| `routers/documents.py` | `GET /documents`, `DELETE /documents/{id}` | Auth required. GET requires `session_id` query param, verifies session ownership. DELETE verifies ownership via session, removes chunks + FAISS vectors; deletes index file if empty |

### Services

| Service | Functions | Details |
|---------|-----------|---------|
| `services/pdf_parser.py` | `parse_pdf(file_path) -> List[ParsedPage]` | PyMuPDF (`fitz`), page-by-page extraction. `ParsedPage(page_num, text)` |
| `services/chunker.py` | `chunk_pages(pages, chunk_size=512, overlap=50) -> List[TextChunk]` | LangChain `RecursiveCharacterTextSplitter`. `TextChunk(text, page_num, chunk_index)` |
| `services/embedder.py` | `embed_texts(texts) -> np.ndarray` | Azure OpenAI `text-embedding-3-large`, returns L2-normalized `(N, 3072)` array. `EMBEDDING_DIM = 3072`. Raises `ValueError` on empty input |
| `services/vector_store.py` | `VectorStore` class | FAISS `IndexIDMap(IndexFlatIP(dim))`. Methods: `add_vectors`, `search(query, k=5)`, `remove_by_ids`, `save`, `load`. Property: `ntotal` |
| `services/auth.py` | `hash_password`, `verify_password`, `create_access_token`, `get_current_user` | Uses `bcrypt` directly for hashing (not passlib). JWT via `python-jose`. `get_current_user` is a FastAPI `Depends` that decodes JWT and fetches User from DB. `OAuth2PasswordBearer(tokenUrl="/auth/login")` |
| `services/llm.py` | `build_context(...)`, `stream_answer(...) -> Generator[str]` | Azure OpenAI GPT-4.1 streaming. System prompt instructs citation format `[Source: file, p.N]`. History capped at 10 turns |

### Models (SQLModel)

**User**: `id: str` (uuid4, PK), `email: str` (unique, indexed), `hashed_password: str`, `created_at: datetime`

**Session**: `id: str` (uuid4 hex, PK), `user_id: str` (indexed), `name: str`, `created_at: datetime`

**Document**: `id: int` (auto PK), `session_id: str` (FK), `file_name: str`, `pages: int`, `chunks: int`

**Chunk**: `id: int` (auto PK), `session_id: str` (indexed), `doc_id: int` (FK), `file_name: str`, `page_num: int`, `chunk_index: int`, `text: str`

## Tests (21 total)

| File | Count | What's Tested |
|------|-------|---------------|
| `test_upload.py` | 3 | Upload creates session with auth, creates FAISS index, rejects unauthenticated requests (401) |
| `test_chat.py` | 2 | SSE stream with tokens/citations (auth), rejects unauthenticated requests (401) |
| `test_pdf_parser.py` | 3 | Parse returns list, pages have text + page_num, page numbers sequential |
| `test_chunker.py` | 4 | Produces multiple chunks, fields populated, index sequential per page, empty page produces none |
| `test_embedder.py` | 4 | Returns ndarray, correct shape, vectors normalized, empty input raises |
| `test_vector_store.py` | 5 | Add/search returns ids, scores are cosine, remove excludes from results, save/load persists, total_vectors count |

- All OpenAI calls mocked with `unittest.mock`
- `conftest.py` provides: `sample_pdf_path` (real tiny PDF via PyMuPDF), `test_user` (creates User in DB with bcrypt-hashed password, cleaned up after test), `auth_headers` (valid JWT Bearer header for test_user), `client` (TestClient)
- `conftest.py` calls `create_db()` at import time to ensure User table exists
- Test mock vectors use 3072 dimensions (matching `text-embedding-3-large`)

## Dependencies (pinned)

fastapi 0.111.0, uvicorn 0.29.0, pymupdf 1.24.0, langchain 0.2.0, langchain-text-splitters 0.2.0, openai 1.30.0, faiss-cpu 1.13.0, sqlmodel 0.0.19, pydantic-settings 2.2.1, numpy 1.26.4, python-jose[cryptography] 3.3.0, bcrypt 4.0.1, sse-starlette 2.1.0, python-multipart 0.0.9, httpx 0.27.0, pytest 8.2.0

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

# JWT Authentication
JWT_SECRET=change-me-to-a-random-secret   # defaults to "dev-secret-change-in-production"
JWT_ALGORITHM=HS256                       # default
JWT_EXPIRY_MINUTES=1440                   # default: 24 hours

# Storage (defaults resolve to absolute paths under backend/)
DATABASE_URL=sqlite:///{BACKEND_DIR}/data/study_assistant.db
FAISS_INDEX_DIR={BACKEND_DIR}/data/faiss_indices
UPLOAD_DIR={BACKEND_DIR}/uploads
```

All API keys default to `""` so tests can import config without real credentials. `jwt_secret` defaults to `"dev-secret-change-in-production"` for local dev/testing — must be set to a strong random value in production. Runtime dirs auto-created on config import.

## Deployment

Railway.app via `Dockerfile` (python:3.11-slim) and `railway.json`. Set env vars in Railway dashboard (including `JWT_SECRET`).

## Gotchas

- **Azure OpenAI** — uses `AzureOpenAI` client (not direct OpenAI). Separate keys/endpoints for chat vs embeddings
- **Embedding dim is 3072** — `text-embedding-3-large` produces 3072-dim vectors, not 1536
- **bcrypt directly** — `passlib[bcrypt]` 1.7.4 is incompatible with `bcrypt>=5.0`. Auth uses `bcrypt==4.0.1` directly instead of passlib
- **JWT auth on all endpoints** — every endpoint except `/ping` and `/auth/*` requires Bearer token. New endpoints must include `current_user: User = Depends(get_current_user)`
- **Per-user scoping** — Session has `user_id`. All CRUD operations verify `session.user_id == current_user.id`. Adding `user_id` to Session is a schema change — existing DBs need migration or recreation
- **CORS origins** — explicitly lists `localhost:5173` and `study-assistant.vercel.app` (not wildcard `*`). `allow_headers=["*"]` already permits `Authorization`
- FAISS version is `1.13.0` (not 1.8.0 — that doesn't exist on PyPI)
- Path traversal guards in `chat.py` and `documents.py` validate index paths stay within `faiss_index_dir`
- Empty FAISS index files are deleted (not saved) to prevent 422/404 on chat
- SSE error events are yielded on exception instead of silently closing the stream
- Session auto-prune happens on `GET /sessions`
- Config auto-creates `data/`, `data/faiss_indices/`, and `uploads/` dirs on import
