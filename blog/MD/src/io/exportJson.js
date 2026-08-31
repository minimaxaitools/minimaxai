// exportJson.js - Export full IndexedDB database to versioned JSON

import { db } from '../db/db.js';
import { saveFile } from '../util/download.js';
import { iso } from '../util/ids.js';

export async function exportDatabaseJson() {
  const data = {
    version: 1,
    exportedAt: iso(),
    projects: await db.projects.toArray(),
    threads: await db.threads.toArray(),
    sessions: await db.sessions.toArray(),
    turns: await db.turns.toArray(),
    chunks: await db.chunks.toArray(),
    artifacts: await db.artifacts.toArray(),
    models: await db.models.toArray(),
    templates: await db.templates.toArray(),
    playbooks: await db.playbooks.toArray(),
    settings: await db.settings.toArray()
  };

  const jsonStr = JSON.stringify(data, null, 2);
  const filename = `llm-ledger-backup-${new Date().toISOString().slice(0, 10)}.json`;
  saveFile(jsonStr, filename, 'application/json');
  return data;
}
