import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Task } from '@relay/shared-types';
import { ChevronRight, CheckCircle2, Clock, AlertCircle, Ban } from 'lucide-react-native';

interface TaskCardProps {
  task: Task;
  onPress: (taskId: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onPress }) => {
  const getBadgeStyle = () => {
    switch (task.status) {
      case 'COMPLETED':
        return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', icon: CheckCircle2 };
      case 'WAITING_APPROVAL':
        return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', icon: Clock };
      case 'FAILED':
        return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', icon: AlertCircle };
      case 'CANCELLED':
        return { color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)', icon: Ban };
      default:
        return { color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)', icon: Clock };
    }
  };

  const badge = getBadgeStyle();
  const Icon = badge.icon;
  const dateFormatted = new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(task.id)}>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Icon size={12} color={badge.color} style={{ marginRight: 4 }} />
            <Text style={[styles.badgeText, { color: badge.color }]}>{task.status}</Text>
          </View>
          <Text style={styles.dateText}>{dateFormatted}</Text>
        </View>

        <Text style={styles.goalText} numberOfLines={2}>
          {task.goal}
        </Text>

        <View style={styles.footerRow}>
          <Text style={styles.stepsText}>
            {task.plan.length} {task.plan.length === 1 ? 'step' : 'steps'} • {task.iterations} iter
          </Text>
          <ChevronRight size={16} color="#64748b" />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111726',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  content: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dateText: {
    fontSize: 11,
    color: '#64748b',
  },
  goalText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f1f5f9',
    lineHeight: 20,
    marginBottom: 10,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
    paddingTop: 8,
  },
  stepsText: {
    fontSize: 11,
    color: '#94a3b8',
  },
});
