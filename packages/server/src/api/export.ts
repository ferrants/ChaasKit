import { Router } from 'express';
import { db } from '@chaaskit/db';
import { HTTP_STATUS } from '@chaaskit/shared';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

export const exportRouter = Router();

// Export thread
exportRouter.get('/:threadId', requireAuth, async (req, res, next) => {
  try {
    const { threadId } = req.params;
    const { format = 'markdown' } = req.query;

    const thread = await db.thread.findUnique({
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

    if (thread.userId !== req.user!.id) {
      throw new AppError(HTTP_STATUS.FORBIDDEN, 'Access denied');
    }

    switch (format) {
      case 'json': {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${thread.title}.json"`
        );
        res.json({
          thread: {
            id: thread.id,
            title: thread.title,
            createdAt: thread.createdAt,
            messages: thread.messages.map((m) => ({
              role: m.role,
              content: m.content,
              createdAt: m.createdAt,
            })),
          },
          exportedAt: new Date().toISOString(),
        });
        break;
      }

      case 'markdown':
      default: {
        let markdown = `# ${thread.title}\n\n`;
        markdown += `*Exported: ${new Date().toLocaleDateString()}*\n\n`;
        markdown += `---\n\n`;

        for (const message of thread.messages) {
          const roleLabel = message.role === 'user' ? '**You**' : '**Assistant**';
          markdown += `${roleLabel}:\n\n${message.content}\n\n---\n\n`;
        }

        res.setHeader('Content-Type', 'text/markdown');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${thread.title}.md"`
        );
        res.send(markdown);
        break;
      }

      case 'pdf': {
        // For PDF, we return a simple HTML that can be printed to PDF
        // In production, you'd use a library like puppeteer or html-pdf
        let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${thread.title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; }
    h1 { border-bottom: 1px solid #ccc; padding-bottom: 10px; }
    .message { margin: 20px 0; padding: 15px; border-radius: 8px; }
    .user { background: #e3f2fd; }
    .assistant { background: #f5f5f5; }
    .role { font-weight: bold; margin-bottom: 10px; }
    .content { white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>${thread.title}</h1>
  <p><em>Exported: ${new Date().toLocaleDateString()}</em></p>
`;

        for (const message of thread.messages) {
          html += `<div class="message ${message.role}">
  <div class="role">${message.role === 'user' ? 'You' : 'Assistant'}</div>
  <div class="content">${escapeHtml(message.content)}</div>
</div>`;
        }

        html += `</body></html>`;

        res.setHeader('Content-Type', 'text/html');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${thread.title}.html"`
        );
        res.send(html);
        break;
      }
    }
  } catch (error) {
    next(error);
  }
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
