// inline.mjs - Build script to create standalone.html with inlined CSS and single bundled JS script

import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();

console.log('Generating single-file standalone.html...');

const htmlPath = path.join(rootDir, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// Remove file protocol warning box from standalone.html since standalone works natively on file://
html = html.replace(/<div id="file-protocol-warning"[\s\S]*?<\/div>\s*<script>[\s\S]*?<\/script>/, '');

// Inline CSS files
const cssFiles = ['tokens.css', 'base.css', 'layout.css', 'components.css'];
for (const file of cssFiles) {
  const cssPath = path.join(rootDir, 'styles', file);
  if (fs.existsSync(cssPath)) {
    const css = fs.readFileSync(cssPath, 'utf8');
    const regex = new RegExp(`<link rel="stylesheet" href="\\.\\/styles\\/${file.replace('.', '\\.')}" \\/>`);
    html = html.replace(regex, `<style>\n${css}\n</style>`);
  }
}

// Sequence of JS files to bundle into single inline script
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
  'src/io/importer.js',
  'src/io/clipboard.js',
  'src/io/fsSync.js',
  'src/ui/hooks/useLiveQuery.js',
  'src/ui/hooks/useHotkeys.js',
  'src/ui/hooks/useAutosave.js',
  'src/ui/Toasts.js',
  'src/ui/HealthMeter.js',
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

// Top-level consolidated external imports
const topImports = `
import Dexie, { liveQuery } from 'dexie';
import { h, render } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import MiniSearch from 'minisearch';
`;

let bodyCode = '';

for (const relPath of fileOrder) {
  const absPath = path.join(rootDir, relPath);
  let content = fs.readFileSync(absPath, 'utf8');

  // Strip ALL import statements from body files
  content = content.replace(/^import\s+[\s\S]*?from\s+['"].*?['"];?\s*$/gm, '');

  // Convert export declarations to local declarations
  content = content.replace(/^export\s+default\s+/gm, '');
  content = content.replace(/^export\s+async\s+function\s+/gm, 'async function ');
  content = content.replace(/^export\s+function\s+/gm, 'function ');
  content = content.replace(/^export\s+const\s+/gm, 'const ');
  content = content.replace(/^export\s+let\s+/gm, 'let ');
  content = content.replace(/^export\s+\{[\s\S]*?\};?\s*$/gm, '');

  bodyCode += `\n// --- File: ${relPath} ---\n` + content + '\n';
}

const bundledJs = topImports + '\n' + bodyCode;

// Replace script tag in HTML with single inline bundled script
html = html.replace(/<script type="module" src="\.\/src\/main\.js"><\/script>/, `<script type="module">\n${bundledJs}\n</script>`);

// Remove manifest tag from standalone.html to avoid CORS warning on file://
html = html.replace(/<link rel="manifest" href="\.\/manifest\.webmanifest" \/>/, '');

const outputPath = path.join(rootDir, 'standalone.html');
fs.writeFileSync(outputPath, html);

console.log(`Successfully created single-file ${outputPath} (${(html.length / 1024).toFixed(1)} KB)!`);
