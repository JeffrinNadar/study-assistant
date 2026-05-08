# Design Document: RAG-Powered Study Assistant

**Version:** 1.0
**Date:** April 16, 2026
**Author:** Jeffrin Nadar

---

## 1. Overview

### 1.1 Purpose

The RAG-Powered Study Assistant is a full-stack web application that enables students to upload PDF documents and interact with them through a natural language chatbot. Answers are grounded in uploaded content with inline citations, similarity scores, and confidence indicators.

### 1.2 Goals

- Allow students to upload course materials (PDFs) and ask questions in natural language
- Provide accurate, citation-backed answers grounded in uploaded documents
- Surface low-confidence warnings when retrieval quality is poor
- Deliver a responsive, notebook-themed UI with dark mode support
- Ensure per-user data isolation with JWT authentication

### 1.3 Non-Goals

- Real-time collaboration or shared sessions between users
- Support for non-PDF file formats (Word, images, etc.)
- Offline or local-only mode without Azure OpenAI
- Mobile native apps (web-only, responsive design)

---

## 2. Architecture

### 2.1 High-Level Architecture

```
┌─────────────────┐       HTTPS/SSE        ┌──────────────────┐
│                 │ ◄───────────────────── │                  │
│   React SPA     │                         │   FastAPI         │
│   (Vercel)      │ ────────────────────► │   (Railway)       │
│                 │    REST + JWT Auth      │                  │
└─────────────────┘                         └──────┬───────────┘
                                                   │
                              ┌─────────────────────┼──────────────────┐
                              │                     │                  │
                         ┌────▼─────┐         ┌─────▼────┐     ┌──────▼──────┐
                         │  SQLite  │         │  FAISS   │     │ Azure       │
                         │  (Data)  │         │  (Index) │     │ OpenAI      │
                         └──────────┘         └──────────┘     └─────────────┘
```

**Three-tier design:** React SPA (presentation) -> FastAPI (business logic + AI) -> Storage layer (FAISS + SQLite + Azure OpenAI).

The backend owns **all** AI logic. The frontend is a pure UI layer with no direct LLM or embedding access.

### 2.2 Component Diagram

```
Frontend (React 19 + Vite 8)
├── Auth Gate (AuthPage / Main App)
├── State Management (Zustand stores)
│   ├── useAppStore     — sessions, messages, streaming
│   ├── useAuthStore    — JWT token, auth state
│   ├── useToastStore   — notifications
│   └── useThemeStore   — dark mode
├── API Layer (Axios + fetch SSE)
└── UI Components
    ├── App.tsx          — layout shell, auth gate
    ├── Sidebar.tsx      — session/document management
    ├── ChatPanel.tsx    — message list, input, upload
    ├── MessageBubble.tsx— formatted messages, suggestions
    ├── CitationCard.tsx — source attribution display
    ├── UploadZone.tsx   — drag-and-drop PDF upload
    ├── Toast.tsx        — notification stack
    └── ConfirmDialog.tsx— destructive action confirmation

Backend (FastAPI + Python 3.11)
├── Routers
│   ├── auth.py         — signup, login
│   ├── upload.py       — PDF ingestion pipeline
│   ├── chat.py         — RAG + SSE streaming
│   ├── sessions.py     — CRUD, export, messages
│   └── documents.py    — list, delete
├── Services
│   ├── auth.py         — bcrypt, JWT, user resolution
│   ├── pdf_parser.py   — PyMuPDF text extraction
│   ├── chunker.py      — LangChain text splitting
│   ├── embedder.py     — Azure OpenAI embeddings
│   ├── vector_store.py — FAISS index management
│   ├── llm.py          — GPT-4.1 streaming
│   └── rate_limiter.py — sliding-window limiter
├── Models (SQLModel)
│   ├── User, Session, Document, Chunk, ChatMessage
└── Storage
    ├── SQLite           — relational data
    ├── FAISS indices    — vector search (per-session files)
    └── Filesystem       — uploaded PDFs
```

---

## 3. Data Model

### 3.1 Entity Relationship Diagram

