import React, { useState, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, Alert } from 'react-native';
import { Mic, MicOff } from 'lucide-react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { ApiService } from '../services/api';

interface VoiceButtonProps {
  onTranscribe: (text: string) => void;
  disabled?: boolean;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({ onTranscribe, disabled = false }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const startRecording = async () => {
    try {
      // Request microphone permission
      const permStatus = await Audio.requestPermissionsAsync();
      if (!permStatus.granted) {
        Alert.alert('Microphone Permission Required', 'Relay needs microphone access to capture your voice commands.');
        return;
      }

      // Configure audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording with high quality settings
      const { recording } = await Audio.Recording.createAsync(
        {
          android: {
            extension: '.m4a',
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 128000,
          },
          ios: {
            extension: '.m4a',
            outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 128000,
          },
          web: {
            mimeType: 'audio/webm',
            bitsPerSecond: 128000,
          },
        }
      );

      recordingRef.current = recording;
      setIsRecording(true);
    } catch (err: any) {
      console.warn('Failed to start recording:', err);
      Alert.alert('Recording Error', `Could not start voice recording: ${err.message}`);
    }
  };

  const stopRecordingAndTranscribe = async () => {
    if (!recordingRef.current) return;

    setIsRecording(false);
    setIsLoading(true);

    try {
      // Stop the recording
      await recordingRef.current.stopAndUnloadAsync();

      // Reset audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      // Get the recorded file URI
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        throw new Error('No audio file was created');
      }

      // Read the file as base64
      let audioBase64: string;
      if (Platform.OS === 'web') {
        // On web, fetch the blob and convert
        const response = await fetch(uri);
        const blob = await response.blob();
        audioBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1] || result);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        // On native (iOS / Android), use FileSystem to read as base64
        audioBase64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      if (!audioBase64 || audioBase64.length < 100) {
        throw new Error('Recording was too short or empty. Please speak for at least 1 second.');
      }

      // Send to backend Whisper transcription endpoint
      const res = await ApiService.transcribeVoice(audioBase64);
      if (res.text && res.text.trim().length > 0) {
        onTranscribe(res.text.trim());
      } else {
        Alert.alert('No Speech Detected', 'Relay could not detect speech. Please try again and speak clearly.');
      }
    } catch (err: any) {
      console.warn('Voice transcription failed:', err);
      Alert.alert('Voice Error', err.message || 'Transcription failed. Make sure the backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleVoice = async () => {
    if (disabled || isLoading) return;

    if (!isRecording) {
      await startRecording();
    } else {
      await stopRecordingAndTranscribe();
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
