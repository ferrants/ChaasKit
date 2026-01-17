import { spawn } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs-extra';

export async function build(): Promise<void> {
  console.log();
  console.log(chalk.bold('🏗️  Building ChaasKit Application'));
  console.log();

  const cwd = process.cwd();

  // Build steps
  const steps = [
    {
      name: 'Type checking',
      command: 'npx',
      args: ['tsc', '--noEmit'],
    },
    {
      name: 'Building client',
      command: 'npx',
      args: ['vite', 'build'],
    },
  ];

  for (const step of steps) {
    const spinner = ora(step.name + '...').start();

    try {
      await runCommand(step.command, step.args, { cwd });
      spinner.succeed(step.name);
    } catch (error) {
      spinner.fail(step.name);
      console.error(chalk.red(`\nBuild failed during: ${step.name}`));
      process.exit(1);
    }
  }

  console.log();
  console.log(chalk.green('✅ Build complete!'));
  console.log();
  console.log('To start the production server, run:');
  console.log(chalk.cyan('  NODE_ENV=production npx chaaskit-server'));
  console.log();
}

function runCommand(command: string, args: string[], options: { cwd: string }): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      stdio: 'pipe',
      shell: true,
    });

    let stderr = '';

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || `Command failed with code ${code}`));
      }
    });

    child.on('error', reject);
  });
}
