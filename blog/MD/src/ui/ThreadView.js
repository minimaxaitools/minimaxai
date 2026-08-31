// ThreadView.js - Render thread history grouped by 5-7 turn Disposable Sessions with full-screen reader modal integration

import { h } from 'preact';
import { useState } from 'preact/hooks';
import { useLiveQuery } from './hooks/useLiveQuery.js';
import { db } from '../db/db.js';
import { repo } from '../db/repo.js';
import { exportSessionToMarkdown } from '../io/exportMd.js';
import { TurnCard } from './TurnCard.js';
import { TurnReaderModal } from './TurnReaderModal.js';
import { formatDate } from '../util/ids.js';
import { showToast } from './Toasts.js';

export function ThreadView({ threadId, models = [] }) {
  const [collapsedSessions, setCollapsedSessions] = useState({});
  const [readerTurnId, setReaderTurnId] = useState(null);
  const [isReaderOpen, setIsReaderOpen] = useState(false);

  const sessions = useLiveQuery(
    () => threadId ? db.sessions.where('threadId').equals(threadId).sortBy('startedAt') : [],
    [threadId]
  ) || [];

  const turns = useLiveQuery(
    () => threadId ? db.turns.where('threadId').equals(threadId).sortBy('seq') : [],
    [threadId]
  ) || [];

  const artifacts = useLiveQuery(
    () => threadId ? db.artifacts.where('threadId').equals(threadId).toArray() : [],
    [threadId]
  ) || [];

  const modelMap = new Map((models || []).map(m => [m.id, m]));

  if (!threadId) {
    return h('div', { className: 'thread-container', style: { alignItems: 'center', justifyContent: 'center' } },
      h('p', { style: { color: 'var(--text-muted)' } }, 'Select or create a project thread to start organizing manual LLM queries.')
    );
  }

  function toggleSession(sessionId) {
    setCollapsedSessions(prev => ({ ...prev, [sessionId]: !prev[sessionId] }));
  }

  function handleOpenReader(turnId) {
    setReaderTurnId(turnId);
    setIsReaderOpen(true);
  }

  async function handleStartNewSession() {
    const thread = await db.threads.get(threadId);
    if (!thread) return;
    const activeModelId = (await repo.getSetting('activeModelId')) || 'opus';
    const newSession = await repo.createSession(thread.id, thread.projectId, activeModelId);
    await repo.setSetting('activeSessionId', newSession.id);
    showToast(`Started fresh Session #${sessions.length + 1} in this thread!`, 'success');
  }

  async function handleExportSession(sessionId) {
    await exportSessionToMarkdown(sessionId);
    showToast('Exported Session deliverable as Markdown file!', 'success');
  }

  async function handleDeleteSession(sessionId, sessionNum) {
    if (confirm(`Are you sure you want to delete Session #${sessionNum} and all its turns?`)) {
      await repo.deleteSession(sessionId);
      showToast(`Deleted Session #${sessionNum}`, 'info');
    }
  }

  // Group turns by session
  const turnsBySession = new Map();
  turns.forEach(turn => {
    const sId = turn.sessionId || 'default';
    if (!turnsBySession.has(sId)) turnsBySession.set(sId, []);
    turnsBySession.get(sId).push(turn);
  });

  return h('div', { className: 'thread-container' },
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' } },
      h('span', { style: { fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 } }, `${sessions.length} Chat Sessions · ${turns.length} Total Turns`),
      h('button', {
        className: 'btn btn-primary',
        style: { fontSize: '12px', padding: '4px 10px' },
        onClick: handleStartNewSession
      }, '➕ Start New Session in Thread')
    ),

    turns.length === 0
      ? h('div', { style: { textAlign: 'center', padding: '40px', color: 'var(--text-muted)' } },
          h('p', null, 'No turns recorded in this thread yet.'),
          h('p', { style: { fontSize: '12px', marginTop: '4px' } }, 'Paste a prompt into the capture bar above to start.')
        )
      : Array.from(turnsBySession.entries()).map(([sessionId, sessionTurns], idx) => {
          const sessionObj = sessions.find(s => s.id === sessionId);
          const model = sessionObj ? modelMap.get(sessionObj.modelId) : null;
          const isCollapsed = collapsedSessions[sessionId];

          return h('div', { key: sessionId, style: { marginBottom: '16px' } },
            // Session Boundary Card Header
            h('div', {
              style: {
                background: 'var(--bg-card-hover)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 14px',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                justify: 'space-between'
              }
            },
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }, onClick: () => toggleSession(sessionId) },
                h('strong', { style: { fontSize: '13px' } }, `🔄 Session #${idx + 1}`),
                h('span', { className: 'badge badge-model', style: { background: model ? model.color : 'var(--accent-primary)' } },
                  model ? model.name : 'Opus'
                ),
                h('span', { style: { fontSize: '11px', color: 'var(--text-dim)' } },
                  `${sessionTurns.length} turns · Started ${sessionObj ? formatDate(sessionObj.startedAt) : 'Recently'}`
                )
              ),
              h('div', { style: { display: 'flex', gap: '6px' } },
                h('button', {
                  className: 'btn btn-secondary',
                  style: { padding: '2px 6px', fontSize: '11px' },
                  onClick: () => handleExportSession(sessionId)
                }, '📄 Export Session MD'),
                h('button', {
                  className: 'btn btn-danger',
                  style: { padding: '2px 6px', fontSize: '11px' },
                  onClick: () => handleDeleteSession(sessionId, idx + 1)
                }, '🗑️ Delete Session'),
                h('button', {
                  className: 'btn btn-secondary',
                  style: { padding: '2px 6px', fontSize: '11px' },
                  onClick: () => toggleSession(sessionId)
                }, isCollapsed ? 'Expand' : 'Collapse')
              )
            ),

            !isCollapsed && h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '8px' } },
              sessionTurns.map(turn => {
                const turnModel = modelMap.get(turn.modelId) || model;
                const turnArtifacts = artifacts.filter(a => a.turnId === turn.id);
                return h(TurnCard, {
                  key: turn.id,
                  turn,
                  model: turnModel,
                  artifacts: turnArtifacts,
                  onOpenReader: handleOpenReader
                });
              })
            )
          );
        }),

    h(TurnReaderModal, {
      isOpen: isReaderOpen,
      onClose: () => setIsReaderOpen(false),
      turns,
      initialTurnId: readerTurnId,
      models
    })
  );
}
