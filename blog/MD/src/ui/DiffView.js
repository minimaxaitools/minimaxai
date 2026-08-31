// DiffView.js - Render diff comparison between artifact versions

import { h } from 'preact';

export function DiffView({ oldText, newText }) {
  return h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontFamily: 'var(--font-mono)', fontSize: '11px' } },
    h('div', null,
      h('div', { style: { fontWeight: 700, marginBottom: '4px', color: 'var(--accent-danger)' } }, 'Previous Version'),
      h('textarea', { className: 'pane-textarea', style: { height: '200px' }, value: oldText || '', readOnly: true })
    ),
    h('div', null,
      h('div', { style: { fontWeight: 700, marginBottom: '4px', color: 'var(--accent-success)' } }, 'New Version'),
      h('textarea', { className: 'pane-textarea', style: { height: '200px' }, value: newText || '', readOnly: true })
    )
  );
}
