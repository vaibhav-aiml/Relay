import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createServer } from '../../src/server.js';
import { FastifyInstance } from 'fastify';
import { SchedulerDaemon } from '../../src/scheduler/daemon.js';


describe('Schedules REST API Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Mock daemon triggerNow to avoid external live LLM network latency in HTTP tests
    jest.spyOn(SchedulerDaemon.prototype, 'triggerNow').mockImplementation(async (userId, routineId) => {
      return {
        id: 'mock-scheduled-task-1',
        userId,
        goal: 'Summarize unread emails in Gmail and review my calendar',
        status: 'COMPLETED',
        plan: [],
        currentStep: 0,
        iterations: 1,
        source: 'scheduled',
        routineId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    app = createServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  it('performs full schedule lifecycle: Create -> List -> Update -> Toggle -> Run -> Delete', async () => {



    // 1. Create Schedule
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/schedules',
      headers: {
        'x-user-id': 'user-api-test',
      },
      payload: {
        name: 'API Morning Briefing',
        goal: 'Summarize unread emails in Gmail and review my calendar',
        scheduleType: 'recurring',
        frequency: 'weekdays',
        time: '08:30',
        preApprovedTools: ['gmail.readMessage', 'calendar.listEvents'],
        notificationType: 'push_and_run',
      },
    });

    expect(createRes.statusCode).toBe(201);
    const createdBody = JSON.parse(createRes.payload);
    expect(createdBody.schedule).toBeDefined();
    const scheduleId = createdBody.schedule.id;
    expect(createdBody.schedule.name).toBe('API Morning Briefing');
    expect(createdBody.schedule.status).toBe('active');
    expect(createdBody.schedule.preApprovedTools).toContain('gmail.readMessage');

    // 2. List Schedules
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/schedules',
      headers: {
        'x-user-id': 'user-api-test',
      },
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.payload);
    expect(listBody.schedules.length).toBeGreaterThanOrEqual(1);

    // 3. Update Schedule (PUT)
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/schedules/${scheduleId}`,
      headers: {
        'x-user-id': 'user-api-test',
      },
      payload: {
        name: 'Updated Morning Briefing',
        time: '09:00',
      },
    });
    expect(updateRes.statusCode).toBe(200);
    const updateBody = JSON.parse(updateRes.payload);
    expect(updateBody.schedule.name).toBe('Updated Morning Briefing');
    expect(updateBody.schedule.humanSchedule).toBe('Every weekday at 9:00 AM');

    // 4. Toggle Status (Pause)
    const toggleRes = await app.inject({
      method: 'POST',
      url: `/api/schedules/${scheduleId}/toggle`,
      headers: {
        'x-user-id': 'user-api-test',
      },
    });
    expect(toggleRes.statusCode).toBe(200);
    const toggleBody = JSON.parse(toggleRes.payload);
    expect(toggleBody.schedule.status).toBe('paused');

    // 5. Trigger "Run Now"
    const runRes = await app.inject({
      method: 'POST',
      url: `/api/schedules/${scheduleId}/run`,
      headers: {
        'x-user-id': 'user-api-test',
      },
    });
    expect(runRes.statusCode).toBe(200);
    const runBody = JSON.parse(runRes.payload);
    expect(runBody.success).toBe(true);
    expect(runBody.task).toBeDefined();

    // 6. Delete Schedule
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/schedules/${scheduleId}`,
      headers: {
        'x-user-id': 'user-api-test',
      },
    });
    expect(deleteRes.statusCode).toBe(200);

    // 7. Verify Deleted
    const verifyRes = await app.inject({
      method: 'GET',
      url: `/api/schedules/${scheduleId}`,
      headers: {
        'x-user-id': 'user-api-test',
      },
    });
    expect(verifyRes.statusCode).toBe(404);
  }, 30000);
});

