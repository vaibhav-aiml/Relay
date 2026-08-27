import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowUpRight, Sparkles, Send, Clock, Mic } from 'lucide-react-native';

import { Header } from '../components/Header';
import { VoiceButton } from '../components/VoiceButton';
import { TaskStatusLive } from '../components/TaskStatusLive';
import { ApprovalCard } from '../components/ApprovalCard';
import { TaskCard } from '../components/TaskCard';
import { VoiceMode } from '../components/VoiceMode';
import { useAppStore } from '../store/useAppStore';

const QUICK_PROMPTS = [
  'Call Rahul',
  'Call Mom to say I will be late for dinner',
  'WhatsApp Rahul saying I will be 10 minutes late',
  'Send an SMS to Mom that I reached safely',
  'Order a cold coffee under ₹150 from Zomato',
  'Find pizza options between ₹100-200 on Swiggy',
  'Find 30m with Rahul on Tuesday afternoon and send an invite',
  'Check my unread emails from the team and summarize them',
  'Search the web for the latest updates on autonomous AI agents',
];

export default function HomeScreen() {
  const router = useRouter();
  const [goalInput, setGoalInput] = useState('');
  const [voiceModeVisible, setVoiceModeVisible] = useState(false);

  const {
    currentTask,
    tasks,
    isLoading,
    createTask,
    submitApproval,
    pollTaskUntilDone,
    cancelCurrentTask,
    fetchTasks,
    syncDeviceContacts,
  } = useAppStore();

  useEffect(() => {
    fetchTasks();
    // Sync device contacts only once on initial launch (guarded by AsyncStorage flag inside)
    syncDeviceContacts(false);
  }, []);


  const handleLaunchTask = async (goalToRun?: string) => {
    const text = goalToRun || goalInput;
    if (!text.trim() || isLoading) return;

    try {
      const task = await createTask(text.trim());
      setGoalInput('');
      pollTaskUntilDone(task.id);
      router.push(`/task/${task.id}`);
    } catch (err: any) {
      const message = err?.message || 'Unknown error';
      if (message.includes('Network') || message.includes('fetch') || message.includes('Failed to connect')) {
        Alert.alert(
          'Backend Not Reachable',
          'Could not connect to the Relay backend server. Please make sure the backend is running with:\n\nnpm run dev:backend',
        );
      } else {
        Alert.alert('Task Failed', message);
      }
    }
  };

  const isTaskActive =
    currentTask &&
    (currentTask.status === 'PLANNING' ||
      currentTask.status === 'EXECUTING' ||
      currentTask.status === 'WAITING_APPROVAL');

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header isLive={Boolean(isTaskActive)} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Active Task Banner if running */}
        {currentTask && (
          <View style={styles.activeSection}>
            <Text style={styles.sectionHeader}>Active Mission</Text>
            <TouchableOpacity onPress={() => router.push(`/task/${currentTask.id}`)}>
              <TaskStatusLive task={currentTask} onCancel={cancelCurrentTask} />
            </TouchableOpacity>

            {currentTask.pendingApproval && (
              <ApprovalCard
                approval={currentTask.pendingApproval}
                onApprove={(id) => submitApproval(id, 'approved')}
                onDeny={(id) => submitApproval(id, 'denied')}
                isLoading={isLoading}
              />
            )}
          </View>
        )}

        {/* Hero Goal Input Section */}
        <View style={styles.inputCard}>
          <View style={styles.inputHeader}>
            <Sparkles size={16} color="#6366f1" />
            <Text style={styles.inputHeaderTitle}>What should Relay do for you?</Text>
          </View>

          <TextInput
            style={styles.textInput}
            placeholder="e.g. Find time with Rahul on Tuesday at 3 PM and draft an invite..."
            placeholderTextColor="#64748b"
            value={goalInput}
            onChangeText={setGoalInput}
            multiline
            numberOfLines={3}
          />

          <View style={styles.inputActionRow}>
            <VoiceButton onTranscribe={(text) => setGoalInput(text)} disabled={isLoading} />

            <TouchableOpacity
              style={[
                styles.launchBtn,
                (!goalInput.trim() || isLoading) && styles.launchBtnDisabled,
              ]}
              onPress={() => handleLaunchTask()}
              disabled={!goalInput.trim() || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Text style={styles.launchBtnText}>Launch Relay</Text>
                  <Send size={16} color="#ffffff" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Routines Quick Widget */}
        <TouchableOpacity style={styles.routineWidget} onPress={() => router.push('/schedules')}>
          <View style={styles.routineWidgetLeft}>
            <View style={styles.routineIconBox}>
              <Clock size={18} color="#6366f1" />
            </View>
            <View>
              <Text style={styles.routineWidgetTitle}>Autonomous Routines & Schedules</Text>
              <Text style={styles.routineWidgetSub}>Morning briefings, reminders & recurring workflows</Text>
            </View>
          </View>
          <ArrowUpRight size={16} color="#6366f1" />
        </TouchableOpacity>

        {/* Quick Suggested Prompts */}
        <View style={styles.quickSection}>
          <Text style={styles.quickLabel}>Suggested Goals</Text>
          <View style={styles.promptList}>
            {QUICK_PROMPTS.map((prompt, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.promptPill}
                onPress={() => {
                  setGoalInput(prompt);
                }}
              >
                <Text style={styles.promptText}>{prompt}</Text>
                <ArrowUpRight size={14} color="#818cf8" />
              </TouchableOpacity>
            ))}
          </View>
        </View>


        {/* Recent Tasks */}
        {tasks.length > 0 && (
          <View style={styles.recentSection}>
            <View style={styles.recentHeaderRow}>
              <Text style={styles.sectionHeader}>Recent Missions</Text>
              <TouchableOpacity onPress={() => router.push('/history')}>
                <Text style={styles.viewAllText}>View all</Text>
              </TouchableOpacity>
            </View>

            {tasks.slice(0, 3).map((t) => (
              <TaskCard key={t.id} task={t} onPress={(id) => router.push(`/task/${id}`)} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Voice Mode FAB */}
      <TouchableOpacity
        style={styles.voiceModeFab}
        onPress={() => setVoiceModeVisible(true)}
        activeOpacity={0.8}
      >
        <View style={styles.voiceModeFabInner}>
          <Mic size={24} color="#ffffff" />
        </View>
      </TouchableOpacity>

      {/* Voice Mode Overlay */}
      <VoiceMode
        visible={voiceModeVisible}
        onClose={() => setVoiceModeVisible(false)}
      />
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
  },
  activeSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  inputCard: {
    backgroundColor: '#111726',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    marginBottom: 20,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  inputHeaderTitle: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 12,
    padding: 14,
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 22,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 14,
  },
  inputActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  launchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  launchBtnDisabled: {
    backgroundColor: '#334155',
    shadowOpacity: 0,
  },
  launchBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  quickSection: {
    marginBottom: 24,
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  promptList: {
    gap: 8,
  },
  promptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111726',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  promptText: {
    color: '#cbd5e1',
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  recentSection: {
    marginTop: 4,
  },
  recentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  viewAllText: {
    color: '#6366f1',
    fontSize: 12,
    fontWeight: '600',
  },
  routineWidget: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    marginBottom: 20,
  },
  routineWidgetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  routineIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routineWidgetTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  routineWidgetSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  voiceModeFab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    zIndex: 50,
  },
  voiceModeFabInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 2,
    borderColor: 'rgba(129, 140, 248, 0.4)',
  },
});

