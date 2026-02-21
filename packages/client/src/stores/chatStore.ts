import { create } from 'zustand';
import type { Thread, ThreadSummary, Message, StreamingMessage, ToolCall, ToolResult, MCPContent, UIResource, AutoApproveReason } from '@chaaskit/shared';
import { api } from '../utils/api';

export interface AgentInfo {
  id: string;
  name: string;
  isDefault?: boolean;
}

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
  autoApproveReason?: AutoApproveReason;
}

export interface PendingToolConfirmation {
  confirmationId: string;
  serverId: string;
  toolName: string;
  toolArgs: unknown;
}

export type ConfirmationScope = 'once' | 'thread' | 'always';

export interface SubThreadState {
  id: string;
  parentThreadId: string;
  agentId: string;
  agentName: string;
  title: string;
  isStreaming: boolean;
  streamingContent: string;
  pendingToolCalls: PendingToolCall[];
  completedToolCalls: CompletedToolCall[];
  status: 'running' | 'done' | 'error';
  pendingConfirmation: PendingToolConfirmation | null;
  error?: string;
}

interface ChatState {
  threads: ThreadSummary[];
  currentThread: Thread | null;
  isLoadingThreads: boolean;
  isStreaming: boolean;
  streamingContent: string;
  pendingToolCalls: PendingToolCall[];
  completedToolCalls: CompletedToolCall[];
  pendingConfirmation: PendingToolConfirmation | null;

  // Sub-agent threads
  activeSubThreads: Record<string, SubThreadState>;

  // Team context
  currentTeamId: string | null;

  // Project context
  currentProjectId: string | null;

  // Thread visibility for new team threads
  newThreadVisibility: 'shared' | 'private';

  // Agent selection
  availableAgents: AgentInfo[];
  selectedAgentId: string | null;
  isLoadingAgents: boolean;

  // Actions
  setCurrentTeamId: (teamId: string | null) => void;
  setCurrentProjectId: (projectId: string | null) => void;
  loadThreads: (teamId?: string | null) => Promise<void>;
  loadThread: (threadId: string) => Promise<void>;
  createThread: (agentId?: string, teamId?: string | null, projectId?: string | null) => Promise<Thread>;
  deleteThread: (threadId: string) => Promise<void>;
  renameThread: (threadId: string, title: string) => Promise<void>;
  sendMessage: (content: string, files?: File[], agentId?: string, teamId?: string | null, projectId?: string | null) => Promise<void>;
  regenerateMessage: (messageId: string) => Promise<void>;
  branchFromMessage: (messageId: string) => Promise<Thread>;
  clearCurrentThread: () => void;
  confirmTool: (confirmationId: string, approved: boolean, scope?: ConfirmationScope) => Promise<void>;
  confirmSubThreadTool: (subThreadId: string, confirmationId: string, approved: boolean, scope?: ConfirmationScope) => Promise<void>;
  loadAgents: () => Promise<void>;
  setSelectedAgentId: (agentId: string | null) => void;
  setNewThreadVisibility: (visibility: 'shared' | 'private') => void;
  updateThreadVisibility: (threadId: string, visibility: 'shared' | 'private') => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  threads: [],
  currentThread: null,
  isLoadingThreads: false,
  isStreaming: false,
  streamingContent: '',
  pendingToolCalls: [],
  completedToolCalls: [],
  pendingConfirmation: null,

  // Sub-agent threads
  activeSubThreads: {},

  // Team context
  currentTeamId: null,

  // Project context
  currentProjectId: null,

  // Thread visibility for new team threads
  newThreadVisibility: 'private',

  // Agent selection state
  availableAgents: [],
  selectedAgentId: null,
  isLoadingAgents: false,

  setCurrentTeamId: (teamId: string | null) => {
    set({ currentTeamId: teamId, currentProjectId: null, threads: [], currentThread: null });
  },

  setCurrentProjectId: (projectId: string | null) => {
    set({ currentProjectId: projectId });
  },

