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
pytest                            # all 31 tests
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

Three-tier: React SPA → FastAPI backend → (FAISS + SQLite + OpenAI API). The backend owns **all** AI logic; the frontend is a pure UI layer with no direct LLM or embedding access. All endpoints (except `/ping` and `/auth/*`) require JWT authentication; sessions and documents are scoped per user.

### Document Ingestion Pipeline (`POST /upload`)
1. FastAPI saves PDF to `uploads/{session_id}/{filename}` on disk
2. PyMuPDF (`fitz`) extracts text page-by-page → `List[ParsedPage]`
3. LangChain `RecursiveCharacterTextSplitter` splits into 512-char chunks, 50-char overlap → `List[TextChunk]`
4. Azure OpenAI `text-embedding-3-large` converts each chunk → 3072-dim float32 vector, L2-normalized
5. `VectorStore` (FAISS `IndexIDMap(IndexFlatIP(3072))`) stores vectors keyed by SQLite `Chunk.id`
6. SQLite (SQLModel) stores `Chunk` rows with full metadata; `Document` and `Session` rows track structure

### Chat Pipeline (`POST /chat` → SSE)
1. Question embedded with the same model, L2-normalized
2. FAISS inner-product search (= cosine similarity on normalized vectors) → top-5 chunk IDs + scores
3. `Chunk` rows fetched from SQLite, sorted by score descending
4. If top score < 0.70 → `low_confidence: true` in the citations SSE event
5. Prompt assembled: structured system instruction (## Answer, ## Key Concepts, ## Dig Deeper) + context chunks + last 10 history turns + question
6. Azure OpenAI GPT-4.1 streams tokens → SSE `token` events, then `citations` event, then `done`

### Key Implementation Decisions
- **FAISS `IndexIDMap`**: Maps SQLite `Chunk.id` as external IDs so vectors can be deleted by document ID when a document is removed. `IndexFlatIP` on L2-normalized vectors gives cosine similarity.
- **Absolute paths in `config.py`**: Uses `Path(__file__).resolve().parent.parent` as `BACKEND_DIR` to prevent CWD-dependent path bugs when running pytest or uvicorn from different directories.
- **`faiss-cpu==1.13.0`**: Version `1.8.0` specified in the original plan does not exist on PyPI; `1.13.0` is the correct current version.
- **Path traversal guard**: `chat.py` and `documents.py` both validate that `{faiss_index_dir}/{session_id}.index` resolves within `faiss_index_dir` before opening the file.
- **SSE error event**: If `stream_answer()` raises inside the generator, a `event: error` SSE event is yielded instead of silently closing the stream.
- **Tailwind CSS v4**: Uses `@import "tailwindcss"` in CSS with a `@theme` block defining custom notebook palette and a Vite plugin (`@tailwindcss/vite`) instead of PostCSS. Custom colors: cream, kraft, ruled, margin, pencil, eraser, charcoal (light mode) and chalk-bg, chalk-text, chalk-muted (dark mode). Custom fonts: `--font-hand` (Caveat), `--font-sans` (Inter).
- **Notebook theme UI**: Cream paper background with ruled lines, binder ring decorations on sidebar, pencil-blue accents, handwriting font (Caveat) for headings, chalkboard-green dark mode. CSS utility classes: `.bg-ruled`, `.bg-paper`, `.pencil-cursor`, `.binder-rings`.
- **`react-markdown` className**: `react-markdown` v10 does not accept a `className` prop on `<ReactMarkdown>` — the `prose` class was removed from `MessageBubble.tsx`.
- **SSE via `fetch` (not `EventSource`)**: The SSE client in `api/client.ts` uses `fetch` + `ReadableStream` with an `AbortController` because the backend uses `POST /chat`, and `EventSource` only supports GET.
- **Empty FAISS index cleanup**: When deleting a document leaves 0 vectors, the FAISS index file is deleted rather than saved empty. This prevents 422/404 errors when chatting in a session with no documents.
- **Session auto-prune**: `GET /sessions` automatically deletes sessions with 0 documents (e.g., after indices are manually cleared). `DELETE /sessions/{id}` removes all associated data including chunks, documents, FAISS index, and uploaded files.
- **Session rename**: `PATCH /sessions/{id}` accepts `{ "name": "..." }` and caps at 100 chars. The frontend exposes inline editing via a pencil icon on each session in the sidebar.
- **Session auto-naming**: The `/chat` endpoint auto-renames sessions still named "New Session" to the user's first question (truncated to 100 chars). The frontend also optimistically updates the sidebar name on first message.
- **New Chat button**: The sidebar has a "New Chat" button that resets `currentSessionId`, `documents`, and `messages` to null/empty, returning the user to the initial upload screen without a page reload.
- **Mid-chat file upload**: A paperclip button in the chat input bar opens a file picker for uploading additional PDFs to the current session. Uses a hidden `<input type="file">` rather than the dropzone component. Shows a spinner during upload and refreshes the sidebar documents/sessions in real time.
- **Upload success banner**: The success notification lives in `ChatPanel` (not `UploadZone`) because `UploadZone` unmounts when a new session is created on first upload.
- **Real-time sidebar updates on upload**: `UploadZone.onUploaded` passes the `sessionId` from the upload response to `handleUploadComplete`, which uses it directly instead of relying on the closure-captured `currentSessionId`. This ensures sessions and documents refresh immediately even when a new session was just created.
- **SSE error detail forwarding**: The frontend `streamChat` reads the JSON response body on non-OK responses to surface backend error messages (e.g., "No documents in this session") instead of raw status codes.
- **JWT authentication**: All API endpoints (except `/ping` and `/auth/*`) require a Bearer token. Tokens are issued on signup/login with a 24-hour expiry (configurable via `JWT_EXPIRY_MINUTES`). The `get_current_user` FastAPI dependency decodes the JWT and fetches the User from SQLite.
- **Per-user session scoping**: `Session` has a `user_id` field. All CRUD operations verify `session.user_id == current_user.id` to prevent cross-user data access. Upload creates sessions with the current user's ID.
- **bcrypt directly (not passlib)**: `passlib[bcrypt]` 1.7.4 is incompatible with `bcrypt>=5.0`. The auth service uses `bcrypt==4.0.1` directly for password hashing/verification.
- **Frontend auth gate**: `App.tsx` checks `useAuthStore.isAuthenticated` — renders `AuthPage` (login/signup form) when not authenticated, main app when authenticated. JWT stored in `localStorage`.
- **Persistent chat history**: Chat messages are stored in a `ChatMessage` SQLite table. The `/chat` endpoint saves user messages before streaming and assistant messages (with citations) after streaming completes. History is loaded from DB (last 10 messages) for LLM context — the frontend no longer sends history. `GET /messages?session_id=` returns persisted messages. Frontend loads messages on session select via `Sidebar.tsx`.
- **Fresh DBSession in SSE generator**: The assistant message is saved inside the SSE generator using a fresh `DBSession(engine)` context manager because the request-scoped DB session is closed by the time the generator runs. Chunk data is eagerly extracted as plain dicts before entering the generator to avoid SQLAlchemy detached-instance errors.
- **In-memory rate limiting**: Sliding-window rate limiter (`services/rate_limiter.py`) with thread-safe Lock. Shared instances: `chat_limiter` (20 req/min) and `upload_limiter` (10 req/hour). Returns 429 with `Retry-After` header when exceeded.
- **Regenerate response**: `POST /messages/{message_id}/regenerate` re-runs RAG pipeline for an existing assistant message. Finds the preceding user question, re-embeds, re-searches FAISS, re-streams via SSE, and updates the existing ChatMessage row in-place.
- **Structured LLM responses**: System prompt instructs the model to format answers with `## Answer`, `## Key Concepts` (2-5 key terms), and `## Dig Deeper` (3 follow-up questions). Frontend parses `## Dig Deeper` into clickable suggestion pills.
- **Markdown chat export**: `GET /sessions/{id}/export` generates a structured markdown file with session name, date, documents, Q&A pairs with sources. Frontend downloads via blob URL with Content-Disposition filename.
- **Toast notifications**: Zustand `useToastStore` with auto-dismiss (4s). `ToastContainer` component renders fixed top-right stack with success/warning/error variants. Used throughout for upload, delete, export, and error feedback.
- **Confirm dialogs**: `ConfirmDialog` modal component with notebook styling. Used for session and document deletion.
- **Dark mode toggle**: Zustand `useThemeStore` persists to localStorage and applies `.dark` class on `<html>`. Toggle button (Moon/Sun icons) in sidebar. Chalkboard-green dark mode palette.
- **Follow-up suggestion pills**: `MessageBubble` parses `## Dig Deeper` section from assistant responses using `extractDigDeeper()`. Renders clickable pill buttons on the latest message that auto-fill and submit the chat input.

## Backend Layout

```
backend/
├── app/
│   ├── main.py              # FastAPI app, CORS, router registration, GET /ping
│   ├── config.py            # pydantic-settings; absolute paths via Path(__file__).resolve()
│   ├── database.py          # SQLite engine, create_db(), get_db() dependency
│   ├── routers/
│   │   ├── auth.py          # POST /auth/signup, POST /auth/login — JWT authentication
│   │   ├── upload.py        # POST /upload — full ingestion pipeline, rate-limited (auth required)
│   │   ├── chat.py          # POST /chat — SSE streaming with FAISS retrieval, persists messages, rate-limited (auth required)
│   │   │                    # POST /messages/{id}/regenerate — re-run RAG pipeline for existing message
│   │   ├── sessions.py      # GET/POST/PATCH/DELETE /sessions; GET /messages; GET /sessions/{id}/export; auto-prunes empty sessions (auth required)
│   │   └── documents.py     # GET /documents, DELETE /documents/{id}; cleans up empty FAISS index (auth required)
│   ├── services/
│   │   ├── auth.py          # hash_password, verify_password, create_access_token, get_current_user dependency
│   │   ├── pdf_parser.py    # parse_pdf() → List[ParsedPage]
│   │   ├── chunker.py       # chunk_pages() → List[TextChunk]
│   │   ├── embedder.py      # embed_texts() → np.ndarray (N, 3072), L2-normalized
│   │   ├── vector_store.py  # VectorStore: add_vectors, search, remove_by_ids, save, load
│   │   ├── llm.py           # stream_answer() → Generator[str]; GPT-4.1 + structured prompt (Answer/Key Concepts/Dig Deeper)
│   │   └── rate_limiter.py  # RateLimiter class (sliding-window, thread-safe); chat_limiter, upload_limiter instances
│   └── models/
│       ├── user.py          # User(id, email, hashed_password, created_at)
│       ├── chunk.py         # Chunk(id, session_id, doc_id, file_name, page_num, chunk_index, text, faiss_id)
│       ├── document.py      # Document(id, session_id, file_name, pages, chunks)
│       ├── session.py       # Session(id, user_id, name, created_at)
│       └── chat_message.py  # ChatMessage(id, session_id, role, content, citations, low_confidence, created_at)
├── tests/                   # 31 tests; all OpenAI calls mocked with unittest.mock
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
├── types.ts                 # Session, Document, Citation, Message, UploadResponse, AuthResponse, SSEEvent
├── index.css                # Tailwind v4 @theme block (notebook palette, chalkboard dark mode, fonts),
│                            # utility classes: .bg-ruled, .bg-paper, .pencil-cursor, .binder-rings,
│                            # dark mode overrides, scrollbar styling, Key Concepts card styling
├── api/client.ts            # Axios instance + JWT interceptor; signup, login, logout,
│                            # uploadFiles, getSessions, getDocuments, getMessages,
│                            # deleteDocument, deleteSession, renameSession, streamChat, regenerateMessage,
│                            # exportSession (fetch + AbortController)
├── store/
│   ├── useAppStore.ts       # Zustand: sessions, messages, streaming state + actions (incl. updateSessionName, startNewChat, regenerateMessage)
│   ├── useAuthStore.ts      # Zustand: token, email, isAuthenticated, setAuth, clearAuth
│   ├── useToastStore.ts     # Zustand: toast notifications with auto-dismiss (4s)
│   └── useThemeStore.ts     # Zustand: dark mode toggle with localStorage persistence
└── components/
    ├── App.tsx              # Auth gate; responsive shell with hamburger menu, mobile sidebar overlay, pink margin line, ToastContainer
    ├── AuthPage.tsx         # Notebook-themed login/signup: bg-paper bg-ruled, cream card with rotation, BookOpen icon, Caveat font
    ├── Sidebar.tsx          # Kraft bg, binder-rings, dark mode toggle (Moon/Sun), toast notifications, ConfirmDialog for deletes, onClose prop for mobile
    ├── ChatPanel.tsx        # Message list, Export Notes button, UploadZone, paperclip upload, toast notifications, follow-up suggestion auto-submit
    ├── MessageBubble.tsx    # Notebook-styled bubbles; pencil cursor; regenerate button; extractDigDeeper() for suggestion pills; isLatest + onSuggestionClick props
    ├── CitationCard.tsx     # Cream bg with ruled border, pencil-blue FileText icon, green/amber confidence badges, dark mode
    ├── UploadZone.tsx       # Folder pocket styling, FolderOpen icon, drag-active scale, toast notifications
    ├── Toast.tsx            # ToastContainer: fixed top-right stack, success/warning/error variants, lucide icons, slideIn animation
    └── ConfirmDialog.tsx    # Modal dialog: notebook styling (tilted card, cream bg), backdrop click to cancel
```

## API Reference

All endpoints below (except `/ping` and `/auth/*`) require `Authorization: Bearer <token>` header.

### `POST /auth/signup`
```json
{ "email": "user@example.com", "password": "secret" }
```
Returns `{ "access_token": "jwt...", "token_type": "bearer", "user_id": "uuid", "email": "user@example.com" }`.
409 if email already registered.

### `POST /auth/login`
```json
{ "email": "user@example.com", "password": "secret" }
```
Returns same shape as signup. 401 if invalid credentials.

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
{ "session_id": "uuid", "question": "..." }
```
SSE events (in order):
```
event: token       data: {"content": "word"}
event: citations   data: {"citations": [{"file": "x.pdf", "page": 3, "text": "...", "score": 0.91}], "low_confidence": false}
event: done        data: {}
event: error       data: {"detail": "..."} — only on exception
```
Backend automatically saves user message before streaming and assistant message after streaming. History loaded from DB (last 10 turns).

### `POST /messages/{message_id}/regenerate`
Re-runs RAG pipeline for an existing assistant message. Finds the preceding user question, re-embeds, re-searches FAISS, streams a new response via SSE (same event format as `/chat`), and updates the existing message row in-place.
429 if rate limited. 404 if message not found or not an assistant message.

### `GET /messages?session_id={id}`
Returns persisted chat messages ordered by `created_at` ascending.
Each message: `{ id, role, content, citations, low_confidence, created_at }`.

### `GET /sessions`
Returns sessions ordered by `created_at` descending, each with `doc_count`.
Auto-prunes sessions with 0 documents (cleans up chunks, FAISS index, and uploaded files).

### `PATCH /sessions/{session_id}`
```json
{ "name": "new name" }
```
Renames a session. Name capped at 100 characters.
Returns `{ "id": "uuid", "name": "new name" }`.

### `DELETE /sessions/{session_id}`
Deletes a session and all associated data: chunks, documents, chat messages, FAISS index file, and uploaded PDFs.
Returns `{ "success": true }`.

### `GET /documents?session_id={id}`
Returns documents for a session.

### `DELETE /documents/{doc_id}`
Removes document, all its chunks from SQLite, and all its vectors from the FAISS index.
If the FAISS index becomes empty after removal, the index file is deleted.
Returns `{ "success": true, "chunks_removed": N }`.

### `GET /sessions/{session_id}/export`
Returns a structured markdown file download with session name, date, document list, and all Q&A pairs with citation sources.
Content-Type: `text/markdown`. Content-Disposition: `attachment; filename="{session-name}.md"`.

## Environment Variables

Copy `backend/.env.example` → `backend/.env`:
```
CHAT_API_KEY=...                                   # Azure OpenAI chat API key
CHAT_API_ENDPOINT=https://...openai.azure.com/     # Azure OpenAI chat endpoint
EMBEDDING_API_KEY=...                              # Azure OpenAI embedding API key
EMBEDDING_API_ENDPOINT=https://...openai.azure.com/ # Azure OpenAI embedding endpoint
JWT_SECRET=change-me-to-a-random-secret            # required for production
DATABASE_URL=sqlite:///./data/study_assistant.db   # resolved to absolute path at runtime
FAISS_INDEX_DIR=./data/faiss_indices               # resolved to absolute path at runtime
UPLOAD_DIR=./uploads                               # resolved to absolute path at runtime
```
`jwt_secret` defaults to `"dev-secret-change-in-production"` for local dev/testing. API keys default to `""` so tests can import config without real keys set.

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
| python-jose[cryptography] | 3.3.0 |
| bcrypt | 4.0.1 |
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
#   CHAT_API_KEY, CHAT_API_ENDPOINT, EMBEDDING_API_KEY, EMBEDDING_API_ENDPOINT,
#   JWT_SECRET, DATABASE_URL, FAISS_INDEX_DIR, UPLOAD_DIR
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