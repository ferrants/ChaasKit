#!/usr/bin/env node
import { Command } from 'commander';
import { init } from './commands/init.js';
import { dev } from './commands/dev.js';
import { build } from './commands/build.js';
import { dbSync } from './commands/db-sync.js';
import { addInfra } from './commands/add-infra.js';

const program = new Command();

program
  .name('chaaskit')
  .description('Create and manage ChaasKit applications')
  .version('0.1.0');

// Create a new project
program
  .command('create [project-name]')
  .description('Create a new ChaasKit project')
  .option('--template <template>', 'Template to use', 'default')
  .option('--skip-install', 'Skip dependency installation')
  .option('--use-npm', 'Use npm instead of pnpm')
  .option('--use-yarn', 'Use yarn instead of pnpm')
  .action(async (projectName, options) => {
    await init(projectName, options);
  });

// Dev server (for use inside a project)
program
  .command('dev')
  .description('Start development servers')
  .option('-p, --port <port>', 'Backend port', '3000')
  .option('--client-port <port>', 'Frontend port', '5173')
  .action(async (options) => {
    await dev(options);
  });

// Build (for use inside a project)
program
  .command('build')
  .description('Build for production')
  .action(async () => {
    await build();
  });

// Sync database schema
program
  .command('db:sync')
  .description('Sync Prisma schema from @chaaskit/db (preserves custom models)')
  .option('-f, --force', 'Force update of modified core models')
  .action(async (options) => {
    await dbSync(options);
  });

// Add infrastructure-as-code
program
  .command('add-infra <provider>')
  .description('Add infrastructure-as-code to your project (aws)')
  .option('-n, --service-name <name>', 'Service name for AWS resources')
  .action(async (provider, options) => {
    await addInfra(provider, options);
  });

program.parse();
