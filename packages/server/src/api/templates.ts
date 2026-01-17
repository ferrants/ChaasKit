import { Router } from 'express';
import { db } from '@chaaskit/db';
import { HTTP_STATUS } from '@chaaskit/shared';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { getConfig } from '../config/loader.js';
import { z } from 'zod';

export const templatesRouter = Router();

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  prompt: z.string().min(1).max(10000),
  variables: z.array(z.string()).optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  prompt: z.string().min(1).max(10000).optional(),
  variables: z.array(z.string()).optional(),
});

// List templates (built-in + user)
templatesRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const config = getConfig();

    if (!config.promptTemplates?.enabled) {
      res.json({ templates: [] });
      return;
    }

    // Get built-in templates
    const builtIn = config.promptTemplates.builtIn.map((t) => ({
      ...t,
      isBuiltIn: true,
    }));

    // Get user templates
    const userTemplates = await db.promptTemplate.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });

    const user = userTemplates.map((t) => ({
      id: t.id,
      name: t.name,
      prompt: t.prompt,
      variables: t.variables as string[],
      isBuiltIn: false,
    }));

    res.json({ templates: [...builtIn, ...user] });
  } catch (error) {
    next(error);
  }
});

// Create user template
templatesRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const config = getConfig();

    if (!config.promptTemplates?.enabled || !config.promptTemplates?.allowUserTemplates) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, 'User templates are disabled');
    }

    const { name, prompt, variables } = createTemplateSchema.parse(req.body);

    const template = await db.promptTemplate.create({
      data: {
        userId: req.user!.id,
        name,
        prompt,
        variables: variables || [],
      },
    });

    res.status(HTTP_STATUS.CREATED).json({
      template: {
        id: template.id,
        name: template.name,
        prompt: template.prompt,
        variables: template.variables,
        isBuiltIn: false,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Update user template
templatesRouter.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = updateTemplateSchema.parse(req.body);

    const template = await db.promptTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Template not found');
    }

    if (template.userId !== req.user!.id) {
      throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
    }

    const updated = await db.promptTemplate.update({
      where: { id },
      data: updates,
    });

    res.json({
      template: {
        id: updated.id,
        name: updated.name,
        prompt: updated.prompt,
        variables: updated.variables,
        isBuiltIn: false,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Delete user template
templatesRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const template = await db.promptTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new AppError(HTTP_STATUS.NOT_FOUND, 'Template not found');
    }

    if (template.userId !== req.user!.id) {
      throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
    }

    await db.promptTemplate.delete({
      where: { id },
    });

    res.status(HTTP_STATUS.NO_CONTENT).send();
  } catch (error) {
    next(error);
  }
});
