import { Router } from 'express';
import { db, Prisma } from '@chaaskit/db';
import { HTTP_STATUS, searchSchema } from '@chaaskit/shared';
import { requireAuth } from '../middleware/auth.js';

export const searchRouter = Router();

// Search across threads and messages using ILIKE
searchRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const { q, threadId, limit = 20, offset = 0 } = searchSchema.parse(req.query);

    // Sanitize search term for ILIKE
    const searchPattern = `%${q.replace(/[%_]/g, '\\$&')}%`;

    // Build conditional thread filter
    const threadFilter = threadId
      ? Prisma.sql`AND t.id = ${threadId}`
      : Prisma.empty;

    // Search messages using ILIKE (simpler, works with all PostgreSQL versions)
    const messages = await db.$queryRaw<
      Array<{
        id: string;
        threadId: string;
        role: string;
        content: string;
        createdAt: Date;
        threadTitle: string;
      }>
    >(Prisma.sql`
      SELECT
        m.id,
        m."threadId",
        m.role,
        m.content,
        m."createdAt",
        t.title as "threadTitle"
      FROM "Message" m
      JOIN "Thread" t ON m."threadId" = t.id
      WHERE
        t."userId" = ${req.user!.id}
        ${threadFilter}
        AND m.content ILIKE ${searchPattern}
      ORDER BY m."createdAt" DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    // Get total count
    const countResult = await db.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*) as count
      FROM "Message" m
      JOIN "Thread" t ON m."threadId" = t.id
      WHERE
        t."userId" = ${req.user!.id}
        ${threadFilter}
        AND m.content ILIKE ${searchPattern}
    `);

    const total = Number(countResult[0]?.count || 0);

    // Escape HTML to prevent XSS when rendering highlights
    const escapeHtml = (value: string): string => {
      return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    // Generate simple highlights by finding the search term in content
    const highlightText = (text: string, query: string): string => {
      const maxLength = 150;
      const lowerText = text.toLowerCase();
      const lowerQuery = query.toLowerCase();
      const index = lowerText.indexOf(lowerQuery);

      if (index === -1) {
        const snippet = text.slice(0, maxLength) + (text.length > maxLength ? '...' : '');
        return escapeHtml(snippet);
      }

      const start = Math.max(0, index - 50);
      const end = Math.min(text.length, index + query.length + 50);
      let snippet = text.slice(start, end);

      if (start > 0) snippet = '...' + snippet;
      if (end < text.length) snippet = snippet + '...';

      // Wrap match in <mark> tags (escape snippet first)
      const escapedSnippet = escapeHtml(snippet);
      const escapedQuery = escapeHtml(query);
      const regex = new RegExp(`(${escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      return escapedSnippet.replace(regex, '<mark>$1</mark>');
    };

    res.json({
      results: messages.map((m) => ({
        id: m.id,
        threadId: m.threadId,
        threadTitle: m.threadTitle,
        role: m.role,
        content: m.content,
        highlight: highlightText(m.content, q),
        createdAt: m.createdAt,
      })),
      total,
      limit,
      offset,
    });
  } catch (error) {
    next(error);
  }
});
