import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Convert project name to database name (replace dashes/spaces with underscores, lowercase)
function toDbName(name: string): string {
  return name.toLowerCase().replace(/[-\s]+/g, '_');
}

interface InitOptions {
  template?: string;
  skipInstall?: boolean;
  useNpm?: boolean;
  useYarn?: boolean;
}

export async function init(projectName: string | undefined, options: InitOptions): Promise<void> {
  console.log();
  console.log(chalk.bold('🚀 Create ChaasKit App'));
  console.log();

  // Prompt for project name if not provided
  if (!projectName) {
    const response = await prompts({
      type: 'text',
      name: 'projectName',
      message: 'What is your project named?',
      initial: 'my-chat-app',
    });

    if (!response.projectName) {
      console.log(chalk.red('Project name is required'));
      process.exit(1);
    }

    projectName = response.projectName;
  }

  // At this point projectName is guaranteed to be defined
  const finalProjectName = projectName as string;
  const projectPath = path.resolve(process.cwd(), finalProjectName);

  // Check if directory exists
  if (await fs.pathExists(projectPath)) {
    const response = await prompts({
      type: 'confirm',
      name: 'overwrite',
      message: `Directory ${finalProjectName} already exists. Overwrite?`,
      initial: false,
    });

    if (!response.overwrite) {
      console.log(chalk.yellow('Aborted.'));
      process.exit(0);
    }

    await fs.remove(projectPath);
  }

  // Create project directory
  await fs.ensureDir(projectPath);

  const spinner = ora('Creating project files...').start();

  try {
    // Copy template files
    const templatesPath = path.join(__dirname, '../templates');
    await copyTemplateFiles(templatesPath, projectPath, finalProjectName);

    spinner.succeed('Project files created');

    // Determine package manager
    const packageManager = options.useYarn ? 'yarn' : options.useNpm ? 'npm' : 'pnpm';

    // Install dependencies
    if (!options.skipInstall) {
      const installSpinner = ora(`Installing dependencies with ${packageManager}...`).start();

      try {
        await runCommand(packageManager, ['install'], { cwd: projectPath });
        installSpinner.succeed('Dependencies installed');
      } catch (error) {
        installSpinner.fail('Failed to install dependencies');
        console.log(chalk.yellow(`\nYou can install dependencies manually by running:`));
        console.log(chalk.cyan(`  cd ${finalProjectName}`));
        console.log(chalk.cyan(`  ${packageManager} install`));
      }
    }

    // Print success message
    console.log();
    console.log(chalk.green('✅ Success!') + ` Created ${finalProjectName} at ${projectPath}`);
    console.log();
    console.log('Inside that directory, you can run:');
    console.log();
    console.log(chalk.cyan(`  ${packageManager} dev`));
    console.log('    Starts the development servers');
    console.log();
    console.log(chalk.cyan(`  ${packageManager} build`));
    console.log('    Builds the app for production');
    console.log();
    console.log(chalk.cyan(`  ${packageManager} db:push`));
    console.log('    Push database schema changes');
    console.log();
    console.log('We suggest that you begin by:');
    console.log();
    console.log(chalk.cyan(`  cd ${finalProjectName}`));
    console.log(chalk.cyan('  cp .env.example .env'));
    console.log(chalk.cyan('  # Edit .env with your DATABASE_URL and API keys'));
    console.log(chalk.cyan(`  ${packageManager} db:push`));
    console.log(chalk.cyan(`  ${packageManager} dev`));
    console.log();

  } catch (error) {
    spinner.fail('Failed to create project');
    throw error;
  }
}

