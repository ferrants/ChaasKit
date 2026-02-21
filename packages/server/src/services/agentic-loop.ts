/**
 * Agentic Loop - Reusable multi-turn agent execution with tool calling.
 *
 * Extracted from chat.ts to allow reuse for sub-agent execution.
 */

import { db } from '@chaaskit/db';
import type { MCPContentItem, MCPServerConfig, FileAttachment } from '@chaaskit/shared';
import { getConfig } from '../config/loader.js';
import type { ChatMessage, AnthropicMessageContent } from './agent.js';
import { createAgentService } from './agent.js';
import { mcpManager } from '../mcp/client.js';
import { pendingConfirmations, type ConfirmationScope } from './pendingConfirmation.js';
import { checkToolConfirmationRequired, createDenialToolResult } from './toolConfirmation.js';
import { getAgentById, filterToolsForAgent, toAgentConfig, isBuiltInAgent, getNativeToolsForAgentFiltered, type ToolWithServerId } from './agents.js';
import { executeNativeTool, isNativeTool, resolveNativeToolTemplate } from '../tools/index.js';

export interface SSEWriter {
  write: (event: string, data: unknown) => void;
}

interface ToolCallRecord {
  id: string;
  name: string;
  serverId: string;
  input: Record<string, unknown>;
  result: MCPContentItem[];
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  uiResource?: {
    uri: string;
    text?: string;
    blob?: string;
    mimeType?: string;
    isOpenAiFormat?: boolean;
    toolInput?: Record<string, unknown>;
    toolOutput?: MCPContentItem[] | Record<string, unknown>;
  };
}

export interface AgenticLoopOptions {
  threadId: string;
  agentId: string | null;
  conversationMessages: ChatMessage[];
  systemPrompt?: string;
  teamContext?: string | null;
  projectContext?: string | null;
  mentionContext?: string | null;
  userContext?: Record<string, unknown> | null;
  userId?: string;
  teamId?: string | null;
  visitorId: string;
  maxLoops?: number;
  /** If set, this is a sub-agent loop - events are prefixed */
  subThreadId?: string;
  /** Thread-level allowed tools (shared across parent/sub-agent) */
  threadAllowedTools: string[];
  /** Files to include on the first iteration */
  files?: FileAttachment[];
  /** Whether to exclude delegate_to_agent from the tool set (for sub-agents) */
  excludeDelegation?: boolean;
}

export interface AgenticLoopResult {
  fullContent: string;
  toolCalls: ToolCallRecord[];
  totalUsage: { inputTokens: number; outputTokens: number };
}

/**
 * Write an SSE event. If subThreadId is set, prefix the event type with 'sub_thread_'
 * and include subThreadId in the data.
 */
