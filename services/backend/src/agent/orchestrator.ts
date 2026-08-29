import { Task, User, PlanStep, Approval } from '@relay/shared-types';
import { AGENT_CONFIG } from '@relay/config';
import { IDatabaseRepository } from '../database/types.js';
import { ToolRegistry } from '../tools/registry.js';
import { PolicyEngine } from '../permissions/policy.js';
import { Planner } from './planner.js';
import { AgentContext } from './context.js';
import { dispatchApprovalAlert, dispatchTaskCompletionAlert, dispatchTaskFailureAlert } from '../scheduler/notifications.js';
import { TaskExecutionMutex } from './swarm/TaskExecutionMutex.js';
import { GoalDecomposer } from './swarm/GoalDecomposer.js';
import { SwarmPipelineExecutor } from './swarm/SwarmPipelineExecutor.js';

export class AgentOrchestrator {
  private db: IDatabaseRepository;
  private registry: ToolRegistry;
  private swarmExecutor: SwarmPipelineExecutor;
  private mutex: TaskExecutionMutex;

  constructor(db: IDatabaseRepository) {
    this.db = db;
    this.registry = ToolRegistry.getInstance();
    this.swarmExecutor = new SwarmPipelineExecutor(db);
    this.mutex = TaskExecutionMutex.getInstance();
  }

  /**
   * Main Agent Execution Loop with state machine transitions, safety guardrails, and swarm routing.
   * Serialized via TaskExecutionMutex per taskId.
   */
  public async runTask(task: Task, user: User, customPlanner?: Planner): Promise<Task> {
    return this.mutex.runExclusive(task.id, async () => {
      // Reload fresh state if already in database
      const existing = await this.db.getTask(user.id, task.id);
      const activeTask = existing || task;
      return this.runTaskInternal(activeTask, user, customPlanner);
    });
  }

