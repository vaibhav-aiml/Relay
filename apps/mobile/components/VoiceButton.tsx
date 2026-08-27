import React from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Mic, MicOff } from 'lucide-react-native';
import { useVoiceRecording } from '../hooks/useVoiceRecording';
import { AudioVisualizer } from './AudioVisualizer';

interface VoiceButtonProps {
  onTranscribe: (text: string) => void;
  disabled?: boolean;
}

/**
 * Press-to-talk mic button component.
 *
 * Now delegates recording logic to the shared useVoiceRecording hook
 * (which guarantees TTSService.stop() on startRecording) and shows
 * a compact AudioVisualizer during recording.
 */
export const VoiceButton: React.FC<VoiceButtonProps> = ({ onTranscribe, disabled = false }) => {
  const { isRecording, isTranscribing, startRecording, stopAndTranscribe } =
    useVoiceRecording();

  const isLoading = isTranscribing;

  const handleToggleVoice = async () => {
    if (disabled || isLoading) return;

    if (!isRecording) {
      await startRecording();
    } else {
      const text = await stopAndTranscribe();
      if (text) {
        onTranscribe(text);
      }
    }
  };

  return (
    <View style={styles.wrapper}>
      {isRecording && (
        <View style={styles.visualizerRow}>
          <AudioVisualizer mode="listening" size="compact" />
        </View>
      )}
      {isRecording && <View style={styles.pulseRing} />}
      <TouchableOpacity
        style={[
          styles.button,
          isRecording && styles.buttonRecording,
          disabled && styles.buttonDisabled,
        ]}
        onPress={handleToggleVoice}
        disabled={disabled || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : isRecording ? (
          <MicOff size={22} color="#ffffff" />
        ) : (
          <Mic size={22} color="#ffffff" />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 54,
    height: 54,
  },
  visualizerRow: {
    position: 'absolute',
    top: -28,
  },
  pulseRing: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1.5,
    borderColor: '#ef4444',
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  buttonRecording: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
  },
  buttonDisabled: {
    backgroundColor: '#475569',
    shadowOpacity: 0,
  },
});
