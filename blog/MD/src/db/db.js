// db.js - Dexie schema v1 definition and storage persistence

import Dexie from 'dexie';

export const db = new Dexie('llm-ledger');

db.version(1).stores({
  projects : '&id, name, status, updatedAt, archived',
  threads  : '&id, projectId, title, status, updatedAt, pinned',
  sessions : '&id, threadId, projectId, modelId, startedAt, status',
  turns    : '&id, sessionId, threadId, projectId, seq, createdAt, status, modelId, outcome, quality',
  chunks   : '&id, turnId, seq, createdAt',
  artifacts: '&id, turnId, threadId, projectId, type, lang, title, starred, hash, version',
  models   : '&id, provider, name, active',
  templates: '&id, name, category, useCount',
  playbooks: '&id, name, category',
  packs    : '&id, threadId, createdAt, kind',
  files    : '&id, projectId, name, mime, size, hash',
  events   : '++id, ts, type, refId',
  backups  : '&id, createdAt, size',
  settings : '&key'
});

export async function ensurePersistence() {
  try {
    if (navigator.storage?.persist) {
      const already = await navigator.storage.persisted();
      if (!already) await navigator.storage.persist();
    }
  } catch (err) {
    console.warn('Storage persistence request error:', err);
  }
}

export async function storageEstimate() {
  try {
    const e = await navigator.storage.estimate();
    return { usage: e.usage || 0, quota: e.quota || 0 };
  } catch {
    return { usage: 0, quota: 0 };
  }
}
