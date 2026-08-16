import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { Mic, MicOff } from 'lucide-react-native';
import { ApiService } from '../services/api';

interface VoiceButtonProps {
  onTranscribe: (text: string) => void;
  disabled?: boolean;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({ onTranscribe, disabled = false }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggleVoice = async () => {
    if (disabled || isLoading) return;

    if (!isRecording) {
      // Start simulated / live recording
      setIsRecording(true);
    } else {
      // Stop and transcribe
      setIsRecording(false);
      setIsLoading(true);

      try {
        // Send audio to Groq Whisper transcription endpoint
        const res = await ApiService.transcribeVoice('MOCK_AUDIO_BASE_64_RECORDING');
        if (res.text) {
          onTranscribe(res.text);
        }
      } catch (err) {
        console.warn('Voice transcription failed:', err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <View style={styles.wrapper}>
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