```
User (1) ──────── (*) Session (1) ──────── (*) Document (1) ──── (*) Chunk
  │                     │
  │                     └──────── (*) ChatMessage
  │
  id (uuid4, PK)        id (uuid4 hex, PK)
  email (unique)         user_id (FK → User)
  hashed_password        name
  created_at             created_at
```

### 3.2 Table Definitions

| Table | Primary Key | Key Fields | Relationships |
|-------|-------------|------------|---------------|
| **User** | `id` (uuid4) | `email` (unique, indexed), `hashed_password`, `created_at` | Has many Sessions |
| **Session** | `id` (uuid4 hex) | `user_id` (indexed), `name`, `created_at` | Belongs to User, has many Documents & ChatMessages |
| **Document** | `id` (auto int) | `session_id` (FK), `file_name`, `pages`, `chunks` | Belongs to Session, has many Chunks |
| **Chunk** | `id` (auto int) | `session_id` (indexed), `doc_id` (FK), `file_name`, `page_num`, `chunk_index`, `text` | Belongs to Document |
| **ChatMessage** | `id` (auto int) | `session_id` (indexed), `role`, `content`, `citations` (JSON), `low_confidence`, `created_at` | Belongs to Session |

### 3.3 Storage Layout

```
backend/
├── data/
│   ├── study_assistant.db          # SQLite database
│   └── faiss_indices/
│       ├── {session_id_1}.index    # Per-session FAISS index
│       └── {session_id_2}.index
└── uploads/
    ├── {session_id_1}/
    │   ├── lecture1.pdf
    │   └── lecture2.pdf
    └── {session_id_2}/
        └── notes.pdf
```

---

## 4. Core Pipelines

### 4.1 Document Ingestion Pipeline (`POST /upload`)

```
PDF File(s)
    │
    ▼
┌──────────────────┐
│ 1. Save to disk  │   uploads/{session_id}/{filename}
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 2. Extract text  │   PyMuPDF (fitz) → List[ParsedPage]
│    page-by-page  │   Each page: { page_num, text }
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 3. Chunk text    │   LangChain RecursiveCharacterTextSplitter
│                  │   512 chars, 50 char overlap → List[TextChunk]
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 4. Embed chunks  │   Azure OpenAI text-embedding-3-large
│                  │   → (N, 3072) float32, L2-normalized
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 5. Index + Store │   FAISS IndexIDMap(IndexFlatIP) + SQLite Chunk rows
└──────────────────┘
```

**Constraints:**
- Max 5 files per request
- Max 20 MB per file
- PDF format only
- Rate limited: 10 uploads/hour per user

### 4.2 Chat Pipeline (`POST /chat` -> SSE)

```
User Question
    │
    ▼
┌──────────────────────┐
│ 1. Embed question    │   Same model (text-embedding-3-large), L2-normalized
└────────┬─────────────┘
         ▼
┌──────────────────────┐
│ 2. FAISS search      │   Inner-product search (= cosine on normalized vectors)
│                      │   → Top-5 chunk IDs + similarity scores
└────────┬─────────────┘
         ▼
┌──────────────────────┐
│ 3. Fetch chunks      │   SQLite lookup by chunk IDs, sorted by score desc
└────────┬─────────────┘
         ▼
┌──────────────────────┐
│ 4. Confidence check  │   Top score < 0.70 → low_confidence: true
└────────┬─────────────┘
         ▼
┌──────────────────────┐
│ 5. Build prompt      │   System instruction (Answer / Key Concepts / Dig Deeper)
│                      │   + context chunks + last 10 history turns + question
└────────┬─────────────┘
         ▼
┌──────────────────────┐
│ 6. Stream response   │   Azure OpenAI GPT-4.1 → SSE events:
│                      │   token → citations → done
└──────────────────────┘
```

**SSE Event Flow:**
```
event: token      data: {"content": "The"}
event: token      data: {"content": " answer"}
event: token      data: {"content": " is..."}
event: citations  data: {"citations": [...], "low_confidence": false}
event: done       data: {}
```

**Rate limited:** 20 chat requests/minute per user.

### 4.3 Message Persistence

