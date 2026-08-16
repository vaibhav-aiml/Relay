export interface Memory {
  id: string;
  userId: string;
  category: 'preference' | 'contact_info' | 'schedule_rule' | 'general';
  key: string;
  value: string;
  source: 'user_stated' | 'inferred';
  userApproved: boolean;
  confidence?: number;
  createdAt: string;
  updatedAt: string;
}
