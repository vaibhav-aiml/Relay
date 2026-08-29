import { User, Task, TaskEvent, Approval, Memory, Connection, UserContact, TaskFilterOptions, ScheduledRoutine, ScheduleStatus } from '@relay/shared-types';

export interface IDatabaseRepository {
  // Users
  getUser(userId: string): Promise<User | null>;
  saveUser(user: User): Promise<User>;
  updateUserPushToken?(userId: string, pushToken: string): Promise<void>;

  // Tasks
  getTask(userId: string, taskId: string): Promise<Task | null>;
  saveTask(task: Task): Promise<Task>;
  listTasks(userId: string, options?: number | TaskFilterOptions): Promise<Task[]>;
  clearTaskHistory?(userId: string): Promise<void>;

  // Schedules & Routines
  saveSchedule(schedule: ScheduledRoutine): Promise<ScheduledRoutine>;
  getSchedule(userId: string, id: string): Promise<ScheduledRoutine | null>;
  listSchedules(userId: string, status?: ScheduleStatus | 'all'): Promise<ScheduledRoutine[]>;
  getDueSchedules(nowUtcIso: string): Promise<ScheduledRoutine[]>;
  deleteSchedule(userId: string, id: string): Promise<boolean>;

  // Task Events
  logEvent(event: Omit<TaskEvent, 'id' | 'timestamp'>): Promise<TaskEvent>;
  getTaskEvents(taskId: string): Promise<TaskEvent[]>;

  // Approvals
  createApproval(approval: Omit<Approval, 'id' | 'requestedAt'>): Promise<Approval>;
  getApproval(approvalId: string): Promise<Approval | null>;
  getPendingApprovalForTask(taskId: string): Promise<Approval | null>;
  getPendingApprovalsForTask(taskId: string): Promise<Approval[]>;
  resolveApproval(approvalId: string, decision: 'approved' | 'denied', reason?: string): Promise<Approval>;

  // Memories
  saveMemory(memory: Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>): Promise<Memory>;
  getMemories(userId: string, category?: string): Promise<Memory[]>;
  deleteMemory(userId: string, memoryId: string): Promise<boolean>;
  clearAllMemories(userId: string): Promise<void>;

  // User Device Contacts
  saveUserContacts(userId: string, contacts: UserContact[]): Promise<void>;
  getUserContacts(userId: string): Promise<UserContact[]>;
  clearUserContacts(userId: string): Promise<void>;

  // Connections
  saveConnection(connection: Connection): Promise<Connection>;
  getConnection(userId: string, provider: 'google'): Promise<Connection | null>;
  deleteConnection(userId: string, connectionId: string): Promise<boolean>;
}


