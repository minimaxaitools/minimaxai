// TurnReaderModal.js - Full-screen Pro Markdown Reader Modal with Include/Exclude Prompt HTML Export option

import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { cleanPromptText } from '../util/text.js';
import { writeClipboardText } from '../io/clipboard.js';
import { formatDate } from '../util/ids.js';
import { exportTurnToHTML } from '../io/exportHtml.js';
import { showToast } from './Toasts.js';

export function TurnReaderModal({ isOpen, onClose, turns = [], initialTurnId = null, models = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState('full'); // 'full', 'prompt', 'response'
  const [theme, setTheme] = useState('indigo'); // 'indigo', 'emerald', 'rose', 'amber'
  const [includePromptInHtml, setIncludePromptInHtml] = useState(true);
  const contentRef = useRef(null);

  useEffect(() => {
    if (initialTurnId && turns.length > 0) {
      const idx = turns.findIndex(t => t.id === initialTurnId);
      if (idx !== -1) setCurrentIndex(idx);
      else setCurrentIndex(0);
    }
  }, [initialTurnId, turns]);

  if (!isOpen || turns.length === 0) return null;

  const currentTurn = turns[currentIndex] || turns[0];
  const modelMap = new Map((models || []).map(m => [m.id, m]));
  const currentModel = modelMap.get(currentTurn.modelId);

  const cleanPrompt = cleanPromptText(currentTurn.promptText);

  // Unescape HTML entities helper for copying code block content accurately
  function unescapeHtml(html) {
    return html
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  // Render markdown with Marked + DOMPurify, GitHub Admonitions, Mac-style Code Headers, and Table Scrollbars
  function renderMarkdown(text) {
    if (!text) return '';
    try {
      let rawHtml = '';
      const markedLib = window.marked;
      if (markedLib) {
        if (typeof markedLib.parse === 'function') {
          rawHtml = markedLib.parse(text, { gfm: true, breaks: true });
        } else if (typeof markedLib === 'function') {
          rawHtml = markedLib(text, { gfm: true, breaks: true });
        }
      } else {
        rawHtml = text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
      }

      // 1. Process GitHub Admonitions: [!NOTE], [!WARNING], [!IMPORTANT], [!TIP], [!CAUTION]
      rawHtml = rawHtml.replace(/blockquote>\s*<p>\s*\[!(NOTE|WARNING|IMPORTANT|TIP|CAUTION)\]\s*([\s\S]*?)<\/p>\s*<\/blockquote>/gi, (match, type, content) => {
        const t = type.toLowerCase();
        const icon = t === 'note' ? 'ℹ️' : t === 'warning' ? '⚠️' : t === 'important' ? '📌' : t === 'tip' ? '💡' : '🚨';
        return `
<div class="admonition admonition-${t}">
  <div class="admonition-title">${icon} ${type.toUpperCase()}</div>
  <div class="admonition-body">${content}</div>
</div>`;
      });

      // 2. Enrich code block containers with Mac window dots, title, & copy buttons
      rawHtml = rawHtml.replace(/<pre><code(?:\s+class="language-([a-zA-Z0-9_+-]+)")?>([\s\S]*?)<\/code><\/pre>/gi, (match, lang, codeContent) => {
        const languageLabel = (lang || 'code').toLowerCase();
        return `
<div class="code-container">
  <div class="code-header">
    <div class="code-header-left">
      <div class="mac-dots">
        <span class="mac-dot mac-red"></span>
        <span class="mac-dot mac-yellow"></span>
        <span class="mac-dot mac-green"></span>
      </div>
      <span class="code-title">${languageLabel}</span>
    </div>
    <button class="code-copy-btn" type="button">📋 Copy Code</button>
  </div>
  <pre><code class="language-${lang || 'text'}">${codeContent}</code></pre>
</div>`;
      });

      // 3. Enrich tables with responsive scrollable container
      rawHtml = rawHtml.replace(/<table[\s\S]*?<\/table>/gi, match => `<div class="table-container">${match}</div>`);

      const purifyLib = window.DOMPurify;
      if (purifyLib && typeof purifyLib.sanitize === 'function') {
        return purifyLib.sanitize(rawHtml, {
          ADD_ATTR: ['class', 'data-code', 'type'],
          ADD_TAGS: ['button', 'div', 'span', 'details', 'summary', 'kbd', 'mark']
        });
      }
      return rawHtml;
    } catch (err) {
      console.warn('Markdown render error:', err);
      return text;
    }
  }

  // Event Delegation for clicking Copy Code buttons on any code container
  function handleContainerClick(e) {
    const target = e.target;
    if (target && target.classList.contains('code-copy-btn')) {
      e.preventDefault();
      e.stopPropagation();

      const container = target.closest('.code-container');
      if (container) {
        const codeElement = container.querySelector('code');
        if (codeElement) {
          const rawCode = unescapeHtml(codeElement.innerHTML.replace(/<[^>]+>/g, ''));
          writeClipboardText(rawCode);
          target.innerText = 'Copied! ✓';
          target.style.background = 'var(--accent-success)';
          target.style.color = '#fff';
          setTimeout(() => {
            target.innerText = '📋 Copy Code';
            target.style.background = '';
            target.style.color = '';
          }, 2000);
          showToast('Code snippet copied to clipboard!', 'success');
        }
      }
    }
  }

  async function handleExportCurrentTurnHtml() {
    try {
      await exportTurnToHTML(currentTurn.id, { includePrompt: includePromptInHtml });
      showToast(includePromptInHtml ? 'Exported Turn HTML (Prompt + Response)' : 'Exported Turn HTML (Response Only)', 'success');
    } catch (err) {
      console.error('HTML Export error:', err);
      showToast('Failed to export Turn HTML', 'danger');
    }
  }

  async function handleCopyPrompt() {
    await writeClipboardText(cleanPrompt);
    showToast('Clean prompt copied to clipboard!', 'success');
  }

  async function handleCopyResponse() {
    await writeClipboardText(currentTurn.responseText);
    showToast('Full response text copied to clipboard!', 'success');
  }

  return h('div', { className: 'modal-overlay', onClick: onClose },
    h('div', {
      className: `modal-content theme-${theme}`,
      style: {
        maxWidth: '1050px',
        width: '95vw',
        height: '92vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-card)'
      },
      onClick: e => e.stopPropagation()
    },
      // Header & Navigation Toolbar
      h('div', {
        className: 'modal-header',
        style: {
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          padding: '12px 20px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-sidebar)'
        }
      },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
          h('span', { className: 'badge badge-model', style: { background: currentModel ? currentModel.color : 'var(--accent-primary)', fontSize: '12px' } },
            currentModel ? currentModel.name : currentTurn.modelId
          ),
          h('strong', { style: { fontSize: '15px' } }, `Turn #${currentTurn.seq} of ${turns.length}`),
          h('span', { style: { fontSize: '11px', color: 'var(--text-dim)' } }, formatDate(currentTurn.createdAt))
        ),

        // View Mode Switcher: Full / Prompt / Response
        h('div', { style: { display: 'flex', gap: '4px', background: 'var(--bg-input)', padding: '3px', borderRadius: 'var(--radius-md)' } },
          h('button', {
            className: `btn ${viewMode === 'full' ? 'btn-primary' : 'btn-secondary'}`,
            style: { padding: '4px 10px', fontSize: '11px' },
            onClick: () => setViewMode('full')
          }, '💬 Full Turn'),
          h('button', {
            className: `btn ${viewMode === 'prompt' ? 'btn-primary' : 'btn-secondary'}`,
            style: { padding: '4px 10px', fontSize: '11px' },
            onClick: () => setViewMode('prompt')
          }, '📝 Prompt Only'),
          h('button', {
            className: `btn ${viewMode === 'response' ? 'btn-primary' : 'btn-secondary'}`,
            style: { padding: '4px 10px', fontSize: '11px' },
            onClick: () => setViewMode('response')
          }, '🤖 Response Only')
        ),

        // Theme Palette Picker
        h('div', { style: { display: 'flex', gap: '4px', alignItems: 'center' } },
          ['indigo', 'emerald', 'rose', 'amber'].map(t =>
            h('button', {
              key: t,
              style: {
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                border: theme === t ? '2px solid #fff' : 'none',
                background: t === 'indigo' ? '#6366f1' : t === 'emerald' ? '#10b981' : t === 'rose' ? '#f43f5e' : '#f59e0b',
                cursor: 'pointer'
              },
              onClick: () => setTheme(t)
            })
          )
        ),

        // Turn Navigator: Prev / Next
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          h('button', {
            className: 'btn btn-secondary',
            disabled: currentIndex === 0,
            style: { padding: '4px 10px', fontSize: '12px' },
            onClick: () => setCurrentIndex(Math.max(0, currentIndex - 1))
          }, '← Prev Turn'),
          h('span', { style: { fontSize: '12px', color: 'var(--text-muted)' } }, `${currentIndex + 1}/${turns.length}`),
          h('button', {
            className: 'btn btn-secondary',
            disabled: currentIndex === turns.length - 1,
            style: { padding: '4px 10px', fontSize: '12px' },
            onClick: () => setCurrentIndex(Math.min(turns.length - 1, currentIndex + 1))
          }, 'Next Turn →'),
          h('button', { style: { fontSize: '20px', marginLeft: '12px', cursor: 'pointer' }, onClick: onClose }, '×')
        )
      ),

      // Reader Content Area (Enriched Markdown & Scrollable Containers)
      h('div', {
        ref: contentRef,
        className: 'modal-body',
        onClick: handleContainerClick,
        style: {
          flex: 1,
          padding: '24px',
          overflowY: 'auto',
          lineHeight: '1.7',
          fontSize: '14px',
          color: 'var(--text-main)'
        }
      },
        (viewMode === 'full' || viewMode === 'prompt') && h('div', {
          style: {
            background: 'var(--bg-input)',
            borderLeft: '4px solid var(--accent-primary)',
            padding: '16px 20px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '24px'
          }
        },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', pb: '6px' } },
            h('strong', { style: { fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' } }, 'Prompt'),
            h('button', { className: 'btn btn-secondary', style: { fontSize: '11px', padding: '2px 8px' }, onClick: handleCopyPrompt }, '📋 Copy Prompt')
          ),
          h('div', {
            style: { whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)', fontSize: '14px' },
            dangerouslySetInnerHTML: { __html: renderMarkdown(cleanPrompt) }
          })
        ),

        (viewMode === 'full' || viewMode === 'response') && h('div', { style: { marginTop: '8px' } },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid var(--border-color)', pb: '6px' } },
            h('strong', { style: { fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' } }, 'LLM Output Response'),
            h('div', { style: { display: 'flex', gap: '6px' } },
              h('button', { className: 'btn btn-secondary', style: { fontSize: '11px', padding: '2px 8px' }, onClick: handleExportCurrentTurnHtml }, '🌐 Export Turn HTML'),
              h('button', { className: 'btn btn-secondary', style: { fontSize: '11px', padding: '2px 8px' }, onClick: handleCopyResponse }, '📋 Copy Full Response')
            )
          ),
          h('div', {
            className: 'markdown-response-container',
            dangerouslySetInnerHTML: { __html: renderMarkdown(currentTurn.responseText || '*(No response recorded)*') }
          })
        )
      ),

      // Reader Footer Controls & HTML Export Options
      h('div', {
        className: 'modal-footer',
        style: {
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          background: 'var(--bg-sidebar)'
        }
      },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
          h('label', { style: { fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' } },
            h('input', {
              type: 'checkbox',
              checked: includePromptInHtml,
              onChange: e => setIncludePromptInHtml(e.target.checked)
            }),
            'Include Prompt in HTML Export'
          )
        ),
        h('div', { style: { display: 'flex', gap: '8px' } },
          h('button', { className: 'btn btn-secondary', onClick: handleExportCurrentTurnHtml }, '🌐 Export HTML Page'),
          h('button', { className: 'btn btn-secondary', onClick: handleCopyPrompt }, '📋 Copy Prompt'),
          h('button', { className: 'btn btn-primary', onClick: handleCopyResponse }, '📋 Copy Response'),
          h('button', { className: 'btn btn-secondary', onClick: onClose }, 'Close Reader')
        )
      )
    )
  );
}
