# Persistent Chat History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist chat messages in SQLite so conversations survive page refreshes and session switching.

**Architecture:** New `ChatMessage` model stored in SQLite. The `/chat` endpoint saves user and assistant messages automatically. A new `GET /messages` endpoint serves history. The frontend loads messages on session select instead of starting empty. The `history` field is removed from the chat request — the backend loads history from the DB.

**Tech Stack:** SQLModel, FastAPI, Zustand, Axios

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/app/models/chat_message.py` | Create | `ChatMessage` SQLModel |
| `backend/app/database.py` | Modify | Import `ChatMessage` to register table |
| `backend/app/routers/chat.py` | Modify | Save messages to DB, load history from DB, remove `history` from request |
| `backend/app/routers/sessions.py` | Modify | Add `GET /messages` endpoint, delete chat messages in `_delete_session_data` |
| `backend/tests/test_chat.py` | Modify | Update tests for removed `history` field, add message persistence test |
| `frontend/src/api/client.ts` | Modify | Add `getMessages()`, remove `history` param from `streamChat` |
| `frontend/src/store/useAppStore.ts` | Modify | Add `setMessages()` action |
| `frontend/src/components/Sidebar.tsx` | Modify | Load messages on session select |
| `frontend/src/components/ChatPanel.tsx` | Modify | Remove history construction from `handleSubmit` |

---

### Task 1: Create ChatMessage Model

**Files:**
- Create: `backend/app/models/chat_message.py`
- Modify: `backend/app/database.py`

- [ ] **Step 1: Create the ChatMessage model**

Create `backend/app/models/chat_message.py`:

```python
from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime

class ChatMessage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: str = Field(index=True)
    role: str  # "user" or "assistant"
    content: str
    citations: Optional[str] = None  # JSON string, null for user messages
    low_confidence: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
```

- [ ] **Step 2: Register the model in database.py**

In `backend/app/database.py`, add the import alongside the existing model imports:

```python
from app.models.chat_message import ChatMessage  # noqa: F401
```

Add this after the `from app.models.user import User` line.

- [ ] **Step 3: Verify the table is created**

Run:
```bash
cd backend && source venv/bin/activate && python -c "from app.database import create_db; create_db(); print('OK')"
```
Expected: `OK` with no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/chat_message.py backend/app/database.py
git commit -m "feat: add ChatMessage model for persistent chat history"
```

---

### Task 2: Add GET /messages Endpoint and Cascade Delete

**Files:**
- Modify: `backend/app/routers/sessions.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_chat.py`:

```python
def test_get_messages_returns_empty_for_new_session(client, auth_headers):
    """GET /messages returns empty list for a session with no messages."""
    # Create a session via upload first
    import fitz, io
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Test content. " * 50)
    buf = io.BytesIO()
    doc.save(buf)
    pdf_bytes = buf.getvalue()

    with patch("app.routers.upload.embed_texts", side_effect=mock_embed):
        upload_resp = client.post(
            "/upload",
            files=[("files", ("test.pdf", pdf_bytes, "application/pdf"))],
            headers=auth_headers,
        )
    session_id = upload_resp.json()["session_id"]

    resp = client.get(f"/messages?session_id={session_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd backend && source venv/bin/activate && pytest tests/test_chat.py::test_get_messages_returns_empty_for_new_session -v
```
Expected: FAIL — 404 or 405 because the endpoint doesn't exist yet.

- [ ] **Step 3: Implement GET /messages and cascade delete**

In `backend/app/routers/sessions.py`, add the `ChatMessage` import at the top:

```python
from app.models.chat_message import ChatMessage
```

Add the endpoint after the existing routes:

```python
@router.get("/messages")
def list_messages(session_id: str, db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = db.get(Session, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    messages = db.exec(
        select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at)
    ).all()
    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "citations": json.loads(m.citations) if m.citations else None,
            "low_confidence": m.low_confidence,
            "created_at": m.created_at.isoformat(),
        }
        for m in messages
    ]
```

Add `import json` at the top of the file if not already present.

In `_delete_session_data`, add chat message deletion before the existing chunk deletion:

