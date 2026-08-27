import { useState, useRef, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
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
 * Shared voice recording hook used by both VoiceButton (press-to-talk)
 * and VoiceMode (continuous hands-free loop).
 *
 * IMPORTANT: startRecording() calls TTSService.stop() internally to
 * guarantee that any in-progress TTS speech is silenced before the mic
 * activates. This prevents the auto-re-listen loop in VoiceMode from
 * accidentally recording Relay's own voice.
 */
export function useVoiceRecording(): UseVoiceRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const startRecording = useCallback(async () => {
    // Always stop any in-progress TTS before recording — this lives HERE
    // (not in callers) so VoiceMode's programmatic auto-re-listen path
    // can't accidentally forget it.
    TTSService.stop();

    try {
      // Request microphone permission
      const permStatus = await Audio.requestPermissionsAsync();
      if (!permStatus.granted) {
        Alert.alert(
          'Microphone Permission Required',
          'Relay needs microphone access to capture your voice commands.',
        );
        return;
      }

      // Configure audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording with high quality settings
      const { recording } = await Audio.Recording.createAsync({
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
      });

      recordingRef.current = recording;
      setIsRecording(true);
    } catch (err: any) {
      console.warn('Failed to start recording:', err);
      Alert.alert('Recording Error', `Could not start voice recording: ${err.message}`);
    }
  }, []);

  const stopAndTranscribe = useCallback(async (): Promise<string | null> => {
    if (!recordingRef.current) return null;

    setIsRecording(false);
    setIsTranscribing(true);

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
        audioBase64 = await FileSystem.readAsStringAsync(uri, {
          encoding: 'base64',
        });
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
  }, []);

  const cancelRecording = useCallback(async () => {
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      } catch {
        // Ignore cleanup errors
      }
      recordingRef.current = null;
      setIsRecording(false);
    }
  }, []);

  return {
    isRecording,
    isTranscribing,
    startRecording,
    stopAndTranscribe,
    cancelRecording,
  };
}
