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
| `src/api/client.ts` | Axios instance + API functions + SSE streaming via fetch |
| `src/store/useAppStore.ts` | Zustand store: state + all actions |
| `src/index.css` | `@import "tailwindcss"` (v4 CSS-first config) |

### Types (`src/types.ts`)

```typescript
Session    { id, name, created_at, doc_count }
Document   { id, name, pages, chunks }
Citation   { file, page, text, score }
Message    { id, role: "user"|"assistant", content, citations?, isStreaming?, lowConfidence? }
UploadResponse { session_id, files: [{name, pages, chunks, status}], total_chunks }
SSEEvent   union: token | citations | done
```

### API Client (`src/api/client.ts`)

Base URL from `VITE_API_URL` env var (defaults to `http://localhost:8000`).

| Function | Method | Endpoint | Notes |
|----------|--------|----------|-------|
| `uploadFiles(files, sessionId?)` | POST | `/upload` | FormData with `files[]` |
| `getSessions()` | GET | `/sessions` | Returns `Session[]` |
| `getDocuments(sessionId)` | GET | `/documents?session_id=` | Returns `Document[]` |
| `deleteDocument(docId)` | DELETE | `/documents/{id}` | |
| `deleteSession(sessionId)` | DELETE | `/sessions/{id}` | |
| `streamChat(sessionId, question, history, handlers)` | POST | `/chat` | Raw `fetch` with `AbortController` for SSE. NOT Axios. Handlers: `onToken`, `onCitations`, `onDone`, `onError`. Returns cleanup function that aborts fetch. Parses SSE manually (regex on `event:` and `data:` lines). Reads JSON error body on non-OK responses. |

### Zustand Store (`src/store/useAppStore.ts`)

**State:**
`sessions`, `currentSessionId`, `documents`, `messages`, `isStreaming`

**Actions (store is a thin state container — orchestration lives in components):**
- `setSessions(sessions)` — replace all sessions
- `setCurrentSessionId(id)` — switch session, clears messages and documents
- `setDocuments(docs)` — update documents for current session
- `addUserMessage(content) -> id` — creates message with `crypto.randomUUID()`
- `startAssistantMessage() -> id` — creates empty assistant message with `isStreaming: true`
- `appendToken(id, token)` — appends token to specific message
- `finishMessage(id, citations, lowConfidence)` — sets `isStreaming: false`, adds citations
- `setIsStreaming(v)` — global streaming flag
- `removeDocument(docId)` — filters out document
- `removeSession(sessionId)` — removes session, clears state if it was current

### Components

| Component | What It Does |
|-----------|-------------|
| `App.tsx` | Two-column flex layout: `<Sidebar>` + `<ChatPanel>` (flex-1). White background `bg-white` |
| `Sidebar.tsx` | Session list (click to select, trash to delete) + document list for active session with delete buttons. Calls `loadSessions()` on mount. Icons: `BookOpen`, `FileText`, `Trash2` |
| `ChatPanel.tsx` | Message list with auto-scroll, upload success banner (green, auto-dismisses after 4s), `<UploadZone>` when no docs/session, input textarea + send button (disabled during streaming with Loader2 spinner). Icons: `Send`, `Loader2`, `CheckCircle2` |
| `MessageBubble.tsx` | User bubbles (blue, right) / assistant bubbles (white with border, left). Assistant uses `<ReactMarkdown>` in `prose prose-invert` wrapper. Streaming cursor `▍`. Low confidence amber warning with `AlertTriangle`. `CitationCard` list (hidden while streaming) |
| `CitationCard.tsx` | Expandable card: file name, page, score badge (green >= 70% / yellow < 70%). Expanded shows chunk text. Icons: `ChevronDown`/`ChevronUp`, `FileText` |
| `UploadZone.tsx` | `react-dropzone`: PDF only, max 5 files, max 20 MB. Drag-active state (blue border). Spinner during upload. Props: `onUploaded?: (fileCount) => void`. Icons: `Upload` |

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

- **Tailwind v4** — uses `@import "tailwindcss"` and `@tailwindcss/vite` plugin, NOT the v3 PostCSS setup. No `tailwind.config.js` exists.
- **`react-markdown` v10** — does NOT accept `className` prop on `<ReactMarkdown>`. Prose class goes on wrapper div.
- **SSE via `fetch`** — uses `fetch` + `ReadableStream`, not `EventSource`, because backend uses `POST /chat` and `EventSource` only supports GET.
- **Upload success banner** — lives in `ChatPanel` (not `UploadZone`) because `UploadZone` unmounts when a new session is created on first upload.
- **SSE error detail** — `streamChat` reads JSON response body on non-OK to surface backend error messages, not raw status codes.
