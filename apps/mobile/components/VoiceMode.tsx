import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { X, MicOff, Mic, Volume2 } from 'lucide-react-native';
import { AudioVisualizer } from './AudioVisualizer';
import { useVoiceRecording } from '../hooks/useVoiceRecording';
import { useAppStore } from '../store/useAppStore';
import { TTSService } from '../services/tts';

type VoiceModeState = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING';

interface VoiceModeProps {
  visible: boolean;
  onClose: () => void;
}

interface ConversationEntry {
  role: 'user' | 'relay';
  text: string;
  timestamp: Date;
}

/**
 * Full-screen hands-free voice mode overlay.
 *
 * Provides a continuous listen → process → speak → listen loop
 * for conversational interaction with Relay.
 *
 * State machine: IDLE → LISTENING → PROCESSING → SPEAKING → LISTENING (loop)
 */
export const VoiceMode: React.FC<VoiceModeProps> = ({ visible, onClose }) => {
  const [voiceState, setVoiceState] = useState<VoiceModeState>('IDLE');
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<ConversationEntry[]>([]);
  const [currentText, setCurrentText] = useState('');

  const { isRecording, isTranscribing, startRecording, stopAndTranscribe, cancelRecording } =
    useVoiceRecording();
  const { createTask, pollTaskUntilDone, currentTask, isSpeaking, speakResponse } = useAppStore();

  const scrollRef = useRef<ScrollView>(null);
  const pollCleanupRef = useRef<(() => void) | null>(null);
  const autoRelistenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Handle hardware back button
  useEffect(() => {
    if (!visible) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });
    return () => backHandler.remove();
  }, [visible]);

  // Auto-start listening when voice mode opens
  useEffect(() => {
    if (visible && voiceState === 'IDLE') {
      const timer = setTimeout(() => {
        beginListening();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  // Monitor task completion for auto-speak
  useEffect(() => {
    if (voiceState !== 'PROCESSING' || !currentTask) return;

    if (currentTask.status === 'COMPLETED' && currentTask.finalAnswer) {
      handleRelayResponse(currentTask.finalAnswer);
    } else if (
      currentTask.status === 'WAITING_APPROVAL' &&
      currentTask.pendingApproval
    ) {
      handleRelayResponse(
        `I need your approval to ${currentTask.pendingApproval.description}. Please check the approval card on screen.`,
      );
    } else if (currentTask.status === 'FAILED') {
      handleRelayResponse(
        currentTask.error || 'Sorry, I encountered an error processing that request.',
      );
    } else if (currentTask.status === 'CANCELLED') {
      handleRelayResponse('That task was cancelled.');
    }
  }, [currentTask?.status, voiceState]);

  // Scroll to bottom on transcript updates
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [transcript]);

  const beginListening = useCallback(async () => {
    if (isMuted) {
      setVoiceState('IDLE');
      return;
    }

    setVoiceState('LISTENING');
    setCurrentText('Listening to your voice...');
    await startRecording();
  }, [isMuted, startRecording]);

  const handleStopAndProcess = useCallback(async () => {
    setVoiceState('PROCESSING');
    setCurrentText('Transcribing your voice...');

    const transcribedText = await stopAndTranscribe();

    if (!transcribedText) {
      setCurrentText('No speech detected. Tap mic to try again.');
      setVoiceState('IDLE');
      return;
    }

    // Add user's speech to transcript
    setTranscript((prev) => [
      ...prev,
      { role: 'user', text: transcribedText, timestamp: new Date() },
    ]);
    setCurrentText('Relay is reasoning...');

    try {
      // Create task and start polling
      const task = await createTask(transcribedText);
      pollCleanupRef.current = pollTaskUntilDone(task.id);
    } catch (err: any) {
      handleRelayResponse(
        err.message || 'Sorry, I could not process that. Please try again.',
      );
    }
  }, [stopAndTranscribe, createTask, pollTaskUntilDone]);

  const handleRelayResponse = useCallback(
    async (text: string) => {
      // Clear any prior streaming intervals
      if (streamingTimerRef.current) {
        clearInterval(streamingTimerRef.current);
        streamingTimerRef.current = null;
      }

      const formattedSpoken = TTSService.formatForSpeech(text);
      const words = formattedSpoken.split(/\s+/).filter(Boolean);

      setVoiceState('SPEAKING');

      // Initialize empty relay transcript bubble for real-time word streaming
      const initialWord = words[0] || '';
      setTranscript((prev) => [
        ...prev,
        { role: 'relay', text: initialWord, timestamp: new Date() },
      ]);
      setCurrentText(initialWord);

      // Start real-time word-by-word streaming typewriter animation synced to speech rate
      let wordIndex = 0;
      const rate = TTSService.getSettings().rate || 1.0;
      const wordIntervalMs = Math.max(120, Math.floor(320 / rate));

      if (words.length > 1) {
        streamingTimerRef.current = setInterval(() => {
          wordIndex++;
          if (wordIndex < words.length) {
            const currentStreamed = words.slice(0, wordIndex + 1).join(' ');
            setCurrentText(currentStreamed);
            setTranscript((prev) => {
              const updated = [...prev];
              if (updated.length > 0 && updated[updated.length - 1].role === 'relay') {
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  text: currentStreamed,
                };
              }
              return updated;
            });
          } else {
            if (streamingTimerRef.current) {
              clearInterval(streamingTimerRef.current);
              streamingTimerRef.current = null;
            }
          }
        }, wordIntervalMs);
      }

      // Speak response aloud via TTS
      try {
        await TTSService.speak(formattedSpoken);
      } catch (err) {
        console.warn('[VoiceMode] TTS speak error:', err);
      } finally {
        if (streamingTimerRef.current) {
          clearInterval(streamingTimerRef.current);
          streamingTimerRef.current = null;
        }
        // Ensure full text is displayed upon completion
        setCurrentText(formattedSpoken);
        setTranscript((prev) => {
          const updated = [...prev];
          if (updated.length > 0 && updated[updated.length - 1].role === 'relay') {
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              text: formattedSpoken,
            };
          }
          return updated;
        });
      }

      // After TTS finishes speaking, auto-re-listen with a short 500ms pause
      setVoiceState('IDLE');
      if (!isMuted) {
        autoRelistenTimerRef.current = setTimeout(() => {
          beginListening();
        }, 500);
      }
    },
    [isMuted, beginListening],
  );

  const handleClose = useCallback(() => {
    // Clean up all resources and timers
    if (streamingTimerRef.current) {
      clearInterval(streamingTimerRef.current);
      streamingTimerRef.current = null;
    }
    TTSService.stop();
    cancelRecording();
    if (pollCleanupRef.current) {
      pollCleanupRef.current();
      pollCleanupRef.current = null;
    }
    if (autoRelistenTimerRef.current) {
      clearTimeout(autoRelistenTimerRef.current);
      autoRelistenTimerRef.current = null;
    }
    setVoiceState('IDLE');
    setTranscript([]);
    setCurrentText('');
    setIsMuted(false);
    onClose();
  }, [onClose, cancelRecording]);

  const handleMuteToggle = useCallback(() => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (nextMuted) {
      // Stop listening if currently recording
      if (isRecording) {
        cancelRecording();
      }
      if (autoRelistenTimerRef.current) {
        clearTimeout(autoRelistenTimerRef.current);
        autoRelistenTimerRef.current = null;
      }
      setVoiceState('IDLE');
      setCurrentText('Muted — tap mic to resume');
    }
  }, [isMuted, isRecording, cancelRecording]);

  const handleMicTap = useCallback(async () => {
    if (voiceState === 'LISTENING' || isRecording) {
      await handleStopAndProcess();
    } else if (voiceState === 'SPEAKING') {
      TTSService.stop();
      setVoiceState('IDLE');
      setTimeout(() => beginListening(), 300);
    } else {
      await beginListening();
    }
  }, [voiceState, isRecording, handleStopAndProcess, beginListening]);

  const getVisualizerMode = (): 'idle' | 'listening' | 'speaking' => {
    switch (voiceState) {
      case 'LISTENING':
        return 'listening';
      case 'SPEAKING':
        return 'speaking';
      case 'PROCESSING':
        return 'speaking'; // Show activity during processing
      default:
        return 'idle';
    }
  };

  const getStateLabel = (): string => {
    switch (voiceState) {
      case 'IDLE':
        return isMuted ? 'Muted' : 'Tap to speak';
      case 'LISTENING':
        return 'Listening...';
      case 'PROCESSING':
        return 'Processing...';
      case 'SPEAKING':
        return 'Relay is speaking';
      default:
        return '';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Volume2 size={20} color="#818cf8" />
            <Text style={styles.headerTitle}>Voice Mode</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <X size={22} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        {/* Transcript history */}
        <ScrollView
          ref={scrollRef}
          style={styles.transcriptScroll}
          contentContainerStyle={styles.transcriptContent}
        >
          {transcript.map((entry, idx) => (
            <View
              key={idx}
              style={[
                styles.transcriptBubble,
                entry.role === 'user' ? styles.userBubble : styles.relayBubble,
              ]}
            >
              <Text style={styles.transcriptRole}>
                {entry.role === 'user' ? 'You' : '🛰️ Relay'}
              </Text>
              <Text style={styles.transcriptText}>{entry.text}</Text>
            </View>
          ))}

          {voiceState === 'PROCESSING' && (
            <View style={[styles.transcriptBubble, styles.relayBubble]}>
              <Text style={styles.transcriptRole}>🛰️ Relay</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color="#818cf8" />
                <Text style={styles.transcriptText}>Thinking...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Central visualizer orb */}
        <View style={styles.orbContainer}>
          <View style={styles.orbGlow}>
            <View style={styles.orbInner}>
              <AudioVisualizer mode={getVisualizerMode()} size="large" />
            </View>
          </View>
          <Text style={styles.stateLabel}>{getStateLabel()}</Text>

          {currentText && voiceState !== 'IDLE' && (
            <Text style={styles.currentText} numberOfLines={2}>
              {currentText}
            </Text>
          )}
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {/* Mute button */}
          <TouchableOpacity
            style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
            onPress={handleMuteToggle}
          >
            <MicOff size={20} color={isMuted ? '#ef4444' : '#94a3b8'} />
            <Text style={[styles.controlLabel, isMuted && styles.controlLabelActive]}>
              {isMuted ? 'Unmute' : 'Mute'}
            </Text>
          </TouchableOpacity>

          {/* Main mic button */}
          <TouchableOpacity
            style={[
              styles.mainMicBtn,
              voiceState === 'LISTENING' && styles.mainMicBtnListening,
              voiceState === 'SPEAKING' && styles.mainMicBtnSpeaking,
            ]}
            onPress={handleMicTap}
            disabled={voiceState === 'PROCESSING'}
          >
            {voiceState === 'PROCESSING' ? (
              <ActivityIndicator size="large" color="#ffffff" />
            ) : voiceState === 'LISTENING' ? (
              <MicOff size={32} color="#ffffff" />
            ) : (
              <Mic size={32} color="#ffffff" />
            )}
          </TouchableOpacity>

          {/* Stop button */}
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={handleClose}
          >
            <X size={20} color="#94a3b8" />
            <Text style={styles.controlLabel}>Stop</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090a0f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  transcriptScroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  transcriptContent: {
    paddingVertical: 16,
    gap: 12,
  },
  transcriptBubble: {
    borderRadius: 14,
    padding: 12,
    maxWidth: '85%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  relayBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  transcriptRole: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  transcriptText: {
    fontSize: 14,
    color: '#e2e8f0',
    lineHeight: 20,
  },
  orbContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 16,
  },
  orbGlow: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  orbInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(99, 102, 241, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  currentText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 18,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    paddingVertical: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  controlBtn: {
    alignItems: 'center',
    gap: 6,
    padding: 8,
  },
  controlBtnActive: {
    // No extra styling needed, color change handled inline
  },
  controlLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  controlLabelActive: {
    color: '#ef4444',
  },
  mainMicBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  mainMicBtnListening: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
  },
  mainMicBtnSpeaking: {
    backgroundColor: '#8b5cf6',
    shadowColor: '#8b5cf6',
  },
});
