// CommandPalette.js - F4.1 Ctrl+K Command Palette with project filters & search modes

import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { useLiveQuery } from './hooks/useLiveQuery.js';
import { db } from '../db/db.js';
import { searchLedger } from '../search/index.js';
import { writeClipboardText } from '../io/clipboard.js';
import { formatDate } from '../util/ids.js';
import { showToast } from './Toasts.js';

export function CommandPalette({ isOpen, onClose, onSelectThread }) {
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState('prefix');
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [results, setResults] = useState([]);
  const inputRef = useRef(null);

  const projects = useLiveQuery(() => db.projects.where('archived').equals(0).toArray()) || [];

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      handleSearch(query, searchMode, selectedProjectId);
    }
  }, [isOpen]);

  async function handleSearch(q, mode = searchMode, projId = selectedProjectId) {
    setQuery(q);
    setSearchMode(mode);
    setSelectedProjectId(projId);

    try {
      let filterQuery = q;
      if (projId !== 'all') {
        filterQuery = `${q} project:${projId}`;
      }
      const res = await searchLedger(filterQuery, mode);
      setResults(res.slice(0, 25));
    } catch (err) {
      console.warn('Search error:', err);
    }
  }

  async function handleSelectResult(item, isCtrlEnter = false) {
    if (isCtrlEnter) {
      const content = item.artifactContent || item.responseText || item.promptText || '';
      await writeClipboardText(content);
      showToast('Item content copied directly to clipboard!', 'success');
    } else if (item.threadId) {
      onSelectThread(item.threadId);
    }
    onClose();
  }

  if (!isOpen) return null;

  return h('div', { className: 'modal-overlay', onClick: onClose },
    h('div', { className: 'modal-content', style: { maxWidth: '800px' }, onClick: e => e.stopPropagation() },
      h('div', { className: 'modal-header', style: { flexDirection: 'column', gap: '10px', alignItems: 'stretch' } },
        h('div', { style: { display: 'flex', gap: '10px', alignItems: 'center' } },
          h('input', {
            ref: inputRef,
            type: 'text',
            placeholder: '⌘K Search prompts, code, turns... (Ctrl+Enter to copy directly)',
            value: query,
            onInput: e => handleSearch(e.target.value, searchMode, selectedProjectId),
            style: { flex: 1, fontSize: '15px', border: 'none', background: 'transparent' }
          }),

          // Project Filter Dropdown
          h('select', {
            className: 'model-select',
            style: { fontSize: '12px', padding: '4px 8px' },
            value: selectedProjectId,
            onChange: e => handleSearch(query, searchMode, e.target.value)
          },
            h('option', { value: 'all' }, '📁 All Projects'),
            projects.map(p =>
              h('option', { key: p.id, value: p.id }, `📁 ${p.name}`)
            )
          )
        ),

        // Search Mode Selector Bar
        h('div', { className: 'flex items-center gap-1.5 w-full overflow-x-auto pb-1 select-none', style: { display: 'flex', gap: '6px', overflowX: 'auto' } },
          [
            { id: 'prefix', label: 'Starts With' },
            { id: 'contains', label: 'Contains' },
            { id: 'exact', label: 'Exact' },
            { id: 'definition', label: 'Definition' },
            { id: 'fuzzy', label: 'Fuzzy' },
            { id: 'regex', label: 'Regex' }
          ].map(m =>
            h('button', {
              key: m.id,
              className: `mode-btn px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition cursor-pointer ${searchMode === m.id ? 'btn-primary' : 'btn-secondary'}`,
              style: {
                padding: '4px 10px',
                fontSize: '11px',
                borderRadius: '6px',
                background: searchMode === m.id ? 'var(--accent-primary)' : 'var(--bg-active)',
                color: searchMode === m.id ? '#fff' : 'var(--text-main)',
                border: 'none',
                cursor: 'pointer'
              },
              onClick: () => handleSearch(query, m.id, selectedProjectId)
            }, m.label)
          )
        )
      ),

      h('div', { className: 'modal-body', style: { padding: '12px' } },
        results.length === 0
          ? h('div', { style: { padding: '24px', textAlign: 'center', color: 'var(--text-dim)' } }, 'No matching ledger items found.')
          : results.map(item =>
              h('div', {
                key: item.id,
                style: {
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  background: 'var(--bg-input)',
                  marginBottom: '8px',
                  border: '1px solid var(--border-color)'
                },
                onClick: () => handleSelectResult(item, false)
              },
                h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                  h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                    h('span', { style: { fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 } }, `${item.projectName || 'Project'} › ${item.threadTitle || 'Thread'}`),
                    h('strong', { style: { fontSize: '13px' } }, `${item.type === 'artifact' ? '📦 ' : '💬 '}${item.title || item.artifactTitle}`)
                  ),
                  h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center' } },
                    item.starred === 1 && h('span', { className: 'badge badge-starred' }, '⭐ Starred'),
                    h('span', { style: { fontSize: '10px', color: 'var(--text-dim)' } }, formatDate(item.createdAt))
                  )
                ),
                h('div', { style: { fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                  item.artifactContent || item.responseText || item.promptText
                )
              )
            )
      )
    )
  );
}