  loadThreads: async (teamId?: string | null) => {
    set({ isLoadingThreads: true });
    try {
      // Use provided teamId, or fall back to current teamId in store
      const effectiveTeamId = teamId !== undefined ? teamId : get().currentTeamId;
      const url = effectiveTeamId
        ? `/api/threads?teamId=${effectiveTeamId}`
        : '/api/threads';
      const response = await api.get<{ threads: ThreadSummary[] }>(url);
      set({ threads: response.threads });
    } finally {
      set({ isLoadingThreads: false });
    }
  },

  loadThread: async (threadId: string) => {
    const response = await api.get<{ thread: Thread }>(`/api/threads/${threadId}`);
    set({ currentThread: response.thread });
  },

  createThread: async (agentId?: string, teamId?: string | null, projectId?: string | null) => {
    // Use provided teamId or fall back to current teamId in store
    const effectiveTeamId = teamId !== undefined ? teamId : get().currentTeamId;
    // Use provided projectId or fall back to current projectId in store
    const effectiveProjectId = projectId !== undefined ? projectId : get().currentProjectId;
    const { newThreadVisibility } = get();
    const response = await api.post<{ thread: Thread }>('/api/threads', {
      agentId,
      teamId: effectiveTeamId || undefined,
      projectId: effectiveProjectId || undefined,
      visibility: effectiveTeamId ? newThreadVisibility : undefined,
    });
    set((state) => ({
      threads: [
        {
          id: response.thread.id,
          title: response.thread.title,
          createdAt: response.thread.createdAt,
          updatedAt: response.thread.updatedAt,
          messageCount: 0,
          agentId: response.thread.agentId,
          agentName: response.thread.agentName,
          visibility: response.thread.visibility,
          projectId: response.thread.projectId,
        },
        ...state.threads,
      ],
      currentThread: { ...response.thread, messages: [] },
      selectedAgentId: null, // Reset selection after creating thread
    }));
    return response.thread;
  },

  deleteThread: async (threadId: string) => {
    await api.delete(`/api/threads/${threadId}`);
    set((state) => ({
      threads: state.threads.filter((t) => t.id !== threadId),
      currentThread: state.currentThread?.id === threadId ? null : state.currentThread,
    }));
  },

  renameThread: async (threadId: string, title: string) => {
    await api.patch(`/api/threads/${threadId}`, { title });
    set((state) => ({
      threads: state.threads.map((t) =>
        t.id === threadId ? { ...t, title } : t
      ),
      currentThread:
        state.currentThread?.id === threadId
          ? { ...state.currentThread, title }
          : state.currentThread,
    }));
  },

  sendMessage: async (content: string, files?: File[], agentId?: string, teamId?: string | null, projectId?: string | null) => {
    const state = get();
    const { currentThread, selectedAgentId, currentTeamId, currentProjectId } = state;
    // Use provided agentId or selected agent for new threads
    const effectiveAgentId = agentId || (!currentThread ? selectedAgentId : null);
    // Use provided teamId or fall back to current teamId in store
    const effectiveTeamId = teamId !== undefined ? teamId : currentTeamId;
    // Use provided projectId or fall back to current projectId in store
    const effectiveProjectId = projectId !== undefined ? projectId : currentProjectId;
    console.log('[Chat] sendMessage called:', {
      paramAgentId: agentId,
      currentThreadId: currentThread?.id,
      currentThreadAgentId: currentThread?.agentId,
      storeSelectedAgentId: selectedAgentId,
      effectiveAgentId,
      hasCurrentThread: !!currentThread,
    });
    // Debug: Log existing messages before adding new one
    if (currentThread?.messages) {
      console.log('[Chat] Existing messages before send:', currentThread.messages.length);
      currentThread.messages.forEach((msg, i) => {
        if (msg.toolResults?.length) {
          console.log(`[Chat] Existing msg ${i}: role=${msg.role}, toolResults=${msg.toolResults.length}, uiResources=${msg.toolResults.filter(tr => tr.uiResource?.text).length}`);
        }
      });
    }

    // Upload files as documents and build mentions
    let contentWithMentions = content;
    if (files && files.length > 0) {
      const uploadedPaths: string[] = [];

      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        // Add team/project context if available
        if (effectiveTeamId) formData.append('teamId', effectiveTeamId);
        if (effectiveProjectId) formData.append('projectId', effectiveProjectId);

        const uploadResponse = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json().catch(() => ({}));
          throw new Error(errorData.error?.message || 'File upload failed');
        }

        const uploadData = await uploadResponse.json();
        if (uploadData.document?.path) {
          uploadedPaths.push(uploadData.document.path);
        }
      }

