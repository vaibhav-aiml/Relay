import { Task, TaskEvent, Approval, Connection, Memory, HealthResponse, UserContact } from '@relay/shared-types';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_API_URL || 'http://localhost:4000';


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

  public static async listTasks(): Promise<{ tasks: Task[] }> {
    return this.request<{ tasks: Task[] }>('/api/tasks');
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
}
