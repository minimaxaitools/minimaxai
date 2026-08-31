// Dashboard.js - F4.6 Local Analytics & Model Decision Recommender Dashboard

import { h } from 'preact';
import { useLiveQuery } from './hooks/useLiveQuery.js';
import { db } from '../db/db.js';

export function Dashboard() {
  const turns = useLiveQuery(() => db.turns.toArray()) || [];
  const artifacts = useLiveQuery(() => db.artifacts.toArray()) || [];
  const models = useLiveQuery(() => db.models.toArray()) || [];

  const totalTurns = turns.length;
  const workedTurns = turns.filter(t => t.outcome === 'worked').length;
  const workedRatio = totalTurns ? Math.round((workedTurns / totalTurns) * 100) : 0;
  const totalArtifacts = artifacts.length;
  const starredArtifacts = artifacts.filter(a => a.starred).length;

  return h('div', { style: { padding: '24px', flex: 1, overflowY: 'auto' } },
    h('h2', { style: { fontSize: '20px', fontWeight: 700, marginBottom: '16px' } }, '📊 Workspace Analytics & Model Decision Engine'),

    h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' } },
      h('div', { className: 'turn-card', style: { padding: '16px', textAlign: 'center' } },
        h('div', { style: { fontSize: '28px', fontWeight: 700, color: 'var(--accent-primary)' } }, totalTurns),
        h('div', { style: { color: 'var(--text-muted)', fontSize: '12px' } }, 'Total Turns Executed')
      ),
      h('div', { className: 'turn-card', style: { padding: '16px', textAlign: 'center' } },
        h('div', { style: { fontSize: '28px', fontWeight: 700, color: 'var(--accent-success)' } }, `${workedRatio}%`),
        h('div', { style: { color: 'var(--text-muted)', fontSize: '12px' } }, 'Solution Success Rate')
      ),
      h('div', { className: 'turn-card', style: { padding: '16px', textAlign: 'center' } },
        h('div', { style: { fontSize: '28px', fontWeight: 700, color: 'var(--accent-starred)' } }, starredArtifacts),
        h('div', { style: { color: 'var(--text-muted)', fontSize: '12px' } }, '⭐ Starred Solutions')
      ),
      h('div', { className: 'turn-card', style: { padding: '16px', textAlign: 'center' } },
        h('div', { style: { fontSize: '28px', fontWeight: 700, color: 'var(--text-main)' } }, totalArtifacts),
        h('div', { style: { color: 'var(--text-muted)', fontSize: '12px' } }, 'Extracted Artifacts')
      )
    ),

    h('div', { className: 'turn-card', style: { padding: '20px' } },
      h('h3', { style: { fontSize: '15px', fontWeight: 700, marginBottom: '12px' } }, 'Model Performance & Decision Log'),
      h('table', { style: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' } },
        h('thead', null,
          h('tr', { style: { borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' } },
            h('th', { style: { padding: '8px' } }, 'Model Name'),
            h('th', { style: { padding: '8px' } }, 'Provider'),
            h('th', { style: { padding: '8px' } }, 'Turn Budget'),
            h('th', { style: { padding: '8px' } }, 'Max Output Chars')
          )
        ),
        h('tbody', null,
          models.map(m =>
            h('tr', { key: m.id, style: { borderBottom: '1px solid var(--border-color)' } },
              h('td', { style: { padding: '8px', fontWeight: 600, color: m.color } }, m.name),
              h('td', { style: { padding: '8px' } }, m.provider),
              h('td', { style: { padding: '8px' } }, `${m.turnBudget || 6} turns`),
              h('td', { style: { padding: '8px' } }, `${m.maxOutChars || 22000} chars`)
            )
          )
        )
      )
    )
  );
}
