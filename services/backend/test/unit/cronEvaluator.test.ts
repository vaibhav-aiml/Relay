import { getNextRun, isValidCron, buildCronFromPreset, parseWhenToSchedule } from '../../src/scheduler/cronEvaluator.js';

describe('CronEvaluator & Schedule Parsing Unit Tests', () => {
  const timezone = 'Asia/Kolkata';

  describe('isValidCron', () => {
    it('validates standard 5-part cron expressions', () => {
      expect(isValidCron('0 9 * * *', timezone)).toBe(true);
      expect(isValidCron('30 8 * * 1-5', timezone)).toBe(true);
      expect(isValidCron('0 0 1 * *', timezone)).toBe(true);
    });

    it('rejects malformed cron expressions', () => {
      expect(isValidCron('invalid-cron', timezone)).toBe(false);
      expect(isValidCron('99 99 99 99 99', timezone)).toBe(false);
    });
  });

  describe('getNextRun', () => {
    it('calculates future next execution date in given timezone', () => {
      const now = new Date('2026-08-25T08:00:00.000Z');
      const nextRun = getNextRun('0 9 * * *', 'UTC', now);
      expect(nextRun.getTime()).toBeGreaterThan(now.getTime());
      expect(nextRun.toISOString()).toBe('2026-08-25T09:00:00.000Z');
    });

    it('handles week-end rollovers correctly', () => {
      const friday = new Date('2026-08-28T10:00:00.000Z'); // Friday 10 AM
      const nextWeekday = getNextRun('0 9 * * 1-5', 'UTC', friday);
      expect(nextWeekday.getTime()).toBeGreaterThan(friday.getTime());
      // Should jump to Monday August 31
      expect(nextWeekday.getUTCDay()).toBe(1); // Monday
    });
  });

  describe('buildCronFromPreset', () => {
    it('builds daily preset with custom time', () => {
      const res = buildCronFromPreset('daily', '08:30');
      expect(res.cronExpression).toBe('30 8 * * *');
      expect(res.humanSchedule).toBe('Daily at 8:30 AM');
    });

    it('builds weekdays preset with PM time', () => {
      const res = buildCronFromPreset('weekdays', '19:45');
      expect(res.cronExpression).toBe('45 19 * * 1-5');
      expect(res.humanSchedule).toBe('Every weekday at 7:45 PM');
    });

    it('builds weekly preset with selected days', () => {
      const res = buildCronFromPreset('weekly', '10:00', [1, 5]);
      expect(res.cronExpression).toBe('0 10 * * 1,5');
      expect(res.humanSchedule).toContain('Monday, Friday');
    });
  });

  describe('parseWhenToSchedule', () => {
    it('parses "daily" keyword', () => {
      const res = parseWhenToSchedule('daily', timezone);
      expect(res.cronExpression).toBe('0 9 * * *');
    });

    it('parses "weekdays" keyword', () => {
      const res = parseWhenToSchedule('weekdays', timezone);
      expect(res.cronExpression).toBe('0 9 * * 1-5');
    });

    it('parses relative future offset "in 3 hours"', () => {
      const res = parseWhenToSchedule('in 3 hours', timezone);
      expect(res.scheduledAt).toBeDefined();
      const target = new Date(res.scheduledAt!);
      expect(target.getTime()).toBeGreaterThan(Date.now());
    });

    it('parses time strings like "every weekday at 8:30 am"', () => {
      const res = parseWhenToSchedule('every weekday at 8:30 am', timezone);
      expect(res.cronExpression).toBe('30 8 * * 1-5');
      expect(res.humanSchedule).toBe('Every weekday at 8:30 AM');
    });

    it('parses raw valid cron expression', () => {
      const res = parseWhenToSchedule('15 14 * * 2', timezone);
      expect(res.cronExpression).toBe('15 14 * * 2');
    });

    it('throws error on unparseable schedule', () => {
      expect(() => parseWhenToSchedule('some random gibberish', timezone)).toThrow();
    });
  });
});
