// exportHtml.js - Pro HTML Exporter System with Include/Exclude Prompt option & Copy Prompt button in exported HTML

import { db } from '../db/db.js';
import { saveFile } from '../util/download.js';
import { formatDate } from '../util/ids.js';
import { cleanPromptText } from '../util/text.js';

function renderMarkdownToHtmlString(text) {
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

    // Process GitHub Admonitions
    rawHtml = rawHtml.replace(/blockquote>\s*<p>\s*\[!(NOTE|WARNING|IMPORTANT|TIP|CAUTION)\]\s*([\s\S]*?)<\/p>\s*<\/blockquote>/gi, (match, type, content) => {
      const t = type.toLowerCase();
      const icon = t === 'note' ? 'ℹ️' : t === 'warning' ? '⚠️' : t === 'important' ? '📌' : t === 'tip' ? '💡' : '🚨';
      return `
<div class="admonition admonition-${t}">
  <div class="admonition-title">${icon} ${type.toUpperCase()}</div>
  <div class="admonition-body">${content}</div>
</div>`;
    });

    // Enrich code containers
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
    <button class="code-copy-btn" type="button" onclick="copyCodeBlock(this)">📋 Copy Code</button>
  </div>
  <pre><code class="language-${lang || 'text'}">${codeContent}</code></pre>
</div>`;
    });

    // Enrich tables
    rawHtml = rawHtml.replace(/<table[\s\S]*?<\/table>/gi, match => `<div class="table-container">${match}</div>`);

    const purifyLib = window.DOMPurify;
    if (purifyLib && typeof purifyLib.sanitize === 'function') {
      return purifyLib.sanitize(rawHtml, {
        ADD_ATTR: ['class', 'data-code', 'type', 'onclick'],
        ADD_TAGS: ['button', 'div', 'span', 'details', 'summary', 'kbd', 'mark']
      });
    }
    return rawHtml;
  } catch (err) {
    return text;
  }
}

function generateProHtmlDocument(title, subtitle, bodyContent) {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  
  <style>
    :root {
      --bg-app: #0f1219;
      --bg-card: #1e2430;
      --bg-input: #121620;
      --border-color: #2e3748;
      --text-main: #e2e8f0;
      --text-muted: #94a3b8;
      --accent-primary: #6366f1;
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      background-color: var(--bg-app);
      color: var(--text-main);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.7;
      padding: 40px 20px;
      max-width: 1000px;
      margin: 0 auto;
    }
    
    .doc-header {
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 16px;
      margin-bottom: 32px;
    }
    
    .doc-header h1 {
      font-size: 26px;
      font-weight: 800;
      color: #ffffff;
    }
    
    .doc-meta {
      color: var(--text-muted);
      font-size: 13px;
      margin-top: 6px;
    }
    
    .turn-card-box {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 28px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    
    .turn-badge {
      display: inline-block;
      background: var(--accent-primary);
      color: #ffffff;
      padding: 3px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 12px;
    }
    
    .prompt-box {
      background: var(--bg-input);
      border-left: 4px solid var(--accent-primary);
      padding: 16px 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      position: relative;
    }
    .prompt-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 4px;
    }
    .prompt-text { white-space: pre-wrap; font-size: 14px; }
    
    .btn-copy-prompt {
      background: #3f3f46;
      color: #fff;
      border: none;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      font-weight: 600;
    }
    .btn-copy-prompt:hover { background: #6366f1; }

    /* Mac Code Blocks */
    .code-container {
      margin: 18px 0;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      background: #1E1E1E;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    }
    
    .code-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 14px;
      background: #2D2D2D;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    
    .code-header-left { display: flex; align-items: center; gap: 10px; }
    .mac-dots { display: flex; gap: 6px; }
    .mac-dot { width: 10px; height: 10px; border-radius: 50%; }
    .mac-red { background: #ef4444; } .mac-yellow { background: #f59e0b; } .mac-green { background: #10b981; }
    .code-title { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #a1a1aa; font-weight: 700; }
    
    .code-copy-btn {
      background: rgba(255,255,255,0.1);
      color: #e4e4e7;
      border: 1px solid rgba(255,255,255,0.1);
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
    }
    .code-copy-btn:hover { background: #6366f1; color: #fff; }
    
    pre { margin: 0; padding: 16px; max-height: 480px; overflow-x: auto; overflow-y: auto; }
    code { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #e6edf3; }
    
    /* Callouts */
    .admonition { margin: 16px 0; padding: 14px 18px; border-radius: 8px; border-left: 4px solid #3b82f6; background: rgba(59,130,246,0.08); }
    .admonition-title { font-weight: 700; font-size: 12px; margin-bottom: 6px; }
    .admonition-note { border-left-color: #3b82f6; color: #93c5fd; }
    .admonition-warning { border-left-color: #f59e0b; color: #fde047; }
    .admonition-important { border-left-color: #8b5cf6; color: #c4b5fd; }
    .admonition-tip { border-left-color: #10b981; color: #6ee7b7; }
    .admonition-caution { border-left-color: #ef4444; color: #fca5a5; }

    /* Tables & Elements */
    .table-container { overflow-x: auto; margin: 18px 0; border: 1px solid var(--border-color); border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid var(--border-color); padding: 10px 14px; text-align: left; }
    th { background: #2D2D2D; font-weight: 700; }
    tr:nth-child(even) { background: rgba(255,255,255,0.02); }
    kbd { background: #27272a; border: 1px solid #3f3f46; border-radius: 4px; padding: 2px 6px; font-family: monospace; font-size: 11px; }
    mark { background: rgba(245,158,11,0.25); color: #fde047; padding: 2px 6px; border-radius: 4px; }
    details { background: var(--bg-input); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--border-color); margin: 12px 0; }
    summary { font-weight: 700; cursor: pointer; color: var(--accent-primary); }
  </style>
</head>
<body>
  <div class="doc-header">
    <h1>${title}</h1>
    <div class="doc-meta">${subtitle} · Exported on ${formatDate(Date.now())}</div>
  </div>
  ${bodyContent}

  <` + `script>
    function copyCodeBlock(btn) {
      const container = btn.closest('.code-container');
      if (container) {
        const code = container.querySelector('code');
        if (code) {
          navigator.clipboard.writeText(code.innerText);
          btn.innerText = 'Copied! ✓';
          btn.style.background = '#10b981';
          setTimeout(() => { btn.innerText = '📋 Copy Code'; btn.style.background = ''; }, 2000);
        }
      }
    }

    function copyPromptText(btn) {
      const promptBox = btn.closest('.prompt-box');
      if (promptBox) {
        const textElement = promptBox.querySelector('.prompt-text');
        if (textElement) {
          navigator.clipboard.writeText(textElement.innerText);
          btn.innerText = 'Copied! ✓';
          btn.style.background = '#10b981';
          setTimeout(() => { btn.innerText = '📋 Copy Prompt'; btn.style.background = ''; }, 2000);
        }
      }
    }
  <` + `/script>
</body>
</html>`;
}

