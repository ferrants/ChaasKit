import { getConfig } from '../config/loader.js';
import type {
  AgentConfig,
  AgentDefinition,
  BuiltInAgentDefinition,
  ExternalAgentDefinition,
  MCPTool,
} from '@chaaskit/shared';
import { getNativeToolsForAgent, type NativeToolForAgent } from '../tools/index.js';

/**
 * Check if config is multi-agent (has 'agents' array)
 */
function isMultiAgentConfig(config: AgentConfig): config is { agents: AgentDefinition[] } {
  return 'agents' in config && Array.isArray(config.agents);
}

/**
 * Check if agent definition is external type
 */
export function isExternalAgent(agent: AgentDefinition): agent is ExternalAgentDefinition {
  return 'type' in agent && agent.type === 'external';
}

/**
 * Check if agent definition is built-in type
 */
export function isBuiltInAgent(agent: AgentDefinition): agent is BuiltInAgentDefinition {
  return !('type' in agent) || agent.type !== 'external';
}

/**
 * Normalize configuration to always return array of AgentDefinitions.
 * Handles both legacy single-agent config and new multi-agent config.
 */
export function getAgentDefinitions(): AgentDefinition[] {
  const config = getConfig().agent;

  // Multi-agent config
  if (isMultiAgentConfig(config)) {
    return config.agents;
  }

  // Legacy single-agent: built-in
  if (config.type === 'built-in') {
    return [
      {
        id: 'default',
        name: 'AI Assistant',
        provider: config.provider,
        model: config.model,
        systemPrompt: config.systemPrompt,
        maxTokens: config.maxTokens,
        isDefault: true,
      },
    ];
  }

  // Legacy single-agent: external
  if (config.type === 'external') {
    return [
      {
        id: 'default',
        name: 'AI Assistant',
        type: 'external' as const,
        endpoint: config.endpoint,
        headers: config.headers,
        isDefault: true,
      },
    ];
  }

  // Fallback - should not happen with proper TypeScript types
  throw new Error('Invalid agent configuration');
}

/**
 * Get a specific agent by ID.
 * Returns default agent if ID is null/undefined.
 */
export function getAgentById(agentId?: string | null): AgentDefinition | undefined {
  const agents = getAgentDefinitions();

  if (!agentId) {
    // Return the default agent
    const defaultAgent = agents.find((a) => a.isDefault);
    return defaultAgent || agents[0];
  }

  return agents.find((a) => a.id === agentId);
}

/**
 * Get the default agent.
 */
export function getDefaultAgent(): AgentDefinition {
  const agents = getAgentDefinitions();
  const defaultAgent = agents.find((a) => a.isDefault);
  return defaultAgent || agents[0];
}

/**
 * Get agents available for a user's plan.
 * If agent has no plans restriction, it's available to all.
 */
export function getAgentsForPlan(userPlan?: string): AgentDefinition[] {
  const agents = getAgentDefinitions();
  const plan = userPlan || 'free';

  return agents.filter((agent) => {
    // No plans restriction = available to all
    if (!agent.plans || agent.plans.length === 0) {
      return true;
    }
    // Check if user's plan is in allowed plans
    return agent.plans.includes(plan);
  });
}

/**
 * Check if a user can access a specific agent based on their plan.
 */
export function canAccessAgent(agentId: string, userPlan?: string): boolean {
  const agent = getAgentById(agentId);
  if (!agent) return false;

  // No plans restriction = available to all
  if (!agent.plans || agent.plans.length === 0) {
    return true;
  }

  const plan = userPlan || 'free';
  return agent.plans.includes(plan);
}

/**
 * Tool with serverId (unified format for MCP and native tools)
 */
export type ToolWithServerId = (MCPTool | NativeToolForAgent) & { serverId: string };

/**
 * Check if a tool matches an allowed pattern.
 *
 * Pattern syntax:
 * - 'server:*' - All tools from a server (including 'native:*')
 * - 'server:tool-name' - Specific tool (e.g., 'native:web-scrape')
 */
function toolMatchesPattern(tool: ToolWithServerId, pattern: string): boolean {
  const toolId = `${tool.serverId}:${tool.name}`;

  // Wildcard pattern: 'server:*'
  if (pattern.endsWith(':*')) {
    const serverId = pattern.slice(0, -2);
    return tool.serverId === serverId;
  }

  // Exact match: 'server:tool-name'
  return pattern === toolId;
}

/**
 * Filter tools (MCP or native) based on agent's allowedTools configuration.
 *
 * Tool pattern syntax:
 * - 'server:*' - All tools from a server (e.g., 'native:*' for all native tools)
 * - 'server:tool-name' - Specific tool (e.g., 'native:web-scrape')
 * - No allowedTools = no tools available (opt-in model)
 */
export function filterToolsForAgent(
  agentId: string | null | undefined,
  tools: ToolWithServerId[]
): ToolWithServerId[] {
  const agent = getAgentById(agentId);

  // No agent found or no tool restrictions - return empty (opt-in model)
  if (!agent?.allowedTools || agent.allowedTools.length === 0) {
    // For backward compatibility: if no allowedTools specified, allow all MCP tools but no native tools
    return tools.filter((tool) => tool.serverId !== 'native');
  }

  return tools.filter((tool) => {
    return agent.allowedTools!.some((pattern) => toolMatchesPattern(tool, pattern));
  });
}

/**
 * Get native tools available for an agent based on allowedTools config.
 * Native tools are opt-in: only available if explicitly listed.
 * When context is provided, tools with credential requirements are filtered
 * based on credential availability.
 */
export async function getNativeToolsForAgentFiltered(
  agentId: string | null | undefined,
  context?: { userId?: string; teamId?: string | null }
): Promise<NativeToolForAgent[]> {
  const agent = getAgentById(agentId);
  const allNativeTools = await getNativeToolsForAgent(context);

  // No allowedTools = no native tools (opt-in model)
  if (!agent?.allowedTools || agent.allowedTools.length === 0) {
    return [];
  }

  return allNativeTools.filter((tool) => {
    return agent.allowedTools!.some((pattern) => toolMatchesPattern(tool, pattern));
  });
}

/**
 * Convert an AgentDefinition to the legacy AgentConfig format
 * for use with createAgentService.
 */
export function toAgentConfig(agent: AgentDefinition): AgentConfig {
  if (isExternalAgent(agent)) {
    return {
      type: 'external' as const,
      endpoint: agent.endpoint,
      headers: agent.headers,
    };
  }

  // Built-in agent
  return {
    type: 'built-in' as const,
    provider: agent.provider,
    model: agent.model,
    systemPrompt: agent.systemPrompt,
    maxTokens: agent.maxTokens,
  };
}

/**
 * Get agent info suitable for client response (excludes sensitive data).
 */
export function getAgentClientInfo(agent: AgentDefinition): {
  id: string;
  name: string;
  isDefault?: boolean;
} {
  return {
    id: agent.id,
    name: agent.name,
    isDefault: agent.isDefault,
  };
}
