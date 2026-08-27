import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createServer } from '../../src/server.js';
import { FastifyInstance } from 'fastify';
import { SchedulerDaemon } from '../../src/scheduler/daemon.js';
import { getDatabase } from '../../src/database/index.js';

describe('Voice REST API Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    jest.setTimeout(30000);
    app = createServer();
    await app.ready();
  });

  afterAll(async () => {
    SchedulerDaemon.getInstance(getDatabase()).stop();
    await app.close();
    jest.restoreAllMocks();
  });

  it('POST /api/voice/format-for-speech strips markdown, converts bullet lists, and formats for TTS', async () => {
    const rawMarkdown = `
# Meeting Summary
Here are the key points:
- Reviewed the Q3 roadmap with Rahul
- Confirmed project launch on Tuesday
- Sent follow-up draft via Gmail

For more details check https://example.com/project-notes.
`;

    const res = await app.inject({
      method: 'POST',
      url: '/api/voice/format-for-speech',
      payload: {
        text: rawMarkdown,
        maxLength: 300,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.spokenText).toBeDefined();
    expect(body.fullText).toBe(rawMarkdown);
    // Markdown headers stripped
    expect(body.spokenText).not.toContain('# Meeting Summary');
    // URLs replaced with "link provided"
    expect(body.spokenText).not.toContain('https://example.com');
    expect(body.spokenText).toContain('link provided');
    // Bullet list converted to natural speech with 'and'
    expect(body.spokenText).toContain('and Sent follow-up draft');
  });

  it('POST /api/voice/format-for-speech truncates long text on sentence boundaries', async () => {
    const longText = 'First sentence of the update. Second sentence with important details. Third sentence that exceeds the small maximum character limit of seventy.';

    const res = await app.inject({
      method: 'POST',
      url: '/api/voice/format-for-speech',
      payload: {
        text: longText,
        maxLength: 80,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.truncated).toBe(true);
    expect(body.spokenText).toContain('See the full response on screen');
  });

  it('POST /api/voice/format-for-speech rejects empty text with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/voice/format-for-speech',
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });
});
