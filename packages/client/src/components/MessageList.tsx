import { useMemo, useRef, useEffect } from 'react';
import type { Message, MCPContent, UIResource, ToolCall, ToolResult } from '@chaaskit/shared';
import { Bot } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useConfig } from '../contexts/ConfigContext';
import { useExtensionTools } from '../extensions/useExtensions';
import MessageItem from './MessageItem';
import ToolCallDisplay, { UIResourceWidget } from './ToolCallDisplay';

interface PendingToolCall {
  id: string;
  name: string;
  serverId: string;
  input: Record<string, unknown>;
}

interface CompletedToolCall extends PendingToolCall {
  result: MCPContent[];
  isError?: boolean;
  uiResource?: UIResource;
  structuredContent?: Record<string, unknown>;
}

interface MessageListProps {
  messages: Message[];
  streamingContent?: string;
  pendingToolCalls?: PendingToolCall[];
  completedToolCalls?: CompletedToolCall[];
}

export default function MessageList({
  messages,
  streamingContent,
  pendingToolCalls = [],
  completedToolCalls = [],
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const config = useConfig();
  const extensionTools = useExtensionTools();
  const toolRendererMap = useMemo(() => {
    const map = new Map<string, typeof extensionTools[number]>();
    extensionTools.forEach((tool) => map.set(tool.name, tool));
    return map;
  }, [extensionTools]);
  const showToolCalls = config.mcp?.showToolCalls !== false;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, pendingToolCalls, completedToolCalls]);

  const hasToolActivity = pendingToolCalls.length > 0 || completedToolCalls.length > 0;
  const isStreaming = Boolean(streamingContent) || hasToolActivity;

  // Get UI resources from completed tool calls for separate rendering
  const renderedToolCalls = completedToolCalls
    .filter((call) =>
      call.serverId === 'native' &&
      !!toolRendererMap.get(call.name)?.resultRenderer
    )
    .map((call) => {
      const renderer = toolRendererMap.get(call.name)!.resultRenderer!;
      const toolCall: ToolCall = {
        id: call.id,
        serverId: call.serverId,
        toolName: call.name,
        arguments: call.input,
        status: call.isError ? 'error' : 'completed',
      };
      const toolResult: ToolResult = {
        toolCallId: call.id,
        content: call.result,
        isError: call.isError,
        uiResource: call.uiResource,
        structuredContent: call.structuredContent,
      };
      return { toolCall, toolResult, Renderer: renderer };
    });

  const renderedToolCallIds = new Set(renderedToolCalls.map((entry) => entry.toolCall.id));

  const uiResources = completedToolCalls
    .filter((tc) => tc.uiResource?.text && !renderedToolCallIds.has(tc.id))
    .map((tc) => tc.uiResource!);

  // Debug logging
  console.log('[MessageList] Rendering messages:', messages.length, 'isStreaming:', isStreaming);
  messages.forEach((msg, i) => {
    if (msg.role === 'assistant' && msg.toolCalls?.length) {
      console.log(`[MessageList] Message ${i} has toolCalls:`, msg.toolCalls.length, 'toolResults:', msg.toolResults?.length || 0);
      console.log(`[MessageList] Message ${i} uiResources:`, msg.toolResults?.filter(tr => tr.uiResource?.text).length || 0);
    }
  });
  if (completedToolCalls.length > 0) {
    console.log('[MessageList] Streaming completedToolCalls:', completedToolCalls.length);
    console.log('[MessageList] completedToolCalls uiResources:', completedToolCalls.map(tc => ({ name: tc.name, hasUiResource: !!tc.uiResource, textLen: tc.uiResource?.text?.length })));
    console.log('[MessageList] uiResources to render:', uiResources.length);
  }

  return (
    <div className="mx-auto max-w-3xl px-3 py-3 sm:px-4 sm:py-6">
      <div className="space-y-3 sm:space-y-4">
        {messages.map((message, index) => (
          <MessageItem
            key={message.id}
            message={message}
            messageIndex={index}
            previousMessage={index > 0 ? messages[index - 1] : undefined}
          />
        ))}

        {/* Streaming message: Tool calls → UI widgets → Text response */}
        {isStreaming && (
          <div className="animate-fade-in space-y-3">
            {/* 1. Tool Execution Cards (outside bubble) */}
            {showToolCalls && hasToolActivity && (
              <div className="space-y-2">
                {/* Completed tool calls */}
                {completedToolCalls.map((call) => (
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
                      structuredContent: call.structuredContent,
                    }}
                    hideUiResource
                  />
                ))}

                {/* Pending tool calls */}
                {pendingToolCalls.map((call) => (
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
            )}

            {/* 2. Tool Renderers (native tools) */}
            {renderedToolCalls.length > 0 && (
              <div className="space-y-3">
                {renderedToolCalls.map(({ toolCall, toolResult, Renderer }) => (
                  <div key={toolCall.id} className="rounded-lg border border-border bg-background-secondary/40 p-3">
                    <Renderer toolCall={toolCall} toolResult={toolResult} />
                  </div>
                ))}
              </div>
            )}

            {/* 3. UI Resource Widgets (outside bubble, full width) */}
            {uiResources.length > 0 && (
              <div className="space-y-3">
                {uiResources.map((uiResource, index) => (
                  <UIResourceWidget key={index} uiResource={uiResource} theme={theme} />
                ))}
              </div>
            )}

            {/* 4. Text Response Bubble (with avatar) */}
            {streamingContent && (
              <div className="group flex gap-3">
                {/* Avatar */}
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-secondary">
                  <Bot size={12} className="text-white" />
                </div>

                {/* Content */}
                <div className="flex max-w-[85%] flex-col sm:max-w-[80%] items-start">
                  <div className="rounded-lg px-3 py-2 sm:px-3 sm:py-2 bg-assistant-message-bg text-assistant-message-text">
                    <div className="markdown-content text-sm">
                      <span className="whitespace-pre-wrap">{streamingContent}</span>
                      <span className="typing-indicator ml-1">
                        <span className="inline-block h-2 w-2 rounded-full bg-current" />
                        <span className="ml-1 inline-block h-2 w-2 rounded-full bg-current" />
                        <span className="ml-1 inline-block h-2 w-2 rounded-full bg-current" />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