export async function exportTurnToHTML(turnId, options = { includePrompt: true }) {
  const turn = await db.turns.get(turnId);
  if (!turn) return;
  const thread = await db.threads.get(turn.threadId);
  const cleanPrompt = cleanPromptText(turn.promptText);

  const renderedResponse = renderMarkdownToHtmlString(turn.responseText);

  const promptBlock = options.includePrompt ? `
  <div class="prompt-box">
    <div class="prompt-header">
      <strong style="font-size:12px; color:var(--text-muted);">PROMPT:</strong>
      <button class="btn-copy-prompt" onclick="copyPromptText(this)">📋 Copy Prompt</button>
    </div>
    <div class="prompt-text">${cleanPrompt.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
  </div>` : '';

  const body = `
<div class="turn-card-box">
  <span class="turn-badge">Turn #${turn.seq} (${turn.modelId || 'LLM'})</span>
  ${promptBlock}
  <div class="response-box">
    <strong style="color:var(--text-muted); font-size:12px; text-transform:uppercase;">Response Output:</strong><br/>
    ${renderedResponse}
  </div>
</div>`;

  const title = `Turn #${turn.seq} - ${thread ? thread.title : 'Ledger'}`;
  const subtitle = `Model: ${turn.modelId || 'LLM'}`;
  const doc = generateProHtmlDocument(title, subtitle, body);
  saveFile(doc, `turn-${turn.seq}-export.html`, 'text/html');
  return doc;
}

export async function exportSessionToHTML(sessionId, options = { includePrompt: true }) {
  const session = await db.sessions.get(sessionId);
  if (!session) return;
  const thread = await db.threads.get(session.threadId);
  const turns = await db.turns.where('sessionId').equals(sessionId).sortBy('seq');

  let body = '';

  for (const t of turns) {
    const cleanPrompt = cleanPromptText(t.promptText);
    const renderedResponse = renderMarkdownToHtmlString(t.responseText);
    const promptBlock = options.includePrompt ? `
    <div class="prompt-box">
      <div class="prompt-header">
        <strong style="font-size:12px; color:var(--text-muted);">PROMPT:</strong>
        <button class="btn-copy-prompt" onclick="copyPromptText(this)">📋 Copy Prompt</button>
      </div>
      <div class="prompt-text">${cleanPrompt.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    </div>` : '';

    body += `
<div class="turn-card-box">
  <span class="turn-badge">Turn #${t.seq} (${t.modelId || session.modelId})</span>
  ${promptBlock}
  <div class="response-box">
    <strong style="color:var(--text-muted); font-size:12px; text-transform:uppercase;">Response Output:</strong><br/>
    ${renderedResponse}
  </div>
</div>`;
  }

  const title = `Session Export - ${thread ? thread.title : 'Thread'}`;
  const subtitle = `Model: ${session.modelId} · ${turns.length} turns`;
  const doc = generateProHtmlDocument(title, subtitle, body);
  saveFile(doc, `session-${sessionId.slice(0, 8)}.html`, 'text/html');
  return doc;
}

