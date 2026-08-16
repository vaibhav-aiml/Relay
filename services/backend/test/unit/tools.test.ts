import { ToolRegistry } from '../../src/tools/registry.js';
import { initializeTools } from '../../src/tools/index.js';
import { InMemoryRepository } from '../../src/database/inMemoryDb.js';

describe('Tools & Zod Validation Unit Tests', () => {
  let registry: ToolRegistry;
  let db: InMemoryRepository;

  beforeAll(() => {
    registry = initializeTools();
    db = new InMemoryRepository();
  });

  test('validates and executes web.search successfully', async () => {
    const result = await registry.executeWithGuards(
      'web.search',
      { query: 'Node.js best practices', maxResults: 3 },
      { userId: 'test-user', taskId: 'task-1', db }
    );

    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
    expect(result.output).toBeDefined();
  });

  test('rejects invalid tool arguments that violate Zod schema', async () => {
    const result = await registry.executeWithGuards(
      'gmail.sendMessage',
      { to: 'not-an-email', subject: '' }, // Missing idempotencyKey and invalid email
      { userId: 'test-user', taskId: 'task-2', db }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Tool argument schema validation failed');
  });

  test('contacts.search returns matching contacts', async () => {
    const result = await registry.executeWithGuards(
      'contacts.search',
      { query: 'Rahul', maxResults: 5 },
      { userId: 'test-user', taskId: 'task-3', db }
    );

    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
    expect(result.output.contacts.length).toBeGreaterThan(0);
    expect(result.output.contacts[0].email).toBe('rahul@example.com');
  });
});
