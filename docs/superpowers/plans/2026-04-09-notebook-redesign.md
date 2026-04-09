# Notebook Redesign & Feature Additions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Study Assistant into a notebook-themed app with structured conversations, rate limiting, follow-up suggestions, and chat export.

**Architecture:** Three phases executed sequentially. Phase 1 is the full UI redesign (theme, responsiveness, UX fixes). Phase 2 adds backend rate limiting, a regenerate endpoint, and restructures the LLM prompt for study-oriented output. Phase 3 adds clickable follow-up suggestions and markdown chat export.

**Tech Stack:** React 19, Tailwind CSS v4 (CSS-first config), Zustand, FastAPI, SQLModel, Google Fonts (Patrick Hand), lucide-react.

**Spec:** `docs/superpowers/specs/2026-04-09-notebook-redesign-design.md`

---

## Phase 1: Notebook Theme + UI Polish

### Task 1: Theme Foundation — CSS Custom Properties & Fonts

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Add Google Font import to index.html**

In `frontend/index.html`, add the font link in `<head>`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <title>Study Assistant</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Set up Tailwind v4 theme tokens and base styles in index.css**

Replace `frontend/src/index.css` with:

```css
@import "tailwindcss";

@theme {
  /* Notebook palette */
  --color-cream: #FFF8F0;
  --color-kraft: #F5EDE3;
  --color-ruled: #C5D1E0;
  --color-margin: #E8A0BF;
  --color-pencil: #2B4C7E;
  --color-pencil-dark: #1E3A5F;
  --color-eraser: #E8A0BF;
  --color-charcoal: #2D2D2D;
  --color-charcoal-light: #4A4A4A;

  /* Chalkboard (dark mode) */
  --color-chalk-bg: #2C3E2D;
  --color-chalk-bg-light: #3A4F3B;
  --color-chalk-text: #F0EDE6;
  --color-chalk-muted: #B8C4B8;

  /* Font families */
  --font-hand: "Caveat", cursive;
  --font-sans: "Inter", system-ui, sans-serif;
}

/* Ruled-line background pattern */
.bg-ruled {
  background-image: repeating-linear-gradient(
    to bottom,
    transparent,
    transparent 31px,
    var(--color-ruled) 31px,
    var(--color-ruled) 32px
  );
  background-size: 100% 32px;
}

/* Paper texture overlay (very subtle) */
.bg-paper {
  background-color: var(--color-cream);
  background-image: url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
}

/* Pencil writing cursor animation */
@keyframes pencil-write {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
.pencil-cursor::after {
  content: "✏️";
  display: inline;
  animation: pencil-write 1s ease-in-out infinite;
  font-size: 0.875rem;
}

/* Binder rings decoration */
.binder-rings {
  position: relative;
}
.binder-rings::after {
  content: "";
  position: absolute;
  right: -8px;
  top: 80px;
  width: 16px;
  height: calc(100% - 160px);
  background-image: radial-gradient(circle 6px at 8px center, var(--color-charcoal-light) 5px, transparent 6px);
  background-size: 16px 60px;
  background-repeat: repeat-y;
  z-index: 10;
}

/* Focus ring — teacher markup style */
*:focus-visible {
  outline: 2px dashed var(--color-pencil);
  outline-offset: 2px;
}

/* Dark mode base */
.dark {
  color-scheme: dark;
}
.dark .bg-paper {
  background-color: var(--color-chalk-bg);
  background-image: none;
}
.dark .bg-ruled {
  background-image: repeating-linear-gradient(
    to bottom,
    transparent,
    transparent 31px,
    rgba(240, 237, 230, 0.08) 31px,
    rgba(240, 237, 230, 0.08) 32px
  );
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--color-ruled);
  border-radius: 3px;
}

body {
  font-family: var(--font-sans);
  color: var(--color-charcoal);
}
```

- [ ] **Step 3: Verify fonts load correctly**

Run: `cd frontend && npm run dev`
Open browser, inspect computed font on body — should show "Inter". Open DevTools console — no 404s on font requests.

- [ ] **Step 4: Commit**

```bash
git add frontend/index.html frontend/src/index.css
git commit -m "feat: add notebook theme foundation — fonts, colors, CSS utilities"
```

---

### Task 2: Toast Notification System

**Files:**
- Create: `frontend/src/components/Toast.tsx`
- Create: `frontend/src/store/useToastStore.ts`

- [ ] **Step 1: Create the toast store**

Create `frontend/src/store/useToastStore.ts`:

```typescript
import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, type: ToastType) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
```

- [ ] **Step 2: Create the Toast component**

Create `frontend/src/components/Toast.tsx`:

```tsx
import { X, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { useToastStore } from '../store/useToastStore';

const icons = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

const styles = {
  success: 'bg-green-50 border-green-300 text-green-800 dark:bg-green-950 dark:border-green-700 dark:text-green-200',
  warning: 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950 dark:border-amber-700 dark:text-amber-200',
  error: 'bg-red-50 border-red-300 text-red-800 dark:bg-red-950 dark:border-red-700 dark:text-red-200',
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        return (
          <div
            key={toast.id}
            className={`flex items-center gap-2 rounded-lg border px-4 py-3 shadow-md text-sm animate-[slideIn_0.3s_ease-out] ${styles[toast.type]}`}
            role="alert"
          >
            <Icon size={18} className="shrink-0" />
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 opacity-60 hover:opacity-100"
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Add the slide-in animation to index.css**

Append to `frontend/src/index.css`:

```css
@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Toast.tsx frontend/src/store/useToastStore.ts frontend/src/index.css
git commit -m "feat: add toast notification system with auto-dismiss"
```

---

### Task 3: Confirmation Dialog

**Files:**
- Create: `frontend/src/components/ConfirmDialog.tsx`

- [ ] **Step 1: Create the ConfirmDialog component**

Create `frontend/src/components/ConfirmDialog.tsx`:

```tsx
interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="bg-cream border border-ruled rounded-lg shadow-xl max-w-sm w-full mx-4 p-6 rotate-[0.5deg] dark:bg-chalk-bg dark:border-chalk-muted"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-hand text-xl text-charcoal dark:text-chalk-text mb-2">{title}</h3>
        <p className="text-sm text-charcoal-light dark:text-chalk-muted mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-md border border-ruled text-charcoal hover:bg-kraft dark:border-chalk-muted dark:text-chalk-text dark:hover:bg-chalk-bg-light"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ConfirmDialog.tsx
