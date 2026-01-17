#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from multiple possible locations
const envPaths = [
  // Current working directory (user's project)
  path.resolve(process.cwd(), '.env'),
  // Monorepo root (when running in development)
  path.resolve(__dirname, '../../../../.env'),
];

for (const envPath of envPaths) {
  dotenv.config({ path: envPath });
}

// Check for subcommands
const command = process.argv[2];

if (command === 'db:sync') {
  // Handle db:sync command
  const force = process.argv.includes('--force') || process.argv.includes('-f');
  import('../commands/db-sync.js').then(({ dbSync }) => {
    dbSync({ force }).catch((error) => {
      console.error('Failed to sync schema:', error);
      process.exit(1);
    });
  });
} else if (command === 'help' || command === '--help' || command === '-h') {
  console.log(`
chaaskit-server - ChaasKit Server CLI

Usage:
  chaaskit-server              Start the server
  chaaskit-server db:sync      Sync Prisma schema from @chaaskit/db
  chaaskit-server help         Show this help message

Commands:
  db:sync     Sync the Prisma schema from @chaaskit/db to your project.
              Uses multi-file schema: base.prisma (core) + custom.prisma (your models).
              Only base.prisma is updated; custom.prisma is preserved.

Examples:
  chaaskit-server db:sync
  chaaskit-server db:sync --force
`);
} else {
  // Default: start the server
  import('../server.js').then(({ startServer }) => {
    startServer().catch((error) => {
      console.error('Failed to start server:', error);
      process.exit(1);
    });
  });
}
