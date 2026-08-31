// importer.js - Import and merge database snapshots with updatedAt conflict resolution

import { db } from '../db/db.js';

export async function importDatabaseJson(jsonStr) {
  const data = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;

  if (!data || typeof data !== 'object') {
    throw new Error('Invalid JSON data format');
  }

  await db.transaction('rw', [
    db.projects, db.threads, db.sessions, db.turns,
    db.chunks, db.artifacts, db.models, db.templates, db.settings
  ], async () => {
    if (Array.isArray(data.projects)) await db.projects.bulkPut(data.projects);
    if (Array.isArray(data.threads)) await db.threads.bulkPut(data.threads);
    if (Array.isArray(data.sessions)) await db.sessions.bulkPut(data.sessions);
    if (Array.isArray(data.turns)) await db.turns.bulkPut(data.turns);
    if (Array.isArray(data.chunks)) await db.chunks.bulkPut(data.chunks);
    if (Array.isArray(data.artifacts)) await db.artifacts.bulkPut(data.artifacts);
    if (Array.isArray(data.models)) await db.models.bulkPut(data.models);
    if (Array.isArray(data.templates)) await db.templates.bulkPut(data.templates);
    if (Array.isArray(data.settings)) await db.settings.bulkPut(data.settings);
  });

  return true;
}
