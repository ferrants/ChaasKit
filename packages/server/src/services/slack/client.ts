import { getConfig } from '../../config/loader.js';
import { decryptCredential, encryptCredential } from '../encryption.js';

// Type definitions for Slack API responses
export interface SlackTokenResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
  token_type?: string;
  scope?: string;
  bot_user_id?: string;
  app_id?: string;
  team?: {
    id: string;
    name: string;
  };
  authed_user?: {
    id: string;
    scope?: string;
    access_token?: string;
  };
}

export interface SlackUserInfo {
  id: string;
  name: string;
  real_name?: string;
  profile?: {
    email?: string;
    display_name?: string;
  };
}

export interface SlackMessage {
  type: string;
  user?: string;
  text?: string;
  ts: string;
  thread_ts?: string;
  bot_id?: string;
}

export interface SlackConversationHistoryResponse {
  ok: boolean;
  error?: string;
  messages?: SlackMessage[];
  has_more?: boolean;
  response_metadata?: {
    next_cursor?: string;
  };
}

export interface SlackPostMessageResponse {
  ok: boolean;
  error?: string;
  ts?: string;
  channel?: string;
  message?: SlackMessage;
}

export interface SlackReactionResponse {
  ok: boolean;
  error?: string;
}

// Stored token format
export interface SlackTokens {
  botToken: string;
  userAccessToken?: string;
}

/**
 * Get Slack OAuth credentials from environment.
 */
export function getSlackCredentials(): { clientId: string; clientSecret: string } {
  const config = getConfig();
  const clientIdEnvVar = config.slack?.clientIdEnvVar || 'SLACK_CLIENT_ID';
  const clientSecretEnvVar = config.slack?.clientSecretEnvVar || 'SLACK_CLIENT_SECRET';

  const clientId = process.env[clientIdEnvVar];
  const clientSecret = process.env[clientSecretEnvVar];

  if (!clientId || !clientSecret) {
    throw new Error(`Missing Slack credentials: ${clientIdEnvVar} or ${clientSecretEnvVar}`);
  }

  return { clientId, clientSecret };
}

/**
 * Exchange OAuth code for access tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<SlackTokenResponse> {
  const { clientId, clientSecret } = getSlackCredentials();

  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const data = await response.json() as SlackTokenResponse;
  return data;
}

/**
 * Build Slack OAuth authorization URL.
 */
export function buildOAuthUrl(state: string, redirectUri: string): string {
  const { clientId } = getSlackCredentials();

  const scopes = [
    'app_mentions:read',
    'channels:history',
    'groups:history',
    'im:history',
    'chat:write',
    'reactions:write',
    'users:read',
  ].join(',');

  const params = new URLSearchParams({
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    state,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

/**
 * Encrypt tokens for storage.
 */
export function encryptTokens(tokens: SlackTokens): string {
  return encryptCredential(tokens as unknown as Record<string, unknown>);
}

/**
 * Decrypt stored tokens.
 */
export function decryptTokens(encryptedTokens: string): SlackTokens {
  return decryptCredential<SlackTokens>(encryptedTokens);
}

/**
 * Slack API client class for making authenticated requests.
 */
export class SlackClient {
  private botToken: string;

  constructor(botToken: string) {
    this.botToken = botToken;
  }

  /**
   * Create client from encrypted tokens.
   */
  static fromEncrypted(encryptedTokens: string): SlackClient {
    const tokens = decryptTokens(encryptedTokens);
    return new SlackClient(tokens.botToken);
  }

  /**
   * Make an authenticated request to the Slack API.
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `https://slack.com/api/${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.botToken}`,
        'Content-Type': 'application/json; charset=utf-8',
        ...options.headers,
      },
    });

    const data = await response.json() as T;
    return data;
  }

  /**
   * Post a message to a channel.
   */
  async postMessage(
    channel: string,
    text: string,
    options: {
      threadTs?: string;
      mrkdwn?: boolean;
      unfurlLinks?: boolean;
      unfurlMedia?: boolean;
    } = {}
  ): Promise<SlackPostMessageResponse> {
    return this.request<SlackPostMessageResponse>('chat.postMessage', {
      method: 'POST',
      body: JSON.stringify({
        channel,
        text,
        thread_ts: options.threadTs,
        mrkdwn: options.mrkdwn ?? true,
        unfurl_links: options.unfurlLinks ?? false,
        unfurl_media: options.unfurlMedia ?? false,
      }),
    });
  }

  /**
   * Add a reaction to a message.
   */
  async addReaction(
    channel: string,
    timestamp: string,
    emoji: string
  ): Promise<SlackReactionResponse> {
    return this.request<SlackReactionResponse>('reactions.add', {
      method: 'POST',
      body: JSON.stringify({
        channel,
        timestamp,
        name: emoji,
      }),
    });
  }

  /**
   * Remove a reaction from a message.
   */
  async removeReaction(
    channel: string,
    timestamp: string,
    emoji: string
  ): Promise<SlackReactionResponse> {
    return this.request<SlackReactionResponse>('reactions.remove', {
      method: 'POST',
      body: JSON.stringify({
        channel,
        timestamp,
        name: emoji,
      }),
    });
  }

  /**
   * Get conversation/thread history.
   */
  async getConversationHistory(
    channel: string,
    options: {
      threadTs?: string;
      limit?: number;
      cursor?: string;
    } = {}
  ): Promise<SlackConversationHistoryResponse> {
    const endpoint = options.threadTs ? 'conversations.replies' : 'conversations.history';

    const params: Record<string, string> = {
      channel,
      limit: (options.limit ?? 50).toString(),
    };

    if (options.threadTs) {
      params.ts = options.threadTs;
    }

    if (options.cursor) {
      params.cursor = options.cursor;
    }

    return this.request<SlackConversationHistoryResponse>(
      `${endpoint}?${new URLSearchParams(params).toString()}`
    );
  }

  /**
   * Get user information.
   */
  async getUserInfo(userId: string): Promise<{ ok: boolean; error?: string; user?: SlackUserInfo }> {
    return this.request(`users.info?user=${userId}`);
  }

  /**
   * Test authentication (useful for checking if token is valid).
   */
  async authTest(): Promise<{ ok: boolean; error?: string; user_id?: string; team?: string; team_id?: string }> {
    return this.request('auth.test', { method: 'POST' });
  }
}
