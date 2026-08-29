import { create } from 'zustand';
import { Linking, Alert } from 'react-native';
import { Task, TaskEvent, Connection, Memory, UserContact, TaskFilterOptions } from '@relay/shared-types';
import { ApiService } from '../services/api';
import { DeviceContactsService } from '../services/contacts';
import { MobileNotificationService } from '../services/notifications';
import { TTSService } from '../services/tts';

interface AppState {
  currentTask: Task | null;
  taskEvents: TaskEvent[];
  tasks: Task[];
  connections: Connection[];
  memories: Memory[];
  syncedContacts: UserContact[];
  pushToken: string | null;
  pushPermissionStatus: 'granted' | 'denied' | 'undetermined';
  isRegisteringPush: boolean;
  isLoading: boolean;
  isPolling: boolean;
  isSyncingContacts: boolean;
  error: string | null;

  // TTS state
  ttsEnabled: boolean;
  isSpeaking: boolean;
  // Transition-edge guard: maps taskId → last status we spoke for.
  // Prevents re-speaking on every 1200ms poll tick (especially for WAITING_APPROVAL).
  lastSpokenTaskStatus: Map<string, string>;

  // Actions
  createTask: (goal: string) => Promise<Task>;
  fetchTask: (taskId: string) => Promise<void>;
  pollTaskUntilDone: (taskId: string) => () => void;
  submitApproval: (approvalId: string, decision: 'approved' | 'denied', reason?: string) => Promise<void>;
  submitTaskReply: (reply: string) => Promise<void>;
  cancelCurrentTask: () => Promise<void>;
  fetchTasks: (filters?: TaskFilterOptions) => Promise<void>;
  clearTaskHistory: () => Promise<void>;
  fetchConnections: () => Promise<void>;
  fetchMemories: () => Promise<void>;
  addMemory: (key: string, value: string, category?: string) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  fetchSyncedContacts: () => Promise<void>;
  syncDeviceContacts: (force?: boolean) => Promise<{ success: boolean; count: number; skipped?: boolean; error?: string }>;
  clearSyncedContacts: () => Promise<void>;
  checkPushPermission: () => Promise<void>;
  requestPushPermissionAndRegister: () => Promise<{ success: boolean; token?: string; error?: string }>;
  sendTestPushNotification: () => Promise<void>;

  // TTS actions
  initTTSSettings: () => Promise<void>;
  toggleTTS: () => Promise<void>;
  speakResponse: (text: string) => Promise<void>;
  clearError: () => void;
}


