/* Kinetic Studio — smart tabs (Auto-Director, Media, Maps, Voice) wired to the plug-ins.
 * Loaded after studio.js; extends window.KStudio with hooks the player and exporter call. */
(function () {
    'use strict';
    const K = window.KStudio;
    const E = window.KineticEngine, Geo = window.KineticGeo, Media = window.KineticMedia, Dir = window.KineticDirector, Voice = window.KineticVoice;
    const $ = id => document.getElementById(id);
    const store = {
        get(k, d) { try { const v = localStorage.getItem('kinetic:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
        set(k, v) { try { localStorage.setItem('kinetic:' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
    };
    const S = {
        autoOn: store.get('autoOn', true),
        auto: store.get('auto', null),
        voiceOn: store.get('voiceOn', false),
        voiceAuto: store.get('voiceAuto', false),
        music: { asset: '', volume: 0.2 },
        lastReport: null
    };

    /* ─── hooks consumed by studio.js (preview + export) ─── */
    Object.assign(K, {
        hooks() {
            const list = [Media.hook];
            if (S.autoOn) list.push(async (content, presets) => {
                if (content && content.meta && content.meta.auto === false) return content;
                const r = await Dir.direct(content, presets, S.auto || {});
                S.lastReport = r;
                return r.content;
            });
            if (S.voiceOn) list.push((content, presets) => {
                const paid = Voice.settings.provider !== 'webspeech' && Voice.settings.provider !== 'upload';
                const c = S.music.asset ? Object.assign({}, typeof content === 'object' ? content : { text: content }) : content;
                if (S.music.asset && typeof c === 'object') c.meta = Object.assign({}, c.meta, { music: { asset: S.music.asset, volume: S.music.volume } });
                return Voice.prepare(c, presets, { settings: Object.assign({}, Voice.settings), cachedOnly: paid && !S.voiceAuto && !S.forceGenerate, onProgress: voiceProgress });
            });
            return list;
        },
        audioFor() { return S.voiceOn ? Voice.audioFor : null; },
        mixdown() { return S.voiceOn && $('exAudio').checked ? Voice.mixdown : null; },
        afterRender() { showReport(); refreshMissing(); },
        beforeSave(txt) {
            if (!$('embedAssets').checked) return txt;
            try {
                const c = JSON.parse(txt);
                if (!c || typeof c !== 'object' || Array.isArray(c)) return txt;
                c.assets = Media.exportEmbedded();
                return JSON.stringify(c, null, 2);
            } catch (e) { return txt; }
        },
        boot
    });

    /* ─── Auto tab ─── */
    const SWITCHES = [['maps', 'Maps for places'], ['charts', 'Charts from numbers'], ['numbers', 'Counters & % rings'], ['media', 'Pictures from library'], ['placeholders', 'Placeholders for pictures'], ['emoji', 'Emoji stickers'], ['emphasis', 'Key-word emphasis'], ['recipes', 'Sentence recipes']];
    function buildAuto() {
        const defs = Object.assign({}, Dir.DEFAULTS, (K.state.presets.auto && K.state.presets.auto.defaults) || {}, S.auto || {});
        S.auto = defs;
        $('autoOn').checked = S.autoOn;
        $('autoSwitches').innerHTML = SWITCHES.map(([k, label]) => `<label>${label}<select id="auto_${k}"><option value="smart">Smart</option><option value="on">On</option><option value="off">Off</option></select></label>`).join('')
            + `<label>Map labels<select id="auto_mapLabels"><option value="auto">Auto</option><option value="en">English</option><option value="hi">हिन्दी</option></select></label>`;
        [...SWITCHES.map(x => x[0]), 'mapLabels'].forEach(k => {
            const el = $('auto_' + k);
            el.value = defs[k] || 'smart';
            el.addEventListener('change', () => { S.auto[k] = el.value; store.set('auto', S.auto); K.rerender(); });
        });
        $('autoOn').addEventListener('change', e => { S.autoOn = e.target.checked; store.set('autoOn', S.autoOn); K.rerender(); });
        $('btnBake').addEventListener('click', async () => {
            try {
                const r = await Dir.direct(K.parseEditor(), K.state.presets, S.auto);
                r.content.meta = Object.assign({}, r.content.meta, { auto: false });
                r.content.scenes.forEach(sc => { delete sc.legacy; sc.beats.forEach(b => { if (typeof b === 'object') delete b._auto; }); });
                $('contentEditor').value = JSON.stringify(r.content, null, 2);
                K.setStatus('Baked: the Auto-Director\'s choices are now plain tags you can edit. Auto is paused for this file (meta.auto = false).', 'ok');
                K.applyEditor();
            } catch (e) { K.setStatus(e.message, 'err'); }
        });
        $('btnAIPrompt').addEventListener('click', e => copy(aiPrompt(), e.target));
    }
    function showReport() {
        const r = S.lastReport;
        $('autoReport').textContent = S.autoOn ? (r ? Dir.summarize(r.report) : '—') : 'Auto-Director is off.';
        const notes = $('autoNotes');
        notes.innerHTML = '';
        if (!r || !S.autoOn) return;
        r.content.scenes.forEach((sc, i) => sc.beats.forEach(b => {
            if (b && b._auto) { const d = document.createElement('div'); d.textContent = `Scene ${i + 1}: ${b._auto.join(' · ')}`; notes.appendChild(d); }
        }));
    }

    /* ─── Media tab ─── */
    function buildMedia() {
        const drop = $('assetDrop');
        drop.addEventListener('click', () => $('assetInput').click());
        drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('assetInput').click(); } });
        drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
        drop.addEventListener('dragleave', () => drop.classList.remove('over'));
        drop.addEventListener('drop', async e => { e.preventDefault(); drop.classList.remove('over'); await Media.addFiles(e.dataTransfer.files); K.rerender(); });
        $('assetInput').addEventListener('change', async e => { await Media.addFiles(e.target.files); e.target.value = ''; K.rerender(); });
        Media.onChange(() => { renderAssets(); refreshMissing(); refreshMusic(); });
        renderAssets();
    }
    function renderAssets() {
        const grid = $('assetGrid');
        grid.innerHTML = '';
        Media.list().forEach(a => {
            const d = document.createElement('div');
            d.className = 'asset';
            const thumb = document.createElement('div');
            thumb.className = 'thumb';
            if (a.type === 'audio') thumb.textContent = '🎵';
            else thumb.style.backgroundImage = `url("${a.svgText ? 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(a.svgText))) : a.src}")`;
            const name = document.createElement('input');
            name.value = a.name; name.setAttribute('aria-label', 'Asset name');
            name.addEventListener('change', () => { Media.remove(a.name); Media.add(Object.assign({}, a, { name: name.value, _loaded: false })).then(K.rerender); });
            const kw = document.createElement('input');
            kw.value = Array.from(a._kw || []).filter(k => k !== a.name).join(', '); kw.placeholder = 'keywords'; kw.setAttribute('aria-label', 'Keywords');
            kw.addEventListener('change', () => { Media.remove(a.name); Media.add(Object.assign({}, a, { keywords: kw.value.split(',').map(x => x.trim()).filter(Boolean), _loaded: false })).then(K.rerender); });
            const meta = document.createElement('div');
            meta.className = 'meta';
            meta.innerHTML = `<span>${a.type}${a.model ? ` · ${a.model.parts.length} parts · ${a.model.auto}` : ''}</span>`;
            const del = document.createElement('button');
            del.className = 'btn'; del.textContent = '✕'; del.title = 'Remove';
            del.addEventListener('click', () => { Media.remove(a.name); K.rerender(); });
            meta.appendChild(del);
            d.append(thumb, name, kw, meta);
            grid.appendChild(d);
        });
    }
    function refreshMissing() {
        const list = $('missingList');
        const miss = Media.missing();
        $('missingCount').hidden = !miss.length;
        $('missingCount').textContent = miss.length;
        list.innerHTML = '';
        miss.forEach(m => {
            const row = document.createElement('div');
            row.className = 'missing';
            row.innerHTML = `<span>🖼️</span><b></b>`;
            row.querySelector('b').textContent = `Needs a picture: "${m.query}"`;
            const btn = document.createElement('button');
            btn.className = 'btn'; btn.textContent = 'Choose…';
            const inp = document.createElement('input');
            inp.type = 'file'; inp.accept = 'image/*,.svg'; inp.hidden = true;
            const assign = async f => { await Media.add({ file: f, name: m.query, keywords: [m.query] }); K.rerender(); };
            inp.addEventListener('change', () => inp.files[0] && assign(inp.files[0]));
            btn.addEventListener('click', () => inp.click());
            row.addEventListener('dragover', e => e.preventDefault());
            row.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files[0]) assign(e.dataTransfer.files[0]); });
            row.append(btn, inp);
            list.appendChild(row);
        });
    }

    /* ─── Maps tab ─── */
    function buildMaps() {
        const geo = K.state.presets.geo || {};
        $('mapStyle').innerHTML = Object.keys(geo.styles || {}).map(k => `<option value="${k}">${k}</option>`).join('');
        $('mapStyle').value = geo.defaultStyle || 'paper';
        $('mapStyle').addEventListener('change', e => { K.state.presets.geo.defaultStyle = e.target.value; K.rerender(); });
        $('mapProj').addEventListener('change', e => { Object.values(K.state.presets.geo.styles).forEach(s => { s.projection = e.target.value; }); K.rerender(); });
        $('mapLang').addEventListener('change', e => { S.auto.mapLabels = e.target.value; store.set('auto', S.auto); K.rerender(); });

        // World Map Variant (Survey of India official vs International Standard)
        if ($('mapWorldVariant')) {
            $('mapWorldVariant').value = (Geo.getWorldVariant && Geo.getWorldVariant()) || 'india';
            $('mapWorldVariant').addEventListener('change', e => {
                if (Geo.setWorldVariant) Geo.setWorldVariant(e.target.value);
                K.rerender();
                note('geoList', 'Map boundary updated: ' + (e.target.value === 'india' ? '🇮🇳 Survey of India Official' : '🌐 International Standard'));
            });
        }

        // Indian State / UT quick selector
        if ($('indiaStateSelect')) {
            const states = (Geo.getIndiaStates && Geo.getIndiaStates()) || [];
            $('indiaStateSelect').innerHTML = '<option value="">Select State or UT…</option>' +
                states.map(s => `<option value="${s.id}">${s.name} (${s.name_hi || ''})</option>`).join('');

            $('indiaStateSelect').addEventListener('change', e => {
                const id = e.target.value;
                if (!id) return;
                const s = states.find(x => x.id === id);
                if (s) {
                    $('placeResult').className = 'status ok';
                    $('placeResult').textContent = `State: ${s.name} (${s.name_hi || ''}) · ID: ${s.id} · Aliases: ${s.aliases.join(', ')}`;
                }
            });
        }

        // Focus State in current scene
        if ($('btnFocusState')) {
            $('btnFocusState').addEventListener('click', () => {
                const val = $('indiaStateSelect') && $('indiaStateSelect').value;
                if (!val) { note('geoList', 'Select a state or UT from the dropdown first.', true); return; }
                const states = (Geo.getIndiaStates && Geo.getIndiaStates()) || [];
                const s = states.find(x => x.id === val);
                const cur = K.parseEditor();
                if (cur && Array.isArray(cur.scenes) && cur.scenes.length) {
                    const sc = cur.scenes[K.player.sceneIndexAt(K.player.time)] || cur.scenes[0];
                    if (Array.isArray(sc.beats) && sc.beats.length) {
                        const b = sc.beats[0];
                        const vis = { type: 'map', focus: val, title: s ? s.name : val, style: $('mapStyle').value || 'paper', regions: [val] };
                        if (typeof b === 'object') {
                            b.visual = vis;
                        } else {
                            sc.beats[0] = { text: String(b), visual: vis };
                        }
                        $('contentEditor').value = JSON.stringify(cur, null, 2);
                        K.applyEditor();
                        note('geoList', `Focused active scene on ${s ? s.name : val}.`);
                    }
                }
            });
        }

        // Insert State as a new scene
        if ($('btnInsertStateScene')) {
            $('btnInsertStateScene').addEventListener('click', () => {
                const val = $('indiaStateSelect') && $('indiaStateSelect').value;
                if (!val) { note('geoList', 'Select a state or UT from the dropdown first.', true); return; }
                const states = (Geo.getIndiaStates && Geo.getIndiaStates()) || [];
                const s = states.find(x => x.id === val);
                const cur = K.parseEditor();
                if (cur && Array.isArray(cur.scenes)) {
                    cur.scenes.push({
                        id: (s ? s.name.toLowerCase().replace(/\s+/g, '-') : val) + '-highlight',
                        transition: 'panRight',
                        beats: [
                            {
                                text: `Welcome to [${s ? s.name : val}](highlight)${s && s.name_hi ? ' · ' + s.name_hi : ''}`,
                                visual: {
                                    type: 'map',
                                    focus: val,
                                    title: s ? s.name : val,
                                    style: $('mapStyle').value || 'paper',
                                    regions: [val]
                                }
                            }
                        ]
                    });
                    $('contentEditor').value = JSON.stringify(cur, null, 2);
                    K.applyEditor();
                    note('geoList', `Inserted new scene for ${s ? s.name : val}.`);
                }
            });
        }

        // Copy State JSON snippet
        if ($('btnCopyStateJson')) {
            $('btnCopyStateJson').addEventListener('click', () => {
                const val = $('indiaStateSelect') && $('indiaStateSelect').value;
                if (!val) { note('geoList', 'Select a state or UT first.', true); return; }
                const states = (Geo.getIndiaStates && Geo.getIndiaStates()) || [];
                const s = states.find(x => x.id === val);
                const snippet = JSON.stringify({
                    type: 'map',
                    focus: val,
                    title: s ? s.name : val,
                    style: $('mapStyle').value || 'paper',
                    regions: [val]
                }, null, 2);
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(snippet);
                    note('geoList', `Copied JSON snippet for ${s ? s.name : val} to clipboard!`);
                } else {
                    prompt('Copy map visual JSON:', snippet);
                }
            });
        }

        const findIt = async () => {
            await Geo.ready();
            const h = Geo.find($('placeQuery').value);
            if (!h) { $('placeResult').textContent = 'Not found. Add it below as "name, lat, lon".'; $('placeResult').className = 'status err'; return; }
            const name = h.name_hi ? `${h.name} / ${h.name_hi}` : (h.names && h.names.hi ? `${h.name} / ${h.names.hi[0]}` : h.name);
            $('placeResult').className = 'status ok';
            $('placeResult').textContent = `${h.type}: ${name} · ${(+h.lat).toFixed(3)}, ${(+h.lon).toFixed(3)}${h.country ? ' · ' + h.country : ''}${h.population ? ' · pop ' + h.population.toLocaleString('en-IN') : ''}  →  use [${$('placeQuery').value}](map)`;
        };
        $('btnFindPlace').addEventListener('click', findIt);
        $('placeQuery').addEventListener('keydown', e => { if (e.key === 'Enter') findIt(); });
        $('btnGeoUpload').addEventListener('click', () => $('geoInput').click());
        $('geoInput').addEventListener('change', async e => {
            const f = e.target.files[0]; if (!f) return;
            try {
                await Geo.ready();
                const name = $('geoName').value.trim() || f.name.replace(/\.(geo|topo)?json$/i, '');
                const res = Geo.addGeoJSON(name, await f.text());
                const count = typeof res === 'object' ? res.count : res;
                const info = (res && res.isIndia) ? ' (🇮🇳 India State/Region detected)' : (res && res.isWorld) ? ' (🌐 Replaces world map)' : ` (use "region": "${name}" in a map visual)`;
                note('geoList', `Loaded "${name}": ${count} shapes${info}.`);
                K.rerender();
            } catch (err) { note('geoList', 'GeoJSON/TopoJSON error: ' + err.message, true); }
            e.target.value = '';
        });
        $('btnAddPlaces').addEventListener('click', async () => {
            await Geo.ready();
            const n = Geo.addPlaces($('placesCsv').value);
            note('geoList', `Added ${n} place${n === 1 ? '' : 's'}. They are detected in text like any city.`);
            K.rerender();
        });
        $('btnLoadRegion').addEventListener('click', async () => {
            const name = $('geoName').value.trim();
            if (!name) { note('geoList', 'Type an amCharts map name first, e.g. usaLow, chinaLow, nepalLow, worldIndiaLow.', true); return; }
            await Geo.ready();
            const g = await Geo.loadRegion(name);
            note('geoList', g ? `Loaded ${name} (${g.features.length} regions).` : `Could not load ${name} (needs internet or geo/regions/${name}.json).`, !g);
            if (g) K.rerender();
        });
    }
    function note(id, text, err) { const d = document.createElement('div'); d.textContent = text; if (err) d.className = 'err'; $(id).prepend(d); }

    /* ─── Voice tab ─── */
    function buildVoice() {
        const vs = Voice.settings;
        Object.assign(vs, store.get('voice', {}));
        const key = store.get('voiceKey:' + vs.provider, '');
        if (key) vs.apiKey = key;
        $('voiceProvider').innerHTML = Object.entries(Voice.providers).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join('');
        $('voiceProvider').value = vs.provider;
        $('voiceOn').checked = S.voiceOn;
        $('voiceAuto').checked = S.voiceAuto;
        $('voiceLang').value = vs.lang || 'auto';
        $('voiceModel').value = vs.model || '';
        $('voiceRate').value = vs.rate || 1;
        $('voiceKey').value = vs.apiKey || '';
        $('voiceRemember').checked = !!key;
        $('voiceUrl').value = vs.provider === 'custom' ? vs.customUrl : vs.baseUrl;
        const save = () => { const { apiKey, ...rest } = vs; store.set('voice', rest); if ($('voiceRemember').checked) store.set('voiceKey:' + vs.provider, vs.apiKey); };
        const syncRows = () => {
            const p = Voice.providers[vs.provider];
            $('voiceKeyRow').hidden = !p.needsKey && vs.provider !== 'custom';
            $('voiceRememberRow').hidden = $('voiceKeyRow').hidden;
            $('voiceUrlRow').hidden = !(vs.provider === 'openai' || vs.provider === 'custom');
            $('voiceModel').placeholder = vs.provider === 'elevenlabs' ? 'eleven_multilingual_v2' : vs.provider === 'openai' ? 'gpt-4o-mini-tts' : '';
        };
        syncRows();
        $('voiceProvider').addEventListener('change', e => { vs.provider = e.target.value; vs.apiKey = store.get('voiceKey:' + vs.provider, ''); $('voiceKey').value = vs.apiKey; vs.voiceId = ''; $('voiceId').innerHTML = '<option value="">Load voices first</option>'; syncRows(); save(); });
        $('voiceLang').addEventListener('change', e => { vs.lang = e.target.value; save(); });
        $('voiceModel').addEventListener('change', e => { vs.model = e.target.value.trim(); save(); });
        $('voiceRate').addEventListener('change', e => { vs.rate = +e.target.value || 1; save(); });
        $('voiceKey').addEventListener('change', e => { vs.apiKey = e.target.value.trim(); save(); });
        $('voiceRemember').addEventListener('change', e => { if (!e.target.checked) store.set('voiceKey:' + vs.provider, ''); save(); });
        $('voiceUrl').addEventListener('change', e => { if (vs.provider === 'custom') vs.customUrl = e.target.value.trim(); else vs.baseUrl = e.target.value.trim(); save(); });
        $('voiceId').addEventListener('change', e => { vs.voiceId = e.target.value; save(); });
        let voices = [];
        const fillVoices = () => {
            const g = $('voiceGender').value;
            const list = voices.filter(v => !g || (v.gender || '').toLowerCase() === g);
            $('voiceId').innerHTML = list.map(v => `<option value="${v.id}">${v.name}${v.gender ? ' · ' + v.gender : ''}${v.lang ? ' · ' + v.lang : v.accent ? ' · ' + v.accent : ''}</option>`).join('') || '<option value="">No voices</option>';
            if (vs.voiceId && list.find(v => v.id === vs.voiceId)) $('voiceId').value = vs.voiceId; else { vs.voiceId = $('voiceId').value; save(); }
        };
        $('voiceGender').addEventListener('change', fillVoices);
        $('btnVoices').addEventListener('click', async () => {
            try { voices = await Voice.listVoices(vs); if (vs.lang && vs.lang !== 'auto' && vs.provider === 'webspeech') voices.sort((a, b) => (b.lang || '').startsWith(vs.lang) - (a.lang || '').startsWith(vs.lang)); fillVoices(); vstatus(`${voices.length} voices loaded.`); }
            catch (e) { vstatus(e.message, true); }
        });
        $('btnVoiceTest').addEventListener('click', async () => { try { await Voice.previewText($('voiceTest').value, vs); } catch (e) { vstatus(e.message, true); } });
        $('voiceOn').addEventListener('change', e => { S.voiceOn = e.target.checked; store.set('voiceOn', S.voiceOn); K.rerender(); });
        $('voiceAuto').addEventListener('change', e => { S.voiceAuto = e.target.checked; store.set('voiceAuto', S.voiceAuto); });
        $('btnVoiceGen').addEventListener('click', async () => {
            S.voiceOn = true; $('voiceOn').checked = true; store.set('voiceOn', true);
            $('voiceLog').innerHTML = '';
            S.forceGenerate = true;
            try { await K.rerender(); } finally { S.forceGenerate = false; }
            const tl = K.player.timeline;
            const n = tl ? tl.voiceCues.length : 0;
            vstatus(n ? `Narration ready: ${n} line${n === 1 ? '' : 's'}, video paced to the voice.` + (vs.provider === 'webspeech' ? ' Browser voice plays in preview only; choose ElevenLabs or upload recordings to export audio.' : '') : 'No narration was generated — see the log.', !n);
        });
        $('musicAsset').addEventListener('change', e => { S.music.asset = e.target.value; K.rerender(); });
        $('musicVol').addEventListener('change', e => { S.music.volume = +e.target.value; K.rerender(); });
        refreshMusic();
    }
    function voiceProgress(done, total, label, err) {
        $('voiceBar').style.width = (done / Math.max(1, total) * 100).toFixed(0) + '%';
        vstatus(`Voice ${done}/${total}: ${label}`, !!err);
        if (err) note('voiceLog', `${label} — ${err}`, true);
    }
    function vstatus(t, err) { $('voiceStatus').textContent = t; $('voiceStatus').className = 'status' + (err ? ' err' : ''); }
    function refreshMusic() {
        const sel = $('musicAsset');
        if (!sel) return;
        const cur = sel.value;
        sel.innerHTML = '<option value="">None</option>' + Media.list().filter(a => a.type === 'audio').map(a => `<option value="${a.name}">${a.name}</option>`).join('');
        sel.value = cur;
    }

    function copy(text, btn) {
        const done = () => { const o = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = o; }, 1400); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => { K.setStatus('Clipboard blocked — the prompt is in AI-KINETIC-PROMPT.md.', 'err'); });
    }

    function aiPrompt() {
        const P = (window.KStudio && KStudio.state && KStudio.state.presets) || window.KineticPresets || {};
        const names = cat => Object.keys(P[cat] || {}).filter(k => k[0] !== '_').join(', ') || '—';
        return `You are a motion-graphics scriptwriter for "Kinetic Studio", an explainer-video engine for teachers.
Turn the lesson I give you into ONE JSON object and output only that JSON.

Shape:
{ "meta": { "title": "...", "lang": "hi" | "en" | …, "locale": "en-IN", "auto": { "maps": "smart", "charts": "smart", "numbers": "on", "media": "smart", "emoji": "smart", "emphasis": "smart", "recipes": "smart" } },
  "theme": ${Object.keys(P.themes || {}).filter(k => k[0] !== '_').map(k => '"' + k + '"').join(' | ')},
  "scenes": [ { "id": "...", "beats": [ "sentence", { "text": "...", "visual": {...}, "say": "optional pronunciation" } ] } ] }

Rules
- 3–8 scenes, 1–3 short sentences (beats) per scene, 6–16 words each. Write in the lesson's language (Hindi in Devanagari is fine; mix English terms naturally).
- Inline markup inside text: [words](tags). Useful tags: em, highlight, underline, circle, strike, arrow:label_text, counter, ring (for %), icon:💡, stamp:NEW, map, city, state, img, svg, chart.
- Recipes give a beat its meaning and the engine picks matching motion: add "recipe": "<name>" to a beat (or a scene). Available: ${names('recipes')}.
- Semantic word tags (restyled by preset packs): ${names('tagAliases')}.
- Use "|" inside a sentence to cut to a new camera angle; use emoji and :shortcodes: (e.g. :rocket:) sparingly.
- Visuals (optional, one per beat):
  • map:   { "type":"map", "focus":"IN", "places":["Delhi", {"query":"Agra","label":"Taj Mahal","typeKey":"annotationCallout"}], "routes":[["Delhi","Mumbai"]], "regions":["Madhya Pradesh"], "values":{"IN":142,"CN":141} }
  • chart: { "type":"chart", "chart":"bar|column|donut|progress|stat|compare|line|timeline|pictogram", "title":"...", "data":[{"label":"...","value":123,"emoji":"🇮🇳"}], "suffix":" %" }
  • media: { "type":"media", "query":"volcano", "label":"Mount Etna", "frame":"polaroid|paper|tape|circle|none" }  (teacher drops the picture later)
  • svg:   { "type":"media", "query":"plant", "svg": { "mode":"strokeThenFill|draw|pop|build|assemble", "animate":[{"select":"#sun","loop":"spin"}] } }
- Numbers: write them with digits (e.g. 1,40,00,00,000 or 87%) so they animate as counters.
- Keep facts correct; do not invent statistics — if unsure, omit the number.

Lesson:
[paste your lesson text here]`;
    }

    async function boot() {
        buildAuto(); buildMedia(); buildMaps(); buildVoice();
        Media.setBase('');
        Geo.ready('');
        await Media.ingest({});
        $('btnSampleHi').addEventListener('click', async () => {
            const c = await K.fetchJSON('content.hindi.json', window.KineticHindiSample, 'content.hindi.json');
            K.loadIntoEditor(c, 'हिन्दी sample');
        });
        if ($('btnSampleIndia')) {
            $('btnSampleIndia').addEventListener('click', async () => {
                const c = await K.fetchJSON('content.india.json', window.KineticIndiaSample, 'content.india.json');
                K.loadIntoEditor(c, 'India Story');
            });
        }
    }
})();
