import { create } from 'zustand';
import { Linking } from 'react-native';
import { Task, TaskEvent, Connection, Memory, UserContact } from '@relay/shared-types';
import { ApiService } from '../services/api';
import { DeviceContactsService } from '../services/contacts';

interface AppState {
  currentTask: Task | null;
  taskEvents: TaskEvent[];
  tasks: Task[];
  connections: Connection[];
  memories: Memory[];
  syncedContacts: UserContact[];
  isLoading: boolean;
  isPolling: boolean;
  isSyncingContacts: boolean;
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
  fetchSyncedContacts: () => Promise<void>;
  syncDeviceContacts: (force?: boolean) => Promise<{ success: boolean; count: number; skipped?: boolean; error?: string }>;
  clearSyncedContacts: () => Promise<void>;
  clearError: () => void;
}


export const useAppStore = create<AppState>((set, get) => ({
  currentTask: null,
  taskEvents: [],
  tasks: [],
  connections: [],
  memories: [],
  syncedContacts: [],
  isLoading: false,
  isPolling: false,
  isSyncingContacts: false,
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
    const current = get().currentTask;
    const pending = current?.pendingApproval;

    try {
      // If user approved a phone call, launch native dialer
      if (decision === 'approved' && pending?.toolName === 'telephony.makeCall') {
        const rawPhone = String(pending.args?.phoneNumber || '');
        if (rawPhone) {
          const clean = rawPhone.replace(/[^\d+]/g, '');
          Linking.openURL(`tel:${clean}`).catch((e) => {
            console.warn('Could not open native phone dialer:', e);
          });
        }
      }

      await ApiService.submitApprovalDecision(approvalId, decision, reason);
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

  fetchSyncedContacts: async () => {
    try {
      const { contacts } = await ApiService.getSyncedContacts();
      set({ syncedContacts: contacts || [] });
    } catch (err: any) {
      console.warn('Failed to fetch synced contacts:', err);
    }
  },

  syncDeviceContacts: async (force = false) => {
    set({ isSyncingContacts: true });
    try {
      const res = await DeviceContactsService.syncContacts(force);
      if (res.success && !res.skipped) {
        await get().fetchSyncedContacts();
      }
      set({ isSyncingContacts: false });
      return res;
    } catch (err: any) {
      set({ isSyncingContacts: false });
      return { success: false, count: 0, error: err.message };
    }
  },

  clearSyncedContacts: async () => {
    set({ isSyncingContacts: true });
    try {
      await DeviceContactsService.clearSyncedContacts();
      set({ syncedContacts: [], isSyncingContacts: false });
    } catch (err: any) {
      set({ isSyncingContacts: false, error: err.message });
    }
  },

  clearError: () => set({ error: null }),
}));

