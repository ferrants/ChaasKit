import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { NativeTool, NativeToolForAgent, ToolContext, ToolResult } from './types.js';
import { webScrapeTool } from './web-scrape.js';
import { getPlanUsageTool } from './get-plan-usage.js';
import { documentTools } from './documents.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export type { NativeTool, NativeToolForAgent, ToolContext, ToolResult } from './types.js';

/**
 * Registry of all available native tools
 */
const nativeToolRegistry = new Map<string, NativeTool>();

// Register built-in native tools
nativeToolRegistry.set('web-scrape', webScrapeTool);
nativeToolRegistry.set('get-plan-usage', getPlanUsageTool);

// Register document tools
for (const tool of documentTools) {
  nativeToolRegistry.set(tool.name, tool);
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
 * Get native tools formatted for agent consumption (matching MCP tool format)
 */
export function getNativeToolsForAgent(): NativeToolForAgent[] {
  return getAllNativeTools().map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    serverId: 'native' as const,
    _meta: tool._meta,
  }));
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
 * Execute a native tool by name
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
