import { User, Task, TaskEvent, Approval, Memory, Connection } from '@relay/shared-types';

export interface IDatabaseRepository {
  // Users
  getUser(userId: string): Promise<User | null>;
  saveUser(user: User): Promise<User>;

  // Tasks
  getTask(userId: string, taskId: string): Promise<Task | null>;
  saveTask(task: Task): Promise<Task>;
  listTasks(userId: string, limit?: number): Promise<Task[]>;

  // Task Events
  logEvent(event: Omit<TaskEvent, 'id' | 'timestamp'>): Promise<TaskEvent>;
  getTaskEvents(taskId: string): Promise<TaskEvent[]>;

  // Approvals
  createApproval(approval: Omit<Approval, 'id' | 'requestedAt'>): Promise<Approval>;
  getApproval(approvalId: string): Promise<Approval | null>;
  getPendingApprovalForTask(taskId: string): Promise<Approval | null>;
  resolveApproval(approvalId: string, decision: 'approved' | 'denied', reason?: string): Promise<Approval>;

  // Memories
  saveMemory(memory: Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>): Promise<Memory>;
  getMemories(userId: string, category?: string): Promise<Memory[]>;
  deleteMemory(userId: string, memoryId: string): Promise<boolean>;
  clearAllMemories(userId: string): Promise<void>;

  // Connections
  saveConnection(connection: Connection): Promise<Connection>;
  getConnection(userId: string, provider: 'google'): Promise<Connection | null>;
  deleteConnection(userId: string, connectionId: string): Promise<boolean>;
}
