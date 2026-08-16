export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Approval {
  id: string;
  userId: string;
  taskId: string;
  toolName: string;
  action: string;
  description: string;
  riskLevel: 'HIGH' | 'CRITICAL';
  args: Record<string, unknown>;
  requestedAt: string;
  decision?: 'approved' | 'denied';
  decidedAt?: string;
  denialReason?: string;
}
