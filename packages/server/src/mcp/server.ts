/**
 * MCP Server Handler
 *
 * Implements JSON-RPC 2.0 MCP protocol for exposing this app's tools to external clients.
 * Supports external MCP clients like Claude Desktop, MCP Inspector, etc.
 */

import type { MCPTool, MCPContentItem } from '@chaaskit/shared';
import { getAllNativeTools, executeNativeTool } from '../tools/index.js';
import { getConfig } from '../config/loader.js';
import { registry } from '../registry/index.js';

// =============================================================================
// JSON-RPC Types
// =============================================================================

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: JsonRpcError;
}

interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// MCP Protocol error codes (from spec)
const MCP_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

// =============================================================================
// MCP Server Implementation
// =============================================================================

export interface MCPServerContext {
  userId?: string;
  teamId?: string;
  scopes?: string[];
}

/**
 * Convert native tools to MCP tool format
 */
export function nativeToolsToMCPTools(): MCPTool[] {
  const nativeTools = getAllNativeTools();

  return nativeTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: {
      type: 'object' as const,
      properties: tool.inputSchema.properties,
      required: tool.inputSchema.required,
    },
    _meta: tool._meta,
  }));
}

/**
 * Get all tools to expose via MCP based on config
 */
function getExposedTools(): MCPTool[] {
  const config = getConfig();
  const serverConfig = config.mcp?.server;

  if (!serverConfig?.enabled) {
    return [];
  }

  const exposeTools = serverConfig.exposeTools ?? 'native';

  if (exposeTools === 'native') {
    return nativeToolsToMCPTools();
  }

  if (exposeTools === 'all') {
    // Get native tools + any extension-registered tools
    return nativeToolsToMCPTools();
  }

  if (Array.isArray(exposeTools)) {
    // Filter to specific tools by name
    const allTools = nativeToolsToMCPTools();
    return allTools.filter((tool) => exposeTools.includes(tool.name));
  }

  return nativeToolsToMCPTools();
}

/**
 * Get MCP resources from registry (extension-provided)
 */
async function getMCPResources(): Promise<
  Array<{ uri: string; name: string; description?: string; mimeType?: string }>
> {
  const resourcesMap = registry.getAll<{
    uri: string;
    name: string;
    description?: string;
    mimeType?: string;
    read: (context: { userId?: string }) => Promise<{ text?: string; blob?: string }>;
  }>('mcp-resource');

  const resources: Array<{ uri: string; name: string; description?: string; mimeType?: string }> = [];
  for (const [, resource] of resourcesMap) {
    resources.push({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType,
    });
  }
  return resources;
}

/**
 * Read an MCP resource by URI
 */
async function readMCPResource(
  uri: string,
  context: MCPServerContext
): Promise<{ text?: string; blob?: string } | null> {
  type MCPResourceType = {
    uri: string;
    name: string;
    description?: string;
    mimeType?: string;
    read: (context: { userId?: string }) => Promise<{ text?: string; blob?: string }>;
  };

  const resourcesMap = registry.getAll<MCPResourceType>('mcp-resource');

  let foundResource: MCPResourceType | undefined = undefined;
  for (const [, resource] of resourcesMap) {
    if (resource.uri === uri) {
      foundResource = resource;
      break;
    }
  }

  if (!foundResource) {
    return null;
  }

  try {
    return await foundResource.read({ userId: context.userId });
  } catch (error) {
    console.error(`[MCP Server] Error reading resource ${uri}:`, error);
    return null;
  }
}

/**
 * Handle MCP protocol methods
 */
export async function handleMCPRequest(
  request: JsonRpcRequest,
  context: MCPServerContext
): Promise<JsonRpcResponse> {
  const { id, method, params } = request;

  try {
    switch (method) {
      case 'initialize':
        return handleInitialize(id, params);

      case 'ping':
        return handlePing(id);

      case 'tools/list':
        return handleToolsList(id);

      case 'tools/call':
        return await handleToolsCall(id, params, context);

      case 'resources/list':
        return await handleResourcesList(id);

      case 'resources/read':
        return await handleResourcesRead(id, params, context);

      case 'notifications/initialized':
        // Client notification - no response needed
        return { jsonrpc: '2.0', id: null, result: {} };

      default:
        return {
          jsonrpc: '2.0',
          id: id ?? null,
          error: {
            code: MCP_ERRORS.METHOD_NOT_FOUND,
            message: `Method not found: ${method}`,
          },
        };
    }
  } catch (error) {
    console.error(`[MCP Server] Error handling ${method}:`, error);
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      error: {
        code: MCP_ERRORS.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : 'Internal error',
      },
    };
  }
}

/**
 * Handle initialize method
 */
function handleInitialize(
  id: string | number | null | undefined,
  params?: Record<string, unknown>
): JsonRpcResponse {
  const config = getConfig();
  const appName = config.app?.name || 'Chat SaaS';

  return {
    jsonrpc: '2.0',
    id: id ?? null,
    result: {
      protocolVersion: '2024-11-05',
      serverInfo: {
        name: appName,
        version: '1.0.0',
      },
      capabilities: {
        tools: {},
        resources: {},
      },
    },
  };
}

