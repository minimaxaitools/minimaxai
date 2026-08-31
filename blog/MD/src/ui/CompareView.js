// CompareView.js - F5.4 Model A/B Comparison View

import { h } from 'preact';

export function CompareView({ variantTurns = [] }) {
  if (!variantTurns || variantTurns.length < 2) {
    return h('div', { style: { padding: '20px', color: 'var(--text-muted)' } },
      'Run the same prompt with a different model to see an A/B response comparison.'
    );
  }

  return h('div', { style: { padding: '20px', display: 'grid', gridTemplateColumns: `repeat(${variantTurns.length}, 1fr)`, gap: '16px' } },
    variantTurns.map(turn =>
      h('div', { key: turn.id, className: 'turn-card', style: { padding: '16px' } },
        h('strong', { style: { display: 'block', marginBottom: '8px' } }, `Model: ${turn.modelId}`),
        h('div', { style: { fontSize: '12px', whiteSpace: 'pre-wrap' } }, turn.responseText)
      )
    )
  );
}
