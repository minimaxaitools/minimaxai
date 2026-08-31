// TurnCard.js - Render individual turn prompt, response, inline controls, and Reader Modal trigger

import { h } from 'preact';
import { useState } from 'preact/hooks';
import { repo } from '../db/repo.js';
import { formatDate } from '../util/ids.js';
import { cleanPromptText } from '../util/text.js';
import { writeClipboardText } from '../io/clipboard.js';
import { showToast } from './Toasts.js';

export function TurnCard({ turn, model, artifacts = [], onOpenReader }) {
  const [outcome, setOutcome] = useState(turn.outcome || 'unknown');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editPrompt, setEditPrompt] = useState(cleanPromptText(turn.promptText));
  const [editResponse, setEditResponse] = useState(turn.responseText);

  async function handleSetOutcome(newOutcome) {
    setOutcome(newOutcome);
    await repo.updateTurn(turn.id, { outcome: newOutcome });
    showToast(`Marked turn as ${newOutcome}`, 'info');
  }

  async function handleSaveEdit() {
    await repo.updateTurn(turn.id, {
      promptText: editPrompt,
      responseText: editResponse,
      promptChars: editPrompt.length,
      responseChars: editResponse.length
    });
    setIsEditing(false);
    showToast('Turn content updated successfully!', 'success');
  }

  async function handleDeleteTurn() {
    if (confirm(`Are you sure you want to delete Turn #${turn.seq}?`)) {
      await repo.deleteTurn(turn.id);
      showToast('Turn deleted', 'info');
    }
  }

  async function handleCopyPrompt() {
    const cleanText = cleanPromptText(turn.promptText);
    await writeClipboardText(cleanText);
    showToast('Clean prompt copied to clipboard!', 'success');
  }

  async function handleCopyResponse() {
    await writeClipboardText(turn.responseText);
    showToast('Response text copied to clipboard!', 'info');
  }

  async function handleStarArtifact(art) {
    const nextStar = !art.starred;
    await repo.starArtifact(art.id, nextStar);
    showToast(nextStar ? '⭐ Starred as Working Solution!' : 'Unstarred artifact', 'success');
  }

  const displayedPrompt = cleanPromptText(turn.promptText);

  return h('div', { className: 'turn-card' },
    h('div', { className: 'turn-header' },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        h('span', { className: 'badge badge-model', style: { background: model ? model.color : '#3b82f6' } },
          model ? model.name : turn.modelId
        ),
        h('strong', null, `Turn #${turn.seq}`),
        h('span', { style: { fontSize: '11px', color: 'var(--text-dim)' } }, formatDate(turn.createdAt))
      ),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
        onOpenReader && h('button', {
          className: 'btn btn-primary',
          style: { padding: '2px 8px', fontSize: '11px' },
          onClick: () => onOpenReader(turn.id)
        }, '🔍 Full Reader'),
        h('button', {
          className: `btn ${outcome === 'worked' ? 'btn-primary' : 'btn-secondary'}`,
          style: { padding: '2px 8px', fontSize: '11px' },
          onClick: () => handleSetOutcome('worked')
        }, '✅ Worked'),
        h('button', {
          className: `btn ${outcome === 'failed' ? 'btn-danger' : 'btn-secondary'}`,
          style: { padding: '2px 8px', fontSize: '11px' },
          onClick: () => handleSetOutcome('failed')
        }, '❌ Failed'),
        h('button', {
          className: 'btn btn-secondary',
          style: { padding: '2px 6px', fontSize: '11px' },
          onClick: () => setIsEditing(!isEditing)
        }, isEditing ? 'Cancel Edit' : '✏️ Edit'),
        h('button', {
          className: 'btn btn-danger',
          style: { padding: '2px 6px', fontSize: '11px' },
          onClick: handleDeleteTurn
        }, '🗑️'),
        h('button', {
          className: 'btn btn-secondary',
          style: { padding: '2px 6px', fontSize: '11px' },
          onClick: () => setIsCollapsed(!isCollapsed)
        }, isCollapsed ? 'Expand' : 'Collapse')
      )
    ),

    !isCollapsed && h('div', { className: 'turn-body' },
      isEditing
        ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
            h('div', null,
              h('label', { style: { fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' } }, 'Edit Prompt Text:'),
              h('textarea', {
                className: 'pane-textarea',
                style: { height: '100px' },
                value: editPrompt,
                onInput: e => setEditPrompt(e.target.value)
              })
            ),
            h('div', null,
              h('label', { style: { fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' } }, 'Edit Response Text:'),
              h('textarea', {
                className: 'pane-textarea',
                style: { height: '160px' },
                value: editResponse,
                onInput: e => setEditResponse(e.target.value)
              })
            ),
            h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px' } },
              h('button', { className: 'btn btn-secondary', onClick: () => setIsEditing(false) }, 'Cancel'),
              h('button', { className: 'btn btn-primary', onClick: handleSaveEdit }, '💾 Save Changes')
            )
          )
        : h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
            h('div', { className: 'turn-prompt' },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '4px' } },
                h('strong', { style: { fontSize: '11px', color: 'var(--text-muted)' } }, 'PROMPT'),
                h('button', {
                  className: 'btn btn-secondary',
                  style: { padding: '2px 6px', fontSize: '10px' },
                  onClick: handleCopyPrompt
                }, '📋 Copy Prompt')
              ),
              displayedPrompt
            ),

            h('div', { className: 'turn-response' },
              h('strong', { style: { display: 'block', marginBottom: '4px', fontSize: '11px', color: 'var(--text-muted)' } }, 'RESPONSE'),
              turn.responseText || '*(Waiting for response capture...)*'
            ),

            artifacts.length > 0 && h('div', { style: { marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' } },
              h('strong', { style: { fontSize: '12px', color: 'var(--text-muted)' } }, 'Extracted Artifacts:'),
              h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' } },
                artifacts.map(art =>
                  h('div', {
                    key: art.id,
                    style: {
                      background: 'var(--bg-input)',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      border: art.starred ? '1px solid var(--accent-starred)' : '1px solid var(--border-color)'
                    }
                  },
                    h('span', null, `📦 ${art.title} (${art.lang || 'code'})`),
                    h('button', {
                      className: `btn ${art.starred ? 'btn-warning' : 'btn-secondary'}`,
                      style: { padding: '2px 8px', fontSize: '11px' },
                      onClick: () => handleStarArtifact(art)
                    }, art.starred ? '⭐ Starred Solution' : 'Star as Working Solution')
                  )
                )
              )
            ),

            h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' } },
              onOpenReader && h('button', { className: 'btn btn-primary', style: { fontSize: '12px' }, onClick: () => onOpenReader(turn.id) }, '🔍 Full Reader View'),
              h('button', { className: 'btn btn-secondary', style: { fontSize: '12px' }, onClick: handleCopyPrompt }, '📋 Copy Prompt'),
              h('button', { className: 'btn btn-secondary', style: { fontSize: '12px' }, onClick: handleCopyResponse }, '📋 Copy Response')
            )
          )
    )
  );
}
