# Persistent Chat History

## Problem

Chat messages live only in Zustand's in-memory state. Switching sessions or refreshing the page loses all conversation history. The backend receives history from the frontend on each `/chat` request but never stores it.

## Decisions

1. **Storage: Backend (SQLite)** — Messages stored in a new `ChatMessage` table, fetched via API. Survives browser clears and device switches. Consistent with existing server-side data ownership.
2. **Save method: Backend saves automatically** — The `/chat` endpoint saves both the user question and the assembled assistant response + citations after streaming finishes. No extra round trip from frontend.
3. **LLM context: Backend loads from DB** — The `/chat` endpoint loads the last 10 messages from `ChatMessage` instead of using frontend-provided `history`. Single source of truth, no frontend/backend divergence.

## Data Model

New `ChatMessage` SQLModel table:

| Column | Type | Details |
|--------|------|---------|
| `id` | `int` | Auto PK |
| `session_id` | `str` | Indexed, links to Session |
| `role` | `str` | `"user"` or `"assistant"` |
| `content` | `str` | Full message text |
| `citations` | `str` (nullable) | JSON-serialized citation list, null for user messages |
| `low_confidence` | `bool` | Default `False` |
| `created_at` | `datetime` | Auto-set |

## Backend Changes

### New endpoint: `GET /messages?session_id=...`

- Lives in `routers/sessions.py`
- Returns messages ordered by `created_at` ascending
- Verifies session ownership via `current_user`

### Modified: `POST /chat`

- Remove `history` field from `ChatRequest`
- Before streaming: save user message to `ChatMessage`
- After streaming completes: save assembled assistant response + citations + `low_confidence` to `ChatMessage`
- Load last 10 messages from `ChatMessage` for LLM context

### Cascade delete

- `DELETE /sessions/{id}` adds `ChatMessage` deletion alongside existing chunk/doc cleanup

## Frontend Changes

### `api/client.ts`

- Add `getMessages(sessionId)` — calls `GET /messages?session_id=...`
- Remove `history` parameter from `streamChat`

### `useAppStore.ts`

- Add `setMessages(messages)` action to load persisted messages with citations/lowConfidence
- `setCurrentSessionId` triggers message loading instead of clearing to empty

### `ChatPanel.tsx`

- On session select: call `getMessages(sessionId)` and populate the store
- Remove history array construction from `handleSubmit`
- Remove `history` from the `streamChat` call

### `types.ts`

- Add type for API message response (or extend `Message` with optional fields)

## What does NOT change

- `Sidebar.tsx` — session switching already calls `setCurrentSessionId`
- `MessageBubble.tsx` — renders from the same `Message` type
- `CitationCard.tsx` — no changes
- `UploadZone.tsx` — no changes
- SSE streaming protocol — same `token` / `citations` / `done` events