export const useAppStore = create<AppState>((set, get) => ({
  currentTask: null,
  taskEvents: [],
  tasks: [],
  connections: [],
  memories: [],
  syncedContacts: [],
  pushToken: null,
  pushPermissionStatus: 'undetermined',
  isRegisteringPush: false,
  isLoading: false,
  isPolling: false,
  isSyncingContacts: false,
  error: null,

  // TTS initial state
  ttsEnabled: true,
  isSpeaking: false,
  lastSpokenTaskStatus: new Map(),

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

    let timer: NodeJS.Timeout | null = null;
    let isCancelled = false;
    const startTime = Date.now();

    /**
     * Quota Optimization & Backoff Schedule:
     * Previously polled on an aggressive fixed interval which exhausted the Firestore Spark daily
     * quota cap (8 RESOURCE_EXHAUSTED). Now uses a progressive backoff:
     * - First ~10s: 1200ms (fast UI feedback for quick single-turn queries)
     * - Next ~30s (10s-40s): 3000ms (moderate polling for typical planner runs)
     * - Beyond 40s: 6000ms (relaxed polling for multi-stage swarms and waiting approvals)
     * - After 10 minutes: Stop polling (hard ceiling to prevent backgrounded/abandoned tabs from running forever)
     */
    const getNextDelayMs = (elapsedMs: number): number | null => {
      const TEN_MINUTES_MS = 10 * 60 * 1000;
      if (elapsedMs >= TEN_MINUTES_MS) {
        return null; // Stop auto-polling after hard ceiling
      }
      if (elapsedMs < 10_000) {
        return 1200;
      }
      if (elapsedMs < 40_000) {
        return 3000;
      }
      return 6000;
    };

    const scheduleNext = () => {
      if (isCancelled) return;
      const elapsed = Date.now() - startTime;
      const delay = getNextDelayMs(elapsed);
      if (delay === null) {
        set({ isPolling: false });
        return;
      }
      timer = setTimeout(async () => {
        await pollTick();
      }, delay);
    };

    const pollTick = async () => {
      if (isCancelled) return;
      try {
        const { task, events } = await ApiService.getTask(taskId);
        if (isCancelled) return;
        set({ currentTask: task, taskEvents: events });

        // ─── Auto-speak with transition-edge detection ───
        const { ttsEnabled, lastSpokenTaskStatus, speakResponse } = get();
        if (ttsEnabled) {
          const previousStatus = lastSpokenTaskStatus.get(taskId);
          const currentStatus = task.status;

          // Only speak if status CHANGED since last tick
          if (currentStatus !== previousStatus) {
            const settings = TTSService.getSettings();
            if (currentStatus === 'COMPLETED' && task.finalAnswer && settings.autoSpeakResults) {
              speakResponse(task.finalAnswer);
            } else if (
              currentStatus === 'WAITING_APPROVAL' &&
              task.pendingApprovals &&
              task.pendingApprovals.length > 0 &&
              settings.autoSpeakApprovals
            ) {
              const count = task.pendingApprovals.length;
              const firstAppr = task.pendingApprovals[0];
              const msg =
                count > 1
                  ? `I need your approval for ${count} actions, starting with ${firstAppr?.description}`
                  : `I need your approval to ${firstAppr?.description}`;
              speakResponse(msg);
            }
            // Record what we spoke so we don't repeat on next tick
            const next = new Map(lastSpokenTaskStatus);
            next.set(taskId, currentStatus);
            set({ lastSpokenTaskStatus: next });
          }
        }

        if (
          task.status === 'COMPLETED' ||
          task.status === 'FAILED' ||
          task.status === 'CANCELLED' ||
          task.status === 'WAITING_APPROVAL'
        ) {
          if (task.status !== 'WAITING_APPROVAL') {
            isCancelled = true;
            if (timer) clearTimeout(timer);
            set({ isPolling: false });
            // Clean up edge-guard entry — prevents unbounded Map growth
            const next = new Map(get().lastSpokenTaskStatus);
            next.delete(taskId);
            set({ lastSpokenTaskStatus: next });
          } else {
            // Task is waiting for user approval: continue polling at widened rate
            scheduleNext();
          }
          get().fetchTasks();
        } else {
          // Task still executing (EXECUTING, PLANNING, etc.): continue polling with backoff
          scheduleNext();
        }
      } catch (err) {
        isCancelled = true;
        if (timer) clearTimeout(timer);
        set({ isPolling: false });
      }
    };

    // Immediate initial check (saves up to 1-2s for fast LLM answers)
    pollTick();

    return () => {
      isCancelled = true;
      if (timer) clearTimeout(timer);
      set({ isPolling: false });
    };
  },

  submitApproval: async (approvalId: string, decision: 'approved' | 'denied', reason?: string) => {
    set({ isLoading: true, error: null });
    const current = get().currentTask;
    const pending = current?.pendingApprovals?.find((a) => a.id === approvalId);

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

      // If user approved a WhatsApp message, open WhatsApp deep link
      if (decision === 'approved' && pending?.toolName === 'messaging.sendWhatsApp') {
        const rawPhone = String(pending.args?.phoneNumber || '');
        const msgBody = String(pending.args?.messageBody || '');
        if (rawPhone) {
          const clean = rawPhone.replace(/[^\d+]/g, '');
          const encoded = encodeURIComponent(msgBody);
          const url = `whatsapp://send?phone=${clean}&text=${encoded}`;
          Linking.openURL(url).catch(() => {
            Alert.alert(
              'WhatsApp Not Found',
              'WhatsApp is not installed on this device. Please install WhatsApp or use SMS instead.',
            );
          });
        }
      }

      // If user approved an SMS message, open native SMS app
      if (decision === 'approved' && pending?.toolName === 'messaging.sendSMS') {
        const rawPhone = String(pending.args?.phoneNumber || '');
        const msgBody = String(pending.args?.messageBody || '');
        if (rawPhone) {
          const clean = rawPhone.replace(/[^\d+]/g, '');
          const encoded = encodeURIComponent(msgBody);
          const url = `sms:${clean}?body=${encoded}`;
          Linking.openURL(url).catch((e) => {
            console.warn('Could not open SMS app:', e);
          });
        }
      }

      // If user approved a food order, open the platform deep link (Zomato/Swiggy/Blinkit/Zepto) with automatic web fallback
      if (decision === 'approved' && pending?.toolName === 'food.prepareOrder') {
        const deepLinkUrl = String(pending.args?.deepLinkUrl || '');
        const webFallbackUrl = String(pending.args?.webFallbackUrl || '');
        const platformName = String(pending.args?.platform || 'Food Delivery App');

        try {
          if (deepLinkUrl) {
            const canOpen = await Linking.canOpenURL(deepLinkUrl).catch(() => false);
            if (canOpen) {
              await Linking.openURL(deepLinkUrl);
            } else if (webFallbackUrl) {
              await Linking.openURL(webFallbackUrl);
            }
          } else if (webFallbackUrl) {
            await Linking.openURL(webFallbackUrl);
          }
        } catch {
          if (webFallbackUrl) {
            Linking.openURL(webFallbackUrl).catch(() => {
              Alert.alert(
                `Could Not Open ${platformName}`,
                `Unable to open ${platformName} app or web browser.`
              );
            });
          }
        }
      }

      await ApiService.submitApprovalDecision(approvalId, decision, reason);
      if (current) {
        // Optimistically remove resolved approval from active queue
        const remainingApprovals = (current.pendingApprovals || []).filter((a) => a.id !== approvalId);
        set({
          currentTask: {
            ...current,
            pendingApprovals: remainingApprovals,
            status: remainingApprovals.length > 0 ? 'WAITING_APPROVAL' : 'EXECUTING',
          },
          isLoading: false,
        });

        get().pollTaskUntilDone(current.id);
      } else {
        set({ isLoading: false });
      }
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  submitTaskReply: async (reply: string) => {
    const current = get().currentTask;
    if (!current) return;
    try {
      set({ isLoading: true, error: null });
      const { task } = await ApiService.submitTaskReply(current.id, reply);
      set({ currentTask: task, isLoading: false });
      get().pollTaskUntilDone(task.id);
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

  fetchTasks: async (filters?: TaskFilterOptions) => {
    try {
      const { tasks } = await ApiService.listTasks(filters);
      set({ tasks: tasks || [] });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  clearTaskHistory: async () => {
    try {
      await ApiService.clearTaskHistory();
      set({ tasks: [] });
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

  checkPushPermission: async () => {
    try {
      const status = await MobileNotificationService.checkPermissionStatus();
      set({ pushPermissionStatus: status as any });
    } catch (err) {
      console.warn('[useAppStore] checkPushPermission error:', err);
    }
  },

  requestPushPermissionAndRegister: async () => {
    set({ isRegisteringPush: true, error: null });
    try {
      const res = await MobileNotificationService.registerForPushNotifications();
      if (res.success && res.token) {
        set({
          pushToken: res.token,
          pushPermissionStatus: 'granted',
          isRegisteringPush: false,
        });
      } else {
        set({
          pushPermissionStatus: (res.status as any) || 'denied',
          isRegisteringPush: false,
          error: res.error || null,
        });
      }
      return res;
    } catch (err: any) {
      set({ isRegisteringPush: false, error: err.message });
      return { success: false, error: err.message };
    }
  },

  sendTestPushNotification: async () => {
    try {
      await MobileNotificationService.sendLocalTestNotification();
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  clearError: () => set({ error: null }),

  // ─── TTS Actions ───

  initTTSSettings: async () => {
    try {
      const settings = await TTSService.init();
      set({ ttsEnabled: settings.enabled });
    } catch {
      // Defaults are fine
    }
  },

  toggleTTS: async () => {
    const next = !get().ttsEnabled;
    set({ ttsEnabled: next });
    await TTSService.saveSettings({ enabled: next });
    if (!next) {
      TTSService.stop();
      set({ isSpeaking: false });
    }
  },

  speakResponse: async (text: string) => {
    if (!get().ttsEnabled || get().isSpeaking) return;
    try {
      set({ isSpeaking: true });
      await TTSService.speakConcise(text);
    } catch (err) {
      console.warn('[useAppStore] speakResponse error:', err);
    } finally {
      set({ isSpeaking: false });
    }
  },
}));

