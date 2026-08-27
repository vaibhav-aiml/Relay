import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TTS_SETTINGS_KEY = 'relay_tts_settings';
const MAX_CHUNK_LENGTH = 4000; // Android TTS has known truncation issues on long strings

export interface TTSSettings {
  enabled: boolean;
  voiceId?: string;
  rate: number;        // 0.5 – 2.0
  pitch: number;       // 0.5 – 2.0
  autoSpeakResults: boolean;
  autoSpeakApprovals: boolean;
}

const DEFAULT_SETTINGS: TTSSettings = {
  enabled: true,
  rate: 1.0,
  pitch: 1.0,
  autoSpeakResults: true,
  autoSpeakApprovals: true,
};

/**
 * Centralized TTS service wrapping expo-speech.
 *
 * Provides text formatting for natural speech delivery, sentence-level
 * chunking to prevent Android truncation, and AsyncStorage-based persistence
 * for user voice preferences.
 */
class TTSServiceClass {
  private settings: TTSSettings = { ...DEFAULT_SETTINGS };
  private defaultVoiceId?: string;
  private initialized = false;
  private speakingPromiseResolve: (() => void) | null = null;

  // ─── Initialization ───

  async init(): Promise<TTSSettings> {
    if (this.initialized) return this.settings;
    try {
      const stored = await AsyncStorage.getItem(TTS_SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.settings = { ...DEFAULT_SETTINGS, ...parsed };
      }
      // Pin a consistent default English voice if none is explicitly saved
      if (!this.settings.voiceId) {
        const voices = await this.getAvailableVoices();
        const preferredVoice =
          voices.find((v) => v.language.toLowerCase().includes('en-us') || v.language.toLowerCase().includes('en_us')) ||
          voices.find((v) => v.language.toLowerCase().startsWith('en'));
        if (preferredVoice) {
          this.defaultVoiceId = preferredVoice.identifier;
        }
      }
    } catch {
      // Defaults are fine
    }
    this.initialized = true;
    return this.settings;
  }

  getSettings(): TTSSettings {
    return { ...this.settings };
  }

