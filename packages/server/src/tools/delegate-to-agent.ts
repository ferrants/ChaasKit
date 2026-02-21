import type { NativeTool } from './types.js';
import { getAgentDefinitions } from '../services/agents.js';

/**
 * Build the tool description dynamically based on available agents.
 */
function buildDescription(): string {
  const agents = getAgentDefinitions();
  const agentList = agents
    .map((a) => `- "${a.id}": ${a.name}`)
    .join('\n');

  return `Delegate a task to a specialized sub-agent. The sub-agent will handle the task independently in a separate conversation thread and return its results. Use this when a task is better handled by a specialized agent.

Available agents:
${agentList}

The sub-agent will have access to its own tools and will complete the task autonomously. You will receive a summary of its work as the tool result.`;
}

/**
 * delegate_to_agent native tool definition.
 *
 * Note: The actual execution is handled specially in the agentic loop,
 * not through the normal execute() path. The execute() here is a fallback
 * that should not normally be called.
 */
export const delegateToAgentTool: NativeTool = {
  name: 'delegate_to_agent',

  get description() {
    return buildDescription();
  },

  inputSchema: {
    type: 'object',
    properties: {
      agentId: {
        type: 'string',
        description: 'The ID of the agent to delegate to',
      },
      prompt: {
        type: 'string',
        description: 'The task description / prompt to send to the sub-agent',
      },
      context: {
        type: 'string',
        description: 'Optional additional context from the current conversation to pass to the sub-agent',
      },
    },
    required: ['agentId', 'prompt'],
  },

  execute: async () => {
    // This should never be called directly - the agentic loop intercepts it
    return {
      content: [{ type: 'text', text: 'Error: delegate_to_agent must be handled by the agentic loop' }],
      isError: true,
    };
  },
};
