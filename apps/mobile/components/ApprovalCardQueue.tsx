import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Approval } from '@relay/shared-types';
import { ApprovalCard } from './ApprovalCard';
import { ShieldAlert, Layers } from 'lucide-react-native';

interface ApprovalCardQueueProps {
  approvals: Approval[];
  onApprove: (approvalId: string) => void;
  onDeny: (approvalId: string) => void;
  isLoading?: boolean;
}

export const ApprovalCardQueue: React.FC<ApprovalCardQueueProps> = ({
  approvals,
  onApprove,
  onDeny,
  isLoading = false,
}) => {
  if (!approvals || approvals.length === 0) {
    return null;
  }

  const total = approvals.length;

  return (
    <View style={styles.queueContainer}>
      <View style={styles.queueHeader}>
        <View style={styles.queueHeaderLeft}>
          <ShieldAlert size={18} color="#f59e0b" />
          <Text style={styles.queueHeaderTitle}>
            Action Approvals Required ({total})
          </Text>
        </View>
        {total > 1 && (
          <View style={styles.badge}>
            <Layers size={12} color="#f59e0b" />
            <Text style={styles.badgeText}>Multi-Agent Queue</Text>
          </View>
        )}
      </View>

      {total > 1 && (
        <Text style={styles.queueSub}>
          Specialized worker agents are requesting permission for external actions. Review and approve each action below:
        </Text>
      )}

      {approvals.map((approval, index) => {
        const agentLabel = approval.agentType
          ? approval.agentType.replace('_', ' ').toUpperCase()
          : 'SPECIALIST';

        return (
          <View key={approval.id || index} style={styles.cardWrapper}>
            {total > 1 && (
              <View style={styles.cardIndexBar}>
                <Text style={styles.cardIndexText}>
                  Request {index + 1} of {total} • <Text style={styles.agentHighlight}>[{agentLabel}]</Text>
                </Text>
              </View>
            )}
            <ApprovalCard
              approval={approval}
              onApprove={onApprove}
              onDeny={onDeny}
              isLoading={isLoading}
            />
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  queueContainer: {
    marginBottom: 16,
  },
  queueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  queueHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  queueHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f59e0b',
    letterSpacing: 0.3,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fbbf24',
  },
  queueSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 12,
    lineHeight: 17,
  },
  cardWrapper: {
    marginBottom: 14,
  },
  cardIndexBar: {
    backgroundColor: '#1e293b',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  cardIndexText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  agentHighlight: {
    color: '#38bdf8',
    fontWeight: '700',
  },
});
