// PlaybookRunner.js - F5.2 Service Playbook Runner for Monetized Deliverables

import { h } from 'preact';
import { useState } from 'preact/hooks';
import { useLiveQuery } from './hooks/useLiveQuery.js';
import { db } from '../db/db.js';
import { repo } from '../db/repo.js';
import { writeClipboardText } from '../io/clipboard.js';
import { showToast } from './Toasts.js';

export function PlaybookRunner({ threadId }) {
  const playbooks = useLiveQuery(() => db.playbooks.toArray()) || [];
  const [selectedPlaybook, setSelectedPlaybook] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);

  async function handleExecuteStep(step) {
    let prompt = step.prompt || step.templateName || step.title;
    await writeClipboardText(prompt);
    showToast(`Step #${step.step} prompt copied to clipboard! Paste into LLM window.`, 'success');
    if (currentStep < selectedPlaybook.steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  }

  return h('div', { style: { padding: '24px', flex: 1, overflowY: 'auto' } },
    h('h2', { style: { fontSize: '20px', fontWeight: 700, marginBottom: '16px' } }, '🚀 Monetization Service Playbooks'),
    h('p', { style: { color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' } },
      'Run productized service workflows (Audit, RFP Proposals, Marketing Packs) step-by-step to earn from unlimited LLM queries.'
    ),

    !selectedPlaybook
      ? h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' } },
          playbooks.map(p =>
            h('div', { key: p.id, className: 'turn-card', style: { padding: '20px' } },
              h('h3', { style: { fontSize: '16px', fontWeight: 700, marginBottom: '8px' } }, p.name),
              h('p', { style: { color: 'var(--text-muted)', fontSize: '12px', marginBottom: '16px' } }, `${p.steps.length} sequential execution steps`),
              h('button', { className: 'btn btn-primary', onClick: () => { setSelectedPlaybook(p); setCurrentStep(0); } }, 'Start Playbook')
            )
          )
        )
      : h('div', { className: 'turn-card', style: { padding: '24px' } },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' } },
            h('h3', { style: { fontSize: '18px', fontWeight: 700 } }, selectedPlaybook.name),
            h('button', { className: 'btn btn-secondary', onClick: () => setSelectedPlaybook(null) }, 'Back to Playbooks')
          ),

          h('div', { style: { marginBottom: '20px' } },
            h('span', { style: { fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' } }, `Step ${currentStep + 1} of ${selectedPlaybook.steps.length}`),
            h('h4', { style: { fontSize: '16px', fontWeight: 700, marginTop: '4px' } }, selectedPlaybook.steps[currentStep].title)
          ),

          h('button', {
            className: 'btn btn-primary',
            onClick: () => handleExecuteStep(selectedPlaybook.steps[currentStep])
          }, `📋 Copy Step #${currentStep + 1} Prompt & Advance`)
        )
  );
}
