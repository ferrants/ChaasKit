import type { ToolCall, ToolResult } from '@chaaskit/shared';
import { getTextContent } from './utils';

interface SearchSummary {
  path?: string;
  query?: string;
  matchCount?: number;
  matchLines?: number[];
}

export default function DocumentSearchRenderer({ toolCall, toolResult }: { toolCall: ToolCall; toolResult: ToolResult }) {
  const structured = toolResult.structuredContent as SearchSummary | undefined;
  const fallback = getTextContent(toolResult.content);

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-text-primary">Document Search</div>
      {structured ? (
        <div className="rounded-md border border-border bg-background px-3 py-2 text-sm text-text-secondary">
          <div className="font-medium text-text-primary">{structured.path ?? 'Document'}</div>
          <div className="text-xs text-text-muted">Query: {structured.query ?? 'unknown'}</div>
          <div className="text-xs text-text-muted">Matches: {structured.matchCount ?? 0}</div>
          {structured.matchLines && structured.matchLines.length > 0 && (
            <div className="text-xs text-text-muted">Lines: {structured.matchLines.join(', ')}</div>
          )}
        </div>
      ) : (
        <div className="text-sm text-text-secondary">{fallback ?? 'No structured search data.'}</div>
      )}
      <div className="text-xs text-text-muted">Tool: {toolCall.toolName}</div>
    </div>
  );
}