function writeSSE(
  res: { write: (data: string) => void },
  type: string,
  data: Record<string, unknown>,
  subThreadId?: string
): void {
  const eventType = subThreadId ? `sub_thread_${type}` : type;
  const payload = subThreadId ? { ...data, type: eventType, subThreadId } : { ...data, type: eventType };
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

/**
 * Run the agentic loop - multi-turn agent execution with tool calling.
 */
export async function runAgenticLoop(
  res: { write: (data: string) => void },
  options: AgenticLoopOptions
): Promise<AgenticLoopResult> {
  const config = getConfig();
  const {
    threadId,
    agentId,
    conversationMessages,
    systemPrompt,
    teamContext,
    projectContext,
    mentionContext,
    userContext,
    userId,
    teamId,
    visitorId,
    maxLoops = 10,
    subThreadId,
    threadAllowedTools,
    files,
    excludeDelegation,
  } = options;

  const agentDef = getAgentById(agentId);
  const agentConfig = agentDef ? toAgentConfig(agentDef) : config.agent;
  const agentService = createAgentService(agentConfig);

  // Get available MCP tools
  const mcpServers = config.mcp?.servers || [];
  const allMcpTools = await mcpManager.listAllToolsForUser(userId, mcpServers, teamId);

  // Get native tools
  const nativeTools = await getNativeToolsForAgentFiltered(agentId, { userId, teamId });

  // Combine and filter
  let allTools: ToolWithServerId[] = [...allMcpTools, ...nativeTools];
  let filteredTools = filterToolsForAgent(agentId, allTools);

  // For sub-agents: remove delegate_to_agent to prevent recursive delegation
  if (excludeDelegation) {
    filteredTools = filteredTools.filter((t) => t.name !== 'delegate_to_agent');
  }

  // Build tool metadata lookup
  const toolMetaLookup = new Map<string, { serverId: string; _meta?: Record<string, unknown> }>();
  for (const tool of filteredTools) {
    toolMetaLookup.set(tool.name, { serverId: tool.serverId, _meta: '_meta' in tool ? tool._meta : undefined });
  }

  let fullContent = '';
  let totalUsage = { inputTokens: 0, outputTokens: 0 };
  const toolCalls: ToolCallRecord[] = [];

  let loopMessages = [...conversationMessages];
  let loopCount = 0;

  while (loopCount < maxLoops) {
    loopCount++;
    let currentLoopText = '';
    const currentLoopToolCalls: Array<{ id: string; name: string; serverId: string; input: Record<string, unknown> }> = [];
    let stopReason: string | undefined;

    const agentSystemPrompt = agentDef && isBuiltInAgent(agentDef) ? agentDef.systemPrompt : undefined;

    const stream = agentService.chat(loopMessages, {
      systemPrompt: systemPrompt || agentSystemPrompt,
      teamContext: teamContext ?? undefined,
      projectContext: projectContext ?? undefined,
      mentionContext: mentionContext ?? undefined,
      userContext: userContext ?? undefined,
      files: loopCount === 1 ? files : undefined,
      tools: filteredTools.length > 0 ? filteredTools : undefined,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'text' && chunk.content) {
        currentLoopText += chunk.content;
        fullContent += chunk.content;
        writeSSE(res, 'delta', { content: chunk.content }, subThreadId);
      } else if (chunk.type === 'tool_use' && chunk.toolUse) {
        writeSSE(res, 'tool_use', {
          id: chunk.toolUse.id,
          name: chunk.toolUse.name,
          serverId: chunk.toolUse.serverId,
          input: chunk.toolUse.input,
        }, subThreadId);

        currentLoopToolCalls.push({
          id: chunk.toolUse.id,
          name: chunk.toolUse.name,
          serverId: chunk.toolUse.serverId,
          input: chunk.toolUse.input,
        });
      } else if (chunk.type === 'stop' && chunk.stopReason) {
        stopReason = chunk.stopReason;
      } else if (chunk.type === 'usage' && chunk.usage) {
        totalUsage.inputTokens += chunk.usage.inputTokens;
        totalUsage.outputTokens += chunk.usage.outputTokens;
      }
    }

    // If no tool calls or stop reason is not tool_use, we're done
    if (currentLoopToolCalls.length === 0 || stopReason !== 'tool_use') {
      break;
    }

    // Check for delegate_to_agent calls vs regular tool calls
    const delegationCalls = currentLoopToolCalls.filter((tc) => tc.name === 'delegate_to_agent');
    const regularCalls = currentLoopToolCalls.filter((tc) => tc.name !== 'delegate_to_agent');

    // Execute regular tool calls
    const toolResultBlocks: AnthropicMessageContent[] = [];

    for (const toolCall of regularCalls) {
      const result = await executeToolCall(
        res, toolCall, {
          userId, threadId, agentId, teamId,
          visitorId, threadAllowedTools, userContext,
          toolMetaLookup, mcpServers, subThreadId,
        }
      );

      toolCalls.push(result.record);
      toolResultBlocks.push(result.resultBlock);
    }

    // Execute delegation calls (in parallel)
    if (delegationCalls.length > 0) {
      const delegationResults = await Promise.all(
        delegationCalls.map((tc) =>
          executeDelegation(res, tc, {
            userId, teamId, visitorId, threadId,
            threadAllowedTools,
          })
        )
      );

      for (const result of delegationResults) {
        toolCalls.push(result.record);
        toolResultBlocks.push(result.resultBlock);
      }
    }

    // Build assistant message with tool uses for context
    const assistantContent: AnthropicMessageContent[] = [];
    if (currentLoopText) {
      assistantContent.push({ type: 'text', text: currentLoopText });
    }
    for (const tc of currentLoopToolCalls) {
      assistantContent.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.name,
        input: tc.input,
      });
    }

    loopMessages.push({ role: 'assistant', content: assistantContent });
    loopMessages.push({ role: 'user', content: toolResultBlocks });
  }

  return { fullContent, toolCalls, totalUsage };
}

