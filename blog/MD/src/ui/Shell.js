// Shell.js - Application Header, Model Selector, Session Health & Project/Thread/Session Export Toolbar

import { h } from 'preact';
import { useLiveQuery } from './hooks/useLiveQuery.js';
import { db } from '../db/db.js';
import { repo } from '../db/repo.js';
import { HealthMeter } from './HealthMeter.js';
import { exportThreadToMarkdown, exportProjectToMarkdown } from '../io/exportMd.js';
import { exportProjectZip } from '../io/exportZip.js';
import { showToast } from './Toasts.js';

export function Shell({
  activeThreadId,
  activeSessionId,
  activeModelId,
  onOpenSearch,
  onOpenHandoff,
  onOpenContextPacker,
  onOpenSettings,
  children
}) {
  const models = useLiveQuery(() => db.models.where('active').equals(1).toArray()) || [];
  const turns = useLiveQuery(
    () => activeSessionId ? db.turns.where('sessionId').equals(activeSessionId).toArray() : [],
    [activeSessionId]
  ) || [];

  const activeProjectIdSetting = useLiveQuery(() => db.settings.get('activeProjectId')) || {};
  const activeProjectId = activeProjectIdSetting.value;

  const activeModel = models.find(m => m.id === activeModelId) || models[0];
  const turnCount = turns.length;
  const turnBudget = activeModel ? activeModel.turnBudget || 6 : 6;

  async function handleModelChange(e) {
    const newModelId = e.target.value;
    await repo.setSetting('activeModelId', newModelId);
    showToast(`Switched active model to ${newModelId}`, 'info');
  }

  async function handleExportThreadMarkdown() {
    if (!activeThreadId) return;
    await exportThreadToMarkdown(activeThreadId);
    showToast('Exported thread deliverable as Markdown file!', 'success');
  }

  async function handleExportProjectMarkdown() {
    if (!activeProjectId) return;
    await exportProjectToMarkdown(activeProjectId);
    showToast('Exported full Project workspace as Markdown file!', 'success');
  }

  async function handleExportProjectZip() {
    if (!activeProjectId) return;
    await exportProjectZip(activeProjectId);
    showToast('Exported full Project workspace as ZIP archive!', 'success');
  }

  return h('div', { id: 'app' },
    h('header', { className: 'shell-header' },
      h('div', { className: 'brand' },
        h('span', null, '⚡ LLM Ledger')
      ),

      h('div', { className: 'search-trigger', onClick: onOpenSearch },
        h('span', null, '🔍 ⌘K Search Ledger...')
      ),

      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        h('select', {
          className: 'model-select',
          value: activeModelId || '',
          onChange: handleModelChange
        },
          models.map(m =>
            h('option', { key: m.id, value: m.id }, `${m.name} (${m.provider})`)
          )
        ),

        h(HealthMeter, {
          turnCount,
          turnBudget,
          onBuildHandoff: onOpenHandoff
        }),

        h('button', { className: 'btn btn-secondary', style: { padding: '4px 8px', fontSize: '11px' }, onClick: onOpenContextPacker }, '🎒 150K Pack'),
        h('button', { className: 'btn btn-secondary', style: { padding: '4px 8px', fontSize: '11px' }, onClick: handleExportThreadMarkdown }, '📄 Thread MD'),
        h('button', { className: 'btn btn-secondary', style: { padding: '4px 8px', fontSize: '11px' }, onClick: handleExportProjectMarkdown }, '📁 Project MD'),
        h('button', { className: 'btn btn-secondary', style: { padding: '4px 8px', fontSize: '11px' }, onClick: handleExportProjectZip }, '📦 Project ZIP'),
        h('button', { className: 'btn btn-secondary', style: { padding: '4px 8px', fontSize: '11px' }, onClick: onOpenSettings }, '⚙')
      )
    ),

    h('div', { className: 'shell-body' }, children)
  );
}
