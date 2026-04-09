import axios from 'axios';
import type { Session, Document, UploadResponse, Citation, AuthResponse } from '../types';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export const api = axios.create({ baseURL: BASE });

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function signup(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/signup', { email, password });
  localStorage.setItem('access_token', data.access_token);
  return data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
  localStorage.setItem('access_token', data.access_token);
  return data;
}

export function logout(): void {
  localStorage.removeItem('access_token');
  localStorage.removeItem('user_email');
}

export async function uploadFiles(
  files: File[],
  sessionId?: string,
): Promise<UploadResponse> {
  const form = new FormData();
  files.forEach((f) => form.append('files', f));
  if (sessionId) form.append('session_id', sessionId);
  const { data } = await api.post<UploadResponse>('/upload', form);
  return data;
}

export async function getSessions(): Promise<Session[]> {
  const { data } = await api.get<Session[]>('/sessions');
  return data;
}

export async function getDocuments(sessionId: string): Promise<Document[]> {
  const { data } = await api.get<Document[]>('/documents', { params: { session_id: sessionId } });
  return data;
}

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

export async function deleteDocument(docId: string): Promise<void> {
  await api.delete(`/documents/${docId}`);
}

export async function deleteSession(sessionId: string): Promise<void> {
  await api.delete(`/sessions/${sessionId}`);
}

export async function renameSession(sessionId: string, name: string): Promise<{ id: string; name: string }> {
  const { data } = await api.patch(`/sessions/${sessionId}`, { name });
  return data;
}

/**
 * Open an SSE connection to POST /chat and call handlers for each event type.
 * Returns a cleanup function that aborts the fetch.
 */
export function streamChat(
  sessionId: string,
  question: string,
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
      const resp = await fetch(`${BASE}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ session_id: sessionId, question }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => null);
        throw new Error(body?.detail ?? `Chat failed: ${resp.status}`);
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
