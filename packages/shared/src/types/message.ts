export type MessageRole = 'user' | 'assistant' | 'system';

export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url?: string;
  content?: string;
}

export interface Message {
  id: string;
  threadId: string;
  role: MessageRole;
  content: string;
  files?: FileAttachment[];
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  usage?: MessageUsage;
  createdAt: Date;
}

export interface MessageUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ToolCall {
  id: string;
  serverId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'error';
}

export interface UIResource {
  uri: string;
  text?: string;
  blob?: string;
  mimeType?: string;
  isOpenAiFormat?: boolean;
  toolInput?: Record<string, unknown>;
  toolOutput?: MCPContent[] | Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  content: MCPContent[];
  isError?: boolean;
  uiResource?: UIResource;
  structuredContent?: Record<string, unknown>;
}

export interface MCPContent {
  type: 'text' | 'image' | 'audio' | 'resource_link' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
  uri?: string;
  name?: string;
  description?: string;
  resource?: {
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  };
}

export interface StreamingMessage {
  type: 'start' | 'delta' | 'tool_call' | 'tool_result' | 'done' | 'error' | 'tool_pending_confirmation' | 'tool_confirmed' | 'tool_auto_approved';
  messageId?: string;
  content?: string;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  usage?: MessageUsage;
  error?: string;
  structuredContent?: Record<string, unknown>;
  // Tool confirmation fields
  confirmationId?: string;
  serverId?: string;
  toolName?: string;
  toolArgs?: unknown;
  approved?: boolean;
  autoApproveReason?: 'config_none' | 'whitelist' | 'user_always' | 'thread_allowed';
}

// Tool confirmation SSE events
export interface ToolPendingConfirmationEvent {
  type: 'tool_pending_confirmation';
  confirmationId: string;
  serverId: string;
  toolName: string;
  toolArgs: unknown;
}

export interface ToolConfirmedEvent {
  type: 'tool_confirmed';
  confirmationId: string;
  approved: boolean;
}

export interface ToolAutoApprovedEvent {
  type: 'tool_auto_approved';
  toolCallId: string;
  serverId: string;
  toolName: string;
  reason: 'config_none' | 'whitelist' | 'user_always' | 'thread_allowed';
}

export interface MessageFeedback {
  id: string;
  messageId: string;
  userId: string;
  type: 'up' | 'down';
  comment?: string;
  createdAt: Date;
}
