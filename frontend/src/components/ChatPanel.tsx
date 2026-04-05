import { useRef, useState, useEffect, useCallback } from 'react';
import { Send, Loader2, CheckCircle2 } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { UploadZone } from './UploadZone';
import { useAppStore } from '../store/useAppStore';
import { streamChat, getDocuments, getSessions } from '../api/client';

export function ChatPanel() {
  const [input, setInput] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const {
    messages, currentSessionId, isStreaming,
    addUserMessage, startAssistantMessage, appendToken, finishMessage, setIsStreaming,
    setDocuments, setSessions,
  } = useAppStore();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleUploadComplete = useCallback(async (fileCount: number) => {
    setUploadSuccess(`${fileCount} file${fileCount !== 1 ? 's' : ''} uploaded successfully`);
    setTimeout(() => setUploadSuccess(null), 4000);

    if (!currentSessionId) return;
    const [docs, sessions] = await Promise.all([
      getDocuments(currentSessionId),
      getSessions(),
    ]);
    setDocuments(docs);
    setSessions(sessions);
  }, [currentSessionId, setDocuments, setSessions]);

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || !currentSessionId || isStreaming) return;
    const question = input.trim();
    setInput('');

    addUserMessage(question);
    const assistantId = startAssistantMessage();
    setIsStreaming(true);

    const history = messages
      .filter((m) => !m.isStreaming)
      .map((m) => ({ role: m.role, content: m.content }));

    streamChat(currentSessionId, question, history, {
      onToken: (token) => appendToken(assistantId, token),
      onCitations: (citations, lowConfidence) => finishMessage(assistantId, citations, lowConfidence),
      onDone: () => setIsStreaming(false),
      onError: (err) => {
        appendToken(assistantId, `\n\n*Error: ${err.message}*`);
        finishMessage(assistantId, [], false);
        setIsStreaming(false);
      },
    });
  }, [input, currentSessionId, isStreaming, messages, addUserMessage, startAssistantMessage, appendToken, finishMessage, setIsStreaming]);

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
          <div className="flex gap-2">
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
