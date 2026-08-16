import { z } from 'zod';

export const contactsSearchSchema = z.object({
  query: z.string().min(1).describe('Name or email of the contact to look up'),
  maxResults: z.coerce.number().int().min(1).max(20).default(5).describe('Max contacts to return'),
});
export type ContactsSearchInput = z.infer<typeof contactsSearchSchema>;
