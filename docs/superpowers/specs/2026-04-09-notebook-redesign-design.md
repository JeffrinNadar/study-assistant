# Study Assistant — Notebook Redesign & Feature Additions

**Date:** 2026-04-09
**Status:** Approved
**Audience:** Portfolio project — visual impact and UX polish are top priority

---

## Overview

Three-phase improvement to the Study Assistant app: a notebook-themed UI redesign, backend hardening (rate limiting), structured conversation format with regenerate, and study-oriented features (follow-up suggestions, chat export).

---

## Phase 1: Notebook Theme + UI Polish

### Visual Design Language

**Core concept:** The app feels like a well-loved school notebook — ruled lines, handwriting-inspired accents, paper textures, stationery colors.

**Color palette:**
| Token | Value | Usage |
|-------|-------|-------|
| Background | `#FFF8F0` (warm cream) | Main page background |
| Ruled lines | `#C5D1E0` (faint blue) | Decorative horizontal lines in chat area |
| Margin line | `#E8A0BF` (soft pink-red) | Vertical line between sidebar and chat |
| Primary accent | `#2B4C7E` (deep pencil blue) | Buttons, links, active states |
| Secondary accent | `#E8A0BF` (eraser pink) | Highlights, badges, hover states |
| Sidebar bg | `#F5EDE3` (kraft paper) | Sidebar background |
| Text | `#2D2D2D` (dark charcoal) | Body text |
| Chalkboard bg | `#2C3E2D` (dark green slate) | Dark mode background |
| Chalk text | `#F0EDE6` | Dark mode text |

**Typography:**
- App title, section headers, empty states: `Patrick Hand` or `Caveat` (Google Fonts, handwriting style)
- Body text, messages, inputs: `Inter` or system sans-serif
- Code/citations: system monospace

**Decorative elements:**
- Subtle paper texture CSS background on main area (very light, not distracting)
- Chat messages styled as index cards (light shadow, slight border-radius variation)
- Upload zone styled as a folder pocket: "Drop your notes here"
- Sidebar session items styled as notebook tabs
- On-theme icons: pencil for edit, eraser for delete
- Streaming cursor: pencil-writing CSS animation instead of `▍`
- 3-4 "binder ring" circles along the right edge of the sidebar

**Dark mode — "Chalkboard" variant:**
- Dark green/slate background, chalk-white text
- Same school aesthetic but inverted
- Toggle switch in sidebar footer (next to user email)

### Layout & Responsiveness

**Desktop (>1024px):**
- Two-column: sidebar (264px) + chat area (flex-1)
- Sidebar has binder ring decoration on its right edge
- Chat area background has faint repeating horizontal ruled lines
- Red/pink margin line as a border between sidebar and chat

**Tablet (768-1024px):**
- Sidebar collapses to icon strip (session icons + new chat button)
- Hamburger menu or swipe-right to expand sidebar as overlay
- Chat area full width

**Mobile (<768px):**
- Sidebar fully hidden, accessible via hamburger menu (top-left)
- Chat input bar sticky at bottom
- Message bubbles full-width, reduced padding
- Upload zone simplified to a button (no large dropzone)

### UX Fixes

**Toast notifications:**
- Top-right toast system: green (success), amber (warning), red (error)
- Replaces console-only error swallowing and inline error text
- Auto-dismiss after 4 seconds, dismissible on click

**Confirmation dialogs:**
- Delete session and delete document trigger a modal
- Text: "Delete [name]? This can't be undone." with Cancel/Delete buttons
- Styled like a torn-out notebook page

**Loading states:**
- Skeleton loaders for session list and message history (ruled-line shimmer effect)
- Upload progress: pencil "filling in" a progress bar

**Accessibility:**
- ARIA labels on all icon-only buttons
- Visible focus rings styled as dashed underlines (teacher markup style)
- Keyboard navigation for sidebar session list

---

## Phase 2: Rate Limiting + Regenerate + Structured Conversations

### Rate Limiting (Backend)

- In-memory per-user rate limiter (dict of user_id -> timestamps)
- No external dependencies (no Redis)
- Limits:
  - Chat: 20 messages/minute per user
  - Upload: 10 uploads/hour per user
- Returns HTTP 429 with `Retry-After` header
- Implemented as a FastAPI dependency, applied to `/chat` and `/upload`
- Frontend: friendly toast "Slow down! You can ask another question in X seconds"

### Regenerate Response

- UI: small retry/refresh icon button below each assistant message
- Clicking sends the same question with fresh context retrieval
- Backend endpoint: `POST /messages/{message_id}/regenerate`
  - Validates message belongs to current user's session
  - Re-runs the RAG pipeline (embed question -> FAISS search -> LLM stream)
  - Replaces the existing assistant message content and citations in DB
  - Returns SSE stream (same format as `/chat`)
