import { create } from 'zustand';
import type { Session, Document, Message, Citation } from '../types';

function randomId() {
  return crypto.randomUUID();
}

interface AppState {
  sessions: Session[];
  currentSessionId: string | null;
  documents: Document[];
  messages: Message[];
  isStreaming: boolean;

  setSessions: (sessions: Session[]) => void;
  setCurrentSessionId: (id: string | null) => void;
  setDocuments: (docs: Document[]) => void;
  addUserMessage: (content: string) => string; // returns message id
  startAssistantMessage: () => string;          // returns message id
  appendToken: (id: string, token: string) => void;
  finishMessage: (id: string, citations: Citation[], lowConfidence: boolean) => void;
  setMessages: (messages: Message[]) => void;
  setIsStreaming: (v: boolean) => void;
  removeDocument: (docId: string) => void;
  removeSession: (sessionId: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sessions: [],
  currentSessionId: null,
  documents: [],
  messages: [],
  isStreaming: false,

  setSessions: (sessions) => set({ sessions }),
  setCurrentSessionId: (id) => set({ currentSessionId: id, documents: [] }),
  setMessages: (messages) => set({ messages }),
  setDocuments: (docs) => set({ documents: docs }),

  addUserMessage: (content) => {
    const id = randomId();
    set((s) => ({ messages: [...s.messages, { id, role: 'user', content }] }));
    return id;
  },

  startAssistantMessage: () => {
    const id = randomId();
    set((s) => ({
      messages: [...s.messages, { id, role: 'assistant', content: '', isStreaming: true }],
    }));
    return id;
  },

  appendToken: (id, token) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + token } : m,
      ),
    })),

  finishMessage: (id, citations, lowConfidence) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, isStreaming: false, citations, lowConfidence } : m,
      ),
    })),

  setIsStreaming: (v) => set({ isStreaming: v }),

  removeDocument: (docId) =>
    set((s) => ({ documents: s.documents.filter((d) => d.id !== docId) })),

  removeSession: (sessionId) =>
    set((s) => ({
      sessions: s.sessions.filter((sess) => sess.id !== sessionId),
      ...(s.currentSessionId === sessionId
        ? { currentSessionId: null, documents: [], messages: [] }
        : {}),
    })),
}));