```python
    # Delete chat messages
    chat_messages = db.exec(select(ChatMessage).where(ChatMessage.session_id == session_id)).all()
    for m in chat_messages:
        db.delete(m)
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd backend && source venv/bin/activate && pytest tests/test_chat.py::test_get_messages_returns_empty_for_new_session -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/sessions.py backend/tests/test_chat.py
git commit -m "feat: add GET /messages endpoint and cascade delete for chat messages"
```

---

### Task 3: Modify /chat to Save Messages and Load History from DB

**Files:**
- Modify: `backend/app/routers/chat.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_chat.py`:

```python
def test_chat_persists_messages(client, auth_headers):
    """POST /chat saves user and assistant messages to the database."""
    import fitz, io
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
            headers=auth_headers,
        )
    session_id = upload_resp.json()["session_id"]

    mock_stream = MagicMock(return_value=iter(["Hello", " world."]))

    with patch("app.routers.chat.embed_texts", side_effect=mock_embed), \
         patch("app.routers.chat.stream_answer", mock_stream):
        client.post(
            "/chat",
            json={"session_id": session_id, "question": "What is gradient descent?"},
            headers={**auth_headers, "Accept": "text/event-stream"},
        )

    # Verify messages were saved
    resp = client.get(f"/messages?session_id={session_id}", headers=auth_headers)
    messages = resp.json()
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[0]["content"] == "What is gradient descent?"
    assert messages[1]["role"] == "assistant"
    assert messages[1]["content"] == "Hello world."
    assert messages[1]["citations"] is not None
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd backend && source venv/bin/activate && pytest tests/test_chat.py::test_chat_persists_messages -v
```
Expected: FAIL — messages not saved yet.

- [ ] **Step 3: Implement message saving and DB history loading in chat.py**

Replace `backend/app/routers/chat.py` with these changes:

Add imports at the top:
```python
from app.models.chat_message import ChatMessage
```

Remove `history` from `ChatRequest`:
```python
class ChatRequest(BaseModel):
    session_id: str
    question: str
```

Replace the `chat` function body. The key changes are:
1. Save user message before streaming
2. Load history from ChatMessage table
3. Accumulate streamed tokens and save assistant message after streaming

```python
@router.post("/chat")
async def chat(request: ChatRequest, db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Verify session belongs to current user
    session = db.get(Session, request.session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    index_path = (pathlib.Path(settings.faiss_index_dir) / f"{request.session_id}.index").resolve()
    allowed = pathlib.Path(settings.faiss_index_dir).resolve()
    if not str(index_path).startswith(str(allowed)):
        raise HTTPException(status_code=400, detail="Invalid session_id")
    index_path = str(index_path)

    if not os.path.exists(index_path):
        raise HTTPException(status_code=404, detail="No documents in this session. Upload a PDF first.")

    store = VectorStore(index_path=index_path)
    store.load()

    # Embed the question
    query_vector = embed_texts([request.question])
    chunk_ids, scores = store.search(query_vector, k=5)

    if not chunk_ids:
        raise HTTPException(status_code=422, detail="No indexed content in session")

    # Fetch chunks from SQLite
    chunks = db.exec(select(Chunk).where(Chunk.id.in_(chunk_ids))).all()
    id_to_score = dict(zip(chunk_ids, scores))
    chunks.sort(key=lambda c: id_to_score.get(c.id, 0), reverse=True)

    top_score = scores[0] if scores else 0.0
    low_confidence = top_score < LOW_CONFIDENCE_THRESHOLD

    # Save user message
    user_msg = ChatMessage(session_id=request.session_id, role="user", content=request.question)
    db.add(user_msg)
    db.commit()

    # Load history from DB (last 10 messages before the one we just saved)
    history_rows = db.exec(
        select(ChatMessage)
        .where(ChatMessage.session_id == request.session_id)
        .order_by(ChatMessage.created_at)
    ).all()
    history = [{"role": m.role, "content": m.content} for m in history_rows[-11:-1]]

    def event_stream():
        try:
            full_response = []
            for token in stream_answer(request.question, chunks, history):
                full_response.append(token)
                yield f"event: token\ndata: {json.dumps({'content': token})}\n\n"

            citations = [
                {"file": c.file_name, "page": c.page_num, "text": c.text, "score": id_to_score.get(c.id, 0)}
                for c in chunks
            ]
            yield f"event: citations\ndata: {json.dumps({'citations': citations, 'low_confidence': low_confidence})}\n\n"

            # Save assistant message
            assistant_msg = ChatMessage(
                session_id=request.session_id,
                role="assistant",
                content="".join(full_response),
                citations=json.dumps(citations),
                low_confidence=low_confidence,
            )
            db.add(assistant_msg)
            db.commit()

            yield f"event: done\ndata: {json.dumps({})}\n\n"
        except Exception as exc:
            yield f"event: error\ndata: {json.dumps({'detail': str(exc)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd backend && source venv/bin/activate && pytest tests/test_chat.py::test_chat_persists_messages -v
```
Expected: PASS

