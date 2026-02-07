import type { MCPContent } from '@chaaskit/shared';

export function getTextContent(content?: MCPContent[]): string | null {
  if (!content) return null;
  const firstText = content.find((item) => item.type === 'text' && typeof item.text === 'string');
  return firstText?.text ?? null;
}
