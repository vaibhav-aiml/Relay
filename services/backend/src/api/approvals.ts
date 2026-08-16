import { FastifyInstance } from 'fastify';
import { ApprovalDecisionRequest } from '@relay/shared-types';
import { getDatabase } from '../database/index.js';
import { AgentOrchestrator } from '../agent/orchestrator.js';
import { AuthenticatedRequest, authMiddleware } from '../auth/middleware.js';

export async function approvalRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  const db = getDatabase();
  const orchestrator = new AgentOrchestrator(db);

  // Get approval details
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const { id } = req.params;
    const approval = await db.getApproval(id);
    if (!approval) {
      return reply.status(404).send({ error: 'Approval not found' });
    }
    return reply.send({ approval });
  });

  // Submit approval decision ('approved' | 'denied')
  app.post<{ Params: { id: string }; Body: ApprovalDecisionRequest }>('/:id/decision', async (req, reply) => {
    const user = (req as AuthenticatedRequest).user;
    const { id } = req.params;
    const { decision, denialReason } = req.body;

    if (decision !== 'approved' && decision !== 'denied') {
      return reply.status(400).send({ error: 'Decision must be "approved" or "denied"' });
    }

    const approval = await db.getApproval(id);
    if (!approval) {
      return reply.status(404).send({ error: 'Approval not found' });
    }

    if (approval.decision) {
      return reply.status(409).send({ error: 'Approval has already been resolved' });
    }

    try {
      // Resume task loop asynchronously
      const taskPromise = orchestrator.resumeWithApproval(approval.taskId, approval.id, decision, user);
      taskPromise.catch((err) => {
        req.log.error({ err, taskId: approval.taskId }, 'Error resuming task after approval');
      });

      return reply.send({
        success: true,
        approvalId: id,
        decision,
        message: `Decision '${decision}' recorded. Task execution resumed.`,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: `Failed to resume task: ${err.message}` });
    }
  });
}
