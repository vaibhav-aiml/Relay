import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Switch,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Header } from '../components/Header';
import {
  Clock,
  Plus,
  Play,
  Pause,
  Trash2,
  Edit3,
  Calendar,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Bell,
  X,
  RefreshCw,
  Mail,
  MessageSquare,
  Phone,
  Utensils,
  Search,
} from 'lucide-react-native';
import { ScheduledRoutine, CreateScheduleRequest, UpdateScheduleRequest } from '@relay/shared-types';
import { ApiService } from '../services/api';

const AVAILABLE_PERMISSIONS = [
  { key: 'gmail.readMessage', name: 'Read Gmail', icon: Mail, desc: 'Search & summarize emails' },
  { key: 'calendar.listEvents', name: 'Check Calendar', icon: Calendar, desc: 'Inspect upcoming schedule' },
  { key: 'messaging.sendWhatsApp', name: 'Send WhatsApp', icon: MessageSquare, desc: 'Send direct WhatsApp messages' },
  { key: 'food.searchOptions', name: 'Search Food', icon: Utensils, desc: 'Search Zomato & Swiggy menus' },
  { key: 'calendar.createEvent', name: 'Create Events', icon: Calendar, desc: 'Schedule new calendar meetings' },
  { key: 'telephony.makeCall', name: 'Phone Calls', icon: Phone, desc: 'Make automated phone calls' },
];

const PRESET_TEMPLATES = [
  {
    id: 'morning_briefing',
    title: 'Morning Briefing',
    emoji: '🌅',
    goal: 'Summarize unread emails in Gmail and review my calendar events for today.',
    frequency: 'weekdays' as const,
    time: '08:30',
    preApprovedTools: ['gmail.searchMessages', 'gmail.readMessage', 'calendar.listEvents'],
  },
  {
    id: 'dinner_reminder',
    title: 'Dinner Food Reminder',
    emoji: '🍕',
    goal: 'Search dinner food options under ₹300 from top rated restaurants on Zomato and Swiggy.',
    frequency: 'daily' as const,
    time: '19:00',
    preApprovedTools: ['food.searchOptions'],
  },
  {
    id: 'daily_agenda',
    title: 'Daily Agenda Prep',
    emoji: '📅',
    goal: 'Review today\'s meetings, identify schedule conflicts, and find free slots for deep work.',
    frequency: 'weekdays' as const,
    time: '09:00',
    preApprovedTools: ['calendar.listEvents', 'calendar.findAvailability'],
  },
  {
    id: 'weekly_recap',
    title: 'Friday Weekly Recap',
    emoji: '📊',
    goal: 'Summarize completed tasks and email threads this week, then WhatsApp me a summary.',
    frequency: 'weekly' as const,
    time: '17:00',
    daysOfWeek: [5],
    preApprovedTools: ['tasks.getStatus', 'calendar.listEvents', 'messaging.sendWhatsApp'],
  },
];

