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
    <div className="border border-gray-200 rounded-lg text-sm bg-gray-50 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-100"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="flex items-center gap-2 text-gray-700 font-medium">
          <FileText size={14} />
          [{index + 1}] {citation.file}, p.{citation.page}
        </span>
        <span className="flex items-center gap-2">
          <span className={`text-xs px-1.5 py-0.5 rounded ${confidence >= 70 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {confidence}% match
          </span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 text-gray-600 text-xs leading-relaxed border-t border-gray-200 pt-2">
          {citation.text}
        </div>
      )}
    </div>
  );
}
