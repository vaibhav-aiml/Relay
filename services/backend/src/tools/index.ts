import { ToolRegistry } from './registry.js';
import {
  calendarFindAvailabilityTool,
  calendarListEventsTool,
  calendarCreateEventTool,
  calendarUpdateEventTool,
  calendarDeleteEventTool,
} from './calendar/index.js';
import {
  gmailSearchMessagesTool,
  gmailReadMessageTool,
  gmailDraftMessageTool,
  gmailSendMessageTool,
} from './gmail/index.js';
import { contactsSearchTool } from './contacts/index.js';
import { telephonyMakeCallTool } from './telephony/index.js';
import { messagingSendWhatsAppTool, messagingSendSmsTool } from './messaging/index.js';
import { foodSearchOptionsTool, foodPrepareOrderTool } from './food/index.js';
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
  registry.register(calendarDeleteEventTool);

  // Gmail
  registry.register(gmailSearchMessagesTool);
  registry.register(gmailReadMessageTool);
  registry.register(gmailDraftMessageTool);
  registry.register(gmailSendMessageTool);

  // Contacts & Telephony
  registry.register(contactsSearchTool);
  registry.register(telephonyMakeCallTool);

  // Messaging (WhatsApp & SMS)
  registry.register(messagingSendWhatsAppTool);
  registry.register(messagingSendSmsTool);

  // Food Ordering & Discovery (Zomato / Swiggy / Blinkit / Zepto)
  registry.register(foodSearchOptionsTool);
  registry.register(foodPrepareOrderTool);

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
