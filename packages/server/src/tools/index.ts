import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { db } from '@chaaskit/db';
import { decryptCredential } from '../services/encryption.js';
import type { NativeTool, NativeToolForAgent, NativeCredentialConfig, ResolvedCredential, ToolContext, ToolResult } from './types.js';
import { webScrapeTool } from './web-scrape.js';
import { getPlanUsageTool } from './get-plan-usage.js';
import { documentTools } from './documents.js';
import { delegateToAgentTool } from './delegate-to-agent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export type { NativeTool, NativeToolForAgent, NativeCredentialConfig, ResolvedCredential, ToolContext, ToolResult } from './types.js';

/**
 * Registry of all available native tools
 */
const nativeToolRegistry = new Map<string, NativeTool>();

// Register built-in native tools
nativeToolRegistry.set('web-scrape', webScrapeTool);
nativeToolRegistry.set('get-plan-usage', getPlanUsageTool);
nativeToolRegistry.set('delegate_to_agent', delegateToAgentTool);

// Register document tools
for (const tool of documentTools) {
  nativeToolRegistry.set(tool.name, tool);
}

/**
 * Registry of native credential configurations
 */
const nativeCredentialRegistry = new Map<string, NativeCredentialConfig>();

/**
 * Register a credential configuration for native tool integrations.
 * Credentials are stored in the MCPCredential table and managed through the settings UI.
 */
export function registerNativeCredential(config: NativeCredentialConfig): void {
  nativeCredentialRegistry.set(config.id, config);
  console.log(`[NativeTool] Registered credential config: ${config.id}`);
}

/**
 * Get all registered native credential configurations
 */
export function getNativeCredentialConfigs(): NativeCredentialConfig[] {
  return Array.from(nativeCredentialRegistry.values());
}

/**
 * Get a native credential configuration by ID
 */
export function getNativeCredentialConfig(id: string): NativeCredentialConfig | undefined {
  return nativeCredentialRegistry.get(id);
}

/**
 * Resolve a native credential from the database, decrypting it for use
 */
async function resolveNativeCredential(
  config: NativeCredentialConfig,
  context: ToolContext
): Promise<ResolvedCredential | null> {
  const isTeamAuth = config.authMode === 'team-apikey' || config.authMode === 'team-oauth';

  let credential;
  if (isTeamAuth && context.teamId) {
    credential = await db.mCPCredential.findFirst({
      where: { teamId: context.teamId, serverId: config.id },
    });
  } else if (!isTeamAuth && context.userId) {
    credential = await db.mCPCredential.findFirst({
      where: { userId: context.userId, serverId: config.id, teamId: null },
    });
  }

  if (!credential?.encryptedData) return null;

  try {
    return decryptCredential<ResolvedCredential>(credential.encryptedData);
  } catch {
    return null;
  }
}

/**
 * Check if a native credential exists (without decrypting)
 */
async function checkNativeCredentialExists(
  config: NativeCredentialConfig,
  context: { userId?: string; teamId?: string | null }
): Promise<boolean> {
  const isTeamAuth = config.authMode === 'team-apikey' || config.authMode === 'team-oauth';

  if (isTeamAuth && context.teamId) {
    const count = await db.mCPCredential.count({
      where: { teamId: context.teamId, serverId: config.id },
    });
    return count > 0;
  } else if (!isTeamAuth && context.userId) {
    const count = await db.mCPCredential.count({
      where: { userId: context.userId, serverId: config.id, teamId: null },
    });
    return count > 0;
  }

  return false;
}

/**
 * Get all registered native tools
 */
export function getAllNativeTools(): NativeTool[] {
  return Array.from(nativeToolRegistry.values());
}

/**
 * Get a native tool by name
 */
export function getNativeTool(name: string): NativeTool | undefined {
  return nativeToolRegistry.get(name);
}

/**
 * Get native tools formatted for agent consumption (matching MCP tool format).
 * If context is provided, tools with credential requirements are filtered based on
 * credential availability and the whenMissing config.
 */
export async function getNativeToolsForAgent(
  context?: { userId?: string; teamId?: string | null }
): Promise<NativeToolForAgent[]> {
  const tools = getAllNativeTools();
  const result: NativeToolForAgent[] = [];

  for (const tool of tools) {
    // If tool requires credentials, check availability
    if (tool.credentialId && context) {
      const credConfig = getNativeCredentialConfig(tool.credentialId);
      if (credConfig) {
        const hasCredential = await checkNativeCredentialExists(credConfig, context);
        if (!hasCredential && (credConfig.whenMissing ?? 'hide') === 'hide') {
          continue; // Skip tool - credential not configured, hide mode
        }
        // 'error' mode: include tool, executeNativeTool() will return error at runtime
      }
    }

    result.push({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      serverId: 'native' as const,
      _meta: tool._meta,
    });
  }

  return result;
}

/**
 * Resolve the template for a native tool (inline or file-based)
 */
export async function resolveNativeToolTemplate(
  toolName: string
): Promise<{ text: string; mimeType: string } | null> {
  const tool = getNativeTool(toolName);
  if (!tool?._meta) return null;

  // Check for inline template
  if (tool._meta['ui/template']) {
    return {
      text: tool._meta['ui/template'] as string,
      mimeType: 'text/html',
    };
  }

  // Check for file-based template
  if (tool._meta['ui/templateFile']) {
    const templatePath = join(__dirname, 'templates', tool._meta['ui/templateFile'] as string);
    try {
      const text = await readFile(templatePath, 'utf-8');
      return { text, mimeType: 'text/html' };
    } catch (error) {
      console.error(`[NativeTool] Failed to read template ${templatePath}:`, error);
      return null;
    }
  }

  return null;
}

/**
 * Execute a native tool by name.
 * If the tool has a credentialId, the credential is auto-resolved and passed via context.
 */
export async function executeNativeTool(
  name: string,
  input: Record<string, unknown>,
  context: ToolContext
): Promise<ToolResult> {
  const tool = getNativeTool(name);

  if (!tool) {
    return {
      content: [{ type: 'text', text: `Unknown native tool: ${name}` }],
      isError: true,
    };
  }

  // Auto-resolve credential if tool has credentialId
  if (tool.credentialId && !context.credential) {
    const credConfig = getNativeCredentialConfig(tool.credentialId);
    if (credConfig) {
      const resolved = await resolveNativeCredential(credConfig, context);
      if (resolved) {
        context = { ...context, credential: resolved };
      } else {
        const scope = credConfig.authMode.startsWith('team-') ? 'Team Settings' : 'your settings';
        return {
          content: [{ type: 'text', text: `${credConfig.name} is not connected. Please configure it in ${scope}.` }],
          isError: true,
        };
      }
    }
  }

  try {
    return await tool.execute(input, context);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: `Tool execution failed: ${message}` }],
      isError: true,
    };
  }
}

/**
 * Register a custom native tool
 */
export function registerNativeTool(tool: NativeTool): void {
  nativeToolRegistry.set(tool.name, tool);
}

/**
 * Check if a tool name is a native tool
 */
export function isNativeTool(serverId: string): boolean {
  return serverId === 'native';
}
