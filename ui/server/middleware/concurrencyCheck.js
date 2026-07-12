import { concurrencyDb, activeSessionTracker } from '../database/db.js';

const DEFAULT_MAX_CONCURRENT = 3;

// Check if the user has reached their concurrent session limit.
// Returns { allowed: boolean, max: number, active: number }
function checkConcurrency(userId) {
  const limit = concurrencyDb.getLimit(userId);
  const max = limit?.max_concurrent_sessions ?? DEFAULT_MAX_CONCURRENT;
  const active = activeSessionTracker.getActiveCount(userId);
  return { allowed: active < max, max, active };
}

// Acquire a session slot for a user. Call before starting a chat.
function acquireSession(userId, sessionKey) {
  activeSessionTracker.acquire(userId, sessionKey);
}

// Release a session slot for a user. Call when chat completes or aborts.
function releaseSession(userId, sessionKey) {
  activeSessionTracker.release(userId, sessionKey);
}

export { checkConcurrency, acquireSession, releaseSession, DEFAULT_MAX_CONCURRENT };
