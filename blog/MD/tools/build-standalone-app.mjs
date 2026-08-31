// build-standalone-app.mjs - Build zero-CORS single-file HTML app with Marked, DOMPurify, Preact, Dexie & MiniSearch

import fs from 'fs';
import path from 'path';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const rootDir = process.cwd();

console.log('Fetching UMD vendor bundles and generating zero-CORS HTML app...');

const VENDOR_URLS = [
  { name: 'dexie.js', url: 'https://unpkg.com/dexie@4.0.8/dist/dexie.js' },
  { name: 'preact.umd.js', url: 'https://unpkg.com/preact@10.22.0/dist/preact.umd.js' },
  { name: 'hooks.umd.js', url: 'https://unpkg.com/preact@10.22.0/hooks/dist/hooks.umd.js' },
  { name: 'minisearch.js', url: 'https://unpkg.com/minisearch@7.1.0/dist/umd/index.js' },
  { name: 'marked.min.js', url: 'https://unpkg.com/marked@14.1.2/marked.min.js' },
  { name: 'purify.min.js', url: 'https://unpkg.com/dompurify@3.1.6/dist/purify.min.js' }
];

const vendorCacheDir = path.join(rootDir, 'vendor');
if (!fs.existsSync(vendorCacheDir)) {
  fs.mkdirSync(vendorCacheDir, { recursive: true });
}

let vendorCode = '';

for (const vendor of VENDOR_URLS) {
  const cachePath = path.join(vendorCacheDir, vendor.name);
  let code = '';
  if (fs.existsSync(cachePath)) {
    code = fs.readFileSync(cachePath, 'utf8');
    console.log(`Loaded cached ${vendor.name}`);
  } else {
    console.log(`Downloading ${vendor.url}...`);
    const res = await fetch(vendor.url);
    if (!res.ok) throw new Error(`Failed to download ${vendor.url}`);
    code = await res.text();
    fs.writeFileSync(cachePath, code);
  }
  vendorCode += `\n// --- Vendor: ${vendor.name} ---\n` + code + '\n';
}

// Inlined CSS
let cssCode = '';
const cssFiles = ['tokens.css', 'base.css', 'layout.css', 'components.css'];
for (const file of cssFiles) {
  const cssPath = path.join(rootDir, 'styles', file);
  if (fs.existsSync(cssPath)) {
    cssCode += fs.readFileSync(cssPath, 'utf8') + '\n';
  }
}

// Global UMD variable bindings
const umdBindings = `
const Dexie = window.Dexie;
const liveQuery = window.Dexie.liveQuery;
const { h, render } = window.preact;
const { useState, useRef, useEffect } = window.preactHooks;
const MiniSearch = window.MiniSearch;
const marked = window.marked;
const DOMPurify = window.DOMPurify;
`;

// App source files sequence
const fileOrder = [
  'src/util/ids.js',
  'src/util/hash.js',
  'src/util/text.js',
  'src/util/download.js',
  'src/db/db.js',
  'src/util/log.js',
  'src/core/truncation.js',
  'src/core/continuePrompt.js',
  'src/core/stitch.js',
  'src/core/artifacts.js',
  'src/core/handoff.js',
  'src/core/contextPacker.js',
  'src/core/templates.js',
  'src/core/playbook.js',
  'src/core/tokens.js',
  'src/db/seed.js',
  'src/db/repo.js',
  'src/search/query.js',
  'src/search/index.js',
  'src/io/exportJson.js',
  'src/io/exportMd.js',
  'src/io/exportZip.js',
  'src/io/exportHtml.js',
  'src/io/importer.js',
  'src/io/clipboard.js',
  'src/io/fsSync.js',
  'src/ui/hooks/useLiveQuery.js',
  'src/ui/hooks/useHotkeys.js',
  'src/ui/hooks/useAutosave.js',
  'src/ui/Toasts.js',
  'src/ui/HealthMeter.js',
  'src/ui/TurnReaderModal.js',
  'src/ui/TurnCard.js',
  'src/ui/CaptureBar.js',
  'src/ui/ThreadView.js',
  'src/ui/Sidebar.js',
  'src/ui/CommandPalette.js',
  'src/ui/HandoffModal.js',
  'src/ui/ArtifactLibrary.js',
  'src/ui/DiffView.js',
  'src/ui/ContextPackerModal.js',
  'src/ui/CompareView.js',
  'src/ui/Dashboard.js',
  'src/ui/Settings.js',
  'src/ui/PlaybookRunner.js',
  'src/ui/Shell.js',
  'src/ui/App.js',
  'src/main.js'
];

let appJsCode = umdBindings;

for (const relPath of fileOrder) {
  const absPath = path.join(rootDir, relPath);
  let content = fs.readFileSync(absPath, 'utf8');

  // Strip imports
  content = content.replace(/^import\s+[\s\S]*?from\s+['"].*?['"];?\s*$/gm, '');

  // Convert export statements
  content = content.replace(/^export\s+default\s+/gm, '');
  content = content.replace(/^export\s+async\s+function\s+/gm, 'async function ');
  content = content.replace(/^export\s+function\s+/gm, 'function ');
  content = content.replace(/^export\s+const\s+/gm, 'const ');
  content = content.replace(/^export\s+let\s+/gm, 'let ');
  content = content.replace(/^export\s+\{[\s\S]*?\};?\s*$/gm, '');

  appJsCode += `\n// --- File: ${relPath} ---\n` + content + '\n';
}

const finalHtml = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<title>LLM Ledger — Serverless Capture & Organization Workspace</title>
<meta name="color-scheme" content="dark light" />
<style>
${cssCode}
</style>
<script>
${vendorCode}
</script>
</head>
<body>
  <div id="app" aria-busy="true">
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#94a3b8;font-family:sans-serif;">
      Loading LLM Ledger…
    </div>
  </div>
  <div id="toasts" class="toasts" role="status" aria-live="polite"></div>
  <script>
  (function() {
    ${appJsCode}
  })();
  </script>
  <noscript>This app requires JavaScript to run.</noscript>
</body>
</html>
`;

// Write to index.html and standalone.html so double-clicking ANY file works natively on file://
fs.writeFileSync(path.join(rootDir, 'index.html'), finalHtml);
fs.writeFileSync(path.join(rootDir, 'standalone.html'), finalHtml);

console.log(`\n✅ Successfully generated zero-CORS index.html and standalone.html (${(finalHtml.length / 1024).toFixed(1)} KB)!`);
console.log(`You can now double-click index.html directly on file:// or upload to GitHub Pages with ZERO CORS errors!`);
