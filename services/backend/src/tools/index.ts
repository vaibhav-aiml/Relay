import { ToolRegistry } from './registry.js';
import {
  calendarFindAvailabilityTool,
  calendarListEventsTool,
  calendarCreateEventTool,
  calendarUpdateEventTool,
} from './calendar/index.js';
import {
  gmailSearchMessagesTool,
  gmailReadMessageTool,
  gmailDraftMessageTool,
  gmailSendMessageTool,
} from './gmail/index.js';
import { contactsSearchTool } from './contacts/index.js';
import { webSearchTool, webOpenTool } from './web/index.js';
import { tasksCreateTool, tasksGetStatusTool, tasksCancelTool } from './tasks/index.js';
import { memorySaveTool, memoryGetTool } from './memory/index.js';

export function initializeTools(): ToolRegistry {
  const registry = ToolRegistry.getInstance();

  // Calendar
  registry.register(calendarFindAvailabilityTool);
  registry.register(calendarListEventsTool);
  registry.register(calendarCreateEventTool);
  registry.register(calendarUpdateEventTool);

  // Gmail
  registry.register(gmailSearchMessagesTool);
  registry.register(gmailReadMessageTool);
  registry.register(gmailDraftMessageTool);
  registry.register(gmailSendMessageTool);

  // Contacts
  registry.register(contactsSearchTool);

  // Web
  registry.register(webSearchTool);
  registry.register(webOpenTool);

  // Tasks
  registry.register(tasksCreateTool);
  registry.register(tasksGetStatusTool);
  registry.register(tasksCancelTool);

  // Memory
  registry.register(memorySaveTool);
  registry.register(memoryGetTool);

  return registry;
}

export * from './types.js';
export * from './registry.js';
