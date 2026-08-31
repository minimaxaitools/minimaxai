// repo.js - Repository operations, transactions, data invariants, editing/deletion, and database flush

import { db } from './db.js';
import { newId, now } from '../util/ids.js';
import { estTokens, firstHeadingOrLine, tail } from '../util/text.js';
import { detectTruncation } from '../core/truncation.js';
import { extractArtifacts } from '../core/artifacts.js';
import { logEvent } from '../util/log.js';
import { seedInitialData } from './seed.js';

export const repo = {
  // Flush entire database to start fresh
  async flushAllData() {
    await db.transaction('rw', ['projects', 'threads', 'sessions', 'turns', 'chunks', 'artifacts', 'events', 'settings'], async () => {
      await db.projects.clear();
      await db.threads.clear();
      await db.sessions.clear();
      await db.turns.clear();
      await db.chunks.clear();
      await db.artifacts.clear();
      await db.events.clear();
      await db.settings.clear();
    });
    await seedInitialData();
    await logEvent('database_flushed');
  },

  // Projects
  async createProject(name, tags = []) {
    const ts = now();
    const id = newId();
    const project = { id, name, status: 'active', archived: 0, createdAt: ts, updatedAt: ts, tags };
    await db.projects.add(project);
    await logEvent('project_created', id, { name });
    return project;
  },

  async getProjects() {
    return await db.projects.where('archived').equals(0).toArray();
  },

  async updateProject(projectId, updates) {
    const ts = now();
    await db.projects.update(projectId, { ...updates, updatedAt: ts });
    await logEvent('project_updated', projectId, updates);
  },

  async deleteProject(projectId) {
    await db.transaction('rw', [db.projects, db.threads, db.sessions, db.turns, db.chunks, db.artifacts], async () => {
      await db.projects.delete(projectId);
      const threads = await db.threads.where('projectId').equals(projectId).toArray();
      const threadIds = threads.map(t => t.id);
      await db.threads.where('projectId').equals(projectId).delete();
      await db.sessions.where('projectId').equals(projectId).delete();
      await db.turns.where('projectId').equals(projectId).delete();
      for (const tId of threadIds) {
        await db.artifacts.where('threadId').equals(tId).delete();
      }
    });
    await logEvent('project_deleted', projectId);
  },

  // Threads
  async createThread(projectId, title, tags = []) {
    const ts = now();
    const id = newId();
    const thread = { id, projectId, title, status: 'active', updatedAt: ts, pinned: 0, tags };
    await db.threads.add(thread);
    await logEvent('thread_created', id, { title });
    return thread;
  },

  async getThreads(projectId) {
    if (!projectId) return await db.threads.toArray();
    return await db.threads.where('projectId').equals(projectId).toArray();
  },

  async updateThread(threadId, updates) {
    const ts = now();
    await db.threads.update(threadId, { ...updates, updatedAt: ts });
    await logEvent('thread_updated', threadId, updates);
  },

  async deleteThread(threadId) {
    await db.transaction('rw', [db.threads, db.sessions, db.turns, db.chunks, db.artifacts], async () => {
      await db.threads.delete(threadId);
      await db.sessions.where('threadId').equals(threadId).delete();
      await db.turns.where('threadId').equals(threadId).delete();
      await db.artifacts.where('threadId').equals(threadId).delete();
    });
    await logEvent('thread_deleted', threadId);
  },

  // Sessions
  async createSession(threadId, projectId, modelId) {
    const ts = now();
    const id = newId();
    const session = { id, threadId, projectId, modelId, startedAt: ts, status: 'active', turnCount: 0 };
    await db.sessions.add(session);
    await logEvent('session_created', id, { threadId, modelId });
    return session;
  },

  async getSession(sessionId) {
    return await db.sessions.get(sessionId);
  },

  async deleteSession(sessionId) {
    await db.transaction('rw', [db.sessions, db.turns, db.chunks, db.artifacts], async () => {
      await db.sessions.delete(sessionId);
      const turns = await db.turns.where('sessionId').equals(sessionId).toArray();
      const turnIds = turns.map(t => t.id);
      await db.turns.where('sessionId').equals(sessionId).delete();
      for (const tId of turnIds) {
        await db.chunks.where('turnId').equals(tId).delete();
        await db.artifacts.where('turnId').equals(tId).delete();
      }
    });
    await logEvent('session_deleted', sessionId);
  },

  // Turns & Chunks
  async savePromptTurn({ sessionId, threadId, projectId, modelId, promptText, intent = 'other', parentTurnId = null, variantOf = null }) {
    const ts = now();
    const turnId = newId();

    const existingTurns = await db.turns.where('sessionId').equals(sessionId).toArray();
    const seq = existingTurns.length + 1;

    const turn = {
      id: turnId,
      sessionId,
      threadId,
      projectId,
      seq,
      createdAt: ts,
      updatedAt: ts,
      status: 'sent',
      modelId,
      promptText,
      promptChars: promptText.length,
      promptTokensEst: estTokens(promptText),
      responseText: '',
      responseChars: 0,
      quality: 0,
      outcome: 'unknown',
      intent,
      tags: [],
      notes: '',
      parentTurnId,
      variantOf
    };

    await db.transaction('rw', [db.turns, db.sessions, db.threads], async () => {
      await db.turns.add(turn);
      const session = await db.sessions.get(sessionId);
      if (session) {
        await db.sessions.update(sessionId, { turnCount: seq });
      }
      await db.threads.update(threadId, { updatedAt: ts });
    });

    await logEvent('prompt_saved', turnId, { promptChars: promptText.length, seq });
    return turn;
  },

  async appendChunk({ turnId, text, continuePromptUsed = null }) {
    const ts = now();
    const turn = await db.turns.get(turnId);
    if (!turn) throw new Error(`Turn ${turnId} not found`);

    const model = await db.models.get(turn.modelId) || { maxOutChars: 22000 };
    const contractEnabled = (await db.settings.get('contractEnabled'))?.value !== false;

    const existingChunks = await db.chunks.where('turnId').equals(turnId).sortBy('seq');
    const chunkSeq = existingChunks.length + 1;

    const truncInfo = detectTruncation(text, { maxOutChars: model.maxOutChars, contractEnabled });

    const chunkId = newId();
    const chunk = {
      id: chunkId,
      turnId,
      seq: chunkSeq,
      createdAt: ts,
      text,
      chars: text.length,
      truncated: truncInfo.truncated,
      truncationReason: truncInfo.reason,
      tailAnchor: tail(text, 300),
      continuePromptUsed,
      receivedAt: ts
    };

    let fullStitchedText = '';
    await db.transaction('rw', [db.chunks, db.turns, db.artifacts, db.threads], async () => {
      await db.chunks.add(chunk);

      const allChunks = await db.chunks.where('turnId').equals(turnId).sortBy('seq');
      fullStitchedText = allChunks.map(c => c.text).join('\n');

      const isComplete = !truncInfo.truncated || /\[\[END\]\]\s*$/.test(text.trim());
      const turnStatus = isComplete ? 'complete' : 'truncated';

      await db.turns.update(turnId, {
        responseText: fullStitchedText,
        responseChars: fullStitchedText.length,
        status: turnStatus,
        updatedAt: ts
      });

      const extracted = extractArtifacts(fullStitchedText, turn);
      for (const art of extracted) {
        const existing = await db.artifacts.where('hash').equals(art.hash).first();
        if (!existing) {
          await db.artifacts.add(art);
        }
      }

      await db.threads.update(turn.threadId, { updatedAt: ts });
    });

    await logEvent('chunk_appended', chunkId, { turnId, chunkSeq, truncated: truncInfo.truncated });
    return { chunk, stitchedText: fullStitchedText, truncation: truncInfo };
  },

  async updateTurn(turnId, updates) {
    const ts = now();
    await db.turns.update(turnId, { ...updates, updatedAt: ts });
    await logEvent('turn_updated', turnId, updates);
  },

  async deleteTurn(turnId) {
    await db.transaction('rw', [db.turns, db.chunks, db.artifacts], async () => {
      await db.turns.delete(turnId);
      await db.chunks.where('turnId').equals(turnId).delete();
      await db.artifacts.where('turnId').equals(turnId).delete();
    });
    await logEvent('turn_deleted', turnId);
  },

  // Star / Pin actions
  async starArtifact(artifactId, starred = true) {
    await db.artifacts.update(artifactId, { starred });
    await logEvent('artifact_starred', artifactId, { starred });
  },

  async deleteArtifact(artifactId) {
    await db.artifacts.delete(artifactId);
    await logEvent('artifact_deleted', artifactId);
  },

  async starTurnResponseAsArtifact(turnId, title, content, lang = 'text', type = 'code') {
    const turn = await db.turns.get(turnId);
    if (!turn) return null;
    const art = {
      id: newId(),
      turnId,
      threadId: turn.threadId,
      projectId: turn.projectId,
      type,
      lang,
      title: title || firstHeadingOrLine(content),
      content,
      version: 1,
      starred: true,
      tags: ['starred-manual'],
      hash: newId().slice(0, 10)
    };
    await db.artifacts.add(art);
    await logEvent('manual_artifact_starred', art.id);
    return art;
  },

  async getStarredArtifacts(threadId) {
    return await db.artifacts.where('threadId').equals(threadId).filter(a => !!a.starred).toArray();
  },

  async getThreadArtifacts(threadId) {
    return await db.artifacts.where('threadId').equals(threadId).toArray();
  },

  async getAllArtifacts() {
    return await db.artifacts.toArray();
  },

  // Models
  async getModels() {
    return await db.models.toArray();
  },

  async getActiveModel() {
    const activeId = (await db.settings.get('activeModelId'))?.value;
    if (activeId) {
      const model = await db.models.get(activeId);
      if (model) return model;
    }
    const first = await db.models.first();
    return first;
  },

  // Settings
  async getSetting(key, defaultValue = null) {
    const item = await db.settings.get(key);
    return item ? item.value : defaultValue;
  },

  async setSetting(key, value) {
    await db.settings.put({ key, value });
  }
};