export default function SchedulesScreen() {
  const router = useRouter();
  const [routines, setRoutines] = useState<ScheduledRoutine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [runningRoutineId, setRunningRoutineId] = useState<string | null>(null);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<ScheduledRoutine | null>(null);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekdays' | 'weekly' | 'hourly' | 'once' | 'custom'>('daily');
  const [timeHour, setTimeHour] = useState('09');
  const [timeMinute, setTimeMinute] = useState('00');
  const [timePeriod, setTimePeriod] = useState<'AM' | 'PM'>('AM');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [customCron, setCustomCron] = useState('');
  const [relativeHours, setRelativeHours] = useState('2');
  const [preApprovedTools, setPreApprovedTools] = useState<string[]>([
    'gmail.readMessage',
    'calendar.listEvents',
  ]);
  const [notificationType, setNotificationType] = useState<'silent' | 'push' | 'push_and_run'>('push_and_run');
  const [saving, setSaving] = useState(false);

  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

  useEffect(() => {
    loadRoutines();
  }, []);

  const loadRoutines = async () => {
    try {
      setLoading(true);
      const res = await ApiService.listSchedules('all');
      setRoutines(res.schedules || []);
    } catch (err) {
      console.warn('Failed to load routines:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadRoutines();
  };

  const openCreateModal = () => {
    setEditingRoutine(null);
    setName('');
    setGoal('');
    setFrequency('daily');
    setTimeHour('09');
    setTimeMinute('00');
    setTimePeriod('AM');
    setSelectedDays([1, 2, 3, 4, 5]);
    setCustomCron('');
    setPreApprovedTools(['gmail.readMessage', 'calendar.listEvents']);
    setNotificationType('push_and_run');
    setModalVisible(true);
  };

  const openEditModal = (routine: ScheduledRoutine) => {
    setEditingRoutine(routine);
    setName(routine.name);
    setGoal(routine.goal);
    setPreApprovedTools(routine.preApprovedTools || []);
    setNotificationType(routine.notificationType || 'push_and_run');
    setFrequency(routine.scheduleType === 'once' ? 'once' : 'daily');
    setModalVisible(true);
  };

  const applyTemplate = (template: typeof PRESET_TEMPLATES[0]) => {
    setName(template.title);
    setGoal(template.goal);
    setFrequency(template.frequency);
    const [h, m] = template.time.split(':');
    const hourNum = parseInt(h, 10);
    setTimeHour((hourNum % 12 === 0 ? 12 : hourNum % 12).toString().padStart(2, '0'));
    setTimeMinute(m);
    setTimePeriod(hourNum >= 12 ? 'PM' : 'AM');
    if (template.daysOfWeek) setSelectedDays(template.daysOfWeek);
    setPreApprovedTools(template.preApprovedTools);
  };

  const togglePermission = (key: string) => {
    setPreApprovedTools((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleDayOfWeek = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleSaveRoutine = async () => {
    if (!name.trim()) {
      Alert.alert('Missing Field', 'Please enter a title for this routine.');
      return;
    }
    if (!goal.trim()) {
      Alert.alert('Missing Field', 'Please enter a goal for the routine to execute.');
      return;
    }

    setSaving(true);
    try {
      let hour24 = parseInt(timeHour, 10) || 9;
      if (timePeriod === 'PM' && hour24 < 12) hour24 += 12;
      if (timePeriod === 'AM' && hour24 === 12) hour24 = 0;
      const formattedTime = `${hour24.toString().padStart(2, '0')}:${timeMinute.padStart(2, '0')}`;

      if (editingRoutine) {
        const updateData: UpdateScheduleRequest = {
          name: name.trim(),
          goal: goal.trim(),
          scheduleType: frequency === 'once' ? 'once' : 'recurring',
          frequency,
          time: formattedTime,
          daysOfWeek: selectedDays,
          cronExpression: frequency === 'custom' ? customCron : undefined,
          preApprovedTools,
          notificationType,
        };
        await ApiService.updateSchedule(editingRoutine.id, updateData);
        Alert.alert('Updated', `Routine "${name}" updated successfully.`);
      } else {
        let scheduledAt: string | undefined;
        if (frequency === 'once') {
          const hours = parseInt(relativeHours, 10) || 2;
          const target = new Date(Date.now() + hours * 60 * 60 * 1000);
          scheduledAt = target.toISOString();
        }

        const createData: CreateScheduleRequest = {
          name: name.trim(),
          goal: goal.trim(),
          scheduleType: frequency === 'once' ? 'once' : 'recurring',
          frequency,
          time: formattedTime,
          daysOfWeek: selectedDays,
          scheduledAt,
          cronExpression: frequency === 'custom' ? customCron : undefined,
          preApprovedTools,
          autoApprove: true,
          notificationType,
        };
        await ApiService.createSchedule(createData);
        Alert.alert('Created', `Routine "${name}" scheduled successfully.`);
      }

      setModalVisible(false);
      loadRoutines();
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save routine.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (routine: ScheduledRoutine) => {
    try {
      const res = await ApiService.toggleSchedule(routine.id);
      setRoutines((prev) =>
        prev.map((r) => (r.id === routine.id ? { ...r, status: res.schedule.status } : r))
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to toggle status.');
    }
  };

  const handleRunNow = async (routine: ScheduledRoutine) => {
    setRunningRoutineId(routine.id);
    try {
      const res = await ApiService.runScheduleNow(routine.id);
      if (res.task) {
        Alert.alert(
          'Routine Started',
          `Launched autonomous task for "${routine.name}".`,
          [
            { text: 'OK' },
            {
              text: 'View Live Task',
              onPress: () => router.push(`/task/${res.task!.id}`),
            },
          ]
        );
      }
      loadRoutines();
    } catch (err: any) {
      Alert.alert('Run Failed', err.message || 'Failed to trigger routine.');
    } finally {
      setRunningRoutineId(null);
    }
  };

  const handleDeleteRoutine = (routine: ScheduledRoutine) => {
    Alert.alert(
      'Delete Routine',
      `Are you sure you want to delete "${routine.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await ApiService.deleteSchedule(routine.id);
            setRoutines((prev) => prev.filter((r) => r.id !== routine.id));
          },
        },
      ]
    );
  };

  const formatNextRun = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = date.getTime() - now.getTime();

      if (diffMs < 0) return 'Due now';
      const diffHours = Math.round(diffMs / (1000 * 60 * 60));
      if (diffHours <= 1) {
        const diffMins = Math.max(1, Math.round(diffMs / (1000 * 60)));
        return `In ${diffMins} min${diffMins > 1 ? 's' : ''}`;
      }
      if (diffHours < 24) return `In ${diffHours} hours`;

      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const activeCount = routines.filter((r) => r.status === 'active').length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Routines" subtitle="Proactive Autonomous Schedules" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6366f1" />}
      >
        {/* Top Summary Banner */}
        <View style={styles.topStatsRow}>
          <View style={styles.statCard}>
            <View style={styles.statIconBox}>
              <Clock size={20} color="#6366f1" />
            </View>
            <View>
              <Text style={styles.statNumber}>{activeCount}</Text>
              <Text style={styles.statLabel}>Active Routines</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.newRoutineBtn} onPress={openCreateModal}>
            <Plus size={18} color="#ffffff" />
            <Text style={styles.newRoutineBtnText}>New Routine</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Presets Carousel */}
        <View style={styles.presetsSection}>
          <View style={styles.sectionHeader}>
            <Sparkles size={16} color="#fbbf24" />
            <Text style={styles.sectionTitle}>1-Tap Preset Templates</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetScroll}>
            {PRESET_TEMPLATES.map((tmpl) => (
              <TouchableOpacity
                key={tmpl.id}
                style={styles.templateCard}
                onPress={() => {
                  openCreateModal();
                  applyTemplate(tmpl);
                }}
              >
                <Text style={styles.templateEmoji}>{tmpl.emoji}</Text>
                <Text style={styles.templateTitle}>{tmpl.title}</Text>
                <Text style={styles.templateDesc} numberOfLines={2}>
                  {tmpl.goal}
                </Text>
                <View style={styles.templateBadge}>
                  <Text style={styles.templateBadgeText}>
                    {tmpl.frequency === 'weekdays' ? 'Weekdays' : tmpl.frequency === 'weekly' ? 'Weekly' : 'Daily'} @ {tmpl.time}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Active Routines List */}
        <View style={styles.routinesSection}>
          <View style={styles.sectionHeader}>
            <Clock size={16} color="#38bdf8" />
            <Text style={styles.sectionTitle}>Your Routines ({routines.length})</Text>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#6366f1" />
              <Text style={styles.loadingText}>Loading routines...</Text>
            </View>
          ) : routines.length === 0 ? (
            <View style={styles.emptyCard}>
              <Clock size={32} color="#475569" />
              <Text style={styles.emptyTitle}>No Scheduled Routines Yet</Text>
              <Text style={styles.emptyDesc}>
                Create an autonomous routine or pick a preset above to make Relay proactively work for you.
              </Text>
              <TouchableOpacity style={styles.emptyAddBtn} onPress={openCreateModal}>
                <Plus size={16} color="#ffffff" />
                <Text style={styles.emptyAddBtnText}>Schedule First Routine</Text>
              </TouchableOpacity>
            </View>
          ) : (
            routines.map((routine) => {
              const isRunning = runningRoutineId === routine.id;
              const isActive = routine.status === 'active';

              return (
                <View key={routine.id} style={[styles.routineCard, !isActive && styles.routineCardPaused]}>
                  {/* Card Top Row */}
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.routineName}>{routine.name}</Text>
                        <View style={[styles.statusBadge, isActive ? styles.statusBadgeActive : styles.statusBadgePaused]}>
                          <Text style={[styles.statusBadgeText, isActive ? styles.statusTextActive : styles.statusTextPaused]}>
                            {routine.status.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.routineGoal} numberOfLines={2}>
                        "{routine.goal}"
                      </Text>
                    </View>

                    <Switch
                      value={isActive}
                      onValueChange={() => handleToggleActive(routine)}
                      trackColor={{ false: '#334155', true: '#6366f1' }}
                      thumbColor="#ffffff"
                    />
                  </View>

                  {/* Cadence and Next Run Row */}
                  <View style={styles.cadenceRow}>
                    <View style={styles.pillItem}>
                      <Calendar size={13} color="#94a3b8" />
                      <Text style={styles.pillText}>{routine.humanSchedule}</Text>
                    </View>
                    <View style={[styles.pillItem, styles.pillNextRun]}>
                      <Clock size={13} color="#38bdf8" />
                      <Text style={[styles.pillText, { color: '#38bdf8' }]}>
                        {formatNextRun(routine.nextRunAt)}
                      </Text>
                    </View>
                  </View>

                  {/* Pre-Approved Tools Pills */}
                  {routine.preApprovedTools && routine.preApprovedTools.length > 0 && (
                    <View style={styles.permissionsRow}>
                      <ShieldCheck size={12} color="#10b981" />
                      <Text style={styles.permissionsLabel}>Pre-approved:</Text>
                      {routine.preApprovedTools.map((tool) => (
                        <View key={tool} style={styles.toolPill}>
                          <Text style={styles.toolPillText}>{tool.split('.')[1] || tool}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Card Actions Footer */}
                  <View style={styles.cardFooter}>
                    <View style={styles.footerStats}>
                      <Text style={styles.statsText}>
                        Runs: <Text style={{ color: '#ffffff', fontWeight: '700' }}>{routine.totalRuns || 0}</Text>
                      </Text>
                      {routine.lastStatus && (
                        <View style={styles.lastStatusBox}>
                          {routine.lastStatus === 'success' ? (
                            <CheckCircle2 size={12} color="#10b981" />
                          ) : (
                            <AlertCircle size={12} color="#ef4444" />
                          )}
                          <Text
                            style={[
                              styles.lastStatusText,
                              { color: routine.lastStatus === 'success' ? '#10b981' : '#ef4444' },
                            ]}
                          >
                            Last: {routine.lastStatus}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.actionsGroup}>
                      <TouchableOpacity
                        style={[styles.runNowBtn, isRunning && styles.btnDisabled]}
                        onPress={() => handleRunNow(routine)}
                        disabled={isRunning}
                      >
                        {isRunning ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <>
                            <Play size={13} color="#ffffff" />
                            <Text style={styles.runNowBtnText}>Run Now</Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.iconActionBtn} onPress={() => openEditModal(routine)}>
                        <Edit3 size={15} color="#94a3b8" />
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.iconActionBtn} onPress={() => handleDeleteRoutine(routine)}>
                        <Trash2 size={15} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Create / Edit Routine Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{editingRoutine ? 'Edit Routine' : 'Create Routine'}</Text>
                <Text style={styles.modalSubtitle}>Timezone: {detectedTimezone}</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <X size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
              {/* Routine Name & Goal */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Routine Title</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Morning Briefing, Dinner Reminder"
                  placeholderTextColor="#64748b"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Autonomous Goal / Instructions</Text>
                <TextInput
                  style={[styles.modalInput, styles.textArea]}
                  placeholder="e.g. Check unread emails, list my meetings today, and send me a summary."
                  placeholderTextColor="#64748b"
                  value={goal}
                  onChangeText={setGoal}
                  multiline={true}
                  numberOfLines={3}
                />
              </View>

              {/* Frequency Selector */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Cadence / Frequency</Text>
                <View style={styles.frequencyRow}>
                  {[
                    { id: 'daily', label: 'Daily' },
                    { id: 'weekdays', label: 'Weekdays' },
                    { id: 'weekly', label: 'Weekly' },
                    { id: 'once', label: 'One-Time' },
                    { id: 'custom', label: 'Custom Cron' },
                  ].map((f) => (
                    <TouchableOpacity
                      key={f.id}
                      style={[styles.freqChip, frequency === f.id && styles.freqChipSelected]}
                      onPress={() => setFrequency(f.id as any)}
                    >
                      <Text style={[styles.freqChipText, frequency === f.id && styles.freqChipTextSelected]}>
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Time Pickers for Daily / Weekdays / Weekly */}
              {frequency !== 'once' && frequency !== 'custom' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Execution Time ({detectedTimezone.split('/')[1] || 'Local'})</Text>
                  <View style={styles.timeSelectorRow}>
                    <TextInput
                      style={styles.timeInput}
                      value={timeHour}
                      onChangeText={setTimeHour}
                      keyboardType="number-pad"
                      maxLength={2}
                      placeholder="09"
                      placeholderTextColor="#64748b"
                    />
                    <Text style={styles.timeColon}>:</Text>
                    <TextInput
                      style={styles.timeInput}
                      value={timeMinute}
                      onChangeText={setTimeMinute}
                      keyboardType="number-pad"
                      maxLength={2}
                      placeholder="00"
                      placeholderTextColor="#64748b"
                    />

                    <View style={styles.periodGroup}>
                      <TouchableOpacity
                        style={[styles.periodBtn, timePeriod === 'AM' && styles.periodBtnActive]}
                        onPress={() => setTimePeriod('AM')}
                      >
                        <Text style={[styles.periodText, timePeriod === 'AM' && styles.periodTextActive]}>AM</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.periodBtn, timePeriod === 'PM' && styles.periodBtnActive]}
                        onPress={() => setTimePeriod('PM')}
                      >
                        <Text style={[styles.periodText, timePeriod === 'PM' && styles.periodTextActive]}>PM</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

              {/* Weekly Day Selector */}
              {frequency === 'weekly' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Repeat On</Text>
                  <View style={styles.daySelectorRow}>
                    {[
                      { id: 1, label: 'M' },
                      { id: 2, label: 'T' },
                      { id: 3, label: 'W' },
                      { id: 4, label: 'T' },
                      { id: 5, label: 'F' },
                      { id: 6, label: 'S' },
                      { id: 0, label: 'S' },
                    ].map((d) => {
                      const isSel = selectedDays.includes(d.id);
                      return (
                        <TouchableOpacity
                          key={d.id}
                          style={[styles.dayCircle, isSel && styles.dayCircleSelected]}
                          onPress={() => toggleDayOfWeek(d.id)}
                        >
                          <Text style={[styles.dayCircleText, isSel && styles.dayCircleTextSelected]}>{d.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* One-Time Offset Input */}
              {frequency === 'once' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Run In (Hours from now)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={relativeHours}
                    onChangeText={setRelativeHours}
                    keyboardType="number-pad"
                    placeholder="2"
                    placeholderTextColor="#64748b"
                  />
                </View>
              )}

              {/* Custom Cron Input */}
              {frequency === 'custom' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>5-Part Cron Expression</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={customCron}
                    onChangeText={setCustomCron}
                    placeholder="30 8 * * 1-5"
                    placeholderTextColor="#64748b"
                    autoCapitalize="none"
                  />
                  <Text style={styles.hintText}>e.g. "30 8 * * 1-5" = 8:30 AM weekdays</Text>
                </View>
              )}

              {/* Pre-Approved Permissions Whitelist */}
              <View style={styles.inputGroup}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <ShieldCheck size={16} color="#10b981" />
                  <Text style={styles.inputLabel}>Pre-Approved Autonomous Permissions</Text>
                </View>
                <Text style={styles.hintText}>
                  Relay executes whitelisted tools without prompting for manual confirmation.
                </Text>

                <View style={styles.permissionsGrid}>
                  {AVAILABLE_PERMISSIONS.map((perm) => {
                    const isChecked = preApprovedTools.includes(perm.key);
                    const IconComponent = perm.icon;
                    return (
                      <TouchableOpacity
                        key={perm.key}
                        style={[styles.permCheckCard, isChecked && styles.permCheckCardSelected]}
                        onPress={() => togglePermission(perm.key)}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <IconComponent size={16} color={isChecked ? '#10b981' : '#94a3b8'} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.permName, isChecked && styles.permNameSelected]}>{perm.name}</Text>
                            <Text style={styles.permDesc}>{perm.desc}</Text>
                          </View>
                        </View>
                        <View style={[styles.checkBox, isChecked && styles.checkBoxActive]}>
                          {isChecked && <CheckCircle2 size={14} color="#ffffff" />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Notification Mode */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Notification Alert Mode</Text>
                <View style={styles.notifRow}>
                  {[
                    { id: 'push_and_run', label: 'Push & Run' },
                    { id: 'push', label: 'Push Only' },
                    { id: 'silent', label: 'Silent' },
                  ].map((mode) => (
                    <TouchableOpacity
                      key={mode.id}
                      style={[styles.notifChip, notificationType === mode.id && styles.notifChipActive]}
                      onPress={() => setNotificationType(mode.id as any)}
                    >
                      <Text style={[styles.notifChipText, notificationType === mode.id && styles.notifChipTextActive]}>
                        {mode.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.saveRoutineBtn, saving && styles.btnDisabled]}
                onPress={handleSaveRoutine}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.saveRoutineBtnText}>
                    {editingRoutine ? 'Update Routine' : 'Save & Activate Routine'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090a0f',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  topStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#111726',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  statLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  newRoutineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
  },
  newRoutineBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  presetsSection: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  presetScroll: {
    gap: 12,
    paddingRight: 16,
  },
  templateCard: {
    width: 170,
    backgroundColor: '#111726',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 6,
  },
  templateEmoji: {
    fontSize: 22,
  },
  templateTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  templateDesc: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 15,
  },
  templateBadge: {
    marginTop: 4,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  templateBadgeText: {
    color: '#818cf8',
    fontSize: 10,
    fontWeight: '700',
  },
  routinesSection: {
    gap: 12,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  emptyCard: {
    backgroundColor: '#111726',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 4,
  },
  emptyDesc: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  emptyAddBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  routineCard: {
    backgroundColor: '#111726',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 12,
  },
  routineCardPaused: {
    opacity: 0.65,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  routineName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusBadgePaused: {
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  statusTextActive: {
    color: '#10b981',
  },
  statusTextPaused: {
    color: '#94a3b8',
  },
  routineGoal: {
    fontSize: 12,
    color: '#cbd5e1',
    marginTop: 4,
    lineHeight: 17,
  },
  cadenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  pillItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  pillNextRun: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  pillText: {
    fontSize: 11,
    color: '#cbd5e1',
    fontWeight: '600',
  },
  permissionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  permissionsLabel: {
    fontSize: 11,
    color: '#94a3b8',
  },
  toolPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  toolPillText: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 12,
  },
  footerStats: {
    gap: 4,
  },
  statsText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  lastStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lastStatusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  actionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  runNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  runNowBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  iconActionBtn: {
    padding: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  modalScroll: {
    maxHeight: 520,
  },
  modalContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  hintText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  modalInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  frequencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  freqChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  freqChipSelected: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  freqChipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  freqChipTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  timeSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    width: 60,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  timeColon: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  periodGroup: {
    flexDirection: 'row',
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
    marginLeft: 8,
  },
  periodBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  periodBtnActive: {
    backgroundColor: '#6366f1',
  },
  periodText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
  },
  periodTextActive: {
    color: '#ffffff',
  },
  daySelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: {
    backgroundColor: '#6366f1',
  },
  dayCircleText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  dayCircleTextSelected: {
    color: '#ffffff',
  },
  permissionsGrid: {
    gap: 8,
    marginTop: 4,
  },
  permCheckCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  permCheckCardSelected: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  permName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  permNameSelected: {
    color: '#ffffff',
  },
  permDesc: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  notifRow: {
    flexDirection: 'row',
    gap: 8,
  },
  notifChip: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  notifChipActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: '#6366f1',
  },
  notifChipText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  notifChipTextActive: {
    color: '#818cf8',
    fontWeight: '700',
  },
  saveRoutineBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveRoutineBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
