import { CronExpressionParser } from 'cron-parser';

export interface ParsedSchedule {
  cronExpression?: string;
  scheduledAt?: string;
  humanSchedule: string;
}

/**
 * Calculates the next execution Date given a 5-part cron expression and user timezone.
 */
export function getNextRun(cronExpression: string, timezone: string = 'UTC', fromDate?: Date): Date {
  const options = {
    tz: timezone,
    currentDate: fromDate || new Date(),
  };
  const interval = CronExpressionParser.parse(cronExpression, options);
  return interval.next().toDate();
}

/**
 * Validates whether a cron expression string is valid.
 */
export function isValidCron(cronExpression: string, timezone: string = 'UTC'): boolean {
  try {
    CronExpressionParser.parse(cronExpression, { tz: timezone });
    return true;
  } catch {
    return false;
  }
}



/**
 * Builds a deterministic 5-part cron expression and human description from structured preset parameters.
 */
export function buildCronFromPreset(
  frequency?: 'daily' | 'weekdays' | 'weekly' | 'hourly' | 'once' | 'custom',
  time?: string, // "HH:mm" e.g. "08:30"
  daysOfWeek?: number[], // [1,2,3,4,5] for Mon-Fri
  customCron?: string
): { cronExpression: string; humanSchedule: string } {
  let hour = 9;
  let minute = 0;

  if (time) {
    const parts = time.split(':');
    if (parts.length >= 2) {
      hour = parseInt(parts[0], 10) || 0;
      minute = parseInt(parts[1], 10) || 0;
    }
  }

  const formattedTime = `${hour % 12 === 0 ? 12 : hour % 12}:${minute.toString().padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;

  switch (frequency) {
    case 'hourly':
      return {
        cronExpression: `${minute} * * * *`,
        humanSchedule: `Every hour at minute ${minute.toString().padStart(2, '0')}`,
      };

    case 'weekdays':
      return {
        cronExpression: `${minute} ${hour} * * 1-5`,
        humanSchedule: `Every weekday at ${formattedTime}`,
      };

    case 'weekly': {
      const days = daysOfWeek && daysOfWeek.length > 0 ? daysOfWeek.join(',') : '1';
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const readableDays = (daysOfWeek || [1]).map((d) => dayNames[d] || 'Monday').join(', ');
      return {
        cronExpression: `${minute} ${hour} * * ${days}`,
        humanSchedule: `Weekly on ${readableDays} at ${formattedTime}`,
      };
    }

    case 'custom':
      if (!customCron) {
        throw new Error('Custom cron expression is required when frequency is custom');
      }
      return {
        cronExpression: customCron,
        humanSchedule: `Custom schedule: ${customCron}`,
      };

    case 'daily':
    default:
      return {
        cronExpression: `${minute} ${hour} * * *`,
        humanSchedule: `Daily at ${formattedTime}`,
      };
  }
}

/**
 * Parses natural language schedule instructions (used by tasks.schedule tool) into structured cron or ISO timestamp.
 */
export function parseWhenToSchedule(
  when: string,
  timezone: string = 'UTC'
): ParsedSchedule {
  const lower = when.toLowerCase().trim();
  const now = new Date();

  // 1. Standard Presets
  if (lower === 'daily' || lower === 'every day') {
    return { cronExpression: '0 9 * * *', humanSchedule: 'Daily at 9:00 AM' };
  }
  if (lower === 'weekdays' || lower === 'every weekday' || lower === 'workdays') {
    return { cronExpression: '0 9 * * 1-5', humanSchedule: 'Every weekday at 9:00 AM' };
  }
  if (lower === 'weekly' || lower === 'every week') {
    return { cronExpression: '0 9 * * 1', humanSchedule: 'Every Monday at 9:00 AM' };
  }
  if (lower === 'hourly' || lower === 'every hour') {
    return { cronExpression: '0 * * * *', humanSchedule: 'Every hour' };
  }

  // 2. Relative future offset: "in X minutes / hours / days" -> One-time execution
  const inMatch = lower.match(/in\s+(\d+)\s*(minute|min|hour|hr|day)s?/i);
  if (inMatch) {
    const num = parseInt(inMatch[1], 10);
    const unit = inMatch[2].toLowerCase();
    const target = new Date(now.getTime());

    if (unit.startsWith('min')) {
      target.setMinutes(target.getMinutes() + num);
    } else if (unit.startsWith('h')) {
      target.setHours(target.getHours() + num);
    } else if (unit.startsWith('d')) {
      target.setDate(target.getDate() + num);
    }

    return {
      scheduledAt: target.toISOString(),
      humanSchedule: `In ${num} ${unit}(s) (${target.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
    };
  }

  // 3. Time pattern: "every day at 8:30 pm", "weekdays at 8:30 am", "at 7:00 pm"
  const atMatch = lower.match(/(every weekday|every day|daily|weekdays)?\s*at\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (atMatch) {
    const cadence = atMatch[1]?.toLowerCase();
    let hour = parseInt(atMatch[2], 10);
    const minute = atMatch[3] ? parseInt(atMatch[3], 10) : 0;
    const period = atMatch[4]?.toLowerCase();

    if (period === 'pm' && hour < 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;

    const formattedTime = `${hour % 12 === 0 ? 12 : hour % 12}:${minute.toString().padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;

    if (cadence?.includes('weekday')) {
      return {
        cronExpression: `${minute} ${hour} * * 1-5`,
        humanSchedule: `Every weekday at ${formattedTime}`,
      };
    }

    return {
      cronExpression: `${minute} ${hour} * * *`,
      humanSchedule: `Daily at ${formattedTime}`,
    };
  }

  // 4. Raw Cron fallback
  if (isValidCron(lower, timezone)) {
    return {
      cronExpression: lower,
      humanSchedule: `Custom: ${lower}`,
    };
  }

  throw new Error(`Could not parse schedule expression: "${when}"`);
}
