import type { ManagedRoute } from './types.js';

interface InsertionResult {
  content: string;
  added: string[];
  manual: string[];
}

/**
 * Generate a route() call for routes.ts from a ManagedRoute entry.
 */
export function generateRouteCall(r: ManagedRoute): string {
  if (r.route.section === 'public') {
    return `  route('${r.route.path}', '${r.file}'),`;
  }
  if (r.route.path === '') {
    return `    route(base, '${r.file}'),`;
  }
  return `    route(\`\${base}/${r.route.path}\`, '${r.file}'),`;
}

/**
 * Insert missing route entries into routes.ts content.
 *
 * Parses the file structure to find:
 * - The layout('routes/chat.tsx' line (boundary between public/authenticated)
 * - The closing `]),` of the layout's children array
 *
 * Returns updated content plus lists of what was added and what needs manual insertion.
 */
export function insertRoutes(
  routesContent: string,
  missingRoutes: ManagedRoute[]
): InsertionResult {
  if (missingRoutes.length === 0) {
    return { content: routesContent, added: [], manual: [] };
  }

  const lines = routesContent.split('\n');
  const added: string[] = [];
  const manual: string[] = [];

  // Find the layout line: layout('routes/chat.tsx'
  let layoutLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/layout\s*\(\s*['"]routes\/chat\.tsx['"]/)) {
      layoutLineIdx = i;
      break;
    }
  }

  if (layoutLineIdx === -1) {
    // Can't find layout boundary - all routes need manual insertion
    for (const r of missingRoutes) {
      manual.push(generateRouteCall(r));
    }
    return { content: routesContent, added, manual };
  }

  // Find the closing `]),` of the layout's children array by tracking bracket depth
  let layoutCloseIdx = -1;
  let depth = 0;
  let foundOpenBracket = false;
  for (let i = layoutLineIdx; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '[') {
        depth++;
        foundOpenBracket = true;
      } else if (ch === ']') {
        depth--;
        if (foundOpenBracket && depth === 0) {
          layoutCloseIdx = i;
          break;
        }
      }
    }
    if (layoutCloseIdx !== -1) break;
  }

  if (layoutCloseIdx === -1) {
    // Can't find layout close - all routes need manual insertion
    for (const r of missingRoutes) {
      manual.push(generateRouteCall(r));
    }
    return { content: routesContent, added, manual };
  }

  // Separate missing routes into public and authenticated
  const publicRoutes = missingRoutes.filter((r) => r.route.section === 'public');
  const authRoutes = missingRoutes.filter((r) => r.route.section === 'authenticated');

  // Insert authenticated routes before the layout close line
  if (authRoutes.length > 0) {
    const authLines = authRoutes.map((r) => generateRouteCall(r));
    // Insert before layoutCloseIdx
    lines.splice(layoutCloseIdx, 0, ...authLines);
    added.push(...authRoutes.map((r) => r.file));
    // Adjust layoutCloseIdx for the inserted lines
    layoutCloseIdx += authLines.length;
    // Also adjust layoutLineIdx reference isn't needed since we insert public before it
  }

  // Recalculate layoutLineIdx after auth insertions (it may have shifted if auth was inserted before)
  // Actually auth routes are inserted after layoutLineIdx, so layoutLineIdx stays the same.

  // Insert public routes before the layout line
  if (publicRoutes.length > 0) {
    const publicLines = publicRoutes.map((r) => generateRouteCall(r));
    // Insert before layoutLineIdx (just before the layout block)
    lines.splice(layoutLineIdx, 0, ...publicLines);
    added.push(...publicRoutes.map((r) => r.file));
  }

  return { content: lines.join('\n'), added, manual };
}

/**
 * Check if a route file path already exists in routes.ts content.
 */
export function routeExistsInConfig(routesContent: string, filePath: string): boolean {
  return routesContent.includes(`'${filePath}'`) || routesContent.includes(`"${filePath}"`);
}