- Old response is overwritten, not duplicated — keeps conversation clean

### Structured Conversation Format

The LLM structures every response into sections for study review. Achieved via system prompt changes.

**Updated system prompt structure:**
```
You are a study assistant. Answer the student's question using primarily the context provided below. You may briefly explain foundational concepts if needed to clarify the material.

Use a clear, encouraging tone suitable for student learning. Break complex topics into understandable steps.

Structure your response as follows:

## Answer
[Direct, clear answer to the question]

## Key Concepts
- **[Term]**: [Brief definition/explanation from context]
- (2-5 key terms mentioned in your answer)

## Dig Deeper
- [Follow-up question 1]
- [Follow-up question 2]
- [Follow-up question 3]

If the answer is not in the context, respond: "I couldn't find this in your uploaded documents."
If the context has conflicting information, note the discrepancy and cite both sources.
Keep responses concise (2-3 paragraphs in the Answer section) unless a detailed explanation is requested.
```

**Frontend rendering:**
- `## Answer` renders normally
- `## Key Concepts` renders inside a highlighted box (styled like a study card — cream background, pencil-blue border)
- `## Dig Deeper` questions render as clickable pill buttons below the message (see Phase 3)

---

## Phase 3: Follow-up Suggestions + Chat Export

### Follow-up Question Suggestions

- Generated by the LLM as part of the `## Dig Deeper` section (prompt from Phase 2)
- Frontend parses the `## Dig Deeper` heading and extracts the bullet points
- Renders as clickable pill/chip buttons below the message — styled like sticky-note tabs (cream background, slight shadow, handwriting font)
- Clicking a pill auto-fills the chat input and sends it immediately
- Only shown on the most recent assistant message (older ones show as static text)

### Chat Export

**UI:** Export button in the chat panel header — styled with a "tear out page" icon. Only visible when messages exist in the session.

**Backend endpoint:** `GET /sessions/{session_id}/export?format=md`
- Validates session belongs to current user
- Fetches all messages ordered by `created_at`
- Generates structured markdown:

```markdown
# Study Session: [Session Name]
**Date:** [Session created_at date]
**Documents:** file1.pdf, file2.pdf

---

## Q: [User's question]
### Answer
[Assistant's answer section]
### Key Concepts
[Bulleted concepts]
### Sources
- file.pdf, page 3 (92% match)
- file.pdf, page 7 (85% match)

---

(repeats for each Q&A pair)
```

- Returns the file with `Content-Disposition: attachment; filename="[session-name].md"`
- Frontend triggers download via a blob URL

---

## Files Affected

### Phase 1 (Theme + UX)
- `frontend/src/index.css` — paper texture, ruled lines, custom font imports, dark mode variables
- `frontend/src/components/App.tsx` — responsive layout wrapper, dark mode state
- `frontend/src/components/Sidebar.tsx` — notebook tabs, binder rings, mobile hamburger, dark mode toggle
- `frontend/src/components/ChatPanel.tsx` — ruled line background, margin line, toast system, confirmation modals, loading skeletons
- `frontend/src/components/MessageBubble.tsx` — index card styling, pencil cursor animation
- `frontend/src/components/CitationCard.tsx` — restyle to match notebook theme
- `frontend/src/components/UploadZone.tsx` — folder pocket styling, progress bar
- `frontend/src/components/AuthPage.tsx` — notebook-themed login page
- New: `frontend/src/components/Toast.tsx` — toast notification component
- New: `frontend/src/components/ConfirmDialog.tsx` — confirmation modal component
- `frontend/src/index.css` — custom theme tokens via `@theme` (Tailwind v4 CSS-first config), no changes needed to `tailwind.config.js`

### Phase 2 (Rate Limiting + Regenerate + Structured)
- New: `backend/app/services/rate_limiter.py` — in-memory rate limiter
- `backend/app/routers/chat.py` — apply rate limit dependency, regenerate endpoint
- `backend/app/routers/upload.py` — apply rate limit dependency
- `backend/app/services/llm.py` — updated system prompt for structured responses
- `frontend/src/components/MessageBubble.tsx` — regenerate button, Key Concepts box styling
- `frontend/src/api/client.ts` — regenerate API call, rate limit error handling
- `frontend/src/store/useAppStore.ts` — regenerate action

### Phase 3 (Suggestions + Export)
- `frontend/src/components/MessageBubble.tsx` — Dig Deeper pill buttons
- New: `backend/app/routers/sessions.py` — export endpoint added
- `frontend/src/components/ChatPanel.tsx` — export button in header
- `frontend/src/api/client.ts` — export API call

---

## Out of Scope

- PostgreSQL migration (SQLite is fine for portfolio)
- Redis/Celery (no background jobs needed at this scale)
- User settings page / password reset
- Document search / full-text search
- Collaboration / sharing features
- Admin panel