async function copyTemplateFiles(templatesPath: string, targetPath: string, projectName: string): Promise<void> {
  // Create directory structure for React Router v7 app
  await fs.ensureDir(path.join(targetPath, 'app', 'routes'));
  await fs.ensureDir(path.join(targetPath, 'app', 'components'));
  await fs.ensureDir(path.join(targetPath, 'app', 'pages'));
  await fs.ensureDir(path.join(targetPath, 'config'));
  await fs.ensureDir(path.join(targetPath, 'extensions', 'agents'));
  await fs.ensureDir(path.join(targetPath, 'extensions', 'payment-plans'));
  await fs.ensureDir(path.join(targetPath, 'extensions', 'pages'));
  await fs.ensureDir(path.join(targetPath, 'prisma', 'schema'));
  await fs.ensureDir(path.join(targetPath, 'public'));

  // Copy template files
  // Note: Client wrapper components (*Client.tsx) and documentation files are now
  // provided by @chaaskit/client package - routes import directly from there.
  const templates: Array<{ src: string; dest: string; transform?: (content: string) => string }> = [
    // React Router app files
    { src: 'app/routes.ts', dest: 'app/routes.ts' },
    { src: 'app/root.tsx', dest: 'app/root.tsx' },
    { src: 'app/entry.client.tsx', dest: 'app/entry.client.tsx' },
    { src: 'app/entry.server.tsx', dest: 'app/entry.server.tsx' },
    // ClientOnly re-export for convenience
    { src: 'app/components/ClientOnly.tsx', dest: 'app/components/ClientOnly.tsx' },
    // Public routes (no basePath prefix)
    { src: 'app/routes/_index.tsx', dest: 'app/routes/_index.tsx' },
    { src: 'app/routes/login.tsx', dest: 'app/routes/login.tsx' },
    { src: 'app/routes/register.tsx', dest: 'app/routes/register.tsx' },
    { src: 'app/routes/shared.$shareId.tsx', dest: 'app/routes/shared.$shareId.tsx' },
    { src: 'app/routes/terms.tsx', dest: 'app/routes/terms.tsx' },
    { src: 'app/routes/privacy.tsx', dest: 'app/routes/privacy.tsx' },
    { src: 'app/routes/verify-email.tsx', dest: 'app/routes/verify-email.tsx' },
    { src: 'app/routes/invite.$token.tsx', dest: 'app/routes/invite.$token.tsx' },
    { src: 'app/routes/pricing.tsx', dest: 'app/routes/pricing.tsx' },
    { src: 'app/routes/oauth.consent.tsx', dest: 'app/routes/oauth.consent.tsx' },
    // Authenticated routes (under basePath, e.g., /chat/*)
    // Layout route that handles authentication for all chat.* routes
    { src: 'app/routes/chat.tsx', dest: 'app/routes/chat.tsx' },
    { src: 'app/routes/chat._index.tsx', dest: 'app/routes/chat._index.tsx' },
    { src: 'app/routes/chat.thread.$threadId.tsx', dest: 'app/routes/chat.thread.$threadId.tsx' },
    { src: 'app/routes/chat.api-keys.tsx', dest: 'app/routes/chat.api-keys.tsx' },
    { src: 'app/routes/chat.documents.tsx', dest: 'app/routes/chat.documents.tsx' },
    { src: 'app/routes/chat.automations.tsx', dest: 'app/routes/chat.automations.tsx' },
    { src: 'app/routes/chat.team.$teamId.settings.tsx', dest: 'app/routes/chat.team.$teamId.settings.tsx' },
    { src: 'app/routes/chat.admin._index.tsx', dest: 'app/routes/chat.admin._index.tsx' },
    { src: 'app/routes/chat.admin.users.tsx', dest: 'app/routes/chat.admin.users.tsx' },
    { src: 'app/routes/chat.admin.teams._index.tsx', dest: 'app/routes/chat.admin.teams._index.tsx' },
    { src: 'app/routes/chat.admin.teams.$teamId.tsx', dest: 'app/routes/chat.admin.teams.$teamId.tsx' },
    // Config
    { src: 'config/app.config.ts', dest: 'config/app.config.ts' },
    { src: 'react-router.config.ts', dest: 'react-router.config.ts' },
    { src: 'vite.config.ts', dest: 'vite.config.ts' },
    // Extensions
    { src: 'extensions/agents/.gitkeep', dest: 'extensions/agents/.gitkeep' },
    { src: 'extensions/payment-plans/.gitkeep', dest: 'extensions/payment-plans/.gitkeep' },
    { src: 'extensions/pages/.gitkeep', dest: 'extensions/pages/.gitkeep' },
    // Public assets
    { src: 'public/logo.svg', dest: 'public/logo.svg' },
    { src: 'public/favicon.svg', dest: 'public/favicon.svg' },
    // Root files
    {
      src: '.env.example',
      dest: '.env.example',
      transform: (content) => content.replace(/\{\{DB_NAME\}\}/g, toDbName(projectName)),
    },
    { src: '.gitignore', dest: '.gitignore' },
    {
      src: 'package.json',
      dest: 'package.json',
      transform: (content) => content.replace(/\{\{PROJECT_NAME\}\}/g, projectName),
    },
    { src: 'tsconfig.json', dest: 'tsconfig.json' },
    { src: 'server.js', dest: 'server.js' },
    { src: 'README.md', dest: 'README.md', transform: (content) => content.replace(/\{\{PROJECT_NAME\}\}/g, projectName) },
    // Prisma
    { src: 'prisma/schema/base.prisma', dest: 'prisma/schema/base.prisma' },
    { src: 'prisma/schema/custom.prisma', dest: 'prisma/schema/custom.prisma' },
  ];

  for (const template of templates) {
    const srcPath = path.join(templatesPath, template.src);
    const destPath = path.join(targetPath, template.dest);

    if (await fs.pathExists(srcPath)) {
      let content = await fs.readFile(srcPath, 'utf-8');
      if (template.transform) {
        content = template.transform(content);
      }
      await fs.outputFile(destPath, content);
    } else {
      // Create empty file for .gitkeep files
      if (template.src.endsWith('.gitkeep')) {
        await fs.outputFile(destPath, '');
      }
    }
  }
}

function runCommand(command: string, args: string[], options: { cwd: string }): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    child.on('error', reject);
  });
}
