# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RAG-Powered Study Assistant — a full-stack web app where students upload PDFs and chat with them via a natural language chatbot. Answers are grounded in uploaded documents with inline citations, similarity scores, and a low-confidence warning when retrieval quality is poor.

## Commands

### Backend
```bash
cd backend
source venv/bin/activate          # activate virtualenv (created with python3.11 -m venv venv)
pip install -r requirements.txt
uvicorn app.main:app --reload     # dev server on port 8000
pytest                            # all 19 tests
pytest tests/test_chat.py -v      # single test file
```

### Frontend
```bash
cd frontend
npm install
npm run dev      # Vite dev server on port 5173
npm run build    # tsc + vite build
npm run test     # vitest
```

## Architecture

Three-tier: React SPA → FastAPI backend → (FAISS + SQLite + OpenAI API). The backend owns **all** AI logic; the frontend is a pure UI layer with no direct LLM or embedding access.

### Document Ingestion Pipeline (`POST /upload`)
1. FastAPI saves PDF to `uploads/{session_id}/{filename}` on disk
2. PyMuPDF (`fitz`) extracts text page-by-page → `List[ParsedPage]`
3. LangChain `RecursiveCharacterTextSplitter` splits into 512-char chunks, 50-char overlap → `List[TextChunk]`
4. OpenAI `text-embedding-3-small` converts each chunk → 1536-dim float32 vector, L2-normalized
5. `VectorStore` (FAISS `IndexIDMap(IndexFlatIP(1536))`) stores vectors keyed by SQLite `Chunk.id`
6. SQLite (SQLModel) stores `Chunk` rows with full metadata; `Document` and `Session` rows track structure

### Chat Pipeline (`POST /chat` → SSE)
1. Question embedded with the same model, L2-normalized
2. FAISS inner-product search (= cosine similarity on normalized vectors) → top-5 chunk IDs + scores
3. `Chunk` rows fetched from SQLite, sorted by score descending
4. If top score < 0.70 → `low_confidence: true` in the citations SSE event
5. Prompt assembled: system instruction + context chunks + last 10 history turns + question
6. GPT-4o-mini streams tokens → SSE `token` events, then `citations` event, then `done`

### Key Implementation Decisions
- **FAISS `IndexIDMap`**: Maps SQLite `Chunk.id` as external IDs so vectors can be deleted by document ID when a document is removed. `IndexFlatIP` on L2-normalized vectors gives cosine similarity.
- **Absolute paths in `config.py`**: Uses `Path(__file__).resolve().parent.parent` as `BACKEND_DIR` to prevent CWD-dependent path bugs when running pytest or uvicorn from different directories.
- **`faiss-cpu==1.13.0`**: Version `1.8.0` specified in the original plan does not exist on PyPI; `1.13.0` is the correct current version.
- **Path traversal guard**: `chat.py` and `documents.py` both validate that `{faiss_index_dir}/{session_id}.index` resolves within `faiss_index_dir` before opening the file.
- **SSE error event**: If `stream_answer()` raises inside the generator, a `event: error` SSE event is yielded instead of silently closing the stream.
- **Tailwind CSS v4**: The scaffold installed Tailwind v4 (not v3). v4 uses `@import "tailwindcss"` in CSS and a Vite plugin (`@tailwindcss/vite`) instead of PostCSS. Utility class names are the same as v3.
- **`react-markdown` className**: `react-markdown` v10 does not accept a `className` prop on `<ReactMarkdown>` — the `prose` class was removed from `MessageBubble.tsx`.
- **SSE via `fetch` (not `EventSource`)**: The SSE client in `api/client.ts` uses `fetch` + `ReadableStream` with an `AbortController` because the backend uses `POST /chat`, and `EventSource` only supports GET.
- **Empty FAISS index cleanup**: When deleting a document leaves 0 vectors, the FAISS index file is deleted rather than saved empty. This prevents 422/404 errors when chatting in a session with no documents.
- **Session auto-prune**: `GET /sessions` automatically deletes sessions with 0 documents (e.g., after indices are manually cleared). `DELETE /sessions/{id}` removes all associated data including chunks, documents, FAISS index, and uploaded files.
- **Upload success banner**: The success notification lives in `ChatPanel` (not `UploadZone`) because `UploadZone` unmounts when a new session is created on first upload.
- **SSE error detail forwarding**: The frontend `streamChat` reads the JSON response body on non-OK responses to surface backend error messages (e.g., "No documents in this session") instead of raw status codes.

## Backend Layout

```
backend/
├── app/
│   ├── main.py              # FastAPI app, CORS, router registration, GET /ping
│   ├── config.py            # pydantic-settings; absolute paths via Path(__file__).resolve()
│   ├── database.py          # SQLite engine, create_db(), get_db() dependency
│   ├── routers/
│   │   ├── upload.py        # POST /upload — full ingestion pipeline
│   │   ├── chat.py          # POST /chat — SSE streaming with FAISS retrieval
│   │   ├── sessions.py      # GET/POST/DELETE /sessions; auto-prunes empty sessions
│   │   └── documents.py     # GET /documents, DELETE /documents/{id}; cleans up empty FAISS index
│   ├── services/
│   │   ├── pdf_parser.py    # parse_pdf() → List[ParsedPage]
│   │   ├── chunker.py       # chunk_pages() → List[TextChunk]
│   │   ├── embedder.py      # embed_texts() → np.ndarray (N, 1536), L2-normalized
│   │   ├── vector_store.py  # VectorStore: add_vectors, search, remove_by_ids, save, load
│   │   └── llm.py           # stream_answer() → Generator[str]; GPT-4o-mini + prompt builder
│   └── models/
│       ├── chunk.py         # Chunk(id, session_id, doc_id, file_name, page_num, chunk_index, text, faiss_id)
│       ├── document.py      # Document(id, session_id, file_name, pages, chunks)
│       └── session.py       # Session(id, name, created_at)
├── tests/                   # 19 tests; all OpenAI calls mocked with unittest.mock
├── eval/
│   ├── evaluate.py          # RAGAS evaluation script (pip install ragas datasets)
│   └── test_set.json        # 3 placeholder Q&A pairs — replace with real questions
├── data/                    # gitignored: SQLite DB + FAISS .index files per session
├── uploads/                 # gitignored: uploaded PDFs per session/{filename}
├── Dockerfile               # python:3.11-slim, for Railway deployment
├── railway.json             # Railway build/deploy config
├── requirements.txt
└── .env.example
```

