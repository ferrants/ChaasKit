import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath, pathToFileURL } from 'url';
import chalk from 'chalk';
import prompts from 'prompts';
import type { ManagedRoute } from '../lib/types.js';
import { generateWrapper, isThinWrapper } from '../lib/wrapper-gen.js';
import { insertRoutes, routeExistsInConfig } from '../lib/routes-updater.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SyncOptions {
  dryRun?: boolean;
  yes?: boolean;
}

interface RouteStatus {
  route: ManagedRoute;
  status: 'new' | 'updatable' | 'up-to-date' | 'customized';
  expected?: string;
  actual?: string;
}

interface FrameworkFileStatus {
  relativePath: string;
  status: 'new' | 'differs' | 'up-to-date';
  templateContent?: string;
  localContent?: string;
}

/**
 * The framework files that sync manages (these are files consumers shouldn't
 * normally customize, or should be kept in sync with the template).
 */
const FRAMEWORK_FILES = [
  'app/root.tsx',
  'app/entry.client.tsx',
  'app/entry.server.tsx',
  'app/components/ClientOnly.tsx',
  'server.js',
];

export async function sync(options: SyncOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const { dryRun, yes } = options;

  if (dryRun) {
    console.log(chalk.dim('(dry run — no files will be written)\n'));
  }

  // Step 1: Load route registry from installed @chaaskit/client
  const managedRoutes = await loadRouteRegistry(cwd);
  if (!managedRoutes) return;

  const clientPkg = await loadClientPackageVersion(cwd);
  console.log(
    `Reading route registry from ${chalk.cyan(`@chaaskit/client@${clientPkg}`)}...\n`
  );

  // Step 2: Check managed routes
  const routeStatuses = await checkManagedRoutes(cwd, managedRoutes);

  // Step 3: Check framework files
  const frameworkStatuses = await checkFrameworkFiles(cwd);

  // Step 4: Check routes.ts for missing entries
  const routesFilePath = path.join(cwd, 'app', 'routes.ts');
  let routesContent = '';
  let routesFileExists = false;
  try {
    routesContent = await fs.readFile(routesFilePath, 'utf-8');
    routesFileExists = true;
  } catch {
    // routes.ts doesn't exist
  }

  const missingFromRoutesTs = routesFileExists
    ? managedRoutes.filter((r) => !routeExistsInConfig(routesContent, r.file))
    : [];

  // Step 5: Present status
  const newRoutes = routeStatuses.filter((s) => s.status === 'new');
  const updatableRoutes = routeStatuses.filter((s) => s.status === 'updatable');
  const customizedRoutes = routeStatuses.filter((s) => s.status === 'customized');
  const upToDateRoutes = routeStatuses.filter((s) => s.status === 'up-to-date');

  const newFramework = frameworkStatuses.filter((s) => s.status === 'new');
  const differsFramework = frameworkStatuses.filter((s) => s.status === 'differs');
  const upToDateFramework = frameworkStatuses.filter((s) => s.status === 'up-to-date');

  if (newRoutes.length > 0) {
    console.log(chalk.green('New routes:'));
    for (const s of newRoutes) {
      console.log(`  ${chalk.green('+')} app/${s.route.file}  ${chalk.dim(s.route.title)}`);
    }
    console.log();
  }

  if (updatableRoutes.length > 0) {
    console.log(chalk.yellow('Updatable routes (thin wrappers with outdated content):'));
    for (const s of updatableRoutes) {
      console.log(`  ${chalk.yellow('~')} app/${s.route.file}  ${chalk.dim(s.route.title)}`);
    }
    console.log();
  }

  if (customizedRoutes.length > 0) {
    console.log(chalk.blue('User-customized routes (skipped):'));
    for (const s of customizedRoutes) {
      console.log(`  ${chalk.blue('•')} app/${s.route.file}  ${chalk.dim('(not a thin wrapper)')}`);
    }
    console.log();
  }

  if (differsFramework.length > 0 || newFramework.length > 0) {
    console.log(chalk.yellow('Framework updates:'));
    for (const s of newFramework) {
      console.log(`  ${chalk.green('+')} ${s.relativePath}  ${chalk.dim('(new)')}`);
    }
    for (const s of differsFramework) {
      console.log(`  ${chalk.yellow('~')} ${s.relativePath}  ${chalk.dim('(differs from template)')}`);
    }
    console.log();
  }

  // Only count routes that have their file AND are in routes.ts
  const missingOnlyFromRoutesTs = missingFromRoutesTs.filter((r) => {
    // Only show as missing from routes.ts if the file exists or will be created
    const routeStatus = routeStatuses.find((s) => s.route.file === r.file);
    return routeStatus && (routeStatus.status === 'up-to-date' || routeStatus.status === 'updatable' || routeStatus.status === 'customized');
  });

  if (missingOnlyFromRoutesTs.length > 0) {
    console.log(chalk.yellow('Missing from routes.ts:'));
    for (const r of missingOnlyFromRoutesTs) {
      console.log(`  ${chalk.yellow('+')} ${r.file}`);
    }
    console.log();
  }

  const totalUpToDate = upToDateRoutes.length + upToDateFramework.length;
  if (totalUpToDate > 0) {
    console.log(chalk.dim(`Up to date (${totalUpToDate} files)`));
    console.log();
  }

  // Check if there's anything to do
  const hasNewRoutes = newRoutes.length > 0;
  const hasUpdatableRoutes = updatableRoutes.length > 0;
  const hasFrameworkUpdates = differsFramework.length > 0 || newFramework.length > 0;
  const hasMissingRouteEntries =
    missingFromRoutesTs.length > 0 &&
    (hasNewRoutes || missingOnlyFromRoutesTs.length > 0);

  if (!hasNewRoutes && !hasUpdatableRoutes && !hasFrameworkUpdates && !hasMissingRouteEntries) {
    console.log(chalk.green('Everything is up to date!'));
    return;
  }

  if (dryRun) {
    console.log(chalk.dim('Dry run complete. No files were written.'));
    return;
  }

  // Step 6: Confirm and execute
  let createdRoutes = 0;
  let updatedRoutes = 0;
  let routesAddedToConfig = 0;
  let frameworkUpdated = 0;

  // Create new routes + update outdated thin wrappers
  if (hasNewRoutes || hasUpdatableRoutes) {
    const routeActions = [
      ...(hasNewRoutes ? [`create ${newRoutes.length} new route(s)`] : []),
      ...(hasUpdatableRoutes ? [`update ${updatableRoutes.length} outdated wrapper(s)`] : []),
    ];
    const routeMsg = `${routeActions.join(' and ')}${hasNewRoutes ? ' (and add to routes.ts)' : ''}`;

    let confirm = yes;
    if (!confirm) {
      const response = await prompts({
        type: 'confirm',
        name: 'value',
        message: `${routeMsg}?`,
        initial: true,
      });
      confirm = response.value;
    }

    if (confirm) {
      for (const s of newRoutes) {
        const filePath = path.join(cwd, 'app', s.route.file);
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, s.expected!, 'utf-8');
        createdRoutes++;
      }

      for (const s of updatableRoutes) {
        const filePath = path.join(cwd, 'app', s.route.file);
        await fs.writeFile(filePath, s.expected!, 'utf-8');
        updatedRoutes++;
      }

      // Update routes.ts with new route entries
      if (routesFileExists && newRoutes.length > 0) {
        // Re-read routes.ts (in case it changed)
        routesContent = await fs.readFile(routesFilePath, 'utf-8');

        const newRoutesToAdd = newRoutes
          .map((s) => s.route)
          .filter((r) => !routeExistsInConfig(routesContent, r.file));

        if (newRoutesToAdd.length > 0) {
          const result = insertRoutes(routesContent, newRoutesToAdd);
          if (result.added.length > 0) {
            await fs.writeFile(routesFilePath, result.content, 'utf-8');
            routesAddedToConfig = result.added.length;
          }
          if (result.manual.length > 0) {
            console.log();
            console.log(
              chalk.yellow(
                'Could not auto-insert these routes (routes.ts structure not recognized):'
              )
            );
            console.log(chalk.yellow('Add them manually to app/routes.ts:'));
            console.log();
            for (const line of result.manual) {
              console.log(`  ${line}`);
            }
            console.log();
          }
        }
      }
    }
  }

  // Also handle routes that exist as files but are missing from routes.ts
  if (missingOnlyFromRoutesTs.length > 0 && routesFileExists) {
    let confirm = yes;
    if (!confirm) {
      const response = await prompts({
        type: 'confirm',
        name: 'value',
        message: `Add ${missingOnlyFromRoutesTs.length} existing route(s) to routes.ts?`,
        initial: true,
      });
      confirm = response.value;
    }

    if (confirm) {
      routesContent = await fs.readFile(routesFilePath, 'utf-8');
      const toAdd = missingOnlyFromRoutesTs.filter(
        (r) => !routeExistsInConfig(routesContent, r.file)
      );
      if (toAdd.length > 0) {
        const result = insertRoutes(routesContent, toAdd);
        if (result.added.length > 0) {
          await fs.writeFile(routesFilePath, result.content, 'utf-8');
          routesAddedToConfig += result.added.length;
        }
        if (result.manual.length > 0) {
          console.log();
          console.log(
            chalk.yellow('Add these routes manually to app/routes.ts:')
          );
          for (const line of result.manual) {
            console.log(`  ${line}`);
          }
          console.log();
        }
      }
    }
  }

  // Framework file updates
  if (hasFrameworkUpdates) {
    let confirm = yes;
    if (!confirm) {
      const response = await prompts({
        type: 'confirm',
        name: 'value',
        message: `Update ${differsFramework.length + newFramework.length} framework file(s)?`,
        initial: true,
      });
      confirm = response.value;
    }

    if (confirm) {
      for (const s of [...newFramework, ...differsFramework]) {
        const filePath = path.join(cwd, s.relativePath);
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, s.templateContent!, 'utf-8');
        frameworkUpdated++;
      }
    }
  }

  // Step 7: Summary
  console.log();
  if (createdRoutes > 0) {
    console.log(chalk.green(`✓ Created ${createdRoutes} route file(s)`));
  }
  if (updatedRoutes > 0) {
    console.log(chalk.green(`✓ Updated ${updatedRoutes} route wrapper(s)`));
  }
  if (routesAddedToConfig > 0) {
    console.log(chalk.green(`✓ Added ${routesAddedToConfig} route(s) to app/routes.ts`));
  }
  if (frameworkUpdated > 0) {
    console.log(chalk.green(`✓ Updated ${frameworkUpdated} framework file(s)`));
  }

  const totalChanges = createdRoutes + updatedRoutes + routesAddedToConfig + frameworkUpdated;
  if (totalChanges === 0) {
    console.log(chalk.dim('No changes made.'));
  } else {
    console.log();
    console.log('Next steps:');
    console.log(`  ${chalk.cyan('pnpm db:generate && pnpm db:push')}  (if schema changed)`);
    console.log(`  Restart your dev server`);
  }
}

