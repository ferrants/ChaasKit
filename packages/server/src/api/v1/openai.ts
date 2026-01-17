import { Router } from 'express';
import { HTTP_STATUS } from '@chaaskit/shared';
import { requireAuth } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { createAgentService, type ChatMessage, type StreamChunk } from '../../services/agent.js';
import { getAgentsForPlan, getAgentById, toAgentConfig, isBuiltInAgent } from '../../services/agents.js';

export const openaiRouter = Router();

/**
 * OpenAI-compatible types
 */
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIChatCompletionRequest {
  model: string;
  messages: OpenAIMessage[];
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  n?: number;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  user?: string;
}

interface OpenAIModel {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
}

interface OpenAIModelsResponse {
  object: 'list';
  data: OpenAIModel[];
}

interface OpenAIChoice {
  index: number;
  message: {
    role: 'assistant';
    content: string;
  };
  finish_reason: 'stop' | 'length' | 'tool_calls' | null;
}

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenAIChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage: OpenAIUsage;
}

interface OpenAIStreamChoice {
  index: number;
  delta: {
    role?: 'assistant';
    content?: string;
  };
  finish_reason: 'stop' | 'length' | 'tool_calls' | null;
}

interface OpenAIChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: OpenAIStreamChoice[];
  usage?: OpenAIUsage;
}

/**
 * Generate a unique completion ID
 */
function generateCompletionId(): string {
  return `chatcmpl-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Convert internal stop reason to OpenAI format
 */
function toOpenAIFinishReason(stopReason?: StreamChunk['stopReason']): 'stop' | 'length' | 'tool_calls' | null {
  switch (stopReason) {
    case 'end_turn':
      return 'stop';
    case 'max_tokens':
      return 'length';
    case 'tool_use':
      return 'tool_calls';
    default:
      return null;
  }
}

/**
 * GET /v1/models
 * List available models (agents) for the current user
 */
openaiRouter.get('/models', requireAuth, async (req, res, next) => {
  try {
    const userPlan = req.user?.plan;
    const agents = getAgentsForPlan(userPlan);

    const models: OpenAIModel[] = agents.map((agent) => ({
      id: agent.id,
      object: 'model' as const,
      created: Math.floor(Date.now() / 1000),
      owned_by: 'organization',
    }));

    const response: OpenAIModelsResponse = {
      object: 'list',
      data: models,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/models/:model
 * Get a specific model by ID
 */
openaiRouter.get('/models/:model', requireAuth, async (req, res, next) => {
  try {
    const { model } = req.params;
    const agent = getAgentById(model);

    if (!agent) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, `Model '${model}' not found`);
    }

    // Check plan access
    const userPlan = req.user?.plan;
    if (agent.plans && agent.plans.length > 0 && !agent.plans.includes(userPlan || 'free')) {
      throw new AppError(HTTP_STATUS.FORBIDDEN, `Access to model '${model}' is not available on your plan`);
    }

    const response: OpenAIModel = {
      id: agent.id,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'organization',
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v1/chat/completions
 * OpenAI-compatible chat completions endpoint
 */
openaiRouter.post('/chat/completions', requireAuth, async (req, res, next) => {
  try {
    const body = req.body as OpenAIChatCompletionRequest;
    const { model, messages, stream = false } = body;

    // Validate required fields
    if (!model) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'model is required');
    }
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'messages is required and must be a non-empty array');
    }

    // Find the agent
    const agent = getAgentById(model);
    if (!agent) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, `Model '${model}' not found`);
    }

    // Check plan access
    const userPlan = req.user?.plan;
    if (agent.plans && agent.plans.length > 0 && !agent.plans.includes(userPlan || 'free')) {
      throw new AppError(HTTP_STATUS.FORBIDDEN, `Access to model '${model}' is not available on your plan`);
    }

    // Convert OpenAI messages to internal format
    // Extract system message for separate handling
    let systemPrompt: string | undefined;
    const chatMessages: ChatMessage[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        // Concatenate system messages
        systemPrompt = systemPrompt ? `${systemPrompt}\n\n${msg.content}` : msg.content;
      } else {
        chatMessages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    // Create agent service
    const agentConfig = toAgentConfig(agent);
    const agentService = createAgentService(agentConfig);

    // Get system prompt from agent definition if not provided in request
    const agentSystemPrompt = isBuiltInAgent(agent) ? agent.systemPrompt : undefined;
    const finalSystemPrompt = systemPrompt || agentSystemPrompt;

    const completionId = generateCompletionId();
    const created = Math.floor(Date.now() / 1000);

    if (stream) {
      // Streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      let fullContent = '';
      let finishReason: 'stop' | 'length' | 'tool_calls' | null = null;
      let usage = { inputTokens: 0, outputTokens: 0 };
      let sentFirstChunk = false;

      try {
        const agentStream = agentService.chat(chatMessages, {
          systemPrompt: finalSystemPrompt,
        });

        for await (const chunk of agentStream) {
          if (chunk.type === 'text' && chunk.content) {
            fullContent += chunk.content;

            const streamChunk: OpenAIChatCompletionChunk = {
              id: completionId,
              object: 'chat.completion.chunk',
              created,
              model,
              choices: [
                {
                  index: 0,
                  delta: sentFirstChunk ? { content: chunk.content } : { role: 'assistant', content: chunk.content },
                  finish_reason: null,
                },
              ],
            };
            sentFirstChunk = true;

            res.write(`data: ${JSON.stringify(streamChunk)}\n\n`);
          } else if (chunk.type === 'stop') {
            finishReason = toOpenAIFinishReason(chunk.stopReason);
          } else if (chunk.type === 'usage' && chunk.usage) {
            usage = chunk.usage;
          }
        }

        // Send final chunk with finish_reason
        const finalChunk: OpenAIChatCompletionChunk = {
          id: completionId,
          object: 'chat.completion.chunk',
          created,
          model,
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: finishReason || 'stop',
            },
          ],
          usage: {
            prompt_tokens: usage.inputTokens,
            completion_tokens: usage.outputTokens,
            total_tokens: usage.inputTokens + usage.outputTokens,
          },
        };

        res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
        res.write('data: [DONE]\n\n');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        res.write(`data: ${JSON.stringify({ error: { message: errorMessage, type: 'server_error' } })}\n\n`);
      }

      res.end();
    } else {
      // Non-streaming response
      let fullContent = '';
      let finishReason: 'stop' | 'length' | 'tool_calls' | null = null;
      let usage = { inputTokens: 0, outputTokens: 0 };

      const agentStream = agentService.chat(chatMessages, {
        systemPrompt: finalSystemPrompt,
      });

      for await (const chunk of agentStream) {
        if (chunk.type === 'text' && chunk.content) {
          fullContent += chunk.content;
        } else if (chunk.type === 'stop') {
          finishReason = toOpenAIFinishReason(chunk.stopReason);
        } else if (chunk.type === 'usage' && chunk.usage) {
          usage = chunk.usage;
        }
      }

      const response: OpenAIChatCompletionResponse = {
        id: completionId,
        object: 'chat.completion',
        created,
        model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: fullContent,
            },
            finish_reason: finishReason || 'stop',
          },
        ],
        usage: {
          prompt_tokens: usage.inputTokens,
          completion_tokens: usage.outputTokens,
          total_tokens: usage.inputTokens + usage.outputTokens,
        },
      };

      res.json(response);
    }
  } catch (error) {
    next(error);
  }
});
