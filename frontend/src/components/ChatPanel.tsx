import { useRef, useState, useEffect, useCallback } from 'react';
import { Send, Loader2, Paperclip, FileDown } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import { UploadZone } from './UploadZone';
import { useAppStore } from '../store/useAppStore';
import { useToastStore } from '../store/useToastStore';
import { streamChat, getDocuments, getSessions, uploadFiles, exportSession } from '../api/client';

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

  const handleUploadComplete = useCallback(async (_fileCount: number, sessionId: string) => {
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

  const handleExport = useCallback(async () => {
    if (!currentSessionId) return;
    try {
      await exportSession(currentSessionId);
      addToast('Session exported', 'success');
    } catch {
      addToast('Export failed', 'error');
    }
  }, [currentSessionId, addToast]);

  const hasSession = Boolean(currentSessionId);

  return (
    <div className="flex flex-col h-full">
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

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 lg:pl-8 space-y-4">
        {!hasSession && (
          <div className="max-w-md mx-auto mt-16">
            <h2 className="text-center font-hand text-2xl text-pencil dark:text-chalk-text mb-2">Welcome to Study Assistant</h2>
            <p className="text-center text-charcoal-light dark:text-chalk-muted mb-6 text-sm">Upload your notes to get started</p>
            <UploadZone onUploaded={handleUploadComplete} />
          </div>
        )}
        {messages.map((m, i) => (
          <MessageBubble
            key={m.id}
            message={m}
            isLatest={i === messages.length - 1}
            onSuggestionClick={(q) => {
              setInput(q);
              setTimeout(() => {
                const submitBtn = document.querySelector('[aria-label="Send message"]') as HTMLButtonElement;
                submitBtn?.click();
              }, 100);
            }}
          />
        ))}
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
