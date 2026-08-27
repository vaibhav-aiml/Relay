import { FastifyInstance } from 'fastify';
import Groq, { toFile } from 'groq-sdk';
import { VoiceTranscribeResponse, VoiceFormatRequest, VoiceFormatResponse } from '@relay/shared-types';
import { authMiddleware } from '../auth/middleware.js';

export async function voiceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // Transcribe audio using Groq Whisper endpoint
  app.post('/transcribe', async (req, reply) => {
    const groqKey = process.env.GROQ_API_KEY;

    try {
      let audioBuffer: Buffer | null = null;
      let filename = 'audio.m4a';

      if (req.isMultipart()) {
        const fileData = await req.file();
        if (fileData) {
          audioBuffer = await fileData.toBuffer();
          filename = fileData.filename || 'audio.m4a';
        }
      } else {
        const body = req.body as { audioBase64?: string; filename?: string };
        if (body?.audioBase64) {
          audioBuffer = Buffer.from(body.audioBase64, 'base64');
          filename = body.filename || 'audio.m4a';
        }
      }

      if (!audioBuffer) {
        return reply.status(400).send({ error: 'No audio data provided' });
      }

      if (groqKey) {
        const groq = new Groq({ apiKey: groqKey });
        const file = await toFile(audioBuffer, filename);

        const transcription = await groq.audio.transcriptions.create({
          file,
          model: 'whisper-large-v3-turbo',
          language: 'en',
          temperature: 0,
        });

        const response: VoiceTranscribeResponse = {
          text: transcription.text.trim(),
        };
        return reply.send(response);
      }

      // Mock transcription fallback when in pilot/test without Groq key
      const response: VoiceTranscribeResponse = {
        text: 'Schedule a meeting with Rahul on Tuesday at 3 PM to discuss the project roadmap.',
        durationSeconds: 3.5,
      };
      return reply.send(response);
    } catch (err: any) {
      req.log.error({ err }, 'Voice transcription failed');
      return reply.status(500).send({ error: `Transcription failed: ${err.message}` });
    }
  });

  // Format text for natural spoken TTS delivery
  app.post<{ Body: VoiceFormatRequest }>('/format-for-speech', async (req, reply) => {
    const { text, maxLength = 300 } = req.body || {};

    if (!text || typeof text !== 'string') {
      return reply.status(400).send({ error: 'Text is required' });
    }

    try {
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

      // Convert markdown bullet lists to comma-separated natural speech
      const bulletLines = result.match(/^[\s]*[-*+]\s+.+$/gm);
      if (bulletLines && bulletLines.length > 1) {
        const items = bulletLines.map((line) => line.replace(/^[\s]*[-*+]\s+/, '').trim());
        const listText = items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
        for (const line of bulletLines) {
          result = result.replace(line, '');
        }
        result = result.trim() + ' ' + listText;
      }

      // Convert numbered lists to comma-separated natural speech
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
      const truncated = result.length > maxLength;
      if (truncated) {
        const slice = result.substring(0, maxLength);
        const lastSentenceEnd = Math.max(
          slice.lastIndexOf('. '),
          slice.lastIndexOf('! '),
          slice.lastIndexOf('? '),
        );

        if (lastSentenceEnd > maxLength * 0.4) {
          result = slice.substring(0, lastSentenceEnd + 1) + ' See the full response on screen.';
        } else {
          result = slice.trimEnd() + '… See the full response on screen.';
        }
      }

      const response: VoiceFormatResponse = {
        spokenText: result,
        fullText: text,
        truncated,
      };
      return reply.send(response);
    } catch (err: any) {
      req.log.error({ err }, 'Voice format-for-speech failed');
      return reply.status(500).send({ error: `Format failed: ${err.message}` });
    }
  });
}
