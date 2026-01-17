import { Router } from 'express';
import { db } from '@chaaskit/db';

export const healthRouter = Router();

healthRouter.get('/', async (req, res) => {
  try {
    // Check database connection
    await db.$queryRaw`SELECT 1`;

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
    });
  }
});

healthRouter.get('/ready', async (req, res) => {
  res.json({ ready: true });
});
