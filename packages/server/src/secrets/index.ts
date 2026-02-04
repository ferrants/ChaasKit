/**
 * Secrets Provider System
 *
 * Loads secrets from various backends and sets them as environment variables.
 * Must be called BEFORE any modules that need these secrets are imported.
 *
 * Provider selection via environment variables:
 *   SECRETS_PROVIDER=env                 (default) - secrets already in env vars
 *   SECRETS_PROVIDER=aws-secrets-manager - load from AWS Secrets Manager
 *
 * Provider-specific configuration:
 *   AWS Secrets Manager:
 *     AWS_SECRET_ARN - ARN of the secret to load
 *     AWS_REGION - Region (optional, defaults to 'us-west-2')
 */

export interface SecretProvider {
  name: string;
  loadSecrets(): Promise<void>;
}

/**
 * Environment variable provider - no-op since secrets are already in env
 */
class EnvSecretProvider implements SecretProvider {
  name = 'env';

  async loadSecrets(): Promise<void> {
    console.log('[Secrets] Using environment variables (no secret provider configured)');
  }
}

/**
 * AWS Secrets Manager provider
 * Loads secrets from AWS Secrets Manager and sets them as environment variables
 */
class AwsSecretsManagerProvider implements SecretProvider {
  name = 'aws-secrets-manager';

  private secretArn: string;
  private region: string;

  constructor() {
    const secretArn = process.env.AWS_SECRET_ARN;
    if (!secretArn) {
      throw new Error(
        'AWS_SECRET_ARN environment variable is required for aws-secrets-manager provider'
      );
    }
    this.secretArn = secretArn;
    this.region = process.env.AWS_REGION || 'us-west-2';
  }

  async loadSecrets(): Promise<void> {
    console.log(`[Secrets] Loading secrets from AWS Secrets Manager...`);
    console.log(`[Secrets] Secret ARN: ${this.secretArn}`);
    console.log(`[Secrets] Region: ${this.region}`);

    // Dynamic import to avoid loading AWS SDK if not needed
    const { SecretsManagerClient, GetSecretValueCommand } = await import(
      '@aws-sdk/client-secrets-manager'
    );

    const client = new SecretsManagerClient({ region: this.region });

    try {
      const response = await client.send(
        new GetSecretValueCommand({ SecretId: this.secretArn })
      );

      if (!response.SecretString) {
        throw new Error('Secret value is empty');
      }

      const secret = JSON.parse(response.SecretString);
      const secretKeys = Object.keys(secret);
      console.log(`[Secrets] Found ${secretKeys.length} keys: ${secretKeys.join(', ')}`);

      // Set DATABASE_URL from individual DB fields if not already set
      if (!process.env.DATABASE_URL) {
        const host = secret.host || secret.DB_HOST;
        const port = secret.port || secret.DB_PORT || 5432;
        const database = secret.dbname || secret.DB_NAME;
        const username = secret.username || secret.DB_USER;
        const password = secret.password || secret.DB_USER_PASSWORD;

        if (host && username && password && database) {
          process.env.DATABASE_URL = `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
          console.log(`[Secrets] DATABASE_URL constructed from secret fields`);
        }
      }

      // Map common secret fields to environment variables
      const envMappings: Record<string, string> = {
        // API Keys
        OPENAI_API_KEY: 'OPENAI_API_KEY',
        ANTHROPIC_API_KEY: 'ANTHROPIC_API_KEY',
        // Session
        SESSION_SECRET: 'SESSION_SECRET',
        // Stripe
        STRIPE_SECRET_KEY: 'STRIPE_SECRET_KEY',
        STRIPE_WEBHOOK_SECRET: 'STRIPE_WEBHOOK_SECRET',
        // Slack
        SLACK_CLIENT_ID: 'SLACK_CLIENT_ID',
        SLACK_CLIENT_SECRET: 'SLACK_CLIENT_SECRET',
        SLACK_SIGNING_SECRET: 'SLACK_SIGNING_SECRET',
        // OAuth
        GOOGLE_CLIENT_ID: 'GOOGLE_CLIENT_ID',
        GOOGLE_CLIENT_SECRET: 'GOOGLE_CLIENT_SECRET',
        GITHUB_CLIENT_ID: 'GITHUB_CLIENT_ID',
        GITHUB_CLIENT_SECRET: 'GITHUB_CLIENT_SECRET',
      };

      for (const [secretKey, envKey] of Object.entries(envMappings)) {
        if (secret[secretKey] && !process.env[envKey]) {
          process.env[envKey] = secret[secretKey];
          console.log(`[Secrets] ${envKey} set from Secrets Manager`);
        }
      }

      console.log('[Secrets] Secrets loaded successfully');
    } catch (error) {
      console.error('[Secrets] Failed to load secrets:', error);
      throw error;
    }
  }
}

/**
 * Get the appropriate secret provider based on environment configuration
 */
function getSecretProvider(): SecretProvider {
  // Explicit provider selection
  const providerName = process.env.SECRETS_PROVIDER;

  if (providerName) {
    switch (providerName) {
      case 'env':
        return new EnvSecretProvider();
      case 'aws-secrets-manager':
        return new AwsSecretsManagerProvider();
      default:
        throw new Error(`Unknown secrets provider: ${providerName}`);
    }
  }

  // Auto-detect based on available env vars
  if (process.env.AWS_SECRET_ARN) {
    return new AwsSecretsManagerProvider();
  }

  // Default to env provider
  return new EnvSecretProvider();
}

/**
 * Load secrets from the configured provider.
 *
 * Call this at the very start of your application, before importing
 * any modules that depend on environment variables like DATABASE_URL.
 *
 * @example
 * ```typescript
 * // server.js
 * import { loadSecrets } from '@chaaskit/server';
 *
 * await loadSecrets();
 *
 * // Now safe to import modules that need DATABASE_URL, OPENAI_API_KEY, etc.
 * const { createApp } = await import('@chaaskit/server');
 * ```
 */
export async function loadSecrets(): Promise<void> {
  const provider = getSecretProvider();
  console.log(`[Secrets] Using provider: ${provider.name}`);
  await provider.loadSecrets();
}
