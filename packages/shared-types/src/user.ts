export interface UserProfile {
  name: string;
  email: string;
  createdAt: string; // ISO 8601 string representation of timestamp
  timezone?: string; // e.g. "Asia/Kolkata" or "UTC"
  pushToken?: string; // Expo push token for background notifications
}

export interface UserSettings {
  voiceEnabled: boolean;
  defaultProvider: 'groq' | 'gemini' | 'claude';
  autoApproveLowRisk: boolean;
}

export interface UserContact {
  id?: string;
  name: string;
  phone?: string;
  email?: string;
  relation?: string;
}

export interface User {
  id: string;
  profile: UserProfile;
  settings: UserSettings;
}

