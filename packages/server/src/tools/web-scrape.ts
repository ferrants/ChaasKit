import type { NativeTool, ToolResult, ToolContext } from './types.js';

/**
 * Converts HTML to plain text by stripping tags and normalizing whitespace
 */
function htmlToText(html: string): string {
  return html
    // Remove script and style elements entirely
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Replace block elements with newlines
    .replace(/<\/(p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, '\n')
    .replace(/<(br|hr)[^>]*\/?>/gi, '\n')
    // Remove remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    // Normalize whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
}

/**
 * Truncates text to a maximum length, preserving word boundaries
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.8) {
    return truncated.slice(0, lastSpace) + '...';
  }

  return truncated + '...';
}

export const webScrapeTool: NativeTool = {
  name: 'web-scrape',

  description: 'Fetches the content of a web page and returns it as plain text. Useful for reading articles, documentation, or any web content.',

  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL of the web page to fetch',
      },
      maxLength: {
        type: 'number',
        description: 'Maximum number of characters to return (default: 50000)',
        default: 50000,
      },
    },
    required: ['url'],
  },

  async execute(input: Record<string, unknown>, _context: ToolContext): Promise<ToolResult> {
    const url = input.url as string;
    const maxLength = (input.maxLength as number) || 50000;

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return {
        content: [{ type: 'text', text: `Invalid URL: ${url}` }],
        isError: true,
      };
    }

    // Only allow http/https
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return {
        content: [{ type: 'text', text: `Invalid protocol: ${parsedUrl.protocol}. Only http and https are allowed.` }],
        isError: true,
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ChatBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return {
          content: [{ type: 'text', text: `HTTP error: ${response.status} ${response.statusText}` }],
          isError: true,
        };
      }

      const contentType = response.headers.get('content-type') || '';

      // Handle different content types
      if (contentType.includes('application/json')) {
        const json = await response.json();
        const text = JSON.stringify(json, null, 2);
        return {
          content: [{
            type: 'text',
            text: truncateText(text, maxLength),
          }],
        };
      }

      if (contentType.includes('text/plain')) {
        const text = await response.text();
        return {
          content: [{
            type: 'text',
            text: truncateText(text, maxLength),
          }],
        };
      }

      // Default: treat as HTML
      const html = await response.text();
      const text = htmlToText(html);

      return {
        content: [{
          type: 'text',
          text: truncateText(text, maxLength),
        }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message.includes('abort')) {
        return {
          content: [{ type: 'text', text: 'Request timed out after 30 seconds' }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: `Failed to fetch URL: ${message}` }],
        isError: true,
      };
    }
  },
};