git commit -m "feat: add notebook-styled confirmation dialog"
```

---

### Task 4: Restyle AuthPage — Notebook Login

**Files:**
- Modify: `frontend/src/components/AuthPage.tsx`

- [ ] **Step 1: Rewrite AuthPage with notebook theme**

Replace the entire content of `frontend/src/components/AuthPage.tsx`:

```tsx
import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { login, signup } from '../api/client';
import { useAuthStore } from '../store/useAuthStore';

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = isLogin
        ? await login(email, password)
        : await signup(email, password);
      setAuth(res.access_token, res.email);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(detail ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper bg-ruled">
      <div className="w-full max-w-sm rounded-lg bg-cream border border-ruled p-8 shadow-lg rotate-[-0.5deg] hover:rotate-0 transition-transform duration-300">
        <div className="flex items-center justify-center gap-2 mb-6">
          <BookOpen size={28} className="text-pencil" />
          <h1 className="font-hand text-3xl text-pencil">Study Assistant</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-charcoal-light">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-ruled bg-white px-3 py-2 text-sm text-charcoal focus:border-pencil focus:outline-none focus:ring-1 focus:ring-pencil dark:bg-chalk-bg dark:border-chalk-muted dark:text-chalk-text"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-charcoal-light">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-ruled bg-white px-3 py-2 text-sm text-charcoal focus:border-pencil focus:outline-none focus:ring-1 focus:ring-pencil dark:bg-chalk-bg dark:border-chalk-muted dark:text-chalk-text"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2 border border-red-200">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-pencil px-4 py-2 text-sm font-medium text-white hover:bg-pencil-dark disabled:opacity-50 transition-colors"
          >
            {loading ? '...' : isLogin ? 'Log in' : 'Sign up'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-charcoal-light">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="font-medium text-pencil hover:underline"
          >
            {isLogin ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify auth page renders**

Run: `cd frontend && npm run dev`
Open browser — auth page should show notebook paper background with ruled lines, cream card, Caveat font title.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AuthPage.tsx
git commit -m "feat: restyle auth page with notebook theme"
```

---

### Task 5: App Layout — Dark Mode, Responsive Shell, Margin Line

**Files:**
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/store/useThemeStore.ts`

- [ ] **Step 1: Create the theme store**

Create `frontend/src/store/useThemeStore.ts`:

```typescript
import { create } from 'zustand';

interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  isDark: localStorage.getItem('theme') === 'dark',
  toggleTheme: () =>
    set((s) => {
      const next = !s.isDark;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', next);
      return { isDark: next };
    }),
}));

// Apply on load
if (localStorage.getItem('theme') === 'dark') {
  document.documentElement.classList.add('dark');
}
```

- [ ] **Step 2: Rewrite App.tsx with responsive layout and margin line**

Replace `frontend/src/App.tsx`:

```tsx
import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { ChatPanel } from './components/ChatPanel';
import { AuthPage } from './components/AuthPage';
import { ToastContainer } from './components/Toast';
import { useAuthStore } from './store/useAuthStore';
import './store/useThemeStore'; // side-effect: applies dark class on load

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!isAuthenticated) {
    return (
      <>
        <AuthPage />
        <ToastContainer />
      </>
    );
  }

  return (
    <div className="flex h-screen bg-paper">
      {/* Mobile hamburger */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-40 p-2 rounded-lg bg-kraft border border-ruled shadow-md text-charcoal dark:bg-chalk-bg dark:text-chalk-text dark:border-chalk-muted"
        aria-label="Open sidebar"
      >
        <Menu size={20} />
      </button>

      {/* Sidebar overlay (mobile/tablet) */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed lg:static z-50 h-full transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Margin line */}
      <div className="hidden lg:block w-[3px] bg-margin shrink-0" />

      {/* Main content */}
      <main className="flex-1 overflow-hidden bg-ruled">
        <ChatPanel />
      </main>

      <ToastContainer />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx frontend/src/store/useThemeStore.ts
git commit -m "feat: responsive app shell with dark mode, margin line, mobile sidebar"
```

---

### Task 6: Restyle Sidebar — Notebook Tabs, Binder Rings, Dark Mode Toggle

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`

- [ ] **Step 1: Rewrite Sidebar with notebook theme**

Replace the entire content of `frontend/src/components/Sidebar.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Trash2, BookOpen, LogOut, Plus, Pencil, Check, X as XIcon, Moon, Sun, X } from 'lucide-react';
import { getSessions, getDocuments, getMessages, deleteDocument, deleteSession, renameSession, logout } from '../api/client';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { useToastStore } from '../store/useToastStore';
import { ConfirmDialog } from './ConfirmDialog';

interface Props {
  onClose?: () => void;
}

export function Sidebar({ onClose }: Props) {
  const { sessions, currentSessionId, documents, setSessions, setCurrentSessionId, setDocuments, setMessages, removeDocument, removeSession, updateSessionName, startNewChat } = useAppStore();
  const { email, clearAuth } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();
  const addToast = useToastStore((s) => s.addToast);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'session' | 'document'; id: string; name: string } | null>(null);

  const handleLogout = () => {
    logout();
    clearAuth();
  };

  useEffect(() => {
    getSessions().then(setSessions).catch(() => addToast('Failed to load sessions', 'error'));
  }, [setSessions, addToast]);

  const selectSession = async (id: string) => {
    setCurrentSessionId(id);
    onClose?.();
    try {
      const [docs, apiMessages] = await Promise.all([getDocuments(id), getMessages(id)]);
      setDocuments(docs);
      setMessages(
        apiMessages.map((m) => ({
          id: String(m.id),
          role: m.role,
          content: m.content,
          citations: m.citations ?? undefined,
          lowConfidence: m.low_confidence,
        })),
      );
    } catch {
      addToast('Failed to load session', 'error');
    }
  };

  const handleDeleteDoc = async () => {
    if (!confirmDelete || confirmDelete.type !== 'document') return;
    try {
      await deleteDocument(confirmDelete.id);
      removeDocument(confirmDelete.id);
      addToast('Document deleted', 'success');
    } catch {
      addToast('Failed to delete document', 'error');
    }
    setConfirmDelete(null);
  };

  const handleDeleteSession = async () => {
    if (!confirmDelete || confirmDelete.type !== 'session') return;
    try {
      await deleteSession(confirmDelete.id);
      removeSession(confirmDelete.id);
      addToast('Session deleted', 'success');
    } catch {
      addToast('Failed to delete session', 'error');
    }
    setConfirmDelete(null);
  };

  const startEditing = (e: React.MouseEvent, sessionId: string, currentName: string) => {
    e.stopPropagation();
    setEditingId(sessionId);
    setEditName(currentName);
  };

  const confirmRename = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingId || !editName.trim()) return;
    try {
      await renameSession(editingId, editName.trim());
      updateSessionName(editingId, editName.trim());
    } catch {
      addToast('Failed to rename session', 'error');
    }
    setEditingId(null);
  };

  const cancelEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  return (
    <>
      <div className="w-64 bg-kraft dark:bg-chalk-bg border-r border-ruled dark:border-chalk-muted flex flex-col h-full binder-rings">
        {/* Header */}
        <div className="p-4 border-b border-ruled dark:border-chalk-muted flex items-center justify-between">
          <h1 className="font-hand text-xl text-pencil dark:text-chalk-text flex items-center gap-2">
            <BookOpen size={20} /> Study Assistant
          </h1>
          {/* Close button (mobile) */}
          <button
            onClick={onClose}
            className="lg:hidden text-charcoal-light dark:text-chalk-muted"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        {/* New Chat */}
        <div className="p-3 pb-0">
          <button
            onClick={() => { startNewChat(); onClose?.(); }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-ruled text-sm text-pencil hover:bg-cream dark:border-chalk-muted dark:text-chalk-text dark:hover:bg-chalk-bg-light transition-colors"
          >
            <Plus size={16} /> New Chat
          </button>
        </div>

        {/* Sessions */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-3">
            <p className="text-xs font-medium text-charcoal-light dark:text-chalk-muted uppercase tracking-wider mb-2 font-hand text-sm">Sessions</p>
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => editingId !== s.id && selectSession(s.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 cursor-pointer flex items-center justify-between group transition-colors ${
                  s.id === currentSessionId
                    ? 'bg-pencil/10 text-pencil border-l-2 border-pencil dark:bg-chalk-bg-light dark:text-chalk-text'
                    : 'hover:bg-cream text-charcoal dark:text-chalk-text dark:hover:bg-chalk-bg-light'
                }`}
              >
                <div className="min-w-0 flex-1">
                  {editingId === s.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        className="flex-1 min-w-0 px-1 py-0.5 text-sm border border-pencil rounded bg-white focus:outline-none focus:ring-1 focus:ring-pencil dark:bg-chalk-bg dark:text-chalk-text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') confirmRename(e as unknown as React.MouseEvent);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                      <button onClick={confirmRename} className="text-green-600 shrink-0" aria-label="Confirm rename">
                        <Check size={14} />
                      </button>
                      <button onClick={cancelEditing} className="text-charcoal-light shrink-0" aria-label="Cancel rename">
                        <XIcon size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="truncate">{s.name}</div>
                      <span className="block text-xs text-charcoal-light dark:text-chalk-muted">{s.doc_count} doc(s)</span>
                    </>
                  )}
                </div>
                {editingId !== s.id && (
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <button
                      onClick={(e) => startEditing(e, s.id, s.name)}
                      className="text-charcoal-light opacity-0 group-hover:opacity-100 dark:text-chalk-muted"
                      aria-label={`Rename session ${s.name}`}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: 'session', id: s.id, name: s.name }); }}
                      className="text-red-400 opacity-0 group-hover:opacity-100"
                      aria-label={`Delete session ${s.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Documents */}
          {currentSessionId && documents.length > 0 && (
            <div className="p-3 border-t border-ruled dark:border-chalk-muted">
              <p className="text-xs font-medium text-charcoal-light dark:text-chalk-muted uppercase tracking-wider mb-2 font-hand text-sm">Documents</p>
              {documents.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-cream dark:hover:bg-chalk-bg-light group">
                  <div className="text-xs text-charcoal dark:text-chalk-text truncate flex-1">{d.name}</div>
                  <button
                    onClick={() => setConfirmDelete({ type: 'document', id: d.id, name: d.name })}
                    className="text-red-400 opacity-0 group-hover:opacity-100 ml-2"
                    aria-label={`Delete document ${d.name}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer: theme toggle + user + logout */}
        <div className="border-t border-ruled dark:border-chalk-muted p-3 flex items-center justify-between">
          <button
            onClick={toggleTheme}
            className="text-charcoal-light dark:text-chalk-muted hover:text-pencil dark:hover:text-chalk-text"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <span className="text-xs text-charcoal-light dark:text-chalk-muted truncate mx-2">{email}</span>
          <button onClick={handleLogout} className="text-charcoal-light dark:text-chalk-muted hover:text-red-500" aria-label="Log out">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Confirm dialog */}
      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${confirmDelete.type}?`}
          message={`"${confirmDelete.name}" will be permanently deleted. This can't be undone.`}
          onConfirm={confirmDelete.type === 'session' ? handleDeleteSession : handleDeleteDoc}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Sidebar.tsx
git commit -m "feat: restyle sidebar with notebook tabs, binder rings, dark mode toggle, confirmations"
```

---

### Task 7: Restyle UploadZone — Folder Pocket

**Files:**
- Modify: `frontend/src/components/UploadZone.tsx`

- [ ] **Step 1: Rewrite UploadZone with folder pocket styling**

Replace `frontend/src/components/UploadZone.tsx`:

```tsx
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FolderOpen, Loader2 } from 'lucide-react';
import { uploadFiles } from '../api/client';
import { useAppStore } from '../store/useAppStore';
import { useToastStore } from '../store/useToastStore';

interface Props {
  onUploaded?: (fileCount: number, sessionId: string) => void;
}

export function UploadZone({ onUploaded }: Props) {
  const [loading, setLoading] = useState(false);
  const { currentSessionId, setCurrentSessionId } = useAppStore();
  const addToast = useToastStore((s) => s.addToast);

  const onDrop = useCallback(async (accepted: File[]) => {
    if (!accepted.length) return;
    setLoading(true);
    try {
      const resp = await uploadFiles(accepted, currentSessionId ?? undefined);
      if (!currentSessionId) setCurrentSessionId(resp.session_id);
      onUploaded?.(resp.files.length, resp.session_id);
      addToast(`${resp.files.length} file(s) uploaded successfully`, 'success');
    } catch {
      addToast('Upload failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentSessionId, setCurrentSessionId, onUploaded, addToast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 20 * 1024 * 1024,
    maxFiles: 5,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200
        ${isDragActive
          ? 'border-pencil bg-pencil/5 scale-[1.02] dark:border-chalk-text'
          : 'border-ruled hover:border-pencil bg-cream/50 dark:bg-chalk-bg-light/50 dark:border-chalk-muted dark:hover:border-chalk-text'
        }`}
    >
      <input {...getInputProps()} />
      {loading ? (
        <div className="flex items-center justify-center gap-2 text-pencil dark:text-chalk-text">
          <Loader2 className="animate-spin" size={20} />
          <span className="font-hand text-lg">Processing PDF...</span>
        </div>
      ) : (
        <>
          <FolderOpen className="mx-auto mb-2 text-pencil/40 dark:text-chalk-muted" size={36} />
          <p className="text-charcoal dark:text-chalk-text font-hand text-lg">
            {isDragActive ? 'Drop your notes here!' : 'Drop your notes here, or click to select'}
          </p>
          <p className="text-xs text-charcoal-light dark:text-chalk-muted mt-1">PDF only · Max 20 MB · Up to 5 files</p>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/UploadZone.tsx
git commit -m "feat: restyle upload zone as folder pocket with toast notifications"
```

---

### Task 8: Restyle CitationCard — Notebook Theme

**Files:**
- Modify: `frontend/src/components/CitationCard.tsx`

- [ ] **Step 1: Rewrite CitationCard**

Replace `frontend/src/components/CitationCard.tsx`:

```tsx
import { useState } from 'react';
import { ChevronDown, ChevronUp, FileText } from 'lucide-react';
import type { Citation } from '../types';

interface Props {
  citation: Citation;
  index: number;
}

export function CitationCard({ citation, index }: Props) {
  const [expanded, setExpanded] = useState(false);
  const confidence = Math.round(citation.score * 100);

  return (
    <div className="border border-ruled rounded-lg text-sm bg-cream overflow-hidden dark:bg-chalk-bg-light dark:border-chalk-muted">
      <button
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-kraft dark:hover:bg-chalk-bg transition-colors"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={`Citation ${index + 1}: ${citation.file}, page ${citation.page}, ${confidence}% match`}
      >
        <span className="flex items-center gap-2 text-charcoal font-medium dark:text-chalk-text">
          <FileText size={14} className="text-pencil dark:text-chalk-muted" />
          [{index + 1}] {citation.file}, p.{citation.page}
        </span>
        <span className="flex items-center gap-2">
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
            confidence >= 70
              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
          }`}>
            {confidence}%
          </span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 text-charcoal-light text-xs leading-relaxed border-t border-ruled dark:border-chalk-muted pt-2 dark:text-chalk-muted">
          {citation.text}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/CitationCard.tsx
git commit -m "feat: restyle citation cards with notebook theme and dark mode"
```

---

### Task 9: Restyle MessageBubble — Index Cards + Pencil Cursor

**Files:**
- Modify: `frontend/src/components/MessageBubble.tsx`

- [ ] **Step 1: Rewrite MessageBubble**

Replace `frontend/src/components/MessageBubble.tsx`:

```tsx
import ReactMarkdown from 'react-markdown';
import { AlertTriangle } from 'lucide-react';
import type { Message } from '../types';
import { CitationCard } from './CitationCard';

interface Props {
  message: Message;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-2xl w-full sm:w-auto ${isUser ? 'order-last' : ''}`}>
        <div
          className={`px-4 py-3 rounded-xl text-sm leading-relaxed transition-shadow ${
            isUser
              ? 'bg-pencil text-white rounded-br-sm shadow-sm'
              : 'bg-cream border border-ruled text-charcoal rounded-bl-sm shadow-sm hover:shadow-md dark:bg-chalk-bg-light dark:border-chalk-muted dark:text-chalk-text'
          }`}
        >
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <div className="prose-sm prose-headings:font-hand prose-headings:text-pencil prose-headings:dark:text-chalk-text prose-strong:text-charcoal prose-strong:dark:text-chalk-text max-w-none">
              <ReactMarkdown>
                {message.content + (message.isStreaming ? '' : '')}
              </ReactMarkdown>
              {message.isStreaming && <span className="pencil-cursor" />}
            </div>
          )}
        </div>

        {/* Low confidence warning */}
        {message.lowConfidence && !message.isStreaming && (
          <div className="flex items-center gap-1.5 mt-1.5 text-amber-600 dark:text-amber-400 text-xs">
            <AlertTriangle size={12} />
            This answer may not be well-supported by your documents.
          </div>
        )}

        {/* Citations */}
        {!message.isStreaming && message.citations && message.citations.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {message.citations.map((c, i) => (
              <CitationCard key={i} citation={c} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/MessageBubble.tsx
git commit -m "feat: restyle message bubbles as index cards with pencil cursor"
```

---

### Task 10: Restyle ChatPanel — Ruled Background, Toasts, Upload Banner

**Files:**
- Modify: `frontend/src/components/ChatPanel.tsx`

- [ ] **Step 1: Rewrite ChatPanel**

Replace `frontend/src/components/ChatPanel.tsx`:

```tsx
import { useRef, useState, useEffect, useCallback } from 'react';
import { Send, Loader2, Paperclip } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { UploadZone } from './UploadZone';
import { useAppStore } from '../store/useAppStore';
import { useToastStore } from '../store/useToastStore';
import { streamChat, getDocuments, getSessions, uploadFiles } from '../api/client';

export function ChatPanel() {
  const [input, setInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addToast = useToastStore((s) => s.addToast);
  const {
    messages, currentSessionId, sessions, isStreaming,
    addUserMessage, startAssistantMessage, appendToken, finishMessage, setIsStreaming,
    setDocuments, setSessions, updateSessionName,
  } = useAppStore();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleUploadComplete = useCallback(async (fileCount: number, sessionId: string) => {
    const [docs, updatedSessions] = await Promise.all([
      getDocuments(sessionId),
      getSessions(),
    ]);
    setDocuments(docs);
    setSessions(updatedSessions);
  }, [setDocuments, setSessions]);

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || !currentSessionId || isStreaming) return;
    const question = input.trim();
    setInput('');

    const currentSession = sessions.find((s) => s.id === currentSessionId);
    const isFirstMessage = messages.length === 0 && currentSession?.name === 'New Session';

    addUserMessage(question);
    const assistantId = startAssistantMessage();
    setIsStreaming(true);

    if (isFirstMessage) {
      updateSessionName(currentSessionId, question.slice(0, 100));
    }

    streamChat(currentSessionId, question, {
      onToken: (token) => appendToken(assistantId, token),
      onCitations: (citations, lowConfidence) => finishMessage(assistantId, citations, lowConfidence),
      onDone: () => setIsStreaming(false),
      onError: (err) => {
        appendToken(assistantId, `\n\n*Error: ${err.message}*`);
        finishMessage(assistantId, [], false);
        setIsStreaming(false);
        addToast(err.message, 'error');
      },
    });
  }, [input, currentSessionId, isStreaming, sessions, messages.length, addUserMessage, startAssistantMessage, appendToken, finishMessage, setIsStreaming, updateSessionName, addToast]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !currentSessionId) return;
    setIsUploading(true);
    try {
      const resp = await uploadFiles(files, currentSessionId);
      await handleUploadComplete(resp.files.length, resp.session_id);
      addToast(`${resp.files.length} file(s) uploaded`, 'success');
    } catch {
      addToast('Upload failed', 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [currentSessionId, handleUploadComplete, addToast]);

  const hasSession = Boolean(currentSessionId);

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 lg:pl-8 space-y-4">
        {!hasSession && (
          <div className="max-w-md mx-auto mt-16">
            <h2 className="text-center font-hand text-2xl text-pencil dark:text-chalk-text mb-2">Welcome to Study Assistant</h2>
            <p className="text-center text-charcoal-light dark:text-chalk-muted mb-6 text-sm">Upload your notes to get started</p>
            <UploadZone onUploaded={handleUploadComplete} />
          </div>
        )}
        {messages.map((m) => <MessageBubble key={m.id} message={m} />)}
        <div ref={bottomRef} />
      </div>

      {/* Upload zone when session exists but no messages */}
      {hasSession && messages.length === 0 && (
        <div className="p-4 border-t border-ruled dark:border-chalk-muted">
          <UploadZone onUploaded={handleUploadComplete} />
        </div>
      )}

      {/* Input bar */}
      {hasSession && (
        <div className="p-4 border-t border-ruled bg-cream/80 backdrop-blur-sm dark:bg-chalk-bg/80 dark:border-chalk-muted">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <div className="flex gap-2 max-w-3xl mx-auto">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming || isUploading}
              className="border border-ruled hover:bg-kraft disabled:opacity-40 text-charcoal-light rounded-lg px-3 py-2 dark:border-chalk-muted dark:text-chalk-muted dark:hover:bg-chalk-bg-light transition-colors"
              aria-label="Upload PDF"
            >
              {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
            </button>
            <input
              className="flex-1 border border-ruled rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pencil text-charcoal dark:bg-chalk-bg dark:border-chalk-muted dark:text-chalk-text"
              placeholder="Ask a question about your documents..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
              disabled={isStreaming}
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isStreaming}
              className="bg-pencil hover:bg-pencil-dark disabled:opacity-40 text-white rounded-lg px-3 py-2 transition-colors"
              aria-label="Send message"
            >
              {isStreaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ChatPanel.tsx
git commit -m "feat: restyle chat panel with ruled background, notebook input bar"
```

---

### Task 11: Phase 1 Integration Test

**Files:** None (manual verification)

- [ ] **Step 1: Run the dev server and verify all pages**

Run: `cd frontend && npm run dev`

Verify in browser:
1. Auth page: cream card, ruled background, Caveat font title, slight rotation
2. After login: sidebar with kraft background, binder rings, dark mode toggle
3. Session list with notebook tab styling, active session has left border
4. New Chat button, session rename, delete with confirmation dialog
5. Upload zone: folder pocket styling, "Drop your notes here"
6. Chat: ruled line background, pencil-blue user bubbles, cream assistant cards
7. Citation cards: cream background, green/amber badges
8. Toast notifications: appear top-right on errors, auto-dismiss
9. Dark mode: chalkboard green, chalk text, all components respect dark class
10. Mobile (resize to <768px): hamburger menu, sidebar overlay, full-width messages

- [ ] **Step 2: Run type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Fix the binder-rings CSS**

The binder-rings CSS in `index.css` has a syntax issue. Fix the `background-image` line:

```css
.binder-rings::after {
  content: "";
  position: absolute;
  right: -8px;
  top: 80px;
  width: 16px;
  height: calc(100% - 160px);
  background-image: radial-gradient(circle 6px, var(--color-charcoal-light) 5px, transparent 6px);
  background-size: 16px 60px;
  background-repeat: repeat-y;
  z-index: 10;
}
```

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: phase 1 integration fixes"
```

---

## Phase 2: Rate Limiting + Regenerate + Structured Conversations

### Task 12: Backend Rate Limiter Service

**Files:**
- Create: `backend/app/services/rate_limiter.py`
- Create: `backend/tests/test_rate_limiter.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_rate_limiter.py`:

```python
import time
from app.services.rate_limiter import RateLimiter


def test_allows_requests_under_limit():
    limiter = RateLimiter(max_requests=3, window_seconds=60)
    assert limiter.check("user1") is True
    assert limiter.check("user1") is True
    assert limiter.check("user1") is True


def test_blocks_requests_over_limit():
    limiter = RateLimiter(max_requests=2, window_seconds=60)
    assert limiter.check("user1") is True
    assert limiter.check("user1") is True
    result = limiter.check("user1")
    assert result is False


def test_returns_retry_after():
    limiter = RateLimiter(max_requests=1, window_seconds=60)
    limiter.check("user1")
    limiter.check("user1")  # over limit
    retry_after = limiter.retry_after("user1")
    assert retry_after > 0
    assert retry_after <= 60


def test_separate_users():
    limiter = RateLimiter(max_requests=1, window_seconds=60)
    assert limiter.check("user1") is True
    assert limiter.check("user2") is True


def test_window_expires():
    limiter = RateLimiter(max_requests=1, window_seconds=0.1)
    assert limiter.check("user1") is True
    assert limiter.check("user1") is False
    time.sleep(0.15)
    assert limiter.check("user1") is True
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && python -m pytest tests/test_rate_limiter.py -v`
Expected: FAIL (module not found)

- [ ] **Step 3: Write the rate limiter implementation**

Create `backend/app/services/rate_limiter.py`:

```python
import time
from collections import defaultdict
from threading import Lock


class RateLimiter:
    """In-memory sliding-window rate limiter. No external dependencies."""

    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def _cleanup(self, key: str, now: float) -> None:
        cutoff = now - self.window_seconds
        self._requests[key] = [t for t in self._requests[key] if t > cutoff]

    def check(self, key: str) -> bool:
        now = time.time()
        with self._lock:
            self._cleanup(key, now)
            if len(self._requests[key]) >= self.max_requests:
                return False
            self._requests[key].append(now)
            return True

    def retry_after(self, key: str) -> int:
        now = time.time()
        with self._lock:
            self._cleanup(key, now)
            if not self._requests[key]:
                return 0
            oldest = self._requests[key][0]
            return max(1, int(self.window_seconds - (now - oldest)) + 1)


# Shared instances
chat_limiter = RateLimiter(max_requests=20, window_seconds=60)
upload_limiter = RateLimiter(max_requests=10, window_seconds=3600)
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && python -m pytest tests/test_rate_limiter.py -v`
Expected: all 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/rate_limiter.py backend/tests/test_rate_limiter.py
git commit -m "feat: add in-memory per-user rate limiter service"
```

---

### Task 13: Apply Rate Limiting to Chat and Upload Endpoints

**Files:**
- Modify: `backend/app/routers/chat.py`
- Modify: `backend/app/routers/upload.py`

- [ ] **Step 1: Add rate limiting to chat.py**

In `backend/app/routers/chat.py`, add the import at the top (after existing imports):

```python
from app.services.rate_limiter import chat_limiter
```

Then add the rate limit check at the start of the `chat` function, right after the session ownership check (after line 34):

```python
    # Rate limit
    if not chat_limiter.check(current_user.id):
        raise HTTPException(
            status_code=429,
            detail=f"Too many requests. Try again in {chat_limiter.retry_after(current_user.id)} seconds.",
            headers={"Retry-After": str(chat_limiter.retry_after(current_user.id))},
        )
```

- [ ] **Step 2: Add rate limiting to upload.py**

In `backend/app/routers/upload.py`, add the import at the top:

```python
from app.services.rate_limiter import upload_limiter
```

Then add the rate limit check at the start of the `upload` function, right after the file count check (after line 30):

```python
    # Rate limit
    if not upload_limiter.check(current_user.id):
        raise HTTPException(
            status_code=429,
            detail=f"Upload limit reached. Try again in {upload_limiter.retry_after(current_user.id)} seconds.",
            headers={"Retry-After": str(upload_limiter.retry_after(current_user.id))},
        )
```

- [ ] **Step 3: Run existing tests to verify nothing broke**

Run: `cd backend && python -m pytest -v`
Expected: all existing tests pass

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/chat.py backend/app/routers/upload.py
git commit -m "feat: apply rate limiting to chat and upload endpoints"
```

---

### Task 14: Update LLM System Prompt for Structured Responses

**Files:**
- Modify: `backend/app/services/llm.py`

- [ ] **Step 1: Update the system prompt and context builder**

In `backend/app/services/llm.py`, replace the `SYSTEM_PROMPT` constant (lines 11-13) and `build_context` function (lines 15-27):

```python
SYSTEM_PROMPT = """You are a study assistant. Answer the student's question using primarily the context provided below. You may briefly explain foundational concepts if needed to clarify the material.

Use a clear, encouraging tone suitable for student learning. Break complex topics into understandable steps.

Structure your response as follows:

## Answer
[Direct, clear answer to the question in 2-3 paragraphs unless a detailed explanation is requested]

## Key Concepts
- **[Term]**: [Brief definition/explanation from context]
(List 2-5 key terms mentioned in your answer)

## Dig Deeper
- [Follow-up question 1]
- [Follow-up question 2]
- [Follow-up question 3]

If the answer is not in the context, respond: "I couldn't find this in your uploaded documents."
If the context has conflicting information, note the discrepancy and cite both sources.
Always cite sources inline: [Source: {filename}, p.{page}]"""


def build_context(chunks: list[dict | object]) -> str:
    parts = []
    for chunk in chunks:
        if isinstance(chunk, dict):
            text, file_name, page_num = chunk["text"], chunk["file"], chunk["page"]
        else:
            text, file_name, page_num = chunk.text, chunk.file_name, chunk.page_num
        parts.append(f"=== Source: {file_name}, p.{page_num} ===\n{text}")
    return "\n\n".join(parts)
```

- [ ] **Step 2: Run tests to verify nothing broke**

Run: `cd backend && python -m pytest tests/test_chat.py -v`
Expected: all chat tests pass (they mock `stream_answer`, so prompt changes don't affect them)

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/llm.py
git commit -m "feat: update LLM prompt for structured responses with Key Concepts and Dig Deeper"
```

---

### Task 15: Regenerate Endpoint

**Files:**
- Modify: `backend/app/routers/chat.py`
- Modify: `backend/app/routers/sessions.py` (register the new route — actually it's in chat router)

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/test_chat.py`:

```python
def test_regenerate_replaces_assistant_message(client, auth_headers):
    """POST /messages/{id}/regenerate replaces the assistant message."""
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

    # Send initial chat
    mock_stream = MagicMock(return_value=iter(["Original", " answer."]))
    with patch("app.routers.chat.embed_texts", side_effect=mock_embed), \
        patch("app.routers.chat.stream_answer", mock_stream):
        client.post(
            "/chat",
            json={"session_id": session_id, "question": "What is gradient descent?"},
            headers={**auth_headers, "Accept": "text/event-stream"},
        )

    # Get the assistant message ID
    messages_resp = client.get(f"/messages?session_id={session_id}", headers=auth_headers)
    messages = messages_resp.json()
    assistant_msg = [m for m in messages if m["role"] == "assistant"][0]

    # Regenerate
    mock_regen = MagicMock(return_value=iter(["New", " answer."]))
    with patch("app.routers.chat.embed_texts", side_effect=mock_embed), \
        patch("app.routers.chat.stream_answer", mock_regen):
        resp = client.post(
            f"/messages/{assistant_msg['id']}/regenerate",
            headers={**auth_headers, "Accept": "text/event-stream"},
        )
    assert resp.status_code == 200
    assert "event: token" in resp.text

    # Verify message was replaced
    messages_resp = client.get(f"/messages?session_id={session_id}", headers=auth_headers)
    messages = messages_resp.json()
    assistant_msgs = [m for m in messages if m["role"] == "assistant"]
    assert len(assistant_msgs) == 1
    assert assistant_msgs[0]["content"] == "New answer."
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && python -m pytest tests/test_chat.py::test_regenerate_replaces_assistant_message -v`
Expected: FAIL (404, endpoint doesn't exist)

- [ ] **Step 3: Add the regenerate endpoint to chat.py**

Add to the bottom of `backend/app/routers/chat.py` (before the last line if any, or at the end):

```python
@router.post("/messages/{message_id}/regenerate")
async def regenerate(message_id: int, db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Find the assistant message
    msg = db.get(ChatMessage, message_id)
    if not msg or msg.role != "assistant":
        raise HTTPException(status_code=404, detail="Assistant message not found")

    # Verify ownership via session
    session = db.get(Session, msg.session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Message not found")

    # Rate limit
    if not chat_limiter.check(current_user.id):
        raise HTTPException(
            status_code=429,
            detail=f"Too many requests. Try again in {chat_limiter.retry_after(current_user.id)} seconds.",
            headers={"Retry-After": str(chat_limiter.retry_after(current_user.id))},
        )

    # Find the user message just before this assistant message
    all_messages = db.exec(
        select(ChatMessage)
        .where(ChatMessage.session_id == msg.session_id)
        .order_by(ChatMessage.created_at)
    ).all()
    user_msg = None
    for i, m in enumerate(all_messages):
        if m.id == message_id and i > 0 and all_messages[i - 1].role == "user":
            user_msg = all_messages[i - 1]
            break
    if not user_msg:
        raise HTTPException(status_code=400, detail="Cannot find original question")

    question = user_msg.content

    # Run RAG pipeline
    index_path = (pathlib.Path(settings.faiss_index_dir) / f"{msg.session_id}.index").resolve()
    allowed = pathlib.Path(settings.faiss_index_dir).resolve()
    if not str(index_path).startswith(str(allowed)):
        raise HTTPException(status_code=400, detail="Invalid session")
    if not os.path.exists(str(index_path)):
        raise HTTPException(status_code=404, detail="No documents in this session")

    store = VectorStore(index_path=str(index_path))
    store.load()
    query_vector = embed_texts([question])
    chunk_ids, scores = store.search(query_vector, k=5)
    if not chunk_ids:
        raise HTTPException(status_code=422, detail="No indexed content")

    chunks = db.exec(select(Chunk).where(Chunk.id.in_(chunk_ids))).all()
    id_to_score = dict(zip(chunk_ids, scores))
    chunks.sort(key=lambda c: id_to_score.get(c.id, 0), reverse=True)

    top_score = scores[0] if scores else 0.0
    low_confidence = top_score < LOW_CONFIDENCE_THRESHOLD

    chunk_dicts = [
        {"file": c.file_name, "page": c.page_num, "text": c.text, "score": id_to_score.get(c.id, 0)}
        for c in chunks
    ]

    # Build history (last 10 messages before the user message)
    history = [{"role": m.role, "content": m.content} for m in all_messages]
    user_idx = next(i for i, m in enumerate(all_messages) if m.id == user_msg.id)
    history = history[max(0, user_idx - 10):user_idx]

    session_id = msg.session_id
    original_msg_id = message_id

    def event_stream():
        try:
            full_response = []
            for token in stream_answer(question, chunk_dicts, history):
                full_response.append(token)
                yield f"event: token\ndata: {json.dumps({'content': token})}\n\n"

            yield f"event: citations\ndata: {json.dumps({'citations': chunk_dicts, 'low_confidence': low_confidence})}\n\n"

            # Update the existing assistant message
            with DBSession(engine) as save_db:
                existing = save_db.get(ChatMessage, original_msg_id)
                if existing:
                    existing.content = "".join(full_response)
                    existing.citations = json.dumps(chunk_dicts)
                    existing.low_confidence = low_confidence
                    save_db.commit()

            yield f"event: done\ndata: {json.dumps({})}\n\n"
        except Exception as exc:
            yield f"event: error\ndata: {json.dumps({'detail': str(exc)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && python -m pytest tests/test_chat.py::test_regenerate_replaces_assistant_message -v`
Expected: PASS

- [ ] **Step 5: Run all tests**

Run: `cd backend && python -m pytest -v`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/chat.py backend/tests/test_chat.py
git commit -m "feat: add POST /messages/{id}/regenerate endpoint"
```

---

### Task 16: Frontend — Regenerate Button + Rate Limit Toast

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/store/useAppStore.ts`
- Modify: `frontend/src/components/MessageBubble.tsx`

- [ ] **Step 1: Add regenerate API call to client.ts**

Add to `frontend/src/api/client.ts` after the `renameSession` function:

```typescript
export function regenerateMessage(
  messageId: string,
  handlers: {
    onToken: (token: string) => void;
    onCitations: (citations: Citation[], lowConfidence: boolean) => void;
    onDone: () => void;
    onError: (err: Error) => void;
  },
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const token = localStorage.getItem('access_token');
      const resp = await fetch(`${BASE}/messages/${messageId}/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: controller.signal,
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => null);
        throw new Error(body?.detail ?? `Regenerate failed: ${resp.status}`);
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const eventLine = part.match(/^event: (\w+)/m)?.[1];
          const dataLine = part.match(/^data: (.+)/m)?.[1];
          if (!eventLine || !dataLine) continue;
          const payload = JSON.parse(dataLine);
          if (eventLine === 'token') handlers.onToken(payload.content);
          else if (eventLine === 'citations') handlers.onCitations(payload.citations, payload.low_confidence);
          else if (eventLine === 'done') handlers.onDone();
          else if (eventLine === 'error') handlers.onError(new Error(payload.detail ?? 'Stream error'));
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') handlers.onError(err as Error);
    }
  })();

  return () => controller.abort();
}
```

- [ ] **Step 2: Add regenerate action to useAppStore.ts**

Add to the `AppState` interface in `frontend/src/store/useAppStore.ts`:

```typescript
  regenerateMessage: (id: string) => void;
```

Add to the store implementation (inside the `create` call):

```typescript
  regenerateMessage: (id) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, content: '', isStreaming: true, citations: undefined, lowConfidence: undefined } : m,
      ),
    })),
```

- [ ] **Step 3: Add regenerate button to MessageBubble.tsx**

Update `frontend/src/components/MessageBubble.tsx`. Add imports:

```typescript
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useToastStore } from '../store/useToastStore';
import { regenerateMessage } from '../api/client';
```

Add the regenerate handler inside the component (before the return):

```typescript
  const { regenerateMessage: resetMessage, appendToken, finishMessage, setIsStreaming, isStreaming } = useAppStore();
  const addToast = useToastStore((s) => s.addToast);

  const handleRegenerate = () => {
    if (isStreaming) return;
    resetMessage(message.id);
    setIsStreaming(true);
    regenerateMessage(message.id, {
      onToken: (token) => appendToken(message.id, token),
      onCitations: (citations, lowConfidence) => finishMessage(message.id, citations, lowConfidence),
      onDone: () => setIsStreaming(false),
      onError: (err) => {
        finishMessage(message.id, [], false);
        setIsStreaming(false);
        addToast(err.message, 'error');
      },
    });
  };
```

Add the regenerate button after the citations section (inside the `!isUser` branch, after citations):

```tsx
        {/* Regenerate button */}
        {!isUser && !message.isStreaming && message.content && (
          <button
            onClick={handleRegenerate}
            disabled={isStreaming}
            className="mt-2 flex items-center gap-1.5 text-xs text-charcoal-light hover:text-pencil disabled:opacity-40 dark:text-chalk-muted dark:hover:text-chalk-text transition-colors"
            aria-label="Regenerate response"
          >
            <RefreshCw size={12} />
            Regenerate
          </button>
        )}
```

- [ ] **Step 4: Verify type check passes**

Run: `cd frontend && npx tsc --noEmit`
Expected: no type errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/store/useAppStore.ts frontend/src/components/MessageBubble.tsx
git commit -m "feat: add regenerate response button with streaming support"
```

---

### Task 17: Frontend — Key Concepts Styling

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Add prose styling for Key Concepts boxes**

Append to `frontend/src/index.css`:

```css
/* Key Concepts study card styling */
.prose-sm h2 + ul {
  background-color: var(--color-cream);
  border: 1px solid var(--color-ruled);
  border-left: 3px solid var(--color-pencil);
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  margin-top: 0.5rem;
}
.dark .prose-sm h2 + ul {
  background-color: var(--color-chalk-bg);
  border-color: var(--color-chalk-muted);
  border-left-color: var(--color-chalk-text);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat: add study card styling for Key Concepts sections"
```

---

## Phase 3: Follow-up Suggestions + Chat Export

### Task 18: Follow-up Suggestion Pills

**Files:**
- Modify: `frontend/src/components/MessageBubble.tsx`

- [ ] **Step 1: Add Dig Deeper parsing and pill buttons**

In `frontend/src/components/MessageBubble.tsx`, add a helper function before the component:

```typescript
function extractDigDeeper(content: string): { cleanContent: string; suggestions: string[] } {
  const digDeeperMatch = content.match(/## Dig Deeper\n([\s\S]*?)$/);
  if (!digDeeperMatch) return { cleanContent: content, suggestions: [] };

  const cleanContent = content.replace(/## Dig Deeper\n[\s\S]*?$/, '').trim();
  const suggestions = digDeeperMatch[1]
    .split('\n')
    .map((line) => line.replace(/^-\s*/, '').trim())
    .filter(Boolean);
  return { cleanContent, suggestions };
}
```

Update the component to parse suggestions. In the assistant message rendering section, replace the markdown block with:

```tsx
            <div className="prose-sm prose-headings:font-hand prose-headings:text-pencil prose-headings:dark:text-chalk-text prose-strong:text-charcoal prose-strong:dark:text-chalk-text max-w-none">
              <ReactMarkdown>
                {(message.isStreaming ? message.content : extracted.cleanContent) + (message.isStreaming ? '' : '')}
              </ReactMarkdown>
              {message.isStreaming && <span className="pencil-cursor" />}
            </div>
```

Where `extracted` is computed at the top of the component:

```typescript
  const extracted = !isUser && !message.isStreaming
    ? extractDigDeeper(message.content)
    : { cleanContent: message.content, suggestions: [] };
```

Add the suggestion pills after the regenerate button, at the end of the assistant message section. This needs an `onSuggestionClick` prop:

Add to the Props interface:

```typescript
interface Props {
  message: Message;
  isLatest?: boolean;
  onSuggestionClick?: (question: string) => void;
}
```

Add the pills JSX:

```tsx
        {/* Follow-up suggestions */}
        {!isUser && !message.isStreaming && isLatest && extracted.suggestions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {extracted.suggestions.map((q, i) => (
              <button
                key={i}
                onClick={() => onSuggestionClick?.(q)}
                disabled={isStreaming}
                className="text-xs px-3 py-1.5 rounded-full bg-kraft border border-ruled text-pencil font-hand text-sm hover:bg-cream hover:shadow-sm disabled:opacity-40 transition-all dark:bg-chalk-bg-light dark:border-chalk-muted dark:text-chalk-text dark:hover:bg-chalk-bg"
              >
                {q}
              </button>
            ))}
          </div>
        )}
```

- [ ] **Step 2: Update ChatPanel to pass isLatest and onSuggestionClick**

In `frontend/src/components/ChatPanel.tsx`, update the message rendering:

```tsx
        {messages.map((m, i) => (
          <MessageBubble
            key={m.id}
            message={m}
            isLatest={i === messages.length - 1}
            onSuggestionClick={(q) => {
              setInput(q);
              // Auto-submit after a tick so the input is visible
              setTimeout(() => {
                const submitBtn = document.querySelector('[aria-label="Send message"]') as HTMLButtonElement;
                submitBtn?.click();
              }, 100);
            }}
          />
        ))}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no type errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/MessageBubble.tsx frontend/src/components/ChatPanel.tsx
git commit -m "feat: add clickable Dig Deeper follow-up suggestion pills"
```

---

### Task 19: Chat Export — Backend Endpoint

**Files:**
- Modify: `backend/app/routers/sessions.py`
- Create: `backend/tests/test_export.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_export.py`:

```python
import json
from unittest.mock import patch, MagicMock
import numpy as np
import fitz
import io


def mock_embed(texts):
    vecs = np.random.randn(len(texts), 3072).astype(np.float32)
    norms = np.linalg.norm(vecs, axis=1, keepdims=True)
    return vecs / norms


def test_export_returns_markdown(client, auth_headers):
    """GET /sessions/{id}/export returns a markdown file."""
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Test content for export. " * 50)
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

    # Send a chat message
    mock_stream = MagicMock(return_value=iter(["Test", " answer."]))
    with patch("app.routers.chat.embed_texts", side_effect=mock_embed), \
        patch("app.routers.chat.stream_answer", mock_stream):
        client.post(
            "/chat",
            json={"session_id": session_id, "question": "What is this about?"},
            headers={**auth_headers, "Accept": "text/event-stream"},
        )

    # Export
    resp = client.get(f"/sessions/{session_id}/export", headers=auth_headers)
    assert resp.status_code == 200
    assert "text/markdown" in resp.headers["content-type"]
    body = resp.text
    assert "# Study Session:" in body
    assert "What is this about?" in body
    assert "Test answer." in body
    assert "notes.pdf" in body


def test_export_requires_auth(client):
    resp = client.get("/sessions/fake-id/export")
    assert resp.status_code == 401
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && python -m pytest tests/test_export.py -v`
Expected: FAIL (404, endpoint doesn't exist)

- [ ] **Step 3: Add the export endpoint to sessions.py**

Add these imports at the top of `backend/app/routers/sessions.py`:

```python
from fastapi.responses import PlainTextResponse
```

Add this endpoint at the bottom of the file:

```python
@router.get("/sessions/{session_id}/export")
def export_session(session_id: str, db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = db.get(Session, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    docs = db.exec(select(Document).where(Document.session_id == session_id)).all()
    messages = db.exec(
        select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at)
    ).all()

    doc_names = ", ".join(d.file_name for d in docs) or "None"
    date_str = session.created_at.strftime("%B %d, %Y")

    lines = [
        f"# Study Session: {session.name}",
        f"**Date:** {date_str}",
        f"**Documents:** {doc_names}",
        "",
        "---",
        "",
    ]

    for msg in messages:
        if msg.role == "user":
            lines.append(f"## Q: {msg.content}")
            lines.append("")
        elif msg.role == "assistant":
            lines.append(msg.content)
            lines.append("")
            if msg.citations:
                citations = json.loads(msg.citations)
                lines.append("### Sources")
                for c in citations:
                    score = round(c.get("score", 0) * 100)
                    lines.append(f"- {c['file']}, page {c['page']} ({score}% match)")
                lines.append("")
            lines.append("---")
            lines.append("")

    content = "\n".join(lines)
    safe_name = session.name.replace(" ", "-")[:50]
    return PlainTextResponse(
        content=content,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.md"'},
    )
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && python -m pytest tests/test_export.py -v`
Expected: both tests PASS

- [ ] **Step 5: Run all tests**

Run: `cd backend && python -m pytest -v`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/sessions.py backend/tests/test_export.py
git commit -m "feat: add GET /sessions/{id}/export markdown download endpoint"
```

---

### Task 20: Chat Export — Frontend Button

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/components/ChatPanel.tsx`

- [ ] **Step 1: Add export API call to client.ts**

Add to `frontend/src/api/client.ts`:

```typescript
export async function exportSession(sessionId: string): Promise<void> {
  const token = localStorage.getItem('access_token');
  const resp = await fetch(`${BASE}/sessions/${sessionId}/export`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!resp.ok) throw new Error('Export failed');

  const disposition = resp.headers.get('Content-Disposition') ?? '';
  const filenameMatch = disposition.match(/filename="(.+)"/);
  const filename = filenameMatch?.[1] ?? 'study-session.md';

  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Add export button to ChatPanel header**

In `frontend/src/components/ChatPanel.tsx`, add the import:

```typescript
import { Send, Loader2, Paperclip, FileDown } from 'lucide-react';
import { streamChat, getDocuments, getSessions, uploadFiles, exportSession } from '../api/client';
```

Add the export handler in the component:

```typescript
  const handleExport = useCallback(async () => {
    if (!currentSessionId) return;
    try {
      await exportSession(currentSessionId);
      addToast('Session exported', 'success');
    } catch {
      addToast('Export failed', 'error');
    }
  }, [currentSessionId, addToast]);
```

Add the export button at the top of the chat panel, inside the `flex flex-col h-full` div, before the message list:

```tsx
      {/* Header with export */}
      {hasSession && messages.length > 0 && (
        <div className="flex items-center justify-end px-4 pt-3 lg:pl-8">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-xs text-charcoal-light hover:text-pencil dark:text-chalk-muted dark:hover:text-chalk-text transition-colors"
            aria-label="Export session as markdown"
          >
            <FileDown size={14} />
            <span className="font-hand text-sm">Export Notes</span>
          </button>
        </div>
      )}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: no type errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/components/ChatPanel.tsx
git commit -m "feat: add export session button with markdown download"
```

---

### Task 21: Final Integration Test

**Files:** None (manual verification + automated tests)

- [ ] **Step 1: Run all backend tests**

Run: `cd backend && python -m pytest -v`
Expected: all tests pass

- [ ] **Step 2: Run frontend type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no type errors

- [ ] **Step 3: Run frontend build**

Run: `cd frontend && npm run build`
Expected: build succeeds with no errors

- [ ] **Step 4: Manual end-to-end verification**

Run: `cd frontend && npm run dev` (and backend with `cd backend && uvicorn app.main:app --reload`)

Verify:
1. Notebook theme renders correctly (cream background, ruled lines, margin line)
2. Dark mode toggle works (chalkboard theme)
3. Mobile responsive (hamburger menu, sidebar overlay)
4. Toast notifications appear on errors and successes
5. Delete confirmation dialogs work
6. Upload a PDF and chat — response has ## Answer, ## Key Concepts, ## Dig Deeper sections
7. Dig Deeper pills are clickable and auto-submit
8. Regenerate button replaces the response
9. Export button downloads a .md file with structured content
10. Rate limit toast appears if you spam messages (optional — may need to lower limit temporarily to test)

- [ ] **Step 5: Commit any final fixes**

```bash
git add -A
git commit -m "fix: final integration polish and fixes"
```
