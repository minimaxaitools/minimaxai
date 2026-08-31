// HealthMeter.js - F3.1 Session Health Meter (5-7 turn indicator)

import { h } from 'preact';

export function HealthMeter({ turnCount = 0, turnBudget = 6, onBuildHandoff }) {
  const remaining = Math.max(0, turnBudget - turnCount);
  const isDanger = remaining <= 1;
  const isWarning = remaining === 2;

  const dots = [];
  for (let i = 1; i <= turnBudget; i++) {
    let stateClass = '';
    if (i <= turnCount) {
      stateClass = i >= turnBudget - 1 ? (i === turnBudget ? 'danger' : 'warning') : 'active';
    }
    dots.push(h('span', { key: i, className: `health-dot ${stateClass}` }));
  }

  return h('div', { className: 'health-meter' },
    h('span', null, `Turn ${turnCount} / ${turnBudget}`),
    h('div', { className: 'health-dots' }, dots),
    (isDanger || turnCount >= turnBudget) && h('button', {
      className: 'btn btn-warning',
      style: { padding: '2px 8px', fontSize: '11px' },
      onClick: onBuildHandoff
    }, 'Handoff Pack 📋')
  );
}