/**
 * Execute a single tool call (MCP or native, with confirmation flow).
 */
async function executeToolCall(
  res: { write: (data: string) => void },
  toolCall: { id: string; name: string; serverId: string; input: Record<string, unknown> },
  ctx: {
    userId?: string;
    threadId: string;
    agentId: string | null;
    teamId?: string | null;
    visitorId: string;
    threadAllowedTools: string[];
    userContext?: Record<string, unknown> | null;
    toolMetaLookup: Map<string, { serverId: string; _meta?: Record<string, unknown> }>;
    mcpServers: MCPServerConfig[];
    subThreadId?: string;
  }
): Promise<{ record: ToolCallRecord; resultBlock: AnthropicMessageContent }> {
  const config = getConfig();
  const isNativeToolCall = isNativeTool(toolCall.serverId);
  const serverConfig = isNativeToolCall ? undefined : ctx.mcpServers.find((s) => s.id === toolCall.serverId);
  const toolId = `${toolCall.serverId}:${toolCall.name}`;

  // Check if tool confirmation is required
  const confirmCheck = checkToolConfirmationRequired({
    serverId: toolCall.serverId,
    toolName: toolCall.name,
    userId: ctx.userId || '',
    userSettings: ctx.userContext || undefined,
    threadAllowedTools: ctx.threadAllowedTools,
  });

  let toolResult: { content: MCPContentItem[]; isError?: boolean; structuredContent?: Record<string, unknown> };

  if (confirmCheck.required && ctx.userId) {
    const { id: confirmationId, promise: confirmationPromise } = pendingConfirmations.create({
      visitorId: ctx.visitorId,
      threadId: ctx.threadId,
      userId: ctx.userId,
      serverId: toolCall.serverId,
      toolName: toolCall.name,
      toolArgs: toolCall.input,
    });

    writeSSE(res, 'tool_pending_confirmation', {
      confirmationId,
      serverId: toolCall.serverId,
      toolName: toolCall.name,
      toolArgs: toolCall.input,
    }, ctx.subThreadId);

    const confirmationResult = await confirmationPromise;

    writeSSE(res, 'tool_confirmed', {
      confirmationId,
      approved: confirmationResult.approved,
    }, ctx.subThreadId);

    if (!confirmationResult.approved) {
      toolResult = {
        content: [{ type: 'text', text: createDenialToolResult(toolCall.name) }],
        isError: false,
      };
    } else {
      if (confirmationResult.scope === 'thread') {
        ctx.threadAllowedTools.push(toolId);
      }
      toolResult = await executeToolRaw(toolCall, ctx);
    }
  } else {
    if (confirmCheck.autoApproveReason && ctx.userId) {
      writeSSE(res, 'tool_auto_approved', {
        toolCallId: toolCall.id,
        serverId: toolCall.serverId,
        toolName: toolCall.name,
        reason: confirmCheck.autoApproveReason,
      }, ctx.subThreadId);
    }
    toolResult = await executeToolRaw(toolCall, ctx);
  }

  // Resolve UI resource
  let uiResource: { text?: string; blob?: string; mimeType?: string } | null = null;
  let resourceUri: string | undefined;
  let isOpenAiFormat = false;

  if (isNativeToolCall) {
    const nativeTemplate = await resolveNativeToolTemplate(toolCall.name);
    if (nativeTemplate) {
      uiResource = nativeTemplate;
      resourceUri = `native://${toolCall.name}/template`;
      isOpenAiFormat = true;
    }
  } else {
    const toolMeta = ctx.toolMetaLookup.get(toolCall.name);
    const openaiOutputTemplate = toolMeta?._meta?.['openai/outputTemplate'];
    const uiResourceUri = toolMeta?._meta?.['ui/resourceUri'];
    resourceUri = (openaiOutputTemplate || uiResourceUri) as string | undefined;
    isOpenAiFormat = !!openaiOutputTemplate;

    if (resourceUri && typeof resourceUri === 'string' && serverConfig) {
      uiResource = await mcpManager.readResourceForUser(
        ctx.userId || '',
        toolCall.serverId,
        resourceUri,
        serverConfig,
        ctx.teamId
      );
    }
  }

  const toolOutput = toolResult.structuredContent || toolResult.content;

  // Send tool_result event
  writeSSE(res, 'tool_result', {
    id: toolCall.id,
    name: toolCall.name,
    serverId: toolCall.serverId,
    input: toolCall.input,
    content: toolResult.content,
    isError: toolResult.isError,
    structuredContent: toolResult.structuredContent,
    uiResource: uiResource ? {
      uri: resourceUri,
      text: uiResource.text,
      blob: uiResource.blob,
      mimeType: uiResource.mimeType,
      isOpenAiFormat,
      toolInput: toolCall.input,
      toolOutput,
    } : undefined,
  }, ctx.subThreadId);

  // Build result text for agent context
  let resultText = toolResult.content
    .map((c) => c.text || JSON.stringify(c))
    .join('\n');

  if (toolResult.structuredContent) {
    resultText += '\n\nThe user has been shown this structured data:\n' + JSON.stringify(toolResult.structuredContent, null, 2);
  }

  const record: ToolCallRecord = {
    ...toolCall,
    result: toolResult.content,
    isError: toolResult.isError,
    structuredContent: toolResult.structuredContent,
    uiResource: uiResource ? {
      uri: resourceUri as string,
      text: uiResource.text,
      blob: uiResource.blob,
      mimeType: uiResource.mimeType,
      isOpenAiFormat,
      toolInput: toolCall.input,
      toolOutput,
    } : undefined,
  };

  const resultBlock: AnthropicMessageContent = {
    type: 'tool_result',
    tool_use_id: toolCall.id,
    content: resultText,
    is_error: toolResult.isError,
  };

  return { record, resultBlock };
}

