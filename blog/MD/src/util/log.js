// log.js - Lightweight event logger for local usage analytics

import { db } from '../db/db.js';
import { now } from './ids.js';

export async function logEvent(type, refId = null, meta = {}) {
  try {
    await db.events.add({
      ts: now(),
      type,
      refId,
      meta
    });
  } catch (err) {
    console.warn('Failed to log event:', err);
  }
}
