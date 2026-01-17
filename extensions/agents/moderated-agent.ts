/**
 * Moderated Agent Example
 *
 * This custom agent wraps an inner agent (OpenAI or Anthropic) and adds
 * content moderation before and after processing. It demonstrates:
 * - Pre-processing: Checking user input for blocked content
 * - Post-processing: Could filter or modify responses
 * - Using the registry to access built-in agent services
 *
 * To use this agent, add it to your config/app.config.ts:
 *
 * ```typescript
 * agent: {
 *   agents: [
 *     {
 *       id: 'moderated',
 *       name: 'Moderated Assistant',
 *       type: 'custom',
 *       customType: 'moderated',
 *       config: {
 *         innerProvider: 'openai',
 *         innerModel: 'gpt-4o-mini',
 *         blockedTerms: ['banned', 'forbidden'],
 *       },
 *     },
 *   ],
 * }
 * ```
 */

import { registry, BaseAgent } from '../../packages/core-server/src/registry/index.js';
import { createAgentService, type ChatMessage, type ChatOptions, type StreamChunk } from '../../packages/core-server/src/services/agent.js';

interface ModeratedAgentConfig {
  innerProvider: 'openai' | 'anthropic';
  innerModel: string;
  maxTokens?: number;
  blockedTerms?: string[];
  systemPromptPrefix?: string;
}

export class ModeratedAgent extends BaseAgent {
  name = 'moderated';
  private config: ModeratedAgentConfig;
  private blockedTerms: string[];

  constructor(config: ModeratedAgentConfig) {
    super();
    this.config = config;
    this.blockedTerms = (config.blockedTerms || []).map(t => t.toLowerCase());
    console.log(`[ModeratedAgent] Initialized with ${this.blockedTerms.length} blocked terms`);
  }

  async *chat(
    messages: Array<{ role: string; content: string }>,
    options?: Record<string, unknown>
  ): AsyncIterable<{ type: string; content?: string }> {
    // Pre-processing: Check the last user message for blocked content
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'user' && typeof lastMessage.content === 'string') {
      const isBlocked = this.checkContentModeration(lastMessage.content);
      if (isBlocked) {
        console.log(`[ModeratedAgent] Content blocked for user message`);
        yield { type: 'text', content: "I'm sorry, but I can't help with that request. Please try rephrasing your question." };
        return;
      }
    }

    // Create the inner agent service
    const innerAgent = createAgentService({
      type: 'built-in',
      provider: this.config.innerProvider,
      model: this.config.innerModel,
      maxTokens: this.config.maxTokens || 4096,
    });

    // Build chat options
    const chatOptions: ChatOptions = {
      systemPrompt: this.buildSystemPrompt(options?.systemPrompt as string | undefined),
      userContext: options?.userContext as Record<string, unknown> | null,
      files: options?.files as ChatOptions['files'],
      tools: options?.tools as ChatOptions['tools'],
    };

    // Pass through to inner agent
    const chatMessages = messages as ChatMessage[];
    for await (const chunk of innerAgent.chat(chatMessages, chatOptions)) {
      // Post-processing: Could modify or filter the response here
      // For now, we just pass through
      yield this.convertChunk(chunk);
    }
  }

  private checkContentModeration(content: string): boolean {
    if (this.blockedTerms.length === 0) return false;

    const lowerContent = content.toLowerCase();
    return this.blockedTerms.some(term => lowerContent.includes(term));
  }

  private buildSystemPrompt(basePrompt?: string): string {
    let prompt = basePrompt || 'You are a helpful assistant.';

    if (this.config.systemPromptPrefix) {
      prompt = `${this.config.systemPromptPrefix}\n\n${prompt}`;
    }

    // Add moderation instructions
    prompt += '\n\nIMPORTANT: Always maintain a helpful, professional tone. Avoid discussing harmful, illegal, or inappropriate topics.';

    return prompt;
  }

  private convertChunk(chunk: StreamChunk): { type: string; content?: string } {
    if (chunk.type === 'text') {
      return { type: 'text', content: chunk.content };
    } else if (chunk.type === 'tool_use') {
      return { type: 'tool_use', content: JSON.stringify(chunk.toolUse) };
    } else if (chunk.type === 'stop') {
      return { type: 'stop', content: chunk.stopReason };
    } else if (chunk.type === 'usage') {
      return { type: 'usage', content: JSON.stringify(chunk.usage) };
    }
    return { type: chunk.type };
  }
}

// Factory function for creating the agent from config
export function createModeratedAgent(config: unknown): ModeratedAgent {
  return new ModeratedAgent(config as ModeratedAgentConfig);
}

// Register the agent
registry.register('agent', 'moderated', createModeratedAgent);
