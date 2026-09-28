/* Kinetic Studio — UI harness around KineticEngine.Player
 * Everything visual comes from the engine + JSON; this file only wires controls.
 */
(function () {
    'use strict';
    const E = window.KineticEngine;
    const $ = id => document.getElementById(id);
    const state = { presets: null, content: null, sourceText: '', exportAbort: null, warnings: [] };
    const player = new E.Player($('canvas'), { previewWidth: +$('qualitySelect').value });

    /* ─── loading JSON (works over http and from file://) ─── */
    async function fetchJSON(url, fallback, label) {
        try {
            const r = await fetch(url, { cache: 'no-store' });
            if (r.ok) return await r.json();
        } catch (e) { /* file:// — fall through to the .js wrapper */ }
        if (fallback) return fallback;
        throw new Error(`Could not load ${label}. Serve this folder over http or keep the ${label.replace('.json', '.js')} wrapper next to index.html.`);
    }

    function setStatus(msg, kind) { const s = $('status'); s.textContent = msg; s.className = 'status' + (kind ? ' ' + kind : ''); }
    const FORMAT_LABEL = { native: 'native scenes', project: 'annotation project', d3: 'd3 annotations', pattern: 'pattern result', text: 'plain text', unknown: 'unknown' };

    function parseEditor() {
        const txt = $('contentEditor').value;
        const trimmed = txt.trim();
        if (trimmed[0] === '{' || trimmed[0] === '[') {
            try { return JSON.parse(trimmed); } catch (e) { throw new Error('JSON error: ' + e.message); }
        }
        return txt;
    }

    async function render(content, opts) {
        opts = opts || {};
        E.Log.reset();
        state.content = content;
        const theme = $('themeSelect').value || undefined;
        const keepTime = opts.keepTime ? player.time : 0;
        const K = window.KStudio || {};
        const tl = await player.load(content, state.presets, { theme, previewWidth: +$('qualitySelect').value, beforeCompile: K.hooks ? K.hooks() : [], audioFor: K.audioFor ? K.audioFor() : null });
        if (K.afterRender) K.afterRender(tl);
        player.seek(Math.min(keepTime, tl.duration));
        buildTimelineUI(tl);
        const f = E.detectFormat(content).kind;
        $('formatBadge').textContent = FORMAT_LABEL[f] || f;
        $('formatBadge').dataset.kind = f;
        $('frame').style.setProperty('--aspect', (tl.frame.outW / tl.frame.outH).toFixed(4));
        $('cornerRes').textContent = `${tl.meta.width || tl.frame.outW}×${tl.meta.height || tl.frame.outH} · ${tl.frame.fps} fps`;
        $('exWidth').value = tl.meta.width || 1920; $('exHeight').value = tl.meta.height || 1080; $('exFps').value = tl.frame.fps;
        const shots = tl.scenes.reduce((s, x) => s + x.shots.length, 0);
        setStatus(`${tl.scenes.length} scenes · ${shots} camera shots · ${tl.duration.toFixed(1)} s`, 'ok');
        refreshWarnings();
        if (opts.autoplay) player.play();
        return tl;
    }

    async function applyEditor(opts) {
        try { await render(parseEditor(), Object.assign({ keepTime: true }, opts)); }
        catch (e) { setStatus(e.message, 'err'); console.error(e); }
    }

    function loadIntoEditor(content, name) {
        $('contentEditor').value = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
        return render(content).then(() => { if (name) setStatus($('status').textContent + ` · ${name}`, 'ok'); });
    }

    /* ─── timeline UI ─── */
    function buildTimelineUI(tl) {
        const segs = $('segs'), ticks = $('ticks'), chips = $('chips');
        segs.innerHTML = ''; ticks.innerHTML = ''; chips.innerHTML = '';
        const D = Math.max(0.001, tl.duration);
        tl.scenes.forEach((s, i) => {
            const next = tl.scenes[i + 1];
            const end = next ? next.start : s.end;
            const seg = document.createElement('div');
            seg.className = 'seg';
            seg.style.left = (s.start / D * 100) + '%';
            seg.style.width = ((end - s.start) / D * 100) + '%';
            seg.textContent = s.title;
            seg.title = `${s.title} — ${s.backgroundName}, → ${s.transitionName}`;
            segs.appendChild(seg);
            if (next) {
                const tr = document.createElement('div');
                tr.className = 'trans';
                tr.style.left = (next.start / D * 100) + '%';
                tr.style.width = ((s.end - next.start) / D * 100) + '%';
                tr.title = 'Transition: ' + s.transitionName;
                segs.appendChild(tr);
            }
            s.shots.forEach(sh => {
                const t = document.createElement('div');
                t.className = 'tick';
                t.style.left = ((s.start + sh.start) / D * 100) + '%';
                t.title = `Shot ${sh.index + 1}: ${sh.moveName}`;
                ticks.appendChild(t);
            });
            const c = document.createElement('button');
            c.className = 'chip';
            c.innerHTML = `<span class="n">${String(i + 1).padStart(2, '0')}</span>`;
            c.appendChild(document.createTextNode(s.title));
            c.addEventListener('click', () => player.seekScene(i));
            chips.appendChild(c);
        });
        $('scrub').setAttribute('aria-valuemax', D.toFixed(2));
        updateTransport();
    }

    function tc(t, fps) {
        const f = Math.round(t * fps);
        const ff = f % fps, s = Math.floor(f / fps);
        const p = n => String(n).padStart(2, '0');
        return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}:${p(ff)}`;
    }

    function updateTransport() {
        const tl = player.timeline;
        if (!tl) return;
        const fps = tl.frame.fps;
        $('timecode').innerHTML = `${tc(player.time, fps)}<small>/ ${tc(tl.duration, fps)} · f${player.frame}</small>`;
        $('head').style.left = (player.time / Math.max(0.001, tl.duration) * 100) + '%';
        $('scrub').setAttribute('aria-valuenow', player.time.toFixed(2));
        const si = player.sceneIndexAt(player.time);
        [...$('chips').children].forEach((c, i) => c.setAttribute('aria-current', i === si ? 'true' : 'false'));
        const s = tl.scenes[si];
        if (s) {
            const local = player.time - s.start;
            const shot = s.shots.filter(x => x.start <= local).pop();
            $('cornerScene').textContent = `Scene ${si + 1} · ${shot ? shot.moveName : 'establish'}`;
        }
        $('btnPlay').textContent = player.playing ? '❚❚' : '▶';
        $('btnPlay').setAttribute('aria-label', player.playing ? 'Pause' : 'Play');
    }
    player.on('time', updateTransport).on('play', updateTransport).on('pause', updateTransport);
    player.on('warn', () => refreshWarnings());

    /* scrubbing */
    (function scrubber() {
        const el = $('scrub');
        let dragging = false, wasPlaying = false;
        const seekAt = e => {
            const r = el.getBoundingClientRect();
            player.seek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * player.duration);
        };
        el.addEventListener('pointerdown', e => { dragging = true; wasPlaying = player.playing; player.pause(); el.setPointerCapture(e.pointerId); seekAt(e); });
        el.addEventListener('pointermove', e => { if (dragging) seekAt(e); });
        el.addEventListener('pointerup', () => { dragging = false; if (wasPlaying) player.play(); });
        el.addEventListener('keydown', e => {
            if (e.key === 'ArrowLeft') { player.step(e.shiftKey ? -player.fps : -1); e.preventDefault(); e.stopPropagation(); }
            if (e.key === 'ArrowRight') { player.step(e.shiftKey ? player.fps : 1); e.preventDefault(); e.stopPropagation(); }
        });
    })();

    /* ─── transport buttons + keys ─── */
    $('btnPlay').addEventListener('click', () => player.toggle());
    $('btnStepBack').addEventListener('click', () => player.step(-1));
    $('btnStepFwd').addEventListener('click', () => player.step(1));
    const sceneJump = d => { const i = player.sceneIndexAt(player.time); player.seekScene(Math.max(0, Math.min(player.timeline.scenes.length - 1, i + d))); };
    $('btnPrevScene').addEventListener('click', () => sceneJump(-1));
    $('btnNextScene').addEventListener('click', () => sceneJump(1));
    $('loopToggle').addEventListener('change', e => player.setLoop(e.target.checked));
    $('speedSelect').addEventListener('change', e => player.setSpeed(+e.target.value));
    $('safeToggle').addEventListener('change', e => { $('safeArea').hidden = !e.target.checked; });
    $('qualitySelect').addEventListener('change', () => state.content != null && render(state.content, { keepTime: true }));
    $('themeSelect').addEventListener('change', () => state.content != null && render(state.content, { keepTime: true }));

    /* ─── Mobile / Tablet Adaptive View Switcher & Drawer ─── */
    const appRoot = $('appRoot');
    const viewSwitch = $('viewSwitch');
    const btnToggleSide = $('btnToggleSide');

    function setViewMode(mode) {
        if (!appRoot) return;
        appRoot.dataset.view = mode;
        document.querySelectorAll('.view-pill').forEach(pill => {
            pill.classList.toggle('active', pill.dataset.view === mode);
        });
        if (mode === 'preview' || mode === 'split') {
            setTimeout(() => { if (player) player.render(); }, 60);
        }
    }

    if (viewSwitch) {
        viewSwitch.addEventListener('click', e => {
            const pill = e.target.closest('.view-pill');
            if (pill && pill.dataset.view) setViewMode(pill.dataset.view);
        });
    }

    if (btnToggleSide) {
        btnToggleSide.addEventListener('click', () => {
            if (window.innerWidth <= 1023) {
                const cur = appRoot.dataset.view || 'preview';
                setViewMode(cur === 'controls' ? 'preview' : 'controls');
            } else {
                appRoot.classList.toggle('sidebar-collapsed');
                setTimeout(() => { if (player) player.render(); }, 220);
            }
        });
    }

    // Default view mode on mobile/tablet screens
    if (window.innerWidth <= 1023 && appRoot) {
        setViewMode('preview');
    }

    // Mobile Keyboard Toolbar handlers
    const btnKbDone = $('btnKbDone');
    const btnKbFormat = $('btnKbFormat');
    const btnKbRender = $('btnKbRender');
    const contentEditor = $('contentEditor');

    if (btnKbDone && contentEditor) {
        btnKbDone.addEventListener('click', () => {
            contentEditor.blur();
            if (window.innerWidth <= 1023 && appRoot.dataset.view === 'controls') {
                setViewMode('preview');
            }
        });
    }
    if (btnKbFormat) btnKbFormat.addEventListener('click', () => $('btnFormat').click());
    if (btnKbRender) btnKbRender.addEventListener('click', () => {
        $('btnApply').click();
        if (window.innerWidth <= 1023) setViewMode('preview');
    });

    // Theater button in transport
    const btnTheater = $('btnTheater');
    if (btnTheater) {
        btnTheater.addEventListener('click', () => {
            if (window.KStudio && window.KStudio.gestures) {
                window.KStudio.gestures.toggleFullscreen();
            } else {
                document.body.classList.toggle('theater-mode');
            }
        });
    }

    document.addEventListener('keydown', e => {
        const tag = (e.target.tagName || '').toLowerCase();
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); applyEditor(); return; }
        if (tag === 'textarea' || tag === 'input' || tag === 'select') return;
        if (e.code === 'Space') { e.preventDefault(); player.toggle(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); player.step(e.shiftKey ? -player.fps : -1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); player.step(e.shiftKey ? player.fps : 1); }
        else if (e.key === 'Home') player.seek(0);
        else if (e.key === 'End') player.seek(player.duration);
        else if (e.key === '[') sceneJump(-1);
        else if (e.key === ']') sceneJump(1);
        else if (e.key.toLowerCase() === 'l') { $('loopToggle').checked = !$('loopToggle').checked; player.setLoop($('loopToggle').checked); }
    });

    /* ─── tabs ─── */
    document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', t === tab ? 'true' : 'false'));
        document.querySelectorAll('.pane').forEach(p => { p.hidden = p.id !== tab.getAttribute('aria-controls'); });
    }));

    /* ─── content actions ─── */
    $('btnApply').addEventListener('click', () => applyEditor());
    $('btnFormat').addEventListener('click', () => {
        try { const v = parseEditor(); if (typeof v !== 'string') $('contentEditor').value = JSON.stringify(v, null, 2); } catch (e) { setStatus(e.message, 'err'); }
    });
    $('btnConvert').addEventListener('click', () => {
        try {
            const native = E.normalizeContent(parseEditor(), state.presets);
            native.scenes.forEach(s => { delete s.legacy; });
            delete native._format;
            $('contentEditor').value = JSON.stringify(native, null, 2);
            setStatus('Converted to native scenes — edit beats, tags and presets freely, then Render.', 'ok');
        } catch (e) { setStatus(e.message, 'err'); }
    });
    $('btnSaveContent').addEventListener('click', () => { const K = window.KStudio || {}; const txt = K.beforeSave ? K.beforeSave($('contentEditor').value) : $('contentEditor').value; download(new Blob([txt], { type: 'application/json' }), 'content.json'); });
    $('btnSample').addEventListener('click', async () => {
        const sample = await fetchJSON('content.sample.json', window.KineticSampleContent, 'content.sample.json');
        loadIntoEditor(sample, 'sample');
    });
    $('btnOpenFile').addEventListener('click', () => $('fileInput').click());
    $('fileInput').addEventListener('change', e => { const f = e.target.files[0]; if (f) readFile(f); e.target.value = ''; });

    function readFile(file) {
        const r = new FileReader();
        r.onload = () => {
            const txt = String(r.result);
            let content = txt;
            if (/\.json$/i.test(file.name)) { try { content = JSON.parse(txt); } catch (err) { setStatus('JSON error in ' + file.name + ': ' + err.message, 'err'); return; } }
            loadIntoEditor(content, file.name);
        };
        r.readAsText(file);
    }
    const stage = $('stage');
    stage.addEventListener('dragover', e => { e.preventDefault(); $('dropzone').hidden = false; });
    stage.addEventListener('dragleave', () => { $('dropzone').hidden = true; });
    stage.addEventListener('drop', e => { e.preventDefault(); $('dropzone').hidden = true; const f = e.dataTransfer.files[0]; if (f) readFile(f); });

    /* ─── preset browser ─── */
    const CATS = ['recipes', 'entry', 'emphasis', 'exit', 'loop', 'camera', 'staging', 'layouts', 'supplements', 'transitions', 'backgrounds', 'typeStyles', 'tagAliases', 'easings', 'themes', 'icons'];
    const USAGE = {
        entry: n => `"entry": "${n}"  or  [text](in:${n})`,
        emphasis: n => `"emphasis": "${n}"  or  [text](fx:${n})`,
        exit: n => `"exit": "${n}"  or  [text](out:${n})`,
        loop: n => `"idle": "${n}"`,
        camera: n => `"cameraMoves": ["${n}"]`,
        staging: n => `"staging": "${n}"`,
        layouts: n => `"layout": "${n}"`,
        supplements: n => `[text](${n})`,
        transitions: n => `"transition": "${n}"`,
        backgrounds: n => `"background": "${n}"`,
        typeStyles: n => `[text](${n})`,
        easings: n => `"ease": "${n}"`,
        themes: n => `"theme": "${n}"`,
        recipes: n => `"recipe": "${n}"`,
        tagAliases: n => `[text](${n})`,
        icons: n => `[text](icon:${n})`
    };
    function tryContent(cat, name) {
        const line = 'Paper [folds](highlight) into | *flight*';
        const beat = { text: line };
        const scene = { beats: [beat], transition: 'paperWipe' };
        if (cat === 'entry') beat.entry = name;
        else if (cat === 'emphasis') beat.emphasis = name;
        else if (cat === 'exit') { beat.exit = name; scene.beats.push('And again.'); }
        else if (cat === 'loop') beat.idle = name;
        else if (cat === 'camera') scene.camera = { moves: [name] };
        else if (cat === 'staging') { scene.staging = name; scene.beats.push('Three | more | angles | here.'); }
        else if (cat === 'layouts') beat.layout = name;
        else if (cat === 'supplements') beat.text = `Paper [folds](${name}) into flight`;
        else if (cat === 'typeStyles') beat.text = `Paper [folds](${name}) into flight`;
        else if (cat === 'icons') beat.text = `Paper [folds](icon:${name}) into flight`;
        else if (cat === 'backgrounds') scene.background = name;
        else if (cat === 'transitions') { scene.transition = name; return { theme: $('themeSelect').value || undefined, scenes: [scene, { beats: ['Next scene arrives.'] }] }; }
        else if (cat === 'themes') return { theme: name, scenes: [scene] };
        else if (cat === 'recipes') { beat.recipe = name; beat.text = 'Paper [folds](highlight) into flight'; }
        else if (cat === 'tagAliases') beat.text = `Paper [folds](${name}) into flight`;
        return { theme: $('themeSelect').value || undefined, scenes: [scene, { beats: ['Next scene.'] }] };
    }
    let presetBrowserBound = false;
    function buildPresetBrowser() {
        const sel = $('presetCat');
        const keep = sel.value;
        sel.innerHTML = CATS.filter(c => state.presets[c]).map(c => `<option value="${c}">${c}</option>`).join('');
        if (keep && state.presets[keep]) sel.value = keep;
        const draw = () => {
            const cat = sel.value, q = $('presetFilter').value.toLowerCase();
            const lib = state.presets[cat] || {};
            const list = $('presetList');
            list.innerHTML = '';
            Object.keys(lib).filter(k => k[0] !== '_' && (!q || k.toLowerCase().includes(q) || String((lib[k] || {}).intent || '').toLowerCase().includes(q))).forEach(name => {
                const p = lib[name];
                const div = document.createElement('div');
                div.className = 'preset';
                const intent = typeof p === 'object' && p ? (p.intent || '') : (cat === 'icons' ? 'Icon path' : cat === 'tagAliases' ? '→ ' + p : '');
                div.innerHTML = `<b></b><span class="acts"></span><p></p>`;
                div.querySelector('b').textContent = name;
                div.querySelector('p').textContent = intent;
                const acts = div.querySelector('.acts');
                if (cat !== 'easings') {
                    const t = document.createElement('button'); t.className = 'btn'; t.textContent = 'Try';
                    t.addEventListener('click', () => { loadIntoEditor(tryContent(cat, name), 'preview of ' + name).then(() => player.play()); });
                    acts.appendChild(t);
                }
                const c = document.createElement('button'); c.className = 'btn'; c.textContent = 'Copy';
                c.addEventListener('click', () => copy(USAGE[cat] ? USAGE[cat](name) : name, c));
                acts.appendChild(c);
                list.appendChild(div);
            });
        };
        if (!presetBrowserBound) {
            sel.addEventListener('change', () => buildPresetBrowser.draw());
            $('presetFilter').addEventListener('input', () => buildPresetBrowser.draw());
            presetBrowserBound = true;
        }
        buildPresetBrowser.draw = draw;
        draw();
    }

    /* ─── preset packs: extra preset files merged over presets.motion.json ─── */
    const packStore = {
        get() { try { return JSON.parse(localStorage.getItem('kinetic:packs') || '[]'); } catch (e) { return []; } },
        set(v) { try { localStorage.setItem('kinetic:packs', JSON.stringify(v)); } catch (e) { setStatus('Pack kept for this session only (browser storage full or blocked).', 'err'); } }
    };
    function applyPacks(rerender) {
        const packs = [].concat(window.KineticPresetPacks || [], packStore.get());
        state.presets = packs.length ? E.mergePresets(state.basePresets, packs) : state.basePresets;
        const cur = $('themeSelect').value;
        $('themeSelect').innerHTML = '<option value="">From content</option>';
        Object.keys(state.presets.themes || {}).forEach(k => { const o = document.createElement('option'); o.value = k; o.textContent = k; $('themeSelect').appendChild(o); });
        $('themeSelect').value = cur;
        buildPresetBrowser();
        renderPackList();
        checkPresets(false);
        if (rerender && state.content != null) render(state.content, { keepTime: true });
    }
    function renderPackList() {
        const list = $('packList');
        list.innerHTML = '';
        const auto = [].concat(window.KineticPresetPacks || []);
        const stored = packStore.get();
        auto.forEach(pk => { const d = document.createElement('div'); d.textContent = `📦 ${(pk.pack && pk.pack.name) || 'pack'} ${(pk.pack && pk.pack.version) || ''} · from presets/ folder`; list.appendChild(d); });
        stored.forEach((pk, i) => {
            const d = document.createElement('div');
            d.textContent = `📦 ${(pk.pack && pk.pack.name) || 'pack ' + (i + 1)} ${(pk.pack && pk.pack.version) || ''} `;
            const x = document.createElement('button'); x.className = 'btn'; x.textContent = 'Remove'; x.style.cssText = 'font-size:11px;padding:0 6px;margin-left:6px';
            x.addEventListener('click', () => { const v = packStore.get(); v.splice(i, 1); packStore.set(v); applyPacks(true); });
            d.appendChild(x);
            list.appendChild(d);
        });
        if (!auto.length && !stored.length) list.innerHTML = '<div>No packs loaded — using presets.motion.json only.</div>';
    }
    function checkPresets(show) {
        const issues = E.validatePresets(state.presets);
        state.presetIssues = issues;
        const errs = issues.filter(i => i.level === 'error').length, warns = issues.length - errs;
        $('packStatus').textContent = errs || warns ? `Preset check: ${errs} error${errs === 1 ? '' : 's'}, ${warns} warning${warns === 1 ? '' : 's'} — details in the Warnings tab.` : 'Preset check: all presets valid.';
        $('packStatus').className = 'status ' + (errs ? 'err' : 'ok');
        refreshWarnings();
        if (show && issues.length) document.getElementById('tab-warnings').click();
    }
    $('btnPackLoad').addEventListener('click', () => $('packInput').click());
    $('packInput').addEventListener('change', async e => {
        const stored = packStore.get();
        for (const f of Array.from(e.target.files)) {
            try {
                let txt = await f.text();
                if (/\.js$/i.test(f.name) && /KineticEngine\.(register\w+|hooks)/.test(txt)) {
                    // a JS plug-in (new supplement kinds, transitions, background layers, blocks): run it for this session
                    await new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = URL.createObjectURL(new Blob([txt], { type: 'text/javascript' })); sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); });
                    setStatus(`${f.name}: plug-in loaded for this session — add <script src="presets/${f.name}"> after engine.js in index.html to keep it.`, 'ok');
                    continue;
                }
                if (/\.js$/i.test(f.name)) txt = txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1);
                const pk = JSON.parse(txt);
                pk.pack = Object.assign({ name: f.name.replace(/\.(json|js)$/i, '') }, pk.pack || {});
                const test = E.validatePresets(E.mergePresets(state.basePresets, [].concat(window.KineticPresetPacks || [], stored, [pk])));
                const errs = test.filter(i => i.level === 'error');
                if (errs.length) setStatus(`${f.name}: loaded with ${errs.length} error(s) — see Warnings. First: ${errs[0].path} ${errs[0].msg}`, 'err');
                else setStatus(`${f.name}: pack loaded (${test.length} warning${test.length === 1 ? '' : 's'}).`, 'ok');
                stored.push(pk);
            } catch (err) { setStatus(`${f.name}: not valid JSON — ${err.message}`, 'err'); }
        }
        packStore.set(stored);
        e.target.value = '';
        applyPacks(true);
    });
    $('btnPackCheck').addEventListener('click', () => checkPresets(true));
    $('btnPackExport').addEventListener('click', () => {
        const merged = U_clone(state.presets); delete merged._packs;
        download(new Blob([JSON.stringify(merged, null, 2)], { type: 'application/json' }), 'presets.motion.json');
    });
    function U_clone(v) { return JSON.parse(JSON.stringify(v)); }
    function copy(text, btn) {
        const done = () => { const o = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = o; }, 1200); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => window.prompt('Copy:', text));
        else window.prompt('Copy:', text);
    }

    /* ─── warnings ─── */
    function refreshWarnings() {
        const w = E.Log.warnings;
        const pi = state.presetIssues || [];
        $('warnCount').hidden = !(w.length + pi.length);
        $('warnCount').textContent = w.length + pi.length;
        const list = $('warnList');
        list.innerHTML = w.length || pi.length ? '' : '<p class="hint">No warnings — every preset, tag and target resolved.</p>';
        w.forEach(x => { const d = document.createElement('div'); d.className = 'warn-item'; d.textContent = x.msg; list.appendChild(d); });
        pi.forEach(x => { const d = document.createElement('div'); d.className = 'warn-item' + (x.level === 'error' ? ' err' : ''); d.textContent = `Preset ${x.level}: ${x.path} — ${x.msg}`; list.appendChild(d); });
    }

    /* ─── export ─── */
    function download(blob, name) {
        // Direct mobile/tablet save to Photos/Files via Web Share API where supported
        if (navigator.canShare && blob && blob.size > 0 && typeof File !== 'undefined') {
            try {
                const file = new File([blob], name, { type: blob.type || 'video/mp4' });
                if (navigator.canShare({ files: [file] })) {
                    navigator.share({ files: [file], title: name }).catch(e => {
                        if (e.name !== 'AbortError') fallbackDownload(blob, name);
                    });
                    return;
                }
            } catch (err) { /* fallback to standard download */ }
        }
        fallbackDownload(blob, name);
    }
    function fallbackDownload(blob, name) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
    $('exRange').addEventListener('change', e => { $('exCustom').hidden = e.target.value !== 'custom'; });
    $('btnExport').addEventListener('click', async () => {
        if (state.content == null) return;
        const fmt = $('exFormat').value;
        const K = window.KStudio || {};
        const o = { width: +$('exWidth').value, height: +$('exHeight').value, fps: +$('exFps').value, theme: $('themeSelect').value || undefined, beforeCompile: K.hooks ? K.hooks() : [], mixdown: K.mixdown ? K.mixdown() : null };
        const tl = player.timeline;
        if ($('exRange').value === 'scene') { const s = tl.scenes[player.sceneIndexAt(player.time)]; o.from = s.start; o.to = s.end; }
        if ($('exRange').value === 'custom') { o.from = +$('exFrom').value; o.to = +$('exTo').value; }
        const ctrl = new AbortController();
        state.exportAbort = ctrl;
        o.signal = ctrl.signal;
        const t0 = performance.now();
        o.onProgress = (p, f) => { $('exBar').style.width = (p * 100).toFixed(1) + '%'; $('exStatus').textContent = `Rendering frame ${f} · ${(p * 100).toFixed(0)}%`; };
        $('btnExport').disabled = true; $('btnCancelExport').disabled = false;
        player.pause();
        const base = (tl.meta.title || 'kinetic').replace(/[^\p{L}\p{M}\p{N}-]+/gu, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'kinetic';
        try {
            let blob, name;
            if (fmt === 'png-frame') { o.time = player.time; blob = await E.Export.frame(state.content, state.presets, o); name = `${base}_f${player.frame}.png`; }
            else if (fmt === 'png-seq') { blob = await E.Export.pngSequence(state.content, state.presets, o); name = `${base}_png-sequence.zip`; }
            else if (fmt === 'recorded') {
                blob = await E.Export.recorded(state.content, state.presets, o);
                const ext = (blob.type && blob.type.includes('mp4')) ? 'mp4' : 'webm';
                name = `${base}.${ext}`;
            }
            else {
                // If WebCodecs VideoEncoder is unsupported on this browser (e.g. iOS Safari), fallback gracefully to MediaRecorder
                if (typeof VideoEncoder === 'undefined') {
                    $('exStatus').textContent = 'WebCodecs not supported in this browser. Recording real-time capture...';
                    blob = await E.Export.recorded(state.content, state.presets, o);
                    const ext = (blob.type && blob.type.includes('mp4')) ? 'mp4' : 'webm';
                    name = `${base}.${ext}`;
                } else {
                    o.format = fmt;
                    blob = await E.Export.encoded(state.content, state.presets, o);
                    name = `${base}.${fmt}`;
                }
            }
            download(blob, name);
            $('exStatus').textContent = `Saved ${name} · ${(blob.size / 1048576).toFixed(1)} MB in ${((performance.now() - t0) / 1000).toFixed(1)} s`;
        } catch (e) {
            $('exStatus').textContent = e.message;
            console.error(e);
        } finally {
            $('btnExport').disabled = false; $('btnCancelExport').disabled = true; state.exportAbort = null;
        }
    });
    $('btnCancelExport').addEventListener('click', () => state.exportAbort && state.exportAbort.abort());

    /* ─── hand-off from the Annotation Studio bridge ─── */
    window.addEventListener('message', e => {
        const d = e.data;
        if (d && d.type === 'kinetic:load' && d.content) { loadIntoEditor(d.content, 'from Annotation Studio'); if (e.source) e.source.postMessage({ type: 'kinetic:loaded' }, '*'); }
    });

    /* ─── API for studio-smart.js ─── */
    window.KStudio = Object.assign(window.KStudio || {}, {
        player, state, render, parseEditor, setStatus, loadIntoEditor, applyEditor, download, fetchJSON,
        rerender: () => state.content != null && render(state.content, { keepTime: true })
    });

    /* ─── boot ─── */
    (async function boot() {
        // wait until every plug-in script (studio-smart.js etc.) has run
        if (document.readyState === 'loading') await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
        $('engineVersion').textContent = 'engine v' + E.VERSION;
        try {
            state.basePresets = await fetchJSON('presets.motion.json', window.KineticPresets, 'presets.motion.json');
            state.presets = state.basePresets;
        } catch (e) { setStatus(e.message, 'err'); return; }
        applyPacks(false);
        if (window.opener) { try { window.opener.postMessage({ type: 'kinetic:ready' }, '*'); } catch (e) { /* opener gone */ } }
        if (window.KStudio.boot) await window.KStudio.boot();
        const sample = await fetchJSON('content.sample.json', window.KineticSampleContent, 'content.sample.json').catch(() => 'Paste your content here.');
        await loadIntoEditor(sample, 'sample');
        player.play();
    })();
})();