- [ ] **Step 5: Update existing chat test**

In `test_chat_returns_sse_stream`, change the request body from:
```python
json={"session_id": session_id, "question": "What is gradient descent?", "history": []},
```
to:
```python
json={"session_id": session_id, "question": "What is gradient descent?"},
```

In `test_chat_requires_auth`, change:
```python
json={"session_id": "fake", "question": "test", "history": []},
```
to:
```python
json={"session_id": "fake", "question": "test"},
```

- [ ] **Step 6: Run all tests**

Run:
```bash
cd backend && source venv/bin/activate && pytest -v
```
Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/chat.py backend/tests/test_chat.py
git commit -m "feat: persist chat messages in /chat endpoint, load history from DB"
```

---

### Task 4: Frontend — Add getMessages API Function and Remove history from streamChat

**Files:**
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: Add getMessages function**

In `frontend/src/api/client.ts`, add after the `getDocuments` function:

```typescript
export interface ApiMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[] | null;
  low_confidence: boolean;
  created_at: string;
}

export async function getMessages(sessionId: string): Promise<ApiMessage[]> {
  const { data } = await api.get<ApiMessage[]>('/messages', { params: { session_id: sessionId } });
  return data;
}
```

- [ ] **Step 2: Remove history parameter from streamChat**

Change the `streamChat` function signature from:
```typescript
export function streamChat(
  sessionId: string,
  question: string,
  history: Array<{ role: string; content: string }>,
  handlers: {
```
to:
```typescript
export function streamChat(
  sessionId: string,
  question: string,
  handlers: {
```

Change the `body: JSON.stringify(...)` line from:
```typescript
body: JSON.stringify({ session_id: sessionId, question, history }),
```
to:
```typescript
body: JSON.stringify({ session_id: sessionId, question }),
```

- [ ] **Step 3: Verify frontend compiles (expect errors in ChatPanel — that's Task 6)**

Run:
```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: Errors only in `ChatPanel.tsx` (passing `history` to `streamChat`). No errors in `client.ts`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/client.ts
git commit -m "feat: add getMessages API, remove history param from streamChat"
```

---

### Task 5: Frontend — Add setMessages Action to Store

**Files:**
- Modify: `frontend/src/store/useAppStore.ts`

- [ ] **Step 1: Add setMessages action**

In `frontend/src/store/useAppStore.ts`, add to the `AppState` interface:

```typescript
setMessages: (messages: Message[]) => void;
```

Add the implementation in the `create` call, after `setDocuments`:

```typescript
setMessages: (messages) => set({ messages }),
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/store/useAppStore.ts
git commit -m "feat: add setMessages action to app store"
```

---

### Task 6: Frontend — Load Messages on Session Select and Update ChatPanel

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/components/ChatPanel.tsx`

- [ ] **Step 1: Load messages in Sidebar on session select**

In `frontend/src/components/Sidebar.tsx`, add `getMessages` to the import:

```typescript
import { getSessions, getDocuments, deleteDocument, deleteSession, logout, getMessages } from '../api/client';
```

Add `setMessages` to the store destructuring:

```typescript
const { sessions, currentSessionId, documents, setSessions, setCurrentSessionId, setDocuments, setMessages, removeDocument, removeSession } = useAppStore();
```

Update `selectSession` to load messages:

```typescript
const selectSession = async (id: string) => {
  setCurrentSessionId(id);
  const [docs, msgs] = await Promise.all([
    getDocuments(id),
    getMessages(id),
  ]);
  setDocuments(docs);
  setMessages(msgs.map((m) => ({
    id: String(m.id),
    role: m.role,
    content: m.content,
    citations: m.citations ?? undefined,
    lowConfidence: m.low_confidence,
  })));
};
```

- [ ] **Step 2: Update ChatPanel to remove history from streamChat**

In `frontend/src/components/ChatPanel.tsx`, in the `handleSubmit` function, remove the `history` construction:

Delete these lines:
```typescript
const history = messages
  .filter((m) => !m.isStreaming)
  .map((m) => ({ role: m.role, content: m.content }));
```

Change the `streamChat` call from:
```typescript
streamChat(currentSessionId, question, history, {
```
to:
```typescript
streamChat(currentSessionId, question, {
```

Remove `messages` from the `useCallback` dependency array (it's no longer used in `handleSubmit`):
```typescript
}, [input, currentSessionId, isStreaming, addUserMessage, startAssistantMessage, appendToken, finishMessage, setIsStreaming]);
```

- [ ] **Step 3: Verify frontend compiles and builds**

Run:
```bash
cd frontend && npx tsc --noEmit && npm run build
```
Expected: No errors, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Sidebar.tsx frontend/src/components/ChatPanel.tsx
git commit -m "feat: load persisted messages on session select, remove history from chat"
```

---

### Task 7: Update CLAUDE.md and Context Files

**Files:**
- Modify: `CLAUDE.md`
- Modify: `.claude/BACKEND.md`
- Modify: `.claude/FRONTEND.md`

- [ ] **Step 1: Update CLAUDE.md**

Add the `ChatMessage` model to the Backend Layout section under `models/`:
```
│       ├── chat_message.py  # ChatMessage(id, session_id, role, content, citations, low_confidence, created_at)
```

Add `GET /messages` to the API Reference section:
```markdown
### `GET /messages?session_id={id}`
Returns chat messages for a session, ordered by `created_at` ascending.
Each message includes `id`, `role`, `content`, `citations` (parsed JSON array or null), `low_confidence`, and `created_at`.
```

Update the `POST /chat` section to remove `history` from the request body:
```json
{ "session_id": "uuid", "question": "..." }
```

Add to Key Implementation Decisions:
```markdown
- **Persistent chat history**: Messages are saved to a `ChatMessage` table in SQLite. The `/chat` endpoint saves the user question before streaming and the assistant response after streaming completes. History for LLM context is loaded from the DB (last 10 messages), not sent by the frontend.
```

- [ ] **Step 2: Update .claude/BACKEND.md**

Add `ChatMessage` to the Models section:
```
**ChatMessage**: `id: int` (auto PK), `session_id: str` (indexed), `role: str`, `content: str`, `citations: str` (nullable JSON), `low_confidence: bool`, `created_at: datetime`
```

Update the sessions router description to include `GET /messages`.

Update the chat router description to note it no longer accepts `history` in the request body and now saves messages to DB.

- [ ] **Step 3: Update .claude/FRONTEND.md**

Add `getMessages(sessionId)` to the API Client table.

Remove the note about `streamChat` accepting `history` parameter.

Note that `Sidebar.tsx` now loads messages on session select.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md .claude/BACKEND.md .claude/FRONTEND.md
git commit -m "docs: update context files for persistent chat history"
```

---

### Task 8: End-to-End Verification

- [ ] **Step 1: Run all backend tests**

```bash
cd backend && source venv/bin/activate && pytest -v
```
Expected: All tests pass.

- [ ] **Step 2: Build frontend**

```bash
cd frontend && npm run build
```
Expected: Build succeeds with no errors.

- [ ] **Step 3: Manual smoke test**

1. Start backend: `cd backend && uvicorn app.main:app --reload`
2. Start frontend: `cd frontend && npm run dev`
3. Sign up / log in
4. Upload a PDF
5. Ask a question — verify answer streams
6. Refresh the page — verify messages are still there when you click the session
7. Ask another question — verify it appends to existing history
8. Delete the session — verify cleanup works
