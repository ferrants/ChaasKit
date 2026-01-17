import { useState, useCallback, useRef, useEffect } from 'react';
import type { MentionableDocument, DocumentScope } from '@chaaskit/shared';
import { api } from '../utils/api';

interface MentionSearchResult {
  documents: MentionableDocument[];
  grouped: {
    my: MentionableDocument[];
    team: MentionableDocument[];
    project: MentionableDocument[];
  };
  hasMore: boolean;
}

interface UseMentionSearchOptions {
  debounceMs?: number;
  limit?: number;
}

export function useMentionSearch(options: UseMentionSearchOptions = {}) {
  const { debounceMs = 200, limit = 20 } = options;

  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<MentionSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const search = useCallback(
    async (query: string, scope?: DocumentScope, teamId?: string, projectId?: string) => {
      // Clear any pending debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Debounce the search (allow empty query to show all documents)
      return new Promise<void>((resolve) => {
        debounceRef.current = setTimeout(async () => {
          setIsSearching(true);
          setError(null);

          abortControllerRef.current = new AbortController();

          try {
            const params = new URLSearchParams();
            if (query) params.set('q', query);
            if (scope) params.set('scope', scope);
            if (teamId) params.set('teamId', teamId);
            if (projectId) params.set('projectId', projectId);
            params.set('limit', limit.toString());

            const result = await api.get<MentionSearchResult>(
              `/api/mentions/search?${params.toString()}`
            );

            setResults(result);
          } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
              // Ignore aborted requests
              return;
            }
            console.error('Mention search error:', err);
            setError(err instanceof Error ? err.message : 'Search failed');
            setResults(null);
          } finally {
            setIsSearching(false);
            resolve();
          }
        }, debounceMs);
      });
    },
    [debounceMs, limit]
  );

  const clearResults = useCallback(() => {
    setResults(null);
    setError(null);
    setIsSearching(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    search,
    clearResults,
    results,
    isSearching,
    error,
  };
}
