// ContextPackerModal.js - F5.3 Context Packer Modal (Input side 150K budget solver UI)

import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { packItems } from '../core/contextPacker.js';
import { repo } from '../db/repo.js';
import { writeClipboardText } from '../io/clipboard.js';
import { showToast } from './Toasts.js';

export function ContextPackerModal({ isOpen, onClose, threadId }) {
  const [packedData, setPackedData] = useState(null);

  useEffect(() => {
    if (isOpen && threadId) {
      loadAndPack();
    }
  }, [isOpen, threadId]);

  async function loadAndPack() {
    const artifacts = await repo.getThreadArtifacts(threadId);
    const turns = await repo.getThreadTurns(threadId);

    const items = [
      ...artifacts.map(a => ({ id: a.id, title: a.title, content: a.content })),
      ...turns.slice(-3).map(t => ({ id: t.id, title: `Turn #${t.seq} Prompt & Reply`, content: `Prompt:\n${t.promptText}\n\nResponse:\n${t.responseText}` }))
    ];

    const result = packItems(items, 150000);
    setPackedData(result);
  }

  async function handleCopy() {
    if (!packedData) return;
    await writeClipboardText(packedData.combinedText);
    showToast('Packed context copied to clipboard! (150K budget verified)', 'success');
    onClose();
  }

  if (!isOpen) return null;

  return h('div', { className: 'modal-overlay', onClick: onClose },
    h('div', { className: 'modal-content', style: { maxWidth: '700px' }, onClick: e => e.stopPropagation() },
      h('div', { className: 'modal-header' },
        h('span', null, '🎒 Context Packer (150K Input Budget Gauge)'),
        h('button', { style: { fontSize: '18px' }, onClick: onClose }, '×')
      ),

      h('div', { className: 'modal-body' },
        packedData && h('div', null,
          h('div', { style: { marginBottom: '12px' } },
            h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '4px' } },
              h('span', null, `Input Budget Used: ${packedData.charCount} / ${packedData.maxBudget} chars`),
              h('span', null, `${packedData.pctUsed}%`)
            ),
            h('div', { style: { height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' } },
              h('div', { style: { height: '100%', width: `${packedData.pctUsed}%`, background: packedData.pctUsed > 90 ? 'var(--accent-danger)' : 'var(--accent-primary)' } })
            )
          ),

          h('textarea', {
            className: 'pane-textarea',
            style: { height: '260px', fontFamily: 'var(--font-mono)', fontSize: '11px' },
            value: packedData.combinedText,
            readOnly: true
          })
        )
      ),

      h('div', { className: 'modal-footer' },
        h('button', { className: 'btn btn-secondary', onClick: onClose }, 'Cancel'),
        h('button', { className: 'btn btn-primary', onClick: handleCopy }, 'Copy Packed Context')
      )
    )
  );
}
