export interface Session {
  id: string;
  name: string;
  created_at: string;
  doc_count: number;
}

export interface Document {
  id: string;
  name: string;
  pages: number;
  chunks: number;
}

export interface Citation {
  file: string;
  page: number;
  text: string;
  score: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  isStreaming?: boolean;
  lowConfidence?: boolean;
}

export interface UploadResponse {
  session_id: string;
  files: Array<{ name: string; pages: number; chunks: number; status: string }>;
  total_chunks: number;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
}

export type SSEEvent =
  | { event: 'token'; data: { content: string } }
  | { event: 'citations'; data: { citations: Citation[]; low_confidence: boolean } }
  | { event: 'done'; data: Record<string, never> };
