import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Header } from '../components/Header';
import {
  Search,
  X,
  RotateCcw,
  Trash2,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Ban,
  ChevronRight,
  Sparkles,
  Calendar,
  MessageSquare,
  Phone,
  Mail,
  Globe,
} from 'lucide-react-native';
import { useAppStore } from '../store/useAppStore';
import { Task, TaskFilterOptions } from '@relay/shared-types';

const STATUS_FILTERS = [
  { id: 'ALL', label: 'All Status' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'WAITING_APPROVAL', label: 'Needs Approval' },
  { id: 'FAILED', label: 'Failed' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

const CAPABILITY_FILTERS = [
  { id: 'ALL', label: 'All Capabilities', icon: null },
  { id: 'messaging', label: 'WhatsApp & SMS', icon: MessageSquare },
  { id: 'telephony', label: 'Phone Calls', icon: Phone },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'gmail', label: 'Gmail', icon: Mail },
  { id: 'web', label: 'Web Search', icon: Globe },
];

const TIME_FILTERS = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Past 7 Days' },
  { id: 'month', label: 'This Month' },
];

export default function HistoryScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedCapability, setSelectedCapability] = useState('ALL');
  const [selectedTime, setSelectedTime] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [rerunningId, setRerunningId] = useState<string | null>(null);

  const { tasks, fetchTasks, clearTaskHistory, createTask, pollTaskUntilDone } = useAppStore();

  const loadTasksWithFilters = useCallback(async () => {
    const filters: TaskFilterOptions = {
      query: searchQuery.trim() || undefined,
      status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
      tool: selectedCapability !== 'ALL' ? selectedCapability : undefined,
      timeHorizon: selectedTime !== 'all' ? selectedTime : undefined,
    };
    await fetchTasks(filters);
  }, [searchQuery, selectedStatus, selectedCapability, selectedTime, fetchTasks]);

  useEffect(() => {
    loadTasksWithFilters();
  }, [loadTasksWithFilters]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTasksWithFilters();
    setRefreshing(false);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const handleResetAllFilters = () => {
    setSearchQuery('');
    setSelectedStatus('ALL');
    setSelectedCapability('ALL');
    setSelectedTime('all');
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear All Task History',
      'Are you sure you want to delete your entire task audit log? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearTaskHistory();
            Alert.alert('Cleared', 'All task history has been wiped.');
          },
        },
      ]
    );
  };

  const handleRerunTask = async (task: Task) => {
    setRerunningId(task.id);
    try {
      const newTask = await createTask(task.goal);
      pollTaskUntilDone(newTask.id);
      router.push(`/task/${newTask.id}`);
    } catch (err: any) {
      Alert.alert('Re-run Failed', err.message || 'Could not launch task');
    } finally {
      setRerunningId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', icon: CheckCircle2, label: 'COMPLETED' };
      case 'WAITING_APPROVAL':
        return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', icon: Clock, label: 'WAITING APPROVAL' };
      case 'FAILED':
        return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', icon: AlertCircle, label: 'FAILED' };
      case 'CANCELLED':
        return { color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)', icon: Ban, label: 'CANCELLED' };
      default:
        return { color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)', icon: Clock, label: status };
    }
  };

  const getToolIconsForTask = (task: Task) => {
    const toolsUsed = new Set<string>();
    task.plan?.forEach((p) => {
      if (p.toolName) toolsUsed.add(p.toolName);
    });

    const badges: Array<{ label: string; color: string; bg: string }> = [];
    toolsUsed.forEach((t) => {
      if (t.includes('whatsapp')) badges.push({ label: 'WhatsApp', color: '#25D366', bg: 'rgba(37, 211, 102, 0.12)' });
      else if (t.includes('sms')) badges.push({ label: 'SMS', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' });
      else if (t.includes('telephony') || t.includes('call')) badges.push({ label: 'Phone', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' });
      else if (t.includes('calendar')) badges.push({ label: 'Calendar', color: '#818cf8', bg: 'rgba(99, 102, 241, 0.12)' });
      else if (t.includes('gmail')) badges.push({ label: 'Gmail', color: '#ea4335', bg: 'rgba(234, 67, 53, 0.12)' });
      else if (t.includes('web')) badges.push({ label: 'Web', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)' });
    });
    return badges;
  };

  const hasActiveFilters = searchQuery.trim() !== '' || selectedStatus !== 'ALL' || selectedCapability !== 'ALL' || selectedTime !== 'all';

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Missions" subtitle="Task History & Audit Log" />

      {/* Top Search & Filter Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={16} color="#64748b" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search goals, actions, people, topics..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={handleClearSearch} style={styles.clearSearchBtn}>
              <X size={14} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Status Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
          {STATUS_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[styles.filterChip, selectedStatus === f.id && styles.filterChipActive]}
              onPress={() => setSelectedStatus(f.id)}
            >
              <Text style={[styles.filterChipText, selectedStatus === f.id && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Capability / Channel Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
          {CAPABILITY_FILTERS.map((c) => {
            const Icon = c.icon;
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.capChip, selectedCapability === c.id && styles.capChipActive]}
                onPress={() => setSelectedCapability(c.id)}
              >
                {Icon && <Icon size={12} color={selectedCapability === c.id ? '#818cf8' : '#64748b'} style={{ marginRight: 4 }} />}
                <Text style={[styles.capChipText, selectedCapability === c.id && styles.capChipTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Time Horizon Filter Row */}
        <View style={styles.timeHorizonRow}>
          <View style={styles.timeHorizonLeft}>
            {TIME_FILTERS.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.timePill, selectedTime === t.id && styles.timePillActive]}
                onPress={() => setSelectedTime(t.id as any)}
              >
                <Text style={[styles.timePillText, selectedTime === t.id && styles.timePillTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {tasks.length > 0 && (
            <TouchableOpacity onPress={handleClearHistory} style={styles.clearAllHistoryBtn}>
              <Trash2 size={13} color="#f87171" />
              <Text style={styles.clearAllHistoryText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Main Task List */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
      >
        {tasks.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIconCircle}>
              <Filter size={24} color="#6366f1" />
            </View>
            <Text style={styles.emptyTitle}>
              {hasActiveFilters ? 'No matching missions found' : 'No missions yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {hasActiveFilters
                ? 'Try adjusting your search keywords or clearing active filters.'
                : 'Tasks and AI missions you launch will appear here with full execution traces.'}
            </Text>
            {hasActiveFilters && (
              <TouchableOpacity style={styles.resetFiltersBtn} onPress={handleResetAllFilters}>
                <RotateCcw size={14} color="#818cf8" />
                <Text style={styles.resetFiltersText}>Reset All Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          tasks.map((t) => {
            const badge = getStatusBadge(t.status);
            const BadgeIcon = badge.icon;
            const toolBadges = getToolIconsForTask(t);
            const dateStr = new Date(t.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            });
            const verifiedSteps = t.plan?.filter((p) => p.verified).length || 0;
            const totalSteps = t.plan?.length || 0;
            const isRerunning = rerunningId === t.id;

            return (
              <View key={t.id} style={styles.missionCard}>
                <TouchableOpacity onPress={() => router.push(`/task/${t.id}`)} style={{ flex: 1 }}>
                  {/* Top Status & Date Row */}
                  <View style={styles.cardHeaderRow}>
                    <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                      <BadgeIcon size={11} color={badge.color} style={{ marginRight: 4 }} />
                      <Text style={[styles.statusBadgeText, { color: badge.color }]}>{badge.label}</Text>
                    </View>
                    <Text style={styles.cardDateText}>{dateStr}</Text>
                  </View>

                  {/* Goal Description */}
                  <Text style={styles.cardGoalText} numberOfLines={2}>
                    {t.goal}
                  </Text>

                  {/* Final Answer / Result Preview if completed */}
                  {t.finalAnswer ? (
                    <Text style={styles.cardFinalAnswer} numberOfLines={1}>
                      ✓ {t.finalAnswer}
                    </Text>
                  ) : null}

                  {/* Capability Badges Row */}
                  {toolBadges.length > 0 && (
                    <View style={styles.toolBadgesRow}>
                      {toolBadges.map((tb, idx) => (
                        <View key={idx} style={[styles.toolPill, { backgroundColor: tb.bg }]}>
                          <Text style={[styles.toolPillText, { color: tb.color }]}>{tb.label}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Footer Stats Row */}
                  <View style={styles.cardFooter}>
                    <View style={styles.statsLeft}>
                      <Text style={styles.statsText}>
                        {totalSteps} {totalSteps === 1 ? 'step' : 'steps'}
                        {verifiedSteps > 0 ? ` • ${verifiedSteps} verified` : ''}
                        {t.iterations > 0 ? ` • ${t.iterations} iter` : ''}
                      </Text>
                    </View>

                    {/* Quick Re-run Action */}
                    <View style={styles.actionsRight}>
                      <TouchableOpacity
                        style={styles.rerunBtn}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleRerunTask(t);
                        }}
                        disabled={isRerunning}
                      >
                        {isRerunning ? (
                          <ActivityIndicator size="small" color="#818cf8" />
                        ) : (
                          <>
                            <RotateCcw size={12} color="#818cf8" />
                            <Text style={styles.rerunBtnText}>Re-run</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <ChevronRight size={16} color="#64748b" />
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090a0f',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    gap: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111726',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    padding: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  filterChipRow: {
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#111726',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: '#6366f1',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  filterChipTextActive: {
    color: '#818cf8',
    fontWeight: '700',
  },
  capChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#111726',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  capChipActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderColor: '#818cf8',
  },
  capChipText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  capChipTextActive: {
    color: '#818cf8',
    fontWeight: '700',
  },
  timeHorizonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeHorizonLeft: {
    flexDirection: 'row',
    gap: 6,
  },
  timePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  timePillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  timePillText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  timePillTextActive: {
    color: '#cbd5e1',
    fontWeight: '700',
  },
  clearAllHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  clearAllHistoryText: {
    fontSize: 11,
    color: '#f87171',
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  missionCard: {
    backgroundColor: '#111726',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardDateText: {
    fontSize: 11,
    color: '#64748b',
  },
  cardGoalText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f1f5f9',
    lineHeight: 20,
    marginBottom: 6,
  },
  cardFinalAnswer: {
    fontSize: 12,
    color: '#10b981',
    marginBottom: 8,
  },
  toolBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  toolPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  toolPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
    paddingTop: 8,
  },
  statsLeft: {
    flex: 1,
  },
  statsText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rerunBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rerunBtnText: {
    fontSize: 11,
    color: '#818cf8',
    fontWeight: '700',
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
    marginBottom: 16,
  },
  resetFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resetFiltersText: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: '700',
  },
});
