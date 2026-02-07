import type { ToolCall, ToolResult } from '@chaaskit/shared';
import { getTextContent } from './utils';

interface DocumentSummary {
  id?: string;
  path?: string;
  name?: string;
  mimeType?: string;
  charCount?: number;
  teamId?: string | null;
  projectId?: string | null;
}

export default function DocumentListRenderer({ toolCall, toolResult }: { toolCall: ToolCall; toolResult: ToolResult }) {
  const structured = toolResult.structuredContent as { documents?: DocumentSummary[] } | undefined;
  const documents = structured?.documents ?? [];
  const fallback = getTextContent(toolResult.content);

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-text-primary">Documents</div>
      {documents.length > 0 ? (
        <ul className="space-y-2">
          {documents.map((doc, index) => (
            <li key={doc.id ?? doc.path ?? index} className="rounded-md border border-border bg-background px-3 py-2">
              <div className="text-sm font-medium text-text-primary">{doc.path ?? doc.name ?? 'Untitled document'}</div>
              <div className="text-xs text-text-muted">
                {doc.mimeType ?? 'text/plain'}
                {typeof doc.charCount === 'number' ? ` • ${doc.charCount} chars` : ''}
                {doc.teamId ? ' • team' : ''}
                {doc.projectId ? ' • project' : ''}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-sm text-text-secondary">
          {fallback ?? 'No documents found.'}
        </div>
      )}
      <div className="text-xs text-text-muted">Tool: {toolCall.toolName}</div>
    </div>
  );
}
