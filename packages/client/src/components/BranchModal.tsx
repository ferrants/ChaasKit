import { useState, useEffect } from 'react';
import { X, GitBranch, Loader2 } from 'lucide-react';

interface BranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBranch: (content?: string) => Promise<void>;
  messagePreview: string;
  initialContent?: string;
}

export default function BranchModal({ isOpen, onClose, onBranch, messagePreview, initialContent = '' }: BranchModalProps) {
  const [content, setContent] = useState(initialContent);
  const [isLoading, setIsLoading] = useState(false);

  // Update content when modal opens with new initialContent
  useEffect(() => {
    if (isOpen) {
      setContent(initialContent);
    }
  }, [isOpen, initialContent]);

  if (!isOpen) return null;

  async function handleBranch() {
    setIsLoading(true);
    try {
      await onBranch(content || undefined);
      setContent('');
      onClose();
    } catch (error) {
      console.error('Failed to create branch:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && e.metaKey) {
      handleBranch();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-background border border-border shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <GitBranch size={20} className="text-primary" />
            <h2 className="text-lg font-semibold text-text-primary">Branch Conversation</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:bg-background-secondary hover:text-text-primary"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Message preview */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Branch from this response:
            </label>
            <div className="rounded-lg bg-background-secondary p-3 text-sm text-text-secondary max-h-24 overflow-y-auto">
              {messagePreview}
            </div>
          </div>

          {/* Explanation */}
          <p className="text-sm text-text-muted">
            {initialContent
              ? 'Edit your message below and send it to create a new branch exploring a different direction.'
              : 'This will create a new conversation branch from this point. Optionally add a new message to continue in a different direction.'}
          </p>

          {/* New message input */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              {initialContent ? 'Your message:' : 'Add a new message (optional):'}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={initialContent ? 'Edit your message...' : 'Ask a different question or take the conversation in a new direction...'}
              className="w-full rounded-lg border border-border bg-background p-3 text-sm text-text-primary placeholder-text-muted focus:border-primary focus:outline-none resize-none"
              rows={3}
              autoFocus={Boolean(initialContent)}
            />
            <p className="mt-1 text-xs text-text-muted">
              Press <kbd className="px-1 py-0.5 bg-background-secondary rounded text-text-secondary">⌘</kbd> + <kbd className="px-1 py-0.5 bg-background-secondary rounded text-text-secondary">Enter</kbd> to branch
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border p-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:bg-background-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleBranch}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <GitBranch size={16} />
                Create Branch
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
