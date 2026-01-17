import path from 'path';
import fs from 'fs/promises';
import { pathToFileURL } from 'url';
import { glob } from './glob.js';

/**
 * Check if a directory exists
 */
async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Simple glob implementation for finding extension files
 */
async function findExtensionFiles(pattern: string): Promise<string[]> {
  try {
    return await glob(pattern);
  } catch {
    return [];
  }
}

/**
 * Load extensions from the user's project directory.
 *
 * Extensions are loaded from:
 * - extensions/agents/*.{ts,js} - Custom AI agents
 * - extensions/payment-plans/*.{ts,js} - Custom pricing plans
 * - extensions/auth-providers/*.{ts,js} - Custom auth providers
 *
 * Extensions should register themselves with the registry when imported.
 *
 * @param basePath - Base directory to look for extensions. Defaults to process.cwd()
 */
export async function loadExtensions(basePath: string = process.cwd()): Promise<void> {
  const extensionDirs = [
    'extensions/agents',
    'extensions/payment-plans',
    'extensions/auth-providers',
    'extensions/mcp-resources',
  ];

  let loadedCount = 0;

  for (const dir of extensionDirs) {
    const fullPath = path.join(basePath, dir);

    if (!await directoryExists(fullPath)) {
      continue;
    }

    // Find all .ts and .js files (except index files)
    const files = await findExtensionFiles(path.join(fullPath, '*.{ts,js}'));
    const filteredFiles = files.filter(f => !path.basename(f).startsWith('index.'));

    for (const file of filteredFiles) {
      try {
        // Import the extension - it should self-register with the registry
        await import(pathToFileURL(file).href);
        loadedCount++;
        console.log(`[Extensions] Loaded: ${path.relative(basePath, file)}`);
      } catch (error) {
        console.error(`[Extensions] Failed to load ${file}:`, error instanceof Error ? error.message : error);
      }
    }
  }

  if (loadedCount > 0) {
    console.log(`[Extensions] Loaded ${loadedCount} extension(s)`);
  }
}