/**
 * Load the managedRoutes array from the installed @chaaskit/client package.
 *
 * Uses direct file path (like db-sync) rather than createRequire, because
 * require.resolve() uses CJS resolution which can't resolve ESM-only exports.
 */
async function loadRouteRegistry(cwd: string): Promise<ManagedRoute[] | null> {
  // Direct path to the built route-registry module
  const registryPath = path.join(
    cwd,
    'node_modules',
    '@chaaskit',
    'client',
    'dist',
    'lib',
    'route-registry.js'
  );

  // Check if the file exists first for a better error message
  if (!(await fs.pathExists(registryPath))) {
    // Check if @chaaskit/client is installed at all
    const clientPkgPath = path.join(cwd, 'node_modules', '@chaaskit', 'client', 'package.json');
    if (!(await fs.pathExists(clientPkgPath))) {
      console.error(
        chalk.red(
          '@chaaskit/client is not installed.\n' +
            'Make sure it is listed in your dependencies and run:\n' +
            '  pnpm install'
        )
      );
    } else {
      const pkg = JSON.parse(await fs.readFile(clientPkgPath, 'utf-8'));
      console.error(
        chalk.red(
          `@chaaskit/client@${pkg.version} does not include the route registry.\n` +
            'Update to the latest version:\n' +
            '  pnpm install @chaaskit/client@latest'
        )
      );
    }
    return null;
  }

  try {
    const fileUrl = pathToFileURL(registryPath).href;
    const registry = await import(fileUrl);
    return registry.managedRoutes as ManagedRoute[];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      chalk.red(
        `Failed to load route registry from @chaaskit/client:\n  ${message}\n` +
          'Try updating to the latest version:\n' +
          '  pnpm install @chaaskit/client@latest'
      )
    );
    return null;
  }
}

