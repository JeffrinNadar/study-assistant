import ReactMarkdown from 'react-markdown';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { Message } from '../types';
import { CitationCard } from './CitationCard';
import { useAppStore } from '../store/useAppStore';
import { useToastStore } from '../store/useToastStore';
import { regenerateMessage } from '../api/client';

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

interface Props {
  message: Message;
  isLatest?: boolean;
  onSuggestionClick?: (question: string) => void;
}

export function MessageBubble({ message, isLatest, onSuggestionClick }: Props) {
  const isUser = message.role === 'user';
  const extracted = !isUser && !message.isStreaming
    ? extractDigDeeper(message.content)
    : { cleanContent: message.content, suggestions: [] };
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
                {message.isStreaming ? message.content : extracted.cleanContent}
              </ReactMarkdown>
              {message.isStreaming && <span className="pencil-cursor" />}
            </div>
          )}
        </div>

        {/* Low confidence warning */}
        {message.lowConfidence && !message.isStreaming && (
          <div className="flex items-center gap-1.5 mt-1.5 text-amber-700 dark:text-amber-300 text-xs" role="alert">
            <AlertTriangle size={12} aria-hidden="true" />
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

        {/* Follow-up suggestions */}
        {!isUser && !message.isStreaming && isLatest && extracted.suggestions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {extracted.suggestions.map((q, i) => (
              <button
                key={i}
                onClick={() => onSuggestionClick?.(q)}
                disabled={isStreaming}
                className="px-3 py-1.5 rounded-full bg-kraft border border-ruled text-pencil font-hand text-sm hover:bg-cream hover:shadow-sm disabled:opacity-40 transition-all dark:bg-chalk-bg-light dark:border-chalk-muted dark:text-chalk-text dark:hover:bg-chalk-bg"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
