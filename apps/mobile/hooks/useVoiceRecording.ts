import { useState, useRef, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { ApiService } from '../services/api';
import { TTSService } from '../services/tts';

interface UseVoiceRecordingReturn {
  isRecording: boolean;
  isTranscribing: boolean;
  startRecording: () => Promise<void>;
  stopAndTranscribe: () => Promise<string | null>;
  cancelRecording: () => Promise<void>;
}

/**
 * Shared voice recording hook using modern Expo SDK 58 `expo-audio`.
 * Used by both VoiceButton (press-to-talk) and VoiceMode (continuous hands-free loop).
 */
export function useVoiceRecording(): UseVoiceRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const isRecordingRef = useRef(false);

  const startRecording = useCallback(async () => {
    // Always stop any in-progress TTS before recording
    TTSService.stop();

    try {
      // Request microphone permission
      const permStatus = await requestRecordingPermissionsAsync();
      if (!permStatus.granted) {
        Alert.alert(
          'Microphone Permission Required',
          'Relay needs microphone access to capture your voice commands.',
        );
        return;
      }

      // Configure audio mode for recording
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      // Prepare and start recording
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      isRecordingRef.current = true;
      setIsRecording(true);
    } catch (err: any) {
      console.warn('Failed to start recording:', err);
      Alert.alert('Recording Error', `Could not start voice recording: ${err.message}`);
    }
  }, [audioRecorder]);

  const stopAndTranscribe = useCallback(async (): Promise<string | null> => {
    if (!isRecordingRef.current) return null;

    isRecordingRef.current = false;
    setIsRecording(false);
    setIsTranscribing(true);

    try {
      // Stop the recording
      await audioRecorder.stop();

      // Reset audio mode
      await setAudioModeAsync({
        allowsRecording: false,
      });

      // Get the recorded file URI
      const uri = audioRecorder.uri;

      if (!uri) {
        throw new Error('No audio file was created');
      }

      // Read the file as base64
      let audioBase64: string;
      if (Platform.OS === 'web') {
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
        try {
          audioBase64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType?.Base64 || 'base64',
          });
        } catch (fsErr) {
          // Fallback via File class if legacy throws on newer Expo SDK
          try {
            const { File } = await import('expo-file-system');
            const file = new File(uri);
            audioBase64 = await file.base64();
          } catch (fileClassErr) {
            throw new Error(`Failed to read audio file: ${(fsErr as any)?.message || fsErr}`);
          }
        }
      }

      if (!audioBase64 || audioBase64.length < 100) {
        throw new Error('Recording was too short or empty. Please speak for at least 1 second.');
      }

      // Send to backend Whisper transcription endpoint
      const res = await ApiService.transcribeVoice(audioBase64);
      if (res.text && res.text.trim().length > 0) {
        return res.text.trim();
      } else {
        Alert.alert(
          'No Speech Detected',
          'Relay could not detect speech. Please try again and speak clearly.',
        );
        return null;
      }
    } catch (err: any) {
      console.warn('Voice transcription failed:', err);
      Alert.alert(
        'Voice Error',
        err.message || 'Transcription failed. Make sure the backend is running.',
      );
      return null;
    } finally {
      setIsTranscribing(false);
    }
  }, [audioRecorder]);

  const cancelRecording = useCallback(async () => {
    if (isRecordingRef.current) {
      isRecordingRef.current = false;
      try {
        await audioRecorder.stop();
        await setAudioModeAsync({ allowsRecording: false });
      } catch {
        // Ignore cleanup errors
      }
      setIsRecording(false);
    }
  }, [audioRecorder]);

  return {
    isRecording,
    isTranscribing,
    startRecording,
    stopAndTranscribe,
    cancelRecording,
  };
}
