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
