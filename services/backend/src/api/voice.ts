import { FastifyInstance } from 'fastify';
import Groq, { toFile } from 'groq-sdk';
import { VoiceTranscribeResponse } from '@relay/shared-types';
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
}
