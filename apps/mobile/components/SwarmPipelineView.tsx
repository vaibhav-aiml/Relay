import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SubAgentTask, WorkerAgentType } from '@relay/shared-types';
import {
  Cpu,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Search,
  Calendar,
  Utensils,
  MessageSquare,
  Sparkles,
  ShieldAlert,
  ArrowDown,
} from 'lucide-react-native';

interface SwarmPipelineViewProps {
  subtasks: SubAgentTask[];
}

export const SwarmPipelineView: React.FC<SwarmPipelineViewProps> = ({ subtasks }) => {
  const [expandedSubtaskId, setExpandedSubtaskId] = useState<string | null>(null);

  if (!subtasks || subtasks.length === 0) {
    return null;
  }

  // Group subtasks by stage
  const stagesMap = new Map<number, SubAgentTask[]>();
  subtasks.forEach((st) => {
    const stageNum = st.stage || 1;
    const list = stagesMap.get(stageNum) || [];
    list.push(st);
    stagesMap.set(stageNum, list);
  });

  const sortedStages = Array.from(stagesMap.keys()).sort((a, b) => a - b);

  const getArchetypeMeta = (agentType: WorkerAgentType) => {
    switch (agentType) {
      case 'researcher':
        return {
          name: 'Researcher Agent',
          icon: Search,
          color: '#06b6d4',
          bg: 'rgba(6, 182, 212, 0.15)',
          border: 'rgba(6, 182, 212, 0.3)',
        };
      case 'calendar_negotiator':
        return {
          name: 'Calendar Negotiator',
          icon: Calendar,
          color: '#10b981',
          bg: 'rgba(16, 185, 129, 0.15)',
          border: 'rgba(16, 185, 129, 0.3)',
        };
      case 'food_specialist':
        return {
          name: 'Food Specialist',
          icon: Utensils,
          color: '#f59e0b',
          bg: 'rgba(245, 158, 11, 0.15)',
          border: 'rgba(245, 158, 11, 0.3)',
        };
      case 'communicator':
        return {
          name: 'Communicator Agent',
          icon: MessageSquare,
          color: '#a855f7',
          bg: 'rgba(168, 85, 247, 0.15)',
          border: 'rgba(168, 85, 247, 0.3)',
        };
      case 'general_worker':
      default:
        return {
          name: 'General Worker',
          icon: Cpu,
          color: '#6366f1',
          bg: 'rgba(99, 102, 241, 0.15)',
          border: 'rgba(99, 102, 241, 0.3)',
        };
    }
  };

  const getStatusBadge = (status: SubAgentTask['status']) => {
    switch (status) {
      case 'completed':
        return { label: 'COMPLETED', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', icon: CheckCircle2 };
      case 'waiting_approval':
        return { label: 'WAITING APPROVAL', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', icon: ShieldAlert };
      case 'running':
        return { label: 'RUNNING', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', icon: Clock };
      case 'failed':
        return { label: 'FAILED', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', icon: AlertCircle };
      case 'pending':
      default:
        return { label: 'QUEUED', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', icon: Clock };
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedSubtaskId(expandedSubtaskId === id ? null : id);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Sparkles size={16} color="#38bdf8" />
        <Text style={styles.title}>Multi-Agent Swarm Pipeline</Text>
      </View>

      {sortedStages.map((stageNum, sIndex) => {
        const stageTasks = stagesMap.get(stageNum) || [];
        const isParallel = stageTasks.length > 1;

        return (
          <View key={stageNum} style={styles.stageSection}>
            <View style={styles.stageHeader}>
              <View style={styles.stageBadge}>
                <Text style={styles.stageBadgeText}>Stage {stageNum}</Text>
              </View>
              <Text style={styles.stageTitle}>
                {isParallel ? `Parallel Execution (${stageTasks.length} Workers)` : `Sequential Action (${stageTasks[0]?.name})`}
              </Text>
            </View>

            <View style={styles.workersGrid}>
              {stageTasks.map((st) => {
                const meta = getArchetypeMeta(st.agentType);
                const statusMeta = getStatusBadge(st.status);
                const IconComp = meta.icon;
                const StatusIcon = statusMeta.icon;
                const isExpanded = expandedSubtaskId === st.id;

                return (
                  <TouchableOpacity
                    key={st.id}
                    style={[styles.workerCard, { borderColor: meta.border }]}
                    onPress={() => toggleExpand(st.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.workerCardTop}>
                      <View style={styles.workerIdentity}>
                        <View style={[styles.archetypeIconBox, { backgroundColor: meta.bg }]}>
                          <IconComp size={16} color={meta.color} />
                        </View>
                        <View style={styles.workerNameCol}>
                          <Text style={[styles.archetypeTitle, { color: meta.color }]}>
                            {meta.name}
                          </Text>
                          <Text style={styles.subtaskName} numberOfLines={1}>
                            {st.name}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
                        <StatusIcon size={12} color={statusMeta.color} />
                        <Text style={[styles.statusBadgeText, { color: statusMeta.color }]}>
                          {statusMeta.label}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.subtaskGoal} numberOfLines={isExpanded ? 0 : 2}>
                      {st.goal}
                    </Text>

                    {/* Result Deliverable if completed */}
                    {st.result && (
                      <View style={styles.deliverableBox}>
                        <Text style={styles.deliverableLabel}>Deliverable:</Text>
                        <Text style={styles.deliverableText} numberOfLines={isExpanded ? 0 : 3}>
                          {typeof st.result === 'object' ? JSON.stringify(st.result) : String(st.result)}
                        </Text>
                      </View>
                    )}

                    {/* Expandable Step Trace */}
                    {isExpanded && st.plan && st.plan.length > 0 && (
                      <View style={styles.expandedSteps}>
                        <Text style={styles.expandedStepsTitle}>Worker Execution Steps:</Text>
                        {st.plan.map((step, idx) => (
                          <View key={step.id || idx} style={styles.stepRow}>
                            <Text style={styles.stepNumber}>#{idx + 1}</Text>
                            <Text style={styles.stepDesc}>{step.description}</Text>
                            <Text style={[styles.stepStatus, { color: step.status === 'completed' ? '#10b981' : '#f59e0b' }]}>
                              {step.status}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    <View style={styles.expandToggleRow}>
                      <Text style={styles.expandToggleText}>
                        {isExpanded ? 'Hide steps' : 'View steps & trace'}
                      </Text>
                      {isExpanded ? (
                        <ChevronUp size={14} color="#94a3b8" />
                      ) : (
                        <ChevronDown size={14} color="#94a3b8" />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {sIndex < sortedStages.length - 1 && (
              <View style={styles.stageConnector}>
                <View style={styles.connectorLine} />
                <ArrowDown size={14} color="#6366f1" />
                <View style={styles.connectorLine} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    marginBottom: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38bdf8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  stageSection: {
    marginBottom: 10,
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  stageBadge: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stageBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  stageTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  workersGrid: {
    gap: 10,
  },
  workerCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  workerCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  workerIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  archetypeIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workerNameCol: {
    flex: 1,
  },
  archetypeTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subtaskName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f8fafc',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  subtaskGoal: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 17,
    marginBottom: 8,
  },
  deliverableBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    padding: 8,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
    marginBottom: 8,
  },
  deliverableLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10b981',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  deliverableText: {
    fontSize: 12,
    color: '#e2e8f0',
    lineHeight: 16,
  },
  expandedSteps: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  expandedStepsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
  },
  stepNumber: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
  },
  stepDesc: {
    fontSize: 11,
    color: '#94a3b8',
    flex: 1,
  },
  stepStatus: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  expandToggleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  expandToggleText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  stageConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    gap: 8,
  },
  connectorLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
  },
});
