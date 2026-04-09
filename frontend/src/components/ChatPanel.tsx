import { useRef, useState, useEffect, useCallback } from 'react';
import { Send, Loader2, CheckCircle2, Paperclip } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { UploadZone } from './UploadZone';
import { useAppStore } from '../store/useAppStore';
import { streamChat, getDocuments, getSessions, uploadFiles } from '../api/client';

export function ChatPanel() {
  const [input, setInput] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    messages, currentSessionId, sessions, isStreaming,
    addUserMessage, startAssistantMessage, appendToken, finishMessage, setIsStreaming,
    setDocuments, setSessions, updateSessionName,
  } = useAppStore();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleUploadComplete = useCallback(async (fileCount: number, sessionId: string) => {
    setUploadSuccess(`${fileCount} file${fileCount !== 1 ? 's' : ''} uploaded successfully`);
    setTimeout(() => setUploadSuccess(null), 4000);

    const [docs, sessions] = await Promise.all([
      getDocuments(sessionId),
      getSessions(),
    ]);
    setDocuments(docs);
    setSessions(sessions);
  }, [setDocuments, setSessions]);

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || !currentSessionId || isStreaming) return;
    const question = input.trim();
    setInput('');

    // Auto-rename session if it's the first user message (still "New Session")
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
      },
    });
  }, [input, currentSessionId, isStreaming, sessions, messages.length, addUserMessage, startAssistantMessage, appendToken, finishMessage, setIsStreaming, updateSessionName]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !currentSessionId) return;
    setIsUploading(true);
    try {
      const resp = await uploadFiles(files, currentSessionId);
      await handleUploadComplete(resp.files.length, resp.session_id);
    } catch {
      setUploadSuccess(null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [currentSessionId, handleUploadComplete]);

  const hasSession = Boolean(currentSessionId);

  return (
    <div className="flex flex-col h-full">
      {/* Upload success banner */}
      {uploadSuccess && (
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg bg-green-50 border border-green-300 px-4 py-3 text-green-700">
          <CheckCircle2 size={20} />
          <span className="text-sm font-medium">{uploadSuccess}</span>
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!hasSession && (
          <div className="max-w-md mx-auto mt-8">
            <p className="text-center text-gray-500 mb-4 text-sm">Upload a PDF to get started</p>
            <UploadZone onUploaded={handleUploadComplete} />
          </div>
        )}
        {messages.map((m) => <MessageBubble key={m.id} message={m} />)}
        <div ref={bottomRef} />
      </div>

      {/* Upload zone (when session exists but no messages) */}
      {hasSession && messages.length === 0 && (
        <div className="p-4 border-t border-gray-100">
          <UploadZone onUploaded={handleUploadComplete} />
        </div>
      )}

      {/* Input bar */}
      {hasSession && (
        <div className="p-4 border-t border-gray-200 bg-white">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming || isUploading}
              className="border border-gray-300 hover:bg-gray-100 disabled:opacity-40 text-gray-500 rounded-lg px-3 py-2"
              title="Upload PDF"
            >
              {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
            </button>
            <input
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ask a question about your documents…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
              disabled={isStreaming}
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isStreaming}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg px-3 py-2"
            >
              {isStreaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
