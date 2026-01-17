import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { AgentConfig, BuiltInAgentConfig, ExternalAgentConfig, FileAttachment, MCPTool, MCPContentItem } from '@chaaskit/shared';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | AnthropicMessageContent[];
}

export type AnthropicMessageContent =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export interface ChatOptions {
  systemPrompt?: string;
  teamContext?: string | null;
  projectContext?: string | null;
  mentionContext?: string | null;
  userContext?: Record<string, unknown> | null;
  files?: FileAttachment[];
  tools?: Array<MCPTool & { serverId: string }>;
}

export interface ToolUseInfo {
  id: string;
  name: string;
  input: Record<string, unknown>;
  serverId: string;
}

export interface ToolResultInfo {
  id: string;
  content: MCPContentItem[];
  isError?: boolean;
}

export interface StreamChunk {
  type: 'text' | 'usage' | 'tool_use' | 'tool_result' | 'stop';
  content?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  toolUse?: ToolUseInfo;
  toolResult?: ToolResultInfo;
  stopReason?: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
}

export interface AgentService {
  chat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): AsyncGenerator<StreamChunk, void, unknown>;
}

// Type guards for AgentConfig
function isBuiltInConfig(config: AgentConfig): config is BuiltInAgentConfig {
  return 'type' in config && config.type === 'built-in';
}

function isExternalConfig(config: AgentConfig): config is ExternalAgentConfig {
  return 'type' in config && config.type === 'external';
}

export function createAgentService(config: AgentConfig): AgentService {
  if (isBuiltInConfig(config)) {
    if (config.provider === 'anthropic') {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey || apiKey.trim() === '') {
        throw new Error('ANTHROPIC_API_KEY is not set. Please add it to your .env file.');
      }
      return new AnthropicAgentService(config.model, config.maxTokens, apiKey);
    } else if (config.provider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey || apiKey.trim() === '') {
        throw new Error('OPENAI_API_KEY is not set. Please add it to your .env file.');
      }
      return new OpenAIAgentService(config.model, config.maxTokens, apiKey);
    }
  } else if (isExternalConfig(config)) {
    return new ExternalAgentService(config.endpoint, config.headers);
  }

  throw new Error(`Unsupported agent configuration`);
}

class AnthropicAgentService implements AgentService {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;

  constructor(model: string, maxTokens: number, apiKey: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
    this.maxTokens = maxTokens;
  }

