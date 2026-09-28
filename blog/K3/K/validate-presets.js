#!/usr/bin/env node
/**
 * validate-presets.js — check presets.motion.json and any preset packs before using them.
 *
 *   node validate-presets.js                        # base + every presets/*.json
 *   node validate-presets.js presets/my-pack.json   # base + just this pack
 *   node validate-presets.js --merge out.json       # also write the merged library
 *   node validate-presets.js my-plugin.js pack.json # load a JS plug-in first, then check a pack that uses it
 *
 * Exit code 1 when there are errors (useful for CI or before handing a pack to others).
 */
const fs = require('fs');
const path = require('path');
const dir = __dirname;
globalThis.window = globalThis;
const E = require(path.join(dir, 'engine.js'));
['geo.js', 'media.js', 'charts.js'].forEach(f => { try { require(path.join(dir, f)); } catch (e) { /* optional plug-ins register their visual tags */ } });

const args = process.argv.slice(2);
const mi = args.indexOf('--merge');
const mergeOut = mi >= 0 ? args.splice(mi, 2)[1] : null;
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const base = read(path.join(dir, 'presets.motion.json'));
// .js arguments are plug-ins (registerSupplement / registerTransition / registerBackgroundLayer / registerBlock)
args.filter(f => /\.js$/i.test(f)).forEach(f => { require(path.resolve(f)); console.log('plug-in: ' + f); });
let packFiles = args.filter(f => !/\.js$/i.test(f));
if (!packFiles.length && fs.existsSync(path.join(dir, 'presets'))) packFiles = fs.readdirSync(path.join(dir, 'presets')).filter(f => f.endsWith('.json')).map(f => path.join(dir, 'presets', f));
const packs = [];
for (const f of packFiles) {
    try { const j = read(f); j.pack = Object.assign({ name: path.basename(f, '.json') }, j.pack || {}); packs.push(j); }
    catch (e) { console.error(`✗ ${f}: not valid JSON — ${e.message}`); process.exitCode = 1; }
}
const merged = packs.length ? E.mergePresets(base, packs) : base;
const issues = E.validatePresets(merged);
const errs = issues.filter(i => i.level === 'error');
issues.forEach(i => console.log(`${i.level === 'error' ? '✗' : '!'} ${i.path}: ${i.msg}`));
console.log(`\n${packs.length} pack(s): ${packs.map(p => p.pack.name).join(', ') || '—'}`);
['recipes', 'entry', 'emphasis', 'exit', 'loop', 'camera', 'staging', 'layouts', 'supplements', 'transitions', 'backgrounds', 'themes'].forEach(c => {
    const n = Object.keys(merged[c] || {}).filter(k => k[0] !== '_').length;
    process.stdout.write(`${c}: ${n}  `);
});
console.log(`\n${errs.length} error(s), ${issues.length - errs.length} warning(s)`);
if (mergeOut) { const m = JSON.parse(JSON.stringify(merged)); delete m._packs; fs.writeFileSync(mergeOut, JSON.stringify(m, null, 2)); console.log('→ ' + mergeOut); }
if (errs.length) process.exitCode = 1;
