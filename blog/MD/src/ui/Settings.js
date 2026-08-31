// Settings.js - App Settings & Database Flush / Fresh Start Controls

import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { repo } from '../db/repo.js';
import { exportAllDataJson } from '../io/exportJson.js';
import { importDataJson } from '../io/importer.js';
import { showToast } from './Toasts.js';

export function Settings({ isOpen = true, onClose = () => {} }) {
  const [theme, setTheme] = useState('dark');
  const [contractEnabled, setContractEnabled] = useState(true);

  useEffect(() => {
    async function load() {
      const t = await repo.getSetting('theme', 'dark');
      const c = await repo.getSetting('contractEnabled', true);
      setTheme(t);
      setContractEnabled(c !== false);
    }
    load();
  }, []);

  if (isOpen === false) return null;

  async function handleSave() {
    await repo.setSetting('theme', theme);
    await repo.setSetting('contractEnabled', contractEnabled);
    document.documentElement.setAttribute('data-theme', theme);
    showToast('Settings saved!', 'success');
    onClose();
  }

  async function handleExportJson() {
    await exportAllDataJson();
    showToast('Database exported as JSON backup', 'success');
  }

  async function handleImportJson(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importDataJson(file);
      showToast('Data imported successfully!', 'success');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      showToast(`Import failed: ${err.message}`, 'danger');
    }
  }

  async function handleFlushAllData() {
    if (confirm('Are you sure you want to FLUSH & DELETE all projects, threads, sessions, turns, and code artifacts?\n\nThis will reset LLM Ledger to a completely fresh state!')) {
      await repo.flushAllData();
      showToast('All data flushed! Reloading clean workspace...', 'warning');
      setTimeout(() => window.location.reload(), 800);
    }
  }

  return h('div', { style: { padding: '24px', flex: 1, overflowY: 'auto' } },
    h('div', { className: 'turn-card', style: { maxWidth: '800px', margin: '0 auto', padding: '24px' } },
      h('h2', { style: { marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' } }, '⚙ App Settings & Backup Tools'),

      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '20px' } },
        h('div', null,
          h('label', { style: { fontSize: '13px', fontWeight: 700, display: 'block', marginBottom: '6px' } }, 'Workspace Theme:'),
          h('select', {
            className: 'model-select',
            style: { width: '100%', maxWidth: '300px' },
            value: theme,
            onChange: e => setTheme(e.target.value)
          },
            h('option', { value: 'dark' }, 'Dark Theme'),
            h('option', { value: 'light' }, 'Light Theme')
          )
        ),

        h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
          h('input', {
            type: 'checkbox',
            id: 'contract-toggle',
            checked: contractEnabled,
            onChange: e => setContractEnabled(e.target.checked)
          }),
          h('label', { htmlFor: 'contract-toggle', style: { fontSize: '13px', cursor: 'pointer' } },
            'Enable Output Contract Instructions on Captures'
          )
        ),

        h('hr', { style: { borderColor: 'var(--border-color)' } }),

        h('div', null,
          h('strong', { style: { fontSize: '14px', display: 'block', marginBottom: '8px' } }, 'Backup & Migration:'),
          h('div', { style: { display: 'flex', gap: '12px' } },
            h('button', { className: 'btn btn-secondary', onClick: handleExportJson }, '💾 Export JSON Backup'),
            h('label', { className: 'btn btn-secondary', style: { cursor: 'pointer' } },
              '📥 Import JSON Backup',
              h('input', { type: 'file', accept: '.json', style: { display: 'none' }, onChange: handleImportJson })
            )
          )
        ),

        h('hr', { style: { borderColor: 'var(--border-color)' } }),

        h('div', { style: { background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--accent-danger)', padding: '16px', borderRadius: 'var(--radius-md)' } },
          h('strong', { style: { fontSize: '14px', color: '#fca5a5', display: 'block', marginBottom: '6px' } }, '🔥 Flush All Data (Start Fresh)'),
          h('p', { style: { fontSize: '12px', color: 'var(--text-dim)', marginBottom: '12px' } },
            'Wipe all projects, threads, turns, and code artifacts to start with a 100% fresh, empty database.'
          ),
          h('button', { className: 'btn btn-danger', onClick: handleFlushAllData }, '🔥 Flush All Data & Start Fresh')
        ),

        h('div', { style: { display: 'flex', justifyContent: 'flex-end', marginTop: '12px' } },
          h('button', { className: 'btn btn-primary', onClick: handleSave }, '💾 Save Settings')
        )
      )
    )
  );
}
