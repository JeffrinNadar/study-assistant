# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RAG-Powered Study Assistant — a web application where students upload PDFs (lecture notes, textbook chapters, past papers) and chat with them via a natural language chatbot. Answers are always grounded in the uploaded documents with inline citations. This is a greenfield project; the repository currently contains only the spec PDF (`RAG_Study_Assistant_TDD.pdf`).

## Commands

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload        # dev server on port 8000
pytest                               # all tests
pytest tests/test_embedder.py        # single test file
```

### Frontend
```bash
cd frontend
npm install
npm run dev      # Vite dev server on port 5173
npm run build
npm run test
```

## Architecture

Three-tier: React SPA → FastAPI backend → (FAISS + SQLite + OpenAI API). The backend handles **all** AI logic; the frontend is a pure UI layer with no direct LLM access.

### Document Ingestion Pipeline (`POST /upload`)
1. FastAPI saves PDF to session directory on disk
2. PyMuPDF (`fitz`) extracts text page-by-page, preserving page numbers
3. LangChain `RecursiveCharacterTextSplitter` splits into 512-token chunks, 50-token overlap
4. OpenAI `text-embedding-3-small` converts each chunk → 1536-dim float vector
5. FAISS index stores vectors; SQLite (via SQLModel) stores chunk text + `{file, page, chunk_index}` metadata

### Chat Pipeline (`POST /chat` → SSE stream)
1. Question embedded with same `text-embedding-3-small` model
2. FAISS cosine similarity search → top-5 chunk IDs
3. Chunks fetched from SQLite by chunk ID with full metadata
4. Prompt assembled: system instruction + context chunks + user question
5. GPT-4o-mini streams answer token-by-token via SSE
6. Frontend renders markdown in real-time + appends citation cards

### System Prompt Template
```
You are a study assistant. Answer the student's question using ONLY the context provided below.
If the answer is not in the context, respond: "I couldn't find this in your uploaded documents."
Always cite sources inline: [Source: {filename}, p.{page}]

CONTEXT:
{chunk_1_text} [Source: {filename}, p.{page}]
{chunk_2_text} [Source: {filename}, p.{page}]
...

QUESTION: {user_question}
```

### Backend Layout (`backend/app/`)
- `main.py` — FastAPI entry point, CORS, router registration; health check: `GET /ping → {status: ok}`
- `config.py` — env var loading (python-dotenv)
- `routers/upload.py` — `POST /upload`
- `routers/chat.py` — `POST /chat` (SSE streaming)
- `routers/sessions.py` — `GET/POST /sessions`
- `routers/documents.py` — `GET/DELETE /documents`
- `services/pdf_parser.py` — PyMuPDF extraction
- `services/chunker.py` — LangChain `RecursiveCharacterTextSplitter`
- `services/embedder.py` — OpenAI embeddings
- `services/vector_store.py` — FAISS CRUD operations
- `services/llm.py` — GPT-4o-mini + prompt builder
- `models/chunk.py` — SQLModel `Chunk` table schema
- `models/session.py` — SQLModel `Session` table schema
- `data/` — SQLite DB + FAISS `.index` files per session (gitignored)
- `uploads/` — uploaded PDFs per session (gitignored)

### Frontend Layout (`frontend/src/`)
- `store/useAppStore.ts` — Zustand global state
- `api/client.ts` — Axios instance + typed API helpers; `EventSource` for SSE token streaming
- `components/ChatPanel.tsx` — message list + streaming input
- `components/UploadZone.tsx` — drag-and-drop PDF upload (react-dropzone)
- `components/CitationCard.tsx` — expandable source card (file, page, chunk text, similarity score)
- `components/Sidebar.tsx` — sessions + document list
- `components/MessageBubble.tsx`

## API Specification

### `POST /upload`
```
Content-Type: multipart/form-data
Body: files[] (PDF), session_id (string, optional)

