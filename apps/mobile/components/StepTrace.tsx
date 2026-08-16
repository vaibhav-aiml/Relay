import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TaskEvent, PlanStep } from '@relay/shared-types';
import { Check, ShieldCheck, AlertTriangle, ArrowRight, CornerDownRight } from 'lucide-react-native';

interface StepTraceProps {
  steps: PlanStep[];
  events: TaskEvent[];
}

export const StepTrace: React.FC<StepTraceProps> = ({ steps, events }) => {
  if (steps.length === 0 && events.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Waiting for plan generation...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Agent Execution Trace</Text>

      {steps.map((step, index) => {
        const isVerified = step.verified === true;
        const isFailed = step.status === 'failed';
        const isApproval = step.status === 'needs_approval';
        const isInProgress = step.status === 'in_progress';

        return (
          <View key={step.id || index} style={styles.stepItem}>
            {/* Timeline connector */}
            <View style={styles.timelineCol}>
              <View
                style={[
                  styles.nodeCircle,
                  isVerified && styles.nodeVerified,
                  isFailed && styles.nodeFailed,
                  isApproval && styles.nodeApproval,
                  isInProgress && styles.nodeActive,
                ]}
              >
                {isVerified ? (
                  <Check size={12} color="#ffffff" />
                ) : (
                  <Text style={styles.nodeNumber}>{index + 1}</Text>
                )}
              </View>
              {index < steps.length - 1 && <View style={styles.timelineLine} />}
            </View>

            {/* Step content */}
            <View style={styles.contentCol}>
              <View style={styles.stepHeader}>
                <Text style={styles.toolName}>{step.toolName || step.description}</Text>
                {isVerified && (
                  <View style={styles.verifiedBadge}>
                    <ShieldCheck size={12} color="#10b981" />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                )}
                {isApproval && (
                  <View style={styles.approvalBadge}>
                    <AlertTriangle size={12} color="#f59e0b" />
                    <Text style={styles.approvalText}>Needs Approval</Text>
                  </View>
                )}
              </View>

              {step.args && Object.keys(step.args).length > 0 && (
                <View style={styles.argsBox}>
                  {Object.entries(step.args).map(([k, v]) => (
                    <Text key={k} style={styles.argLine} numberOfLines={1}>
                      <Text style={styles.argKey}>{k}: </Text>
                      <Text style={styles.argVal}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</Text>
                    </Text>
                  ))}
                </View>
              )}

              {step.result ? (
                <View style={styles.resultBox}>
                  <CornerDownRight size={12} color="#94a3b8" style={{ marginTop: 2 }} />
                  <Text style={styles.resultText} numberOfLines={2}>
                    {typeof step.result === 'object' ? JSON.stringify(step.result) : String(step.result)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
  },
  stepItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  timelineCol: {
    alignItems: 'center',
    width: 28,
    marginRight: 10,
  },
  nodeCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#475569',
  },
  nodeActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#60a5fa',
  },
  nodeVerified: {
    backgroundColor: '#10b981',
    borderColor: '#34d399',
  },
  nodeFailed: {
    backgroundColor: '#ef4444',
    borderColor: '#f87171',
  },
  nodeApproval: {
    backgroundColor: '#f59e0b',
    borderColor: '#fbbf24',
  },
  nodeNumber: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 4,
  },
  contentCol: {
    flex: 1,
    backgroundColor: '#111726',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  toolName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
    fontFamily: 'monospace',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verifiedText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '700',
  },
  approvalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  approvalText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '700',
  },
  argsBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 6,
    padding: 8,
    marginVertical: 4,
  },
  argLine: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 2,
  },
  argKey: {
    color: '#cbd5e1',
    fontWeight: '600',
  },
  argVal: {
    color: '#e2e8f0',
  },
  resultBox: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  resultText: {
    flex: 1,
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic',
  },
});
