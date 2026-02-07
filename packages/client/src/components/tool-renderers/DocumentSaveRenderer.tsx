import type { ToolCall, ToolResult } from '@chaaskit/shared';
import { getTextContent } from './utils';

interface SaveSummary {
  success?: boolean;
  path?: string;
  id?: string;
  charCount?: number;
}

export default function DocumentSaveRenderer({ toolCall, toolResult }: { toolCall: ToolCall; toolResult: ToolResult }) {
  const structured = toolResult.structuredContent as SaveSummary | undefined;
  const fallback = getTextContent(toolResult.content);
  const success = structured?.success !== false && !toolResult.isError;

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-text-primary">Save Document</div>
      {structured ? (
        <div className={`rounded-md border px-3 py-2 text-sm ${success ? 'border-success/30 bg-success/10 text-success' : 'border-error/30 bg-error/10 text-error'}`}>
          <div className="font-medium">{success ? 'Saved' : 'Failed'}</div>
          {structured.path && <div className="text-xs">Path: {structured.path}</div>}
          {structured.id && <div className="text-xs">ID: {structured.id}</div>}
          {typeof structured.charCount === 'number' && <div className="text-xs">Size: {structured.charCount} chars</div>}
        </div>
      ) : (
        <div className="text-sm text-text-secondary">{fallback ?? 'No structured save data.'}</div>
      )}
      <div className="text-xs text-text-muted">Tool: {toolCall.toolName}</div>
    </div>
  );
}
