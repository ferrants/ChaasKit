import type { ToolCall, ToolResult } from '@chaaskit/shared';
import { getTextContent } from './utils';

interface ReadSummary {
  path?: string;
  offset?: number;
  linesReturned?: number;
  totalLines?: number;
  truncated?: boolean;
}

export default function DocumentReadRenderer({ toolCall, toolResult }: { toolCall: ToolCall; toolResult: ToolResult }) {
  const structured = toolResult.structuredContent as ReadSummary | undefined;
  const fallback = getTextContent(toolResult.content);
  const rangeText = structured
    ? `Lines ${Number(structured.offset ?? 0) + 1}-${Number(structured.offset ?? 0) + Number(structured.linesReturned ?? 0)} of ${structured.totalLines ?? 'unknown'}`
    : null;

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-text-primary">Document Preview</div>
      {structured ? (
        <div className="rounded-md border border-border bg-background px-3 py-2 text-sm text-text-secondary">
          <div className="font-medium text-text-primary">{structured.path ?? 'Document'}</div>
          {rangeText && <div className="text-xs text-text-muted">{rangeText}{structured.truncated ? ' (truncated)' : ''}</div>}
        </div>
      ) : (
        <div className="text-sm text-text-secondary">{fallback ?? 'No structured document details.'}</div>
      )}
      <div className="text-xs text-text-muted">Tool: {toolCall.toolName}</div>
    </div>
  );
}
