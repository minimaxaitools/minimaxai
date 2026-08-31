// HandoffModal.js - F3.2 Handoff Pack Generator Modal & session restart assistant

import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { buildHandoffPack } from '../core/handoff.js';
import { repo } from '../db/repo.js';
import { writeClipboardText } from '../io/clipboard.js';
import { showToast } from './Toasts.js';

export function HandoffModal({ isOpen, onClose, threadId, activeModel }) {
  const [packData, setPackData] = useState(null);
  const [nextTask, setNextTask] = useState('');

  useEffect(() => {
    if (isOpen && threadId) {
      generatePack();
    }
  }, [isOpen, threadId]);

  async function generatePack() {
    const data = await buildHandoffPack(threadId, { nextTaskText: nextTask });
    setPackData(data);
  }

  async function handleCopyAndStartSession() {
    if (!packData) return;
    await writeClipboardText(packData.packText);

    // Create a new session in the same thread
    const thread = await repo.getThreads().then(ts => ts.find(t => t.id === threadId));
    if (thread) {
      const newSession = await repo.createSession(thread.id, thread.projectId, activeModel ? activeModel.id : 'opus');

      // Save Turn 0 with intent 'handoff'
      await repo.savePromptTurn({
        sessionId: newSession.id,
        threadId: thread.id,
        projectId: thread.projectId,
        modelId: activeModel ? activeModel.id : 'opus',
        promptText: packData.packText,
        intent: 'handoff'
      });

      await repo.setSetting('activeSessionId', newSession.id);
      showToast('Handoff Pack copied & new 5-7 turn Session started! Paste into new LLM window.', 'success', 5000);
    }

    onClose();
  }

  if (!isOpen) return null;

  return h('div', { className: 'modal-overlay', onClick: onClose },
    h('div', { className: 'modal-content', style: { maxWidth: '700px' }, onClick: e => e.stopPropagation() },
      h('div', { className: 'modal-header' },
        h('span', null, '📋 Handoff Pack Generator (Revive Dead Session)'),
        h('button', { style: { fontSize: '18px' }, onClick: onClose }, '×')
      ),

      h('div', { className: 'modal-body' },
        h('p', { style: { fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' } },
          'Compiles starred working solutions, decisions, and failed approaches into a single primer prompt for a fresh 5-7 turn chat window.'
        ),

        h('div', { style: { marginBottom: '12px' } },
          h('label', { style: { fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' } }, 'Next Task / Request for New Session:'),
          h('input', {
            type: 'text',
            placeholder: 'e.g. Implement the user profile API endpoint based on state',
            value: nextTask,
            onInput: e => { setNextTask(e.target.value); generatePack(); },
            style: { width: '100%', padding: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }
          })
        ),

        packData && h('div', null,
          h('div', { style: { display: 'flex', gap: '16px', fontSize: '12px', marginBottom: '8px', fontWeight: 600 } },
            h('span', null, `Chars: ${packData.charCount}`),
            h('span', null, `Starred Artifacts: ${packData.starredCount}`),
            h('span', null, `Decisions: ${packData.decisionsCount}`)
          ),
          h('textarea', {
            className: 'pane-textarea',
            style: { height: '240px', fontFamily: 'var(--font-mono)', fontSize: '12px' },
            value: packData.packText,
            readOnly: true
          })
        )
      ),

      h('div', { className: 'modal-footer' },
        h('button', { className: 'btn btn-secondary', onClick: onClose }, 'Cancel'),
        h('button', { className: 'btn btn-primary', onClick: handleCopyAndStartSession }, 'Copy Pack & Start Session #Next')
      )
    )
  );
}