## Frontend Layout

```
frontend/src/
├── types.ts                 # Session, Document, Citation, Message, UploadResponse, SSEEvent
├── api/client.ts            # Axios instance; uploadFiles, getSessions, getDocuments,
│                            # deleteDocument, deleteSession, streamChat (fetch + AbortController)
├── store/useAppStore.ts     # Zustand: sessions, messages, streaming state + actions
└── components/
    ├── App.tsx              # Two-column layout: <Sidebar> + <ChatPanel>
    ├── Sidebar.tsx          # Session list + document list with delete buttons; loads on mount
    ├── ChatPanel.tsx        # Message list, upload success banner, UploadZone, input bar + send
    ├── MessageBubble.tsx    # User/assistant bubbles; markdown; streaming cursor ▍;
    │                        # low-confidence amber warning; CitationCard list
    ├── CitationCard.tsx     # Expandable: file, page, % match badge (green ≥70% / yellow <70%)
    └── UploadZone.tsx       # react-dropzone; PDF only; 20 MB / 5 files max
```

## API Reference

### `POST /upload`
```
Content-Type: multipart/form-data
files[]  — PDF files (max 5, 20 MB each)
session_id — optional; omit to create a new session

200: { "session_id": "uuid", "files": [{ "name": "...", "pages": N, "chunks": N, "status": "indexed" }], "total_chunks": N }
400: more than 5 files, or file exceeds 20 MB
```

### `POST /chat`
```json
{ "session_id": "uuid", "question": "...", "history": [{ "role": "user", "content": "..." }] }
```
SSE events (in order):
```
event: token       data: {"content": "word"}
event: citations   data: {"citations": [{"file": "x.pdf", "page": 3, "text": "...", "score": 0.91}], "low_confidence": false}
event: done        data: {}
event: error       data: {"detail": "..."} — only on exception
```
History capped at last 10 turns server-side.

### `GET /sessions`
Returns sessions ordered by `created_at` descending, each with `doc_count`.
Auto-prunes sessions with 0 documents (cleans up chunks, FAISS index, and uploaded files).

### `DELETE /sessions/{session_id}`
Deletes a session and all associated data: chunks, documents, FAISS index file, and uploaded PDFs.
Returns `{ "success": true }`.

### `GET /documents?session_id={id}`
Returns documents for a session.

### `DELETE /documents/{doc_id}`
Removes document, all its chunks from SQLite, and all its vectors from the FAISS index.
If the FAISS index becomes empty after removal, the index file is deleted.
Returns `{ "success": true, "chunks_removed": N }`.

## Environment Variables

Copy `backend/.env.example` → `backend/.env`:
```
OPENAI_API_KEY=sk-...
DATABASE_URL=sqlite:///./data/study_assistant.db   # resolved to absolute path at runtime
FAISS_INDEX_DIR=./data/faiss_indices               # resolved to absolute path at runtime
UPLOAD_DIR=./uploads                               # resolved to absolute path at runtime
```
`openai_api_key` defaults to `""` so tests can import config without a real key set.

## Tech Stack

### Backend (pinned versions)
| Package | Version |
|---|---|
| fastapi | 0.111.0 |
| uvicorn | 0.29.0 |
| pymupdf | 1.24.0 |
| langchain + langchain-text-splitters | 0.2.0 |
| openai | 1.30.0 |
| faiss-cpu | 1.13.0 |
| sqlmodel | 0.0.19 |
| pydantic-settings | 2.2.1 |
| numpy | 1.26.4 |
| sse-starlette | 2.1.0 |

### Frontend (latest at scaffold time)
| Package | Version |
|---|---|
| react + react-dom | 19 |
| typescript | 5.9 |
| vite | 8 |
| tailwindcss | 4.2 (v4, CSS-first config) |
| zustand | 5 |
| axios | 1.14 |
| react-dropzone | 15 |
| react-markdown | 10 |
| lucide-react | 1.7 |
| vitest | 4 |

## Deployment

**Backend → Railway.app**
```bash
# railway.json and Dockerfile are in backend/
# Set env vars in Railway dashboard:
#   OPENAI_API_KEY, DATABASE_URL, FAISS_INDEX_DIR, UPLOAD_DIR
```

**Frontend → Vercel**
```bash
cd frontend && npm run build
# Set VITE_API_URL=https://<your-railway-domain> in Vercel env vars
```

Update `allow_origins` in `backend/app/main.py` with your Vercel domain before deploying.

## Evaluation

```bash
cd backend
source venv/bin/activate
pip install ragas datasets
# Upload your test PDFs, note the session_id
python eval/evaluate.py --session_id <id>
# Targets: answer_relevancy > 0.80, context_precision > 0.75, faithfulness > 0.90
```

Fill `eval/test_set.json` with 20 real questions from your uploaded PDFs before running.