- User message saved to `ChatMessage` **before** streaming begins
- Assistant message saved **after** streaming completes (inside SSE generator with fresh DB session)
- History loaded from DB (last 10 messages) for LLM context — frontend does not send history
- `GET /messages?session_id=` returns full persisted history for UI rendering

---

## 5. Authentication & Authorization

### 5.1 Auth Flow

```
┌──────────┐    POST /auth/signup     ┌──────────┐
│  Client  │ ───────────────────────► │  Server  │
│          │ ◄─────────────────────── │          │
│          │    { access_token }      │          │
│          │                          │          │
│  stores  │    Bearer <token>        │  verify  │
│  in      │ ───────────────────────► │  JWT +   │
│  local   │    on every request      │  fetch   │
│  Storage │                          │  User    │
└──────────┘                          └──────────┘
```

### 5.2 Implementation Details

| Aspect | Detail |
|--------|--------|
| **Hashing** | bcrypt 4.0.1 directly (not passlib — incompatible with bcrypt >= 5.0) |
| **Token** | JWT via python-jose, HS256, 24-hour expiry (configurable) |
| **Protection** | All endpoints except `/ping` and `/auth/*` require Bearer token |
| **Scoping** | Every Session has `user_id`; all CRUD verifies `session.user_id == current_user.id` |
| **Frontend** | Token in localStorage, Axios interceptor auto-attaches header |
| **SSE Auth** | `streamChat` uses raw `fetch` (not Axios) and manually reads token from localStorage |

### 5.3 Security Measures

- **Path traversal guards:** `chat.py` and `documents.py` validate FAISS index paths resolve within `faiss_index_dir`
- **Rate limiting:** In-memory sliding-window, per-user, thread-safe (20 req/min chat, 10 req/hour upload)
- **File validation:** Max 5 files, 20 MB each, PDF only
- **CORS:** Explicitly allows `localhost:5173` and `study-assistant.vercel.app` (not wildcard)
- **Session name cap:** 100 characters max to prevent abuse

---

## 6. Vector Search Design

### 6.1 FAISS Configuration

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Index type** | `IndexIDMap(IndexFlatIP(3072))` | Exact inner-product search with external ID mapping |
| **Embedding model** | `text-embedding-3-large` | 3072-dim vectors, high quality for academic content |
| **Normalization** | L2-normalized before indexing | Inner product on L2-normalized vectors = cosine similarity |
| **Top-K** | 5 | Balance between context breadth and prompt length |
| **Confidence threshold** | 0.70 | Below this, `low_confidence: true` warns the user |

### 6.2 Index Lifecycle

- **Created** on first upload to a session
- **Appended** on subsequent uploads to the same session
- **Partially removed** when a document is deleted (vectors removed by chunk IDs)
- **Deleted** when last document is removed (empty index → file deleted to prevent errors)
- **Stored** as `{session_id}.index` in `data/faiss_indices/`

### 6.3 ID Mapping

FAISS `IndexIDMap` maps SQLite `Chunk.id` as external IDs. This allows:
- Searching FAISS → getting chunk IDs → fetching full metadata from SQLite
- Deleting vectors by document (lookup chunk IDs for a doc → remove from FAISS)

---

## 7. LLM Integration

### 7.1 Model Configuration

| Role | Model | Provider |
|------|-------|----------|
| **Chat** | GPT-4.1 | Azure OpenAI |
| **Embeddings** | text-embedding-3-large | Azure OpenAI |

Separate API keys and endpoints for chat and embeddings.

### 7.2 Structured Response Format

The system prompt instructs the LLM to format responses with three sections:

```markdown
## Answer
[Main response with inline citations: [Source: file.pdf, p.3]]

## Key Concepts
- Term 1: definition
- Term 2: definition

## Dig Deeper
- Follow-up question 1?
- Follow-up question 2?
- Follow-up question 3?
```

The frontend parses `## Dig Deeper` into clickable suggestion pills for continued conversation.

### 7.3 Context Window Management

- **Chunk context:** Top-5 retrieved chunks included in prompt
- **Chat history:** Last 10 messages loaded from DB (not sent by frontend)
- **Chunking params:** 512-char chunks with 50-char overlap balances granularity with context

