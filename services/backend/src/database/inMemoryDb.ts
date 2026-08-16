import { v4 as uuidv4 } from 'uuid';
import { User, Task, TaskEvent, Approval, Memory, Connection } from '@relay/shared-types';
import { IDatabaseRepository } from './types.js';

export class InMemoryRepository implements IDatabaseRepository {
  private users: Map<string, User> = new Map();
  private tasks: Map<string, Task> = new Map();
  private events: Map<string, TaskEvent[]> = new Map();
  private approvals: Map<string, Approval> = new Map();
  private memories: Map<string, Memory[]> = new Map();
  private connections: Map<string, Connection[]> = new Map();

  constructor() {
    // Default demo/pilot user
    const defaultUser: User = {
      id: 'default-user',
      profile: {
        name: 'Chandra Shekhar',
        email: 'chandra@example.com',
        createdAt: new Date().toISOString(),
      },
      settings: {
        voiceEnabled: true,
        defaultProvider: 'groq',
        autoApproveLowRisk: true,
      },
    };
    this.users.set(defaultUser.id, defaultUser);
  }

  // Users
  async getUser(userId: string): Promise<User | null> {
    return this.users.get(userId) || null;
  }

  async saveUser(user: User): Promise<User> {
    this.users.set(user.id, user);
    return user;
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

  async listTasks(userId: string, limit: number = 20): Promise<Task[]> {
    const userTasks = Array.from(this.tasks.values())
      .filter((t) => t.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return userTasks.slice(0, limit);
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
    for (const approval of this.approvals.values()) {
      if (approval.taskId === taskId && !approval.decision) {
        return approval;
      }
    }
    return null;
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
