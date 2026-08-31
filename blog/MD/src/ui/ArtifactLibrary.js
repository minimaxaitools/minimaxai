// ArtifactLibrary.js - F4.3 Working Solutions & Code Asset Library

import { h } from 'preact';
import { useState } from 'preact/hooks';
import { useLiveQuery } from './hooks/useLiveQuery.js';
import { db } from '../db/db.js';
import { repo } from '../db/repo.js';
import { writeClipboardText } from '../io/clipboard.js';
import { showToast } from './Toasts.js';

export function ArtifactLibrary({ onSelectThread }) {
  const [filterStarred, setFilterStarred] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const artifacts = useLiveQuery(() => db.artifacts.toArray()) || [];

  const filtered = artifacts.filter(a => {
    if (filterStarred && !a.starred) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return a.title.toLowerCase().includes(q) || (a.content && a.content.toLowerCase().includes(q));
    }
    return true;
  });

  async function handleToggleStar(art) {
    const nextStar = !art.starred;
    await repo.starArtifact(art.id, nextStar);
    showToast(nextStar ? '⭐ Starred as Working Solution!' : 'Unstarred artifact', 'info');
  }

  async function handleCopyContent(art) {
    await writeClipboardText(art.content);
    showToast('Code copied to clipboard!', 'success');
  }

  return h('div', { style: { padding: '20px', flex: 1, overflowY: 'auto' } },
    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' } },
      h('h2', { style: { fontSize: '18px', fontWeight: 700 } }, '⭐ Working Solutions & Asset Library'),
      h('div', { style: { display: 'flex', gap: '8px' } },
        h('button', {
          className: `btn ${filterStarred ? 'btn-warning' : 'btn-secondary'}`,
          onClick: () => setFilterStarred(!filterStarred)
        }, filterStarred ? 'Show All' : '⭐ Starred Only'),
        h('input', {
          type: 'text',
          placeholder: 'Filter artifacts...',
          value: searchQuery,
          onInput: e => setSearchQuery(e.target.value),
          style: { background: 'var(--bg-input)', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: 'var(--radius-md)', fontSize: '13px' }
        })
      )
    ),

    filtered.length === 0
      ? h('div', { style: { textAlign: 'center', padding: '40px', color: 'var(--text-muted)' } }, 'No working solutions saved yet.')
      : h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' } },
          filtered.map(art =>
            h('div', { key: art.id, className: 'turn-card', style: { padding: '16px' } },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' } },
                h('strong', { style: { fontSize: '14px', wordBreak: 'break-all' } }, `📦 ${art.title}`),
                h('span', { className: 'badge' }, art.lang || 'code')
              ),
              h('textarea', {
                className: 'pane-textarea',
                style: { height: '140px', fontSize: '11px', fontFamily: 'var(--font-mono)', marginBottom: '12px' },
                value: art.content,
                readOnly: true
              }),
              h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                h('button', {
                  className: `btn ${art.starred ? 'btn-warning' : 'btn-secondary'}`,
                  style: { padding: '4px 10px', fontSize: '12px' },
                  onClick: () => handleToggleStar(art)
                }, art.starred ? '⭐ Starred' : 'Star Solution'),
                h('button', {
                  className: 'btn btn-primary',
                  style: { padding: '4px 10px', fontSize: '12px' },
                  onClick: () => handleCopyContent(art)
                }, '📋 Copy Code')
              )
            )
          )
        )
  );
}
