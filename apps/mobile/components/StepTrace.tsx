import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { TaskEvent, PlanStep } from '@relay/shared-types';
import {
  Check,
  ShieldCheck,
  AlertTriangle,
  CornerDownRight,
  Phone,
  MessageSquare,
  Clock,
  Sparkles,
  ExternalLink,
} from 'lucide-react-native';

interface StepTraceProps {
  steps: PlanStep[];
  events: TaskEvent[];
}

export const StepTrace: React.FC<StepTraceProps> = ({ steps, events }) => {
  if (steps.length === 0 && events.length === 0) {
    return (
      <View style={styles.thinkingContainer}>
        <ActivityIndicator size="small" color="#6366f1" />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.thinkingTitle}>Interpreting your instruction...</Text>
          <Text style={styles.thinkingSub}>Analyzing intent and checking required capabilities</Text>
        </View>
      </View>
    );
  }

  if (steps.length === 0) {
    const latestEvent = events[events.length - 1];
    return (
      <View style={styles.thinkingContainer}>
        <ActivityIndicator size="small" color="#6366f1" />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.thinkingTitle}>Formulating execution steps...</Text>
          <Text style={styles.thinkingSub}>
            {latestEvent?.message || 'Resolving contacts and preparing plan'}
          </Text>
        </View>
      </View>
    );
  }

  const getFriendlyToolName = (toolName?: string, args?: Record<string, any>) => {
    switch (toolName) {
      case 'contacts.search':
        return `Search Contacts: "${args?.query || 'Contact'}"`;
      case 'messaging.sendWhatsApp':
        return `WhatsApp Message to ${args?.recipientName || 'Contact'}`;
      case 'messaging.sendSMS':
        return `SMS Message to ${args?.recipientName || 'Contact'}`;
      case 'telephony.makeCall':
        return `Phone Call: ${args?.contactName || args?.phoneNumber || 'Contact'}`;
      case 'food.searchOptions':
        return `Food Search: "${args?.query || 'Items'}"`;
      case 'food.prepareOrder':
        return `Prepare Order: ${args?.itemName || 'Item'}`;
      case 'calendar.listEvents':
        return 'Check Calendar Schedule';
      case 'calendar.createEvent':
        return `Create Calendar Event: "${args?.title || 'Meeting'}"`;
      case 'gmail.searchMessages':
        return `Search Emails: "${args?.query || 'Messages'}"`;
      case 'web.search':
        return `Web Search: "${args?.query || 'Query'}"`;
      default:
        return toolName || 'Execution Step';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Sparkles size={14} color="#6366f1" />
        <Text style={styles.sectionTitle}>Execution Timeline ({steps.length} Steps)</Text>
      </View>

      {steps.map((step, index) => {
        const isVerified = step.verified === true || step.status === 'completed';
        const isFailed = step.status === 'failed';
        const isApproval = step.status === 'needs_approval';
        const isInProgress = step.status === 'in_progress';
        const isPending = step.status === 'pending';

        const dialerUrl = (step.result as Record<string, any> | undefined)?.dialerUrl as string | undefined;
        const whatsAppDeepLink =
          (step.result as Record<string, any> | undefined)?.deepLinkUrl ||
          (step.toolName === 'messaging.sendWhatsApp' && step.args?.phoneNumber
            ? `whatsapp://send?phone=${String(step.args.phoneNumber).replace(/[^\d+]/g, '')}&text=${encodeURIComponent(String(step.args.messageBody || ''))}`
            : undefined);

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
                  isPending && styles.nodePending,
                ]}
              >
                {isInProgress ? (
                  <ActivityIndicator size="small" color="#ffffff" style={{ transform: [{ scale: 0.6 }] }} />
                ) : isVerified ? (
                  <Check size={12} color="#ffffff" strokeWidth={3} />
                ) : isApproval ? (
                  <AlertTriangle size={11} color="#ffffff" />
                ) : (
                  <Text style={styles.nodeNumber}>{index + 1}</Text>
                )}
              </View>
              {index < steps.length - 1 && <View style={styles.timelineLine} />}
            </View>

            {/* Step content */}
            <View style={styles.contentCol}>
              <View style={styles.stepHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.friendlyTitle}>
                    {getFriendlyToolName(step.toolName, step.args)}
                  </Text>
                  <Text style={styles.toolSub}>{step.toolName || step.description}</Text>
                </View>

                {/* Status Badges */}
                {isVerified && (
                  <View style={styles.verifiedBadge}>
                    <ShieldCheck size={12} color="#10b981" />
                    <Text style={styles.verifiedText}>Completed</Text>
                  </View>
                )}
                {isApproval && (
                  <View style={styles.approvalBadge}>
                    <AlertTriangle size={12} color="#f59e0b" />
                    <Text style={styles.approvalText}>Needs Sign-off</Text>
                  </View>
                )}
                {isInProgress && (
                  <View style={styles.inProgressBadge}>
                    <ActivityIndicator size="small" color="#3b82f6" style={{ transform: [{ scale: 0.6 }] }} />
                    <Text style={styles.inProgressText}>Running</Text>
                  </View>
                )}
                {isPending && (
                  <View style={styles.pendingBadge}>
                    <Clock size={11} color="#64748b" />
                    <Text style={styles.pendingText}>Pending</Text>
                  </View>
                )}
                {isFailed && (
                  <View style={styles.failedBadge}>
                    <Text style={styles.failedText}>Failed</Text>
                  </View>
                )}
              </View>

              {/* Step Parameters */}
              {step.args && Object.keys(step.args).length > 0 && (
                <View style={styles.argsBox}>
                  {Object.entries(step.args).map(([k, v]) => (
                    <Text key={k} style={styles.argLine} numberOfLines={2}>
                      <Text style={styles.argKey}>{k}: </Text>
                      <Text style={styles.argVal}>
                        {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                      </Text>
                    </Text>
                  ))}
                </View>
              )}

              {/* Action Buttons for Interactive Tools */}
              {whatsAppDeepLink && (
                <TouchableOpacity
                  style={styles.whatsAppButton}
                  onPress={() => Linking.openURL(whatsAppDeepLink).catch(() => {})}
                >
                  <MessageSquare size={14} color="#25d366" />
                  <Text style={styles.whatsAppButtonText}>Open in WhatsApp</Text>
                  <ExternalLink size={12} color="#25d366" style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
              )}

              {dialerUrl && (
                <TouchableOpacity
                  style={styles.dialerButton}
                  onPress={() => Linking.openURL(dialerUrl)}
                >
                  <Phone size={14} color="#10b981" />
                  <Text style={styles.dialerButtonText}>Open Native Phone Dialer</Text>
                  <ExternalLink size={12} color="#10b981" style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
              )}

              {/* Output Result */}
              {step.result ? (
                <View style={styles.resultBox}>
                  <CornerDownRight size={12} color="#94a3b8" style={{ marginTop: 2 }} />
                  <Text style={styles.resultText} numberOfLines={3}>
                    {typeof step.result === 'object'
                      ? JSON.stringify(step.result, null, 1)
                      : String(step.result)}
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
    marginVertical: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  thinkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111726',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    borderRadius: 12,
    padding: 14,
    marginVertical: 8,
  },
  thinkingTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
  },
  thinkingSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
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
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#475569',
  },
  nodeActive: {
    backgroundColor: '#2563eb',
    borderColor: '#60a5fa',
  },
  nodeVerified: {
    backgroundColor: '#059669',
    borderColor: '#34d399',
  },
  nodeFailed: {
    backgroundColor: '#dc2626',
    borderColor: '#f87171',
  },
  nodeApproval: {
    backgroundColor: '#d97706',
    borderColor: '#fbbf24',
  },
  nodePending: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  nodeNumber: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 4,
  },
  contentCol: {
    flex: 1,
    backgroundColor: '#111726',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  friendlyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
  },
  toolSub: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    fontFamily: 'monospace',
    marginTop: 1,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
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
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  approvalText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '700',
  },
  inProgressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  inProgressText: {
    color: '#3b82f6',
    fontSize: 10,
    fontWeight: '700',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(100, 116, 139, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pendingText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
  },
  failedBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  failedText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: '700',
  },
  argsBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    padding: 8,
    marginVertical: 6,
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
  whatsAppButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(37, 211, 102, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(37, 211, 102, 0.35)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 5,
  },
  whatsAppButtonText: {
    color: '#25d366',
    fontSize: 12,
    fontWeight: '700',
  },
  dialerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 5,
  },
  dialerButtonText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '700',
  },
  resultBox: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  resultText: {
    flex: 1,
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
});
