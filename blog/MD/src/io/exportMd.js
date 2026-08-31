// exportMd.js - Export Thread, Session, or Project as clean Markdown documents

import { db } from '../db/db.js';
import { saveFile } from '../util/download.js';
import { formatDate } from '../util/ids.js';
import { cleanPromptText } from '../util/text.js';

export async function exportThreadToMarkdown(threadId) {
  const thread = await db.threads.get(threadId);
  if (!thread) return;

  const turns = await db.turns.where('threadId').equals(threadId).sortBy('createdAt');
  const artifacts = await db.artifacts.where('threadId').equals(threadId).toArray();

  let md = `# Thread Deliverable: ${thread.title}\n`;
  md += `*Exported on ${formatDate(Date.now())}*\n\n`;

  if (artifacts.length > 0) {
    md += `## Working Artifacts & Solutions\n\n`;
    for (const a of artifacts) {
      md += `### ${a.title} (${a.lang || 'code'})\n`;
      md += `\`\`\`${a.lang || ''}\n${a.content}\n\`\`\`\n\n`;
    }
  }

  md += `--- \n\n## Turn History & Conversation Ledger\n\n`;
  for (const t of turns) {
    md += `### Turn #${t.seq} (${t.modelId || 'LLM'})\n`;
    md += `**Prompt:**\n${cleanPromptText(t.promptText)}\n\n`;
    md += `**Response:**\n${t.responseText}\n\n`;
    md += `---\n\n`;
  }

  const sanitizedTitle = thread.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  saveFile(md, `${sanitizedTitle}-deliverable.md`, 'text/markdown');
  return md;
}

export async function exportSessionToMarkdown(sessionId) {
  const session = await db.sessions.get(sessionId);
  if (!session) return;
  const thread = await db.threads.get(session.threadId);
  const turns = await db.turns.where('sessionId').equals(sessionId).sortBy('seq');

  let md = `# Session Export: ${thread ? thread.title : 'Chat Session'}\n`;
  md += `*Started ${formatDate(session.startedAt)} · Model: ${session.modelId}*\n\n`;

  for (const t of turns) {
    md += `### Turn #${t.seq}\n`;
    md += `**Prompt:**\n${cleanPromptText(t.promptText)}\n\n`;
    md += `**Response:**\n${t.responseText}\n\n`;
    md += `---\n\n`;
  }

  saveFile(md, `session-${sessionId.slice(0, 8)}-export.md`, 'text/markdown');
  return md;
}

export async function exportProjectToMarkdown(projectId) {
  const project = await db.projects.get(projectId);
  if (!project) return;

  const threads = await db.threads.where('projectId').equals(projectId).toArray();

  let md = `# Project Workspace Summary: ${project.name}\n`;
  md += `*Exported on ${formatDate(Date.now())}*\n\n`;

  for (const t of threads) {
    const turns = await db.turns.where('threadId').equals(t.id).sortBy('createdAt');
    const artifacts = await db.artifacts.where('threadId').equals(t.id).toArray();

    md += `## 📌 Thread: ${t.title}\n\n`;

    if (artifacts.length > 0) {
      md += `### Starred Artifacts:\n`;
      for (const a of artifacts) {
        md += `#### ${a.title} (${a.lang || 'code'})\n\`\`\`${a.lang || ''}\n${a.content}\n\`\`\`\n\n`;
      }
    }

    md += `### Turns:\n`;
    for (const turn of turns) {
      md += `#### Turn #${turn.seq} (${turn.modelId})\n`;
      md += `**Prompt:**\n${cleanPromptText(turn.promptText)}\n\n`;
      md += `**Response:**\n${turn.responseText}\n\n`;
    }
    md += `\n=========================================\n\n`;
  }

  const sanitizedName = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  saveFile(md, `${sanitizedName}-full-project.md`, 'text/markdown');
  return md;
}
