# Frontend Context

Quick-reference for working on the frontend (`frontend/`). For full project overview, see [CLAUDE.md](CLAUDE.md).

## Quick Start

```bash
cd frontend
npm install
npm run dev      # Vite on port 5173
npm run build    # tsc + vite build
npm run test     # vitest
```

## File Map

| File | Purpose |
|------|---------|
| `src/main.tsx` | Entry point, renders `<App />` into `#root` with `StrictMode` |
| `src/types.ts` | All shared TypeScript interfaces |
| `src/api/client.ts` | Axios instance + JWT interceptor + API functions + SSE streaming via fetch |
| `src/store/useAppStore.ts` | Zustand store: sessions, messages, streaming state + actions (incl. regenerateMessage) |
| `src/store/useAuthStore.ts` | Zustand store: token, email, isAuthenticated + auth actions |
| `src/store/useToastStore.ts` | Zustand store: toast notifications with auto-dismiss (4s) |
| `src/store/useThemeStore.ts` | Zustand store: dark mode toggle with localStorage persistence |
| `src/index.css` | `@import "tailwindcss"` with `@theme` block (notebook palette, chalkboard dark mode, font families), utility classes (.bg-ruled, .bg-paper, .pencil-cursor, .binder-rings), Key Concepts card styling |

### Types (`src/types.ts`)

```typescript
Session       { id, name, created_at, doc_count }
Document      { id, name, pages, chunks }
Citation      { file, page, text, score }
Message       { id, role: "user"|"assistant", content, citations?, isStreaming?, lowConfidence? }
UploadResponse { session_id, files: [{name, pages, chunks, status}], total_chunks }
AuthResponse  { access_token, token_type, user_id, email }
SSEEvent      union: token | citations | done
```

### API Client (`src/api/client.ts`)

Base URL from `VITE_API_URL` env var (defaults to `http://localhost:8000`).

**Auth:** Axios interceptor auto-attaches `Authorization: Bearer <token>` from `localStorage('access_token')` to all requests. The `streamChat` function (raw `fetch`) manually reads the token and adds the header.

| Function | Method | Endpoint | Notes |
|----------|--------|----------|-------|
| `signup(email, password)` | POST | `/auth/signup` | Stores token in localStorage, returns `AuthResponse` |
| `login(email, password)` | POST | `/auth/login` | Stores token in localStorage, returns `AuthResponse` |
| `logout()` | — | — | Clears `access_token` and `user_email` from localStorage |
| `uploadFiles(files, sessionId?)` | POST | `/upload` | FormData with `files[]` |
| `getSessions()` | GET | `/sessions` | Returns `Session[]` |
| `getDocuments(sessionId)` | GET | `/documents?session_id=` | Returns `Document[]` |
| `deleteDocument(docId)` | DELETE | `/documents/{id}` | |
| `deleteSession(sessionId)` | DELETE | `/sessions/{id}` | |
| `renameSession(sessionId, name)` | PATCH | `/sessions/{id}` | Body: `{name}`. Returns `{id, name}` |
| `getMessages(sessionId)` | GET | `/messages?session_id=` | Returns `ApiMessage[]` (persisted chat history) |
| `streamChat(sessionId, question, handlers)` | POST | `/chat` | Raw `fetch` with `AbortController` for SSE. NOT Axios. Manually attaches Bearer token. Handlers: `onToken`, `onCitations`, `onDone`, `onError`. Returns cleanup function that aborts fetch. Parses SSE manually (regex on `event:` and `data:` lines). Reads JSON error body on non-OK responses. No `history` param — backend loads history from DB. |
| `regenerateMessage(messageId, handlers)` | POST | `/messages/{id}/regenerate` | Same SSE pattern as `streamChat`. Raw `fetch` with `AbortController`. Re-runs RAG pipeline for existing message. Handlers: `onToken`, `onCitations`, `onDone`, `onError`. Returns cleanup function |
| `exportSession(sessionId)` | GET | `/sessions/{id}/export` | Raw `fetch`. Downloads markdown file via blob URL. Parses `Content-Disposition` header for filename. Creates temporary `<a>` element for download |

### Auth Store (`src/store/useAuthStore.ts`)

**State:** `token`, `email`, `isAuthenticated` — initialized from `localStorage` on load.

**Actions:**
- `setAuth(token, email)` — saves to localStorage + updates state
- `clearAuth()` — removes from localStorage + resets state

### Toast Store (`src/store/useToastStore.ts`)

**State:** `toasts: Toast[]` — each toast has `id`, `message`, `type` (success/error/warning)

**Actions:**
- `addToast(message, type)` — adds toast with auto-generated UUID, auto-removes after 4s
- `removeToast(id)` — manually remove a toast

