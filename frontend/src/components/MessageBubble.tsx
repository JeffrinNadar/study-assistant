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
      <div className={`max-w-2xl ${isUser ? 'order-last' : ''}`}>
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-blue-600 text-white rounded-br-sm'
              : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
          }`}
        >
          {isUser ? (
            message.content
          ) : (
            <ReactMarkdown>
              {message.content + (message.isStreaming ? '▍' : '')}
            </ReactMarkdown>
          )}
        </div>

        {/* Low confidence warning */}
        {message.lowConfidence && !message.isStreaming && (
          <div className="flex items-center gap-1.5 mt-1.5 text-amber-600 text-xs">
            <AlertTriangle size={12} />
            This answer may not be well-supported by your documents.
          </div>
        )}

        {/* Citation cards */}
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
