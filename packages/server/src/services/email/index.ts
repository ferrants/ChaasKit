import type { EmailConfig, EmailProviderConfig } from '@chaaskit/shared';
import type { EmailProvider, EmailMessage, SendResult } from './types.js';

// Re-export types
export type { EmailProvider, EmailMessage, SendResult };
export * from './types.js';
export * from './templates.js';

let emailProvider: EmailProvider | null = null;
let emailConfig: EmailConfig | null = null;

/**
 * Create an email provider based on configuration.
 * Uses dynamic imports for optional dependencies (SES SDK only loaded if needed).
 */
export async function createEmailProvider(
  providerConfig: EmailProviderConfig,
  fromAddress: string,
  fromName?: string
): Promise<EmailProvider> {
  switch (providerConfig.type) {
    case 'ses':
      // Dynamic import - @aws-sdk/client-ses is optional peer dependency
      try {
        const { SESEmailProvider } = await import('./providers/ses.js');
        return new SESEmailProvider(providerConfig, fromAddress, fromName);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') {
          throw new Error(
            'SES provider requires @aws-sdk/client-ses. Install it with: pnpm add @aws-sdk/client-ses'
          );
        }
        throw e;
      }

    default:
      throw new Error(`Unknown email provider type: ${(providerConfig as EmailProviderConfig).type}`);
  }
}

/**
 * Get the email provider singleton.
 * Must be initialized with initializeEmailProvider() first.
 * Throws if not initialized.
 */
export function getEmailProvider(): EmailProvider {
  if (!emailProvider) {
    throw new Error('[Email] Provider not initialized. Call initializeEmailProvider() first.');
  }
  return emailProvider;
}

/**
 * Check if email is configured and available
 */
export function isEmailEnabled(): boolean {
  return emailConfig?.enabled === true && emailProvider !== null;
}

/**
 * Initialize the email provider singleton.
 * Call this during server startup with the app's email config.
 */
export async function initializeEmailProvider(config: EmailConfig): Promise<EmailProvider | null> {
  if (emailProvider) {
    console.warn('[Email] Provider already initialized');
    return emailProvider;
  }

  emailConfig = config;

  if (!config.enabled) {
    console.log('[Email] Email system is disabled');
    return null;
  }

  console.log(`[Email] Initializing ${config.providerConfig.type} provider...`);
  emailProvider = await createEmailProvider(
    config.providerConfig,
    config.fromAddress,
    config.fromName
  );
  console.log(`[Email] ${emailProvider.name} provider initialized`);

  return emailProvider;
}

/**
 * Send an email using the configured provider
 * Convenience wrapper that handles disabled state gracefully
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult | null> {
  if (!isEmailEnabled()) {
    console.log('[Email] Email disabled, skipping send');
    return null;
  }

  return getEmailProvider().send(message);
}

/**
 * Close and reset the email provider (for testing or shutdown)
 */
export async function closeEmailProvider(): Promise<void> {
  if (emailProvider) {
    await emailProvider.close();
    emailProvider = null;
    console.log('[Email] Provider closed');
  }
}

/**
 * Reset the email provider singleton (for testing)
 */
export function resetEmailProvider(): void {
  emailProvider = null;
  emailConfig = null;
}
