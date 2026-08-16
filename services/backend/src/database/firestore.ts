import admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { User, Task, TaskEvent, Approval, Memory, Connection } from '@relay/shared-types';
import { IDatabaseRepository } from './types.js';

export class FirestoreRepository implements IDatabaseRepository {
  private db: admin.firestore.Firestore;

  constructor() {
    if (!admin.apps.length) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

      if (projectId && clientEmail && privateKey) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
      } else {
        admin.initializeApp();
      }
    }
    this.db = admin.firestore();
  }

  // Users
  async getUser(userId: string): Promise<User | null> {
    const snap = await this.db.collection('users').doc(userId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...(snap.data() as Omit<User, 'id'>) };
  }

  async saveUser(user: User): Promise<User> {
    const { id, ...data } = user;
    await this.db.collection('users').doc(id).set(data, { merge: true });
    return user;
  }

  // Tasks
  async getTask(userId: string, taskId: string): Promise<Task | null> {
    const snap = await this.db.collection('users').doc(userId).collection('tasks').doc(taskId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...(snap.data() as Omit<Task, 'id'>) };
  }

  async saveTask(task: Task): Promise<Task> {
    const updated = {
      ...task,
      updatedAt: new Date().toISOString(),
    };
    const { id, ...data } = updated;
    await this.db.collection('users').doc(task.userId).collection('tasks').doc(id).set(data, { merge: true });
    return updated;
  }

  async listTasks(userId: string, limit: number = 20): Promise<Task[]> {
    const snap = await this.db
      .collection('users')
      .doc(userId)
      .collection('tasks')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<Task, 'id'>) }));
  }

  // Task Events
  async logEvent(event: Omit<TaskEvent, 'id' | 'timestamp'>): Promise<TaskEvent> {
    const fullEvent: TaskEvent = {
      ...event,
      id: uuidv4(),
      timestamp: new Date().toISOString(),
    };
    const { id, ...data } = fullEvent;
    await this.db.collection('events').doc(id).set(data);
    return fullEvent;
  }

  async getTaskEvents(taskId: string): Promise<TaskEvent[]> {
    const snap = await this.db.collection('events').where('taskId', '==', taskId).orderBy('timestamp', 'asc').get();
    return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<TaskEvent, 'id'>) }));
  }

  // Approvals
  async createApproval(approval: Omit<Approval, 'id' | 'requestedAt'>): Promise<Approval> {
    const fullApproval: Approval = {
      ...approval,
      id: uuidv4(),
      requestedAt: new Date().toISOString(),
    };
    const { id, ...data } = fullApproval;
    await this.db.collection('approvals').doc(id).set(data);
    return fullApproval;
  }

  async getApproval(approvalId: string): Promise<Approval | null> {
    const snap = await this.db.collection('approvals').doc(approvalId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...(snap.data() as Omit<Approval, 'id'>) };
  }

  async getPendingApprovalForTask(taskId: string): Promise<Approval | null> {
    const snap = await this.db.collection('approvals').where('taskId', '==', taskId).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    const data = doc.data() as Approval;
    if (data.decision) return null;
    const { id, ...rest } = data;
    return { id: doc.id, ...rest };
  }

  async resolveApproval(approvalId: string, decision: 'approved' | 'denied', reason?: string): Promise<Approval> {
    const docRef = this.db.collection('approvals').doc(approvalId);
    const snap = await docRef.get();
    if (!snap.exists) throw new Error(`Approval ${approvalId} not found`);

    const update = {
      decision,
      decidedAt: new Date().toISOString(),
      ...(reason ? { denialReason: reason } : {}),
    };
    await docRef.update(update);
    return { id: snap.id, ...(snap.data() as Omit<Approval, 'id'>), ...update };
  }

  // Memories
  async saveMemory(memory: Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>): Promise<Memory> {
    const now = new Date().toISOString();
    const snap = await this.db
      .collection('users')
      .doc(memory.userId)
      .collection('memory')
      .where('key', '==', memory.key)
      .limit(1)
      .get();

    if (!snap.empty) {
      const doc = snap.docs[0];
      const updated: Memory = {
        id: doc.id,
        ...memory,
        createdAt: doc.data().createdAt || now,
        updatedAt: now,
      };
      await doc.ref.set(updated, { merge: true });
      return updated;
    }

    const id = uuidv4();
    const fullMemory: Memory = {
      ...memory,
      id,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.collection('users').doc(memory.userId).collection('memory').doc(id).set(fullMemory);
    return fullMemory;
  }

  async getMemories(userId: string, category?: string): Promise<Memory[]> {
    let query: admin.firestore.Query = this.db.collection('users').doc(userId).collection('memory');
    if (category) {
      query = query.where('category', '==', category);
    }
    const snap = await query.get();
    return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<Memory, 'id'>) }));
  }

  async deleteMemory(userId: string, memoryId: string): Promise<boolean> {
    await this.db.collection('users').doc(userId).collection('memory').doc(memoryId).delete();
    return true;
  }

  async clearAllMemories(userId: string): Promise<void> {
    const snap = await this.db.collection('users').doc(userId).collection('memory').get();
    const batch = this.db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }

  // Connections
  async saveConnection(connection: Connection): Promise<Connection> {
    await this.db.collection('users').doc(connection.userId).collection('connections').doc(connection.id).set(connection, { merge: true });
    return connection;
  }

  async getConnection(userId: string, provider: 'google'): Promise<Connection | null> {
    const snap = await this.db
      .collection('users')
      .doc(userId)
      .collection('connections')
      .where('provider', '==', provider)
      .where('status', '==', 'active')
      .limit(1)
      .get();
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...(snap.docs[0].data() as Omit<Connection, 'id'>) };
  }

  async deleteConnection(userId: string, connectionId: string): Promise<boolean> {
    await this.db.collection('users').doc(userId).collection('connections').doc(connectionId).delete();
    return true;
  }
}
