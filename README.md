# Study Assistant

A RAG-powered study assistant where students upload PDFs and chat with them via a natural language chatbot. Answers are grounded in uploaded documents with inline citations, similarity scores, and a low-confidence warning when retrieval quality is poor.

## Tech Stack

**Backend:** FastAPI · FAISS · SQLite (SQLModel) · OpenAI API · PyMuPDF · LangChain

**Frontend:** React 19 · TypeScript · Vite · Tailwind CSS v4 · Zustand · react-markdown

## Architecture

Three-tier: React SPA → FastAPI backend → (FAISS + SQLite + OpenAI API).

- **Document ingestion:** PDF → PyMuPDF text extraction → LangChain chunking (512 chars, 50 overlap) → OpenAI `text-embedding-3-small` embeddings → FAISS IndexFlatIP
- **Chat pipeline:** Question embedding → FAISS cosine similarity search (top-5) → GPT-4o-mini streaming via SSE → citations with scores
- **Session management:** Sessions auto-prune when they have no documents; full delete cascades to chunks, vectors, and uploaded files
- **Upload confirmation:** Green success banner shown in the chat panel after successful PDF upload

## Getting Started

### Backend

```bash
cd backend
cp .env.example .env          # add your OPENAI_API_KEY
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload  # http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                    # http://localhost:5173
```

## Environment Variables

```
OPENAI_API_KEY=sk-...
DATABASE_URL=sqlite:///./data/study_assistant.db
FAISS_INDEX_DIR=./data/faiss_indices
UPLOAD_DIR=./uploads
```

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/upload` | Upload PDFs (max 5, 20 MB each); returns chunk counts |
| `POST` | `/chat` | SSE streaming chat with citations |
| `GET` | `/sessions` | List sessions (auto-prunes empty sessions) |
| `DELETE` | `/sessions/{id}` | Delete session and all associated data |
| `GET` | `/documents` | List documents for a session |
| `DELETE` | `/documents/{id}` | Remove document and its vectors |

Chat responses stream as SSE: `token` → `citations` → `done` (or `error`).

## Testing

```bash
cd backend && pytest            # 19 tests (OpenAI calls mocked)
cd frontend && npm run test
```

## Deployment

- **Backend → Railway:** `railway.json` and `Dockerfile` included in `backend/`
- **Frontend → Vercel:** set `VITE_API_URL` to your Railway domain; update `allow_origins` in `backend/app/main.py`

## Evaluation (RAGAS)

```bash
cd backend
pip install ragas datasets
python eval/evaluate.py --session_id <id>
```

Targets: `answer_relevancy > 0.80`, `context_precision > 0.75`, `faithfulness > 0.90`.

Fill `eval/test_set.json` with real questions from your uploaded PDFs before running.
