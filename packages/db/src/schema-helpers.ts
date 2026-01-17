import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get the path to the schema folder included with the package.
 * Uses Prisma's multi-file schema feature (prismaSchemaFolder).
 */
export function getSchemaFolderPath(): string {
  // When running from dist, schema is at ../prisma/schema/
  return path.resolve(__dirname, '../prisma/schema');
}

/**
 * Get the path to the base Prisma schema included with the package.
 * @deprecated Use getSchemaFolderPath() for multi-file schema support.
 */
export function getBaseSchemaPath(): string {
  return path.join(getSchemaFolderPath(), 'base.prisma');
}

/**
 * Get the content of the base Prisma schema.
 */
export async function getBaseSchemaContent(): Promise<string> {
  const schemaPath = getBaseSchemaPath();
  return fs.readFile(schemaPath, 'utf-8');
}

/**
 * Get the content of the custom schema template.
 */
export async function getCustomSchemaContent(): Promise<string> {
  const schemaPath = path.join(getSchemaFolderPath(), 'custom.prisma');
  return fs.readFile(schemaPath, 'utf-8');
}

/**
 * Copy the schema folder to a target directory.
 * Creates the prisma/schema directory if it doesn't exist.
 * Only overwrites base.prisma, preserves custom.prisma if it exists.
 *
 * @param targetDir - Directory where prisma/schema/ will be created
 * @returns Object with paths to the copied schemas
 */
export async function copySchemaToProject(
  targetDir: string
): Promise<{ basePath: string; customPath: string; customCreated: boolean }> {
  const sourceFolder = getSchemaFolderPath();
  const targetFolder = path.join(targetDir, 'prisma', 'schema');

  // Ensure target directory exists
  await fs.mkdir(targetFolder, { recursive: true });

  const sourceBasePath = path.join(sourceFolder, 'base.prisma');
  const sourceCustomPath = path.join(sourceFolder, 'custom.prisma');
  const targetBasePath = path.join(targetFolder, 'base.prisma');
  const targetCustomPath = path.join(targetFolder, 'custom.prisma');

  // Always copy base.prisma (overwrites)
  await fs.copyFile(sourceBasePath, targetBasePath);

  // Only copy custom.prisma if it doesn't exist
  let customCreated = false;
  try {
    await fs.access(targetCustomPath);
  } catch {
    await fs.copyFile(sourceCustomPath, targetCustomPath);
    customCreated = true;
  }

  return { basePath: targetBasePath, customPath: targetCustomPath, customCreated };
}

/**
 * Check if a Prisma schema exists in the target directory.
 * Checks for both single-file (legacy) and multi-file schema formats.
 */
export async function schemaExists(targetDir: string): Promise<boolean> {
  // Check for new multi-file schema
  const schemaFolderPath = path.join(targetDir, 'prisma', 'schema', 'base.prisma');
  try {
    await fs.access(schemaFolderPath);
    return true;
  } catch {
    // Check for legacy single-file schema
    const legacyPath = path.join(targetDir, 'prisma', 'schema.prisma');
    try {
      await fs.access(legacyPath);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Check if the target directory has a legacy single-file schema.
 */
export async function hasLegacySchema(targetDir: string): Promise<boolean> {
  const legacyPath = path.join(targetDir, 'prisma', 'schema.prisma');
  try {
    await fs.access(legacyPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Initialize Prisma in a project directory.
 * Copies the schema files if they don't already exist.
 *
 * @param targetDir - Project directory
 * @param options.force - If true, overwrites existing base.prisma
 * @returns Object with result information
 */
export async function initializePrisma(
  targetDir: string,
  options: { force?: boolean } = {}
): Promise<{
  basePath: string;
  customPath: string;
  baseCreated: boolean;
  customCreated: boolean;
  hadLegacySchema: boolean;
}> {
  const targetFolder = path.join(targetDir, 'prisma', 'schema');
  const targetBasePath = path.join(targetFolder, 'base.prisma');
  const targetCustomPath = path.join(targetFolder, 'custom.prisma');

  const hadLegacySchema = await hasLegacySchema(targetDir);

  // Check if base already exists
  let baseExists = false;
  try {
    await fs.access(targetBasePath);
    baseExists = true;
  } catch {
    // Base doesn't exist
  }

  if (baseExists && !options.force) {
    // Check custom exists
    let customExists = false;
    try {
      await fs.access(targetCustomPath);
      customExists = true;
    } catch {
      // Custom doesn't exist
    }

    // Create custom if missing
    if (!customExists) {
      const customContent = await getCustomSchemaContent();
      await fs.mkdir(targetFolder, { recursive: true });
      await fs.writeFile(targetCustomPath, customContent);
    }

    return {
      basePath: targetBasePath,
      customPath: targetCustomPath,
      baseCreated: false,
      customCreated: !customExists,
      hadLegacySchema,
    };
  }

  const result = await copySchemaToProject(targetDir);
  return {
    basePath: result.basePath,
    customPath: result.customPath,
    baseCreated: true,
    customCreated: result.customCreated,
    hadLegacySchema,
  };
}
