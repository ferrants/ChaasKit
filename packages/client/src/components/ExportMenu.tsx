import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileText, FileJson, FileType, X } from 'lucide-react';

interface ExportMenuProps {
  threadId: string;
  threadTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ExportMenu({ threadId, threadTitle, isOpen, onClose }: ExportMenuProps) {
  const [isExporting, setIsExporting] = useState<string | null>(null);

  async function handleExport(format: 'markdown' | 'json' | 'pdf') {
    setIsExporting(format);
    try {
      const response = await fetch(`/api/export/${threadId}?format=${format}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get the blob and create download
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Set filename based on format
      const ext = format === 'pdf' ? 'html' : format === 'markdown' ? 'md' : 'json';
      a.download = `${threadTitle}.${ext}`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onClose();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(null);
    }
  }

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-sm rounded-xl bg-background p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">Export Conversation</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:bg-background-secondary hover:text-text-primary"
          >
            <X size={20} />
          </button>
        </div>

        <p className="mb-4 text-sm text-text-secondary">
          Choose a format to export "{threadTitle}"
        </p>

        <div className="space-y-2">
          <button
            onClick={() => handleExport('markdown')}
            disabled={isExporting !== null}
            className="flex w-full items-center gap-3 rounded-lg border border-border px-4 py-3 text-left hover:bg-background-secondary disabled:opacity-50"
          >
            <FileText size={20} className="text-text-muted" />
            <div className="flex-1">
              <p className="font-medium text-text-primary">Markdown</p>
              <p className="text-xs text-text-muted">Best for documentation and notes</p>
            </div>
            {isExporting === 'markdown' && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            )}
          </button>

          <button
            onClick={() => handleExport('json')}
            disabled={isExporting !== null}
            className="flex w-full items-center gap-3 rounded-lg border border-border px-4 py-3 text-left hover:bg-background-secondary disabled:opacity-50"
          >
            <FileJson size={20} className="text-text-muted" />
            <div className="flex-1">
              <p className="font-medium text-text-primary">JSON</p>
              <p className="text-xs text-text-muted">Machine-readable, includes metadata</p>
            </div>
            {isExporting === 'json' && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            )}
          </button>

          <button
            onClick={() => handleExport('pdf')}
            disabled={isExporting !== null}
            className="flex w-full items-center gap-3 rounded-lg border border-border px-4 py-3 text-left hover:bg-background-secondary disabled:opacity-50"
          >
            <FileType size={20} className="text-text-muted" />
            <div className="flex-1">
              <p className="font-medium text-text-primary">HTML (Print to PDF)</p>
              <p className="text-xs text-text-muted">Formatted for printing</p>
            </div>
            {isExporting === 'pdf' && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
