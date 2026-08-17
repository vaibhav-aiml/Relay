import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { AlertTriangle, CheckCircle, XCircle, ShieldAlert, PhoneCall, Phone } from 'lucide-react-native';
import { Approval } from '@relay/shared-types';

interface ApprovalCardProps {
  approval: Approval;
  onApprove: (approvalId: string) => void;
  onDeny: (approvalId: string) => void;
  isLoading?: boolean;
}

export const ApprovalCard: React.FC<ApprovalCardProps> = ({
  approval,
  onApprove,
  onDeny,
  isLoading = false,
}) => {
  const isCritical = approval.riskLevel === 'CRITICAL';
  const isPhoneCall = approval.toolName === 'telephony.makeCall';
  const recipientName = String(approval.args?.recipientName || 'Contact');
  const phoneNumber = String(approval.args?.phoneNumber || '');

  return (
    <View style={[styles.card, isCritical ? styles.criticalBorder : styles.highRiskBorder]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.badgeRow}>
          {isPhoneCall ? (
            <PhoneCall size={18} color="#f59e0b" />
          ) : (
            <ShieldAlert size={18} color={isCritical ? '#ef4444' : '#f59e0b'} />
          )}
          <Text style={[styles.badgeText, { color: isCritical ? '#ef4444' : '#f59e0b' }]}>
            {isPhoneCall ? 'OUTBOUND CALL CONFIRMATION' : `${approval.riskLevel} RISK CONFIRMATION REQUIRED`}
          </Text>
        </View>
      </View>

      {/* Description */}
      <Text style={styles.title}>{approval.description}</Text>
      <Text style={styles.toolName}>Action: {approval.toolName}</Text>

      {/* Phone Call Callout */}
      {isPhoneCall && (
        <View style={styles.phoneCallout}>
          <View style={styles.phoneIconBox}>
            <Phone size={22} color="#10b981" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.phoneRecipient}>{recipientName}</Text>
            <Text style={styles.phoneNumberText}>{phoneNumber}</Text>
            <Text style={styles.phoneHint}>Approving will open your device's native phone dialer pre-filled.</Text>
          </View>
        </View>
      )}

      {/* Parameter Details */}
      {!isPhoneCall && (
        <View style={styles.paramsBox}>
          <Text style={styles.paramsLabel}>Proposed Action Parameters:</Text>
          {Object.entries(approval.args || {}).map(([k, v]) => (
            <View key={k} style={styles.paramRow}>
              <Text style={styles.paramKey}>{k}:</Text>
              <Text style={styles.paramValue} numberOfLines={2}>
                {typeof v === 'object' ? JSON.stringify(v) : String(v)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.denyButton}
          onPress={() => onDeny(approval.id)}
          disabled={isLoading}
        >
          <XCircle size={18} color="#ef4444" />
          <Text style={styles.denyText}>Deny</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.approveButton}
          onPress={() => onApprove(approval.id)}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              {isPhoneCall ? <PhoneCall size={18} color="#ffffff" /> : <CheckCircle size={18} color="#ffffff" />}
              <Text style={styles.approveText}>{isPhoneCall ? 'Approve & Open Dialer' : 'Approve & Run'}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e1b2e',
    borderRadius: 16,
    padding: 18,
    marginVertical: 12,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  highRiskBorder: {
    borderColor: 'rgba(245, 158, 11, 0.6)',
  },
  criticalBorder: {
    borderColor: 'rgba(239, 68, 68, 0.7)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 22,
    marginBottom: 4,
  },
  toolName: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  paramsBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  paramsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  paramRow: {
    flexDirection: 'row',
    marginBottom: 4,
    gap: 6,
  },
  paramKey: {
    fontSize: 12,
    color: '#cbd5e1',
    fontWeight: '600',
  },
  paramValue: {
    fontSize: 12,
    color: '#f8fafc',
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  denyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  denyText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  approveButton: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  approveText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  phoneCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 16,
  },
  phoneIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneRecipient: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  phoneNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  phoneHint: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 15,
  },
});
