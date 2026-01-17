import { useState } from 'react';
import { Copy, Check, RefreshCw, ThumbsUp, ThumbsDown, User, Bot, GitBranch } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { Message } from '@chaaskit/shared';
import { useChatStore } from '../stores/chatStore';
import { useTheme } from '../contexts/ThemeContext';
import { useConfig } from '../contexts/ConfigContext';
import { useAppPath } from '../hooks/useAppPath';
import MarkdownRenderer from './content/MarkdownRenderer';
import ToolCallDisplay, { UIResourceWidget } from './ToolCallDisplay';
import BranchModal from './BranchModal';
import { MessageContentWithMentions } from './MentionChip';

interface MessageItemProps {
  message: Message;
  isStreaming?: boolean;
  messageIndex?: number;
  previousMessage?: Message;
}

export default function MessageItem({ message, isStreaming, messageIndex = 0, previousMessage }: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const { regenerateMessage, branchFromMessage, sendMessage, isStreaming: isGlobalStreaming } = useChatStore();
  const { theme } = useTheme();
  const config = useConfig();
  const navigate = useNavigate();
  const appPath = useAppPath();

  const isUser = message.role === 'user';
  const showToolCalls = config.mcp?.showToolCalls !== false;

  // Branching logic:
  // - Can't branch from first message (nothing to branch from)
  // - For user messages: branch from previous message, pre-fill with current content
  // - For assistant messages: branch from this message
  const canBranch = messageIndex > 0;
  const branchTargetMessage = isUser ? previousMessage : message;
  const branchInitialContent = isUser ? message.content : '';

  async function handleCopy() {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRegenerate() {
    if (isGlobalStreaming) return;
    await regenerateMessage(message.id);
  }

  async function handleBranch(content?: string) {
    if (!branchTargetMessage) return;
    // Create the branch (without the new message)
    const newThread = await branchFromMessage(branchTargetMessage.id);
    navigate(appPath(`/thread/${newThread.id}`));
    // If there's content, send it as a message to trigger AI response
    if (content) {
      await sendMessage(content);
    }
  }

  async function handleFeedback(type: 'up' | 'down') {
    // Toggle off if clicking the same feedback
    const newFeedback = feedback === type ? null : type;
    setFeedback(newFeedback);

    if (newFeedback) {
      try {
        await fetch(`/api/chat/feedback/${message.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: newFeedback }),
          credentials: 'include',
        });
      } catch (error) {
        console.error('Failed to submit feedback:', error);
        // Revert on error
        setFeedback(feedback);
      }
    }
  }

  // For assistant messages, collect tool calls with UI resources
  const toolCallsWithResults = !isUser && message.toolCalls?.map((toolCall) => ({
    toolCall,
    toolResult: message.toolResults?.find((r) => r.toolCallId === toolCall.id),
  })) || [];

  // Check if any tool has a UI resource to render
  const uiResources = toolCallsWithResults
    .filter((tc) => tc.toolResult?.uiResource?.text)
    .map((tc) => tc.toolResult!.uiResource!);

  // Debug logging
  if (!isUser && message.toolCalls?.length) {
    console.log('[MessageItem] Rendering message with toolCalls:', message.toolCalls.length);
    console.log('[MessageItem] toolResults:', message.toolResults?.length || 0, message.toolResults?.map(tr => ({ id: tr.toolCallId, hasUiResource: !!tr.uiResource, textLen: tr.uiResource?.text?.length })));
    console.log('[MessageItem] uiResources to render:', uiResources.length);
  }

  // User messages render normally
  if (isUser) {
    return (
      <>
        <div className="group flex gap-3 flex-row-reverse animate-fade-in">
          {/* Avatar */}
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary">
            <User size={12} className="text-white" />
          </div>

          {/* Message Content */}
          <div className="flex max-w-[85%] flex-col sm:max-w-[80%] items-end">
            <div className="rounded-lg px-3 py-2 sm:px-3 sm:py-2 bg-user-message-bg text-user-message-text">
              <p className="whitespace-pre-wrap text-sm">
                <MessageContentWithMentions content={message.content} />
              </p>
            </div>

            {/* File Attachments */}
            {message.files && message.files.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {message.files.map((file) => (
                  <div
                    key={file.id}
                    className="rounded-lg bg-background-secondary px-3 py-1 text-sm text-text-secondary"
                  >
                    {file.name}
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 touch-device:opacity-100 sm:gap-1">
              <button
                onClick={handleCopy}
                className="rounded p-1.5 text-text-muted hover:bg-background-secondary hover:text-text-primary active:bg-background-secondary sm:p-1"
                title="Copy"
                aria-label="Copy message"
              >
                {copied ? <Check size={16} className="sm:h-[14px] sm:w-[14px]" /> : <Copy size={16} className="sm:h-[14px] sm:w-[14px]" />}
              </button>
              {canBranch && (
                <button
                  onClick={() => setShowBranchModal(true)}
                  disabled={isGlobalStreaming}
                  className="rounded p-1.5 text-text-muted hover:bg-background-secondary hover:text-text-primary active:bg-background-secondary disabled:opacity-50 sm:p-1"
                  title="Edit and resend this message"
                  aria-label="Branch conversation with edited message"
                >
                  <GitBranch size={16} className="sm:h-[14px] sm:w-[14px]" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Branch Modal - for user messages, we branch from previous message */}
        {canBranch && branchTargetMessage && (
          <BranchModal
            isOpen={showBranchModal}
            onClose={() => setShowBranchModal(false)}
            onBranch={handleBranch}
            messagePreview={branchTargetMessage.content.slice(0, 200) + (branchTargetMessage.content.length > 200 ? '...' : '')}
            initialContent={branchInitialContent}
          />
        )}
      </>
    );
  }

  // Assistant messages: Tool calls → UI widgets → Text response
  return (
    <div className="animate-fade-in space-y-3">
      {/* 1. Tool Execution Cards (outside bubble) */}
      {showToolCalls && toolCallsWithResults.length > 0 && (
        <div className="space-y-2">
          {toolCallsWithResults.map(({ toolCall, toolResult }) => (
            <ToolCallDisplay
              key={toolCall.id}
              toolCall={toolCall}
              toolResult={toolResult}
              hideUiResource
            />
          ))}
        </div>
      )}

      {/* 2. UI Resource Widgets (outside bubble, full width) */}
      {uiResources.length > 0 && (
        <div className="space-y-3">
          {uiResources.map((uiResource, index) => (
            <UIResourceWidget key={index} uiResource={uiResource} theme={theme} />
          ))}
        </div>
      )}

      {/* 3. Text Response Bubble (with avatar) */}
      {(message.content || isStreaming) && (
        <div className="group flex gap-3">
          {/* Avatar */}
          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-secondary overflow-hidden">
            {config.ui?.logo ? (
              <img src={typeof config.ui.logo === 'string' ? config.ui.logo : (theme === 'dark' ? config.ui.logo.dark : config.ui.logo.light)} alt="" className="h-full w-full object-cover" />
            ) : (
              <Bot size={12} className="text-white" />
            )}
          </div>

          {/* Message Content */}
          <div className="flex max-w-[85%] flex-col sm:max-w-[80%] items-start">
            <div className="rounded-lg px-3 py-2 sm:px-3 sm:py-2 bg-assistant-message-bg text-assistant-message-text">
              <div className="markdown-content text-sm">
                <MarkdownRenderer content={message.content} />
                {isStreaming && (
                  <span className="typing-indicator ml-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-current" />
                    <span className="ml-1 inline-block h-2 w-2 rounded-full bg-current" />
                    <span className="ml-1 inline-block h-2 w-2 rounded-full bg-current" />
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            {!isStreaming && (
              <div className="mt-2 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 touch-device:opacity-100 sm:gap-1">
                <button
                  onClick={handleCopy}
                  className="rounded p-1.5 text-text-muted hover:bg-background-secondary hover:text-text-primary active:bg-background-secondary sm:p-1"
                  title="Copy"
                  aria-label="Copy message"
                >
                  {copied ? <Check size={16} className="sm:h-[14px] sm:w-[14px]" /> : <Copy size={16} className="sm:h-[14px] sm:w-[14px]" />}
                </button>
                <button
                  onClick={handleRegenerate}
                  disabled={isGlobalStreaming}
                  className="rounded p-1.5 text-text-muted hover:bg-background-secondary hover:text-text-primary active:bg-background-secondary disabled:opacity-50 sm:p-1"
                  title="Regenerate"
                  aria-label="Regenerate response"
                >
                  <RefreshCw size={16} className="sm:h-[14px] sm:w-[14px]" />
                </button>
                {canBranch && (
                  <button
                    onClick={() => setShowBranchModal(true)}
                    disabled={isGlobalStreaming}
                    className="rounded p-1.5 text-text-muted hover:bg-background-secondary hover:text-text-primary active:bg-background-secondary disabled:opacity-50 sm:p-1"
                    title="Branch from here"
                    aria-label="Branch conversation from this message"
                  >
                    <GitBranch size={16} className="sm:h-[14px] sm:w-[14px]" />
                  </button>
                )}
                <button
                  onClick={() => handleFeedback('up')}
                  className={`rounded p-1.5 sm:p-1 ${
                    feedback === 'up'
                      ? 'bg-success/20 text-success'
                      : 'text-text-muted hover:bg-success/10 hover:text-success active:bg-success/10'
                  }`}
                  title="Good response"
                  aria-label="Mark as good response"
                >
                  <ThumbsUp size={16} className="sm:h-[14px] sm:w-[14px]" />
                </button>
                <button
                  onClick={() => handleFeedback('down')}
                  className={`rounded p-1.5 sm:p-1 ${
                    feedback === 'down'
                      ? 'bg-error/20 text-error'
                      : 'text-text-muted hover:bg-error/10 hover:text-error active:bg-error/10'
                  }`}
                  title="Bad response"
                  aria-label="Mark as bad response"
                >
                  <ThumbsDown size={16} className="sm:h-[14px] sm:w-[14px]" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Branch Modal */}
      {canBranch && branchTargetMessage && (
        <BranchModal
          isOpen={showBranchModal}
          onClose={() => setShowBranchModal(false)}
          onBranch={handleBranch}
          messagePreview={branchTargetMessage.content.slice(0, 200) + (branchTargetMessage.content.length > 200 ? '...' : '')}
          initialContent={branchInitialContent}
        />
      )}
    </div>
  );
}