/**
 * Get the installed @chaaskit/client version.
 */
async function loadClientPackageVersion(cwd: string): Promise<string> {
  try {
    const pkgPath = path.join(cwd, 'node_modules', '@chaaskit', 'client', 'package.json');
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
    return pkg.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Check each managed route against local files.
 */
async function checkManagedRoutes(
  cwd: string,
  managedRoutes: ManagedRoute[]
): Promise<RouteStatus[]> {
  const results: RouteStatus[] = [];

  for (const route of managedRoutes) {
    const filePath = path.join(cwd, 'app', route.file);
    const expected = generateWrapper(route);

    if (!(await fs.pathExists(filePath))) {
      results.push({ route, status: 'new', expected });
      continue;
    }

    const actual = await fs.readFile(filePath, 'utf-8');

    if (!isThinWrapper(actual)) {
      results.push({ route, status: 'customized', actual });
      continue;
    }

    if (actual === expected) {
      results.push({ route, status: 'up-to-date' });
    } else {
      results.push({ route, status: 'updatable', expected, actual });
    }
  }

  return results;
}

/**
 * Check framework files against templates.
 */
async function checkFrameworkFiles(cwd: string): Promise<FrameworkFileStatus[]> {
  const results: FrameworkFileStatus[] = [];
  const templatesPath = getTemplatesPath();

  for (const relativePath of FRAMEWORK_FILES) {
    const templatePath = path.join(templatesPath, relativePath);
    const localPath = path.join(cwd, relativePath);

    let templateContent: string;
    try {
      templateContent = await fs.readFile(templatePath, 'utf-8');
    } catch {
      // Template doesn't exist, skip this file
      continue;
    }

    let localContent: string;
    try {
      localContent = await fs.readFile(localPath, 'utf-8');
    } catch {
      results.push({ relativePath, status: 'new', templateContent });
      continue;
    }

    if (localContent === templateContent) {
      results.push({ relativePath, status: 'up-to-date' });
    } else {
      results.push({ relativePath, status: 'differs', templateContent, localContent });
    }
  }

  return results;
}

/**
 * Get the path to the templates directory in the create-chaaskit package.
 */
function getTemplatesPath(): string {
  // When running from dist/commands/, templates are at ../templates
  return path.join(__dirname, '..', 'templates');
}
