import { google } from 'googleapis';
import { contactsSearchSchema, ContactsSearchInput } from '@relay/tool-schemas';
import { ToolDefinition, ExecutionContext } from '../types.js';
import { GoogleOAuthService } from '../../integrations/googleOAuth.js';

const mockContacts = [
  { name: 'Rahul Sharma', email: 'rahul@example.com', phone: '+91 98765 43210' },
  { name: 'Priya Patel', email: 'priya@example.com', phone: '+91 98123 45678' },
  { name: 'Amit Verma', email: 'amit@example.com', phone: '+91 99887 76655' },
];

export const contactsSearchTool: ToolDefinition<ContactsSearchInput> = {
  name: 'contacts.search',
  description: 'Search contacts by name or email address.',
  inputSchema: contactsSearchSchema,
  riskLevel: 'LOW',
  requiredPermission: 'contacts.search',
  timeoutMs: 10_000,
  retryPolicy: { maxRetries: 2, backoffMs: 1000 },
  execute: async (input: ContactsSearchInput, ctx: ExecutionContext) => {
    const connection = await ctx.db.getConnection(ctx.userId, 'google');

    if (connection && process.env.GOOGLE_CLIENT_ID) {
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

      return { contacts };
    }

    const matches = mockContacts.filter(
      (c) =>
        c.name.toLowerCase().includes(input.query.toLowerCase()) ||
        c.email.toLowerCase().includes(input.query.toLowerCase())
    );

    return {
      contacts: matches.slice(0, input.maxResults),
    };
  },
  verify: async (output) => {
    return Array.isArray(output.contacts);
  },
};
