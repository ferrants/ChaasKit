import { db } from '@chaaskit/db';
import { getConfig } from '../config/loader.js';

export async function recordUsage(params: {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  userId: string;
  teamId?: string | null;
  messageId?: string | null;
}): Promise<void> {
  const config = getConfig();
  if (!config.metering?.enabled) {
    return;
  }

  const promptTokens = config.metering.recordPromptCompletion === false ? 0 : params.promptTokens;
  const completionTokens = config.metering.recordPromptCompletion === false ? 0 : params.completionTokens;
  const totalTokens = (promptTokens ?? 0) + (completionTokens ?? 0);

  await db.usageMeter.create({
    data: {
      provider: params.provider,
      model: params.model,
      promptTokens,
      completionTokens,
      totalTokens,
      userId: params.userId,
      teamId: params.teamId ?? undefined,
      messageId: params.messageId ?? undefined,
    },
  });
}
