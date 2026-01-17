/**
 * Email service type definitions
 */

/**
 * Email message to send
 */
export interface EmailMessage {
  /** Recipient email address(es) */
  to: string | string[];
  /** Email subject */
  subject: string;
  /** Plain text body */
  text?: string;
  /** HTML body */
  html?: string;
  /** Reply-to address */
  replyTo?: string;
}

/**
 * Result of sending an email
 */
export interface SendResult {
  /** Message ID from the provider */
  messageId: string;
}

/**
 * Email provider interface - implemented by SESEmailProvider, etc.
 */
export interface EmailProvider {
  /** Provider name for logging/debugging */
  readonly name: string;

  /**
   * Send an email
   */
  send(message: EmailMessage): Promise<SendResult>;

  /**
   * Close the provider and release resources
   */
  close(): Promise<void>;
}
