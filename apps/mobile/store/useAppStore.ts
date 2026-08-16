import { create } from 'zustand';
import { Task, TaskEvent, Connection, Memory } from '@relay/shared-types';
import { ApiService } from '../services/api';

interface AppState {
  currentTask: Task | null;
  taskEvents: TaskEvent[];
  tasks: Task[];
  connections: Connection[];
  memories: Memory[];
  isLoading: boolean;
  isPolling: boolean;
  error: string | null;

  // Actions
  createTask: (goal: string) => Promise<Task>;
  fetchTask: (taskId: string) => Promise<void>;
  pollTaskUntilDone: (taskId: string) => () => void;
  submitApproval: (approvalId: string, decision: 'approved' | 'denied', reason?: string) => Promise<void>;
  cancelCurrentTask: () => Promise<void>;
  fetchTasks: () => Promise<void>;
  fetchConnections: () => Promise<void>;
  fetchMemories: () => Promise<void>;
  addMemory: (key: string, value: string, category?: string) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentTask: null,
  taskEvents: [],
  tasks: [],
  connections: [],
  memories: [],
  isLoading: false,
  isPolling: false,
  error: null,

  createTask: async (goal: string) => {
    set({ isLoading: true, error: null });
    try {
      const { task } = await ApiService.createTask(goal);
      set({ currentTask: task, taskEvents: [], isLoading: false });
      get().fetchTasks();
      return task;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  fetchTask: async (taskId: string) => {
    try {
      const { task, events } = await ApiService.getTask(taskId);
      set({ currentTask: task, taskEvents: events });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  pollTaskUntilDone: (taskId: string) => {
    set({ isPolling: true });
    const interval = setInterval(async () => {
      try {
        const { task, events } = await ApiService.getTask(taskId);
        set({ currentTask: task, taskEvents: events });

        if (
          task.status === 'COMPLETED' ||
          task.status === 'FAILED' ||
          task.status === 'CANCELLED' ||
          task.status === 'WAITING_APPROVAL'
        ) {
          if (task.status !== 'WAITING_APPROVAL') {
            clearInterval(interval);
            set({ isPolling: false });
          }
          get().fetchTasks();
        }
      } catch (err) {
        clearInterval(interval);
        set({ isPolling: false });
      }
    }, 1200);

    return () => {
      clearInterval(interval);
      set({ isPolling: false });
    };
  },

  submitApproval: async (approvalId: string, decision: 'approved' | 'denied', reason?: string) => {
    set({ isLoading: true, error: null });
    try {
      await ApiService.submitApprovalDecision(approvalId, decision, reason);
      const current = get().currentTask;
      if (current) {
        get().pollTaskUntilDone(current.id);
      }
      set({ isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  cancelCurrentTask: async () => {
    const current = get().currentTask;
    if (!current) return;
    try {
      const { task } = await ApiService.cancelTask(current.id);
      set({ currentTask: task });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchTasks: async () => {
    try {
      const { tasks } = await ApiService.listTasks();
      set({ tasks });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchConnections: async () => {
    try {
      const { connections } = await ApiService.listConnections();
      set({ connections });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  fetchMemories: async () => {
    try {
      const { memories } = await ApiService.listMemories();
      set({ memories });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  addMemory: async (key: string, value: string, category?: string) => {
    try {
      await ApiService.saveMemory(key, value, category);
      get().fetchMemories();
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteMemory: async (id: string) => {
    try {
      await ApiService.deleteMemory(id);
      get().fetchMemories();
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  clearError: () => set({ error: null }),
}));
