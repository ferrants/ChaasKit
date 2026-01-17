import { useState } from 'react';
import { User, Users, FolderKanban, FileText, X } from 'lucide-react';
import type { DocumentScope } from '@chaaskit/shared';

interface MentionChipProps {
  path: string;
  onClick?: () => void;
}

// Parse path like "@my/doc-name" or "@team/engineering/doc-name"
function parseMentionPath(path: string): { scope: DocumentScope; scopeSlug?: string; name: string } | null {
  // Remove @ prefix if present
  const cleanPath = path.startsWith('@') ? path.slice(1) : path;
  const parts = cleanPath.split('/');

  if (parts.length < 2) return null;

  const scope = parts[0] as DocumentScope;
  if (!['my', 'team', 'project'].includes(scope)) return null;

  if (scope === 'my') {
    return { scope, name: parts.slice(1).join('/') };
  } else {
    // team/slug/name or project/slug/name
    if (parts.length < 3) return null;
    return { scope, scopeSlug: parts[1], name: parts.slice(2).join('/') };
  }
}

function getScopeIcon(scope: DocumentScope) {
  switch (scope) {
    case 'my':
      return User;
    case 'team':
      return Users;
    case 'project':
      return FolderKanban;
    default:
      return FileText;
  }
}

function getScopeColor(scope: DocumentScope) {
  switch (scope) {
    case 'my':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    case 'team':
      return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20';
    case 'project':
      return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
    default:
      return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20';
  }
}

export default function MentionChip({ path, onClick }: MentionChipProps) {
  const parsed = parseMentionPath(path);

  if (!parsed) {
    // Fallback: render as plain text if we can't parse
    return <span className="text-primary">{path}</span>;
  }

  const Icon = getScopeIcon(parsed.scope);
  const colorClass = getScopeColor(parsed.scope);

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border ${colorClass} ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
      title={path}
    >
      <Icon size={12} />
      <span className="max-w-[150px] truncate">{parsed.name}</span>
    </span>
  );
}

// Regex to match @scope/path patterns
// Matches: @my/name, @team/slug/name, @project/slug/name
const MENTION_REGEX = /@(my|team|project)\/[\w-]+(\/[\w-]+)*/g;

interface ParsedMentionSegment {
  type: 'text' | 'mention';
  content: string;
}

export function parseMentionsFromText(text: string): ParsedMentionSegment[] {
  const segments: ParsedMentionSegment[] = [];
  let lastIndex = 0;

  // Reset regex state
  MENTION_REGEX.lastIndex = 0;

  let match;
  while ((match = MENTION_REGEX.exec(text)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }

    // Add the mention
    segments.push({
      type: 'mention',
      content: match[0],
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return segments;
}

interface MessageContentWithMentionsProps {
  content: string;
  onMentionClick?: (path: string) => void;
}

export function MessageContentWithMentions({ content, onMentionClick }: MessageContentWithMentionsProps) {
  const segments = parseMentionsFromText(content);

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === 'mention') {
          return (
            <MentionChip
              key={index}
              path={segment.content}
              onClick={onMentionClick ? () => onMentionClick(segment.content) : undefined}
            />
          );
        }
        return <span key={index}>{segment.content}</span>;
      })}
    </>
  );
}