  private async runTaskInternal(task: Task, user: User, customPlanner?: Planner): Promise<Task> {
    const planner = customPlanner || new Planner(user);

    // Initialize pendingApprovals array if needed
    if (!task.pendingApprovals) {
      task.pendingApprovals = [];
    }

    // 1. If task is already marked as a swarm or needs decomposition check
    if (task.isSwarm && task.subtasks && task.subtasks.length > 0) {
      return this.swarmExecutor.executeSwarm(task, user, planner);
    }

    // Check if new task should be decomposed into a multi-agent swarm
    if (task.status === 'CREATED' && !task.isSwarm && !task.coordinatorPlan) {
      const decomposition = await GoalDecomposer.decompose(task.goal, user, planner);

      if (decomposition.isDecomposed && decomposition.subtasks.length > 1) {
        task.isSwarm = true;
        task.coordinatorPlan = decomposition;
        task.subtasks = decomposition.subtasks.map((st) => ({
          ...st,
          parentTaskId: task.id,
        }));

        await this.db.saveTask(task);

        for (const st of task.subtasks) {
          await this.db.logEvent({
            taskId: task.id,
            subAgentId: st.id,
            subAgentType: st.agentType,
            type: 'subagent_spawned',
            status: 'started',
            message: `Spawned worker agent [${st.agentType}]: "${st.name}"`,
            safeMetadata: { subTaskId: st.id, stage: st.stage, archetype: st.agentType },
          });
        }

        return this.swarmExecutor.executeSwarm(task, user, planner);
      }
    }

    // 2. Standard Single-Agent Execution Loop
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
      // Guardrail checks: Max Iterations & Max Duration
      if (currentTask.iterations >= AGENT_CONFIG.MAX_ITERATIONS) {
        currentTask.status = 'FAILED';
        currentTask.error = `Agent exceeded maximum allowed iterations (${AGENT_CONFIG.MAX_ITERATIONS})`;
        await this.finalizeTask(currentTask, user);
        return currentTask;
      }

      const elapsed = Date.now() - startTime;
      if (elapsed >= AGENT_CONFIG.MAX_DURATION_MS) {
        currentTask.status = 'FAILED';
        currentTask.error = `Agent exceeded maximum execution duration (${AGENT_CONFIG.MAX_DURATION_MS / 1000}s)`;
        await this.finalizeTask(currentTask, user);
        return currentTask;
      }

      currentTask.iterations++;
      currentTask.status = 'EXECUTING';
      await this.db.saveTask(currentTask);

      // Planner LLM Call
      let plan;
      try {
        plan = await planner.getNextStep(context.getMessages());
      } catch (plannerErr: any) {
        currentTask.status = 'FAILED';
        currentTask.error = `Planner failed: ${plannerErr.message}`;
        await this.finalizeTask(currentTask, user);
        return currentTask;
      }

      // Handle Tool Call
      if (plan.type === 'tool_call' && plan.toolCalls && plan.toolCalls.length > 0) {
        context.addAssistantToolCalls(plan.text, plan.toolCalls);

        for (const toolCall of plan.toolCalls) {
          const toolDef = this.registry.get(toolCall.name);
          if (!toolDef) {
            currentTask.status = 'FAILED';
            currentTask.error = `Requested tool '${toolCall.name}' is not registered`;
            await this.finalizeTask(currentTask, user);
            return currentTask;
          }

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

          // Deterministic Permission & Risk Evaluation
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
            await this.finalizeTask(currentTask, user);
            return currentTask;
          }

          // Check auto-approval whitelist for autonomous routines
          const isPreApproved =
            Boolean(currentTask.autoApproveRoutine) &&
            Array.isArray(currentTask.preApprovedTools) &&
            currentTask.preApprovedTools.includes(toolCall.name);

          if (policy.decision === 'NEEDS_CONFIRMATION' && isPreApproved) {
            await this.db.logEvent({
              taskId: currentTask.id,
              type: 'approval_decision',
              tool: toolDef.name,
              status: 'succeeded',
              message: `Auto-approved "${toolCall.name}" via routine pre-approved permissions whitelist`,
              safeMetadata: { autoApproved: true, tool: toolCall.name },
            });
          } else if (policy.decision === 'NEEDS_CONFIRMATION') {
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
            currentTask.pendingApprovals = [approval];
            currentTask.status = 'WAITING_APPROVAL';

            await this.db.logEvent({
              taskId: currentTask.id,
              type: 'approval_request',
              tool: toolDef.name,
              status: 'started',
              message: `Approval requested: ${description}`,
              safeMetadata: { approvalId: approval.id, riskLevel: policy.riskLevel },
            });

            if (user.profile?.pushToken) {
              dispatchApprovalAlert(this.db, user, currentTask, approval).catch((err) => {
                console.warn(`[AgentOrchestrator] Non-blocking push notification failed: ${err.message}`);
              });
            }

            await this.db.saveTask(currentTask);
            return currentTask;
          }

          // Execute Tool with Guards
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
            await this.finalizeTask(currentTask, user);
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

          context.addToolResult(toolCall.id, toolDef.name, executionResult.output);
        }
      } else if (plan.type === 'final_answer') {
        currentTask.status = 'VERIFYING';
        await this.db.saveTask(currentTask);

        currentTask.finalAnswer = plan.text || 'Goal successfully completed.';
        currentTask.status = 'COMPLETED';
        currentTask.completedAt = new Date().toISOString();

        await this.finalizeTask(currentTask, user);
        return currentTask;
      }
    }

    return currentTask;
  }

  /**
   * Resumes a paused task following a user's approval decision.
   * Serialized via TaskExecutionMutex per taskId.
   */
  public async resumeWithApproval(
    taskId: string,
    approvalId: string,
    decision: 'approved' | 'denied',
    user: User,
    customPlanner?: Planner
  ): Promise<Task> {
    return this.mutex.runExclusive(taskId, async () => {
      // Reload freshly persisted state
      const task = await this.db.getTask(user.id, taskId);
      if (!task) throw new Error(`Task ${taskId} not found`);
      if (task.status !== 'WAITING_APPROVAL') throw new Error(`Task is not waiting for approval (current: ${task.status})`);

      // If this is a swarm task, delegate to SwarmPipelineExecutor
      if (task.isSwarm && task.subtasks && task.subtasks.length > 0) {
        return this.swarmExecutor.resumeSwarmApproval(task, approvalId, decision, user, customPlanner);
      }

      // Single-Agent resume path
      const approval = await this.db.resolveApproval(approvalId, decision);
      task.pendingApprovals = (task.pendingApprovals || []).filter((a) => a.id !== approvalId);

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
        await this.finalizeTask(task, user);
        return task;
      }

      const toolDef = this.registry.get(approval.toolName);
      if (!toolDef) {
        task.status = 'FAILED';
        task.error = `Approved tool ${approval.toolName} not found`;
        await this.finalizeTask(task, user);
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
        await this.finalizeTask(task, user);
        return task;
      }

      const step = task.plan.find((s) => s.toolName === approval.toolName && s.status === 'needs_approval');
      if (step) {
        step.status = 'completed';
        step.result = executionResult.output;
        step.verified = executionResult.verified;
      }

      // Auto-save food preference
      if (approval.toolName === 'food.prepareOrder' && approval.args) {
        try {
          const item = String(approval.args.itemName || 'Food Item');
          const rest = String(approval.args.restaurantName || 'Restaurant');
          const plat = String(approval.args.platform || 'delivery app');
          const price = approval.args.estimatedPrice ? `~₹${approval.args.estimatedPrice}` : '';
          const isCoffee = item.toLowerCase().includes('coffee');
          const memKey = isCoffee ? 'usual_coffee' : `favorite_${item.toLowerCase().replace(/[^\w]/g, '_').slice(0, 20)}`;
          await this.db.saveMemory({
            userId: user.id,
            key: memKey,
            value: `${item} from ${rest} on ${plat.toUpperCase()} (${price})`,
            category: 'preference',
            source: 'inferred',
            userApproved: true,
          });
        } catch {
          // Non-blocking
        }
      }

      task.status = 'EXECUTING';
      await this.db.saveTask(task);

      return this.runTaskInternal(task, user, customPlanner);
    });
  }

  /**
   * Resumes a completed task that asked a follow-up question.
   * Serialized via TaskExecutionMutex per taskId.
   */
  public async continueTaskWithReply(
    taskId: string,
    reply: string,
    user: User,
    customPlanner?: Planner
  ): Promise<Task> {
    return this.mutex.runExclusive(taskId, async () => {
      const task = await this.db.getTask(user.id, taskId);
      if (!task) throw new Error(`Task ${taskId} not found`);

      const now = new Date().toISOString();
      const history = task.followUpHistory || [];

      if (task.finalAnswer) {
        history.push({
          role: 'assistant',
          content: task.finalAnswer,
          timestamp: task.completedAt || now,
        });
      }

      history.push({
        role: 'user',
        content: reply.trim(),
        timestamp: now,
      });

      task.followUpHistory = history;
      task.finalAnswer = undefined;
      task.status = 'PLANNING';
      task.updatedAt = now;

      await this.db.saveTask(task);
      await this.db.logEvent({
        taskId: task.id,
        type: 'status_change',
        status: 'started',
        message: `User replied to continue mission: "${reply.trim()}"`,
        safeMetadata: { reply: reply.trim() },
      });

      return this.runTaskInternal(task, user, customPlanner);
    });
  }

  private async finalizeTask(task: Task, user?: User): Promise<void> {
    task.updatedAt = new Date().toISOString();
    await this.db.saveTask(task);
    await this.db.logEvent({
      taskId: task.id,
      type: 'status_change',
      status: task.status === 'COMPLETED' ? 'succeeded' : 'failed',
      message: task.status === 'COMPLETED' ? `Task completed successfully` : `Task ended with status: ${task.status}`,
      safeMetadata: { finalStatus: task.status },
    });

    if (task.source === 'scheduled' && user?.profile?.pushToken) {
      if (task.status === 'COMPLETED') {
        dispatchTaskCompletionAlert(this.db, user, task).catch((err) => {
          console.warn(`[AgentOrchestrator] Failed to dispatch completion push: ${err.message}`);
        });
      } else if (task.status === 'FAILED') {
        dispatchTaskFailureAlert(this.db, user, task).catch((err) => {
          console.warn(`[AgentOrchestrator] Failed to dispatch failure push: ${err.message}`);
        });
      }
    }
  }
}