/**
 * Execute tool without confirmation flow (raw execution).
 */
async function executeToolRaw(
  toolCall: { name: string; serverId: string; input: Record<string, unknown> },
  ctx: {
    userId?: string;
    threadId: string;
    agentId: string | null;
    teamId?: string | null;
    mcpServers: MCPServerConfig[];
  }
): Promise<{ content: MCPContentItem[]; isError?: boolean; structuredContent?: Record<string, unknown> }> {
  if (isNativeTool(toolCall.serverId)) {
    return executeNativeTool(toolCall.name, toolCall.input, {
      userId: ctx.userId,
      threadId: ctx.threadId,
      agentId: ctx.agentId || undefined,
      teamId: ctx.teamId ?? undefined,
    });
  }

  const serverConfig = ctx.mcpServers.find((s) => s.id === toolCall.serverId);
  if (!serverConfig) {
    return {
      content: [{ type: 'text', text: `Server config not found for ${toolCall.serverId}` }],
      isError: true,
    };
  }

  return mcpManager.callToolForUser(
    ctx.userId,
    toolCall.serverId,
    toolCall.name,
    toolCall.input,
    serverConfig,
    ctx.teamId
  );
}

/**
 * Execute a delegate_to_agent tool call - spawns a sub-agent thread.
 */