  async *chat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): AsyncGenerator<StreamChunk, void, unknown> {
    // Build system prompt with team, project, and user context
    let systemPrompt = options?.systemPrompt || 'You are a helpful assistant.';

    // Add team context first (if this is a team thread)
    if (options?.teamContext) {
      systemPrompt += `\n\nTeam context:\n${options.teamContext}`;
    }

    // Add project context (if this thread belongs to a project)
    if (options?.projectContext) {
      systemPrompt += `\n\nProject context:\n${options.projectContext}`;
    }

    // Add mention context (referenced documents)
    if (options?.mentionContext) {
      systemPrompt += `\n\n${options.mentionContext}`;
    }

    // Add user context
    if (options?.userContext) {
      const contextStr = Object.entries(options.userContext)
        .filter(([, v]) => v != null && v !== '')
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');

      if (contextStr) {
        systemPrompt += `\n\nUser context:\n${contextStr}`;
      }
    }

    // Build tool lookup map for finding serverId
    const toolServerMap = new Map<string, string>();
    if (options?.tools) {
      for (const tool of options.tools) {
        toolServerMap.set(tool.name, tool.serverId);
      }
    }

    // Convert MCP tools to Anthropic format
    const anthropicTools: Anthropic.Messages.Tool[] | undefined = options?.tools?.map((tool) => ({
      name: tool.name,
      description: tool.description || '',
      input_schema: tool.inputSchema as Anthropic.Messages.Tool.InputSchema,
    }));

    // Debug logging for tools being passed to model
    if (anthropicTools && anthropicTools.length > 0) {
      console.log(`[Agent] Sending ${anthropicTools.length} tools to Anthropic model`);
      console.log(`[Agent] Tool names: ${anthropicTools.map(t => t.name).join(', ')}`);
    } else {
      console.log(`[Agent] No tools being sent to Anthropic model`);
    }

    // Handle file attachments and build messages
    const anthropicMessages: Anthropic.Messages.MessageParam[] = messages.map((msg) => {
      if (msg.role === 'system') {
        return { role: 'user' as const, content: `[System]: ${msg.content}` };
      }

      // Handle complex content (tool_use, tool_result blocks)
      if (Array.isArray(msg.content)) {
        return {
          role: msg.role as 'user' | 'assistant',
          content: msg.content as Anthropic.Messages.ContentBlockParam[],
        };
      }

      return {
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      };
    });

    // If files are attached to the last user message
    if (options?.files && options.files.length > 0) {
      const lastMessage = anthropicMessages[anthropicMessages.length - 1];
      if (lastMessage && lastMessage.role === 'user' && typeof lastMessage.content === 'string') {
        const content: Anthropic.Messages.ContentBlockParam[] = [];

        // Add file content
        for (const file of options.files) {
          if (file.type.startsWith('image/')) {
            content.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: file.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: file.content || '',
              },
            });
          } else {
            // For non-image files, include as text
            const fileContent = file.content
              ? Buffer.from(file.content, 'base64').toString('utf-8')
              : '';
            content.push({
              type: 'text',
              text: `[File: ${file.name}]\n${fileContent}`,
            });
          }
        }

        // Add the message text
        content.push({
          type: 'text',
          text: lastMessage.content as string,
        });

        (lastMessage as { role: 'user'; content: Anthropic.Messages.ContentBlockParam[] }).content = content;
      }
    }

    // Log request details
    console.log(`[Agent] Request to Anthropic:`);
    console.log(`[Agent]   Model: ${this.model}`);
    console.log(`[Agent]   Messages: ${anthropicMessages.length}`);
    console.log(`[Agent]   System prompt length: ${systemPrompt.length} chars`);
    console.log(`[Agent]   Tools: ${anthropicTools?.length || 0}`);

    // Log last user message for context
    const lastUserMsg = anthropicMessages.filter(m => m.role === 'user').pop();
    if (lastUserMsg && typeof lastUserMsg.content === 'string') {
      console.log(`[Agent]   Last user message: "${lastUserMsg.content.slice(0, 100)}${lastUserMsg.content.length > 100 ? '...' : ''}"`);
    }

    const stream = await this.client.messages.stream({
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      messages: anthropicMessages,
      ...(anthropicTools && anthropicTools.length > 0 ? { tools: anthropicTools } : {}),
    });

    // Track current tool use block being built
    let currentToolUse: { id: string; name: string; inputJson: string } | null = null;
    let fullResponseText = '';

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          fullResponseText += event.delta.text;
          yield { type: 'text', content: event.delta.text };
        } else if (event.delta.type === 'input_json_delta') {
          // Accumulate JSON for tool input
          if (currentToolUse) {
            currentToolUse.inputJson += event.delta.partial_json;
          }
        }
      } else if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          currentToolUse = {
            id: event.content_block.id,
            name: event.content_block.name,
            inputJson: '',
          };
        }
      } else if (event.type === 'content_block_stop') {
        // Emit tool_use when block completes
        if (currentToolUse) {
          let input: Record<string, unknown> = {};
          try {
            input = JSON.parse(currentToolUse.inputJson || '{}');
          } catch {
            console.error('[Agent] Failed to parse tool input JSON:', currentToolUse.inputJson);
          }

          const serverId = toolServerMap.get(currentToolUse.name) || '';
          console.log(`[Agent] Model requested tool: ${currentToolUse.name} (server: ${serverId})`);
          console.log(`[Agent]   Input: ${JSON.stringify(input)}`);

          yield {
            type: 'tool_use',
            toolUse: {
              id: currentToolUse.id,
              name: currentToolUse.name,
              input,
              serverId,
            },
          };
          currentToolUse = null;
        }
      }
    }

    const finalMessage = await stream.finalMessage();

    // Log the full response text
    if (fullResponseText) {
      console.log(`[Agent] LLM Response text (${fullResponseText.length} chars):`);
      console.log(`[Agent]   "${fullResponseText.slice(0, 500)}${fullResponseText.length > 500 ? '...' : ''}"`);
    }

    console.log(`[Agent] Response complete:`);
    console.log(`[Agent]   Stop reason: ${finalMessage.stop_reason}`);
    console.log(`[Agent]   Usage: ${finalMessage.usage.input_tokens} in / ${finalMessage.usage.output_tokens} out`);

    // Emit stop reason
    yield {
      type: 'stop',
      stopReason: finalMessage.stop_reason as StreamChunk['stopReason'],
    };

    yield {
      type: 'usage',
      usage: {
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
      },
    };
  }
}