export async function exportThreadToHTML(threadId, options = { includePrompt: true }) {
  const thread = await db.threads.get(threadId);
  if (!thread) return;

  const turns = await db.turns.where('threadId').equals(threadId).sortBy('createdAt');
  const artifacts = await db.artifacts.where('threadId').equals(threadId).toArray();

  let body = '';

  if (artifacts.length > 0) {
    body += `<h2 style="margin-bottom:16px;">⭐ Starred Working Code Solutions</h2>`;
    for (const a of artifacts) {
      body += `
<div class="code-container">
  <div class="code-header">
    <div class="code-header-left">
      <div class="mac-dots"><span class="mac-dot mac-red"></span><span class="mac-dot mac-yellow"></span><span class="mac-dot mac-green"></span></div>
      <span class="code-title">${a.title} (${a.lang || 'code'})</span>
    </div>
    <button class="code-copy-btn" onclick="copyCodeBlock(this)">📋 Copy Code</button>
  </div>
  <pre><code>${a.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
</div>`;
    }
  }

  body += `<h2 style="margin-top:32px; margin-bottom:16px;">Turn History</h2>`;
  for (const t of turns) {
    const cleanPrompt = cleanPromptText(t.promptText);
    const renderedResponse = renderMarkdownToHtmlString(t.responseText);
    const promptBlock = options.includePrompt ? `
    <div class="prompt-box">
      <div class="prompt-header">
        <strong style="font-size:12px; color:var(--text-muted);">PROMPT:</strong>
        <button class="btn-copy-prompt" onclick="copyPromptText(this)">📋 Copy Prompt</button>
      </div>
      <div class="prompt-text">${cleanPrompt.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    </div>` : '';

    body += `
<div class="turn-card-box">
  <span class="turn-badge">Turn #${t.seq} (${t.modelId})</span>
  ${promptBlock}
  <div class="response-box"><strong style="color:var(--text-muted); font-size:12px; text-transform:uppercase;">Response Output:</strong><br/>${renderedResponse}</div>
</div>`;
  }

  const sanitizedTitle = thread.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const doc = generateProHtmlDocument(`Thread: ${thread.title}`, `${turns.length} turns recorded`, body);
  saveFile(doc, `${sanitizedTitle}-deliverable.html`, 'text/html');
  return doc;
}

export async function exportProjectToHTML(projectId, options = { includePrompt: true }) {
  const project = await db.projects.get(projectId);
  if (!project) return;

  const threads = await db.threads.where('projectId').equals(projectId).toArray();

  let body = '';

  for (const t of threads) {
    const turns = await db.turns.where('threadId').equals(t.id).sortBy('createdAt');
    body += `<h2 style="color:var(--accent-primary); margin-top:24px; margin-bottom:12px;">📌 Thread: ${t.title}</h2>`;

    for (const turn of turns) {
      const cleanPrompt = cleanPromptText(turn.promptText);
      const renderedResponse = renderMarkdownToHtmlString(turn.responseText);
      const promptBlock = options.includePrompt ? `
      <div class="prompt-box">
        <div class="prompt-header">
          <strong style="font-size:12px; color:var(--text-muted);">PROMPT:</strong>
          <button class="btn-copy-prompt" onclick="copyPromptText(this)">📋 Copy Prompt</button>
        </div>
        <div class="prompt-text">${cleanPrompt.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      </div>` : '';

      body += `
<div class="turn-card-box">
  <span class="turn-badge">Turn #${turn.seq} (${turn.modelId})</span>
  ${promptBlock}
  <div class="response-box"><strong style="color:var(--text-muted); font-size:12px; text-transform:uppercase;">Response Output:</strong><br/>${renderedResponse}</div>
</div>`;
    }
  }

  const sanitizedName = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const doc = generateProHtmlDocument(`Project Workspace: ${project.name}`, `${threads.length} threads contained`, body);
  saveFile(doc, `${sanitizedName}-full-workspace.html`, 'text/html');
  return doc;
}
