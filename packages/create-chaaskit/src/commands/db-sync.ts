import fs from 'fs/promises';
import path from 'path';

/**
 * Sync the Prisma schema from @chaaskit/db to the project.
 * Uses Prisma's multi-file schema feature (prismaSchemaFolder).
 *
 * This command:
 * - Copies base.prisma from the package (overwrites existing)
 * - Creates custom.prisma if it doesn't exist (never overwrites)
 * - Preserves any other .prisma files in the schema directory
 */
export async function dbSync(options: { force?: boolean } = {}): Promise<void> {
  const cwd = process.cwd();
  const targetSchemaDir = path.join(cwd, 'prisma', 'schema');

  // Find the source schema folder in node_modules
  const sourceSchemaDir = path.join(
    cwd,
    'node_modules',
    '@chaaskit',
    'db',
    'prisma',
    'schema'
  );

  const sourceBasePath = path.join(sourceSchemaDir, 'base.prisma');
  const sourceCustomPath = path.join(sourceSchemaDir, 'custom.prisma');
  const targetBasePath = path.join(targetSchemaDir, 'base.prisma');
  const targetCustomPath = path.join(targetSchemaDir, 'custom.prisma');

  // Check if source schema exists
  try {
    await fs.access(sourceBasePath);
  } catch {
    console.error('Error: @chaaskit/db package not found or has old schema format.');
    console.error('Make sure you have installed the latest dependencies: pnpm install');
    process.exit(1);
  }

  // Ensure target schema directory exists
  await fs.mkdir(targetSchemaDir, { recursive: true });

  // Check if this is a migration from single-file schema
  const oldSchemaPath = path.join(cwd, 'prisma', 'schema.prisma');
  let hadOldSchema = false;
  try {
    await fs.access(oldSchemaPath);
    hadOldSchema = true;
  } catch {
    // No old schema
  }

  // Check current state
  let targetBaseExists = false;
  let targetCustomExists = false;
  try {
    await fs.access(targetBasePath);
    targetBaseExists = true;
  } catch {
    // Base doesn't exist
  }
  try {
    await fs.access(targetCustomPath);
    targetCustomExists = true;
  } catch {
    // Custom doesn't exist
  }

  // Copy base.prisma (always overwrite)
  const sourceBaseContent = await fs.readFile(sourceBasePath, 'utf-8');
  let targetBaseContent = '';
  if (targetBaseExists) {
    targetBaseContent = await fs.readFile(targetBasePath, 'utf-8');
  }

  const baseChanged = sourceBaseContent !== targetBaseContent;

  if (baseChanged) {
    await fs.writeFile(targetBasePath, sourceBaseContent, 'utf-8');
    if (targetBaseExists) {
      console.log('Updated: prisma/schema/base.prisma');
    } else {
      console.log('Created: prisma/schema/base.prisma');
    }
  } else {
    console.log('No changes: prisma/schema/base.prisma is up to date');
  }

  // Create custom.prisma if it doesn't exist (never overwrite)
  if (!targetCustomExists) {
    const sourceCustomContent = await fs.readFile(sourceCustomPath, 'utf-8');
    await fs.writeFile(targetCustomPath, sourceCustomContent, 'utf-8');
    console.log('Created: prisma/schema/custom.prisma');
  } else {
    console.log('Preserved: prisma/schema/custom.prisma (your custom models)');
  }

  // Handle migration from old single-file schema
  if (hadOldSchema) {
    console.log('\n--- Migration Notice ---');
    console.log('Found old single-file schema: prisma/schema.prisma');
    console.log('');
    console.log('To migrate your custom models:');
    console.log('1. Open prisma/schema.prisma');
    console.log('2. Copy any custom models you added to prisma/schema/custom.prisma');
    console.log('3. Delete prisma/schema.prisma');
    console.log('');
    console.log('Note: Core models (User, Thread, etc.) are now in base.prisma.');
    console.log('Only copy models YOU created to custom.prisma.');
  }

  printNextSteps();
}

function printNextSteps(): void {
  console.log('\nNext steps:');
  console.log('  1. Run: pnpm db:generate');
  console.log('  2. Run: pnpm db:push');
  console.log('  3. Restart your dev server');
}
