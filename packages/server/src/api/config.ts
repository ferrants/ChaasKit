import { Router } from 'express';
import type { AppConfig, PublicAppConfig } from '@chaaskit/shared';
import { getConfig } from '../config/loader.js';
import { optionalAuth } from '../middleware/auth.js';

export const configRouter = Router();

/**
 * Build client-safe configuration from the full config.
 *
 * SYNC NOTE: When adding new sections to AppConfig in:
 *   packages/shared/src/types/config.ts
 * Remember to add them here (filtering out any sensitive fields).
 *
 * Sections intentionally excluded:
 * - agent: Contains API keys and provider details
 */
function buildClientConfig(config: AppConfig): PublicAppConfig {
  return {
    app: config.app,
    ui: config.ui,
    theming: config.theming,
    auth: {
      methods: config.auth.methods,
      allowUnauthenticated: config.auth.allowUnauthenticated,
      magicLink: config.auth.magicLink,
      emailVerification: config.auth.emailVerification,
      gating: config.auth.gating,
    },
    payments: {
      enabled: config.payments.enabled,
      provider: config.payments.provider,
    },
    legal: config.legal,
    userSettings: config.userSettings,
    mcp: config.mcp ? {
      servers: config.mcp.servers?.map(server => ({
        id: server.id,
        name: server.name,
        transport: server.transport,
        enabled: server.enabled,
        authMode: server.authMode,
        userInstructions: server.userInstructions,
      })),
      allowUserServers: config.mcp.allowUserServers,
      toolConfirmation: config.mcp.toolConfirmation,
      toolTimeout: config.mcp.toolTimeout,
      showToolCalls: config.mcp.showToolCalls,
    } : undefined,
    sharing: config.sharing,
    promptTemplates: config.promptTemplates ? {
      enabled: config.promptTemplates.enabled,
      allowUserTemplates: config.promptTemplates.allowUserTemplates,
    } : undefined,
    teams: config.teams,
    projects: config.projects,
    documents: config.documents ? {
      enabled: config.documents.enabled,
      maxFileSizeMB: config.documents.maxFileSizeMB,
      hybridThreshold: config.documents.hybridThreshold,
      acceptedTypes: config.documents.acceptedTypes,
      // Exclude: storage (internal details)
    } : undefined,
    api: config.api ? {
      enabled: config.api.enabled,
      // Exclude: keyPrefix, allowedEndpoints (internal details)
    } : undefined,
    email: config.email ? {
      enabled: config.email.enabled,
      // Exclude: providerConfig, fromAddress, fromName (internal details)
    } : undefined,
    slack: config.slack ? {
      enabled: config.slack.enabled,
      // Exclude: secrets and OAuth configs
    } : undefined,
    scheduledPrompts: config.scheduledPrompts ? {
      enabled: config.scheduledPrompts.enabled,
      featureName: config.scheduledPrompts.featureName,
      allowUserPrompts: config.scheduledPrompts.allowUserPrompts,
      allowTeamPrompts: config.scheduledPrompts.allowTeamPrompts,
      defaultTimezone: config.scheduledPrompts.defaultTimezone,
      defaultMaxUserPrompts: config.scheduledPrompts.defaultMaxUserPrompts,
      defaultMaxTeamPrompts: config.scheduledPrompts.defaultMaxTeamPrompts,
    } : undefined,
    credits: config.credits ? {
      enabled: config.credits.enabled,
      expiryEnabled: config.credits.expiryEnabled,
      promoEnabled: config.credits.promoEnabled,
    } : undefined,
    metering: config.metering ? {
      enabled: config.metering.enabled,
      recordPromptCompletion: config.metering.recordPromptCompletion,
    } : undefined,
  };
}

// GET /api/config - Get client-safe configuration
configRouter.get('/', optionalAuth, (req, res) => {
  const config = getConfig();
  const clientConfig = buildClientConfig(config);
  if (req.user?.isAdmin) {
    clientConfig.auth.isAdmin = true;
  }
  res.json(clientConfig);
});
