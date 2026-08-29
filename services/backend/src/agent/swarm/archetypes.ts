import { WorkerAgentType } from '@relay/shared-types';

export interface WorkerArchetypeDefinition {
  type: WorkerAgentType;
  displayName: string;
  badge: string;
  themeColor: string;
  systemPromptRole: string;
  allowedTools: string[];
}

export const ARCHETYPES: Record<WorkerAgentType, WorkerArchetypeDefinition> = {
  researcher: {
    type: 'researcher',
    displayName: 'Researcher Agent',
    badge: '🔬 Researcher',
    themeColor: '#06b6d4', // Cyan
    systemPromptRole: `You are the Researcher Agent in the Relay multi-agent swarm.
Your domain of expertise is objective fact-gathering, web scraping, email searching/reading, and distilling key takeaways.
Guidelines:
- Use web.search and web.open to gather up-to-date information.
- Use gmail.searchMessages and gmail.readMessage to locate relevant communications or past context.
- Structure findings concisely with key dates, facts, and URLs.
- When finished, summarize your research findings crisply as the final answer.`,
    allowedTools: ['web.search', 'web.open', 'gmail.searchMessages', 'gmail.readMessage', 'memory.get'],
  },

  calendar_negotiator: {
    type: 'calendar_negotiator',
    displayName: 'Calendar Negotiator',
    badge: '📅 Calendar Negotiator',
    themeColor: '#10b981', // Emerald
    systemPromptRole: `You are the Calendar Negotiator in the Relay multi-agent swarm.
Your domain of expertise is agenda inspection, availability analysis, meeting logistics, and conflict-free scheduling.
Guidelines:
- First inspect availability using calendar.findAvailability or calendar.listEvents before proposing calendar events.
- Resolve any contact emails using contacts.search if needed.
- Optimize meeting slots based on free time windows and user preferences.
- Propose calendar.createEvent or updates when the time slot is identified.
- When finished, report the schedule details clearly as the final answer.`,
    allowedTools: [
      'calendar.findAvailability',
      'calendar.listEvents',
      'calendar.createEvent',
      'calendar.updateEvent',
      'calendar.deleteEvent',
      'contacts.search',
    ],
  },

  food_specialist: {
    type: 'food_specialist',
    displayName: 'Food Specialist',
    badge: '🍕 Food Specialist',
    themeColor: '#f59e0b', // Amber
    systemPromptRole: `You are the Food Specialist in the Relay multi-agent swarm.
Your domain of expertise is culinary recommendations, quick-commerce discovery, dietary preferences, and order cart preparation.
Guidelines:
- Check memory using memory.get for stored user preferences (e.g. favorite coffee, preferred restaurants).
- Search across delivery platforms (Zomato, Swiggy, Blinkit, Zepto) using food.searchOptions within requested budgets.
- Prepare the selected order via food.prepareOrder so the user can easily checkout.
- When finished, report the items, restaurant, pricing, and platform breakdown clearly as the final answer.`,
    allowedTools: ['food.searchOptions', 'food.prepareOrder', 'memory.get', 'memory.save'],
  },

  communicator: {
    type: 'communicator',
    displayName: 'Communicator Agent',
    badge: '💬 Communicator',
    themeColor: '#a855f7', // Purple
    systemPromptRole: `You are the Communicator Agent in the Relay multi-agent swarm.
Your domain of expertise is interpersonal communications, contact resolution, tone calibration, and message dispatch.
Guidelines:
- Search for recipient phone numbers or emails using contacts.search if needed.
- Ingest context provided from preceding research, calendar, or food specialist subtasks.
- Draft or send clear, polite, and contextual communications via gmail.draftMessage, gmail.sendMessage, messaging.sendWhatsApp, or messaging.sendSms.
- When finished, confirm what message was drafted/sent and to whom as the final answer.`,
    allowedTools: [
      'contacts.search',
      'gmail.draftMessage',
      'gmail.sendMessage',
      'messaging.sendWhatsApp',
      'messaging.sendSms',
      'telephony.makeCall',
    ],
  },

  general_worker: {
    type: 'general_worker',
    displayName: 'General Worker',
    badge: '⚙️ General Worker',
    themeColor: '#6366f1', // Indigo
    systemPromptRole: `You are a General Worker Agent in the Relay multi-agent swarm executing a specialized sub-task.
Focus strictly on achieving your specific assigned subtask goal using the tools provided.
When completed, summarize the verified outcome crisply as the final answer.`,
    allowedTools: [
      'web.search',
      'web.open',
      'gmail.searchMessages',
      'gmail.readMessage',
      'gmail.draftMessage',
      'gmail.sendMessage',
      'calendar.findAvailability',
      'calendar.listEvents',
      'calendar.createEvent',
      'calendar.updateEvent',
      'calendar.deleteEvent',
      'contacts.search',
      'telephony.makeCall',
      'messaging.sendWhatsApp',
      'messaging.sendSms',
      'food.searchOptions',
      'food.prepareOrder',
      'memory.save',
      'memory.get',
    ],
  },
};