class OpenAIAgentService implements AgentService {
  private client: OpenAI;
  private model: string;
  private maxTokens: number;

  constructor(model: string, maxTokens: number, apiKey: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
    this.maxTokens = maxTokens;
  }

  async *chat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): AsyncGenerator<StreamChunk, void, unknown> {
    let systemPrompt = options?.systemPrompt || 'You are a helpful assistant.';

    // Add team context first (if this is a team thread)
    if (options?.teamContext) {
      systemPrompt += `\n\nTeam context:\n${options.teamContext}`;
    }

    // Add project context (if this thread belongs to a project)
    if (options?.projectContext) {
      systemPrompt += `\n\nProject context:\n${options.projectContext}`;
    }

    // Add mention context (referenced documents)
    if (options?.mentionContext) {
      systemPrompt += `\n\n${options.mentionContext}`;
    }

    // Add user context
    if (options?.userContext) {
      const contextStr = Object.entries(options.userContext)
        .filter(([, v]) => v != null && v !== '')
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');

      if (contextStr) {
        systemPrompt += `\n\nUser context:\n${contextStr}`;
      }
    }

    // Build tool lookup map for finding serverId
    const toolServerMap = new Map<string, string>();
    if (options?.tools) {
      for (const tool of options.tools) {
        toolServerMap.set(tool.name, tool.serverId);
      }
    }

    // Convert MCP tools to OpenAI format
    const openaiTools: OpenAI.ChatCompletionTool[] | undefined = options?.tools?.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description || '',
        parameters: tool.inputSchema as Record<string, unknown>,
      },
    }));

    // Debug logging for tools
    if (openaiTools && openaiTools.length > 0) {
      console.log(`[Agent] Sending ${openaiTools.length} tools to OpenAI model`);
      console.log(`[Agent] Tool names: ${openaiTools.map(t => t.function.name).join(', ')}`);
    } else {
      console.log(`[Agent] No tools being sent to OpenAI model`);
    }

    // Build messages, handling tool calls and results
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    for (const msg of messages) {
      if (Array.isArray(msg.content)) {
        // Complex content with tool_use or tool_result blocks
        const textParts: string[] = [];
        const toolCalls: OpenAI.ChatCompletionMessageToolCall[] = [];
        const toolResults: Array<{ tool_call_id: string; content: string }> = [];

        for (const block of msg.content) {
          if (block.type === 'text') {
            textParts.push(block.text);
          } else if (block.type === 'tool_use') {
            toolCalls.push({
              id: block.id,
              type: 'function',
              function: {
                name: block.name,
                arguments: JSON.stringify(block.input),
              },
            });
          } else if (block.type === 'tool_result') {
            toolResults.push({
              tool_call_id: block.tool_use_id,
              content: block.content,
            });
          }
        }

        // If we have tool calls, this is an assistant message with function calls
        if (toolCalls.length > 0) {
          openaiMessages.push({
            role: 'assistant',
            content: textParts.length > 0 ? textParts.join('\n') : null,
            tool_calls: toolCalls,
          });
        } else if (toolResults.length > 0) {
          // Tool results go as separate tool messages
          for (const result of toolResults) {
            openaiMessages.push({
              role: 'tool',
              tool_call_id: result.tool_call_id,
              content: result.content,
            });
          }
        } else if (textParts.length > 0) {
          openaiMessages.push({
            role: msg.role as 'user' | 'assistant',
            content: textParts.join('\n'),
          });
        }
      } else {
        // Simple string content
        openaiMessages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    // Log request details
    console.log(`[Agent] Request to OpenAI:`);
    console.log(`[Agent]   Model: ${this.model}`);
    console.log(`[Agent]   Messages: ${openaiMessages.length}`);
    console.log(`[Agent]   System prompt length: ${systemPrompt.length} chars`);
    console.log(`[Agent]   Tools: ${openaiTools?.length || 0}`);

    // Log last user message for context
    const lastUserMsg = openaiMessages.filter(m => m.role === 'user').pop();
    if (lastUserMsg && typeof lastUserMsg.content === 'string') {
      console.log(`[Agent]   Last user message: "${lastUserMsg.content.slice(0, 100)}${lastUserMsg.content.length > 100 ? '...' : ''}"`);
    }

    const stream = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: this.maxTokens,
      messages: openaiMessages,
      stream: true,
      stream_options: { include_usage: true },
      ...(openaiTools && openaiTools.length > 0 ? { tools: openaiTools } : {}),
    });

    let inputTokens = 0;
    let outputTokens = 0;
    let fullResponseText = '';

    // Track tool calls being streamed
    const toolCallsInProgress: Map<number, { id: string; name: string; arguments: string }> = new Map();

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      const delta = choice?.delta;

      // Handle text content
      if (delta?.content) {
        fullResponseText += delta.content;
        yield { type: 'text', content: delta.content };
      }

      // Handle tool calls
      if (delta?.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          const index = toolCall.index;

          if (!toolCallsInProgress.has(index)) {
            toolCallsInProgress.set(index, {
              id: toolCall.id || '',
              name: toolCall.function?.name || '',
              arguments: '',
            });
          }

          const tc = toolCallsInProgress.get(index)!;

          if (toolCall.id) {
            tc.id = toolCall.id;
          }
          if (toolCall.function?.name) {
            tc.name = toolCall.function.name;
          }
          if (toolCall.function?.arguments) {
            tc.arguments += toolCall.function.arguments;
          }
        }
      }

      // Check if we're done with this choice
      if (choice?.finish_reason === 'tool_calls' || choice?.finish_reason === 'stop') {
        // Emit any completed tool calls
        for (const [, tc] of toolCallsInProgress) {
          if (tc.id && tc.name) {
            let input: Record<string, unknown> = {};
            try {
              input = JSON.parse(tc.arguments || '{}');
            } catch {
              console.error('[Agent] Failed to parse OpenAI tool arguments:', tc.arguments);
            }

            const serverId = toolServerMap.get(tc.name) || '';
            console.log(`[Agent] Model requested tool: ${tc.name} (server: ${serverId})`);
            console.log(`[Agent]   Input: ${JSON.stringify(input)}`);

            yield {
              type: 'tool_use',
              toolUse: {
                id: tc.id,
                name: tc.name,
                input,
                serverId,
              },
            };
          }
        }
        toolCallsInProgress.clear();

        // Emit stop reason
        const stopReason = choice?.finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn';
        console.log(`[Agent] Response complete:`);
        console.log(`[Agent]   Stop reason: ${stopReason}`);

        yield {
          type: 'stop',
          stopReason: stopReason as StreamChunk['stopReason'],
        };
      }

      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens;
        outputTokens = chunk.usage.completion_tokens;
      }
    }

    // Log the full response text
    if (fullResponseText) {
      console.log(`[Agent] LLM Response text (${fullResponseText.length} chars):`);
      console.log(`[Agent]   "${fullResponseText.slice(0, 500)}${fullResponseText.length > 500 ? '...' : ''}"`);
    }

    console.log(`[Agent]   Usage: ${inputTokens} in / ${outputTokens} out`);

    yield {
      type: 'usage',
      usage: {
        inputTokens,
        outputTokens,
      },
    };
  }
}

class ExternalAgentService implements AgentService {
  private endpoint: string;
  private headers: Record<string, string>;

  constructor(endpoint: string, headers?: Record<string, string>) {
    this.endpoint = endpoint;
    this.headers = headers || {};

    // Replace environment variable placeholders
    for (const [key, value] of Object.entries(this.headers)) {
      if (value.startsWith('${') && value.endsWith('}')) {
        const envVar = value.slice(2, -1);
        this.headers[key] = process.env[envVar] || '';
      }
    }
  }

  async *chat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.headers,
      },
      body: JSON.stringify({
        messages,
        systemPrompt: options?.systemPrompt,
        userContext: options?.userContext,
        files: options?.files,
      }),
    });

    if (!response.ok) {
      throw new Error(`External agent error: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body from external agent');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'text' || parsed.type === 'delta') {
              yield { type: 'text', content: parsed.content };
            } else if (parsed.type === 'usage') {
              yield { type: 'usage', usage: parsed.usage };
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  }
}
