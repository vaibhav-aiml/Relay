import { IDatabaseRepository } from './types.js';
import { InMemoryRepository } from './inMemoryDb.js';
import { FirestoreRepository } from './firestore.js';

let dbInstance: IDatabaseRepository | null = null;

export function getDatabase(): IDatabaseRepository {
  if (!dbInstance) {
    const hasFirebase =
      Boolean(process.env.FIREBASE_PROJECT_ID) &&
      Boolean(process.env.FIREBASE_CLIENT_EMAIL) &&
      Boolean(process.env.FIREBASE_PRIVATE_KEY) &&
      process.env.NODE_ENV !== 'test';

    if (hasFirebase) {
      try {
        dbInstance = new FirestoreRepository();
        console.log('[Database] Connected to Firebase Firestore Admin SDK');
      } catch (err) {
        console.warn('[Database] Failed to init Firestore, falling back to InMemoryRepository:', err);
        dbInstance = new InMemoryRepository();
      }
    } else {
      console.log('[Database] Running with in-memory database (Standalone / Pilot / Test Mode)');
      dbInstance = new InMemoryRepository();
    }
  }
  return dbInstance;
}

export * from './types.js';
export * from './inMemoryDb.js';
export * from './firestore.js';
