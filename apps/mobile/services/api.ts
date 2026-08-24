import { Task, TaskEvent, Approval, Connection, Memory, HealthResponse, UserContact, TaskFilterOptions } from '@relay/shared-types';
import Constants from 'expo-constants';

const getBaseUrl = (): string => {
  // 1. Try to dynamically detect the Metro bundler IP (works on physical devices over Wi-Fi/LAN)
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:4000`;
    }
  }

  // 2. Fall back to environment variable if configured
  if (process.env.EXPO_PUBLIC_BACKEND_API_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_API_URL;
  }

  // 3. Active LAN fallback
  return 'http://192.168.1.5:4000';
};

const BASE_URL = getBaseUrl();

export class ApiService {
  private static authToken: string | null = null;

  public static setAuthToken(token: string | null): void {
    this.authToken = token;
  }

  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(errBody.error || `HTTP error ${res.status}`);
    }

    return res.json();
  }

  // Health
  public static async getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health');
  }

  // Tasks
  public static async createTask(goal: string): Promise<{ task: Task }> {
    return this.request<{ task: Task }>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ goal }),
    });
  }

  public static async listTasks(filters?: TaskFilterOptions): Promise<{ tasks: Task[]; total?: number }> {
    const params = new URLSearchParams();
    if (filters?.query) params.append('q', filters.query);
    if (filters?.status && filters.status !== 'ALL') params.append('status', filters.status);
    if (filters?.tool && filters.tool !== 'ALL') params.append('tool', filters.tool);
    if (filters?.timeHorizon && filters.timeHorizon !== 'all') params.append('timeHorizon', filters.timeHorizon);
    if (filters?.limit) params.append('limit', String(filters.limit));

    const qs = params.toString();
    const endpoint = qs ? `/api/tasks?${qs}` : '/api/tasks';
    return this.request<{ tasks: Task[]; total?: number }>(endpoint);
  }

  public static async clearTaskHistory(): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/api/tasks/history', {
      method: 'DELETE',
    });
  }

  public static async getTask(taskId: string): Promise<{ task: Task; events: TaskEvent[] }> {
    return this.request<{ task: Task; events: TaskEvent[] }>(`/api/tasks/${taskId}`);
  }

  public static async cancelTask(taskId: string, reason?: string): Promise<{ task: Task }> {
    return this.request<{ task: Task }>(`/api/tasks/${taskId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  public static async submitTaskReply(taskId: string, reply: string): Promise<{ task: Task; message?: string }> {
    return this.request<{ task: Task; message?: string }>(`/api/tasks/${taskId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ reply }),
    });
  }

  // Approvals
  public static async submitApprovalDecision(
    approvalId: string,
    decision: 'approved' | 'denied',
    reason?: string
  ): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/api/approvals/${approvalId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, denialReason: reason }),
    });
  }

  // Voice
  public static async transcribeVoice(audioBase64: string): Promise<{ text: string }> {
    return this.request<{ text: string }>('/api/voice/transcribe', {
      method: 'POST',
      body: JSON.stringify({ audioBase64, filename: 'voice-prompt.m4a' }),
    });
  }

  // Connections
  public static async listConnections(): Promise<{ connections: Connection[] }> {
    return this.request<{ connections: Connection[] }>('/api/connections');
  }

  public static async getGoogleAuthUrl(): Promise<{ authUrl: string }> {
    return this.request<{ authUrl: string }>('/api/connections/google/auth-url');
  }

  public static async revokeConnection(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/connections/${id}`, {
      method: 'DELETE',
    });
  }

  // Device Contacts
  public static async syncContacts(contacts: UserContact[]): Promise<{ success: boolean; count: number; message: string }> {
    return this.request<{ success: boolean; count: number; message: string }>('/api/contacts/sync', {
      method: 'POST',
      body: JSON.stringify({ contacts }),
    });
  }

  public static async getSyncedContacts(): Promise<{ contacts: UserContact[] }> {
    return this.request<{ contacts: UserContact[] }>('/api/contacts');
  }

  public static async clearSyncedContacts(): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/api/contacts', {
      method: 'DELETE',
    });
  }

  // Memory
  public static async listMemories(): Promise<{ memories: Memory[] }> {
    return this.request<{ memories: Memory[] }>('/api/memory');
  }

  public static async saveMemory(key: string, value: string, category?: string): Promise<{ memory: Memory }> {
    return this.request<{ memory: Memory }>('/api/memory', {
      method: 'POST',
      body: JSON.stringify({ key, value, category }),
    });
  }

  public static async deleteMemory(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/memory/${id}`, {
      method: 'DELETE',
    });
  }

  public static async purgeAllMemories(): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/api/memory', {
      method: 'DELETE',
    });
  }

  // Routines & Scheduled Tasks
  public static async listSchedules(status?: string): Promise<{ schedules: import('@relay/shared-types').ScheduledRoutine[]; total?: number }> {
    const endpoint = status && status !== 'all' ? `/api/schedules?status=${status}` : '/api/schedules';
    return this.request<{ schedules: import('@relay/shared-types').ScheduledRoutine[]; total?: number }>(endpoint);
  }

  public static async getSchedule(id: string): Promise<{ schedule: import('@relay/shared-types').ScheduledRoutine }> {
    return this.request<{ schedule: import('@relay/shared-types').ScheduledRoutine }>(`/api/schedules/${id}`);
  }

  public static async createSchedule(data: import('@relay/shared-types').CreateScheduleRequest): Promise<{ schedule: import('@relay/shared-types').ScheduledRoutine }> {
    return this.request<{ schedule: import('@relay/shared-types').ScheduledRoutine }>('/api/schedules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async updateSchedule(id: string, data: import('@relay/shared-types').UpdateScheduleRequest): Promise<{ schedule: import('@relay/shared-types').ScheduledRoutine }> {
    return this.request<{ schedule: import('@relay/shared-types').ScheduledRoutine }>(`/api/schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public static async toggleSchedule(id: string): Promise<{ schedule: import('@relay/shared-types').ScheduledRoutine; message?: string }> {
    return this.request<{ schedule: import('@relay/shared-types').ScheduledRoutine; message?: string }>(`/api/schedules/${id}/toggle`, {
      method: 'POST',
    });
  }

  public static async runScheduleNow(id: string): Promise<{ success: boolean; message?: string; task?: Task; schedule?: import('@relay/shared-types').ScheduledRoutine }> {
    return this.request<{ success: boolean; message?: string; task?: Task; schedule?: import('@relay/shared-types').ScheduledRoutine }>(`/api/schedules/${id}/run`, {
      method: 'POST',
    });
  }

  public static async deleteSchedule(id: string): Promise<{ success: boolean; message?: string }> {
    return this.request<{ success: boolean; message?: string }>(`/api/schedules/${id}`, {
      method: 'DELETE',
    });
  }

  // Push Notifications & Device Profile
  public static async registerPushToken(pushToken: string, timezone?: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/api/schedules/push-token', {
      method: 'POST',
      body: JSON.stringify({ pushToken, timezone }),
    });
  }
}