### Theme Store (`src/store/useThemeStore.ts`)

**State:** `isDark: boolean` — initialized from `localStorage('theme')`

**Actions:**
- `toggleTheme()` — flips dark mode, persists to localStorage, toggles `.dark` class on `<html>`

Side effect: applies `.dark` class on module load if `localStorage('theme') === 'dark'`

### App Store (`src/store/useAppStore.ts`)

**State:**
`sessions`, `currentSessionId`, `documents`, `messages`, `isStreaming`

**Actions (store is a thin state container — orchestration lives in components):**
- `setSessions(sessions)` — replace all sessions
- `setCurrentSessionId(id)` — switch session, clears documents (messages loaded separately via API)
- `setDocuments(docs)` — update documents for current session
- `addUserMessage(content) -> id` — creates message with `crypto.randomUUID()`
- `startAssistantMessage() -> id` — creates empty assistant message with `isStreaming: true`
- `appendToken(id, token)` — appends token to specific message
- `finishMessage(id, citations, lowConfidence)` — sets `isStreaming: false`, adds citations
- `setMessages(messages)` — replace all messages (used to load persisted chat history)
- `setIsStreaming(v)` — global streaming flag
- `removeDocument(docId)` — filters out document
- `removeSession(sessionId)` — removes session, clears state if it was current
- `updateSessionName(sessionId, name)` — updates session name in the sessions array (optimistic UI)
- `startNewChat()` — resets `currentSessionId`, `documents`, and `messages` to null/empty
- `regenerateMessage(id)` — resets message content to empty, sets `isStreaming: true`, clears citations/lowConfidence

### Components

| Component | What It Does |
|-----------|-------------|
| `App.tsx` | Auth gate: renders `<AuthPage>` when not authenticated, otherwise responsive shell with hamburger menu (mobile), `<Sidebar>` (with mobile overlay), pink margin line, `<ChatPanel>` (flex-1), `<ToastContainer>` globally. Imports `useThemeStore` for dark mode side-effect |
| `AuthPage.tsx` | Notebook-themed login/signup: `bg-paper bg-ruled` background, cream card with slight rotation (`-rotate-1`), `BookOpen` icon, Caveat font title. Toggles login/signup modes. Shows backend error messages |
| `Sidebar.tsx` | Kraft background with `binder-rings` class. Dark mode toggle (Moon/Sun icons). New Chat button. Session list with pencil-blue active border. Inline rename. ConfirmDialog for deletes. Toast notifications on all async actions. `onClose` prop for mobile dismiss. Document list with delete. User email + logout |
| `ChatPanel.tsx` | Message list with auto-scroll. Welcome screen with Caveat heading + `<UploadZone>`. Export Notes button (FileDown icon) when messages exist. Paperclip mid-chat upload with toast notifications. Cream/frosted input bar. Passes `isLatest` + `onSuggestionClick` to MessageBubble for suggestion pill auto-submit |
| `MessageBubble.tsx` | User bubbles (`bg-pencil text-white`), assistant bubbles (cream index cards with hover shadow). `<ReactMarkdown>` in prose wrapper. Pencil cursor animation during streaming. Regenerate button (RefreshCw icon) calls `regenerateMessage` API. `extractDigDeeper()` parses `## Dig Deeper` from content into clickable pill buttons (only on latest message via `isLatest` prop). Low confidence amber warning |
| `CitationCard.tsx` | Cream background with ruled border, pencil-blue `FileText` icon. Green badge (>=70%) / amber badge (<70%). Expandable to show chunk text. Dark mode variants with `aria-expanded`/`aria-label` |
| `UploadZone.tsx` | Folder pocket styling with `FolderOpen` icon. `react-dropzone`: PDF only, max 5 files, max 20 MB. Drag-active scale effect. Toast notifications instead of inline errors. Props: `onUploaded?: (fileCount, sessionId) => void` |
| `Toast.tsx` | `ToastContainer`: fixed top-right stack. Success (green CheckCircle), warning (amber AlertTriangle), error (red XCircle) variants. `slideIn` CSS animation. Auto-dismiss via `useToastStore`. Dark mode support |
| `ConfirmDialog.tsx` | Modal dialog with notebook styling: tilted card (`rotate-1`), cream background. Title, message, confirm/cancel buttons. Backdrop click to cancel. Dark mode variants |

## Tests

**No test files exist yet.** Infrastructure is ready:
- vitest configured in `vite.config.ts` with `jsdom` environment
- `src/test-setup.ts` imports `@testing-library/jest-dom`
- `@testing-library/react` and `@testing-library/jest-dom` installed as dev deps

