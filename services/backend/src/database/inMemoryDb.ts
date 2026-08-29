import { v4 as uuidv4 } from 'uuid';
import { User, Task, TaskEvent, Approval, Memory, Connection, UserContact, TaskFilterOptions, ScheduledRoutine, ScheduleStatus } from '@relay/shared-types';
import { IDatabaseRepository } from './types.js';

export class InMemoryRepository implements IDatabaseRepository {
  private users: Map<string, User> = new Map();
  private tasks: Map<string, Task> = new Map();
  private schedules: Map<string, ScheduledRoutine> = new Map();
  private events: Map<string, TaskEvent[]> = new Map();
  private approvals: Map<string, Approval> = new Map();
  private memories: Map<string, Memory[]> = new Map();
  private contacts: Map<string, UserContact[]> = new Map();
  private connections: Map<string, Connection[]> = new Map();

  constructor() {
    // Default demo/pilot user
    const defaultUser: User = {
      id: 'default-user',
      profile: {
        name: 'Chandra Shekhar',
        email: 'chandra@example.com',
        createdAt: new Date().toISOString(),
        timezone: 'Asia/Kolkata',
      },
      settings: {
        voiceEnabled: true,
        defaultProvider: 'groq',
        autoApproveLowRisk: true,
      },
    };
    this.users.set(defaultUser.id, defaultUser);
    this.users.set('user-chandra', {
      ...defaultUser,
      id: 'user-chandra',
    });
  }

  // Users
  async getUser(userId: string): Promise<User | null> {
    return this.users.get(userId) || null;
  }

  async saveUser(user: User): Promise<User> {
    this.users.set(user.id, user);
    return user;
  }

