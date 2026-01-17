import { useEffect, useCallback } from 'react';

interface ShortcutHandlers {
  onSearch?: () => void;
  onNewThread?: () => void;
  onEscape?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + K - Open search
      if (isMod && e.key === 'k') {
        e.preventDefault();
        handlers.onSearch?.();
        return;
      }

      // Cmd/Ctrl + N - New thread
      if (isMod && e.key === 'n') {
        e.preventDefault();
        handlers.onNewThread?.();
        return;
      }

      // Escape - Close modal/cancel
      if (e.key === 'Escape') {
        handlers.onEscape?.();
        return;
      }
    },
    [handlers]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Display helpers for keyboard shortcut hints
export function getModifierKey(): string {
  return navigator.platform.includes('Mac') ? '⌘' : 'Ctrl';
}

export function formatShortcut(key: string): string {
  return `${getModifierKey()}+${key.toUpperCase()}`;
}
