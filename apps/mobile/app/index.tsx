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
import { ArrowUpRight, Sparkles, Send } from 'lucide-react-native';
import { Header } from '../components/Header';
import { VoiceButton } from '../components/VoiceButton';
import { TaskStatusLive } from '../components/TaskStatusLive';
import { ApprovalCard } from '../components/ApprovalCard';
import { TaskCard } from '../components/TaskCard';
import { useAppStore } from '../store/useAppStore';

const QUICK_PROMPTS = [
  'Call Rahul',
  'Call Mom to say I will be late for dinner',
  'Find 30m with Rahul on Tuesday afternoon and send an invite',
  'Check my unread emails from the team and summarize them',
  'Search the web for the latest updates on autonomous AI agents',
];

export default function HomeScreen() {
  const router = useRouter();
  const [goalInput, setGoalInput] = useState('');

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
});
