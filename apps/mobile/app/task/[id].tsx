import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, RefreshCw } from 'lucide-react-native';
import { Header } from '../../components/Header';
import { TaskStatusLive } from '../../components/TaskStatusLive';
import { ApprovalCard } from '../../components/ApprovalCard';
import { StepTrace } from '../../components/StepTrace';
import { useAppStore } from '../../store/useAppStore';

export default function TaskDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const {
    currentTask,
    taskEvents,
    isLoading,
    fetchTask,
    pollTaskUntilDone,
    submitApproval,
    cancelCurrentTask,
  } = useAppStore();

  useEffect(() => {
    if (id) {
      fetchTask(id);
      const stopPolling = pollTaskUntilDone(id);
      return () => stopPolling();
    }
  }, [id]);

  if (!currentTask || currentTask.id !== id) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header />
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Fetching Task #{id}...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isLive =
    currentTask.status === 'PLANNING' ||
    currentTask.status === 'EXECUTING' ||
    currentTask.status === 'WAITING_APPROVAL';

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header isLive={Boolean(isLive)} />

      <View style={styles.subBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={20} color="#cbd5e1" />
          <Text style={styles.backText}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.refreshBtn} onPress={() => fetchTask(id!)}>
          <RefreshCw size={16} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Status Live Banner */}
        <TaskStatusLive task={currentTask} onCancel={cancelCurrentTask} />

        {/* Approval Card if waiting */}
        {currentTask.pendingApproval && (
          <ApprovalCard
            approval={currentTask.pendingApproval}
            onApprove={(apprId) => submitApproval(apprId, 'approved')}
            onDeny={(apprId) => submitApproval(apprId, 'denied')}
            isLoading={isLoading}
          />
        )}

        {/* Chronological Step Trace */}
        <StepTrace steps={currentTask.plan || []} events={taskEvents} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#090a0f',
  },
  subBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600',
  },
  refreshBtn: {
    padding: 6,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14,
  },
});
