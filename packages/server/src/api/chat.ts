import { Router } from 'express';
import { db } from '@chaaskit/db';
import { HTTP_STATUS, sendMessageSchema } from '@chaaskit/shared';
import { optionalAuth, requireAuth, optionalVerifiedEmail } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { getConfig } from '../config/loader.js';
import { createAgentService } from '../services/agent.js';
import { checkUsageLimits, incrementUsage } from '../services/usage.js';
import { recordUsage } from '../services/metering.js';
import { getReferralForUser, grantReferralCreditsIfEligible } from '../services/referrals.js';
import { pendingConfirmations, type ConfirmationScope } from '../services/pendingConfirmation.js';
import { getAgentById, getDefaultAgent, toAgentConfig, isBuiltInAgent } from '../services/agents.js';
import { documentService } from '../services/documents.js';
import { notifyMessageLiked } from '../services/slack/notifications.js';
import { runAgenticLoop } from '../services/agentic-loop.js';

export const chatRouter = Router();

// Send message with streaming response
chatRouter.post('/', optionalAuth, optionalVerifiedEmail, async (req, res, next) => {
  try {
    const config = getConfig();
    const parsed = sendMessageSchema.parse(req.body);
    const { threadId, content, files, agentId: requestAgentId } = parsed;
    // Extract teamId and projectId from request body (not in schema, optional)
    // Only use teamId if teams feature is enabled
    const teamsEnabled = config.teams?.enabled ?? false;
    const projectsEnabled = config.projects?.enabled ?? false;
    const requestTeamId = teamsEnabled ? (req.body as { teamId?: string }).teamId : undefined;
    const requestProjectId = projectsEnabled ? (req.body as { projectId?: string }).projectId : undefined;
    const requestVisibility = (req.body as { visibility?: string }).visibility as 'shared' | 'private' | undefined;

    console.log(`[Chat] Received message: threadId=${threadId || 'new'}, agentId=${requestAgentId || 'none'}, content="${content.slice(0, 50)}${content.length > 50 ? '...' : ''}", files=${files?.length || 0}`);

    // Check usage limits (will be done again after we know the threadId/teamId)
    // Initial check uses personal limits - team limits checked after thread is resolved

    // Get or create thread
    let thread;
    let threadAgentId: string | null = null;

    if (threadId) {
      thread = await db.thread.findUnique({
        where: { id: threadId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!thread) {
        throw new AppError(HTTP_STATUS.NOT_FOUND, 'Thread not found');
      }

      // Check access - team threads require membership with write permission
      if (thread.teamId) {
        if (!req.user) {
          throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'Authentication required');
        }
        const membership = await db.teamMember.findUnique({
          where: {
            teamId_userId: {
              teamId: thread.teamId,
              userId: req.user.id,
            },
          },
        });
        if (!membership) {
          throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
        }
        // Viewers can read but not send messages
        if (membership.role === 'viewer') {
          throw new AppError(HTTP_STATUS.FORBIDDEN, 'Viewers cannot send messages');
        }
        // Private threads only accessible to creator and admins/owners
        if (thread.visibility === 'private' && thread.userId !== req.user.id) {
          if (!['owner', 'admin'].includes(membership.role)) {
            throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
          }
        }
      } else if (thread.userId && thread.userId !== req.user?.id) {
        throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
      }

      // Use thread's agent (locked per thread)
      threadAgentId = thread.agentId;
      console.log(`[Chat] Existing thread ${threadId}, using locked agentId=${threadAgentId}`);
    } else {
      // New thread - use requested agent or default
      if (requestAgentId) {
        // Validate agent access
        const agent = getAgentById(requestAgentId);
        if (!agent) {
          throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Invalid agent');
        }
        threadAgentId = requestAgentId;
        console.log(`[Chat] New thread with requested agentId=${requestAgentId}`);
      } else {
        const defaultAgent = getDefaultAgent();
        threadAgentId = defaultAgent.id;
        console.log(`[Chat] New thread with no agentId requested, using default: ${defaultAgent.id}`);
      }

      // Validate team membership if creating a team thread
      if (requestTeamId) {
        if (!req.user) {
          throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'Authentication required for team threads');
        }
        const membership = await db.teamMember.findUnique({
          where: {
            teamId_userId: {
              teamId: requestTeamId,
              userId: req.user.id,
            },
          },
        });
        if (!membership) {
          throw new AppError(HTTP_STATUS.FORBIDDEN, 'You are not a member of this team');
        }
        if (membership.role === 'viewer') {
          throw new AppError(HTTP_STATUS.FORBIDDEN, 'Viewers cannot create team threads');
        }
      }

      // Validate project access if creating a project thread
      let effectiveTeamId = requestTeamId || null;
      if (requestProjectId) {
        if (!req.user) {
          throw new AppError(HTTP_STATUS.UNAUTHORIZED, 'Authentication required for project threads');
        }

        const project = await db.project.findUnique({
          where: { id: requestProjectId },
        });

        if (!project || project.archivedAt) {
          throw new AppError(HTTP_STATUS.NOT_FOUND, 'Project not found');
        }

        // Check project access
        if (project.userId !== req.user.id) {
          if (!project.teamId || project.sharing === 'private') {
            throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
          }

          // For team-shared projects, verify team membership and write permission
          const membership = await db.teamMember.findUnique({
            where: {
              teamId_userId: {
                teamId: project.teamId,
                userId: req.user.id,
              },
            },
          });

          if (!membership) {
            throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
          }

          if (membership.role === 'viewer') {
            throw new AppError(HTTP_STATUS.FORBIDDEN, 'Viewers cannot create threads');
          }
        }

        // Thread inherits teamId from project
        effectiveTeamId = project.teamId;
      }

      thread = await db.thread.create({
        data: {
          title: content.slice(0, 50) + (content.length > 50 ? '...' : ''),
          userId: req.user?.id,
          teamId: effectiveTeamId,
          projectId: requestProjectId || null,
          agentId: threadAgentId,
          visibility: effectiveTeamId ? (requestVisibility || 'private') : 'shared',
        },
        include: { messages: true },
      });
    }

    // Get agent definition for this thread
    const agentDef = getAgentById(threadAgentId);
    console.log(`[Chat] Using agent: id=${agentDef?.id}, name=${agentDef?.name}, allowedTools=${agentDef?.allowedTools?.join(', ') || 'none'}`);

    // Check usage limits with team context now that we have the thread
    if (req.user) {
      const canSend = await checkUsageLimits(req.user.id, thread.teamId || undefined);
      if (!canSend) {
        const context = thread.teamId ? 'team' : 'personal';
        console.log(`[Chat] Usage limit exceeded for user ${req.user.id} (${context} billing)`);
        throw new AppError(HTTP_STATUS.TOO_MANY_REQUESTS, `Usage limit exceeded for ${context} plan`);
      }
    }

    const isFirstUserMessage = req.user
      ? (await db.message.count({
          where: {
            role: 'user',
            thread: { userId: req.user.id },
          },
        })) === 0
      : false;

    // Create user message
    await db.message.create({
      data: {
        threadId: thread.id,
        role: 'user',
        content,
        files: files || undefined,
      },
    });

    // Update thread title if it's the first message and title is default
    const isFirstMessage = thread.messages.length === 0;
    if (isFirstMessage && thread.title === 'New Chat') {
      const newTitle = content.slice(0, 50) + (content.length > 50 ? '...' : '');
      await db.thread.update({
        where: { id: thread.id },
        data: { title: newTitle },
      });
      thread.title = newTitle;
      console.log(`[Chat] Updated thread title to: ${newTitle}`);
    }

    console.log(`[Chat] User message saved to thread ${thread.id}`);

    if (req.user && isFirstUserMessage) {
      const referral = await getReferralForUser(req.user.id);
      if (referral) {
        await grantReferralCreditsIfEligible({ referralId: referral.id, event: 'first_message' });
      }
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Send thread info (including title for sidebar update)
    res.write(`data: ${JSON.stringify({ type: 'thread', threadId: thread.id, title: thread.title })}\n\n`);

    // Build conversation history
    const history = thread.messages.map((msg: { role: string; content: string }) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    history.push({ role: 'user', content });

    // Get user context from settings
    const userSettings = req.user
      ? await db.user.findUnique({
          where: { id: req.user.id },
          select: { settings: true },
        })
      : null;

    const userContext = userSettings?.settings as Record<string, unknown> | null;

    // Get team context if this is a team thread and teams are enabled
    let teamContext: string | null = null;
    if (teamsEnabled && thread.teamId) {
      const team = await db.team.findUnique({
        where: { id: thread.teamId },
        select: { context: true },
      });
      teamContext = team?.context || null;
    }

    // Get project context if this thread belongs to a project and projects are enabled
    let projectContext: string | null = null;
    if (projectsEnabled && thread.projectId) {
      const project = await db.project.findUnique({
        where: { id: thread.projectId },
        select: { context: true },
      });
      projectContext = project?.context || null;
    }

    // Parse mentions from message content and build mention context
    let mentionContext: string | null = null;
    const documentsEnabled = config.documents?.enabled ?? false;
    const hybridThreshold = config.documents?.hybridThreshold ?? 1000;

    if (documentsEnabled && req.user) {
      const mentions = documentService.parseMentions(content);

      if (mentions.length > 0) {
        console.log(`[Chat] Found ${mentions.length} document mention(s) in message`);
        const paths = mentions.map((m) => m.path);
        const resolvedDocs = await documentService.resolveForContext(paths, req.user.id);

        // Separate small docs (inject) and large docs (tools)
        const smallDocs = resolvedDocs.filter((d) => d.charCount <= hybridThreshold);
        const largeDocs = resolvedDocs.filter((d) => d.charCount > hybridThreshold);

        // Build mention context for small docs
        if (smallDocs.length > 0) {
          mentionContext = 'Referenced documents:\n' +
            smallDocs.map((d) =>
              `--- ${d.path} ---\n${d.content}\n--- End ${d.path} ---`
            ).join('\n\n');
          console.log(`[Chat] Injected ${smallDocs.length} small document(s) into context`);
        }

        // Add hint about large docs that need tool access
        if (largeDocs.length > 0) {
          const largeDocHint = `\n\nLarge documents referenced (use read_document, search_in_document tools to access):\n` +
            largeDocs.map((d) => `- ${d.path} (${d.charCount} chars)`).join('\n');

          mentionContext = mentionContext
            ? mentionContext + largeDocHint
            : largeDocHint;
          console.log(`[Chat] ${largeDocs.length} large document(s) available via tools`);
        }
      }
    }

    // Track tools allowed for this thread (via "allow for this thread" scope)
    const threadAllowedTools: string[] = [];

    // Generate a visitor ID for this request (used for SSE connection lookup)
    const visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      console.log(`[Chat] Starting stream with ${history.length} messages in history`);

      // Send start event
      res.write(`data: ${JSON.stringify({ type: 'start' })}\n\n`);
      console.log(`[Chat] Stream started, receiving chunks...`);

      // Get system prompt from agent definition
      const systemPrompt = agentDef && isBuiltInAgent(agentDef) ? agentDef.systemPrompt : undefined;

      // Run the agentic loop
      const { fullContent, toolCalls, totalUsage } = await runAgenticLoop(res, {
        threadId: thread.id,
        agentId: threadAgentId,
        conversationMessages: [...history],
        systemPrompt,
        teamContext,
        projectContext,
        mentionContext,
        userContext,
        userId: req.user?.id,
        teamId: thread.teamId,
        visitorId,
        threadAllowedTools,
        files,
      });

      console.log(`[Chat] Stream complete: ${fullContent.length} chars, ${toolCalls.length} tool calls`);

      // Create assistant message with tool calls
      const assistantMessage = await db.message.create({
        data: {
          threadId: thread.id,
          role: 'assistant',
          content: fullContent,
          inputTokens: totalUsage.inputTokens,
          outputTokens: totalUsage.outputTokens,
          toolCalls: toolCalls.length > 0 ? JSON.parse(JSON.stringify(toolCalls.map((tc) => ({
            id: tc.id,
            serverId: tc.serverId,
            toolName: tc.name,
            arguments: tc.input,
            status: tc.isError ? 'error' : 'completed',
            ...(tc.displayName ? { displayName: tc.displayName } : {}),
            ...(tc.subThreadId ? { subThreadId: tc.subThreadId } : {}),
          })))) : undefined,
          toolResults: toolCalls.length > 0
            ? JSON.parse(JSON.stringify(toolCalls.map((tc) => ({
                toolCallId: tc.id,
                content: tc.result,
                isError: tc.isError,
                uiResource: tc.uiResource,
                structuredContent: tc.structuredContent,
              }))))
            : undefined,
        },
      });

      // Update thread timestamp
      await db.thread.update({
        where: { id: thread.id },
        data: { updatedAt: new Date() },
      });

      // Record usage + increment usage on the correct entity (user or team)
      if (req.user) {
        const usageProvider = agentDef && isBuiltInAgent(agentDef) ? agentDef.provider : 'external';
        const usageModel = agentDef && isBuiltInAgent(agentDef) ? agentDef.model : 'external';
        await recordUsage({
          provider: usageProvider,
          model: usageModel,
          promptTokens: totalUsage.inputTokens,
          completionTokens: totalUsage.outputTokens,
          userId: req.user.id,
          teamId: thread.teamId || undefined,
          messageId: assistantMessage.id,
        });
        await incrementUsage(req.user.id, thread.teamId || undefined, {
          inputTokens: totalUsage.inputTokens,
          outputTokens: totalUsage.outputTokens,
        });
      }

      // Send done event
      res.write(
        `data: ${JSON.stringify({
          type: 'done',
          messageId: assistantMessage.id,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          usage: {
            inputTokens: totalUsage.inputTokens,
            outputTokens: totalUsage.outputTokens,
            totalTokens: totalUsage.inputTokens + totalUsage.outputTokens,
          },
        })}\n\n`
      );
    } catch (error) {
      console.error('Chat error:', error);
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        })}\n\n`
      );
    }

    res.end();
  } catch (error) {
    next(error);
  }
});

// Regenerate assistant message
chatRouter.post('/regenerate/:messageId', requireAuth, async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const config = getConfig();

    const message = await db.message.findUnique({
      where: { id: messageId },
      include: {
        thread: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!message) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Message not found');
    }

    if (message.role !== 'assistant') {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Can only regenerate assistant messages');
    }

    if (message.thread.userId !== req.user!.id) {
      throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
    }

    // Check usage limits
    const canSend = await checkUsageLimits(req.user!.id);
    if (!canSend) {
      throw new AppError(HTTP_STATUS.TOO_MANY_REQUESTS, 'Usage limit exceeded');
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Build history up to this message (excluding the message to regenerate)
    const messageIndex = message.thread.messages.findIndex((m) => m.id === messageId);
    const history = message.thread.messages.slice(0, messageIndex).map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    // Get agent for this thread
    const agentDef = getAgentById(message.thread.agentId);
    const agentConfig = agentDef ? toAgentConfig(agentDef) : config.agent;
    const agentService = createAgentService(agentConfig);

    let fullContent = '';
    let usage = { inputTokens: 0, outputTokens: 0 };

    try {
      // Get system prompt from agent definition
      const systemPrompt = agentDef && isBuiltInAgent(agentDef) ? agentDef.systemPrompt : undefined;

      const stream = await agentService.chat(history, {
        systemPrompt,
      });

      res.write(`data: ${JSON.stringify({ type: 'start' })}\n\n`);

      for await (const chunk of stream) {
        if (chunk.type === 'text') {
          fullContent += chunk.content;
          res.write(`data: ${JSON.stringify({ type: 'delta', content: chunk.content })}\n\n`);
        } else if (chunk.type === 'usage' && chunk.usage) {
          usage = chunk.usage;
        }
      }

      // Update the message
      await db.message.update({
        where: { id: messageId },
        data: {
          content: fullContent,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
        },
      });

      // Record usage + increment usage on the correct entity (user or team)
      const usageProvider = agentDef && isBuiltInAgent(agentDef) ? agentDef.provider : 'external';
      const usageModel = agentDef && isBuiltInAgent(agentDef) ? agentDef.model : 'external';
      await recordUsage({
        provider: usageProvider,
        model: usageModel,
        promptTokens: usage.inputTokens,
        completionTokens: usage.outputTokens,
        userId: req.user!.id,
        teamId: message.thread.teamId || undefined,
        messageId,
      });

      // Increment usage on the correct entity (user or team)
      await incrementUsage(req.user!.id, message.thread.teamId || undefined, {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      });

      res.write(
        `data: ${JSON.stringify({
          type: 'done',
          messageId,
          usage: {
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            totalTokens: usage.inputTokens + usage.outputTokens,
          },
        })}\n\n`
      );
    } catch (error) {
      res.write(
        `data: ${JSON.stringify({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        })}\n\n`
      );
    }

    res.end();
  } catch (error) {
    next(error);
  }
});

// Branch from message
chatRouter.post('/branch/:messageId', requireAuth, async (req, res, next) => {
  try {
    const { messageId } = req.params;

    const message = await db.message.findUnique({
      where: { id: messageId },
      include: {
        thread: {
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!message) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Message not found');
    }

    if (message.thread.userId !== req.user!.id) {
      throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
    }

    // Create new thread as branch, inheriting the agent from parent
    const newThread = await db.thread.create({
      data: {
        title: `Branch from: ${message.thread.title}`,
        userId: req.user!.id,
        agentId: message.thread.agentId,
        parentThreadId: message.thread.id,
        parentMessageId: messageId,
      },
    });

    // Copy messages up to and including the branch point
    const messageIndex = message.thread.messages.findIndex((m) => m.id === messageId);
    const messagesToCopy = message.thread.messages.slice(0, messageIndex + 1);

    for (const msg of messagesToCopy) {
      await db.message.create({
        data: {
          threadId: newThread.id,
          role: msg.role,
          content: msg.content,
          files: msg.files || undefined,
        },
      });
    }

    // Note: We don't add the new user message here - the frontend will send it
    // via the normal chat endpoint, which triggers the AI response

    // Fetch the thread with all messages for the response
    const threadWithMessages = await db.thread.findUnique({
      where: { id: newThread.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    // Get agent info
    const agent = getAgentById(newThread.agentId);

    res.status(HTTP_STATUS.CREATED).json({
      thread: {
        ...threadWithMessages,
        agentName: agent?.name,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Submit feedback for a message
chatRouter.post('/feedback/:messageId', requireAuth, async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { type, comment } = req.body;

    if (!['up', 'down'].includes(type)) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'Invalid feedback type');
    }

    const message = await db.message.findUnique({
      where: { id: messageId },
      include: { thread: true },
    });

    if (!message) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Message not found');
    }

    // Upsert feedback
    const feedback = await db.messageFeedback.upsert({
      where: {
        messageId_userId: {
          messageId,
          userId: req.user!.id,
        },
      },
      update: { type, comment },
      create: {
        messageId,
        userId: req.user!.id,
        type,
        comment,
      },
    });

    // Send Slack notification for positive feedback on team threads
    if (type === 'up' && message.thread.teamId) {
      notifyMessageLiked(
        message.thread.teamId,
        req.user!.name,
        req.user!.email,
        message.thread.title
      ).catch(err => console.error('[Feedback] Slack notification failed:', err));
    }

    res.json({ feedback });
  } catch (error) {
    next(error);
  }
});

// Confirm or deny a tool call
chatRouter.post('/confirm-tool', requireAuth, async (req, res, next) => {
  try {
    const { confirmationId, approved, scope } = req.body as {
      confirmationId: string;
      approved: boolean;
      scope?: ConfirmationScope;
    };

    if (!confirmationId) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'confirmationId is required');
    }

    if (typeof approved !== 'boolean') {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'approved must be a boolean');
    }

    const pending = pendingConfirmations.get(confirmationId);
    if (!pending) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Confirmation not found or expired');
    }

    // Verify the user owns this confirmation
    if (pending.userId !== req.user!.id) {
      throw new AppError(HTTP_STATUS.FORBIDDEN, 'Not authorized to confirm this tool call');
    }

    // If "always allow", update user settings
    if (approved && scope === 'always') {
      const toolId = `${pending.serverId}:${pending.toolName}`;
      const user = await db.user.findUnique({
        where: { id: req.user!.id },
        select: { settings: true },
      });
      const currentSettings = (user?.settings as Record<string, unknown>) || {};
      const allowedTools = (currentSettings.allowedTools as string[]) || [];

      // Only add if not already present
      if (!allowedTools.includes(toolId)) {
        await db.user.update({
          where: { id: req.user!.id },
          data: {
            settings: {
              ...currentSettings,
              allowedTools: [...allowedTools, toolId],
            },
          },
        });
        console.log(`[ConfirmTool] Added ${toolId} to user ${req.user!.id}'s allowedTools`);
      }
    }

    // Resolve the pending confirmation
    const resolved = pendingConfirmations.resolve(confirmationId, approved, scope);
    if (!resolved) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Failed to resolve confirmation');
    }

    console.log(`[ConfirmTool] User ${req.user!.id} ${approved ? 'approved' : 'denied'} tool ${pending.serverId}:${pending.toolName} (scope: ${scope || 'once'})`);

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
