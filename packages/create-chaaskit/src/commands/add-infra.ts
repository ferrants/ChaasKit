import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import ora from 'ora';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface AddInfraOptions {
  serviceName?: string;
}

export async function addInfra(provider: string, options: AddInfraOptions): Promise<void> {
  console.log();
  console.log(chalk.bold('☁️  Add Infrastructure'));
  console.log();

  // Validate provider
  const supportedProviders = ['aws'];
  if (!supportedProviders.includes(provider)) {
    console.log(chalk.red(`Unknown provider: ${provider}`));
    console.log(chalk.yellow(`Supported providers: ${supportedProviders.join(', ')}`));
    process.exit(1);
  }

  // Check if we're in a ChaasKit project
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (!await fs.pathExists(packageJsonPath)) {
    console.log(chalk.red('Not in a ChaasKit project directory.'));
    console.log(chalk.yellow('Run this command from your project root.'));
    process.exit(1);
  }

  const targetPath = path.join(process.cwd(), 'cdk');

  // Check if cdk directory already exists
  if (await fs.pathExists(targetPath)) {
    console.log(chalk.yellow('⚠️  The cdk/ directory already exists.'));
    console.log(chalk.yellow('Remove it first if you want to regenerate: rm -rf cdk'));
    process.exit(1);
  }

  const spinner = ora('Adding AWS CDK infrastructure...').start();

  try {
    // Copy CDK template files
    const templatesPath = path.join(__dirname, '../templates/infra-aws');
    await copyInfraTemplates(templatesPath, targetPath, options.serviceName);

    // Update .gitignore
    await updateGitignore();

    spinner.succeed('AWS CDK infrastructure added to ./cdk/');

    // Print next steps
    console.log();
    console.log(chalk.green('✅ Infrastructure code added!'));
    console.log();
    console.log('Next steps:');
    console.log();
    console.log(chalk.cyan('  1. Configure deployment:'));
    console.log('     Edit cdk/config/deployment.ts with your settings');
    console.log();
    console.log(chalk.cyan('  2. Install CDK dependencies:'));
    console.log('     cd cdk && npm install');
    console.log();
    console.log(chalk.cyan('  3. Bootstrap CDK (first time only):'));
    console.log('     npx cdk bootstrap aws://ACCOUNT_ID/REGION');
    console.log();
    console.log(chalk.cyan('  4. Deploy:'));
    console.log('     npm run deploy');
    console.log();
    console.log(chalk.dim('See cdk/README.md for detailed instructions.'));
    console.log();

  } catch (error) {
    spinner.fail('Failed to add infrastructure');
    throw error;
  }
}

async function copyInfraTemplates(templatesPath: string, targetPath: string, serviceName?: string): Promise<void> {
  // Create directory structure
  await fs.ensureDir(path.join(targetPath, 'bin'));
  await fs.ensureDir(path.join(targetPath, 'lib'));
  await fs.ensureDir(path.join(targetPath, 'config'));
  await fs.ensureDir(path.join(targetPath, 'scripts'));
  await fs.ensureDir(path.join(targetPath, '.github', 'workflows'));

  // Detect service name from package.json if not provided
  let finalServiceName: string;
  if (serviceName) {
    finalServiceName = serviceName;
  } else {
    try {
      const pkg = await fs.readJson(path.join(process.cwd(), 'package.json'));
      finalServiceName = pkg.name || 'my-chaaskit-app';
    } catch {
      finalServiceName = 'my-chaaskit-app';
    }
  }

  // Sanitize service name for AWS (lowercase, alphanumeric + hyphens only)
  const sanitizedServiceName = finalServiceName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const templates: Array<{ src: string; dest: string; transform?: (content: string) => string }> = [
    // CDK entry point
    { src: 'bin/cdk.ts', dest: 'bin/cdk.ts' },
    // Main stack
    { src: 'lib/chaaskit-stack.ts', dest: 'lib/chaaskit-stack.ts' },
    // Configuration
    {
      src: 'config/deployment.ts',
      dest: 'config/deployment.ts',
      transform: (content) => content.replace(/\{\{SERVICE_NAME\}\}/g, sanitizedServiceName),
    },
    // Build script
    { src: 'scripts/build-app.sh', dest: 'scripts/build-app.sh' },
    // CDK config files
    { src: 'cdk.json', dest: 'cdk.json' },
    { src: 'tsconfig.json', dest: 'tsconfig.json' },
    { src: 'package.json', dest: 'package.json' },
    { src: 'README.md', dest: 'README.md' },
    // GitHub Actions workflow
    {
      src: '.github/workflows/deploy.yml',
      dest: '.github/workflows/deploy.yml',
      transform: (content) => content.replace(/\{\{SERVICE_NAME\}\}/g, sanitizedServiceName),
    },
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

      // Make shell scripts executable
      if (template.dest.endsWith('.sh')) {
        await fs.chmod(destPath, 0o755);
      }
    }
  }
}

async function updateGitignore(): Promise<void> {
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  const linesToAdd = [
    '',
    '# CDK',
    'cdk/cdk.out/',
    'cdk/node_modules/',
    '*.zip',
  ];

  try {
    let content = '';
    if (await fs.pathExists(gitignorePath)) {
      content = await fs.readFile(gitignorePath, 'utf-8');
    }

    // Check if CDK section already exists
    if (content.includes('# CDK')) {
      return;
    }

    content += linesToAdd.join('\n') + '\n';
    await fs.writeFile(gitignorePath, content);
  } catch {
    // Ignore errors updating .gitignore
  }
}
