import { google } from 'googleapis';
import { contactsSearchSchema, ContactsSearchInput } from '@relay/tool-schemas';
import { ToolDefinition, ExecutionContext } from '../types.js';
import { GoogleOAuthService } from '../../integrations/googleOAuth.js';

const mockContacts = [
  { name: 'Mom', email: 'mom@family.home', phone: '+91 98765 00001', relation: 'mother' },
  { name: 'Dad', email: 'dad@family.home', phone: '+91 98765 00002', relation: 'father' },
  { name: 'Rahul Sharma', email: 'rahul@example.com', phone: '+91 98765 43210', relation: 'colleague' },
  { name: 'Priya Patel', email: 'priya@example.com', phone: '+91 98123 45678', relation: 'friend' },
  { name: 'Amit Verma', email: 'amit@example.com', phone: '+91 99887 76655', relation: 'manager' },
  { name: 'Dr. Smith Clinic', email: 'appointments@drsmithdental.com', phone: '+91 98111 22334', relation: 'doctor' },
];

export const contactsSearchTool: ToolDefinition<ContactsSearchInput> = {
  name: 'contacts.search',
  description: 'Search contacts by name, email address, or relationship alias (e.g. Mom, Dad, Rahul).',
  inputSchema: contactsSearchSchema,
  riskLevel: 'LOW',
  requiredPermission: 'contacts.search',
  timeoutMs: 10_000,
  retryPolicy: { maxRetries: 2, backoffMs: 1000 },
  execute: async (input: ContactsSearchInput, ctx: ExecutionContext) => {
    // 1. First check user saved memories for contact entries (e.g., mom_phone, rahul_phone)
    const userMemories = await ctx.db.getMemories(ctx.userId);
    const queryLower = input.query.toLowerCase().trim();
    const memoryMatches: Array<{ name: string; email: string; phone: string; relation?: string }> = [];

    for (const mem of userMemories) {
      if (
        mem.key.toLowerCase().includes(queryLower) ||
        mem.value.toLowerCase().includes(queryLower)
      ) {
        // Extract phone number from memory value if present
        const phoneMatch = mem.value.match(/(\+?\d[\d\s-]{7,}\d)/);
        if (phoneMatch) {
          memoryMatches.push({
            name: mem.key.replace(/_/g, ' '),
            email: '',
            phone: phoneMatch[0],
            relation: 'saved_memory',
          });
        }
      }
    }

    if (memoryMatches.length > 0) {
      return { contacts: memoryMatches.slice(0, input.maxResults) };
    }

    // 2. User's Synced Device Contacts (from on-device phone book)
    const deviceContacts = await ctx.db.getUserContacts(ctx.userId);
    if (deviceContacts.length > 0) {
      const deviceMatches = deviceContacts.filter((c) => {
        const nameMatch = c.name.toLowerCase().includes(queryLower);
        const emailMatch = c.email ? c.email.toLowerCase().includes(queryLower) : false;
        const relationMatch = c.relation ? c.relation.toLowerCase().includes(queryLower) : false;
        const phoneMatch = c.phone ? c.phone.replace(/\s+/g, '').includes(queryLower.replace(/\s+/g, '')) : false;
        return nameMatch || emailMatch || relationMatch || phoneMatch;
      });

      if (deviceMatches.length > 0) {
        return {
          contacts: deviceMatches.slice(0, input.maxResults).map((c) => ({
            name: c.name,
            phone: c.phone || '',
            email: c.email || '',
            relation: c.relation || 'device_contact',
          })),
        };
      }
    }

    // 3. Google Contacts Integration if connected
    const connection = await ctx.db.getConnection(ctx.userId, 'google');

    if (connection && process.env.GOOGLE_CLIENT_ID) {
      try {
        const auth = GoogleOAuthService.createOAuthClient();
        const tokens = GoogleOAuthService.decryptTokens(connection.encryptedCredentialRef);
        auth.setCredentials(tokens);
        const people = google.people({ version: 'v1', auth });

        const res = await people.people.searchContacts({
          query: input.query,
          readMask: 'names,emailAddresses,phoneNumbers',
          pageSize: input.maxResults,
        });

        const contacts = (res.data.results || []).map((r) => {
          const person = r.person;
          return {
            name: person?.names?.[0]?.displayName || '',
            email: person?.emailAddresses?.[0]?.value || '',
            phone: person?.phoneNumbers?.[0]?.value || '',
          };
        });

        if (contacts.length > 0) {
          return { contacts };
        }
      } catch (err: any) {
        ctx.logger?.warn?.(`Google Contacts search failed: ${err.message}`);
      }
    }

    // 3. Fallback / Default Contacts with relationship alias matching
    const matches = mockContacts.filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(queryLower);
      const emailMatch = c.email.toLowerCase().includes(queryLower);
      const relationMatch = c.relation?.toLowerCase().includes(queryLower);
      const phoneMatch = c.phone.replace(/\s+/g, '').includes(queryLower.replace(/\s+/g, ''));
      return nameMatch || emailMatch || relationMatch || phoneMatch;
    });

    return {
      contacts: matches.slice(0, input.maxResults),
    };
  },
  verify: async (output) => {
    return Array.isArray(output.contacts);
  },
};