  async saveSettings(updates: Partial<TTSSettings>): Promise<TTSSettings> {
    this.settings = { ...this.settings, ...updates };
    try {
      await AsyncStorage.setItem(TTS_SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      // Non-blocking persistence failure
    }
    return { ...this.settings };
  }

  // ─── Core Speech ───

  /**
   * Speak text aloud. Always stops any in-progress speech first.
   * Chunks long text on sentence boundaries to avoid Android truncation.
   */
  async speak(text: string, options?: { rate?: number; pitch?: number; voiceId?: string }): Promise<void> {
    this.stop(); // Cancel any in-progress speech

    const rate = options?.rate ?? this.settings.rate;
    const pitch = options?.pitch ?? this.settings.pitch;
    const voiceId = options?.voiceId ?? this.settings.voiceId ?? this.defaultVoiceId;

    const chunks = this.chunkText(text);

    for (const chunk of chunks) {
      await new Promise<void>((resolve) => {
        this.speakingPromiseResolve = resolve;

        const speechOptions: Speech.SpeechOptions = {
          rate,
          pitch,
          language: 'en-US',
          onDone: () => {
            this.speakingPromiseResolve = null;
            resolve();
          },
          onError: (err) => {
            this.speakingPromiseResolve = null;
            console.warn('[TTSService] Speech error:', err);
            resolve(); // Don't reject — gracefully continue
          },
          onStopped: () => {
            this.speakingPromiseResolve = null;
            resolve();
          },
        };

        if (voiceId) {
          speechOptions.voice = voiceId;
        }

        Speech.speak(chunk, speechOptions);
      });
    }
  }

  /**
   * Format text for natural spoken delivery, then speak.
   * Strips markdown, shortens URLs, truncates for comfortable listening.
   */
  async speakConcise(text: string, maxLength: number = 300): Promise<void> {
    const formatted = this.formatForSpeech(text, maxLength);
    return this.speak(formatted);
  }

  /**
   * Immediately stop any in-progress speech.
   */
  stop(): void {
    Speech.stop();
    if (this.speakingPromiseResolve) {
      this.speakingPromiseResolve();
      this.speakingPromiseResolve = null;
    }
  }

  /**
   * Check if TTS is currently speaking.
   */
  async isSpeaking(): Promise<boolean> {
    return Speech.isSpeakingAsync();
  }

  /**
   * List available device voices.
   */
  async getAvailableVoices(): Promise<Speech.Voice[]> {
    try {
      return await Speech.getAvailableVoicesAsync();
    } catch {
      return [];
    }
  }

  // ─── Text Formatting ───

  /**
   * Format text for natural spoken delivery:
   * - Strip markdown formatting
   * - Replace URLs with "link provided"
   * - Convert bullet lists to comma-separated natural speech
   * - Truncate to maxLength on sentence boundary
   */
  formatForSpeech(text: string, maxLength: number = 300): string {
    let result = text;

    // Strip markdown headers
    result = result.replace(/^#{1,6}\s+/gm, '');

    // Strip bold/italic markers
    result = result.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1');
    result = result.replace(/_{1,3}([^_]+)_{1,3}/g, '$1');

    // Strip inline code
    result = result.replace(/`([^`]+)`/g, '$1');

    // Strip code blocks
    result = result.replace(/```[\s\S]*?```/g, '');

    // Replace URLs with "link provided"
    result = result.replace(/https?:\/\/[^\s)]+/g, 'link provided');

    // Convert markdown bullet lists to comma-separated
    const bulletLines = result.match(/^[\s]*[-*+]\s+.+$/gm);
    if (bulletLines && bulletLines.length > 1) {
      const items = bulletLines.map((line) => line.replace(/^[\s]*[-*+]\s+/, '').trim());
      const listText = items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
      for (const line of bulletLines) {
        result = result.replace(line, '');
      }
      result = result.trim() + ' ' + listText;
    }

    // Convert numbered lists to comma-separated
    const numberedLines = result.match(/^[\s]*\d+[.)]\s+.+$/gm);
    if (numberedLines && numberedLines.length > 1) {
      const items = numberedLines.map((line) => line.replace(/^[\s]*\d+[.)]\s+/, '').trim());
      const listText = items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
      for (const line of numberedLines) {
        result = result.replace(line, '');
      }
      result = result.trim() + ' ' + listText;
    }

    // Collapse multiple whitespace/newlines
    result = result.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();

    // Truncate on sentence boundary
    if (result.length > maxLength) {
      const truncated = result.substring(0, maxLength);
      const lastSentenceEnd = Math.max(
        truncated.lastIndexOf('. '),
        truncated.lastIndexOf('! '),
        truncated.lastIndexOf('? '),
      );

      if (lastSentenceEnd > maxLength * 0.4) {
        result = truncated.substring(0, lastSentenceEnd + 1) + ' See the full response on screen.';
      } else {
        result = truncated.trimEnd() + '… See the full response on screen.';
      }
    }

    return result;
  }

  // ─── Chunking ───

  /**
   * Split text into chunks on sentence boundaries to prevent Android
   * TextToSpeech.speak() truncation on long strings.
   */
  private chunkText(text: string): string[] {
    if (text.length <= MAX_CHUNK_LENGTH) {
      return [text];
    }

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= MAX_CHUNK_LENGTH) {
        chunks.push(remaining);
        break;
      }

      const slice = remaining.substring(0, MAX_CHUNK_LENGTH);
      const lastSentenceEnd = Math.max(
        slice.lastIndexOf('. '),
        slice.lastIndexOf('! '),
        slice.lastIndexOf('? '),
      );

      if (lastSentenceEnd > MAX_CHUNK_LENGTH * 0.3) {
        chunks.push(remaining.substring(0, lastSentenceEnd + 1).trim());
        remaining = remaining.substring(lastSentenceEnd + 1).trim();
      } else {
        // No good sentence break — hard split at max
        chunks.push(slice.trim());
        remaining = remaining.substring(MAX_CHUNK_LENGTH).trim();
      }
    }

    return chunks;
  }
}

export const TTSService = new TTSServiceClass();
