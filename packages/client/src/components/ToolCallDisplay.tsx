import { Wrench, CheckCircle, XCircle, Loader2, ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import type { ToolCall, ToolResult, MCPContent, UIResource, AutoApproveReason } from '@chaaskit/shared';

interface ToolCallDisplayProps {
  toolCall: ToolCall;
  toolResult?: ToolResult;
  isPending?: boolean;
  uiResource?: UIResource;
  hideUiResource?: boolean;
  autoApproveReason?: AutoApproveReason;
}

// Human-readable descriptions for auto-approve reasons
const AUTO_APPROVE_LABELS: Record<AutoApproveReason, string> = {
  config_none: 'Admin config allows all tools',
  whitelist: 'Tool is in allowed list',
  user_always: 'You always allowed this tool',
  thread_allowed: 'Allowed for this chat',
};

// Generate the window.openai initialization script for OpenAI format resources
function generateOpenAiScript(
  toolInput: Record<string, unknown>,
  toolOutput: MCPContent[] | Record<string, unknown>,
  theme: string
): string {
  // Map app theme to OpenAI theme (light/dark) and colors
  const openAiTheme = theme === 'dark' ? 'dark' : 'light';
  const backgroundColor = theme === 'dark' ? '#111827' : '#ffffff';
  const scrollbarTrack = theme === 'dark' ? '#1f2937' : '#f3f4f6';
  const scrollbarThumb = theme === 'dark' ? '#4b5563' : '#d1d5db';
  const scrollbarThumbHover = theme === 'dark' ? '#6b7280' : '#9ca3af';

  return `
<style>
  body {
    margin: 0;
    padding: 0;
    background-color: ${backgroundColor};
  }

  /* Scrollbar styling for WebKit browsers (Chrome, Safari, Edge) */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: ${scrollbarTrack};
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb {
    background: ${scrollbarThumb};
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: ${scrollbarThumbHover};
  }

  /* Scrollbar styling for Firefox */
  * {
    scrollbar-width: thin;
    scrollbar-color: ${scrollbarThumb} ${scrollbarTrack};
  }
</style>
<script>
(function() {
  // Initialize window.openai with the OpenAI Apps SDK spec
  window.openai = {
    // Core globals
    theme: '${openAiTheme}',
    userAgent: {
      device: { type: 'desktop' },
      capabilities: { hover: true, touch: false }
    },
    locale: navigator.language || 'en-US',
    maxHeight: 800,
    displayMode: 'inline',
    safeArea: {
      insets: { top: 0, bottom: 0, left: 0, right: 0 }
    },

    // Tool data
    toolOutput: ${JSON.stringify(toolOutput)},
    toolInput: ${JSON.stringify(toolInput)},
    toolResponseMetadata: null,
    widgetState: null,

    // API methods
    callTool: async (name, args) => {
      console.log('window.openai.callTool called:', { name, args });
      // TODO: Implement actual tool calling via parent window messaging
      return {
        content: [{ type: 'text', text: 'Tool calling not yet implemented' }],
        isError: false
      };
    },

    sendFollowUpMessage: async (args) => {
      console.log('window.openai.sendFollowUpMessage called:', args);
      // TODO: Implement via parent window messaging
      return {};
    },

    openExternal: (payload) => {
      console.log('window.openai.openExternal called:', payload);
      if (payload && payload.href) {
        window.open(payload.href, '_blank');
      }
    },

    requestDisplayMode: async (args) => {
      console.log('window.openai.requestDisplayMode called:', args);
      return { mode: args.mode };
    },

    setWidgetState: async (state) => {
      console.log('window.openai.setWidgetState called:', state);
      window.openai.widgetState = state;
      return {};
    },

    requestClose: () => {
      console.log('window.openai.requestClose called');
    },

    getFileDownloadUrl: async ({ fileId }) => {
      console.log('window.openai.getFileDownloadUrl called:', fileId);
      return { url: '' };
    },

    uploadFile: async (file) => {
      console.log('window.openai.uploadFile called:', file);
      return { fileId: '' };
    }
  };

  console.log('window.openai initialized', window.openai);
})();
</script>
`;
}

// Separate component for rendering UI resource widgets
export function UIResourceWidget({ uiResource, theme }: { uiResource: UIResource; theme: string }) {
  const [showRawResult, setShowRawResult] = useState(false);

  // Prepare iframe content with window.openai injection for OpenAI format
  const iframeSrcDoc = useMemo(() => {
    if (!uiResource?.text) return '';

    // Only inject window.openai for OpenAI format resources
    if (uiResource.isOpenAiFormat && uiResource.toolInput && uiResource.toolOutput) {
      const openAiScript = generateOpenAiScript(uiResource.toolInput, uiResource.toolOutput, theme);
      const html = uiResource.text;

      // Inject the script at the beginning of <head> or before <body>
      if (html.includes('<head>')) {
        return html.replace('<head>', '<head>' + openAiScript);
      } else if (html.includes('<body>')) {
        return html.replace('<body>', openAiScript + '<body>');
      } else {
        // No head or body tag, prepend the script
        return openAiScript + html;
      }
    }

    return uiResource.text;
  }, [uiResource, theme]);

  const hasHtmlResource = uiResource?.text &&
    (uiResource.mimeType?.includes('html') || uiResource.text.trim().startsWith('<'));

  if (!hasHtmlResource) return null;

  return (
        <iframe
          srcDoc={iframeSrcDoc}
          sandbox="allow-scripts allow-same-origin allow-popups"
          className="w-full bg-background"
          style={{ minHeight: '200px', border: 'none' }}
          onLoad={(e) => {
            // Auto-resize iframe to fit content
            const iframe = e.target as HTMLIFrameElement;
            try {
              const height = iframe.contentDocument?.body?.scrollHeight;
              if (height) {
                iframe.style.height = `${Math.min(height + 20, 600)}px`;
              }
            } catch {
              // Cross-origin restriction, keep default height
            }
          }}
        />
  );
}

export default function ToolCallDisplay({ toolCall, toolResult, isPending, uiResource, hideUiResource, autoApproveReason }: ToolCallDisplayProps) {
  // Check if we have HTML content to render
  const hasHtmlResource = !hideUiResource && uiResource?.text &&
    (uiResource.mimeType?.includes('html') || uiResource.text.trim().startsWith('<'));

  // Auto-expand if we have HTML to render, or start collapsed if hiding UI resource
  const [isExpanded, setIsExpanded] = useState(hasHtmlResource);
  const [showRawResult, setShowRawResult] = useState(false);

  // Update expanded state when uiResource changes (e.g., after streaming completes)
  useEffect(() => {
    if (hasHtmlResource) {
      setIsExpanded(true);
    }
  }, [hasHtmlResource]);

  // Get current theme from document
  const theme = document.documentElement.getAttribute('data-theme') || 'light';

  // Prepare iframe content with window.openai injection for OpenAI format
  const iframeSrcDoc = useMemo(() => {
    if (!uiResource?.text || hideUiResource) return '';

    // Only inject window.openai for OpenAI format resources
    if (uiResource.isOpenAiFormat && uiResource.toolInput && uiResource.toolOutput) {
      const openAiScript = generateOpenAiScript(uiResource.toolInput, uiResource.toolOutput, theme);
      const html = uiResource.text;

      // Inject the script at the beginning of <head> or before <body>
      if (html.includes('<head>')) {
        return html.replace('<head>', '<head>' + openAiScript);
      } else if (html.includes('<body>')) {
        return html.replace('<body>', openAiScript + '<body>');
      } else {
        // No head or body tag, prepend the script
        return openAiScript + html;
      }
    }

    return uiResource.text;
  }, [uiResource, hideUiResource, theme]);

  const isError = toolResult?.isError || toolCall.status === 'error';
  const isCompleted = toolResult || toolCall.status === 'completed';

  return (
    <div className={`my-2 rounded-lg border ${isError ? 'border-error/30 bg-error/5' : 'border-border bg-background-secondary/50'}`}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 p-3 text-left hover:bg-background-secondary/30 transition-colors"
      >
        <div className={`rounded p-1 ${isError ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>
          <Wrench size={14} />
        </div>

        <span className="flex-1 font-medium text-sm text-text-primary">
          {toolCall.toolName}
        </span>

        {/* Auto-approved indicator */}
        {autoApproveReason && (
          <span
            className="inline-flex items-center gap-1 text-xs text-success bg-success/10 px-2 py-0.5 rounded-full"
            title={AUTO_APPROVE_LABELS[autoApproveReason]}
          >
            <ShieldCheck size={12} />
            <span className="hidden sm:inline">Auto-approved</span>
          </span>
        )}

        {isPending ? (
          <Loader2 size={16} className="animate-spin text-primary" />
        ) : isError ? (
          <XCircle size={16} className="text-error" />
        ) : isCompleted ? (
          <CheckCircle size={16} className="text-success" />
        ) : null}

        {isExpanded ? (
          <ChevronDown size={16} className="text-text-muted" />
        ) : (
          <ChevronRight size={16} className="text-text-muted" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border px-3 pb-3">
          {/* Arguments */}
          {toolCall.arguments && Object.keys(toolCall.arguments).length > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-xs font-medium text-text-muted uppercase tracking-wide">
                Arguments
              </div>
              <pre className="rounded bg-background-secondary p-2 text-xs text-text-secondary overflow-x-auto">
                {JSON.stringify(toolCall.arguments, null, 2)}
              </pre>
            </div>
          )}

          {/* UI Resource (HTML rendered in iframe) */}
          {hasHtmlResource && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
                  Output
                </span>
                <button
                  onClick={() => setShowRawResult(!showRawResult)}
                  className="text-xs text-primary hover:underline"
                >
                  {showRawResult ? 'Show rendered' : 'Show raw'}
                </button>
              </div>
              {showRawResult ? (
                <div className="rounded bg-background-secondary p-2 text-sm text-text-secondary">
                  <ToolResultContent content={toolResult?.content || []} />
                </div>
              ) : (
                <div className="rounded border border-border overflow-hidden">
                  <iframe
                    srcDoc={iframeSrcDoc}
                    sandbox="allow-scripts allow-same-origin allow-popups"
                    className="w-full bg-background"
                    style={{ minHeight: '200px', border: 'none' }}
                    onLoad={(e) => {
                      // Auto-resize iframe to fit content
                      const iframe = e.target as HTMLIFrameElement;
                      try {
                        const height = iframe.contentDocument?.body?.scrollHeight;
                        if (height) {
                          iframe.style.height = `${Math.min(height + 20, 600)}px`;
                        }
                      } catch {
                        // Cross-origin restriction, keep default height
                      }
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Regular Result (when no UI resource) */}
          {toolResult && !hasHtmlResource && (
            <div className="mt-3">
              <div className="mb-1 text-xs font-medium text-text-muted uppercase tracking-wide">
                {isError ? 'Error' : 'Result'}
              </div>
              <div className={`rounded p-2 text-sm ${isError ? 'bg-error/10 text-error' : 'bg-background-secondary text-text-secondary'}`}>
                <ToolResultContent content={toolResult.content} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ToolResultContent({ content }: { content: MCPContent[] }) {
  if (!content || content.length === 0) {
    return <span className="text-text-muted italic">No output</span>;
  }

  return (
    <div className="space-y-2">
      {content.map((item, index) => (
        <div key={index}>
          {item.type === 'text' && (
            <pre className="whitespace-pre-wrap font-mono text-xs overflow-x-auto">
              {item.text}
            </pre>
          )}
          {item.type === 'image' && item.data && (
            <img
              src={`data:${item.mimeType || 'image/png'};base64,${item.data}`}
              alt="Tool result"
              className="max-w-full rounded"
            />
          )}
          {item.type === 'resource' && item.resource && (
            <div className="rounded border border-border p-2">
              <div className="text-xs text-text-muted">{item.resource.uri}</div>
              {item.resource.text && (
                <pre className="mt-1 whitespace-pre-wrap font-mono text-xs">
                  {item.resource.text}
                </pre>
              )}
            </div>
          )}
          {item.type === 'resource_link' && item.uri && (
            <a
              href={item.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline text-sm"
            >
              {item.name || item.uri}
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

// Component for displaying pending tool calls during streaming
interface PendingToolCallsProps {
  pendingCalls: Array<{
    id: string;
    name: string;
    serverId: string;
    input: Record<string, unknown>;
  }>;
  completedCalls: Array<{
    id: string;
    name: string;
    serverId: string;
    input: Record<string, unknown>;
    result: MCPContent[];
    isError?: boolean;
    uiResource?: UIResource;
    autoApproveReason?: AutoApproveReason;
  }>;
}

export function PendingToolCalls({ pendingCalls, completedCalls }: PendingToolCallsProps) {
  if (pendingCalls.length === 0 && completedCalls.length === 0) {
    return null;
  }

  return (
    <div className="my-2 space-y-1">
      {/* Show completed calls first */}
      {completedCalls.map((call) => (
        <ToolCallDisplay
          key={call.id}
          toolCall={{
            id: call.id,
            serverId: call.serverId,
            toolName: call.name,
            arguments: call.input,
            status: call.isError ? 'error' : 'completed',
          }}
          toolResult={{
            toolCallId: call.id,
            content: call.result,
            isError: call.isError,
          }}
          uiResource={call.uiResource}
          autoApproveReason={call.autoApproveReason}
        />
      ))}

      {/* Show pending calls */}
      {pendingCalls.map((call) => (
        <ToolCallDisplay
          key={call.id}
          toolCall={{
            id: call.id,
            serverId: call.serverId,
            toolName: call.name,
            arguments: call.input,
            status: 'pending',
          }}
          isPending
        />
      ))}
    </div>
  );
}
