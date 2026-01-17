/**
 * Tool Confirmation Service
 *
 * Determines whether a tool call requires user confirmation based on:
 * 1. Admin configuration (mode: none, all, whitelist, blacklist)
 * 2. User's "always allow" settings
 * 3. Thread-level allowances (tools allowed for this thread)
 */

import type { AutoApproveReason } from '@chaaskit/shared';
import { getConfig } from '../config/loader.js';

export interface UserSettings {
  allowedTools?: string[];
  [key: string]: unknown;
}

export interface ConfirmationCheckParams {
  serverId: string;
  toolName: string;
  userId: string;
  userSettings?: UserSettings;
  threadAllowedTools?: string[]; // Tools allowed for this thread
}

export interface ConfirmationCheckResult {
  required: boolean;
  autoApproveReason?: AutoApproveReason;
}

/**
 * Check if a tool call requires user confirmation
 */
export function checkToolConfirmationRequired(params: ConfirmationCheckParams): ConfirmationCheckResult {
  const { serverId, toolName, userSettings, threadAllowedTools } = params;
  const config = getConfig().mcp?.toolConfirmation;
  const toolId = `${serverId}:${toolName}`;

  // 1. Check admin config mode
  if (!config || config.mode === 'none') {
    return { required: false, autoApproveReason: 'config_none' };
  }

  // 2. Check whitelist mode (listed tools DON'T require confirmation)
  if (config.mode === 'whitelist') {
    const tools = config.tools || [];
    if (tools.includes(toolId) || tools.includes(toolName)) {
      return { required: false, autoApproveReason: 'whitelist' };
    }
    // In whitelist mode, if tool is not in whitelist, check other allowances
  }

  // 3. Check blacklist mode (listed tools DO require confirmation)
  if (config.mode === 'blacklist') {
    const tools = config.tools || [];
    // If tool is NOT in the blacklist, it's auto-approved
    if (!tools.includes(toolId) && !tools.includes(toolName)) {
      return { required: false, autoApproveReason: 'config_none' };
    }
    // Tool is in blacklist, check other allowances below
  }

  // 4. Check user's "always allow" settings
  if (userSettings?.allowedTools?.includes(toolId)) {
    return { required: false, autoApproveReason: 'user_always' };
  }

  // 5. Check thread-level allowance
  if (threadAllowedTools?.includes(toolId)) {
    return { required: false, autoApproveReason: 'thread_allowed' };
  }

  // 6. If we got here, confirmation is required
  return { required: true };
}

/**
 * Format a tool result for denial
 */
export function createDenialToolResult(toolName: string): string {
  return `The user denied permission to execute the tool "${toolName}". Please respect their decision and continue the conversation without using this tool, or ask if they'd like to try a different approach.`;
}
