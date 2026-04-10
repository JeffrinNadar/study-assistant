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