      // Append @mentions for uploaded documents to the message
      if (uploadedPaths.length > 0) {
        const mentions = uploadedPaths.join(' ');
        contentWithMentions = content ? `${content}\n\n${mentions}` : mentions;
      }
    }

    // Add optimistic user message
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      threadId: currentThread?.id || 'pending',
      role: 'user',
      content: contentWithMentions,
      createdAt: new Date(),
    };

    // If no current thread, create a temporary one to show the message immediately
    set((state) => ({
      currentThread: state.currentThread
        ? {
            ...state.currentThread,
            messages: [...state.currentThread.messages, userMessage],
          }
        : {
            id: 'pending',
            title: content.slice(0, 50) + (content.length > 50 ? '...' : ''),
            userId: undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
            messages: [userMessage],
          },
      isStreaming: true,
      streamingContent: '',
      pendingToolCalls: [],
      completedToolCalls: [],
    }));

    try {
      const { newThreadVisibility } = get();
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: currentThread?.id,
          content: contentWithMentions,
          agentId: effectiveAgentId || undefined,
          teamId: !currentThread?.id ? effectiveTeamId || undefined : undefined,
          projectId: !currentThread?.id ? effectiveProjectId || undefined : undefined,
          visibility: !currentThread?.id && effectiveTeamId ? newThreadVisibility : undefined,
        }),
        credentials: 'include',
      });

      console.log('[Chat] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Chat] Request failed:', response.status, errorText);
        throw new Error(`Chat request failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let fullContent = '';
      let threadId = currentThread?.id;
      let messageId = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const rawData = line.slice(6);
              // Debug: log all SSE events
              if (rawData.includes('tool_use') || rawData.includes('tool_result')) {
                console.log('[Chat] SSE raw event:', rawData.slice(0, 200) + (rawData.length > 200 ? '...' : ''));
              }
              const data = JSON.parse(rawData) as {
                type: string;
                content?: string;
                threadId?: string;
                title?: string;
                messageId?: string;
                error?: string;
                // Tool event fields
                id?: string;
                name?: string;
                serverId?: string;
                input?: Record<string, unknown>;
                isError?: boolean;
                uiResource?: UIResource;
                structuredContent?: Record<string, unknown>;
                // Tool confirmation fields
                confirmationId?: string;
                toolName?: string;
                toolArgs?: unknown;
                approved?: boolean;
                autoApproveReason?: AutoApproveReason;
                toolCalls?: Array<{
                  id: string;
                  name: string;
                  serverId: string;
                  input: Record<string, unknown>;
                  result: MCPContent[];
                  isError?: boolean;
                }>;
                // Sub-thread fields
                subThreadId?: string;
                parentThreadId?: string;
                agentId?: string;
                agentName?: string;
                summary?: string;
              };

              if (data.type === 'thread' && data.threadId) {
                threadId = data.threadId;
                const newTitle = data.title;
                // Update thread ID, title, and message threadIds
                set((state) => ({
                  currentThread: state.currentThread
                    ? {
                        ...state.currentThread,
                        id: threadId!,
                        title: newTitle || state.currentThread.title,
                        messages: state.currentThread.messages.map((m) => ({
                          ...m,
                          threadId: threadId!,
                        })),
                      }
                    : null,
                  // Also update the thread title in the sidebar list
                  threads: newTitle
                    ? state.threads.map((t) =>
                        t.id === threadId ? { ...t, title: newTitle } : t
                      )
                    : state.threads,
                }));
              } else if (data.type === 'start') {
                // Stream starting - good for debugging
                console.log('[Chat] Stream started');
              } else if (data.type === 'delta' && data.content) {
                fullContent += data.content;
                set({ streamingContent: fullContent });
              } else if (data.type === 'tool_use' && data.id && data.name && data.serverId) {
                // Add pending tool call
                console.log('[Chat] Tool use:', data.name);
                set((state) => ({
                  pendingToolCalls: [
                    ...state.pendingToolCalls,
                    {
                      id: data.id!,
                      name: data.name!,
                      serverId: data.serverId!,
                      input: data.input || {},
                    },
                  ],
                }));
              } else if (data.type === 'tool_result' && data.id) {
                // Move from pending to completed (or create new if no pending)
                console.log('[Chat] Tool result for:', data.id, 'name:', data.name);
                console.log('[Chat] Tool result uiResource:', data.uiResource ? { hasText: !!data.uiResource.text, textLen: data.uiResource.text?.length, mimeType: data.uiResource.mimeType } : 'none');
                set((state) => {
                  const pendingCall = state.pendingToolCalls.find((tc) => tc.id === data.id);

                  // Create the completed tool call using pendingCall if found, otherwise use data from event
                  const completedCall = pendingCall
                    ? {
                        ...pendingCall,
                        result: (data.content as unknown as MCPContent[]) || [],
                        isError: data.isError,
                        uiResource: data.uiResource,
                        structuredContent: (data.structuredContent as Record<string, unknown> | undefined),
                      }
                    : {
                        // Fallback: create from tool_result event data (server now includes name/serverId/input)
                        id: data.id!,
                        name: data.name || 'unknown',
                        serverId: data.serverId || 'unknown',
                        input: data.input || {},
                        result: (data.content as unknown as MCPContent[]) || [],
                        isError: data.isError,
                        uiResource: data.uiResource,
                        structuredContent: (data.structuredContent as Record<string, unknown> | undefined),
                      };

                  return {
                    pendingToolCalls: state.pendingToolCalls.filter((tc) => tc.id !== data.id),
                    completedToolCalls: [
                      ...state.completedToolCalls,
                      completedCall,
                    ],
                  };
                });
                // Verify the update
                const { completedToolCalls: updatedCalls } = get();
                console.log('[Chat] After tool_result, completedToolCalls:', updatedCalls.length, updatedCalls.map(tc => ({ name: tc.name, hasUiResource: !!tc.uiResource, textLen: tc.uiResource?.text?.length })));
              } else if (data.type === 'tool_pending_confirmation') {
                // Show confirmation modal
                console.log('[Chat] Tool pending confirmation:', data.confirmationId, data.toolName);
                set({
                  pendingConfirmation: {
                    confirmationId: data.confirmationId!,
                    serverId: data.serverId!,
                    toolName: data.toolName!,
                    toolArgs: data.toolArgs,
                  },
                });
              } else if (data.type === 'tool_confirmed') {
                // Clear pending confirmation
                console.log('[Chat] Tool confirmed:', data.confirmationId, data.approved);
                set({ pendingConfirmation: null });
              } else if (data.type === 'tool_auto_approved') {
                // Track auto-approved tools for UI indicator
                console.log('[Chat] Tool auto-approved:', data.toolName, data.autoApproveReason);
                // Find the pending tool call and update it with auto-approve info
                set((state) => ({
                  pendingToolCalls: state.pendingToolCalls.map((tc) =>
                    tc.id === data.id
                      ? { ...tc }
                      : tc
                  ),
                }));
              } else if (data.type === 'sub_thread_start' && data.subThreadId) {
                // A sub-agent thread has started
                console.log('[Chat] Sub-thread started:', data.subThreadId, data.agentName);
                set((state) => ({
                  activeSubThreads: {
                    ...state.activeSubThreads,
                    [data.subThreadId!]: {
                      id: data.subThreadId!,
                      parentThreadId: data.parentThreadId || threadId || '',
                      agentId: data.agentId || '',
                      agentName: data.agentName || 'Sub-Agent',
                      title: data.title || 'Sub-agent task',
                      isStreaming: true,
                      streamingContent: '',
                      pendingToolCalls: [],
                      completedToolCalls: [],
                      status: 'running' as const,
                      pendingConfirmation: null,
                    },
                  },
                }));
              } else if (data.type === 'sub_thread_delta' && data.subThreadId && data.content) {
                set((state) => {
                  const sub = state.activeSubThreads[data.subThreadId!];
                  if (!sub) return state;
                  return {
                    activeSubThreads: {
                      ...state.activeSubThreads,
                      [data.subThreadId!]: {
                        ...sub,
                        streamingContent: sub.streamingContent + data.content!,
                      },
                    },
                  };
                });
              } else if (data.type === 'sub_thread_tool_use' && data.subThreadId && data.id) {
                set((state) => {
                  const sub = state.activeSubThreads[data.subThreadId!];
                  if (!sub) return state;
                  return {
                    activeSubThreads: {
                      ...state.activeSubThreads,
                      [data.subThreadId!]: {
                        ...sub,
                        pendingToolCalls: [...sub.pendingToolCalls, {
                          id: data.id!,
                          name: data.name || '',
                          serverId: data.serverId || '',
                          input: data.input || {},
                        }],
                      },
                    },
                  };
                });
              } else if (data.type === 'sub_thread_tool_result' && data.subThreadId && data.id) {
                set((state) => {
                  const sub = state.activeSubThreads[data.subThreadId!];
                  if (!sub) return state;
                  const pendingCall = sub.pendingToolCalls.find((tc) => tc.id === data.id);
                  const completedCall = pendingCall
                    ? { ...pendingCall, result: (data.content as unknown as MCPContent[]) || [], isError: data.isError, uiResource: data.uiResource, structuredContent: data.structuredContent }
                    : { id: data.id!, name: data.name || '', serverId: data.serverId || '', input: data.input || {}, result: (data.content as unknown as MCPContent[]) || [], isError: data.isError, uiResource: data.uiResource, structuredContent: data.structuredContent };
                  return {
                    activeSubThreads: {
                      ...state.activeSubThreads,
                      [data.subThreadId!]: {
                        ...sub,
                        pendingToolCalls: sub.pendingToolCalls.filter((tc) => tc.id !== data.id),
                        completedToolCalls: [...sub.completedToolCalls, completedCall],
                      },
                    },
                  };
                });
              } else if (data.type === 'sub_thread_tool_pending_confirmation' && data.subThreadId && data.confirmationId) {
                set((state) => {
                  const sub = state.activeSubThreads[data.subThreadId!];
                  if (!sub) return state;
                  return {
                    activeSubThreads: {
                      ...state.activeSubThreads,
                      [data.subThreadId!]: {
                        ...sub,
                        pendingConfirmation: {
                          confirmationId: data.confirmationId!,
                          serverId: data.serverId || '',
                          toolName: data.toolName || '',
                          toolArgs: data.toolArgs,
                        },
                      },
                    },
                  };
                });
              } else if (data.type === 'sub_thread_tool_confirmed' && data.subThreadId) {
                set((state) => {
                  const sub = state.activeSubThreads[data.subThreadId!];
                  if (!sub) return state;
                  return {
                    activeSubThreads: {
                      ...state.activeSubThreads,
                      [data.subThreadId!]: { ...sub, pendingConfirmation: null },
                    },
                  };
                });
              } else if (data.type === 'sub_thread_done' && data.subThreadId) {
                console.log('[Chat] Sub-thread done:', data.subThreadId);
                set((state) => {
                  const sub = state.activeSubThreads[data.subThreadId!];
                  if (!sub) return state;
                  return {
                    activeSubThreads: {
                      ...state.activeSubThreads,
                      [data.subThreadId!]: {
                        ...sub,
                        isStreaming: false,
                        status: 'done' as const,
                      },
                    },
                  };
                });
                // Refresh thread list to show sub-thread in sidebar
                get().loadThreads();
              } else if (data.type === 'sub_thread_error' && data.subThreadId) {
                console.error('[Chat] Sub-thread error:', data.subThreadId, data.error);
                set((state) => {
                  const sub = state.activeSubThreads[data.subThreadId!];
                  if (!sub) return state;
                  return {
                    activeSubThreads: {
                      ...state.activeSubThreads,
                      [data.subThreadId!]: {
                        ...sub,
                        isStreaming: false,
                        status: 'error' as const,
                        error: data.error,
                      },
                    },
                  };
                });
              } else if (data.type === 'done') {
                messageId = data.messageId || '';
                // Note: We don't overwrite completedToolCalls here because
                // the tool_result events already include uiResource which
                // the done event's toolCalls don't have
                console.log('[Chat] Stream done, messageId:', messageId);
              } else if (data.type === 'error') {
                console.error('[Chat] Stream error:', data.error);
                throw new Error(data.error || 'Unknown error');
              }
            } catch (parseError) {
              // Skip invalid JSON but log unexpected errors
              if (parseError instanceof Error && parseError.message !== 'Unknown error') {
                console.warn('[Chat] Parse error:', parseError);
              }
            }
          }
        }
      }

      // Finalize the assistant message with tool calls
      const { completedToolCalls } = get();
      console.log('[Chat] Finalizing message with completedToolCalls:', completedToolCalls.length);
      completedToolCalls.forEach((tc, i) => {
        console.log(`[Chat] Tool ${i}: ${tc.name}, hasUiResource: ${!!tc.uiResource}, uiResourceText: ${tc.uiResource?.text?.length || 0}`);
      });
      const assistantMessage: Message = {
        id: messageId,
        threadId: threadId || '',
        role: 'assistant',
        content: fullContent,
        toolCalls: completedToolCalls.length > 0
          ? completedToolCalls.map((tc) => ({
              id: tc.id,
              serverId: tc.serverId,
              toolName: tc.name,
              arguments: tc.input,
              status: tc.isError ? 'error' as const : 'completed' as const,
            }))
          : undefined,
        toolResults: completedToolCalls.length > 0
          ? completedToolCalls.map((tc) => ({
              toolCallId: tc.id,
              content: tc.result,
              isError: tc.isError,
              uiResource: tc.uiResource,
              structuredContent: tc.structuredContent,
            }))
          : undefined,
        createdAt: new Date(),
      };
      console.log('[Chat] Finalized message toolResults:', assistantMessage.toolResults?.length || 0, assistantMessage.toolResults?.map(tr => ({ hasUiResource: !!tr.uiResource, textLen: tr.uiResource?.text?.length })));

      set((state) => ({
        currentThread: state.currentThread
          ? {
              ...state.currentThread,
              id: threadId || state.currentThread.id,
              messages: [...state.currentThread.messages, assistantMessage],
            }
          : null,
        isStreaming: false,
        streamingContent: '',
        pendingToolCalls: [],
        completedToolCalls: [],
        pendingConfirmation: null,
        activeSubThreads: {},
      }));

      // Refresh thread list to update previews
      get().loadThreads();
    } catch (error) {
      set({ isStreaming: false, streamingContent: '', pendingConfirmation: null, activeSubThreads: {} });
      throw error;
    }
  },

  regenerateMessage: async (messageId: string) => {
    set({ isStreaming: true, streamingContent: '' });

    try {
      const response = await fetch(`/api/chat/regenerate/${messageId}`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Regenerate request failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data: StreamingMessage = JSON.parse(line.slice(6));

              if (data.type === 'delta' && data.content) {
                fullContent += data.content;
                set({ streamingContent: fullContent });
              } else if (data.type === 'error') {
                throw new Error(data.error || 'Unknown error');
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      // Update the message
      set((state) => ({
        currentThread: state.currentThread
          ? {
              ...state.currentThread,
              messages: state.currentThread.messages.map((m) =>
                m.id === messageId ? { ...m, content: fullContent } : m
              ),
            }
          : null,
        isStreaming: false,
        streamingContent: '',
      }));
    } catch (error) {
      set({ isStreaming: false, streamingContent: '' });
      throw error;
    }
  },

  branchFromMessage: async (messageId: string) => {
    const response = await api.post<{ thread: Thread }>(`/api/chat/branch/${messageId}`, {});

    const newThread = response.thread;

    // Add the new thread to the list
    set((state) => ({
      threads: [
        {
          id: newThread.id,
          title: newThread.title,
          createdAt: newThread.createdAt,
          updatedAt: newThread.updatedAt,
          messageCount: newThread.messages?.length || 0,
          agentId: newThread.agentId,
          agentName: newThread.agentName,
          projectId: newThread.projectId,
          parentThreadId: newThread.parentThreadId,
        },
        ...state.threads,
      ],
      currentThread: newThread,
    }));

    return newThread;
  },

  clearCurrentThread: () => {
    set({ currentThread: null });
  },

  confirmTool: async (confirmationId: string, approved: boolean, scope?: ConfirmationScope) => {
    try {
      console.log('[Chat] Confirming tool:', confirmationId, approved, scope);
      const response = await fetch('/api/chat/confirm-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmationId, approved, scope }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Chat] Confirm tool failed:', response.status, errorText);
        throw new Error(`Confirm tool failed: ${response.status}`);
      }

      console.log('[Chat] Tool confirmation sent successfully');
    } catch (error) {
      console.error('[Chat] Error confirming tool:', error);
      // Clear pending confirmation on error to prevent UI from being stuck
      set({ pendingConfirmation: null });
      throw error;
    }
  },

  confirmSubThreadTool: async (subThreadId: string, confirmationId: string, approved: boolean, scope?: ConfirmationScope) => {
    try {
      console.log('[Chat] Confirming sub-thread tool:', subThreadId, confirmationId, approved, scope);
      const response = await fetch('/api/chat/confirm-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmationId, approved, scope }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Confirm tool failed: ${response.status}`);
      }
    } catch (error) {
      console.error('[Chat] Error confirming sub-thread tool:', error);
      // Clear pending confirmation for the sub-thread
      set((state) => {
        const sub = state.activeSubThreads[subThreadId];
        if (!sub) return state;
        return {
          activeSubThreads: {
            ...state.activeSubThreads,
            [subThreadId]: { ...sub, pendingConfirmation: null },
          },
        };
      });
      throw error;
    }
  },

  loadAgents: async () => {
    set({ isLoadingAgents: true });
    try {
      const response = await api.get<{ agents: AgentInfo[] }>('/api/agents');
      const agents = response.agents;

      // Set default agent as selected if none is selected
      const defaultAgent = agents.find((a) => a.isDefault) || agents[0];

      set({
        availableAgents: agents,
        selectedAgentId: get().selectedAgentId || defaultAgent?.id || null,
      });
    } catch (error) {
      console.error('[Chat] Failed to load agents:', error);
    } finally {
      set({ isLoadingAgents: false });
    }
  },

  setSelectedAgentId: (agentId: string | null) => {
    console.log('[Chat] setSelectedAgentId called with:', agentId);
    set({ selectedAgentId: agentId });
  },

  setNewThreadVisibility: (visibility: 'shared' | 'private') => {
    set({ newThreadVisibility: visibility });
  },

  updateThreadVisibility: async (threadId: string, visibility: 'shared' | 'private') => {
    await api.patch(`/api/threads/${threadId}`, { visibility });
    set((state) => ({
      threads: state.threads.map((t) =>
        t.id === threadId ? { ...t, visibility } : t
      ),
      currentThread:
        state.currentThread?.id === threadId
          ? { ...state.currentThread, visibility }
          : state.currentThread,
    }));
  },
}));
