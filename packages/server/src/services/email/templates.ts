/**
 * Email template generators for transactional emails
 */

import type { AppConfig } from '@chaaskit/shared';

interface BaseTemplateParams {
  appName: string;
  appUrl: string;
}

/**
 * Generate the common email wrapper HTML
 */
function wrapInEmailTemplate(content: string, params: BaseTemplateParams): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.appName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 560px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .card {
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      padding: 40px;
    }
    .header {
      text-align: center;
      margin-bottom: 32px;
    }
    .header h1 {
      color: #1a1a1a;
      font-size: 24px;
      font-weight: 600;
      margin: 0;
    }
    .content {
      margin-bottom: 32px;
    }
    .code-display {
      background-color: #f8f9fa;
      border: 2px solid #e9ecef;
      border-radius: 8px;
      padding: 24px;
      text-align: center;
      margin: 24px 0;
    }
    .code {
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
      font-size: 36px;
      font-weight: 700;
      letter-spacing: 8px;
      color: #1a1a1a;
    }
    .button {
      display: inline-block;
      background-color: #6366f1;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
    }
    .button:hover {
      background-color: #4f46e5;
    }
    .button-container {
      text-align: center;
      margin: 24px 0;
    }
    .footer {
      text-align: center;
      color: #6b7280;
      font-size: 14px;
      margin-top: 24px;
    }
    .muted {
      color: #6b7280;
      font-size: 14px;
    }
    .divider {
      border-top: 1px solid #e5e7eb;
      margin: 24px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${params.appName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`.trim();
}

/**
 * Generate verification email HTML
 */
export function generateVerificationEmailHtml(
  code: string,
  config: AppConfig
): string {
  const content = `
    <div class="header">
      <h1>Verify your email</h1>
    </div>
    <div class="content">
      <p>Welcome to ${config.app.name}! Please enter this verification code to complete your registration:</p>
      <div class="code-display">
        <span class="code">${code}</span>
      </div>
      <p class="muted">This code will expire in 15 minutes. If you didn't create an account with ${config.app.name}, you can safely ignore this email.</p>
    </div>
  `;

  return wrapInEmailTemplate(content, {
    appName: config.app.name,
    appUrl: config.app.url,
  });
}

/**
 * Generate verification email plain text
 */
export function generateVerificationEmailText(
  code: string,
  config: AppConfig
): string {
  return `
Verify your email

Welcome to ${config.app.name}! Please enter this verification code to complete your registration:

${code}

This code will expire in 15 minutes.

If you didn't create an account with ${config.app.name}, you can safely ignore this email.
`.trim();
}

/**
 * Generate magic link email HTML
 */
export function generateMagicLinkEmailHtml(
  magicLinkUrl: string,
  config: AppConfig
): string {
  const content = `
    <div class="header">
      <h1>Sign in with magic link</h1>
    </div>
    <div class="content">
      <p>Click the button below to sign in to ${config.app.name}:</p>
      <div class="button-container">
        <a href="${magicLinkUrl}" class="button">Sign In</a>
      </div>
      <div class="divider"></div>
      <p class="muted">This link will expire soon. If you didn't request this email, you can safely ignore it.</p>
      <p class="muted">If you can't click the button, copy and paste this link into your browser:</p>
      <p class="muted" style="word-break: break-all;">${magicLinkUrl}</p>
    </div>
  `;

  return wrapInEmailTemplate(content, {
    appName: config.app.name,
    appUrl: config.app.url,
  });
}

/**
 * Generate magic link email plain text
 */
export function generateMagicLinkEmailText(
  magicLinkUrl: string,
  config: AppConfig
): string {
  return `
Sign in with magic link

Click the link below to sign in to ${config.app.name}:
${magicLinkUrl}

This link will expire soon. If you didn't request this email, you can safely ignore it.
`.trim();
}

/**
 * Generate team invitation email HTML
 */
export function generateTeamInviteEmailHtml(
  teamName: string,
  inviteUrl: string,
  inviterName: string | null,
  config: AppConfig
): string {
  const inviterText = inviterName
    ? `${inviterName} has invited you`
    : 'You have been invited';

  const content = `
    <div class="header">
      <h1>You're invited to join a team</h1>
    </div>
    <div class="content">
      <p>${inviterText} to join <strong>${teamName}</strong> on ${config.app.name}.</p>
      <p>Click the button below to accept the invitation and join the team:</p>
      <div class="button-container">
        <a href="${inviteUrl}" class="button">Accept Invitation</a>
      </div>
      <div class="divider"></div>
      <p class="muted">This invitation will expire in 7 days. If you don't have an account yet, you'll be able to create one when you accept the invitation.</p>
      <p class="muted">If you can't click the button, copy and paste this link into your browser:</p>
      <p class="muted" style="word-break: break-all;">${inviteUrl}</p>
    </div>
  `;

  return wrapInEmailTemplate(content, {
    appName: config.app.name,
    appUrl: config.app.url,
  });
}

/**
 * Generate team invitation email plain text
 */
export function generateTeamInviteEmailText(
  teamName: string,
  inviteUrl: string,
  inviterName: string | null,
  config: AppConfig
): string {
  const inviterText = inviterName
    ? `${inviterName} has invited you`
    : 'You have been invited';

  return `
You're invited to join a team

${inviterText} to join "${teamName}" on ${config.app.name}.

Accept the invitation by visiting this link:
${inviteUrl}

This invitation will expire in 7 days.

If you don't have an account yet, you'll be able to create one when you accept the invitation.
`.trim();
}

/**
 * Generate app invitation email HTML
 */
export function generateAppInviteEmailHtml(
  inviteUrl: string,
  expiresInDays: number,
  config: AppConfig
): string {
  const content = `
    <div class="header">
      <h1>You're invited</h1>
    </div>
    <div class="content">
      <p>You’ve been invited to join ${config.app.name}.</p>
      <p>Click the button below to create your account:</p>
      <div class="button-container">
        <a href="${inviteUrl}" class="button">Accept Invitation</a>
      </div>
      <div class="divider"></div>
      <p class="muted">This invitation will expire in ${expiresInDays} days.</p>
      <p class="muted">If you can't click the button, copy and paste this link into your browser:</p>
      <p class="muted" style="word-break: break-all;">${inviteUrl}</p>
    </div>
  `;

  return wrapInEmailTemplate(content, {
    appName: config.app.name,
    appUrl: config.app.url,
  });
}

/**
 * Generate app invitation email plain text
 */
export function generateAppInviteEmailText(
  inviteUrl: string,
  expiresInDays: number,
  config: AppConfig
): string {
  return `
You're invited

You've been invited to join ${config.app.name}.

Accept the invitation by visiting this link:
${inviteUrl}

This invitation will expire in ${expiresInDays} days.
`.trim();
}

interface PaymentFailedTemplateParams {
  subjectName: string;
  amountDue?: string;
  invoiceUrl?: string | null;
}

/**
 * Generate payment failed email HTML
 */
export function generatePaymentFailedEmailHtml(
  params: PaymentFailedTemplateParams,
  config: AppConfig
): string {
  const amountLine = params.amountDue ? `<p><strong>Amount due:</strong> ${params.amountDue}</p>` : '';
  const invoiceLine = params.invoiceUrl
    ? `<p class="muted">View invoice: <a href="${params.invoiceUrl}">${params.invoiceUrl}</a></p>`
    : '';

  const content = `
    <div class="header">
      <h1>Payment failed</h1>
    </div>
    <div class="content">
      <p>We were unable to process the payment for ${params.subjectName} on ${config.app.name}.</p>
      ${amountLine}
      <p>Please update your payment method to avoid service interruption.</p>
      ${invoiceLine}
    </div>
  `;

  return wrapInEmailTemplate(content, {
    appName: config.app.name,
    appUrl: config.app.url,
  });
}

/**
 * Generate payment failed email plain text
 */
export function generatePaymentFailedEmailText(
  params: PaymentFailedTemplateParams,
  config: AppConfig
): string {
  const amountLine = params.amountDue ? `Amount due: ${params.amountDue}\n` : '';
  const invoiceLine = params.invoiceUrl ? `View invoice: ${params.invoiceUrl}\n` : '';

  return `
Payment failed

We were unable to process the payment for ${params.subjectName} on ${config.app.name}.
${amountLine}
Please update your payment method to avoid service interruption.
${invoiceLine}
`.trim();
}