Response 200:
{ "session_id": "abc123", "files": [{ "name": "lecture1.pdf", "pages": 42, "chunks": 183, "status": "indexed" }], "total_chunks": 183 }
```
Limits: 20 MB per file, 5 files per session.

### `POST /chat`
```json
{ "session_id": "abc123", "question": "What is gradient descent?", "history": [{ "role": "user", "content": "..." }] }
```
SSE stream events:
```
event: token       data: {"content": "Gradient"}
event: citations   data: {"citations": [{ "file": "lecture1.pdf", "page": 12, "text": "...", "score": 0.91 }]}
event: done        data: {}
```
Chat history capped at last 10 turns.

### `GET /sessions`
```json
[{ "id": "abc123", "name": "ML Midterm", "created_at": "2025-01-01", "doc_count": 3 }]
```

### `GET /documents?session_id={id}`
```json
[{ "id": "doc1", "name": "lecture1.pdf", "pages": 42, "chunks": 183 }]
```

### `DELETE /documents/{doc_id}`
```json
{ "success": true, "chunks_removed": 183 }
```
Removes document and updates FAISS index accordingly.

## Functional Requirements

**MVP (must have):**
- FR-01: PDF upload via drag-and-drop or file picker; acknowledge with file name + page count
- FR-02: Processing pipeline (chunking → embedding → FAISS indexing) within 30s for 100-page doc
- FR-03: Chat with SSE streaming, top-5 retrieval, inline citations `[Source: filename.pdf, p.N]`
- FR-04: Expandable citation cards with file name, page number, chunk text, similarity score (0–1)

**Should have:**
- FR-05: Named study sessions that persist documents + FAISS index to disk; switchable
- FR-06: Document sidebar with per-document removal; index updates on removal
- FR-07: Low-confidence warning when top chunk similarity < 0.70 — text: *"This answer may not be well-supported by your documents."*

**Stretch:**
- FR-08: Quiz generation — auto-generate MCQ questions from a document section
- FR-09: Flashcard export as CSV for Anki import
- FR-10: Multi-user support with separate document namespaces per account

## Tech Stack

### Backend (`backend/requirements.txt`)
| Package | Version |
|---------|---------|
| fastapi | 0.111+ |
| uvicorn | 0.29+ |
| pymupdf | 1.24+ |
| langchain | 0.2+ |
| openai | 1.30+ |
| faiss-cpu | 1.8+ |
| sqlmodel | 0.0.19+ |
| python-dotenv | 1.0+ |
| sse-starlette | 2.1+ |
| python-multipart | 0.0.9+ |

### Frontend (`frontend/package.json`)
| Package | Version |
|---------|---------|
| react | 18+ |
| typescript | 5+ |
| vite | 5+ |
| tailwindcss | 3+ |
| zustand | 4+ |
| axios | 1.7+ |
| react-dropzone | 14+ |
| react-markdown | 9+ |
| lucide-react | 0.383+ |

## Environment Variables

Copy `.env.example` → `.env` in `backend/` (never commit `.env`):
- `OPENAI_API_KEY` — required for embeddings and chat
- `DATABASE_URL` — SQLite path (default: `sqlite:///./data/study_assistant.db`)
- `FAISS_INDEX_PATH` — directory for `.index` files per session

## Performance Targets

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-01 | Streaming starts (P95) | < 2 seconds |
| NFR-02 | 100-page PDF end-to-end | < 30 seconds |
| NFR-03 | FAISS search (10K chunks) | < 200 ms |
| NFR-05 | OpenAI key exposure | Server-side only, never frontend |
| NFR-06 | Scale per session | 5 docs / 500 pages |

## Evaluation (RAGAS)

Run after Week 6 with a 20-question test set:
```bash
pip install ragas
# collect (question, answer, retrieved_chunks, ground_truth) for each test question
# run ragas.evaluate() — see RAGAS docs for dataset schema
# log results to CSV, include table in README
```

Targets: Answer Relevance > 0.80, Context Precision > 0.75, Faithfulness > 0.90, Chunk Hit Rate > 80%.

## Deployment

Recommended: **Railway.app** (free tier, one-click Docker deploy, persistent disk).
- Add `Dockerfile` to `backend/`
- Add CORS origin for deployed frontend domain in FastAPI
- Set `PORT` env var (Railway injects automatically)
- Verify `GET /ping` returns 200 after deploy
- Deploy React frontend to Vercel, pair with Railway backend via CORS
