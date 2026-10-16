import { prisma } from '../../config/database.js';

/**
 * In-memory fallback mutex queue for environments where MySQL GET_LOCK is not available
 * (such as SQLite local testing or unit test harnesses).
 */
const inMemoryMutexQueues = new Map<string, Promise<void>>();

async function acquireInMemoryLock(key: string, timeoutMs: number): Promise<() => void> {
  const currentPromise = inMemoryMutexQueues.get(key) || Promise.resolve();
  let release: () => void = () => {};

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('System is busy processing this request. Please try again.')), timeoutMs);
  });

  const nextPromise = new Promise<void>((resolve) => {
    release = resolve;
  });

  inMemoryMutexQueues.set(key, currentPromise.then(() => nextPromise));

  await Promise.race([currentPromise, timeoutPromise]);

  return () => {
    release();
    if (inMemoryMutexQueues.get(key) === nextPromise) {
      inMemoryMutexQueues.delete(key);
    }
  };
}

/**
 * Executes an asynchronous function within a dedicated MySQL advisory lock session.
 * 
 * CRITICAL ARCHITECTURAL GUARANTEE:
 * 1. The advisory lock (GET_LOCK) is acquired on a dedicated connection session.
 * 2. The entire business logic callback `fn()`—including its database transaction and COMMIT—
 *    executes WHILE THE LOCK IS CONTINUOUSLY HELD.
 * 3. The advisory lock (RELEASE_LOCK) is released ONLY AFTER `fn()` has completely settled (committed/resolved).
 * 4. This completely eliminates the race window between RELEASE_LOCK and transaction COMMIT.
 * 
 * @param lockKey The unique string identifying the advisory lock (e.g., canonical pair `conn_inv_${u1}_${u2}`)
 * @param timeoutSeconds Timeout in seconds to wait for lock acquisition before throwing
 * @param fn The callback to execute while holding the lock
 */
export async function withAdvisoryLock<T>(
  lockKey: string,
  timeoutSeconds: number = 10,
  fn: () => Promise<T>
): Promise<T> {
  let isMySql = true;

  try {
    return await prisma.$transaction(async (lockSession) => {
      let acquired = 0;
      try {
        const lockRows: any = await lockSession.$queryRaw`SELECT GET_LOCK(${lockKey}, ${timeoutSeconds}) as lockAcquired`;
        acquired = Number(lockRows?.[0]?.lockAcquired);
      } catch (sqlErr: any) {
        // If GET_LOCK is not supported by current DB dialect (e.g. SQLite in unit tests), fallback to in-memory mutex in non-production
        if (sqlErr?.message?.includes('no such function') || sqlErr?.message?.includes('syntax error')) {
          if (process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production') {
            throw new Error(`CRITICAL: MySQL GET_LOCK() is required in production environments but failed: ${sqlErr.message}. In-memory fallback is strictly disabled in production.`);
          }
          isMySql = false;
        } else {
          throw sqlErr;
        }
      }

      if (!isMySql) {
        const release = await acquireInMemoryLock(lockKey, timeoutSeconds * 1000);
        try {
          return await fn();
        } finally {
          release();
        }
      }

      if (acquired !== 1) {
        throw new Error('System is busy processing an action between these accounts. Please try again.');
      }

      try {
        // Execute the entire business transaction to full completion (including COMMIT)
        // while this lockSession connection continuously holds the lock
        return await fn();
      } finally {
        // Release advisory lock on the exact same dedicated connection session
        await lockSession.$queryRaw`SELECT RELEASE_LOCK(${lockKey})`.catch(() => {});
      }
    }, {
      // Allow ample time for the lock session to hold while inner transactions commit
      timeout: (timeoutSeconds + 15) * 1000,
      maxWait: 5000
    });
  } catch (error: any) {
    if (!isMySql) {
      if (process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production') {
        throw new Error('CRITICAL: In-memory advisory lock fallback is prohibited in production.');
      }
      const release = await acquireInMemoryLock(lockKey, timeoutSeconds * 1000);
      try {
        return await fn();
      } finally {
        release();
      }
    }
    throw error;
  }
}
