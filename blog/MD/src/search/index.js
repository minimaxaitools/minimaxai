// search/index.js - Advanced search engine with modes: prefix, contains, exact, fuzzy, regex

import MiniSearch from 'minisearch';
import { db } from '../db/db.js';
import { parseQueryChips } from './query.js';

let miniSearchInstance = null;

export function getSearchInstance() {
  if (!miniSearchInstance) {
    miniSearchInstance = new MiniSearch({
      fields: ['title', 'projectName', 'threadTitle', 'tags', 'notes', 'promptText', 'responseText', 'artifactTitle', 'artifactContent'],
      storeFields: ['id', 'turnId', 'threadId', 'projectId', 'sessionId', 'modelId', 'title', 'projectName', 'threadTitle', 'promptText', 'responseText', 'outcome', 'starred', 'type', 'createdAt'],
      searchOptions: {
        boost: { title: 4, artifactTitle: 4, threadTitle: 3, tags: 3, notes: 2 },
        prefix: true,
        fuzzy: 0.2
      }
    });
  }
  return miniSearchInstance;
}

export async function rebuildSearchIndex() {
  const ms = getSearchInstance();
  ms.removeAll();

  const projects = await db.projects.toArray();
  const threads = await db.threads.toArray();
  const turns = await db.turns.toArray();
  const artifacts = await db.artifacts.toArray();

  const projectMap = new Map(projects.map(p => [p.id, p]));
  const threadMap = new Map(threads.map(t => [t.id, t]));

  const documents = [];

  for (const turn of turns) {
    const thread = threadMap.get(turn.threadId);
    const project = projectMap.get(turn.projectId);

    documents.push({
      id: turn.id,
      turnId: turn.id,
      threadId: turn.threadId,
      projectId: turn.projectId,
      sessionId: turn.sessionId,
      modelId: turn.modelId || 'opus',
      title: thread ? thread.title : 'Turn',
      projectName: project ? project.name : 'Workspace',
      threadTitle: thread ? thread.title : 'Thread',
      tags: (turn.tags || []).join(' '),
      notes: turn.notes || '',
      promptText: turn.promptText || '',
      responseText: turn.responseText || '',
      artifactTitle: '',
      artifactContent: '',
      outcome: turn.outcome || 'unknown',
      starred: 0,
      type: 'turn',
      createdAt: turn.createdAt
    });
  }

  for (const art of artifacts) {
    const thread = threadMap.get(art.threadId);
    const project = projectMap.get(art.projectId);

    documents.push({
      id: art.id,
      turnId: art.turnId,
      threadId: art.threadId,
      projectId: art.projectId,
      sessionId: '',
      modelId: '',
      title: art.title,
      projectName: project ? project.name : 'Workspace',
      threadTitle: thread ? thread.title : 'Artifact',
      tags: (art.tags || []).join(' '),
      notes: '',
      promptText: '',
      responseText: '',
      artifactTitle: art.title,
      artifactContent: art.content || '',
      outcome: 'worked',
      starred: art.starred ? 1 : 0,
      type: 'artifact',
      createdAt: art.createdAt || Date.now()
    });
  }

  ms.addAll(documents);
  return ms;
}

export async function searchLedger(queryStr, mode = 'prefix') {
  const ms = getSearchInstance();
  if (ms.documentCount === 0) {
    await rebuildSearchIndex();
  }

  const { chips, rawQuery } = parseQueryChips(queryStr);
  const q = rawQuery.trim();

  let results = [];

  if (!q) {
    // Return all documents if query is empty
    const turns = await db.turns.toArray();
    const artifacts = await db.artifacts.toArray();
    const threads = await db.threads.toArray();
    const projects = await db.projects.toArray();

    const projectMap = new Map(projects.map(p => [p.id, p]));
    const threadMap = new Map(threads.map(t => [t.id, t]));

    results = [
      ...turns.map(t => ({
        id: t.id,
        turnId: t.id,
        threadId: t.threadId,
        projectId: t.projectId,
        modelId: t.modelId,
        title: threadMap.get(t.threadId)?.title || 'Turn',
        projectName: projectMap.get(t.projectId)?.name || 'Project',
        promptText: t.promptText,
        responseText: t.responseText,
        outcome: t.outcome,
        starred: 0,
        type: 'turn',
        createdAt: t.createdAt
      })),
      ...artifacts.map(a => ({
        id: a.id,
        turnId: a.turnId,
        threadId: a.threadId,
        projectId: a.projectId,
        modelId: '',
        title: a.title,
        projectName: projectMap.get(a.projectId)?.name || 'Project',
        artifactTitle: a.title,
        artifactContent: a.content,
        outcome: 'worked',
        starred: a.starred ? 1 : 0,
        type: 'artifact',
        createdAt: a.createdAt || Date.now()
      }))
    ];
  } else if (mode === 'regex') {
    try {
      const reg = new RegExp(q, 'i');
      const allDocs = await ms.search(MiniSearch.wildcard);
      results = allDocs.filter(d =>
        reg.test(d.title) || reg.test(d.promptText) || reg.test(d.responseText) || reg.test(d.artifactContent) || reg.test(d.projectName)
      );
    } catch {
      results = ms.search(q);
    }
  } else if (mode === 'contains') {
    const lower = q.toLowerCase();
    const allDocs = await ms.search(MiniSearch.wildcard);
    results = allDocs.filter(d =>
      (d.title && d.title.toLowerCase().includes(lower)) ||
      (d.promptText && d.promptText.toLowerCase().includes(lower)) ||
      (d.responseText && d.responseText.toLowerCase().includes(lower)) ||
      (d.artifactContent && d.artifactContent.toLowerCase().includes(lower)) ||
      (d.projectName && d.projectName.toLowerCase().includes(lower))
    );
  } else if (mode === 'exact') {
    const lower = q.toLowerCase();
    const allDocs = await ms.search(MiniSearch.wildcard);
    results = allDocs.filter(d =>
      (d.title && d.title.toLowerCase() === lower) ||
      (d.artifactTitle && d.artifactTitle.toLowerCase() === lower)
    );
  } else if (mode === 'fuzzy') {
    results = ms.search(q, { fuzzy: 0.3, prefix: false });
  } else {
    // Default prefix / Starts With
    results = ms.search(q, { prefix: true });
  }

  // Apply chip filters
  return results.filter(doc => {
    if (chips.model && doc.modelId !== chips.model) return false;
    if (chips.project && doc.projectId !== chips.project) return false;
    if (chips.thread && doc.threadId !== chips.thread) return false;
    if (chips.outcome && doc.outcome !== chips.outcome) return false;
    if (chips.starred !== undefined && Boolean(doc.starred) !== chips.starred) return false;
    return true;
  });
}
