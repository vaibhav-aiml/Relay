import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { Task, TaskStatus } from '@relay/shared-types';
import { CheckCircle2, AlertCircle, Clock, Ban, Cpu, ExternalLink, Utensils, HelpCircle } from 'lucide-react-native';

interface TaskStatusLiveProps {
  task: Task;
  onCancel?: () => void;
}

export interface DiscoveredOption {
  itemName: string;
  restaurantName: string;
  estimatedPrice: number;
  currency: string;
  platform: string;
  rating?: number;
  isWithinBudget?: boolean;
  deepLinkUrl: string;
  webFallbackUrl: string;
  disclaimer?: string;
}

export const extractDiscoveredOptions = (task: Task): DiscoveredOption[] => {
  const list: DiscoveredOption[] = [];
  if (!task.plan) return list;

  for (const step of task.plan) {
    if (step.toolName === 'food.searchOptions' && Array.isArray(step.result?.options)) {
      for (const opt of step.result.options) {
        // avoid exact duplicates
        if (!list.some((existing) => existing.itemName === opt.itemName && existing.platform === opt.platform)) {
          list.push(opt);
        }
      }
    }
  }
  return list;
};

export const TaskStatusLive: React.FC<TaskStatusLiveProps> = ({ task, onCancel }) => {
  const getStatusMeta = (status: TaskStatus) => {
    switch (status) {
      case 'COMPLETED':
        return { color: '#10b981', label: 'COMPLETED', bg: 'rgba(16, 185, 129, 0.15)', icon: CheckCircle2 };
      case 'WAITING_APPROVAL':
        return { color: '#f59e0b', label: 'WAITING APPROVAL', bg: 'rgba(245, 158, 11, 0.15)', icon: Clock };
      case 'EXECUTING':
        return { color: '#3b82f6', label: 'EXECUTING ACTIONS', bg: 'rgba(59, 130, 246, 0.15)', icon: Cpu };
      case 'PLANNING':
        return { color: '#8b5cf6', label: 'PLANNING STRATEGY', bg: 'rgba(139, 92, 246, 0.15)', icon: Cpu };
      case 'FAILED':
        return { color: '#ef4444', label: 'FAILED', bg: 'rgba(239, 68, 68, 0.15)', icon: AlertCircle };
      case 'CANCELLED':
        return { color: '#64748b', label: 'CANCELLED', bg: 'rgba(100, 116, 139, 0.15)', icon: Ban };
      default:
        return { color: '#6366f1', label: status, bg: 'rgba(99, 102, 241, 0.15)', icon: Clock };
    }
  };

  const meta = getStatusMeta(task.status);
  const IconComponent = meta.icon;
  const isRunning = task.status === 'PLANNING' || task.status === 'EXECUTING' || task.status === 'UNDERSTANDING';

  const discoveredOptions = extractDiscoveredOptions(task);

  const getPlatformColors = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'swiggy':
        return { color: '#fc8019', bg: 'rgba(252, 128, 25, 0.15)', name: 'Swiggy' };
      case 'blinkit':
        return { color: '#f8cb46', bg: 'rgba(248, 203, 70, 0.15)', name: 'Blinkit' };
      case 'zepto':
        return { color: '#8800ec', bg: 'rgba(136, 0, 236, 0.15)', name: 'Zepto' };
      case 'zomato':
      default:
        return { color: '#e23744', bg: 'rgba(226, 55, 68, 0.15)', name: 'Zomato' };
    }
  };

  const handleOpenOption = async (opt: DiscoveredOption) => {
    try {
      if (opt.deepLinkUrl) {
        const canOpen = await Linking.canOpenURL(opt.deepLinkUrl).catch(() => false);
        if (canOpen) {
          await Linking.openURL(opt.deepLinkUrl);
          return;
        }
      }
      if (opt.webFallbackUrl) {
        await Linking.openURL(opt.webFallbackUrl);
      }
    } catch {
      if (opt.webFallbackUrl) {
        Linking.openURL(opt.webFallbackUrl);
      }
    }
  };

  const isQuestionAnswer =
    task.finalAnswer &&
    (task.finalAnswer.includes('?') ||
      task.finalAnswer.toLowerCase().includes('would you like') ||
      task.finalAnswer.toLowerCase().includes('should i') ||
      task.finalAnswer.toLowerCase().includes('which one') ||
      task.finalAnswer.toLowerCase().includes('proceed'));

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={[styles.statusBadge, { backgroundColor: meta.bg, borderColor: meta.color }]}>
          {isRunning ? (
            <ActivityIndicator size="small" color={meta.color} style={{ marginRight: 4 }} />
          ) : (
            <IconComponent size={14} color={meta.color} style={{ marginRight: 4 }} />
          )}
          <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
        </View>

        <View style={styles.iterationBadge}>
          <Text style={styles.iterationText}>Iter: {task.iterations}/10</Text>
        </View>
      </View>

      <Text style={styles.goalText}>{task.goal}</Text>

      {/* Verified Final Answer or Agent Clarification Question */}
      {task.finalAnswer && (
        <View
          style={[
            styles.finalAnswerBox,
            isQuestionAnswer && { borderColor: 'rgba(245, 158, 11, 0.4)', backgroundColor: 'rgba(245, 158, 11, 0.08)' },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            {isQuestionAnswer ? (
              <HelpCircle size={14} color="#f59e0b" />
            ) : (
              <CheckCircle2 size={14} color="#10b981" />
            )}
            <Text
              style={[
                styles.finalAnswerLabel,
                isQuestionAnswer && { color: '#fbbf24' },
              ]}
            >
              {isQuestionAnswer ? 'Agent Question / Clarification' : 'Verified Agent Summary'}
            </Text>
          </View>
          <Text style={styles.finalAnswerText}>{task.finalAnswer}</Text>
        </View>
      )}

      {/* Discovered Items with Tappable Deep Links (Bug 1 Fix) */}
      {discoveredOptions.length > 0 && (
        <View style={styles.optionsContainer}>
          <Text style={styles.optionsSectionTitle}>
            Discovered Options ({discoveredOptions.length}) — Tap to view in App or Web:
          </Text>
          {discoveredOptions.map((opt, idx) => {
            const plat = getPlatformColors(opt.platform);
            return (
              <View key={idx} style={styles.optionCard}>
                <View style={styles.optionInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <Text style={styles.optionName}>{opt.itemName}</Text>
                    <View style={[styles.platformBadge, { backgroundColor: plat.bg }]}>
                      <Text style={[styles.platformBadgeText, { color: plat.color }]}>{plat.name}</Text>
                    </View>
                  </View>
                  <Text style={styles.optionRestaurant}>{opt.restaurantName}</Text>
                  <Text style={styles.optionPrice}>
                    {opt.currency === 'INR' ? '₹' : opt.currency} {opt.estimatedPrice}{' '}
                    <Text style={styles.estimateDisclaimer}>(estimated)</Text>
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.openLinkBtn, { borderColor: plat.color }]}
                  onPress={() => handleOpenOption(opt)}
                >
                  <Text style={[styles.openLinkText, { color: plat.color }]}>View</Text>
                  <ExternalLink size={13} color={plat.color} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {task.error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{task.error}</Text>
        </View>
      )}

      {isRunning && onCancel && (
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>Cancel Task</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#131826',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  iterationBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  iterationText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  goalText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 10,
  },
  finalAnswerBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginTop: 8,
  },
  finalAnswerLabel: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  finalAnswerText: {
    color: '#f1f5f9',
    fontSize: 13,
    lineHeight: 19,
  },
  optionsContainer: {
    marginTop: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  optionsSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  optionInfo: {
    flex: 1,
    marginRight: 10,
  },
  optionName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    flexShrink: 1,
  },
  platformBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  platformBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  optionRestaurant: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 2,
  },
  optionPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10b981',
  },
  estimateDisclaimer: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '400',
  },
  openLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  openLinkText: {
    fontSize: 11,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    marginTop: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '500',
  },
  cancelBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  cancelBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
});
