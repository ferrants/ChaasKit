// Use default import for CJS/ESM interop with @prisma/client
import PrismaClientPkg from '@prisma/client';
const { PrismaClient } = PrismaClientPkg;

declare global {
  // eslint-disable-next-line no-var
  var prisma: InstanceType<typeof PrismaClient> | undefined;
}

export const prisma = globalThis.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

// Re-export Prisma namespace and types
export const Prisma = PrismaClientPkg.Prisma;
export type { PrismaClient } from '@prisma/client';
export { prisma as db };

// Schema helpers for project setup
export {
  getSchemaFolderPath,
  getBaseSchemaPath,
  getBaseSchemaContent,
  getCustomSchemaContent,
  copySchemaToProject,
  schemaExists,
  hasLegacySchema,
  initializePrisma,
} from './schema-helpers.js';
