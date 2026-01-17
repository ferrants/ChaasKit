import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { getAgentsForPlan, getAgentClientInfo } from '../services/agents.js';

export const agentsRouter = Router();

/**
 * GET /api/agents
 * List agents available to the current user based on their plan.
 * Returns agent info suitable for display (id, name, isDefault).
 */
agentsRouter.get('/', optionalAuth, async (req, res, next) => {
  try {
    const userPlan = req.user?.plan;
    const agents = getAgentsForPlan(userPlan);

    const agentList = agents.map(getAgentClientInfo);

    res.json({ agents: agentList });
  } catch (error) {
    next(error);
  }
});