---

## 8. Frontend Design

### 8.1 UI Theme: Notebook Aesthetic

The application uses a cohesive notebook/stationery theme:

| Element | Styling |
|---------|---------|
| **Background** | Cream paper (`bg-paper`) with ruled lines (`bg-ruled`) |
| **Sidebar** | Kraft paper background with binder ring decorations |
| **Accents** | Pencil-blue for highlights and active states |
| **Headings** | Caveat handwriting font |
| **Body** | Inter sans-serif font |
| **Cards** | Cream with slight rotation for a casual/organic feel |
| **Dark mode** | Chalkboard-green palette (`chalk-bg`, `chalk-text`) |
| **Upload** | Folder pocket styling |
| **Cursors** | Pencil cursor animation during streaming |

### 8.2 State Management

Four Zustand stores with clear separation of concerns:

```
useAppStore     — Core app state: sessions, messages, documents, streaming
useAuthStore    — Auth state: token, email, isAuthenticated
useToastStore   — Ephemeral notifications with auto-dismiss
useThemeStore   — Dark mode preference (persisted to localStorage)
```

### 8.3 Key UX Features

| Feature | Description |
|---------|-------------|
| **Auth gate** | Conditional render (no router) — `AuthPage` or main app |
| **Session auto-naming** | First question becomes session name (backend + optimistic frontend update) |
| **New Chat** | Resets state without page reload |
| **Mid-chat upload** | Paperclip button in input bar for adding more PDFs |
| **Follow-up suggestions** | Parsed from `## Dig Deeper`, rendered as clickable pills on latest message |
| **Regenerate** | Re-runs RAG pipeline for an existing assistant message |
| **Export** | Downloads session as structured markdown file |
| **Toast notifications** | Consistent feedback for all async operations |
| **Confirm dialogs** | Required for destructive actions (delete session/document) |
| **Responsive** | Hamburger menu + mobile sidebar overlay |

### 8.4 SSE Implementation

The frontend uses `fetch` + `ReadableStream` (not `EventSource`) because `EventSource` only supports GET, but the chat endpoint uses POST. An `AbortController` enables cancellation. The SSE client manually parses `event:` and `data:` lines.

---

## 9. API Design

### 9.1 Endpoint Summary

| Method | Endpoint | Auth | Rate Limit | Purpose |
|--------|----------|------|------------|---------|
| GET | `/ping` | No | — | Health check |
| POST | `/auth/signup` | No | — | User registration |
| POST | `/auth/login` | No | — | User login |
| POST | `/upload` | Yes | 10/hr | Upload + ingest PDFs |
| POST | `/chat` | Yes | 20/min | RAG chat (SSE stream) |
| POST | `/messages/{id}/regenerate` | Yes | 20/min | Re-run RAG for message |
| GET | `/messages` | Yes | — | Fetch chat history |
| GET | `/sessions` | Yes | — | List sessions (auto-prunes empty) |
| POST | `/sessions` | Yes | — | Create session |
| PATCH | `/sessions/{id}` | Yes | — | Rename session |
| DELETE | `/sessions/{id}` | Yes | — | Delete session + all data |
| GET | `/sessions/{id}/export` | Yes | — | Download as markdown |
| GET | `/documents` | Yes | — | List documents for session |
| DELETE | `/documents/{id}` | Yes | — | Delete document + vectors |

### 9.2 Error Handling

- **SSE errors:** Yielded as `event: error` with JSON detail (not silent stream close)
- **HTTP errors:** Standard status codes (400, 401, 404, 409, 422, 429)
- **Rate limiting:** Returns 429 with `Retry-After` header
- **Frontend:** Reads JSON error body on non-OK SSE responses for user-facing messages

---

