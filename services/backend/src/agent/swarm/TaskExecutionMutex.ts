/**
 * Per-task execution mutex to serialize forward execution and approval resumptions.
 * 
 * NOTE: process-local lock; revisit with distributed lock (e.g. Redis) if backend scales horizontally.
 */
export class TaskExecutionMutex {
  private static instance: TaskExecutionMutex;
  private queues: Map<string, Promise<any>> = new Map();

  private constructor() {}

  public static getInstance(): TaskExecutionMutex {
    if (!TaskExecutionMutex.instance) {
      TaskExecutionMutex.instance = new TaskExecutionMutex();
    }
    return TaskExecutionMutex.instance;
  }

  /**
   * Executes an asynchronous action exclusively for a given taskId.
   * Subsequent calls for the same taskId will wait until the previous action settles.
   */
  public async runExclusive<T>(taskId: string, fn: () => Promise<T>): Promise<T> {
    const currentPromise = this.queues.get(taskId) || Promise.resolve();

    let result!: T;
    let error: any = null;

    const nextPromise = currentPromise
      .catch(() => {}) // Ignore previous errors to avoid blocking the queue
      .then(async () => {
        try {
          result = await fn();
        } catch (err) {
          error = err;
        }
      });

    this.queues.set(taskId, nextPromise);

    try {
      await nextPromise;
    } finally {
      // Clean up map if this was the last queued promise
      if (this.queues.get(taskId) === nextPromise) {
        this.queues.delete(taskId);
      }
    }

    if (error) {
      throw error;
    }

    return result;
  }
}
