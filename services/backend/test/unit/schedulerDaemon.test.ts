import { SchedulerDaemon } from '../../src/scheduler/daemon.js';
import { InMemoryRepository } from '../../src/database/inMemoryDb.js';
import { ScheduledRoutine, User } from '@relay/shared-types';

describe('SchedulerDaemon Unit Tests', () => {
  let db: InMemoryRepository;
  let testUser: User;

  beforeEach(async () => {
    db = new InMemoryRepository();
    testUser = {
      id: 'test-daemon-user',
      profile: {
        name: 'Daemon Test User',
        email: 'daemon@example.com',
        createdAt: new Date().toISOString(),
        timezone: 'UTC',
      },
      settings: {
        voiceEnabled: true,
        defaultProvider: 'groq',
        autoApproveLowRisk: true,
      },
    };
    await db.saveUser(testUser);
  });

  it('scans and dispatches due routines successfully', async () => {
    const daemon = new SchedulerDaemon(db, { tickIntervalMs: 50 });

    const pastTime = new Date(Date.now() - 10_000).toISOString();
    const routine: ScheduledRoutine = {
      id: 'due-routine-1',
      userId: testUser.id,
      name: 'Test Morning Routine',
      goal: 'Search the web for weather in Mumbai',
      scheduleType: 'recurring',
      cronExpression: '0 9 * * *',
      humanSchedule: 'Daily at 9:00 AM',
      nextRunAt: pastTime,
      status: 'active',
      totalRuns: 0,
      preApprovedTools: ['web.search'],
      autoApprove: true,
      notificationType: 'silent',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.saveSchedule(routine);

    // Invoke single deterministic tick
    await daemon.tick();

    // Check routine updated in DB
    const updated = await db.getSchedule(testUser.id, routine.id);
    expect(updated).toBeDefined();
    expect(updated!.totalRuns).toBe(1);
    expect(updated!.lastRunAt).toBeDefined();
    expect(new Date(updated!.nextRunAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('handles 5-minute catch-up window by skipping stale runs and advancing nextRunAt', async () => {
    const daemon = new SchedulerDaemon(db, { tickIntervalMs: 50 });

    // Routine is 15 minutes in the past (missed window due to downtime)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const routine: ScheduledRoutine = {
      id: 'stale-routine-1',
      userId: testUser.id,
      name: 'Stale Routine',
      goal: 'Check emails',
      scheduleType: 'recurring',
      cronExpression: '0 9 * * *',
      humanSchedule: 'Daily at 9:00 AM',
      nextRunAt: fifteenMinutesAgo,
      status: 'active',
      totalRuns: 0,
      preApprovedTools: ['gmail.readMessage'],
      autoApprove: true,
      notificationType: 'silent',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.saveSchedule(routine);

    // Run tick
    await daemon.tick();

    const updated = await db.getSchedule(testUser.id, routine.id);
    expect(updated).toBeDefined();
    // Skipped run should not increment totalRuns
    expect(updated!.totalRuns).toBe(0);
    // But nextRunAt should have been advanced to the next future occurrence
    expect(new Date(updated!.nextRunAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('completes one-time routines after execution', async () => {
    const daemon = new SchedulerDaemon(db, { tickIntervalMs: 50 });

    const pastTime = new Date(Date.now() - 5_000).toISOString();
    const routine: ScheduledRoutine = {
      id: 'once-routine-1',
      userId: testUser.id,
      name: 'One-Time Pizza Reminder',
      goal: 'Search food options on Zomato',
      scheduleType: 'once',
      scheduledAt: pastTime,
      nextRunAt: pastTime,
      humanSchedule: 'In 1 hour',
      status: 'active',
      totalRuns: 0,
      preApprovedTools: ['food.searchOptions'],
      autoApprove: true,
      notificationType: 'silent',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.saveSchedule(routine);
    await daemon.tick();

    const updated = await db.getSchedule(testUser.id, routine.id);
    expect(updated).toBeDefined();
    expect(updated!.status).toBe('completed');
    expect(updated!.totalRuns).toBe(1);
  });

  it('triggerNow executes immediately without advancing recurring nextRunAt', async () => {
    const daemon = new SchedulerDaemon(db, { tickIntervalMs: 50 });

    const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const routine: ScheduledRoutine = {
      id: 'future-routine-1',
      userId: testUser.id,
      name: 'Future Scheduled Routine',
      goal: 'Search latest news on AI',
      scheduleType: 'recurring',
      cronExpression: '0 9 * * *',
      humanSchedule: 'Daily at 9:00 AM',
      nextRunAt: futureTime,
      status: 'active',
      totalRuns: 0,
      preApprovedTools: ['web.search'],
      autoApprove: true,
      notificationType: 'silent',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.saveSchedule(routine);

    const task = await daemon.triggerNow(testUser.id, routine.id);
    expect(task).toBeDefined();
    expect(task.source).toBe('scheduled');
    expect(task.routineId).toBe(routine.id);

    const updated = await db.getSchedule(testUser.id, routine.id);
    expect(updated!.totalRuns).toBe(1);
    // Recurring nextRunAt should remain unchanged at future cadence
    expect(updated!.nextRunAt).toBe(futureTime);
  });
});
