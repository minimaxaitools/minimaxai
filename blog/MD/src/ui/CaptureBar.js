// CaptureBar.js - F1 Quick Capture & F2 Continuation Bar

import { h } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { repo } from '../db/repo.js';
import { db } from '../db/db.js';
import { writeClipboardText } from '../io/clipboard.js';
import { showToast } from './Toasts.js';
import { buildContinuePrompt, buildOutputContract } from '../core/continuePrompt.js';
import { REASON_LABELS } from '../core/truncation.js';

export function CaptureBar({ session, thread, activeModel, onTurnAdded }) {
  const [promptText, setPromptText] = useState('');
  const [responseText, setResponseText] = useState('');
  const [activeTurn, setActiveTurn] = useState(null);
  const [truncationInfo, setTruncationInfo] = useState(null);
  const [contractEnabled, setContractEnabled] = useState(true);

  const promptRef = useRef(null);
  const responseRef = useRef(null);

  useEffect(() => {
    if (promptRef.current) promptRef.current.focus();
  }, []);

  // Fail-safe helper to auto-resolve active session & thread if props are null/resolving
  async function resolveContext() {
    let curSession = session;
    let curThread = thread;

    try {
      if (!curThread) {
        const activeThreadId = (await repo.getSetting('activeThreadId')) || (await db.threads.first())?.id;
        if (activeThreadId) curThread = await db.threads.get(activeThreadId);
      }

      if (!curSession && curThread) {
        curSession = await db.sessions.where('threadId').equals(curThread.id).first();
        if (!curSession) {
          curSession = await repo.createSession(curThread.id, curThread.projectId, activeModel ? activeModel.id : 'opus');
        }
      }
    } catch (err) {
      console.warn('Error resolving context:', err);
    }

    return { curSession, curThread };
  }

  // Handle Ctrl+Enter on Prompt Pane
  async function handleSendPrompt(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!promptText.trim()) return;

    const { curSession, curThread } = await resolveContext();

    if (!curSession || !curThread) {
      showToast('Please select or create a thread first.', 'warning');
      return;
    }

    let finalPrompt = promptText;
    if (contractEnabled && !promptText.includes('[OUTPUT CONTRACT]')) {
      finalPrompt = `${promptText.trim()}\n\n${buildOutputContract()}`;
    }

    try {
      const turn = await repo.savePromptTurn({
        sessionId: curSession.id,
        threadId: curThread.id,
        projectId: curThread.projectId,
        modelId: activeModel ? activeModel.id : 'opus',
        promptText: finalPrompt
      });

      setActiveTurn(turn);
      await writeClipboardText(finalPrompt);
      showToast('Prompt saved & copied to clipboard! Paste into your LLM window.', 'info');

      if (responseRef.current) responseRef.current.focus();
      if (onTurnAdded) onTurnAdded();
    } catch (err) {
      console.error('Error saving prompt turn:', err);
      showToast('Error saving prompt turn', 'danger');
    }
  }

  // Handle Ctrl+Enter on Response Pane
  async function handleSaveResponse(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!responseText.trim()) return;

    const { curSession, curThread } = await resolveContext();

    if (!curSession || !curThread) {
      showToast('Please select or create a thread first.', 'warning');
      return;
    }

    let targetTurnId = activeTurn ? activeTurn.id : null;

    if (!targetTurnId) {
      // If user pasted response without explicit prompt, create implicit turn
      try {
        const turn = await repo.savePromptTurn({
          sessionId: curSession.id,
          threadId: curThread.id,
          projectId: curThread.projectId,
          modelId: activeModel ? activeModel.id : 'opus',
          promptText: 'Pasted response capture'
        });
        targetTurnId = turn.id;
      } catch (err) {
        console.error('Error creating turn for response:', err);
        showToast('Could not link response to session turn', 'danger');
        return;
      }
    }

    try {
      const res = await repo.appendChunk({
        turnId: targetTurnId,
        text: responseText
      });

      setTruncationInfo(res.truncation);

      if (res.truncation.truncated) {
        showToast(`Warning: Reply looks truncated (${REASON_LABELS[res.truncation.reason] || res.truncation.reason})`, 'warning', 5000);
      } else {
        showToast('Response captured & artifacts extracted!', 'success');
        // Reset panes for next turn
        setPromptText('');
        setResponseText('');
        setActiveTurn(null);
        setTruncationInfo(null);
        if (promptRef.current) promptRef.current.focus();
      }

      if (onTurnAdded) onTurnAdded();
    } catch (err) {
      console.error('Error appending chunk:', err);
      showToast('Error saving response', 'danger');
    }
  }

  // Generate & Copy Continue Prompt
  async function handleGenerateContinue() {
    if (!responseText) return;
    const contPrompt = buildContinuePrompt(responseText, {
      openFenceLang: truncationInfo ? truncationInfo.openFenceLang : null,
      mode: 'strict'
    });
    await writeClipboardText(contPrompt);
    showToast('Continue prompt copied to clipboard! Paste into LLM window.', 'success');
    setResponseText('');
  }

  return h('div', { className: 'capture-container' },
    truncationInfo && truncationInfo.truncated && h('div', { className: 'truncation-banner' },
      h('div', null,
        h('strong', null, '⚠️ Output Truncated Detected: '),
        REASON_LABELS[truncationInfo.reason] || truncationInfo.reason
      ),
      h('button', { className: 'btn btn-warning', onClick: handleGenerateContinue }, '📋 Copy Continue Prompt')
    ),

    h('div', { className: 'capture-panes' },
      // Left Pane: Prompt Input
      h('div', { className: 'pane-box' },
        h('div', { className: 'pane-header' },
          h('span', null, '1. PROMPT (Paste query here)'),
          h('label', { style: { display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' } },
            h('input', {
              type: 'checkbox',
              checked: contractEnabled,
              onChange: e => setContractEnabled(e.target.checked)
            }),
            'Output Contract'
          )
        ),
        h('textarea', {
          ref: promptRef,
          className: 'pane-textarea',
          placeholder: 'Type or paste prompt... Press Ctrl+Enter to copy & proceed',
          value: promptText,
          onInput: e => setPromptText(e.target.value),
          onKeyDown: e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              handleSendPrompt(e);
            }
          }
        }),
        h('div', { className: 'pane-footer' },
          h('span', null, `${promptText.length} chars (~${Math.ceil(promptText.length / 4)} tokens)`),
          h('button', { className: 'btn btn-primary', onClick: handleSendPrompt }, 'Send & Copy Prompt (Ctrl+Enter)')
        )
      ),

      // Right Pane: Response Input
      h('div', { className: 'pane-box' },
        h('div', { className: 'pane-header' },
          h('span', null, '2. RESPONSE (Paste LLM reply here)'),
          activeTurn && h('span', { className: 'badge badge-model' }, `Turn #${activeTurn.seq}`)
        ),
        h('textarea', {
          ref: responseRef,
          className: 'pane-textarea',
          placeholder: 'Paste LLM response here... Press Ctrl+Enter to save & extract artifacts',
          value: responseText,
          onInput: e => setResponseText(e.target.value),
          onKeyDown: e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              handleSaveResponse(e);
            }
          }
        }),
        h('div', { className: 'pane-footer' },
          h('span', null, `${responseText.length} chars`),
          h('div', { style: { display: 'flex', gap: '8px' } },
            h('button', { className: 'btn btn-secondary', onClick: handleSaveResponse }, 'Save Response (Ctrl+Enter)')
          )
        )
      )
    )
  );
}
