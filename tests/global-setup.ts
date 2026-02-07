import path from 'path';
import { execFileSync } from 'child_process';

export default async function globalSetup(): Promise<void> {
  const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL is not set. Set TEST_DATABASE_URL or DATABASE_URL to a Postgres test database before running tests.'
    );
  }

  const prismaBin = path.resolve('packages/db/node_modules/.bin/prisma');
  const schemaPath = path.resolve('packages/db/prisma/schema');

  execFileSync(prismaBin, ['generate', '--schema', schemaPath], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
    cwd: path.resolve('packages/db'),
  });

  execFileSync(prismaBin, ['db', 'push', '--schema', schemaPath], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
    cwd: path.resolve('packages/db'),
  });
}
