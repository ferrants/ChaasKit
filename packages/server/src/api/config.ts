import { Router } from 'express';
import type { AppConfig } from '@chaaskit/shared';
import { getConfig } from '../config/loader.js';

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
function buildClientConfig(config: AppConfig) {
  return {
    app: config.app,
    ui: config.ui,
    theming: config.theming,
    auth: {
      methods: config.auth.methods,
      allowUnauthenticated: config.auth.allowUnauthenticated,
      magicLink: config.auth.magicLink,
      emailVerification: config.auth.emailVerification,
    },
    payments: {
      enabled: config.payments.enabled,
      provider: config.payments.provider,
      plans: config.payments.plans,
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
    promptTemplates: config.promptTemplates,
    teams: config.teams,
    projects: config.projects,
    admin: config.admin,
    documents: config.documents ? {
      enabled: config.documents.enabled,
      maxFileSizeMB: config.documents.maxFileSizeMB,
      hybridThreshold: config.documents.hybridThreshold,
      acceptedTypes: config.documents.acceptedTypes,
      // Exclude: storage (internal details)
    } : undefined,
    api: config.api ? {
      enabled: config.api.enabled,
      allowedPlans: config.api.allowedPlans,
      // Exclude: keyPrefix, allowedEndpoints (internal details)
    } : undefined,
    slack: config.slack ? {
      enabled: config.slack.enabled,
      allowedPlans: config.slack.allowedPlans,
      aiChat: config.slack.aiChat,
      notifications: config.slack.notifications,
      // Exclude: *EnvVar fields (secrets)
    } : undefined,
    email: config.email ? {
      enabled: config.email.enabled,
      // Exclude: providerConfig, fromAddress, fromName (internal details)
    } : undefined,
    scheduledPrompts: config.scheduledPrompts ? {
      enabled: config.scheduledPrompts.enabled,
      featureName: config.scheduledPrompts.featureName,
      allowUserPrompts: config.scheduledPrompts.allowUserPrompts,
      allowTeamPrompts: config.scheduledPrompts.allowTeamPrompts,
      defaultTimezone: config.scheduledPrompts.defaultTimezone,
      planLimits: config.scheduledPrompts.planLimits,
      defaultMaxUserPrompts: config.scheduledPrompts.defaultMaxUserPrompts,
      defaultMaxTeamPrompts: config.scheduledPrompts.defaultMaxTeamPrompts,
    } : undefined,
  };
}

// GET /api/config - Get client-safe configuration
configRouter.get('/', (req, res) => {
  const config = getConfig();
  res.json(buildClientConfig(config));
});
