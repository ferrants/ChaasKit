import fs from 'fs/promises';
import path from 'path';

/**
 * Simple glob implementation for matching files.
 * Supports basic patterns like *.ts, *.js, *.{ts,js}
 */
export async function glob(pattern: string): Promise<string[]> {
  const dir = path.dirname(pattern);
  const filePattern = path.basename(pattern);

  // Parse the pattern
  let regex: RegExp;
  if (filePattern.includes('{')) {
    // Handle {ts,js} style patterns
    const match = filePattern.match(/^(.*)\.?\{([^}]+)\}$/);
    if (match) {
      const [, prefix, extensions] = match;
      const extList = extensions.split(',').map(e => e.trim());
      const escapedPrefix = prefix ? escapeRegex(prefix) : '';
      regex = new RegExp(`^${escapedPrefix}.*\\.(${extList.join('|')})$`);
    } else {
      regex = patternToRegex(filePattern);
    }
  } else {
    regex = patternToRegex(filePattern);
  }

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const matches: string[] = [];

    for (const entry of entries) {
      if (entry.isFile() && regex.test(entry.name)) {
        matches.push(path.join(dir, entry.name));
      }
    }

    return matches;
  } catch {
    return [];
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function patternToRegex(pattern: string): RegExp {
  // Convert glob pattern to regex
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special chars except * and ?
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regexStr}$`);
}
