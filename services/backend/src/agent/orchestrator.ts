import { Task, User, PlanStep } from '@relay/shared-types';
import { AGENT_CONFIG } from '@relay/config';
import { IDatabaseRepository } from '../database/types.js';
import { ToolRegistry } from '../tools/registry.js';
import { PolicyEngine } from '../permissions/policy.js';
import { Planner } from './planner.js';
import { AgentContext } from './context.js';

export class AgentOrchestrator {
  private db: IDatabaseRepository;
  private registry: ToolRegistry;

  constructor(db: IDatabaseRepository) {
    this.db = db;
    this.registry = ToolRegistry.getInstance();
  }

  /**
   * Main Agent Execution Loop with state machine transitions and safety guardrails.
   */
  public async runTask(task: Task, user: User, customPlanner?: Planner): Promise<Task> {
    const planner = customPlanner || new Planner(user);
    const memories = await this.db.getMemories(user.id);
    const context = new AgentContext(task, user, memories);

    const startTime = Date.now();
    let currentTask: Task = { ...task, status: 'PLANNING' };

    await this.db.saveTask(currentTask);
    await this.db.logEvent({
      taskId: currentTask.id,
      type: 'status_change',
      status: 'started',
      message: `Started planning for goal: "${currentTask.goal}"`,
      safeMetadata: { provider: planner.getActiveProviderName() },
    });

    const terminalStatuses = ['COMPLETED', 'FAILED', 'CANCELLED', 'WAITING_APPROVAL'];

    while (!terminalStatuses.includes(currentTask.status)) {
      // 1. Guardrail checks: Max Iterations & Max Duration
      if (currentTask.iterations >= AGENT_CONFIG.MAX_ITERATIONS) {
        currentTask.status = 'FAILED';
        currentTask.error = `Agent exceeded maximum allowed iterations (${AGENT_CONFIG.MAX_ITERATIONS})`;
        await this.finalizeTask(currentTask);
        return currentTask;
      }

      const elapsed = Date.now() - startTime;
      if (elapsed >= AGENT_CONFIG.MAX_DURATION_MS) {
        currentTask.status = 'FAILED';
        currentTask.error = `Agent exceeded maximum execution duration (${AGENT_CONFIG.MAX_DURATION_MS / 1000}s)`;
        await this.finalizeTask(currentTask);
        return currentTask;
      }

      currentTask.iterations++;
      currentTask.status = 'EXECUTING';
      await this.db.saveTask(currentTask);

      // 2. Planner LLM Call
      let plan;
      try {
        plan = await planner.getNextStep(context.getMessages());
      } catch (plannerErr: any) {
        currentTask.status = 'FAILED';
        currentTask.error = `Planner failed: ${plannerErr.message}`;
        await this.finalizeTask(currentTask);
        return currentTask;
      }

      // 3. Handle Tool Call
      if (plan.type === 'tool_call' && plan.toolCalls && plan.toolCalls.length > 0) {
        context.addAssistantToolCalls(plan.text, plan.toolCalls);

        for (const toolCall of plan.toolCalls) {
          const toolDef = this.registry.get(toolCall.name);
          if (!toolDef) {
            currentTask.status = 'FAILED';
            currentTask.error = `Requested tool '${toolCall.name}' is not registered`;
            await this.finalizeTask(currentTask);
            return currentTask;
          }

          // Add to task plan steps
          const stepNumber = currentTask.plan.length + 1;
          const planStep: PlanStep = {
            id: toolCall.id,
            stepNumber,
            description: `${toolCall.name} execution`,
            toolName: toolCall.name,
            args: toolCall.args,
            status: 'in_progress',
          };
          currentTask.plan.push(planStep);
          currentTask.currentStep = stepNumber;
          await this.db.saveTask(currentTask);

          // 4. Deterministic Permission & Risk Evaluation
          const policy = PolicyEngine.evaluate(toolDef.requiredPermission, user);

          if (policy.decision === 'BLOCKED') {
            planStep.status = 'failed';
            currentTask.status = 'FAILED';
            currentTask.error = policy.reason || `Action '${toolDef.name}' is blocked by security policy.`;
            await this.db.logEvent({
              taskId: currentTask.id,
              type: 'error',
              tool: toolDef.name,
              status: 'failed',
              message: currentTask.error,
              safeMetadata: { capability: toolDef.requiredPermission },
            });
            await this.finalizeTask(currentTask);
            return currentTask;
          }

          if (policy.decision === 'NEEDS_CONFIRMATION') {
            // Create pending Approval record
            const description = PolicyEngine.formatApprovalDescription(toolCall.name, toolCall.args);
            const approval = await this.db.createApproval({
              userId: user.id,
              taskId: currentTask.id,
              toolName: toolCall.name,
              action: toolDef.requiredPermission,
              description,
              riskLevel: policy.riskLevel as 'HIGH' | 'CRITICAL',
              args: toolCall.args,
            });

            planStep.status = 'needs_approval';
            currentTask.pendingApproval = approval;
            currentTask.status = 'WAITING_APPROVAL';

            await this.db.logEvent({
              taskId: currentTask.id,
              type: 'approval_request',
              tool: toolDef.name,
              status: 'started',
              message: `Approval requested: ${description}`,
              safeMetadata: { approvalId: approval.id, riskLevel: policy.riskLevel },
            });

            await this.db.saveTask(currentTask);
            return currentTask; // Pause loop until user approval
          }

          // 5. Execute Tool with Guards
          await this.db.logEvent({
            taskId: currentTask.id,
            type: 'tool_call',
            tool: toolDef.name,
            status: 'started',
            message: `Executing ${toolDef.name}`,
            safeMetadata: { stepNumber },
          });

          const executionResult = await this.registry.executeWithGuards(toolCall.name, toolCall.args, {
            userId: user.id,
            taskId: currentTask.id,
            db: this.db,
          });

          if (!executionResult.success) {
            planStep.status = 'failed';
            currentTask.status = 'FAILED';
            currentTask.error = executionResult.error;
            await this.db.logEvent({
              taskId: currentTask.id,
              type: 'error',
              tool: toolDef.name,
              status: 'failed',
              message: executionResult.error,
              safeMetadata: { stepNumber },
            });
            await this.finalizeTask(currentTask);
            return currentTask;
          }

          planStep.status = 'completed';
          planStep.result = executionResult.output;
          planStep.verified = executionResult.verified;

          await this.db.logEvent({
            taskId: currentTask.id,
            type: 'tool_call',
            tool: toolDef.name,
            status: executionResult.verified ? 'verified' : 'succeeded',
            message: `Completed ${toolDef.name} (Verified: ${executionResult.verified})`,
            safeMetadata: { verified: executionResult.verified },
          });

          // 6. Wrap Tool Output into context
          context.addToolResult(toolCall.id, toolDef.name, executionResult.output);
        }
      } else if (plan.type === 'final_answer') {
        // 7. Verifying and Finalizing
        currentTask.status = 'VERIFYING';
        await this.db.saveTask(currentTask);

        currentTask.finalAnswer = plan.text || 'Goal successfully completed.';
        currentTask.status = 'COMPLETED';
        currentTask.completedAt = new Date().toISOString();

        await this.finalizeTask(currentTask);
        return currentTask;
      }
    }

    return currentTask;
  }

