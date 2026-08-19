import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  ShieldAlert,
  PhoneCall,
  Phone,
  MessageSquare,
  MessageCircle,
  Calendar as CalendarIcon,
  CalendarPlus,
  CalendarX,
  Clock,
  Users,
  MapPin,
  Utensils,
  ShoppingBag,
  ExternalLink,
} from 'lucide-react-native';
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
  const isWhatsApp = approval.toolName === 'messaging.sendWhatsApp';
  const isSMS = approval.toolName === 'messaging.sendSMS';
  const isMessaging = isWhatsApp || isSMS;

  // Calendar flags
  const isCalendarCreate = approval.toolName === 'calendar.createEvent';
  const isCalendarUpdate = approval.toolName === 'calendar.updateEvent';
  const isCalendarDelete = approval.toolName === 'calendar.deleteEvent';
  const isCalendar = isCalendarCreate || isCalendarUpdate || isCalendarDelete;

  // Food Ordering flags
  const isFoodOrder = approval.toolName === 'food.prepareOrder';
  const foodPlatform = String(approval.args?.platform || 'zomato').toLowerCase();
  const foodItemName = String(approval.args?.itemName || 'Food Item');
  const foodRestaurant = String(approval.args?.restaurantName || 'Restaurant / Cafe');
  const foodEstimatedPrice = approval.args?.estimatedPrice ? Number(approval.args?.estimatedPrice) : 0;
  const foodBudgetRange = String(approval.args?.budgetRange || '');
  const foodCurrency = String(approval.args?.currency || 'INR');

  // Parameters
  const recipientName = String(approval.args?.recipientName || 'Contact');
  const phoneNumber = String(approval.args?.phoneNumber || '');
  const messageBody = String(approval.args?.messageBody || '');

  // Calendar args
  const calSummary = String(approval.args?.summary || (isCalendarDelete ? 'Calendar Event' : 'New Meeting'));
  const calStart = String(approval.args?.startTime || '');
  const calEnd = String(approval.args?.endTime || '');
  const calDescription = String(approval.args?.description || '');
  const calLocation = String(approval.args?.location || '');
  const calAttendees = Array.isArray(approval.args?.attendees)
    ? (approval.args?.attendees as string[])
    : [];
  const calEventId = String(approval.args?.eventId || '');

  // Helper to format ISO datetime cleanly
  const formatDateTime = (isoStr: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return isoStr;
    }
  };

  // Helper to calculate duration in minutes
  const getDurationString = (startIso: string, endIso: string) => {
    if (!startIso || !endIso) return '';
    try {
      const s = new Date(startIso).getTime();
      const e = new Date(endIso).getTime();
      const diffMin = Math.round((e - s) / 60000);
      if (diffMin > 0) return `${diffMin} mins`;
      return '';
    } catch {
      return '';
    }
  };

  // Edge case flags
  const isLongMessage = messageBody.length > 300;
  const isMissingCountryCode = isWhatsApp && phoneNumber.trim() && !phoneNumber.trim().startsWith('+');

  // Food platform styling helpers
  const getFoodPlatformInfo = () => {
    switch (foodPlatform) {
      case 'swiggy':
        return { name: 'Swiggy', color: '#fc8019', bg: 'rgba(252, 128, 25, 0.15)', border: 'rgba(252, 128, 25, 0.4)' };
      case 'blinkit':
        return { name: 'Blinkit', color: '#f8cb46', bg: 'rgba(248, 203, 70, 0.15)', border: 'rgba(248, 203, 70, 0.4)' };
      case 'zepto':
        return { name: 'Zepto', color: '#8800ec', bg: 'rgba(136, 0, 236, 0.15)', border: 'rgba(136, 0, 236, 0.4)' };
      case 'zomato':
      default:
        return { name: 'Zomato', color: '#e23744', bg: 'rgba(226, 55, 68, 0.15)', border: 'rgba(226, 55, 68, 0.4)' };
    }
  };

  const foodPlat = getFoodPlatformInfo();

  // Determine header badge
  const getBadgeLabel = () => {
    if (isPhoneCall) return 'OUTBOUND CALL CONFIRMATION';
    if (isWhatsApp) return 'WHATSAPP MESSAGE CONFIRMATION';
    if (isSMS) return 'SMS MESSAGE CONFIRMATION';
    if (isCalendarCreate) return 'CALENDAR SCHEDULE CONFIRMATION';
    if (isCalendarUpdate) return 'CALENDAR UPDATE CONFIRMATION';
    if (isCalendarDelete) return 'CRITICAL CALENDAR DELETION';
    if (isFoodOrder) return `${foodPlat.name.toUpperCase()} FOOD ORDER CONFIRMATION`;
    return `${approval.riskLevel} RISK CONFIRMATION REQUIRED`;
  };

  // Determine header icon
  const getBadgeIcon = () => {
    if (isPhoneCall) return <PhoneCall size={18} color="#f59e0b" />;
    if (isWhatsApp) return <MessageCircle size={18} color="#25D366" />;
    if (isSMS) return <MessageSquare size={18} color="#3b82f6" />;
    if (isCalendarCreate) return <CalendarPlus size={18} color="#818cf8" />;
    if (isCalendarUpdate) return <CalendarIcon size={18} color="#818cf8" />;
    if (isCalendarDelete) return <CalendarX size={18} color="#ef4444" />;
    if (isFoodOrder) return <Utensils size={18} color={foodPlat.color} />;
    return <ShieldAlert size={18} color={isCritical ? '#ef4444' : '#f59e0b'} />;
  };

  // Determine approve button text
  const getApproveLabel = () => {
    if (isPhoneCall) return 'Approve & Open Dialer';
    if (isWhatsApp) return 'Approve & Open WhatsApp';
    if (isSMS) return 'Approve & Open SMS';
    if (isCalendarCreate) return 'Approve & Schedule';
    if (isCalendarUpdate) return 'Approve & Update Event';
    if (isCalendarDelete) return 'Approve & Delete Event';
    if (isFoodOrder) return `Approve & Open ${foodPlat.name}`;
    return 'Approve & Run';
  };

  // Determine approve button icon
  const getApproveIcon = () => {
    if (isPhoneCall) return <PhoneCall size={18} color="#ffffff" />;
    if (isWhatsApp) return <MessageCircle size={18} color="#ffffff" />;
    if (isSMS) return <MessageSquare size={18} color="#ffffff" />;
    if (isCalendarDelete) return <CalendarX size={18} color="#ffffff" />;
    if (isCalendar) return <CalendarPlus size={18} color="#ffffff" />;
    if (isFoodOrder) return <ExternalLink size={18} color="#ffffff" />;
    return <CheckCircle size={18} color="#ffffff" />;
  };

  // Messaging callout colors
  const msgAccentColor = isWhatsApp ? '#25D366' : '#3b82f6';
  const durationStr = getDurationString(calStart, calEnd);

  return (
    <View style={[styles.card, (isCritical || isCalendarDelete || isFoodOrder) ? styles.criticalBorder : styles.highRiskBorder]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View
          style={[
            styles.badgeRow,
            isWhatsApp && styles.whatsappBadgeBg,
            isSMS && styles.smsBadgeBg,
            (isCalendarCreate || isCalendarUpdate) && styles.calendarBadgeBg,
            isCalendarDelete && styles.deleteBadgeBg,
            isFoodOrder && { backgroundColor: foodPlat.bg },
          ]}
        >
          {getBadgeIcon()}
          <Text
            style={[
              styles.badgeText,
              {
                color: isWhatsApp
                  ? '#25D366'
                  : isSMS
                  ? '#3b82f6'
                  : (isCalendarCreate || isCalendarUpdate)
                  ? '#818cf8'
                  : isFoodOrder
                  ? foodPlat.color
                  : (isCritical || isCalendarDelete)
                  ? '#ef4444'
                  : '#f59e0b',
              },
            ]}
          >
            {getBadgeLabel()}
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

      {/* Messaging Callout (WhatsApp / SMS) */}
      {isMessaging && (
        <View style={[styles.messagingCallout, { borderColor: `${msgAccentColor}44` }]}>
          <View style={[styles.msgIconBox, { backgroundColor: `${msgAccentColor}33` }]}>
            {isWhatsApp ? (
              <MessageCircle size={22} color={msgAccentColor} />
            ) : (
              <MessageSquare size={22} color={msgAccentColor} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.msgRecipient}>{recipientName}</Text>
            <Text style={[styles.msgPhoneNumber, { color: msgAccentColor }]}>{phoneNumber}</Text>

            {/* Message body preview */}
            <View style={styles.msgBodyBox}>
              <Text style={styles.msgBodyLabel}>Message:</Text>
              <Text style={styles.msgBodyText} numberOfLines={6}>{messageBody}</Text>
            </View>

            <Text style={styles.msgHint}>
              {isWhatsApp
                ? 'Approving will open WhatsApp with this message pre-filled.'
                : 'Approving will open your SMS app with this message pre-filled.'}
            </Text>

            {/* Edge case: Long message warning */}
            {isLongMessage && isSMS && (
              <View style={styles.warningBox}>
                <AlertTriangle size={14} color="#f59e0b" />
                <Text style={styles.warningText}>
                  This message is over 300 characters. Some SMS apps may split or truncate long messages.
                </Text>
              </View>
            )}

            {/* Edge case: Missing country code for WhatsApp */}
            {isMissingCountryCode && (
              <View style={styles.warningBox}>
                <AlertTriangle size={14} color="#f59e0b" />
                <Text style={styles.warningText}>
                  This phone number does not start with a country code (+). WhatsApp requires full international format to resolve contacts correctly.
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Food Ordering Callout */}
      {isFoodOrder && (
        <View style={[styles.foodCallout, { borderColor: foodPlat.border }]}>
          <View style={[styles.foodIconBox, { backgroundColor: foodPlat.bg }]}>
            <Utensils size={22} color={foodPlat.color} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
              <Text style={styles.foodItemTitle}>{foodItemName}</Text>
              <View style={[styles.foodPlatformTag, { backgroundColor: foodPlat.bg }]}>
                <Text style={[styles.foodPlatformTagText, { color: foodPlat.color }]}>{foodPlat.name}</Text>
              </View>
            </View>

            <Text style={styles.foodRestaurantText}>{foodRestaurant}</Text>

            {/* Price Badge with Estimate Disclaimer */}
            <View style={styles.foodPriceBox}>
              <Text style={styles.foodPriceText}>
                {foodCurrency === 'INR' ? '₹' : foodCurrency} {foodEstimatedPrice}{' '}
                <Text style={styles.foodEstimateNote}>(estimated — confirm in app)</Text>
              </Text>
              {foodBudgetRange ? (
                <Text style={styles.foodBudgetBadge}>{foodBudgetRange} ✓</Text>
              ) : null}
            </View>

            {/* Disclaimer note box */}
            <View style={styles.foodDisclaimerBox}>
              <AlertTriangle size={13} color="#f59e0b" style={{ marginTop: 2 }} />
              <Text style={styles.foodDisclaimerText}>
                Prices and availability are estimates from web catalog. Tapping approve will open {foodPlat.name} where you review live pricing and complete your order.
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Calendar Scheduling Callout */}
      {(isCalendarCreate || isCalendarUpdate) && (
        <View style={styles.calendarCallout}>
          <View style={styles.calIconBox}>
            <CalendarIcon size={22} color="#818cf8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.calEventTitle}>{calSummary}</Text>

            {/* Time badge */}
            {calStart ? (
              <View style={styles.calTimeRow}>
                <Clock size={14} color="#818cf8" />
                <Text style={styles.calTimeText}>
                  {formatDateTime(calStart)}
                  {calEnd ? ` → ${formatDateTime(calEnd).split(',').pop()}` : ''}
                </Text>
                {durationStr ? <Text style={styles.calDurationBadge}>{durationStr}</Text> : null}
              </View>
            ) : null}

            {/* Attendees list */}
            {calAttendees.length > 0 && (
              <View style={styles.calAttendeesBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Users size={13} color="#94a3b8" />
                  <Text style={styles.calAttendeesLabel}>Invited Attendees ({calAttendees.length}):</Text>
                </View>
                <View style={styles.attendeeChipsRow}>
                  {calAttendees.map((att, i) => (
                    <View key={i} style={styles.attendeeChip}>
                      <Text style={styles.attendeeChipText}>{att}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Location / Meet link */}
            {calLocation ? (
              <View style={styles.calLocationRow}>
                <MapPin size={13} color="#94a3b8" />
                <Text style={styles.calLocationText}>{calLocation}</Text>
              </View>
            ) : null}

            {/* Description note */}
            {calDescription ? (
              <Text style={styles.calDescText} numberOfLines={2}>"{calDescription}"</Text>
            ) : null}

            <Text style={styles.calHint}>
              {isCalendarCreate
                ? 'Approving will create this event in your primary Google Calendar and send invitations.'
                : 'Approving will modify this existing Google Calendar event.'}
            </Text>
          </View>
        </View>
      )}

      {/* Calendar Deletion Callout */}
      {isCalendarDelete && (
        <View style={[styles.calendarCallout, { borderColor: 'rgba(239, 68, 68, 0.4)', backgroundColor: 'rgba(239, 68, 68, 0.08)' }]}>
          <View style={[styles.calIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
            <CalendarX size={22} color="#ef4444" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.calEventTitle, { color: '#fca5a5' }]}>{calSummary}</Text>
            {calEventId ? (
              <Text style={styles.calEventIdText}>Event ID: {calEventId}</Text>
            ) : null}
            <View style={[styles.warningBox, { borderColor: 'rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
              <AlertTriangle size={14} color="#ef4444" />
              <Text style={[styles.warningText, { color: '#fca5a5' }]}>
                This will permanently remove the meeting from Google Calendar and notify attendees of cancellation.
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Parameter Details (generic fallback for other tools) */}
      {!isPhoneCall && !isMessaging && !isCalendar && !isFoodOrder && (
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
          style={[
            styles.approveButton,
            isWhatsApp && styles.whatsappApproveBtn,
            isSMS && styles.smsApproveBtn,
            (isCalendarCreate || isCalendarUpdate) && styles.calendarApproveBtn,
            isCalendarDelete && styles.deleteApproveBtn,
            isFoodOrder && { backgroundColor: foodPlat.color, shadowColor: foodPlat.color },
          ]}
          onPress={() => onApprove(approval.id)}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              {getApproveIcon()}
              <Text style={styles.approveText}>{getApproveLabel()}</Text>
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
  whatsappBadgeBg: {
    backgroundColor: 'rgba(37, 211, 102, 0.15)',
  },
  smsBadgeBg: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  calendarBadgeBg: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  deleteBadgeBg: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
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
  whatsappApproveBtn: {
    backgroundColor: '#25D366',
    shadowColor: '#25D366',
  },
  smsApproveBtn: {
    backgroundColor: '#3b82f6',
    shadowColor: '#3b82f6',
  },
  calendarApproveBtn: {
    backgroundColor: '#6366f1',
    shadowColor: '#6366f1',
  },
  deleteApproveBtn: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
  },
  approveText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  // Phone call callout styles
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
  // Messaging callout styles
  messagingCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  msgIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgRecipient: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  msgPhoneNumber: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  msgBodyBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  msgBodyLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  msgBodyText: {
    fontSize: 13,
    color: '#e2e8f0',
    lineHeight: 19,
  },
  msgHint: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 15,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  warningText: {
    fontSize: 11,
    color: '#fbbf24',
    lineHeight: 15,
    flex: 1,
  },
  // Food Ordering Callout Styles
  foodCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  foodIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foodItemTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
  },
  foodPlatformTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  foodPlatformTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  foodRestaurantText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 8,
  },
  foodPriceBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  foodPriceText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10b981',
  },
  foodEstimateNote: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '400',
  },
  foodBudgetBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#818cf8',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  foodDisclaimerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  foodDisclaimerText: {
    fontSize: 11,
    color: '#fbbf24',
    lineHeight: 15,
    flex: 1,
  },
  // Calendar callout styles
  calendarCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    marginBottom: 16,
  },
  calIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calEventTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  calTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  calTimeText: {
    fontSize: 13,
    color: '#c7d2fe',
    fontWeight: '600',
  },
  calDurationBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#818cf8',
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  calAttendeesBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  calAttendeesLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  attendeeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  attendeeChip: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  attendeeChipText: {
    fontSize: 11,
    color: '#e0e7ff',
    fontFamily: 'monospace',
  },
  calLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  calLocationText: {
    fontSize: 12,
    color: '#cbd5e1',
  },
  calDescText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginBottom: 6,
  },
  calHint: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 15,
  },
  calEventIdText: {
    fontSize: 11,
    color: '#94a3b8',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
});
