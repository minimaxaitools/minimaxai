// fsSync.js - F6.3 File System Access API directory binding sync

import { db } from '../db/db.js';

let directoryHandle = null;

export async function bindSyncDirectory() {
  if (!window.showDirectoryPicker) {
    throw new Error('File System Access API is not supported in this browser.');
  }

  directoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
  await db.settings.put({ key: 'fsSyncEnabled', value: true });
  return directoryHandle.name;
}

export async function syncToDirectory() {
  if (!directoryHandle) return false;
  try {
    const fileHandle = await directoryHandle.getFileHandle('ledger.json', { create: true });
    const writable = await fileHandle.createWritable();

    const data = {
      exportedAt: new Date().toISOString(),
      projects: await db.projects.toArray(),
      threads: await db.threads.toArray(),
      turns: await db.turns.toArray(),
      artifacts: await db.artifacts.toArray()
    };

    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
    return true;
  } catch (err) {
    console.warn('FS Sync error:', err);
    return false;
  }
}
