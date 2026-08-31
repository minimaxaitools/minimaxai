// main.js - Application bootstrap, database initialization & DOM rendering

import { h, render } from 'preact';
import { seedIfEmpty } from './db/seed.js';
import { ensurePersistence } from './db/db.js';
import { App } from './ui/App.js';

async function bootstrap() {
  const rootEl = document.getElementById('app');
  try {
    await ensurePersistence();
    await seedIfEmpty();

    // Clear loading state and render Preact app
    rootEl.innerHTML = '';
    render(h(App, null), rootEl);
  } catch (err) {
    console.error('LLM Ledger bootstrap failed:', err);
    rootEl.innerHTML = `
      <div style="padding:40px; color:#ef4444; font-family:sans-serif;">
        <h2>Initialization Failure</h2>
        <pre>${err.stack || err.message || err}</pre>
      </div>
    `;
  }
}

bootstrap();