async function executeDelegation(
  res: { write: (data: string) => void },
  toolCall: { id: string; name: string; serverId: string; input: Record<string, unknown> },
  ctx: {
    userId?: string;
    teamId?: string | null;
    visitorId: string;
    threadId: string;
    threadAllowedTools: string[];
  }
): Promise<{ record: ToolCallRecord; resultBlock: AnthropicMessageContent }> {
  const { agentId, prompt, context } = toolCall.input as {
    agentId: string;
    prompt: string;
    context?: string;
  };

  // Validate target agent exists
  const targetAgent = getAgentById(agentId);
  if (!targetAgent) {
    const errorText = `Agent "${agentId}" not found. Please check the available agents.`;
    return {
      record: {
        ...toolCall,
        result: [{ type: 'text', text: errorText }],
        isError: true,
      },
      resultBlock: {
        type: 'tool_result',
        tool_use_id: toolCall.id,
        content: errorText,
        is_error: true,
      },
    };
  }

  // Create sub-agent thread
  const subThread = await db.thread.create({
    data: {
      title: `[${targetAgent.name}] ${prompt.slice(0, 40)}${prompt.length > 40 ? '...' : ''}`,
      userId: ctx.userId,
      teamId: ctx.teamId,
      agentId: targetAgent.id,
      threadType: 'sub-agent',
      parentThreadId: ctx.threadId,
    },
  });

  // Send sub_thread_start event
  writeSSE(res, 'start', {
    subThreadId: subThread.id,
    parentThreadId: ctx.threadId,
    agentId: targetAgent.id,
    agentName: targetAgent.name,
    title: subThread.title,
  }, subThread.id);

  // Save user message to sub-thread
  const userMessage = context ? `${prompt}\n\nContext:\n${context}` : prompt;
  await db.message.create({
    data: {
      threadId: subThread.id,
      role: 'user',
      content: userMessage,
    },
  });

  try {
    // Run agentic loop for sub-agent
    const result = await runAgenticLoop(res, {
      threadId: subThread.id,
      agentId: targetAgent.id,
      conversationMessages: [{ role: 'user', content: userMessage }],
      userId: ctx.userId,
      teamId: ctx.teamId,
      visitorId: ctx.visitorId,
      subThreadId: subThread.id,
      threadAllowedTools: ctx.threadAllowedTools,
      excludeDelegation: true, // Prevent recursive delegation
    });

    // Save assistant message to sub-thread
    const assistantMessage = await db.message.create({
      data: {
        threadId: subThread.id,
        role: 'assistant',
        content: result.fullContent,
        inputTokens: result.totalUsage.inputTokens,
        outputTokens: result.totalUsage.outputTokens,
        toolCalls: result.toolCalls.length > 0 ? JSON.parse(JSON.stringify(result.toolCalls.map((tc) => ({
          id: tc.id,
          serverId: tc.serverId,
          toolName: tc.name,
          arguments: tc.input,
          status: tc.isError ? 'error' : 'completed',
        })))) : undefined,
        toolResults: result.toolCalls.length > 0
          ? JSON.parse(JSON.stringify(result.toolCalls.map((tc) => ({
              toolCallId: tc.id,
              content: tc.result,
              isError: tc.isError,
              uiResource: tc.uiResource,
              structuredContent: tc.structuredContent,
            }))))
          : undefined,
      },
    });

    // Send sub_thread_done event
    const summary = result.fullContent.length > 500
      ? result.fullContent.slice(0, 500) + '...'
      : result.fullContent;

    writeSSE(res, 'done', {
      subThreadId: subThread.id,
      summary,
      messageId: assistantMessage.id,
    }, subThread.id);

    // Return the sub-agent's content as the tool result
    const resultText = `Sub-agent "${targetAgent.name}" completed the task.\n\nResult:\n${result.fullContent}`;

    return {
      record: {
        ...toolCall,
        result: [{ type: 'text', text: resultText }],
        isError: false,
      },
      resultBlock: {
        type: 'tool_result',
        tool_use_id: toolCall.id,
        content: resultText,
        is_error: false,
      },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    writeSSE(res, 'error', {
      subThreadId: subThread.id,
      error: errorMsg,
    }, subThread.id);

    const resultText = `Sub-agent "${targetAgent.name}" encountered an error: ${errorMsg}`;

    return {
      record: {
        ...toolCall,
        result: [{ type: 'text', text: resultText }],
        isError: true,
      },
      resultBlock: {
        type: 'tool_result',
        tool_use_id: toolCall.id,
        content: resultText,
        is_error: true,
      },
    };
  }
}
