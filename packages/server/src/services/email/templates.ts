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