  /**
   * Resumes a paused task following a user's approval decision.
   */
  public async resumeWithApproval(
    taskId: string,
    approvalId: string,
    decision: 'approved' | 'denied',
    user: User,
    customPlanner?: Planner
  ): Promise<Task> {
    const task = await this.db.getTask(user.id, taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    if (task.status !== 'WAITING_APPROVAL') throw new Error(`Task is not waiting for approval (current: ${task.status})`);

    const approval = await this.db.resolveApproval(approvalId, decision);
    task.pendingApproval = undefined;

    await this.db.logEvent({
      taskId: task.id,
      type: 'approval_decision',
      status: decision === 'approved' ? 'succeeded' : 'failed',
      message: `User ${decision} action "${approval.description}"`,
      safeMetadata: { approvalId, decision },
    });

    if (decision === 'denied') {
      task.status = 'CANCELLED';
      task.error = `Action denied by user: ${approval.description}`;
      await this.finalizeTask(task);
      return task;
    }

    // Execute the approved tool call
    const toolDef = this.registry.get(approval.toolName);
    if (!toolDef) {
      task.status = 'FAILED';
      task.error = `Approved tool ${approval.toolName} not found`;
      await this.finalizeTask(task);
      return task;
    }

    const executionResult = await this.registry.executeWithGuards(approval.toolName, approval.args, {
      userId: user.id,
      taskId: task.id,
      db: this.db,
    });

    if (!executionResult.success) {
      task.status = 'FAILED';
      task.error = executionResult.error;
      await this.finalizeTask(task);
      return task;
    }

    // Update the pending step in plan
    const step = task.plan.find((s) => s.toolName === approval.toolName && s.status === 'needs_approval');
    if (step) {
      step.status = 'completed';
      step.result = executionResult.output;
      step.verified = executionResult.verified;
    }

    task.status = 'EXECUTING';
    await this.db.saveTask(task);

    // Continue the agent loop
    return this.runTask(task, user, customPlanner);
  }

  private async finalizeTask(task: Task): Promise<void> {
    task.updatedAt = new Date().toISOString();
    await this.db.saveTask(task);
    await this.db.logEvent({
      taskId: task.id,
      type: 'status_change',
      status: task.status === 'COMPLETED' ? 'succeeded' : 'failed',
      message: task.status === 'COMPLETED' ? `Task completed successfully` : `Task ended with status: ${task.status}`,
      safeMetadata: { finalStatus: task.status },
    });
  }
}
