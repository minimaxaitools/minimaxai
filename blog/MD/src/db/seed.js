// seed.js - Seed initial default models, templates, playbooks, and default project

import { db } from './db.js';
import { newId, now } from '../util/ids.js';

export const DEFAULT_MODELS = [
  { provider: 'Anthropic', name: 'Claude Opus', alias: 'opus', maxOutChars: 22000, ctxCharsIn: 150000, turnBudget: 6, color: '#c96442', strengths: ['long code', 'reasoning'] },
  { provider: 'OpenAI', name: 'GPT Frontier', alias: 'gpt', maxOutChars: 18000, ctxCharsIn: 150000, turnBudget: 6, color: '#10a37f', strengths: ['code', 'structure'] },
  { provider: 'Google', name: 'Gemini Pro', alias: 'gemini', maxOutChars: 20000, ctxCharsIn: 150000, turnBudget: 7, color: '#4285f4', strengths: ['long context'] },
  { provider: 'xAI', name: 'Grok', alias: 'grok', maxOutChars: 16000, ctxCharsIn: 150000, turnBudget: 5, color: '#8e8e93', strengths: ['speed'] },
  { provider: 'DeepSeek', name: 'DeepSeek R1', alias: 'r1', maxOutChars: 16000, ctxCharsIn: 120000, turnBudget: 5, color: '#7c5cff', strengths: ['math', 'reasoning'] }
];

export const DEFAULT_TEMPLATES = [
  {
    name: 'Plan-then-emit manifest',
    category: 'plan',
    body: `TASK: {{task}}

Do NOT write the solution yet.
Return a MANIFEST: a numbered list of the parts/files needed, each with:
- id (PART n)
- title
- one-line purpose
- estimated size in characters
Keep every part under {{maxOut}} characters so it fits one reply.
End with [[END]].`
  },
  {
    name: 'Emit one part',
    category: 'plan',
    body: `Emit PART {{n}} of {{total}} ONLY: "{{title}}".
Full, complete content — no placeholders, no "rest unchanged".
Do not restate the manifest. Do not emit any other part.
End with [[END]] if complete, [[MORE]] if you were cut off.`
  },
  {
    name: 'Debug with context',
    category: 'debug',
    body: `CONTEXT (authoritative code):
\`\`\`{{lang}}
{{code}}
\`\`\`

SYMPTOM: {{symptom}}
EXPECTED: {{expected}}
ALREADY TRIED (do not repeat): {{tried}}

Give: (1) root cause in ≤5 lines, (2) the corrected full file, (3) a one-line verification step.
End with [[END]].`
  },
  {
    name: 'B2B Content Repurposing Package',
    category: 'write',
    body: `SOURCE TEXT:
---
{{sourceText}}
---

OBJECTIVE:
Transform the source text into a complete 4-piece content package:
1. Executive Summary Bullet Points (3-5 key takeaways)
2. LinkedIn Thought Leadership Post (engaging hook, formatted with line breaks, 3 hashtags)
3. Twitter/X Thread (5 key tweets, numbered 1/5 to 5/5)
4. Email Newsletter Teaser (subject line + 2-paragraph body with CTA)

End with [[END]].`
  }
];

export const DEFAULT_PLAYBOOKS = [
  {
    id: 'shopify-app-migration',
    name: 'Shopify App Multi-Part Migration',
    category: 'code',
    steps: [
      { step: 1, title: 'Analyze Source Legacy App', prompt: 'Review this legacy codebase. Identify all API endpoints, database queries, and third-party webhooks. Output a structured migration plan. End with [[END]].' },
      { step: 2, title: 'Emit Core Refactored Logic', prompt: 'Based on the migration plan, emit the complete refactored core module. End with [[END]].' }
    ]
  },
  {
    id: 'rfp-proposal-generator',
    name: 'Enterprise RFP Proposal Generator',
    category: 'sales',
    steps: [
      { step: 1, title: 'Extract RFP Requirements', prompt: 'Analyze the client requirements document. List technical constraints, deliverables, and timeline milestones. End with [[END]].' },
      { step: 2, title: 'Draft Executive Proposal', prompt: 'Generate the complete RFP executive proposal including scope of work, architecture overview, and pricing breakdown. End with [[END]].' }
    ]
  },
  {
    id: 'b2b-content-package',
    name: 'B2B Content Repurposing Package',
    category: 'content',
    steps: [
      { step: 1, title: 'Summarize Key Takeaways', prompt: 'Extract 5 core insights from the source material. End with [[END]].' },
      { step: 2, title: 'Generate SEO Article Draft', prompt: 'Based on the previous content, write a comprehensive 800-word SEO article with H2/H3 subheadings and meta description. End with [[END]].' }
    ]
  }
];

export async function seedInitialData() {
  const ts = now();
  const count = await db.models.count();
  if (count === 0) {
    await db.models.bulkAdd(DEFAULT_MODELS.map(m => ({ id: newId(), active: 1, notes: '', ...m })));
  }

  const tmplCount = await db.templates.count();
  if (tmplCount === 0) {
    await db.templates.bulkAdd(DEFAULT_TEMPLATES.map(t => ({ id: newId(), useCount: 0, createdAt: ts, ...t })));
  }

  const playbookCount = await db.playbooks.count();
  if (playbookCount === 0) {
    await db.playbooks.bulkAdd(DEFAULT_PLAYBOOKS.map(p => ({ ...p, createdAt: ts })));
  }

  const projectId = newId();
  await db.projects.add({
    id: projectId,
    name: 'Inbox Workspace',
    status: 'active',
    archived: 0,
    createdAt: ts,
    updatedAt: ts,
    tags: ['general']
  });

  const threadId = newId();
  await db.threads.add({
    id: threadId,
    projectId,
    title: 'Getting Started with LLM Ledger',
    status: 'active',
    updatedAt: ts,
    pinned: 1,
    tags: ['guide']
  });

  const allModels = await db.models.toArray();
  const modelDb = allModels.find(m => m.alias === 'opus') || allModels[0];
  const modelId = modelDb ? modelDb.id : newId();

  const sessionId = newId();
  await db.sessions.add({
    id: sessionId,
    threadId,
    projectId,
    modelId,
    startedAt: ts,
    status: 'active',
    turnCount: 0
  });

  await db.settings.bulkPut([
    { key: 'activeProjectId', value: projectId },
    { key: 'activeThreadId', value: threadId },
    { key: 'activeSessionId', value: sessionId },
    { key: 'activeModelId', value: modelId },
    { key: 'contractEnabled', value: true },
    { key: 'clipboardWatcher', value: false },
    { key: 'theme', value: 'dark' },
    { key: 'handoffBudgetChars', value: 120000 }
  ]);
}

export async function seedIfEmpty() {
  const count = await db.models.count();
  if (count === 0) {
    await seedInitialData();
  }
}
