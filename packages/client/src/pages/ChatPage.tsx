import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { Send, Paperclip, Loader2, AlertCircle, X, GitBranch, ArrowLeft, Folder } from 'lucide-react';
import { useConfig } from '../contexts/ConfigContext';
import { useProject } from '../contexts/ProjectContext';
import { useChatStore } from '../stores/chatStore';
import { useAppPath } from '../hooks/useAppPath';
import MessageList from '../components/MessageList';
import ToolConfirmationModal from '../components/ToolConfirmationModal';
import AgentSelector from '../components/AgentSelector';
import MentionInput, { type MentionInputHandle } from '../components/MentionInput';

export default function ChatPage() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const appPath = useAppPath();
  const config = useConfig();
  const { projects, currentProjectId, projectsEnabled } = useProject();
  const inputRef = useRef<MentionInputHandle>(null);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const {
    currentThread,
    threads,
    isStreaming,
    streamingContent,
    pendingToolCalls,
    completedToolCalls,
    pendingConfirmation,
    availableAgents,
    loadThread,
    sendMessage,
    clearCurrentThread,
    confirmTool,
    loadAgents,
  } = useChatStore();

  // Find parent thread info if this is a branch
  const parentThread = currentThread?.parentThreadId
    ? threads.find((t) => t.id === currentThread.parentThreadId)
    : null;

  useEffect(() => {
    if (threadId) {
      loadThread(threadId);
    } else {
      clearCurrentThread();
    }
  }, [threadId]);

  // Navigate to thread URL when a new thread is created from the welcome screen
  useEffect(() => {
    // Wait for real thread ID (not 'pending' placeholder)
    if (!threadId && currentThread?.id && currentThread.id !== 'pending') {
      navigate(appPath(`/thread/${currentThread.id}`), { replace: true });
    }
  }, [threadId, currentThread?.id, navigate, appPath]);

  useEffect(() => {
    // Load available agents on mount
    loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    // Focus input on mount
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() && files.length === 0) return;
    if (isStreaming) return;

    const content = input.trim();
    const attachedFiles = [...files];

    setInput('');
    setFiles([]);
    setError(null);

    try {
      await sendMessage(content, attachedFiles);
    } catch (err) {
      // Parse error message
      let errorMessage = 'Failed to send message. Please try again.';
      if (err instanceof Error) {
        if (err.message.includes('429') || err.message.toLowerCase().includes('usage limit')) {
          errorMessage = 'You\'ve reached your monthly message limit. Please upgrade your plan to continue.';
        } else if (err.message.includes('401') || err.message.includes('403')) {
          errorMessage = 'Please sign in to continue.';
        } else {
          errorMessage = err.message;
        }
      }
      setError(errorMessage);
      // Restore input so user doesn't lose their message
      setInput(content);
      setFiles(attachedFiles);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selectedFiles]);
    e.target.value = '';
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSamplePrompt(prompt: string) {
    setInput(prompt);
    inputRef.current?.focus();
  }

  const showWelcome = !currentThread || currentThread.messages.length === 0;
  const showAgentSelector = showWelcome && availableAgents.length > 1;

  // Show project indicator when:
  // 1. Viewing a thread that belongs to a project, OR
  // 2. Creating a new chat with a project selected
  const activeProjectId = currentThread?.projectId || (showWelcome ? currentProjectId : null);
  const activeProject = activeProjectId ? projects.find(p => p.id === activeProjectId) : null;
  const showProjectIndicator = projectsEnabled && activeProject;

  return (
    <div className="flex h-full flex-col">
      {/* Project Context Bar */}
      {showProjectIndicator && activeProject && (
        <div className="flex items-center gap-2 border-b border-border bg-background-secondary px-4 py-2">
          <Folder
            size={14}
            style={{ color: activeProject.color }}
            fill={activeProject.color}
          />
          <span className="text-xs text-text-primary font-medium">{activeProject.name}</span>
          {showWelcome && (
            <span className="text-xs text-text-muted">• New chat will be added to this project</span>
          )}
        </div>
      )}

      {/* Branch Breadcrumb */}
      {currentThread?.parentThreadId && (
        <div className="flex items-center gap-2 border-b border-border bg-background-secondary px-4 py-2">
          <GitBranch size={14} className="text-text-muted" />
          <span className="text-xs text-text-muted">Branched from</span>
          <Link
            to={`/thread/${currentThread.parentThreadId}`}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ArrowLeft size={12} />
            {parentThread?.title || 'Parent conversation'}
          </Link>
        </div>
      )}

      {/* Messages or Welcome */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {showWelcome ? (
          <div className="flex min-h-full flex-col items-center justify-center px-4 py-8 sm:px-6">
            <div className="max-w-2xl text-center">
              <h1 className="mb-2 text-2xl font-bold text-text-primary sm:text-3xl">
                {config.ui.welcomeTitle}
              </h1>
              <p className="mb-6 text-sm text-text-secondary sm:mb-8 sm:text-base">
                {config.ui.welcomeSubtitle}
              </p>

              {/* Agent Selector - only shown when multiple agents available */}
              {showAgentSelector && (
                <div className="mb-6 flex justify-center">
                  <AgentSelector />
                </div>
              )}

              {/* Sample Prompts */}
              {config.ui.samplePrompts.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2">
                  {config.ui.samplePrompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => handleSamplePrompt(prompt.prompt)}
                      className="rounded-lg border border-border bg-background-secondary px-3 py-2 text-sm text-text-secondary hover:border-primary hover:text-primary active:bg-primary/10 sm:px-4"
                    >
                      {prompt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <MessageList
            messages={currentThread.messages}
            streamingContent={isStreaming ? streamingContent : undefined}
            pendingToolCalls={isStreaming ? pendingToolCalls : undefined}
            completedToolCalls={isStreaming ? completedToolCalls : undefined}
          />
        )}
      </div>

      {/* Input Area */}
      <div
        className="flex-shrink-0 border-t border-border bg-background p-3 sm:p-4"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        {/* Error Banner */}
        {error && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">
            <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              onClick={() => setError(null)}
              className="flex-shrink-0 p-0.5 hover:bg-error/20 rounded"
              aria-label="Dismiss error"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Attached Files */}
        {files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 rounded-lg bg-background-secondary px-3 py-1.5 text-sm"
              >
                <span className="max-w-[120px] truncate sm:max-w-[150px]">{file.name}</span>
                <button
                  onClick={() => removeFile(index)}
                  className="p-0.5 text-text-muted hover:text-error"
                  aria-label={`Remove ${file.name}`}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-start gap-2">
          {/* File Upload (uploads as documents with @mentions) */}
          {config.documents?.enabled && (
            <label className="flex-shrink-0 cursor-pointer rounded-lg p-2.5 text-text-secondary hover:bg-background-secondary hover:text-text-primary active:bg-background-secondary">
              <Paperclip size={20} />
              <input
                type="file"
                className="hidden"
                multiple
                accept=".txt,.md,.csv,.json"
                onChange={handleFileSelect}
              />
            </label>
          )}

          {/* Text Input */}
          <div className="flex-1 rounded-lg border border-input-border bg-input-background focus-within:border-primary">
            <MentionInput
              ref={inputRef}
              value={input}
              onChange={setInput}
              onKeyDown={handleKeyDown}
              placeholder={config.ui.inputPlaceholder}
              rows={1}
              maxHeight={200}
              autoGrow
              className="max-h-[200px] min-h-[44px] w-full resize-none bg-transparent px-3 py-3 text-base text-text-primary placeholder-text-muted focus:outline-none sm:px-4 sm:text-sm"
            />
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={isStreaming || (!input.trim() && files.length === 0)}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-white disabled:opacity-50 active:bg-primary-hover"
          >
            {isStreaming ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </form>
      </div>

      {/* Tool Confirmation Modal */}
      {pendingConfirmation && (
        <ToolConfirmationModal
          confirmation={pendingConfirmation}
          onConfirm={(approved, scope) => {
            confirmTool(pendingConfirmation.confirmationId, approved, scope);
          }}
        />
      )}
    </div>
  );
}
