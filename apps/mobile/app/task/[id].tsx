import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, RefreshCw, Send, Sparkles, CornerDownRight, Volume2 } from 'lucide-react-native';
import { Header } from '../../components/Header';
import { TaskStatusLive } from '../../components/TaskStatusLive';
import { ApprovalCard } from '../../components/ApprovalCard';
import { StepTrace } from '../../components/StepTrace';
import { AudioVisualizer } from '../../components/AudioVisualizer';
import { useAppStore } from '../../store/useAppStore';

export default function TaskDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const {
    currentTask,
    taskEvents,
    isLoading,
    isSpeaking,
    fetchTask,
    pollTaskUntilDone,
    submitApproval,
    submitTaskReply,
    cancelCurrentTask,
    speakResponse,
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

  // Detect if the completed final answer asked the user a question
  const isAgentQuestion =
    currentTask.status === 'COMPLETED' &&
    Boolean(
      currentTask.finalAnswer &&
        (currentTask.finalAnswer.includes('?') ||
          currentTask.finalAnswer.toLowerCase().includes('would you like') ||
          currentTask.finalAnswer.toLowerCase().includes('should i') ||
          currentTask.finalAnswer.toLowerCase().includes('which one') ||
          currentTask.finalAnswer.toLowerCase().includes('proceed') ||
          currentTask.finalAnswer.toLowerCase().includes('search for') ||
          currentTask.finalAnswer.toLowerCase().includes('let me know'))
    );

  const handleSendReply = async (textToSend?: string) => {
    const text = (textToSend || replyText).trim();
    if (!text || isSubmittingReply) return;

    try {
      setIsSubmittingReply(true);
      setReplyText('');
      await submitTaskReply(text);
    } catch (err) {
      console.warn('Failed to submit reply:', err);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const quickReplySuggestions = [
    'Proceed anyway with this option',
    'Search on Blinkit instead',
    'Search on Swiggy instead',
  ];

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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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

          {/* Manual Read Aloud button for final answer */}
          {currentTask.finalAnswer && (
            <TouchableOpacity
              style={styles.readAloudBtn}
              onPress={() => speakResponse(currentTask.finalAnswer!)}
              disabled={isSpeaking}
            >
              {isSpeaking ? (
                <AudioVisualizer mode="speaking" size="compact" />
              ) : (
                <>
                  <Volume2 size={14} color="#818cf8" />
                  <Text style={styles.readAloudText}>Read Aloud</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Reply / Follow-up Input Box (Bug 2 Fix: Appears when final answer contains a question) */}
          {isAgentQuestion && (
            <View style={styles.replyCard}>
              <View style={styles.replyHeader}>
                <Sparkles size={16} color="#818cf8" />
                <Text style={styles.replyTitle}>Reply to Continue Mission</Text>
              </View>

              {/* Quick suggestion pills */}
              <View style={styles.quickPillsRow}>
                {quickReplySuggestions.map((suggestion, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.quickPill}
                    onPress={() => handleSendReply(suggestion)}
                    disabled={isSubmittingReply}
                  >
                    <CornerDownRight size={11} color="#818cf8" />
                    <Text style={styles.quickPillText}>{suggestion}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Text input with submit button */}
              <View style={styles.replyInputRow}>
                <TextInput
                  style={styles.replyTextInput}
                  placeholder="Type your answer or instructions..."
                  placeholderTextColor="#64748b"
                  value={replyText}
                  onChangeText={setReplyText}
                  onSubmitEditing={() => handleSendReply()}
                  returnKeyType="send"
                  editable={!isSubmittingReply}
                />
                <TouchableOpacity
                  style={[
                    styles.replySendBtn,
                    (!replyText.trim() || isSubmittingReply) && styles.replySendBtnDisabled,
                  ]}
                  onPress={() => handleSendReply()}
                  disabled={!replyText.trim() || isSubmittingReply}
                >
                  {isSubmittingReply ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Send size={16} color="#ffffff" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  // Reply box styles
  replyCard: {
    backgroundColor: '#16192b',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  replyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#c7d2fe',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  quickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  quickPillText: {
    fontSize: 12,
    color: '#e0e7ff',
    fontWeight: '600',
  },
  replyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  replyTextInput: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  replySendBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replySendBtnDisabled: {
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
  },
  readAloudBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    marginTop: 10,
    marginBottom: 4,
  },
  readAloudText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#c7d2fe',
  },
});
