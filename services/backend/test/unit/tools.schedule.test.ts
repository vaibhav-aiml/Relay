import { tasksScheduleTool, tasksListScheduledTool, tasksCancelScheduledTool } from '../../src/tools/tasks/index.js';
import { InMemoryRepository } from '../../src/database/inMemoryDb.js';
import { ExecutionContext } from '../../src/tools/types.js';

describe('Tasks Schedule Tool Tests', () => {
  let db: InMemoryRepository;
  let ctx: ExecutionContext;

  beforeEach(async () => {
    db = new InMemoryRepository();
    ctx = {
      userId: 'test-user-tools',
      taskId: 'task-101',
      db,
    };
  });

  it('tasks.schedule creates a valid scheduled routine', async () => {
    const res = await tasksScheduleTool.execute(
      {
        name: 'Morning Summary',
        goal: 'Summarize unread emails in Gmail',
        scheduleType: 'recurring',
        frequency: 'weekdays',
        time: '08:30',
        preApprovedTools: ['gmail.readMessage'],
        notificationType: 'push_and_run',
      },
      ctx
    );

    expect(res.scheduleId).toBeDefined();
    expect(res.name).toBe('Morning Summary');
    expect(res.status).toBe('active');
    expect(res.humanSchedule).toBe('Every weekday at 8:30 AM');
    expect(res.nextRunAt).toBeDefined();

    const isVerified = await tasksScheduleTool.verify!(res, ctx);
    expect(isVerified).toBe(true);
  });

  it('tasks.listScheduled returns created routines', async () => {
    // Create routine first
    const routine = await tasksScheduleTool.execute(
      {
        name: 'Weekly Sync',
        goal: 'Summarize weekly accomplishments',
        scheduleType: 'recurring',
        frequency: 'weekly',
        time: '17:00',
      },
      ctx
    );

    const listRes = await tasksListScheduledTool.execute({ status: 'active' }, ctx);
    expect(listRes.total).toBe(1);
    expect(listRes.schedules[0].name).toBe('Weekly Sync');
    expect(listRes.schedules[0].id).toBe(routine.scheduleId);
  });

  it('tasks.cancelScheduled cancels a routine', async () => {
    const routine = await tasksScheduleTool.execute(
      {
        name: 'Temporary Routine',
        goal: 'Test delete',
        scheduleType: 'once',
      },
      ctx
    );

    const cancelRes = await tasksCancelScheduledTool.execute({ scheduleId: routine.scheduleId }, ctx);
    expect(cancelRes.cancelled).toBe(true);

    const listRes = await tasksListScheduledTool.execute({ status: 'active' }, ctx);
    expect(listRes.total).toBe(0);
  });
});