  async updateUserPushToken(userId: string, pushToken: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.profile.pushToken = pushToken;
      this.users.set(userId, user);
    }
  }

  // Tasks
  async getTask(userId: string, taskId: string): Promise<Task | null> {
    const task = this.tasks.get(taskId);
    if (!task || task.userId !== userId) return null;
    return task;
  }

  async saveTask(task: Task): Promise<Task> {
    const updated = {
      ...task,
      updatedAt: new Date().toISOString(),
    };
    this.tasks.set(task.id, updated);
    return updated;
  }

  async listTasks(userId: string, options: number | TaskFilterOptions = 50): Promise<Task[]> {
    const opts: TaskFilterOptions = typeof options === 'number' ? { limit: options } : options || {};
    const limit = opts.limit || 50;
    const query = opts.query?.toLowerCase().trim() || '';
    const status = opts.status && opts.status !== 'ALL' ? opts.status : undefined;
    const tool = opts.tool && opts.tool !== 'ALL' ? opts.tool.toLowerCase() : undefined;
    const source = opts.source && opts.source !== 'all' ? opts.source : undefined;

    // Calculate time horizon cutoff date if requested
    let horizonCutoff: number | null = null;
    if (opts.timeHorizon) {
      const now = Date.now();
      if (opts.timeHorizon === 'today') {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        horizonCutoff = d.getTime();
      } else if (opts.timeHorizon === 'week') {
        horizonCutoff = now - 7 * 24 * 60 * 60 * 1000;
      } else if (opts.timeHorizon === 'month') {
        horizonCutoff = now - 30 * 24 * 60 * 60 * 1000;
      }
    }

    const userTasks = Array.from(this.tasks.values())
      .filter((t) => {
        if (t.userId !== userId) return false;

        // Status filter
        if (status && t.status !== status) return false;

        // Source filter (manual vs scheduled)
        if (source && (t.source || 'manual') !== source) return false;

        // Tool / Channel filter (e.g. telephony, messaging, calendar, gmail, web)
        if (tool) {
          const hasTool = t.plan?.some((p) => {
            const toolName = (p.toolName || '').toLowerCase();
            if (tool === 'messaging') return toolName.includes('whatsapp') || toolName.includes('sms');
            if (tool === 'telephony') return toolName.includes('call') || toolName.includes('telephony');
            return toolName.includes(tool);
          });
          if (!hasTool) return false;
        }

        // Time horizon filter
        if (horizonCutoff !== null) {
          const taskTime = new Date(t.createdAt).getTime();
          if (taskTime < horizonCutoff) return false;
        }

        // Keyword query filter across goal, final answer, tool names, and step descriptions
        if (query) {
          const inGoal = t.goal.toLowerCase().includes(query);
          const inFinal = (t.finalAnswer || '').toLowerCase().includes(query);
          const inPlan = t.plan?.some(
            (p) =>
              (p.description || '').toLowerCase().includes(query) ||
              (p.toolName || '').toLowerCase().includes(query) ||
              JSON.stringify(p.args || {}).toLowerCase().includes(query)
          );
          if (!inGoal && !inFinal && !inPlan) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return userTasks.slice(0, limit);
  }

  // Schedules & Routines
  async saveSchedule(schedule: ScheduledRoutine): Promise<ScheduledRoutine> {
    const updated: ScheduledRoutine = {
      ...schedule,
      updatedAt: new Date().toISOString(),
    };
    this.schedules.set(schedule.id, updated);
    return updated;
  }

  async getSchedule(userId: string, id: string): Promise<ScheduledRoutine | null> {
    const schedule = this.schedules.get(id);
    if (!schedule || schedule.userId !== userId) return null;
    return schedule;
  }

  async listSchedules(userId: string, status?: ScheduleStatus | 'all'): Promise<ScheduledRoutine[]> {
    return Array.from(this.schedules.values())
      .filter((s) => {
        if (s.userId !== userId) return false;
        if (status && status !== 'all' && s.status !== status) return false;
        return true;
      })
      .sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime());
  }

  async getDueSchedules(nowUtcIso: string): Promise<ScheduledRoutine[]> {
    const nowTime = new Date(nowUtcIso).getTime();
    return Array.from(this.schedules.values()).filter((s) => {
      if (s.status !== 'active') return false;
      const nextTime = new Date(s.nextRunAt).getTime();
      return nextTime <= nowTime;
    });
  }

  async deleteSchedule(userId: string, id: string): Promise<boolean> {
    const schedule = this.schedules.get(id);
    if (!schedule || schedule.userId !== userId) return false;
    return this.schedules.delete(id);
  }


  async clearTaskHistory(userId: string): Promise<void> {
    for (const [id, task] of this.tasks.entries()) {
      if (task.userId === userId) {
        this.tasks.delete(id);
      }
    }
  }

  // Task Events
  async logEvent(event: Omit<TaskEvent, 'id' | 'timestamp'>): Promise<TaskEvent> {
    const fullEvent: TaskEvent = {
      ...event,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
    };

    const taskEvents = this.events.get(event.taskId) || [];
    taskEvents.push(fullEvent);
    this.events.set(event.taskId, taskEvents);
    return fullEvent;
  }

  async getTaskEvents(taskId: string): Promise<TaskEvent[]> {
    return this.events.get(taskId) || [];
  }

  // Approvals
  async createApproval(approval: Omit<Approval, 'id' | 'requestedAt'>): Promise<Approval> {
    const fullApproval: Approval = {
      ...approval,
      id: uuidv4(),
      requestedAt: new Date().toISOString(),
    };
    this.approvals.set(fullApproval.id, fullApproval);
    return fullApproval;
  }

  async getApproval(approvalId: string): Promise<Approval | null> {
    return this.approvals.get(approvalId) || null;
  }

  async getPendingApprovalForTask(taskId: string): Promise<Approval | null> {
    const list = await this.getPendingApprovalsForTask(taskId);
    return list.length > 0 ? list[0] : null;
  }

  async getPendingApprovalsForTask(taskId: string): Promise<Approval[]> {
    const pending: Approval[] = [];
    for (const approval of this.approvals.values()) {
      if (approval.taskId === taskId && !approval.decision) {
        pending.push(approval);
      }
    }
    return pending;
  }

  async resolveApproval(approvalId: string, decision: 'approved' | 'denied', reason?: string): Promise<Approval> {
    const approval = this.approvals.get(approvalId);
    if (!approval) {
      throw new Error(`Approval with id ${approvalId} not found`);
    }

    const updated: Approval = {
      ...approval,
      decision,
      decidedAt: new Date().toISOString(),
      denialReason: reason,
    };
    this.approvals.set(approvalId, updated);
    return updated;
  }

  // Memories
  async saveMemory(memory: Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>): Promise<Memory> {
    const userMemories = this.memories.get(memory.userId) || [];
    const now = new Date().toISOString();

    const existingIdx = userMemories.findIndex((m) => m.key === memory.key);
    let fullMemory: Memory;

    if (existingIdx >= 0) {
      fullMemory = {
        ...userMemories[existingIdx],
        ...memory,
        updatedAt: now,
      };
      userMemories[existingIdx] = fullMemory;
    } else {
      fullMemory = {
        ...memory,
        id: uuidv4(),
        createdAt: now,
        updatedAt: now,
      };
      userMemories.push(fullMemory);
    }

    this.memories.set(memory.userId, userMemories);
    return fullMemory;
  }

  async getMemories(userId: string, category?: string): Promise<Memory[]> {
    const userMemories = this.memories.get(userId) || [];
    if (!category) return userMemories;
    return userMemories.filter((m) => m.category === category);
  }

  async deleteMemory(userId: string, memoryId: string): Promise<boolean> {
    const userMemories = this.memories.get(userId) || [];
    const filtered = userMemories.filter((m) => m.id !== memoryId);
    this.memories.set(userId, filtered);
    return filtered.length < userMemories.length;
  }

  async clearAllMemories(userId: string): Promise<void> {
    this.memories.set(userId, []);
  }

  // User Device Contacts
  async saveUserContacts(userId: string, contacts: UserContact[]): Promise<void> {
    this.contacts.set(userId, contacts);
  }

  async getUserContacts(userId: string): Promise<UserContact[]> {
    return this.contacts.get(userId) || [];
  }

  async clearUserContacts(userId: string): Promise<void> {
    this.contacts.set(userId, []);
  }

  // Connections
  async saveConnection(connection: Connection): Promise<Connection> {
    const userConnections = this.connections.get(connection.userId) || [];
    const idx = userConnections.findIndex((c) => c.id === connection.id || c.provider === connection.provider);
    if (idx >= 0) {
      userConnections[idx] = connection;
    } else {
      userConnections.push(connection);
    }
    this.connections.set(connection.userId, userConnections);
    return connection;
  }

  async getConnection(userId: string, provider: 'google'): Promise<Connection | null> {
    const userConnections = this.connections.get(userId) || [];
    return userConnections.find((c) => c.provider === provider && c.status === 'active') || null;
  }

  async deleteConnection(userId: string, connectionId: string): Promise<boolean> {
    const userConnections = this.connections.get(userId) || [];
    const filtered = userConnections.filter((c) => c.id !== connectionId);
    this.connections.set(userId, filtered);
    return filtered.length < userConnections.length;
  }
}
