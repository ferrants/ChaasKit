import { spawn, ChildProcess } from 'child_process';
import chalk from 'chalk';
import path from 'path';

interface DevOptions {
  port?: string;
  clientPort?: string;
}

export async function dev(options: DevOptions): Promise<void> {
  const port = options.port || '3000';
  const clientPort = options.clientPort || '5173';

  console.log();
  console.log(chalk.bold('🚀 Starting ChaasKit Development Server'));
  console.log();

  const processes: ChildProcess[] = [];

  // Handle cleanup
  const cleanup = () => {
    console.log(chalk.yellow('\nShutting down...'));
    processes.forEach(p => {
      if (!p.killed) {
        p.kill('SIGTERM');
      }
    });
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Start the backend server
  console.log(chalk.cyan(`Starting backend server on port ${port}...`));
  const serverProcess = spawn('npx', ['chaaskit-server'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      PORT: port,
    },
  });
  processes.push(serverProcess);

  // Start the frontend dev server
  console.log(chalk.cyan(`Starting frontend server on port ${clientPort}...`));

  // Check if there's a local vite config, otherwise use the one from core-client
  const viteProcess = spawn('npx', ['vite', '--host', '--port', clientPort], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      VITE_API_URL: `http://localhost:${port}`,
    },
  });
  processes.push(viteProcess);

  // Wait for processes to exit
  serverProcess.on('exit', (code) => {
    if (code !== 0) {
      console.log(chalk.red(`Server process exited with code ${code}`));
    }
  });

  viteProcess.on('exit', (code) => {
    if (code !== 0) {
      console.log(chalk.red(`Vite process exited with code ${code}`));
    }
  });

  // Keep the process running
  await new Promise(() => {});
}
