import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { Search, X, Loader2, MessageSquare } from 'lucide-react';
import { formatShortcut } from '../hooks/useKeyboardShortcuts';
import { useAppPath } from '../hooks/useAppPath';

interface SearchResult {
  id: string;
  threadId: string;
  threadTitle: string;
  role: string;
  content: string;
  highlight: string;
  createdAt: string;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const navigate = useNavigate();
  const appPath = useAppPath();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setHasSearched(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setHasSearched(true);
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query.trim())}&limit=20`,
          { credentials: 'include' }
        );
        if (response.ok) {
          const data = await response.json();
          setResults(data.results);
        }
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  function handleResultClick(result: SearchResult) {
    navigate(appPath(`/thread/${result.threadId}`));
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      onClose();
    }
  }

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl rounded-xl bg-background shadow-2xl"
        style={{ maxHeight: '70vh' }}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search size={20} className="flex-shrink-0 text-text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search conversations..."
            className="flex-1 bg-transparent text-base text-text-primary placeholder-text-muted focus:outline-none"
          />
          {isLoading && <Loader2 size={20} className="animate-spin text-text-muted" />}
          <button
            onClick={onClose}
            className="flex-shrink-0 rounded p-1 text-text-muted hover:bg-background-secondary hover:text-text-primary"
          >
            <X size={20} />
          </button>
        </div>

        {/* Results */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 60px)' }}>
          {!hasSearched && !query && (
            <div className="px-4 py-8 text-center text-text-muted">
              <p className="mb-2">Search your conversations</p>
              <p className="text-sm">
                Press <kbd className="rounded bg-background-secondary px-1.5 py-0.5 text-xs">{formatShortcut('K')}</kbd> anytime to open search
              </p>
            </div>
          )}

          {hasSearched && results.length === 0 && !isLoading && (
            <div className="px-4 py-8 text-center text-text-muted">
              No results found for "{query}"
            </div>
          )}

          {results.length > 0 && (
            <div className="py-2">
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleResultClick(result)}
                  className="w-full px-4 py-3 text-left hover:bg-background-secondary"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <MessageSquare size={14} className="text-text-muted" />
                    <span className="text-sm font-medium text-text-primary">
                      {result.threadTitle}
                    </span>
                    <span className="text-xs text-text-muted">
                      {result.role === 'user' ? 'You' : 'Assistant'}
                    </span>
                  </div>
                  <p
                    className="line-clamp-2 text-sm text-text-secondary"
                    dangerouslySetInnerHTML={{ __html: result.highlight }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-border px-4 py-2 text-xs text-text-muted">
          <span className="mr-4">
            <kbd className="rounded bg-background-secondary px-1.5 py-0.5">↵</kbd> to select
          </span>
          <span>
            <kbd className="rounded bg-background-secondary px-1.5 py-0.5">esc</kbd> to close
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
