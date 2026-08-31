// exportZip.js - Export project/threads as ZIP folder structure

import { db } from '../db/db.js';
import { saveFile } from '../util/download.js';

export async function exportProjectZip(projectId) {
  const project = await db.projects.get(projectId);
  if (!project) return;

  const threads = await db.threads.where('projectId').equals(projectId).toArray();
  
  // Try JSZip module if available
  let JSZip;
  try {
    const mod = await import('jszip');
    JSZip = mod.default || mod;
  } catch (err) {
    console.warn('JSZip dynamic import failed, falling back to JSON bundle:', err);
  }

  if (JSZip) {
    const zip = new JSZip();
    const projFolder = zip.folder(project.name.replace(/[^a-z0-9]+/gi, '_'));

    for (const t of threads) {
      const turns = await db.turns.where('threadId').equals(t.id).sortBy('createdAt');
      const artifacts = await db.artifacts.where('threadId').equals(t.id).toArray();
      const threadFolder = projFolder.folder(t.title.replace(/[^a-z0-9]+/gi, '_'));

      let threadMd = `# ${t.title}\n\n`;
      turns.forEach((turn, idx) => {
        threadMd += `## Turn ${idx + 1} (${turn.modelId})\n\n### Prompt:\n${turn.promptText}\n\n### Response:\n${turn.responseText}\n\n---\n\n`;
      });
      threadFolder.file('conversation.md', threadMd);

      if (artifacts.length > 0) {
        const artFolder = threadFolder.folder('artifacts');
        artifacts.forEach(a => {
          const fname = `${a.title.replace(/[^a-z0-9_.-]+/gi, '_')}.${a.lang || 'txt'}`;
          artFolder.file(fname, a.content);
        });
      }
    }

    const content = await zip.generateAsync({ type: 'blob' });
    saveFile(content, `${project.name}-export.zip`, 'application/zip');
  } else {
    // Fallback: JSON backup for project
    const exportData = { project, threads };
    saveFile(JSON.stringify(exportData, null, 2), `${project.name}-export.json`, 'application/json');
  }
}
