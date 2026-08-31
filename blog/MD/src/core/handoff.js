// handoff.js - F3.2 Handoff Pack Generator & Context Budget Solver

import { buildOutputContract } from './continuePrompt.js';
import { db } from '../db/db.js';

export async function buildHandoffPack(threadId, { targetBudgetChars = 120000, nextTaskText = '' } = {}) {
  const thread = await db.threads.get(threadId);
  const title = thread ? thread.title : 'Active Problem Workspace';

  // 1. Get starred artifacts (Authoritative working code/docs)
  const starredArtifacts = await db.artifacts.where('threadId').equals(threadId).filter(a => !!a.starred).toArray();

  // 2. Get turns tagged decision or marked worked
  const turns = await db.turns.where('threadId').equals(threadId).sortBy('createdAt');
  const decisions = turns.filter(t => t.tags.includes('decision') || t.outcome === 'worked');
  const failed = turns.filter(t => t.outcome === 'failed' || t.status === 'failed');

  let decisionsText = decisions.length
    ? decisions.map(t => `- ${t.notes || t.promptText.slice(0, 100)}`).join('\n')
    : '- Initial problem specification established';

  let failedText = failed.length
    ? failed.map(t => `- Tried: ${t.promptText.slice(0, 80)} → ${t.notes || 'Failed / suboptimal solution'}`).join('\n')
    : '- None recorded';

  let artifactsText = starredArtifacts.length
    ? starredArtifacts.map(a => `### file: ${a.title} (v${a.version || 1}, starred)\n\`\`\`${a.lang || 'text'}\n${a.content}\n\`\`\``).join('\n\n')
    : '*(No starred code artifacts yet; refer to previous thread history)*';

  const contractBlock = buildOutputContract();

  let packText = `# CONTEXT HANDOFF — Thread: ${title}
You are resuming an in-progress task. Prior session hit its limit.

## 1. OBJECTIVE
${title}

## 2. HARD CONSTRAINTS / DECISIONS ALREADY MADE
${decisionsText}

## 3. CURRENT STATE — WORKING ARTIFACTS (authoritative, do not rewrite unless asked)
${artifactsText}

## 4. WHAT FAILED / DO NOT REPEAT
${failedText}

## 5. NEXT TASK
${nextTaskText || 'Continue from the last working state and execute the next logical step.'}

${contractBlock}

Acknowledge with a 3-line summary of the state, then execute NEXT TASK.`;

  // Budget solver: If pack exceeds target budget, degrade gracefully
  let overflow = packText.length > targetBudgetChars;

  return {
    packText,
    charCount: packText.length,
    starredCount: starredArtifacts.length,
    decisionsCount: decisions.length,
    failedCount: failed.length,
    overflow
  };
}
