/*!
 * KineticVoice — automatic voice-over for KineticEngine
 * ------------------------------------------------------
 * Providers
 *   elevenlabs  studio-grade, 29+ languages incl. Hindi; uses /with-timestamps so every word
 *               lands on screen exactly when it is spoken.            (needs your API key)
 *   openai      any OpenAI-compatible /v1/audio/speech endpoint (OpenAI, local servers).
 *   custom      POST {text, voice, lang} to your own URL (Piper / Coqui / Azure proxy…);
 *               may return audio bytes or ElevenLabs-style JSON with alignment.
 *   webspeech   free, built into the browser (Chrome has हिन्दी, English, …). Preview only —
 *               browsers cannot record it, so exports are silent with this provider.
 *   upload      your own recordings: beat.audio = "asset-name" | data URL (from the Media tab).
 *
 * Flow: KineticVoice.prepare(content) (engine beforeCompile hook) generates or loads one clip per
 * sentence, caches it in IndexedDB (no double billing), and writes beat.voice = { id, duration,
 * wordTimes }. The compiler then paces shots to the narration. mixdown(timeline) builds the final
 * track (with optional ducked background music) for preview and MP4/WebM/WAV export.
 */
(function (root) {
    'use strict';
    const E = root.KineticEngine;
    if (!E) { console.error('[KineticVoice] load engine.js first'); return; }
    const U = E.api.U;

    const CLIPS = new Map();       // id → { buffer, duration, wordTimes }
    const settings = {
        provider: 'webspeech', apiKey: '', voiceId: '', model: '', lang: 'auto', rate: 1,
        stability: 0.45, similarity: 0.8, style: 0.2, baseUrl: 'https://api.openai.com', customUrl: '', instructions: '',
        musicVolume: 0.22, duck: 0.35, concurrency: 3
    };
    let actx = null;
    const ctx = () => (actx = actx || new (root.AudioContext || root.webkitAudioContext)());

    /* ─── helpers ─── */
    function hash(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
    const SCRIPT_LANG = [[/[ऀ-ॿ]/, 'hi'], [/[ঀ-৿]/, 'bn'], [/[਀-੿]/, 'pa'], [/[઀-૿]/, 'gu'], [/[஀-௿]/, 'ta'], [/[ఀ-౿]/, 'te'], [/[ಀ-೿]/, 'kn'], [/[ഀ-ൿ]/, 'ml'], [/[؀-ۿ]/, 'ar'], [/[Ѐ-ӿ]/, 'ru'], [/[一-鿿]/, 'zh'], [/[぀-ヿ]/, 'ja'], [/[가-힯]/, 'ko']];
    function detectLang(text, fallback) {
        for (const [re, l] of SCRIPT_LANG) if (re.test(text)) return l;
        return fallback || 'en';
    }
    function b64ToBytes(b64) { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }

    /** Speech text for a beat + the character offset of every engine word (for alignment). */
    function speechFor(beat, presets) {
        const parsed = E.parseMarkup(beat.text || '', presets);
        const offsets = new Array(parsed.words.length).fill(null);
        let text = '';
        parsed.words.forEach((w, i) => {
            const spoken = w.text.replace(/\p{Extended_Pictographic}|\p{Regional_Indicator}|️|‍/gu, '').trim();
            if (!spoken) return;
            if (text) text += ' ';
            offsets[i] = text.length;
            text += spoken;
        });
        if (beat.say) return { text: String(beat.say), offsets: null, words: parsed.words.length };
        return { text, offsets, words: parsed.words.length };
    }
    function proportionalTimes(sp, duration) {
        const n = sp.words, out = new Array(n).fill(0);
        const len = Math.max(1, sp.text.length);
        let last = 0;
        for (let i = 0; i < n; i++) {
            const o = sp.offsets ? sp.offsets[i] : (i / Math.max(1, n)) * len;
            if (o != null) last = (o / len) * duration * 0.96;
            out[i] = last;
        }
        return out;
    }
    function alignedTimes(sp, align, duration) {
        if (!align || !align.character_start_times_seconds || !sp.offsets) return proportionalTimes(sp, duration);
        const starts = align.character_start_times_seconds;
        const out = new Array(sp.words).fill(0);
        let last = 0;
        for (let i = 0; i < sp.words; i++) {
            const o = sp.offsets[i];
            if (o != null && starts[o] != null) last = starts[o];
            out[i] = last;
        }
        return out;
    }

    /* ─── IndexedDB cache ─── */
    const DB = {
        db: null,
        open() {
            if (this.db) return Promise.resolve(this.db);
            return new Promise(res => {
                try {
                    const r = indexedDB.open('kinetic-voice', 1);
                    r.onupgradeneeded = () => r.result.createObjectStore('clips');
                    r.onsuccess = () => { this.db = r.result; res(this.db); };
                    r.onerror = () => res(null);
                } catch (e) { res(null); }
            });
        },
        async get(k) { const db = await this.open(); if (!db) return null; return new Promise(res => { try { const q = db.transaction('clips').objectStore('clips').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); } catch (e) { res(null); } }); },
        async put(k, v) { const db = await this.open(); if (!db) return; try { db.transaction('clips', 'readwrite').objectStore('clips').put(v, k); } catch (e) { /* quota */ } },
        async clear() { const db = await this.open(); if (!db) return; try { db.transaction('clips', 'readwrite').objectStore('clips').clear(); } catch (e) { /* */ } }
    };

    /* ─── providers ─── */
    const OPENAI_VOICES = [
        { id: 'alloy', name: 'Alloy', gender: 'neutral' }, { id: 'ash', name: 'Ash', gender: 'male' }, { id: 'ballad', name: 'Ballad', gender: 'male' },
        { id: 'coral', name: 'Coral', gender: 'female' }, { id: 'echo', name: 'Echo', gender: 'male' }, { id: 'fable', name: 'Fable', gender: 'male' },
        { id: 'nova', name: 'Nova', gender: 'female' }, { id: 'onyx', name: 'Onyx', gender: 'male' }, { id: 'sage', name: 'Sage', gender: 'female' },
        { id: 'shimmer', name: 'Shimmer', gender: 'female' }, { id: 'verse', name: 'Verse', gender: 'male' }
    ];
    const PROVIDERS = {
        elevenlabs: {
            label: 'ElevenLabs', needsKey: true, timestamps: true,
            async voices(s) {
                const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': s.apiKey } });
                if (!r.ok) throw new Error('ElevenLabs voices: HTTP ' + r.status);
                const j = await r.json();
                return (j.voices || []).map(v => ({ id: v.voice_id, name: v.name, gender: (v.labels && v.labels.gender) || '', accent: (v.labels && (v.labels.accent || v.labels.language)) || '', preview: v.preview_url }));
            },
            async speak(text, s, lang, ctxText) {
                if (!s.voiceId) throw new Error('Choose an ElevenLabs voice first.');
                const model = s.model || 'eleven_multilingual_v2';
                const body = { text, model_id: model, voice_settings: { stability: s.stability, similarity_boost: s.similarity, style: s.style, use_speaker_boost: true } };
                if (/flash_v2_5|turbo_v2_5|v3/.test(model) && lang) body.language_code = lang;
                if (ctxText && ctxText.prev) body.previous_text = ctxText.prev;
                if (ctxText && ctxText.next) body.next_text = ctxText.next;
                const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(s.voiceId)}/with-timestamps?output_format=mp3_44100_128`, {
                    method: 'POST', headers: { 'xi-api-key': s.apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
                });
                if (!r.ok) { let m = ''; try { m = (await r.json()).detail; m = m && (m.message || JSON.stringify(m)); } catch (e) { /* */ } throw new Error(`ElevenLabs: HTTP ${r.status} ${m || ''}`); }
                const j = await r.json();
                return { bytes: b64ToBytes(j.audio_base64), mime: 'audio/mpeg', alignment: j.alignment || j.normalized_alignment };
            }
        },
        openai: {
            label: 'OpenAI-compatible', needsKey: true, timestamps: false,
            async voices() { return OPENAI_VOICES; },
            async speak(text, s) {
                const body = { model: s.model || 'gpt-4o-mini-tts', voice: s.voiceId || 'nova', input: text, response_format: 'mp3', speed: s.rate || 1 };
                if (s.instructions) body.instructions = s.instructions;
                const r = await fetch(String(s.baseUrl || 'https://api.openai.com').replace(/\/$/, '') + '/v1/audio/speech', {
                    method: 'POST', headers: { Authorization: 'Bearer ' + s.apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
                });
                if (!r.ok) throw new Error('TTS: HTTP ' + r.status + ' ' + (await r.text()).slice(0, 160));
                return { bytes: await r.arrayBuffer(), mime: r.headers.get('content-type') || 'audio/mpeg' };
            }
        },
        custom: {
            label: 'Custom endpoint', needsKey: false, timestamps: 'maybe',
            async voices() { return []; },
            async speak(text, s, lang) {
                if (!s.customUrl) throw new Error('Set the custom TTS URL first.');
                const r = await fetch(s.customUrl, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, s.apiKey ? { Authorization: 'Bearer ' + s.apiKey } : {}), body: JSON.stringify({ text, voice: s.voiceId, lang, rate: s.rate }) });
                if (!r.ok) throw new Error('Custom TTS: HTTP ' + r.status);
                const ct = r.headers.get('content-type') || '';
                if (/json/.test(ct)) { const j = await r.json(); return { bytes: b64ToBytes(j.audio_base64 || j.audio), mime: j.mime || 'audio/mpeg', alignment: j.alignment }; }
                return { bytes: await r.arrayBuffer(), mime: ct || 'audio/mpeg' };
            }
        },
        webspeech: {
            label: 'Browser voice (free, preview only)', needsKey: false, timestamps: false, live: true,
            async voices() {
                if (!root.speechSynthesis) return [];
                let list = speechSynthesis.getVoices();
                if (!list.length) await new Promise(r => { speechSynthesis.onvoiceschanged = r; setTimeout(r, 1500); });
                list = speechSynthesis.getVoices();
                const fem = /female|woman|zira|samantha|victoria|karen|moira|tessa|veena|lekha|heera|kalpana|swara|aditi|google uk english female|susan|hazel|linda|priya|neerja/i;
                const male = /male|man|david|mark|daniel|alex|fred|rishi|hemant|ravi|prabhat|madhur|google uk english male|george|guy/i;
                return list.map(v => ({ id: v.voiceURI, name: v.name, lang: v.lang, gender: fem.test(v.name) ? 'female' : male.test(v.name) ? 'male' : '' }));
            }
        },
        upload: { label: 'My recordings', needsKey: false, timestamps: false, async voices() { return []; } }
    };

    async function decode(bytes) { return ctx().decodeAudioData(bytes.slice(0)); }

    /**
     * prepare(content, presets, { onProgress }) — generate/load narration for every beat.
     * Use as a beforeCompile hook: Player.load(content, presets, { beforeCompile: [KineticVoice.prepare] }).
     */
    async function prepare(input, presets, opts) {
        opts = opts || {};
        const s = Object.assign({}, settings, (input && input.meta && input.meta.voice) || {}, opts.settings || {});
        if (s.provider === 'off' || (input && input.meta && input.meta.voice === false)) return input;
        const L = presets instanceof E.PresetLib ? presets : new E.PresetLib(presets);
        const content = E.normalizeContent(input, L, {});
        const prov = PROVIDERS[s.provider];
        if (!prov) { E.Log.warn('voice:prov', `Unknown voice provider "${s.provider}".`); return content; }
        if (prov.needsKey && !s.apiKey) { E.Log.warn('voice:key', `${prov.label} needs an API key — narration skipped. Add it in the Voice tab.`); return content; }
        const jobs = [];
        content.scenes.forEach((scene, si) => {
            scene.beats = U.asArray(scene.beats).map(b => (typeof b === 'string' ? { text: b } : Object.assign({}, b)));
            scene.beats.forEach((beat, bi) => {
                if (beat.voice === false || beat.mute) return;
                const sp = speechFor(beat, L);
                if (!sp.text.trim() && !beat.audio) return;
                const lang = s.lang && s.lang !== 'auto' ? s.lang : detectLang(sp.text, (content.meta && content.meta.lang) || 'en');
                const vs = Object.assign({}, s, beat.voiceId ? { voiceId: beat.voiceId } : scene.voiceId ? { voiceId: scene.voiceId } : {});
                const prev = bi > 0 ? speechFor(scene.beats[bi - 1], L).text : '', next = bi < scene.beats.length - 1 ? speechFor(scene.beats[bi + 1], L).text : '';
                jobs.push({ beat, sp, lang, vs, ctxText: { prev, next }, label: `Scene ${si + 1} · ${sp.text.slice(0, 40)}` });
            });
        });
        let done = 0;
        const run = async job => {
            const { beat, sp, lang, vs } = job;
            const key = hash([vs.provider, vs.voiceId, vs.model, vs.rate, vs.stability, vs.similarity, vs.style, vs.instructions, lang, sp.text, beat.audio || ''].join('|'));
            try {
                let clip = CLIPS.get(key);
                if (!clip) {
                    if (beat.audio || vs.provider === 'upload') {
                        const src = beat.audio && root.KineticMedia && root.KineticMedia.get(beat.audio) ? root.KineticMedia.get(beat.audio).src : beat.audio;
                        if (!src) throw new Error('No recording attached (beat.audio).');
                        const buf = await decode(await (await fetch(src)).arrayBuffer());
                        clip = { buffer: buf, duration: buf.duration, wordTimes: proportionalTimes(sp, buf.duration) };
                    } else if (vs.provider === 'webspeech') {
                        const cps = lang === 'en' ? 14.5 : 12;
                        const dur = sp.text.length / (cps * (vs.rate || 1)) + 0.35;
                        clip = { buffer: null, duration: dur, wordTimes: proportionalTimes(sp, dur), live: { text: sp.text, lang, voiceURI: vs.voiceId, rate: vs.rate || 1 } };
                    } else {
                        let cached = await DB.get(key);
                        if (!cached && opts.cachedOnly) { job.skipped = true; return; }
                        if (!cached) {
                            const r = await PROVIDERS[vs.provider].speak(sp.text, vs, lang, job.ctxText);
                            cached = { bytes: r.bytes, mime: r.mime, alignment: r.alignment || null };
                            DB.put(key, cached);
                        }
                        const buf = await decode(cached.bytes);
                        clip = { buffer: buf, duration: buf.duration, wordTimes: cached.alignment ? alignedTimes(sp, cached.alignment, buf.duration) : proportionalTimes(sp, buf.duration), bytes: cached.bytes, mime: cached.mime };
                    }
                    CLIPS.set(key, clip);
                }
                beat.voice = { id: key, duration: clip.duration, wordTimes: clip.wordTimes };
            } catch (e) {
                E.Log.warn('voice:' + e.message, 'Voice-over: ' + e.message);
                job.error = e.message;
            } finally {
                done++;
                if (opts.onProgress) opts.onProgress(done, jobs.length, job.label, job.error);
            }
        };
        const conc = Math.max(1, U.num(s.concurrency, 3));
        let next = 0;
        await Promise.all(Array.from({ length: Math.min(conc, jobs.length) }, async () => { while (next < jobs.length) await run(jobs[next++]); }));
        content.meta = Object.assign({}, content.meta, { voiceProvider: s.provider });
        delete content._format;
        return content;
    }

    /** Build the full narration (+ ducked background music) for a compiled timeline. */
    async function mixdown(tl) {
        const cues = (tl.voiceCues || []).filter(c => CLIPS.get(c.id) && CLIPS.get(c.id).buffer);
        const music = tl.meta && tl.meta.music;
        if (!cues.length && !music) return null;
        const sr = 48000;
        const off = new OfflineAudioContext(2, Math.ceil((tl.duration + 0.5) * sr), sr);
        cues.forEach(c => { const src = off.createBufferSource(); src.buffer = CLIPS.get(c.id).buffer; src.connect(off.destination); src.start(Math.max(0, c.t)); });
        if (music) {
            try {
                const m = typeof music === 'string' ? { asset: music } : music;
                const a = root.KineticMedia && (root.KineticMedia.get(m.asset) || root.KineticMedia.match(m.asset));
                const url = (a && (a.url || a.src)) || m.src;
                if (url) {
                    const mb = await off.decodeAudioData(await (await fetch(url)).arrayBuffer());
                    const src = off.createBufferSource(); src.buffer = mb; src.loop = true;
                    const g = off.createGain();
                    const vol = U.num(m.volume, settings.musicVolume), duck = vol * U.num(m.duck, settings.duck);
                    g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(vol, 1.2);
                    cues.forEach(c => { g.gain.setTargetAtTime(duck, Math.max(0, c.t - 0.25), 0.12); g.gain.setTargetAtTime(vol, c.t + c.duration + 0.1, 0.35); });
                    g.gain.setTargetAtTime(0, Math.max(0, tl.duration - 1.5), 0.4);
                    src.connect(g); g.connect(off.destination); src.start(0);
                }
            } catch (e) { E.Log.warn('music', 'Background music could not be loaded: ' + e.message); }
        }
        return off.startRendering();
    }

    /** Player audio controller: sample-accurate buffer playback, or live browser speech. */
    async function audioFor(tl) {
        const liveCues = (tl.voiceCues || []).filter(c => CLIPS.get(c.id) && CLIPS.get(c.id).live);
        if (liveCues.length && root.speechSynthesis) {
            let spoken = new Set(), lastT = -1, rate = 1;
            const voices = speechSynthesis.getVoices();
            return {
                play(t, speed) { speechSynthesis.cancel(); spoken = new Set(liveCues.filter(c => c.t < t - 0.3).map(c => c.id + c.t)); rate = speed || 1; },
                pause() { speechSynthesis.cancel(); },
                stop() { speechSynthesis.cancel(); },
                tick(t, playing) {
                    if (!playing) return;
                    if (t < lastT - 0.5) spoken = new Set();
                    lastT = t;
                    liveCues.forEach(c => {
                        const k = c.id + c.t;
                        if (t >= c.t && t < c.t + 0.6 && !spoken.has(k)) {
                            spoken.add(k);
                            const L = CLIPS.get(c.id).live;
                            const u = new SpeechSynthesisUtterance(L.text);
                            u.lang = L.lang === 'hi' ? 'hi-IN' : L.lang;
                            u.rate = L.rate * rate;
                            const v = voices.find(x => x.voiceURI === L.voiceURI) || voices.find(x => x.lang && x.lang.startsWith(L.lang));
                            if (v) u.voice = v;
                            speechSynthesis.speak(u);
                        }
                    });
                }
            };
        }
        const buffer = await mixdown(tl);
        if (!buffer) return null;
        let src = null, startedAt = 0, offset = 0, rate = 1;
        const stop = () => { if (src) { try { src.stop(); } catch (e) { /* */ } src.disconnect(); src = null; } };
        return {
            buffer,
            play(t, speed) {
                stop();
                const c = ctx();
                if (c.state === 'suspended') c.resume();
                src = c.createBufferSource(); src.buffer = buffer; src.playbackRate.value = speed || 1; src.connect(c.destination);
                offset = Math.max(0, t); rate = speed || 1; startedAt = c.currentTime;
                if (offset < buffer.duration) src.start(0, offset);
            },
            pause: stop, stop,
            clock() { return src ? offset + (ctx().currentTime - startedAt) * rate : null; }
        };
    }

    /** Preview one sentence right now (Voice tab "▶" buttons). */
    async function previewText(text, opts) {
        const s = Object.assign({}, settings, opts || {});
        const lang = s.lang && s.lang !== 'auto' ? s.lang : detectLang(text);
        if (s.provider === 'webspeech') {
            const u = new SpeechSynthesisUtterance(text); u.lang = lang === 'hi' ? 'hi-IN' : lang; u.rate = s.rate || 1;
            const v = speechSynthesis.getVoices().find(x => x.voiceURI === s.voiceId); if (v) u.voice = v;
            speechSynthesis.cancel(); speechSynthesis.speak(u); return;
        }
        const r = await PROVIDERS[s.provider].speak(text, s, lang, {});
        const buf = await decode(r.bytes);
        const src = ctx().createBufferSource(); src.buffer = buf; src.connect(ctx().destination); src.start();
    }

    root.KineticVoice = {
        settings, providers: PROVIDERS, prepare, mixdown, audioFor, previewText, detectLang, speechFor,
        listVoices: (s) => PROVIDERS[(s || settings).provider].voices(Object.assign({}, settings, s || {})),
        clips: CLIPS, clearCache: () => { CLIPS.clear(); return DB.clear(); },
        hook: (getOpts) => (content, presets) => prepare(content, presets, typeof getOpts === 'function' ? getOpts() : getOpts)
    };
})(typeof window !== 'undefined' ? window : globalThis);