## Dependencies

**Runtime:** react 19.2, react-dom 19.2, axios ^1.14.0, zustand ^5.0.12, react-dropzone ^15.0.0, react-markdown ^10.1.0, lucide-react ^1.7.0

**Dev:** typescript ~5.9.3, vite ^8.0.1, @vitejs/plugin-react ^4.4.1, tailwindcss ^4.2.2, @tailwindcss/vite ^4.1.3, vitest ^4.1.2, @testing-library/react ^16.3.0, @testing-library/jest-dom ^6.6.3, eslint + plugins

## Config

- **Vite**: `vite.config.ts` — plugins: `react()`, `tailwindcss()`. Dev proxy: `/api/*` -> `http://localhost:8000` (strips `/api` prefix). Test config: vitest with jsdom + setup file
- **Tailwind v4**: CSS-first config via `@import "tailwindcss"` in `index.css`. A `tailwind.config.js` exists (content paths) but v4 primarily uses the Vite plugin
- **TypeScript**: strict mode, ES2023 target, bundler module resolution, `noUnusedLocals` + `noUnusedParameters` enabled
- **ESLint**: typescript-eslint + react-hooks/refresh plugins

## Environment Variables

```
VITE_API_URL=http://localhost:8000   # backend URL (default)
```

For production (Vercel): set `VITE_API_URL` to your Railway backend domain.

## Gotchas

- **JWT in localStorage** — token stored in `localStorage('access_token')`, email in `localStorage('user_email')`. Axios interceptor auto-attaches to all requests. `streamChat` (raw fetch) reads token manually.
- **Auth gate in App.tsx** — `useAuthStore.isAuthenticated` controls whether `AuthPage` or the main app renders. No routing library — just a conditional.
- **401 handling** — currently no automatic redirect to login on 401. If token expires, API calls fail and user must manually reload.
- **Tailwind v4** — uses `@import "tailwindcss"` with `@theme` block and `@tailwindcss/vite` plugin, NOT the v3 PostCSS setup. Custom colors (cream, kraft, ruled, pencil, chalk-*) and fonts (Caveat, Inter) defined in `@theme`.
- **Google Fonts** — Caveat (handwriting) and Inter (body) loaded via `<link>` in `index.html` with preconnect hints.
- **`react-markdown` v10** — does NOT accept `className` prop on `<ReactMarkdown>`. Prose class goes on wrapper div.
- **Dark mode** — `.dark` class on `<html>`, toggled by `useThemeStore`. Chalkboard-green palette. Persisted in `localStorage('theme')`. Applied on module load via side-effect in `useThemeStore.ts`.
- **Toast notifications** — `useToastStore` manages toasts; `<ToastContainer>` rendered in `App.tsx`. Auto-dismiss after 4s. Used in place of inline success/error messages throughout.
- **Confirm dialogs** — `<ConfirmDialog>` used for destructive actions (session/document delete) in Sidebar.
- **Follow-up suggestions** — `extractDigDeeper()` in `MessageBubble.tsx` parses `## Dig Deeper\n- question` from assistant content. Renders clickable pills on the latest message only (`isLatest` prop). `onSuggestionClick` auto-fills input and triggers submit via `setTimeout` + DOM query.
- **Regenerate response** — `regenerateMessage` in `client.ts` streams SSE same as `streamChat`. `useAppStore.regenerateMessage(id)` resets the message to empty/streaming state before re-streaming.
- **SSE via `fetch`** — uses `fetch` + `ReadableStream`, not `EventSource`, because backend uses `POST /chat` and `EventSource` only supports GET.
- **Upload success banner** — lives in `ChatPanel` (not `UploadZone`) because `UploadZone` unmounts when a new session is created on first upload.
- **Upload callback receives sessionId** — `UploadZone.onUploaded` passes `sessionId` from the upload response. `handleUploadComplete` uses this instead of the closure-captured `currentSessionId` to avoid stale state when a new session was just created.
- **Session auto-naming** — backend renames "New Session" to first question on `/chat`. Frontend also optimistically updates the sidebar via `updateSessionName` for instant feedback.
- **Mid-chat upload** — paperclip button in input bar uses a hidden `<input type="file">` (not `react-dropzone`) to avoid layout disruption. Calls `uploadFiles` directly and triggers the same `handleUploadComplete` flow.
- **SSE error detail** — `streamChat` and `regenerateMessage` read JSON response body on non-OK to surface backend error messages, not raw status codes.
- **Export** — `exportSession` in `client.ts` downloads via blob URL. Parses `Content-Disposition` header for filename, falls back to `study-session.md`. Creates temporary `<a>` element, clicks it, then cleans up.
