/**
 * kinetic-bridge.js — plugs KineticEngine into the existing D3 Annotation Studio (Index.html)
 * ------------------------------------------------------------------------------------------
 * Adds one sidebar panel "🎬 Kinetic Motion" that:
 *   • previews the current canvas as a kinetic typography video (overlay player)
 *   • opens the full Kinetic Studio with the current project handed over
 *   • downloads the project as editable kinetic content JSON
 *   • edits per-annotation motion (entry / emphasis / exit / camera / tags / transition),
 *     stored on the annotation as `motion` — so 💾 Save, Undo and d3 JSON keep it.
 * Nothing in fixed_script.js / pattern_engine.js is modified; everything goes through window.AppStore.
 *
 * Install: put the kinetic/ folder next to Index.html and add, after x_monetization_features.js:
 *     <script src="kinetic/kinetic-bridge.js"></script>
 */
(function () {
    'use strict';
    const BASE = (function () {
        const s = document.currentScript && document.currentScript.src;
        return s ? s.slice(0, s.lastIndexOf('/') + 1) : 'kinetic/';
    })();

    function loadScript(src) {
        return new Promise(res => {
            const el = document.createElement('script');
            el.src = src; el.onload = () => res(true); el.onerror = () => res(false);
            document.head.appendChild(el);
        });
    }
    async function ensureEngine() {
        if (!window.KineticEngine) await loadScript(BASE + 'engine.js');
        // smart plug-ins: maps, media/SVG, charts, auto-director, voice (each optional)
        if (!window.KineticGeoData) await loadScript(BASE + 'geo/geo-data.js');
        if (!window.KineticAssets) await loadScript(BASE + 'assets/assets.manifest.js');
        for (const f of ['geo.js', 'media.js', 'charts.js', 'director.js', 'voice.js']) {
            const g = { 'geo.js': 'KineticGeo', 'media.js': 'KineticMedia', 'charts.js': 'KineticCharts', 'director.js': 'KineticDirector', 'voice.js': 'KineticVoice' }[f];
            if (!window[g]) await loadScript(BASE + f);
        }
        if (window.KineticMedia) window.KineticMedia.setBase(BASE);
        if (window.KineticGeo) window.KineticGeo.ready(BASE);
        if (!window.KineticPresets) {
            try { const r = await fetch(BASE + 'presets.motion.json', { cache: 'no-store' }); if (r.ok) window.KineticPresets = await r.json(); } catch (e) { /* file:// */ }
            if (!window.KineticPresets) await loadScript(BASE + 'presets.motion.js');
        }
        if (!window.KineticEngine || !window.KineticPresets) throw new Error('Kinetic engine files not found in ' + BASE);
        // preset packs from kinetic/presets/ (built by build-wrappers.js) merge over the base library once
        if (!window.KineticPresetPacks) await loadScript(BASE + 'presets/packs.js');
        if (window.KineticPresetPacks && window.KineticPresetPacks.length && !window.KineticPresets._packs) {
            window.KineticPresets = window.KineticEngine.mergePresets(window.KineticPresets, window.KineticPresetPacks);
        }
    }
    const toast = (m, d) => window.AppStore && window.AppStore.showToast ? window.AppStore.showToast(m, d || 2600) : console.log(m);

    /** Current canvas as a v3.1 project object — same shape as 💾 Save. */
    function currentProject() {
        const AS = window.AppStore;
        const svg = document.getElementById('canvas');
        const cs = AS.getCanvasSettings ? AS.getCanvasSettings() : {};
        return {
            version: '3.1',
            canvasWidth: cs.customWidth || (svg && svg.clientWidth) || 800,
            canvasHeight: cs.customHeight || (svg && svg.clientHeight) || 500,
            canvasSettings: Object.assign({}, cs),
            annotations: AS.getAnnotations().map(a => Object.assign({}, a)),
            objects: (AS.getObjects ? AS.getObjects() : []).map(o => Object.assign({}, o))
        };
    }
    function kineticContent(keepLegacy) {
        const p = currentProject();
        const s = readSettings();
        const content = window.KineticEngine.normalizeContent(p, window.KineticPresets, { annotationsPerScene: s.perScene });
        // legacy nodes stay attached for previews so the Auto-Director can style map markers by typeKey
        if (!keepLegacy) content.scenes.forEach(sc => { delete sc.legacy; });
        delete content._format;
        content.meta = Object.assign(content.meta || {}, { width: s.width, height: s.height, fps: s.fps, title: s.title || content.meta.title || 'Annotation motion' });
        if (s.theme) content.theme = s.theme;
        return content;
    }
    function readSettings() {
        const v = id => document.getElementById(id);
        const res = (v('kt_res') && v('kt_res').value || '1920x1080').split('x').map(Number);
        return { auto: v('kt_auto') ? v('kt_auto').checked : true, theme: v('kt_theme') ? v('kt_theme').value : '', perScene: +(v('kt_perScene') ? v('kt_perScene').value : 1) || 1, width: res[0], height: res[1], fps: 30, title: document.title };
    }

    /* ─── overlay player ─── */
    let overlay = null, player = null;
    function buildOverlay() {
        overlay = document.createElement('div');
        overlay.id = 'ktOverlay';
        overlay.innerHTML = `
          <style>
            #ktOverlay{position:fixed;inset:0;z-index:10000;background:rgba(10,12,11,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;font:13px/1.4 Inter,system-ui,sans-serif;color:#eee}
            #ktOverlay canvas{max-width:min(96vw,calc((100vh - 170px)*1.7778));width:100%;height:auto;box-shadow:0 20px 60px rgba(0,0,0,.5);background:#000}
            #ktOverlay .bar{display:flex;gap:8px;align-items:center;width:min(96vw,calc((100vh - 170px)*1.7778));flex-wrap:wrap}
            #ktOverlay button,#ktOverlay select{background:#2a2f2c;color:#eee;border:1px solid #444;border-radius:5px;padding:5px 10px;cursor:pointer}
            #ktOverlay .scrub{flex:1;min-width:160px}
            #ktOverlay .tc{font:600 12px ui-monospace,monospace;min-width:11ch}
            #ktOverlay .chips{display:flex;gap:6px;flex-wrap:wrap;width:min(96vw,calc((100vh - 170px)*1.7778))}
            #ktOverlay .chips button{font-size:11px;padding:3px 9px;border-radius:99px}
          </style>
          <canvas id="ktCanvas"></canvas>
          <div class="bar">
            <button id="ktPlay">❚❚</button>
            <input class="scrub" id="ktScrub" type="range" min="0" max="1000" value="0" aria-label="Scrub" />
            <span class="tc" id="ktTime">0.0 s</span>
            <label><input type="checkbox" id="ktLoop" checked /> Loop</label>
            <select id="ktSpeed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select>
            <button id="ktStudio">Open in Studio</button>
            <button id="ktClose">Close ✕</button>
          </div>
          <div class="chips" id="ktChips"></div>`;
        document.body.appendChild(overlay);
        player = new window.KineticEngine.Player(overlay.querySelector('#ktCanvas'), { previewWidth: 1280 });
        const $ = id => overlay.querySelector('#' + id);
        player.on('time', t => {
            $('ktScrub').value = Math.round(t / Math.max(0.001, player.duration) * 1000);
            $('ktTime').textContent = `${t.toFixed(1)} / ${player.duration.toFixed(1)} s`;
        });
        player.on('play', () => { $('ktPlay').textContent = '❚❚'; }).on('pause', () => { $('ktPlay').textContent = '▶'; });
        $('ktPlay').onclick = () => player.toggle();
        $('ktScrub').oninput = e => { player.pause(); player.seek(e.target.value / 1000 * player.duration); };
        $('ktLoop').onchange = e => player.setLoop(e.target.checked);
        $('ktSpeed').onchange = e => player.setSpeed(+e.target.value);
        $('ktClose').onclick = closeOverlay;
        $('ktStudio').onclick = openStudio;
        document.addEventListener('keydown', e => {
            if (!overlay || overlay.hidden) return;
            if (e.key === 'Escape') closeOverlay();
            if (e.code === 'Space') { e.preventDefault(); e.stopPropagation(); player.toggle(); }
        }, true);
    }
    function closeOverlay() { if (player) player.pause(); if (overlay) overlay.hidden = true; }

    async function preview() {
        try {
            await ensureEngine();
            const AS = window.AppStore;
            if (!AS || !AS.getAnnotations().length) { toast('Add some annotations first — each becomes a kinetic scene.'); return; }
            if (!overlay) buildOverlay();
            overlay.hidden = false;
            const content = kineticContent(true);
            const hooks = [];
            if (window.KineticMedia) hooks.push(window.KineticMedia.hook);
            if (readSettings().auto && window.KineticDirector) hooks.push(window.KineticDirector.hook({}));
            const tl = await player.load(content, window.KineticPresets, { theme: content.theme, beforeCompile: hooks });
            const chips = overlay.querySelector('#ktChips');
            chips.innerHTML = '';
            tl.scenes.forEach((s, i) => { const b = document.createElement('button'); b.textContent = `${i + 1}. ${s.title}`; b.onclick = () => player.seekScene(i); chips.appendChild(b); });
            player.seek(0);
            player.play();
            const w = window.KineticEngine.Log.warnings;
            if (w.length) toast(`${w.length} motion warning(s) — see console. Playback uses defaults.`, 3500);
        } catch (e) { toast('Kinetic preview failed: ' + e.message, 4000); console.error(e); }
    }

    async function openStudio() {
        try {
            await ensureEngine();
            const content = kineticContent(true);
            const win = window.open(BASE + 'index.html', 'kineticStudio');
            if (!win) { toast('Pop-up blocked — allow pop-ups to open Kinetic Studio.'); return; }
            let sent = false;
            const send = () => { try { win.postMessage({ type: 'kinetic:load', content }, '*'); } catch (e) { /* not ready */ } };
            const onMsg = e => {
                if (e.source !== win) return;
                if (e.data && e.data.type === 'kinetic:ready') send();
                if (e.data && e.data.type === 'kinetic:loaded') { sent = true; window.removeEventListener('message', onMsg); }
            };
            window.addEventListener('message', onMsg);
            // retry for pages that were already open
            let n = 0; const iv = setInterval(() => { if (sent || ++n > 20) return clearInterval(iv); send(); }, 500);
        } catch (e) { toast(e.message, 4000); }
    }

    async function downloadContent() {
        try {
            await ensureEngine();
            const blob = new Blob([JSON.stringify(kineticContent(), null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob); a.download = 'kinetic-content.json'; a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 2000);
            toast('Downloaded kinetic-content.json — open it in Kinetic Studio to fine-tune.');
        } catch (e) { toast(e.message, 4000); }
    }

    /* ─── per-annotation motion editor ─── */
    const MOTION_FIELDS = [
        ['entry', 'Entry', 'entry'], ['emphasis', 'Emphasis', 'emphasis'], ['exit', 'Exit', 'exit'],
        ['camera', 'Camera', 'camera'], ['staging', 'Staging', 'staging'], ['layout', 'Layout', 'layouts'], ['transition', 'Transition out', 'transitions'], ['background', 'Background', 'backgrounds']
    ];
    function selectedAnnotation() {
        const AS = window.AppStore;
        if (!AS || !AS.getSelectedId) return null;
        const id = AS.getSelectedId();
        return id == null ? null : AS.getAnnotations().find(a => a.id === id) || null;
    }
    function syncMotionEditor() {
        const box = document.getElementById('kt_motionBox');
        if (!box) return;
        const ann = selectedAnnotation();
        box.hidden = !ann;
        document.getElementById('kt_noSel').hidden = !!ann;
        if (!ann) return;
        const m = ann.motion || {};
        MOTION_FIELDS.forEach(([k]) => { const el = document.getElementById('kt_m_' + k); if (el && document.activeElement !== el) el.value = m[k] || ''; });
        const tags = document.getElementById('kt_m_tags'); if (document.activeElement !== tags) tags.value = m.tags || '';
        const ord = document.getElementById('kt_m_order'); if (document.activeElement !== ord) ord.value = m.order != null ? m.order : '';
    }
    function writeMotion(key, value) {
        const ann = selectedAnnotation();
        if (!ann) return;
        const AS = window.AppStore;
        if (AS.captureState) AS.captureState();
        ann.motion = Object.assign({}, ann.motion || {});
        if (value === '' || value == null) delete ann.motion[key]; else ann.motion[key] = key === 'order' ? +value : value;
        if (!Object.keys(ann.motion).length) delete ann.motion;
    }

    /* ─── panel ─── */
    async function buildPanel() {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar || document.getElementById('kineticPanel')) return;
        try { await ensureEngine(); } catch (e) { console.warn('[kinetic-bridge]', e.message); }
        const P = window.KineticPresets || {};
        const opts = (cat, blank) => `<option value="">${blank}</option>` + Object.keys(P[cat] || {}).filter(k => k[0] !== '_').map(k => `<option value="${k}">${k}</option>`).join('');
        const panel = document.createElement('div');
        panel.className = 'panel';
        panel.id = 'kineticPanel';
        panel.style.border = '1px solid rgba(242,165,65,0.45)';
        panel.innerHTML = `
          <div class="panel-title" style="color:#F2A541;">🎬 Kinetic Motion</div>
          <div class="panel-body">
            <div class="num-row" style="margin-bottom:5px;">
              <div class="field" style="flex:2;"><label>Theme</label><select id="kt_theme" class="select-input">${Object.keys(P.themes || {}).map(k => `<option value="${k}">${k}</option>`).join('')}</select></div>
              <div class="field"><label>Per scene</label><input id="kt_perScene" type="number" min="1" max="12" value="1" class="small-input" title="Annotations grouped into one scene" /></div>
            </div>
            <div class="field" style="margin-bottom:6px;"><label>Output</label>
              <select id="kt_res" class="select-input"><option value="1920x1080">1920×1080 (16:9)</option><option value="1080x1920">1080×1920 (9:16 Reels/Shorts)</option><option value="1080x1080">1080×1080 (1:1)</option><option value="3840x2160">3840×2160 (4K)</option></select>
            </div>
            <label class="cb-label" style="display:block;margin-bottom:5px;" title="Maps for countries/cities, charts from numbers, counters, emoji, pictures from kinetic/assets"><input type="checkbox" id="kt_auto" checked /> Auto-Director (maps · charts · counters · emoji)</label>
            <button class="btn-sm" id="kt_preview" style="width:100%;background:#F2A541;color:#1b1a16;border-color:#F2A541;font-weight:600;">▶ Play canvas as kinetic video</button>
            <div style="display:flex;gap:4px;margin-top:4px;">
              <button class="btn-sm" id="kt_studio" style="flex:1;">Open in Kinetic Studio</button>
              <button class="btn-sm" id="kt_json" style="flex:1;">Download motion JSON</button>
            </div>
            <div class="field-label" style="margin-top:8px;">Motion for selected annotation</div>
            <div id="kt_noSel" style="font-size:10px;opacity:.6;">Select an annotation to set its entry, emphasis, camera and tags. Unset fields use the theme's rotating defaults.</div>
            <div id="kt_motionBox" hidden>
              ${MOTION_FIELDS.map(([k, label, cat]) => `<div class="field" style="margin-top:3px;"><label>${label}</label><select id="kt_m_${k}" class="select-input" style="font-size:10px;">${opts(cat, 'auto')}</select></div>`).join('')}
              <div class="field" style="margin-top:3px;"><label>Tags (e.g. highlight counter icon:star)</label><input id="kt_m_tags" type="text" class="text-input" style="font-size:11px;" placeholder="highlight burst" /></div>
              <div class="field" style="margin-top:3px;"><label>Scene order</label><input id="kt_m_order" type="number" class="small-input" placeholder="auto (numbering → badge → top-to-bottom)" /></div>
            </div>
          </div>`;
        const anchor = document.getElementById('projectPatternConverterPanel') || document.getElementById('patterns-section');
        if (anchor && anchor.parentNode === sidebar) sidebar.insertBefore(panel, anchor.nextSibling); else sidebar.appendChild(panel);
        panel.querySelector('#kt_preview').onclick = preview;
        panel.querySelector('#kt_studio').onclick = openStudio;
        panel.querySelector('#kt_json').onclick = downloadContent;
        MOTION_FIELDS.forEach(([k]) => { panel.querySelector('#kt_m_' + k).onchange = e => writeMotion(k, e.target.value); });
        panel.querySelector('#kt_m_tags').onchange = e => writeMotion('tags', e.target.value.trim());
        panel.querySelector('#kt_m_order').onchange = e => writeMotion('order', e.target.value);
        // follow canvas selection without touching the app's own code
        const canvas = document.getElementById('canvas');
        if (canvas) canvas.addEventListener('click', () => setTimeout(syncMotionEditor, 0));
        document.addEventListener('keyup', () => setTimeout(syncMotionEditor, 0));
        setInterval(syncMotionEditor, 800);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(buildPanel, 200));
    else setTimeout(buildPanel, 200);

    window.KineticBridge = { preview, openStudio, downloadContent, kineticContent, currentProject };
})();