## 10. Deployment Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Internet                          │
└──────────┬──────────────────────────┬───────────────┘
           │                          │
    ┌──────▼──────┐           ┌───────▼───────┐
    │   Vercel    │           │   Railway     │
    │  (Frontend) │           │  (Backend)    │
    │             │           │               │
    │  React SPA  │──────────►│  FastAPI      │
    │  Static     │  HTTPS    │  Python 3.11  │
    │  Assets     │           │  Docker       │
    └─────────────┘           └───────┬───────┘
                                      │
                              ┌───────▼───────┐
                              │ Azure OpenAI  │
                              │ - GPT-4.1     │
                              │ - Embeddings  │
                              └───────────────┘
```

| Layer | Platform | Config |
|-------|----------|--------|
| **Frontend** | Vercel | `npm run build`, env: `VITE_API_URL` |
| **Backend** | Railway | Dockerfile (python:3.11-slim), env: API keys + JWT secret |
| **AI** | Azure OpenAI | Separate endpoints for chat and embeddings |
| **Storage** | Railway filesystem | SQLite + FAISS indices + uploaded PDFs |

---

## 11. Tech Stack Summary

### Backend

| Package | Version | Purpose |
|---------|---------|---------|
| FastAPI | 0.111.0 | Web framework + SSE |
| uvicorn | 0.29.0 | ASGI server |
| PyMuPDF | 1.24.0 | PDF text extraction |
| LangChain | 0.2.0 | Text splitting |
| OpenAI SDK | 1.30.0 | Azure OpenAI client |
| faiss-cpu | 1.13.0 | Vector similarity search |
| SQLModel | 0.0.19 | ORM (SQLAlchemy + Pydantic) |
| python-jose | 3.3.0 | JWT encoding/decoding |
| bcrypt | 4.0.1 | Password hashing |
| numpy | 1.26.4 | Vector operations |

### Frontend

| Package | Version | Purpose |
|---------|---------|---------|
| React | 19 | UI framework |
| TypeScript | 5.9 | Type safety |
| Vite | 8 | Build tool + dev server |
| Tailwind CSS | 4.2 | Utility-first CSS (v4 CSS-first config) |
| Zustand | 5 | State management |
| Axios | 1.14 | HTTP client |
| react-dropzone | 15 | File upload UX |
| react-markdown | 10 | Markdown rendering |
| lucide-react | 1.7 | Icons |

---

## 12. Testing Strategy

### 12.1 Backend (31 tests)

| Area | Tests | Coverage |
|------|-------|----------|
| Upload | 3 | Auth, FAISS creation, 401 rejection |
| Chat | 4 | SSE streaming, auth, message persistence |
| PDF Parser | 3 | Extraction, page structure, sequencing |
| Chunker | 4 | Output count, fields, indexing, empty handling |
| Embedder | 4 | Shape, dimensions, normalization, error handling |
| Vector Store | 5 | Add/search, cosine scores, removal, persistence |
| Rate Limiter | 5 | Allow/block, retry-after, user isolation, window expiry |
| Export | 2 | Markdown output, auth requirement |

All OpenAI calls are mocked with `unittest.mock`. Test fixtures include a real tiny PDF generated via PyMuPDF, a test user with bcrypt-hashed password, and valid JWT auth headers.

### 12.2 Frontend

Test infrastructure is configured (vitest + jsdom + testing-library) but no test files exist yet.

### 12.3 Evaluation

RAGAS evaluation script (`eval/evaluate.py`) measures:
- **Answer relevancy** target: > 0.80
- **Context precision** target: > 0.75
- **Faithfulness** target: > 0.90

---

## 13. Known Limitations & Future Considerations

| Limitation | Impact | Potential Mitigation |
|------------|--------|----------------------|
| SQLite + filesystem storage | Not horizontally scalable | Migrate to PostgreSQL + S3 |
| In-memory rate limiter | Resets on server restart | Add Redis-backed limiter |
| No 401 auto-redirect | Expired tokens require manual reload | Add Axios response interceptor |
| No file format diversity | PDF only | Add DOCX, TXT, image OCR |
| FAISS exact search | Slower at scale (>100K vectors) | Switch to HNSW or IVF index |
| Single-region deployment | Latency for distant users | Multi-region or CDN |
| No pagination | Large message histories load fully | Add cursor-based pagination |
| No WebSocket | SSE is one-directional | Upgrade for bidirectional features |