/**
 * Handle ping method
 */
function handlePing(id: string | number | null | undefined): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    result: {},
  };
}

/**
 * Handle tools/list method
 */
function handleToolsList(id: string | number | null | undefined): JsonRpcResponse {
  const tools = getExposedTools();

  return {
    jsonrpc: '2.0',
    id: id ?? null,
    result: {
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        _meta: tool._meta,
      })),
    },
  };
}

/**
 * Handle tools/call method
 */
async function handleToolsCall(
  id: string | number | null | undefined,
  params: Record<string, unknown> | undefined,
  context: MCPServerContext
): Promise<JsonRpcResponse> {
  if (!params?.name || typeof params.name !== 'string') {
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      error: {
        code: MCP_ERRORS.INVALID_PARAMS,
        message: 'Missing required parameter: name',
      },
    };
  }

  const toolName = params.name;
  const args = (params.arguments as Record<string, unknown>) || {};

  if (!hasScope(context.scopes, 'mcp:tools')) {
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      error: {
        code: MCP_ERRORS.INVALID_PARAMS,
        message: 'Insufficient scope: mcp:tools required',
      },
    };
  }

  // Check if tool is exposed
  const exposedTools = getExposedTools();
  const tool = exposedTools.find((t) => t.name === toolName);

  if (!tool) {
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      error: {
        code: MCP_ERRORS.INVALID_PARAMS,
        message: `Tool not found: ${toolName}`,
      },
    };
  }

  console.log(`[MCP Server] Executing tool: ${toolName}`);

  // Execute the native tool
  const result = await executeNativeTool(toolName, args, {
    userId: context.userId,
    threadId: undefined,
    agentId: undefined,
  });

  return {
    jsonrpc: '2.0',
    id: id ?? null,
    result: {
      content: result.content,
      isError: result.isError,
      structuredContent: result.structuredContent,
    },
  };
}

/**
 * Handle resources/list method
 */
async function handleResourcesList(
  id: string | number | null | undefined
): Promise<JsonRpcResponse> {
  const resources = await getMCPResources();

  return {
    jsonrpc: '2.0',
    id: id ?? null,
    result: {
      resources,
    },
  };
}

/**
 * Handle resources/read method
 */
async function handleResourcesRead(
  id: string | number | null | undefined,
  params: Record<string, unknown> | undefined,
  context: MCPServerContext
): Promise<JsonRpcResponse> {
  if (!params?.uri || typeof params.uri !== 'string') {
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      error: {
        code: MCP_ERRORS.INVALID_PARAMS,
        message: 'Missing required parameter: uri',
      },
    };
  }

  if (!hasScope(context.scopes, 'mcp:resources')) {
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      error: {
        code: MCP_ERRORS.INVALID_PARAMS,
        message: 'Insufficient scope: mcp:resources required',
      },
    };
  }

  const uri = params.uri;
  const result = await readMCPResource(uri, context);

  if (!result) {
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      error: {
        code: MCP_ERRORS.INVALID_PARAMS,
        message: `Resource not found: ${uri}`,
      },
    };
  }

  // Get resource metadata
  const resources = await getMCPResources();
  const resourceMeta = resources.find((r) => r.uri === uri);

  return {
    jsonrpc: '2.0',
    id: id ?? null,
    result: {
      contents: [
        {
          uri,
          mimeType: resourceMeta?.mimeType || 'text/plain',
          text: result.text,
          blob: result.blob,
        },
      ],
    },
  };
}

function hasScope(scopes: string[] | undefined, required: string): boolean {
  if (!scopes || scopes.length === 0) {
    return true; // API keys or tokens without scopes default to full access
  }
  return scopes.includes(required);
}

/**
 * Parse and validate a JSON-RPC request
 */
export function parseJsonRpcRequest(body: unknown): JsonRpcRequest | JsonRpcError {
  if (!body || typeof body !== 'object') {
    return {
      code: MCP_ERRORS.PARSE_ERROR,
      message: 'Invalid JSON',
    };
  }

  const req = body as Record<string, unknown>;

  if (req.jsonrpc !== '2.0') {
    return {
      code: MCP_ERRORS.INVALID_REQUEST,
      message: 'Invalid JSON-RPC version',
    };
  }

  if (typeof req.method !== 'string') {
    return {
      code: MCP_ERRORS.INVALID_REQUEST,
      message: 'Missing or invalid method',
    };
  }

  return {
    jsonrpc: '2.0',
    id: req.id as string | number | null | undefined,
    method: req.method,
    params: req.params as Record<string, unknown> | undefined,
  };
}

/**
 * Create an error response for parse/validation errors
 */
export function createErrorResponse(error: JsonRpcError): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id: null,
    error,
  };
}
