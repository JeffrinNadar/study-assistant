# Study Assistant

A RAG-powered study assistant where students upload PDFs and chat with them via a natural language chatbot. Answers are grounded in uploaded documents with inline citations, similarity scores, and a low-confidence warning when retrieval quality is poor. Features a notebook-themed UI with cream paper, ruled lines, binder rings, handwriting fonts, and a chalkboard dark mode.

## Tech Stack

**Backend:** FastAPI · FAISS · SQLite (SQLModel) · Azure OpenAI · PyMuPDF · LangChain

**Frontend:** React 19 · TypeScript · Vite · Tailwind CSS v4 · Zustand · react-markdown · Google Fonts (Caveat + Inter)

## Architecture

Three-tier: React SPA → FastAPI backend → (FAISS + SQLite + Azure OpenAI). The backend owns **all** AI logic; the frontend is a pure UI layer. All endpoints (except `/ping` and `/auth/*`) require JWT authentication; sessions and documents are scoped per user.

- **Document ingestion:** PDF → PyMuPDF text extraction → LangChain chunking (512 chars, 50 overlap) → Azure OpenAI `text-embedding-3-large` embeddings (3072-dim) → FAISS IndexFlatIP (cosine similarity on L2-normalized vectors)
- **Chat pipeline:** Question embedding → FAISS cosine similarity search (top-5) → GPT-4.1 streaming via SSE → structured responses (## Answer, ## Key Concepts, ## Dig Deeper) → citations with scores → low-confidence warning when best score < 0.70
- **Authentication:** JWT-based signup/login with bcrypt password hashing. 24-hour token expiry. All sessions and documents scoped per user.
- **Rate limiting:** In-memory sliding-window rate limiter. Chat: 20 req/min, Upload: 10 req/hour per user. Returns 429 with Retry-After header.
- **Session management:** Sessions auto-named from first chat question. Inline rename via sidebar. Auto-prune on list when 0 documents remain. Full delete cascades to chunks, vectors, chat messages, and uploaded files.
- **Chat history:** Messages persisted in SQLite. Backend loads last 10 turns for LLM context. Frontend loads history from DB on session select.
- **Regenerate response:** Re-runs RAG pipeline for any assistant message. Updates the existing message in-place.
- **Markdown export:** Download entire session as a structured markdown file with Q&A pairs and citation sources.
- **Mid-chat upload:** Paperclip button in the chat input bar allows uploading additional PDFs without leaving the conversation.
- **Follow-up suggestions:** LLM generates "Dig Deeper" questions; frontend renders them as clickable pills that auto-submit.

## Getting Started

### Backend

```bash
cd backend
cp .env.example .env          # add your Azure OpenAI credentials and JWT secret
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
# Azure OpenAI — Chat (GPT-4.1)
CHAT_API_KEY=...
CHAT_API_ENDPOINT=https://...openai.azure.com/

# Azure OpenAI — Embeddings (text-embedding-3-large)
EMBEDDING_API_KEY=...
EMBEDDING_API_ENDPOINT=https://...openai.azure.com/

# JWT Authentication
JWT_SECRET=change-me-to-a-random-secret

# Storage (resolved to absolute paths at runtime)
DATABASE_URL=sqlite:///./data/study_assistant.db
FAISS_INDEX_DIR=./data/faiss_indices
UPLOAD_DIR=./uploads
```

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/signup` | Register with email + password; returns JWT |
| `POST` | `/auth/login` | Authenticate; returns JWT |
| `POST` | `/upload` | Upload PDFs (max 5, 20 MB each); rate-limited |
| `POST` | `/chat` | SSE streaming chat with citations; rate-limited |
| `POST` | `/messages/{id}/regenerate` | Re-run RAG pipeline for an assistant message; SSE |
| `GET` | `/sessions` | List sessions (auto-prunes empty sessions) |
| `PATCH` | `/sessions/{id}` | Rename a session |
| `DELETE` | `/sessions/{id}` | Delete session and all associated data |
| `GET` | `/sessions/{id}/export` | Download session as markdown file |
| `GET` | `/documents` | List documents for a session |
| `DELETE` | `/documents/{id}` | Remove document and its vectors |
| `GET` | `/messages` | Get persisted chat messages for a session |

Chat responses stream as SSE: `token` → `citations` → `done` (or `error`).

## Testing

```bash
cd backend && pytest            # 31 tests (Azure OpenAI calls mocked)
cd frontend && npm run test     # vitest
```

## Deployment

- **Backend → Railway:** `railway.json` and `Dockerfile` included in `backend/`. Set `CHAT_API_KEY`, `CHAT_API_ENDPOINT`, `EMBEDDING_API_KEY`, `EMBEDDING_API_ENDPOINT`, `JWT_SECRET`, `DATABASE_URL`, `FAISS_INDEX_DIR`, `UPLOAD_DIR` in Railway dashboard.
- **Frontend → Vercel:** set `VITE_API_URL` to your Railway domain; update `allow_origins` in `backend/app/main.py`

## Evaluation (RAGAS)

```bash
cd backend
source venv/bin/activate
pip install ragas langchain-openai
python eval/evaluate.py --session_id <id>
```

Requires the backend running at `http://localhost:8000` and Azure OpenAI credentials in `.env`.

### Results (20 questions across biology, physics, history, CS, and economics)

| Metric | Score | Target | Status |
|--------|-------|--------|--------|
| Answer Relevancy | **0.9216** | > 0.80 | Pass |
| Context Precision | **0.9333** | > 0.75 | Pass |
| Faithfulness | **0.9192** | > 0.90 | Pass |

The test set (`eval/test_set.json`) contains 20 questions with ground-truth answers. Per-question results are saved to `eval/results.csv`.
