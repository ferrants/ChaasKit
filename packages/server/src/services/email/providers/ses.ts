/**
 * AWS SES Email Provider
 *
 * Production-ready email provider using Amazon SES.
 * Uses the AWS SDK default credential chain (environment variables, shared credentials,
 * IAM instance/task roles, etc.).
 *
 * Requires @aws-sdk/client-ses to be installed:
 *   pnpm add @aws-sdk/client-ses
 */

import type { SESEmailProviderConfig } from '@chaaskit/shared';
import type { EmailProvider, EmailMessage, SendResult } from '../types.js';

// Types for AWS SES (to avoid importing the module directly)
interface SESClientType {
  send(command: unknown): Promise<{ MessageId?: string }>;
  destroy(): void;
}

interface SendEmailCommandInput {
  Source: string;
  Destination: { ToAddresses: string[] };
  Message: {
    Subject: { Data: string; Charset: string };
    Body: {
      Text?: { Data: string; Charset: string };
      Html?: { Data: string; Charset: string };
    };
  };
  ReplyToAddresses?: string[];
}

/**
 * AWS SES Email Provider
 */
export class SESEmailProvider implements EmailProvider {
  readonly name = 'ses';

  private client: SESClientType | null = null;
  private region: string;
  private fromAddress: string;
  private fromName?: string;
  private closed = false;

  constructor(config: SESEmailProviderConfig, fromAddress: string, fromName?: string) {
    this.region = config.region;
    this.fromAddress = fromAddress;
    this.fromName = fromName;

    console.log(`[SES] Email provider initialized (region: ${config.region})`);
  }

  private async getClient(): Promise<SESClientType> {
    if (this.client) {
      return this.client;
    }

    // Dynamic import to avoid requiring the SDK at compile time
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sesModule = await import('@aws-sdk/client-ses' as any);
    const SESClient = sesModule.SESClient;
    this.client = new SESClient({
      region: this.region,
    }) as SESClientType;

    return this.client;
  }

  async send(message: EmailMessage): Promise<SendResult> {
    if (this.closed) {
      throw new Error('Email provider is closed');
    }

    const client = await this.getClient();

    const toAddresses = Array.isArray(message.to) ? message.to : [message.to];
    const from = this.fromName
      ? `${this.fromName} <${this.fromAddress}>`
      : this.fromAddress;

    // Dynamic import for the command
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sesModule = await import('@aws-sdk/client-ses' as any);
    const SendEmailCommand = sesModule.SendEmailCommand;

    const commandInput: SendEmailCommandInput = {
      Source: from,
      Destination: {
        ToAddresses: toAddresses,
      },
      Message: {
        Subject: {
          Data: message.subject,
          Charset: 'UTF-8',
        },
        Body: {
          ...(message.text && {
            Text: {
              Data: message.text,
              Charset: 'UTF-8',
            },
          }),
          ...(message.html && {
            Html: {
              Data: message.html,
              Charset: 'UTF-8',
            },
          }),
        },
      },
      ...(message.replyTo && {
        ReplyToAddresses: [message.replyTo],
      }),
    };

    const command = new SendEmailCommand(commandInput);
    const response = await client.send(command);

    console.log(`[SES] Email sent to ${toAddresses.join(', ')} (messageId: ${response.MessageId})`);

    return {
      messageId: response.MessageId ?? 'unknown',
    };
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.client) {
      this.client.destroy();
    }
    console.log('[SES] Email provider closed');
  }
}
