import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Task, TaskStatus } from '@relay/shared-types';
import { CheckCircle2, AlertCircle, Clock, Ban, Cpu } from 'lucide-react-native';

interface TaskStatusLiveProps {
  task: Task;
  onCancel?: () => void;
}

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

      {task.finalAnswer && (
        <View style={styles.finalAnswerBox}>
          <Text style={styles.finalAnswerLabel}>Verified Agent Summary</Text>
          <Text style={styles.finalAnswerText}>{task.finalAnswer}</Text>
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
    marginBottom: 4,
  },
  finalAnswerText: {
    color: '#f1f5f9',
    fontSize: 13,
    lineHeight: 19,
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
