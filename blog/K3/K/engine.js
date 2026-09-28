/*!
 * KineticEngine — data-driven kinetic typography runtime (paper-motion edition)
 * ---------------------------------------------------------------------------
 * Renders After-Effects-style kinetic typography explainers into a <canvas>
 * from three inputs only:
 *     1. content JSON   (native scenes/beats OR your existing D3 Annotation
 *                        Studio project / d3-annotation array / pattern output
 *                        / plain text)
 *     2. presets JSON   (presets.motion.json — easings, motion, camera,
 *                        staging, supplements, transitions, themes, icons)
 *     3. theme object   (picked from presets.themes or supplied inline)
 *
 * The engine itself holds NO topic text, colours, fonts or durations. Every
 * visual and timing decision is resolved from the JSON. The only literals
 * below are in SAFE, a crash-guard used when a preset file is missing a key
 * entirely — it logs a warning every time it is used.
 *
 * Rendering is a pure function of time:  renderFrame(timeline, t, ctx)
 * which is what makes scrubbing and export frame-accurate.
 */
(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.KineticEngine = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const VERSION = '1.0.0';

    /* ════════════════════════════════════════════════════════════════════
     * 0. CRASH-GUARD FALLBACKS (used only when presets JSON lacks a key)
     * ════════════════════════════════════════════════════════════════════ */
    const SAFE = Object.freeze({
        duration: 0.6,
        bezier: [0.22, 1, 0.36, 1],     // ease-out — never linear
        ink: '#222222',
        paper: '#f4f1ea',
        font: 'sans-serif',
        size: 96,
        fps: 30,
        width: 1920,
        height: 1080
    });

    /* ════════════════════════════════════════════════════════════════════
     * 1. SMALL UTILITIES
     * ════════════════════════════════════════════════════════════════════ */
    const U = {
        clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
        lerp: (a, b, t) => a + (b - a) * t,
        inv: (a, b, v) => (b === a ? 0 : (v - a) / (b - a)),
        isObj: v => v !== null && typeof v === 'object' && !Array.isArray(v),
        num: (v, d) => (typeof v === 'number' && isFinite(v) ? v : d),
        deg: d => (d * Math.PI) / 180,
        pick(obj, path, dflt) {
            if (!obj) return dflt;
            const parts = String(path).split('.');
            let cur = obj;
            for (const p of parts) {
                if (cur == null || !(p in Object(cur))) return dflt;
                cur = cur[p];
            }
            return cur === undefined ? dflt : cur;
        },
        clone: v => (v === undefined ? v : JSON.parse(JSON.stringify(v))),
        /** Deep merge: arrays replace, objects merge, later wins. */
        merge(...srcs) {
            const out = {};
            for (const s of srcs) {
                if (!U.isObj(s)) continue;
                for (const k of Object.keys(s)) {
                    const v = s[k];
                    if (U.isObj(v) && U.isObj(out[k])) out[k] = U.merge(out[k], v);
                    else if (U.isObj(v)) out[k] = U.merge(v);
                    else if (Array.isArray(v)) out[k] = v.slice();
                    else if (v !== undefined) out[k] = v;
                }
            }
            return out;
        },
        asArray: v => (v == null ? [] : Array.isArray(v) ? v : [v])
    };

    /* ─── Logger: de-duplicated warnings, collected for the UI ─── */
    const Log = {
        warnings: [],
        _seen: new Set(),
        listeners: [],
        warn(key, msg) {
            if (this._seen.has(key)) return;
            this._seen.add(key);
            const entry = { key, msg, time: Date.now() };
            this.warnings.push(entry);
            if (typeof console !== 'undefined') console.warn('[KineticEngine] ' + msg);
            this.listeners.forEach(fn => { try { fn(entry); } catch (e) { /* listener errors are isolated */ } });
        },
        reset() { this.warnings = []; this._seen.clear(); },
        onWarn(fn) { this.listeners.push(fn); }
    };

    /* ─── Seeded randomness (deterministic frames) ─── */
    function hashStr(s) {
        let h = 2166136261 >>> 0;
        s = String(s);
        for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
        return h >>> 0;
    }
    function rng(seed) {
        let a = (typeof seed === 'number' ? seed : hashStr(seed)) >>> 0;
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    /** Smooth 1D value noise in [-1,1], seeded. Used for handheld camera + boil. */
    function noise1(seed, x) {
        const i = Math.floor(x), f = x - i;
        const r = n => { const R = rng(seed * 7919 + n * 104729); R(); return R() * 2 - 1; };
        const u = f * f * (3 - 2 * f);
        return U.lerp(r(i), r(i + 1), u);
    }

    /* ─── Colour ─── */
    const Color = {
        parse(c) {
            if (!c || typeof c !== 'string') return null;
            c = c.trim();
            if (c[0] === '#') {
                let h = c.slice(1);
                if (h.length === 3 || h.length === 4) h = h.split('').map(x => x + x).join('');
                const n = parseInt(h.slice(0, 6), 16);
                const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
                return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a };
            }
            const m = c.match(/rgba?\(([^)]+)\)/i);
            if (m) {
                const p = m[1].split(',').map(s => parseFloat(s));
                return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] };
            }
            return null;
        },
        str(o) { return `rgba(${Math.round(o.r)},${Math.round(o.g)},${Math.round(o.b)},${+o.a.toFixed(4)})`; },
        mix(c1, c2, t) {
            const a = Color.parse(c1), b = Color.parse(c2);
            if (!a || !b) return c1;
            return Color.str({ r: U.lerp(a.r, b.r, t), g: U.lerp(a.g, b.g, t), b: U.lerp(a.b, b.b, t), a: U.lerp(a.a, b.a, t) });
        },
        alpha(c, al) {
            const a = Color.parse(c);
            if (!a) return c;
            a.a = a.a * al;
            return Color.str(a);
        },
        shade(c, k) { return k >= 0 ? Color.mix(c, '#ffffff', k) : Color.mix(c, '#000000', -k); }
    };

    /**
     * Resolve palette tokens. "@accent" → theme.palette.accent,
     * "@accent.dark" / "@accent.light" / "@ink.a50" (alpha 0.5) modifiers,
     * "@strip[2]" → theme.palette.strip array index (wraps).
     */
    function resolveColor(theme, c, fallbackKey) {
        if (c == null) c = fallbackKey ? '@' + fallbackKey : null;
        if (c == null) return SAFE.ink;
        if (typeof c !== 'string') return SAFE.ink;
        if (c[0] !== '@') return c;
        const m = c.slice(1).match(/^([a-zA-Z0-9_]+)(?:\[(\d+)\])?(?:\.(dark|light|a\d+))?$/);
        if (!m) { Log.warn('color:' + c, `Unknown colour token "${c}".`); return SAFE.ink; }
        const pal = (theme && theme.palette) || {};
        let v = pal[m[1]];
        if (Array.isArray(v)) v = v[(+m[2] || 0) % v.length];
        if (v == null) {
            Log.warn('palette:' + m[1], `Palette key "${m[1]}" missing from theme — using ink.`);
            v = pal.ink || SAFE.ink;
        }
        if (m[3] === 'dark') v = Color.shade(v, -U.num(U.pick(theme, 'material.shadeAmount'), 0.25));
        else if (m[3] === 'light') v = Color.shade(v, U.num(U.pick(theme, 'material.shadeAmount'), 0.25));
        else if (m[3] && m[3][0] === 'a') v = Color.alpha(v, parseInt(m[3].slice(1), 10) / 100);
        return v;
    }

    /* ════════════════════════════════════════════════════════════════════
     * 2. EASING — cubic-bezier, spring, elastic, bounce, anticipate, steps
     * All curves are defined in presets.motion.json → "easings".
     * ════════════════════════════════════════════════════════════════════ */
    function cubicBezier(x1, y1, x2, y2) {
        const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
        const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
        const sx = t => ((ax * t + bx) * t + cx) * t;
        const sy = t => ((ay * t + by) * t + cy) * t;
        const dx = t => (3 * ax * t + 2 * bx) * t + cx;
        return function (x) {
            if (x <= 0) return 0;
            if (x >= 1) return 1;
            let t = x;
            for (let i = 0; i < 8; i++) {
                const e = sx(t) - x, d = dx(t);
                if (Math.abs(e) < 1e-6) return sy(t);
                if (Math.abs(d) < 1e-6) break;
                t -= e / d;
            }
            let lo = 0, hi = 1; t = x;
            for (let i = 0; i < 30; i++) {
                const v = sx(t);
                if (Math.abs(v - x) < 1e-6) break;
                if (v < x) lo = t; else hi = t;
                t = (lo + hi) / 2;
            }
            return sy(t);
        };
    }

    /**
     * Damped spring mapped to t∈[0,1]. Virtual settle time is found numerically
     * so any stiffness/damping still lands exactly on 1 at t = 1.
     */
    function springEase(p) {
        const k = U.num(p.stiffness, 170), c = U.num(p.damping, 14), m = U.num(p.mass, 1), v0 = U.num(p.velocity, 0);
        const w0 = Math.sqrt(k / m), zeta = c / (2 * Math.sqrt(k * m));
        let pos;
        if (zeta < 1) {
            const wd = w0 * Math.sqrt(1 - zeta * zeta);
            pos = s => 1 - Math.exp(-zeta * w0 * s) * (Math.cos(wd * s) + ((zeta * w0 - v0) / wd) * Math.sin(wd * s));
        } else {
            pos = s => 1 - Math.exp(-w0 * s) * (1 + (w0 - v0) * s);
        }
        let T = 0.05;
        const tol = U.num(p.tolerance, 0.002);
        for (let s = 0.05; s < 20; s += 0.02) {
            let settled = true;
            for (let q = s; q < s + 1.2; q += 0.05) if (Math.abs(1 - pos(q)) > tol) { settled = false; break; }
            if (settled) { T = s; break; }
            T = s;
        }
        return x => (x <= 0 ? 0 : x >= 1 ? 1 : pos(x * T));
    }

    function makeEase(spec) {
        if (Array.isArray(spec) && spec.length === 4) return cubicBezier(...spec.map(Number));
        if (!U.isObj(spec)) return null;
        switch (spec.type) {
            case 'bezier': return Array.isArray(spec.points) ? cubicBezier(...spec.points.map(Number)) : null;
            case 'spring': return springEase(spec);
            case 'elastic': {
                const a = U.num(spec.amplitude, 1), per = U.num(spec.period, 0.3);
                return x => (x <= 0 ? 0 : x >= 1 ? 1 : a * Math.pow(2, -10 * x) * Math.sin(((x - per / 4) * (2 * Math.PI)) / per) + 1);
            }
            case 'bounce': {
                const n = 7.5625, d = 2.75;
                return x => {
                    if (x < 1 / d) return n * x * x;
                    if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
                    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
                    return n * (x -= 2.625 / d) * x + 0.984375;
                };
            }
            case 'anticipate': {
                // Pull back first (anticipation) then overshoot and settle.
                const s = U.num(spec.amount, 1.70158) * 1.525;
                return x => (x < 0.5
                    ? (Math.pow(2 * x, 2) * ((s + 1) * 2 * x - s)) / 2
                    : (Math.pow(2 * x - 2, 2) * ((s + 1) * (x * 2 - 2) + s) + 2) / 2);
            }
            case 'steps': {
                const n = Math.max(1, U.num(spec.steps, 4));
                return x => Math.min(1, Math.floor(x * n + (spec.jumpStart ? 1 : 0)) / n);
            }
            default: return null;
        }
    }

    class EaseLib {
        constructor(defs) { this.defs = defs || {}; this.cache = new Map(); }
        get(name) {
            if (typeof name === 'function') return name;
            const key = typeof name === 'string' ? name : JSON.stringify(name);
            if (this.cache.has(key)) return this.cache.get(key);
            let fn = null;
            if (typeof name === 'string') {
                const cb = name.match(/^cubic-bezier\(([^)]+)\)$/);
                if (cb) fn = cubicBezier(...cb[1].split(',').map(Number));
                else if (this.defs[name] !== undefined) {
                    const d = this.defs[name];
                    fn = typeof d === 'string' && d !== name ? this.get(d) : makeEase(U.isObj(d) && d.curve ? d.curve : d);
                }
            } else fn = makeEase(name);
            if (!fn) {
                if (name != null) Log.warn('ease:' + key, `Easing "${key}" not found — using theme default ease.`);
                const dflt = this.defs.__default;
                fn = dflt && dflt !== name ? this.get(dflt) : cubicBezier(...SAFE.bezier);
            }
            this.cache.set(key, fn);
            return fn;
        }
    }

    /* ════════════════════════════════════════════════════════════════════
     * 3. KEYFRAME TRACKS & PRESET EVALUATION
     *
     * A motion preset animates layer channels with keyframes:
     *   "props": { "y": [[0, 80], [0.6, -12, "overshoot"], [1, 0]] }
     * Key = [normalisedTime, value, optionalEaseForSegmentEndingHere].
     * ADDITIVE channels sum across stacked presets, MULTIPLICATIVE multiply.
     * ════════════════════════════════════════════════════════════════════ */
    const ADDITIVE = ['x', 'y', 'z', 'rotX', 'rotY', 'rotZ', 'skewX', 'skewY', 'blur', 'tracking', 'lift', 'shade'];
    const MULTIPLY = ['scale', 'scaleX', 'scaleY', 'opacity', 'reveal'];
    const IDENTITY = () => ({ x: 0, y: 0, z: 0, rotX: 0, rotY: 0, rotZ: 0, skewX: 0, skewY: 0, blur: 0, tracking: 0, lift: 0, shade: 0, scale: 1, scaleX: 1, scaleY: 1, opacity: 1, reveal: 1 });

    function evalTrack(keys, u, eases, dfltEase) {
        if (!Array.isArray(keys) || !keys.length) return null;
        if (!Array.isArray(keys[0])) return +keys[0];               // constant
        if (u <= keys[0][0]) return +keys[0][1];
        const last = keys[keys.length - 1];
        if (u >= last[0]) return +last[1];
        for (let i = 1; i < keys.length; i++) {
            const k1 = keys[i];
            if (u <= k1[0]) {
                const k0 = keys[i - 1];
                const span = k1[0] - k0[0];
                const p = span <= 0 ? 1 : (u - k0[0]) / span;
                const e = eases.get(k1[2] || dfltEase);
                return U.lerp(+k0[1], +k1[1], e(p));
            }
        }
        return +last[1];
    }

    /** Apply one preset at normalised progress u into the accumulator. */
    function accumulate(acc, preset, u, eases, amount) {
        if (!preset || !preset.props) return acc;
        const k = amount == null ? 1 : amount;
        for (const ch of Object.keys(preset.props)) {
            const v = evalTrack(preset.props[ch], u, eases, preset.ease);
            if (v == null) continue;
            if (ADDITIVE.includes(ch)) acc[ch] += v * k;
            else if (MULTIPLY.includes(ch)) acc[ch] *= k === 1 ? v : U.lerp(1, v, k);
            else acc[ch] = v; // custom channel, last wins
        }
        return acc;
    }

    /**
     * Distribute stagger delays. from: start|end|center|edges|random.
     * "spread" (optional) caps the total stagger time for long texts.
     */
    function staggerDelay(st, i, n, seed) {
        if (!st || n <= 1) return 0;
        const each = U.num(st.each, 0);
        let order;
        switch (st.from) {
            case 'end': order = n - 1 - i; break;
            case 'center': order = Math.abs(i - (n - 1) / 2); break;
            case 'edges': order = (n - 1) / 2 - Math.abs(i - (n - 1) / 2); break;
            case 'random': order = rng(hashStr(seed + ':' + i))() * (n - 1); break;
            default: order = i;
        }
        const maxOrder = st.from === 'center' || st.from === 'edges' ? (n - 1) / 2 : n - 1;
        let total = each * maxOrder;
        if (st.maxTotal != null) total = Math.min(total, st.maxTotal);
        return maxOrder > 0 ? total * (order / maxOrder) : 0;
    }

    /* ════════════════════════════════════════════════════════════════════
     * 4. PRESET LIBRARY (with graceful fallbacks)
     * ════════════════════════════════════════════════════════════════════ */
    const CATEGORIES = ['entry', 'emphasis', 'exit', 'loop', 'camera', 'staging', 'layouts', 'supplements', 'transitions', 'backgrounds'];

    class PresetLib {
        constructor(json) {
            this.json = json || {};
            if (!json) Log.warn('presets:none', 'No presets JSON supplied — running on crash-guard fallbacks only.');
            const easings = U.merge(this.json.easings || {});
            if (this.json.defaults && this.json.defaults.ease) easings.__default = this.json.defaults.ease;
            this.eases = new EaseLib(easings);
            this.icons = this.json.icons || {};
            this.themes = this.json.themes || {};
            this.tagAliases = this.json.tagAliases || {};
            this.annotationTypes = this.json.annotationTypes || {};
            this.language = this.json.language || {};
        }
        /** Look up a preset by category + name; warns and falls back to defaults. */
        get(cat, name, theme) {
            const lib = this.json[cat] || {};
            if (name && lib[name]) return this._resolveExtends(cat, lib[name], 0);
            const dfltName = U.pick(theme, 'defaults.' + cat) || U.pick(this.json, 'defaults.' + cat);
            if (name) Log.warn(`preset:${cat}:${name}`, `Preset "${name}" not found in "${cat}" — falling back to "${dfltName || 'first available'}".`);
            if (dfltName && lib[dfltName]) return this._resolveExtends(cat, lib[dfltName], 0);
            const first = Object.keys(lib).find(k => k[0] !== '_');
            if (first) return this._resolveExtends(cat, lib[first], 0);
            Log.warn('preset:empty:' + cat, `Preset category "${cat}" is empty.`);
            return null;
        }
        has(cat, name) { return !!(this.json[cat] && this.json[cat][name]); }
        names(cat) { return Object.keys(this.json[cat] || {}).filter(k => k[0] !== '_'); }
        /** Presets may inherit: { "extends": "popUp", "duration": 0.9 } */
        _resolveExtends(cat, p, depth) {
            if (!p || !p.extends || depth > 6) return p;
            const base = (this.json[cat] || {})[p.extends];
            if (!base) { Log.warn('extends:' + p.extends, `Preset extends unknown "${p.extends}".`); return p; }
            const merged = U.merge(this._resolveExtends(cat, base, depth + 1), p);
            delete merged.extends;
            return merged;
        }
        theme(nameOrObj) {
            let base = {};
            const dfltName = U.pick(this.json, 'defaults.theme');
            if (typeof nameOrObj === 'string') {
                base = this.themes[nameOrObj];
                if (!base) {
                    Log.warn('theme:' + nameOrObj, `Theme "${nameOrObj}" not found — using "${dfltName}".`);
                    base = this.themes[dfltName] || {};
                }
                return this._themeExtends(base);
            }
            if (U.isObj(nameOrObj)) {
                const parent = nameOrObj.extends ? this.themes[nameOrObj.extends] : this.themes[dfltName];
                return U.merge(this._themeExtends(parent || {}), nameOrObj);
            }
            return this._themeExtends(this.themes[dfltName] || {});
        }
        _themeExtends(t, d = 0) {
            if (!t || !t.extends || d > 6) return t || {};
            return U.merge(this._themeExtends(this.themes[t.extends] || {}, d + 1), t);
        }
    }

    /* ════════════════════════════════════════════════════════════════════
     * 5. TEXT MARKUP + SENTENCE FRAGMENTATION
     *
     *   "Paper planes glide on [thin air](highlight underline) | then *land*."
     *   [text](tags)  → span with tags (supplements, style, motion overrides)
     *   *text*        → span with the "em" tag (alias configured in presets)
     *   |             → forced shot break (new camera angle)
     *   \n            → forced line break inside a shot
     * Tag syntax: name  |  name:arg1,arg2  (use _ for spaces inside args)
     * ════════════════════════════════════════════════════════════════════ */
    function parseTagString(str, lib) {
        const out = [];
        const expand = (tok, depth) => {
            if (!tok) return;
            const idx = tok.indexOf(':');
            const name = idx >= 0 ? tok.slice(0, idx) : tok;
            const argStr = idx >= 0 ? tok.slice(idx + 1) : '';
            const alias = lib.tagAliases[name];
            if (alias != null && depth < 5) {
                String(alias).split(/\s+/).forEach(a => expand(argStr && a.indexOf(':') < 0 ? a + ':' + argStr : a, depth + 1));
                return;
            }
            out.push({ name, args: argStr ? argStr.split(',').map(a => a.replace(/_/g, ' ')) : [] });
        };
        String(str || '').trim().split(/\s+/).forEach(t => expand(t, 0));
        return out;
    }

    /* ─── Unicode-safe text units ───────────────────────────────────────
     * Grapheme clusters (emoji ZWJ sequences, flags, skin tones stay whole)
     * + Indic conjunct merging: a cluster ending in a virama/halant (्) or
     * followed by a combining mark/ZWJ is glued to its neighbour, so
     * "क्ष", "र्क", "त्र", "श्री" never fall apart.                        */
    const SEGMENTER = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
    const VIRAMA_END = /[्্੍્୍்్್്්ฺ္្‍]$/;
    const JOIN_START = /^[ऀ-ःऺ-ॏ॑-ॗॢॣঁ-ঃ়-ৗਁ-ਃ਼-ੑઁ-ઃ઼-્ଁ-ଃ଼-ୗஂா-்ఀ-ఄా-ౖಁ-ಃ಼-ೖഀ-ഃ഻-ൗ‌‍️]/;
    function clusters(text) {
        const segs = SEGMENTER ? Array.from(SEGMENTER.segment(text), x => x.segment) : Array.from(text);
        const out = [];
        for (const g of segs) {
            if (out.length && (VIRAMA_END.test(out[out.length - 1]) || JOIN_START.test(g))) out[out.length - 1] += g;
            else out.push(g);
        }
        return out;
    }
    const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
    const hasEmoji = s => EMOJI_RE.test(s);
    /** Scripts that need contextual shaping — animating them letter-by-letter breaks them. */
    let COMPLEX_RE = /[֐-ࣿऀ-෿฀-໿ༀ-࿿က-႟ក-៿᠀-᢯꣠-ꣿ]/;
    const isComplexScript = s => COMPLEX_RE.test(s);
    function applyEmojiShortcodes(src, lib) {
        const map = lib.json.emoji || {};
        return String(src).replace(/:([a-z0-9_+\-]+):/gi, (m, k) => (map[k.toLowerCase()] ? map[k.toLowerCase()] : m));
    }

    function parseMarkup(text, lib, extraTags) {
        const words = [];
        const spans = [];
        let shotBreak = false, lineBreak = false;
        const pushWords = (chunk, span) => {
            const parts = chunk.split(/(\s+|\|)/);
            let first = true;
            for (const part of parts) {
                if (!part) continue;
                // punctuation written right after a tagged span ("[China](em),") belongs to that word
                if (first && !span && words.length && !/^(\s|\|)/.test(part) && /^[^\p{L}\p{N}]+$/u.test(part)) { words[words.length - 1].text += part; first = false; continue; }
                first = false;
                if (part === '|') { shotBreak = true; continue; }
                if (/^\s+$/.test(part)) { if (/\n/.test(part)) lineBreak = true; continue; }
                const w = { text: part, tags: span ? span.tags : [], spanId: span ? span.id : null, shotBreakBefore: shotBreak, lineBreakBefore: lineBreak, index: words.length };
                shotBreak = false; lineBreak = false;
                words.push(w);
                if (span) span.words.push(w.index);
            }
        };
        const re = /\[([^\]]+)\]\(([^)]*)\)|\*([^*]+)\*/g;
        let last = 0, m;
        const src = applyEmojiShortcodes(text == null ? '' : text, lib);
        while ((m = re.exec(src))) {
            pushWords(src.slice(last, m.index), null);
            const spanText = m[1] != null ? m[1] : m[3];
            const tags = parseTagString(m[1] != null ? m[2] : 'em', lib);
            const span = { id: 's' + spans.length, text: spanText, tags, words: [] };
            spans.push(span);
            pushWords(spanText, span);
            last = re.lastIndex;
        }
        pushWords(src.slice(last), null);
        if (extraTags && extraTags.length) {
            // Beat-level tags apply to the whole sentence as one span.
            const all = { id: 's' + spans.length, text: src, tags: extraTags, words: words.map(w => w.index) };
            spans.push(all);
            words.forEach(w => { if (!w.spanId) { w.spanId = all.id; w.tags = extraTags; } else w.tags = w.tags.concat(extraTags); });
        }
        return { words, spans };
    }

    /** Group words into "shots" — each shot gets its own camera angle. */
    function fragment(words, mode, theme, lib) {
        const fr = theme.fragment || {};
        const maxW = Math.max(1, U.num(fr.maxWordsPerShot, 3));
        const minW = Math.max(1, U.num(fr.minWordsPerShot, 1));
        const joiners = new Set((lib.language.joiners || []).map(s => s.toLowerCase()));
        const breakPunct = new RegExp(lib.language.breakAfter || '[,;:.!?…—–]$');
        const isolate = new Set(U.asArray(fr.isolateTags));
        const shots = [];
        let cur = [];
        const flush = () => { if (cur.length) shots.push(cur); cur = []; };
        const bare = w => w.text.replace(/[^\p{L}\p{N}']/gu, '').toLowerCase();
        for (let i = 0; i < words.length; i++) {
            const w = words[i];
            const isIso = w.tags.some(t => isolate.has(t.name));
            if (w.shotBreakBefore) flush();
            if (mode === 'word') { flush(); cur.push(w); flush(); continue; }
            if (mode === 'sentence' || mode === 'manual') { cur.push(w); continue; }
            const prevIso = cur.length && cur[cur.length - 1].tags.some(t => isolate.has(t.name));
            const sameSpan = cur.length && w.spanId && cur[cur.length - 1].spanId === w.spanId;
            if (cur.length && !sameSpan && (isIso || prevIso) && cur.length >= minW) flush();
            cur.push(w);
            const next = words[i + 1];
            const nextSameSpan = next && w.spanId && next.spanId === w.spanId;
            if (nextSameSpan && cur.length < maxW * 2) continue;
            const punct = breakPunct.test(w.text);
            if (mode === 'phrase') { if (punct) flush(); continue; }
            // auto: break on punctuation or size, but never strand a joiner word at the end
            if ((punct && cur.length >= minW) || (cur.length >= maxW && !joiners.has(bare(w)))) flush();
        }
        flush();
        // Never strand a tiny untagged word (e.g. "it.") as its own camera angle.
        // Emoji / punctuation-only words (no letters or digits) always ride along with a neighbour.
        const glyphOnly = g => g.length === 1 && bare(g[0]) === '' && !g[0].tags.some(t => isolate.has(t.name));
        const tiny = g => g.length === 1 && !g[0].shotBreakBefore && (glyphOnly(g) || (!g[0].spanId && bare(g[0]).length <= U.num(fr.tinyWordChars, 3)));
        if (mode === 'auto' || mode === 'phrase') {
            for (let i = shots.length - 1; i >= 0; i--) {
                if (!tiny(shots[i]) || shots.length < 2) continue;
                if (i > 0 && (shots[i - 1].length <= maxW || glyphOnly(shots[i])) && !shots[i - 1].some(w => w.tags.some(t => isolate.has(t.name)))) { shots[i - 1] = shots[i - 1].concat(shots[i]); shots.splice(i, 1); }
                else if (i < shots.length - 1 && !shots[i + 1][0].shotBreakBefore) { shots[i + 1] = shots[i].concat(shots[i + 1]); shots.splice(i, 1); }
            }
        }
        return shots;
    }

    /* ════════════════════════════════════════════════════════════════════
     * 6. TEXT LAYOUT SOLVER
     * Modes (presets.layouts[*].mode): lockup | center | left | cascade | arc
     * ════════════════════════════════════════════════════════════════════ */
    function wordStyle(word, theme, lib, base) {
        const ts = lib.json.typeStyles || {};
        const typo = theme.typography || {};
        const st = { role: typo.defaultRole || 'display', size: 1, color: null, caps: !!typo.caps, italic: false, weight: null, outline: false, chip: false, tracking: U.num(typo.tracking, 0) };
        if (base) Object.assign(st, base);
        for (const tag of word.tags) {
            const def = ts[tag.name];
            if (def) {
                for (const k of Object.keys(def)) {
                    if (k === 'size') st.size *= def.size; else if (k !== 'intent') st[k] = def[k];
                }
            }
            if (tag.name === 'color' && tag.args[0]) st.color = tag.args[0];
            if (tag.name === 'size' && tag.args[0]) st.size *= parseFloat(tag.args[0]) || 1;
            if (tag.name === 'font' && tag.args[0]) st.role = tag.args[0];
        }
        return st;
    }

    function fontFor(theme, st, px) {
        const typo = theme.typography || {};
        const role = typo[st.role] || typo.display || {};
        if (!typo[st.role]) Log.warn('fontrole:' + st.role, `Typography role "${st.role}" missing in theme — using display.`);
        const fam = role.family || SAFE.font;
        const weight = st.weight || role.weight || 700;
        const style = st.italic || role.italic ? 'italic ' : '';
        // Script fallbacks (e.g. Devanagari) and colour-emoji fonts are appended so any Unicode renders.
        const extra = [typo.scriptFallback, typo.emojiFallback].filter(Boolean).join(', ');
        return `${style}${weight} ${Math.max(1, px).toFixed(2)}px "${fam}", ${extra ? extra + ', ' : ''}${role.fallback || SAFE.font}`;
    }

    function layoutShot(words, theme, lib, layoutPreset, measure, frame) {
        const typo = theme.typography || {};
        const lp = layoutPreset || {};
        const mode = lp.mode || 'center';
        const unit = 100;
        // Portrait / square frames get a wider text column and more lines (Reels, Shorts, feeds).
        const portrait = frame.width < frame.height * 0.95;
        const W = frame.width * (portrait ? U.num(U.pick(theme, 'layout.portraitWidth'), 0.88) : U.num(lp.width, U.num(U.pick(theme, 'layout.shotWidth'), 0.7)));
        const H = frame.height * U.num(lp.height, U.num(U.pick(theme, 'layout.shotHeight'), 0.62)) * (portrait ? U.num(U.pick(theme, 'layout.portraitHeight'), 0.6) : 1);
        const maxLines = Math.max(1, U.num(lp.maxLines, U.num(U.pick(theme, 'layout.maxLines'), 3)) + (portrait ? U.num(U.pick(theme, 'layout.portraitExtraLines'), 1) : 0));
        const lh = U.num(lp.lineHeight, U.num(typo.lineHeight, 1.0));
        const minPx = U.num(typo.minSize, 40) * frame.scale, maxPx = U.num(lp.maxSize, U.num(typo.maxSize, SAFE.size * 2)) * frame.scale;
        const joiners = new Set((lib.language.joiners || []).map(s => s.toLowerCase()));

        const items = words.map(w => {
            const st = wordStyle(w, theme, lib, lp.style);
            const text = st.caps ? w.text.toUpperCase() : w.text;
            const f = fontFor(theme, st, unit * st.size);
            const width = measure(text, f) + st.tracking * unit * st.size * Math.max(0, text.length - 1);
            const space = measure(' ', f) * U.num(typo.wordSpacing, 1);
            return { w, st, text, width, space, forced: w.lineBreakBefore };
        });

        // candidate line breaks
        const breakInto = L => {
            const total = items.reduce((s, it) => s + it.width + it.space, 0);
            const target = total / L;
            const lines = [[]];
            let acc = 0;
            items.forEach((it, i) => {
                const line = lines[lines.length - 1];
                const joinerEnd = line.length && joiners.has(line[line.length - 1].text.toLowerCase());
                if (line.length && (it.forced || (acc + it.width / 2 > target && lines.length < L && !joinerEnd))) { lines.push([]); acc = 0; }
                lines[lines.length - 1].push(it);
                acc += it.width + it.space;
                void i;
            });
            return lines;
        };
        const lineWidth = line => line.reduce((s, it, i) => s + it.width + (i ? line[i - 1].space : 0), 0);
        const lineSize = line => Math.max(...line.map(it => it.st.size));

        let best = null;
        for (let L = 1; L <= Math.min(maxLines, items.length); L++) {
            const lines = breakInto(L);
            let px;
            if (mode === 'lockup') {
                const scales = lines.map(l => U.clamp(W / lineWidth(l), minPx / unit, maxPx / unit));
                const h = lines.reduce((s, l, i) => s + unit * scales[i] * lineSize(l) * lh, 0);
                const fit = Math.min(1, H / h);
                px = { scales: scales.map(s => s * fit), score: Math.min(...scales) * fit * unit };
            } else {
                const maxLW = Math.max(...lines.map(lineWidth));
                const h = lines.reduce((s, l) => s + unit * lineSize(l) * lh, 0);
                const s = Math.min(W / maxLW, H / h, maxPx / unit);
                px = { scales: lines.map(() => Math.max(s, minPx / unit)), score: s * unit };
            }
            if (!best || px.score > best.score * U.num(lp.linePreference, 1.08)) best = { lines, ...px };
        }
        if (!best) return { words: [], w: 0, h: 0, lines: [] };

        // position words
        const out = [];
        const lineBoxes = [];
        let y = 0;
        const cascade = U.num(lp.cascadeStep, 0.08) * W;
        best.lines.forEach((line, li) => {
            const s = best.scales[li];
            const lsz = lineSize(line) * unit * s;
            const asc = lsz * U.num(typo.ascent, 0.78);
            y += asc;
            const lw = lineWidth(line) * s;
            let x;
            if (mode === 'left') x = -W / 2;
            else if (mode === 'cascade') x = -lw / 2 + (li - (best.lines.length - 1) / 2) * cascade;
            else x = -lw / 2;
            const lineStartX = x;
            line.forEach((it, i) => {
                const px = unit * it.st.size * s;
                const font = fontFor(theme, it.st, px);
                const chars = [];
                let prefix = '';
                const tr = it.st.tracking * px;
                const units = clusters(it.text);
                for (let c = 0; c < units.length; c++) {
                    const ch = units[c];
                    const dx = measure(prefix, font) + tr * c;
                    const cw = measure(ch, font);
                    chars.push({ ch, dx, w: cw, emoji: hasEmoji(ch) });
                    prefix += ch;
                }
                const width = it.width * s;
                out.push({
                    src: it.w, text: it.text, style: it.st, font, size: px, x, y, width,
                    ascent: px * U.num(typo.ascent, 0.78), descent: px * U.num(typo.descent, 0.24),
                    chars, line: li, rot: 0
                });
                x += width + (i < line.length - 1 ? it.space * s : 0);
            });
            lineBoxes.push({ x: lineStartX, y: y - asc, w: x - lineStartX, h: lsz * lh, baseline: y });
            y += lsz * lh - asc;
        });
        // centre vertically
        const totalH = y;
        out.forEach(o => { o.y -= totalH / 2; });
        lineBoxes.forEach(b => { b.y -= totalH / 2; b.baseline -= totalH / 2; });

        if (mode === 'arc' && out.length) {
            // Bend the words along an arc (whimsical banner). radius from preset.
            const R = U.num(lp.arcRadius, 1.4) * W;
            out.forEach(o => {
                const cx = o.x + o.width / 2;
                const a = cx / R;
                const ox = Math.sin(a) * R, oy = R - Math.cos(a) * R;
                const dir = U.num(lp.arcDirection, 1); // 1 = arch (ends dip), -1 = smile
                o.x = ox - o.width / 2; o.y += oy * dir; o.rot = a * (180 / Math.PI) * dir;
            });
        }
        const minX = Math.min(...out.map(o => o.x)), maxX = Math.max(...out.map(o => o.x + o.width));
        return { words: out, lines: lineBoxes, w: maxX - minX, h: totalH, minX, maxX };
    }

    /* ════════════════════════════════════════════════════════════════════
     * 7. CONTENT ADAPTERS — backward compatibility with D3 Annotation Studio
     *
     * Accepts, and normalises into native {meta, theme, scenes[]}:
     *   • native kinetic content                 { scenes: [...] }
     *   • Annotation Studio project (v3.x)       { version, annotations, objects, canvasSettings }
     *   • d3-annotation JSON array               [ { type:"d3.annotationLabel", note:{title,label} } ]
     *   • custom-pattern apply() result          { nodes, guidelines }
     *   • plain text (paragraphs → scenes, sentences → beats)
     * Every legacy key (typeKey, title, label, color, fonts, badgeText,
     * connectorType, dx/dy, _numberingValue, motion…) is honoured.
     * ════════════════════════════════════════════════════════════════════ */
    const BULLET_RE = /^\s*(?:[•▸→◆✓★–\-*]|\d+[.)]|[a-z][.)])\s+/i;

    function splitSentences(text, lib) {
        const re = new RegExp(lib.language.sentenceSplit || '(?<=[.!?…])\\s+(?=[\\p{Lu}\\p{N}"“\\[*])', 'u');
        return String(text).split(/\n{2,}/).flatMap(p => p.split(re)).map(s => s.trim()).filter(Boolean);
    }

    function detectFormat(input) {
        if (typeof input === 'string') {
            const s = input.trim();
            if (s[0] === '{' || s[0] === '[') { try { return detectFormat(JSON.parse(s)); } catch (e) { return { kind: 'text', data: input }; } }
            return { kind: 'text', data: input };
        }
        if (Array.isArray(input)) return { kind: 'd3', data: input };
        if (U.isObj(input)) {
            if (Array.isArray(input.scenes)) return { kind: 'native', data: input };
            if (Array.isArray(input.annotations)) return { kind: 'project', data: input };
            if (Array.isArray(input.nodes)) return { kind: 'pattern', data: input };
            if (typeof input.text === 'string') return { kind: 'text', data: input.text, meta: input };
        }
        return { kind: 'unknown', data: input };
    }

    /** Normalise one legacy annotation (project or d3 flavour) to a flat node. */
    function flattenAnnotation(a) {
        const note = a.note || {};
        let typeKey = a.typeKey || a.type || 'annotationLabel';
        if (typeof typeKey === 'string') typeKey = typeKey.replace(/^d3\./, '');
        return Object.assign({}, a, {
            typeKey,
            title: note.title != null ? note.title : a.title || '',
            label: note.label != null ? note.label : a.label || '',
            color: a.color || (note && note.color) || null
        });
    }

    function fillTemplate(str, node) {
        return String(str).replace(/\{(\w+)\}/g, (_, k) => (node[k] == null ? '' : String(node[k]).replace(/\s+/g, '_')));
    }

    /** Reading order: explicit numbering → badge number → top-to-bottom, left-to-right. */
    function orderNodes(nodes) {
        const num = n => {
            if (n._numberingValue != null && !isNaN(parseFloat(n._numberingValue))) return parseFloat(n._numberingValue);
            if (n.motion && n.motion.order != null) return +n.motion.order;
            if (n.badgeText != null && !isNaN(parseFloat(n.badgeText))) return parseFloat(n.badgeText);
            return null;
        };
        return nodes.map((n, i) => ({ n, i, k: num(n) })).sort((A, B) => {
            if (A.k != null && B.k != null && A.k !== B.k) return A.k - B.k;
            if (A.k != null && B.k == null) return -1;
            if (B.k != null && A.k == null) return 1;
            const ay = U.num(A.n.y, 0), by = U.num(B.n.y, 0);
            if (Math.abs(ay - by) > 40) return ay - by;
            return U.num(A.n.x, 0) - U.num(B.n.x, 0) || A.i - B.i;
        }).map(o => o.n);
    }

    /** Convert legacy annotation nodes into kinetic scenes. */
    function annotationsToScenes(nodes, lib, opts) {
        opts = opts || {};
        const map = lib.annotationTypes || {};
        const perScene = Math.max(1, U.num(opts.annotationsPerScene, U.num(U.pick(lib.json, 'defaults.annotationsPerScene'), 1)));
        const ordered = orderNodes(nodes.map(flattenAnnotation)).filter(n => (n.title || n.label || '').trim());
        const scenes = [];
        for (let i = 0; i < ordered.length; i += perScene) {
            const group = ordered.slice(i, i + perScene);
            const scene = { id: 'ann-' + i, title: group[0].title || group[0].label.split('\n')[0], beats: [], annotations: [], legacy: group };
            group.forEach(n => {
                const m = map[n.typeKey] || map.__default || {};
                if (!map[n.typeKey]) Log.warn('anntype:' + n.typeKey, `No annotationTypes mapping for "${n.typeKey}" — using __default.`);
                const mo = n.motion || {};
                const titleTags = [m.titleTags, mo.tags].filter(Boolean).map(t => fillTemplate(t, n)).join(' ');
                const typo = {};
                if (n.titleFont) typo.display = { family: n.titleFont, weight: n.titleFontWeight || undefined };
                if (n.labelFont) typo.body = { family: n.labelFont, weight: n.labelFontWeight || undefined };
                if (Object.keys(typo).length) scene.typography = U.merge(scene.typography || {}, typo);
                if (n.color) scene.palette = U.merge(scene.palette || {}, { accent: n.color });
                if (n.title) {
                    scene.beats.push({
                        text: n.title, tags: titleTags, role: m.titleRole, split: mo.split || m.titleSplit,
                        entry: mo.entry || m.titleEntry, emphasis: mo.emphasis || m.titleEmphasis, exit: mo.exit, staging: mo.staging, layout: mo.layout || m.titleLayout,
                        cameraMoves: mo.camera ? U.asArray(mo.camera) : undefined,
                        recipe: mo.recipe || m.titleRecipe || undefined
                    });
                }
                if (n.label) {
                    const lines = String(n.label).split(/\n+/).map(s => s.trim()).filter(Boolean);
                    const bulletList = lines.filter(l => BULLET_RE.test(l)).length >= Math.max(1, lines.length / 2);
                    const beats = bulletList ? lines.map(l => l.replace(BULLET_RE, '')) : splitSentences(lines.join(' '), lib);
                    beats.forEach((t, bi) => scene.beats.push({
                        text: t, role: m.labelRole, tags: bulletList ? fillTemplate(m.bulletTags || '', Object.assign({ index: bi + 1 }, n)) : fillTemplate(m.labelTags || '', n),
                        layout: m.labelLayout, entry: mo.labelEntry || m.labelEntry, split: m.labelSplit,
                        recipe: mo.labelRecipe || m.labelRecipe || undefined
                    }));
                }
                if (mo.transition) scene.transition = mo.transition;
                if (mo.background) scene.background = mo.background;
            });
            scenes.push(scene);
        }
        return scenes;
    }

    function normalizeContent(input, lib, opts) {
        const f = detectFormat(input);
        const dflt = lib.json.defaults || {};
        let content;
        switch (f.kind) {
            case 'native': content = U.clone(f.data); break;
            case 'text': {
                const paras = String(f.data).split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
                content = U.merge(f.meta ? { meta: f.meta.meta, theme: f.meta.theme } : {}, {
                    scenes: paras.map((p, i) => ({ id: 'p' + i, beats: splitSentences(p, lib) }))
                });
                break;
            }
            case 'd3': content = { meta: {}, scenes: annotationsToScenes(f.data, lib, opts) }; break;
            case 'project': {
                const p = f.data;
                const cs = p.canvasSettings || {};
                const guides = (p.objects || []).filter(o => o.type === 'rect' || o.type === 'circle').map(o => (o.type === 'rect'
                    ? { kind: 'rect', x: o.x, y: o.y, w: o.width, h: o.height, stroke: o.shapeColor }
                    : { kind: 'circle', cx: o.x + o.width / 2, cy: o.y + o.height / 2, r: Math.min(o.width, o.height) / 2, stroke: o.shapeColor }));
                content = {
                    meta: { title: p.title || (opts && opts.title), sourceFormat: 'annotation-project-' + (p.version || '?'), sourceSize: { w: p.canvasWidth || cs.customWidth, h: p.canvasHeight || cs.customHeight } },
                    theme: cs.bgColor && cs.bgColor !== 'transparent' ? { palette: { paper: cs.bgColor } } : undefined,
                    scenes: annotationsToScenes(p.annotations, lib, opts)
                };
                if (guides.length) content.scenes.forEach(s => { s.guides = guides; });
                break;
            }
            case 'pattern': {
                const r = f.data;
                content = { meta: {}, scenes: annotationsToScenes(r.nodes, lib, opts) };
                if (r.guidelines && r.guidelines.length) content.scenes.forEach(s => { s.guides = r.guidelines; s.guideSize = { w: r.requiredW, h: r.requiredH }; });
                break;
            }
            default:
                Log.warn('format:unknown', 'Unrecognised content format — nothing to animate.');
                content = { scenes: [] };
        }
        content.meta = U.merge({ width: dflt.width, height: dflt.height, fps: dflt.fps }, content.meta || {});
        // Scenes that carry only legacy annotations (no beats) are expanded in place.
        content.scenes = (content.scenes || []).flatMap(s => {
            if ((!s.beats || !s.beats.length) && Array.isArray(s.annotations) && s.annotations.length && !s.pattern) {
                return annotationsToScenes(s.annotations, lib, opts).map(x => U.merge(s, x, { annotations: [] }));
            }
            return [s];
        });
        content._format = f.kind;
        return content;
    }

    /** Pull guidelines (+ nodes when a scene has no beats) from the live CustomPatternRegistry. */
    function resolvePatternScene(scene, lib, frame) {
        const reg = typeof window !== 'undefined' ? window.CustomPatternRegistry : null;
        if (!scene.pattern) return;
        const spec = typeof scene.pattern === 'string' ? { id: scene.pattern } : scene.pattern;
        if (!reg || typeof reg.safeApply !== 'function') {
            Log.warn('pattern:noreg', `Scene "${scene.id}" references pattern "${spec.id}" but CustomPatternRegistry is not loaded.`);
            return;
        }
        const items = (scene.beats || []).map(b => (typeof b === 'string' ? { title: b } : { title: b.text }));
        const res = reg.safeApply(spec.id, { width: frame.width, height: frame.height, count: spec.count || items.length || undefined, items, options: spec.options || {} });
        if (res.error) { Log.warn('pattern:' + spec.id, `Pattern "${spec.id}": ${res.error}`); return; }
        scene.guides = (scene.guides || []).concat(res.guidelines || []);
        scene.guideSize = { w: res.requiredW || frame.width, h: res.requiredH || frame.height };
        if ((!scene.beats || !scene.beats.length) && res.nodes && res.nodes.length) {
            const expanded = annotationsToScenes(res.nodes, lib, { annotationsPerScene: res.nodes.length })[0];
            if (expanded) { scene.beats = expanded.beats; scene.palette = U.merge(expanded.palette || {}, scene.palette || {}); }
        }
    }

    /* ════════════════════════════════════════════════════════════════════
     * 8. COMPILER — content JSON → deterministic Timeline
     * All world units are "design pixels" at a 1080-px-tall frame; the
     * renderer scales to the requested output resolution.
     * ════════════════════════════════════════════════════════════════════ */
    const POSE_KEYS = ['tx', 'ty', 'tz', 'rotX', 'rotY', 'rotZ', 'dist', 'fov', 'fx', 'fy', 'fz', 'aperture', 'mblur'];

    function cycle(list, i, fallback) {
        const arr = U.asArray(list);
        return arr.length ? arr[i % arr.length] : fallback;
    }

    function stageShots(count, staging, startPose, seed, startIndex) {
        const st = staging || {};
        const poses = [];
        const alt = new Set(U.asArray(st.alternate));
        const R = rng(seed);
        let p = Object.assign({ x: 0, y: 0, z: 0, rotX: 0, rotY: 0, rotZ: 0 }, startPose || {});
        for (let k = 0; k < count; k++) {
            const i = startIndex + k;
            if (st.type === 'ring') {
                const a = U.deg(U.num(st.angleStep, 50) * i + U.num(st.angleStart, 0));
                const r = U.num(st.radius, 1600);
                const q = {
                    x: Math.sin(a) * r, z: r - Math.cos(a) * r, y: U.num(U.pick(st, 'step.y'), 0) * i,
                    rotX: U.num(U.pick(st, 'step.rotX'), 0) * i, rotY: -(a * 180) / Math.PI * U.num(st.facing, 1), rotZ: 0
                };
                for (const j of Object.keys(st.jitter || {})) q[j] += (R() * 2 - 1) * st.jitter[j];
                poses.push(q);
                continue;
            }
            if (i > 0 || k > 0) {
                const sgn = i % 2 === 0 ? -1 : 1;
                for (const key of ['x', 'y', 'z', 'rotX', 'rotY', 'rotZ']) {
                    const step = U.num(U.pick(st, 'step.' + key), 0);
                    p[key] += alt.has(key) ? step * sgn : step;
                }
            }
            const q = Object.assign({}, p);
            if (alt.has('absolute')) for (const key of ['x', 'rotY', 'rotZ']) q[key] = U.num(U.pick(st, 'step.' + key), 0) * (i % 2 ? 1 : -1) * 0.5;
            for (const j of Object.keys(st.jitter || {})) q[j] += (R() * 2 - 1) * st.jitter[j];
            poses.push(q);
        }
        return { poses, last: p };
    }

    /** Parse "shot:2+0.4", "beat:1", or seconds, into scene-local time. */
    function resolveAt(at, sceneData) {
        if (typeof at === 'number') return at;
        const m = String(at).match(/^(shot|beat|end)(?::(\d+))?([+-][\d.]+)?$/);
        if (!m) return 0;
        const off = m[3] ? parseFloat(m[3]) : 0;
        if (m[1] === 'end') return sceneData.dur + off;
        const list = m[1] === 'shot' ? sceneData.shots : sceneData.beatTimes;
        const it = list[Math.min(list.length - 1, +m[2] || 0)];
        return (it ? (m[1] === 'shot' ? it.start : it.start) : 0) + off;
    }


    /* ─── Visual blocks (maps, media, SVG, charts…) are plug-ins ─── */
    const BLOCKS = Object.create(null);
    const BLOCK_TAGS = Object.create(null);
    /**
     * registerBlock(kind, def) — def: { tags:[], fromTag(tag, spanText, ctx), merge(specs), size(spec, ctx),
     *   duration(spec, ctx), prepare(spec, ctx), draw(R, shotSpace, block, localT, out), preload(spec, ctx),
     *   framingScale, captionDelay, exitDuration }
     */
    function registerBlock(kind, def) {
        BLOCKS[kind] = def;
        U.asArray(def.tags).forEach(tg => { BLOCK_TAGS[tg] = kind; });
    }
    function collectVisuals(beat, parsed, ctx) {
        const out = [];
        U.asArray(beat.visual || beat.visuals).forEach(v => {
            if (!v) return;
            const kind = v.type || v.kind;
            if (!BLOCKS[kind]) { Log.warn('block:' + kind, `Visual type "${kind}" is not registered (load its plug-in script).`); return; }
            out.push({ kind, spec: v, caption: v.caption, at: v.at, camera: v.camera, captionLayout: v.captionLayout });
        });
        parsed.spans.forEach(span => span.tags.forEach(tag => {
            const kind = BLOCK_TAGS[tag.name];
            if (!kind) return;
            const def = BLOCKS[kind];
            const spec = def.fromTag ? def.fromTag(tag, span.text, ctx) : { query: span.text };
            if (spec) out.push({ kind, spec, caption: spec.caption, at: spec.at, camera: spec.camera });
        }));
        // let a plug-in merge several tags of its kind (e.g. two places → one map with a route)
        const merged = [];
        out.forEach(v => {
            const def = BLOCKS[v.kind];
            const prev = merged.find(m => m.kind === v.kind && def.merge && !m.spec.noMerge && !v.spec.noMerge);
            if (prev) prev.spec = def.merge([prev.spec, v.spec], ctx); else merged.push(v);
        });
        return merged;
    }

    const INDIC_DIGITS = /[०-९০-৯੦-੯૦-૯௦-௯౦-౯೦-೯൦-൯٠-٩۰-۹]/g;
    /** "₹1,20,000", "87%", "१२३", "18.6m" → { prefix, value, suffix, decimals, grouping, numerals } */
    function parseNumberWord(text) {
        let numerals = null;
        const ascii = String(text).replace(INDIC_DIGITS, ch => {
            const c = ch.charCodeAt(0);
            const zero = [0x0966, 0x09E6, 0x0A66, 0x0AE6, 0x0BE6, 0x0C66, 0x0CE6, 0x0D66, 0x0660, 0x06F0].find(z => c >= z && c <= z + 9);
            numerals = { 0x0966: 'deva', 0x09E6: 'beng', 0x0A66: 'guru', 0x0AE6: 'gujr', 0x0BE6: 'tamldec', 0x0C66: 'telu', 0x0CE6: 'knda', 0x0D66: 'mlym', 0x0660: 'arab', 0x06F0: 'arabext' }[zero];
            return String(c - zero);
        });
        const m = ascii.match(/^([^\d-]*)(-?[\d,]*\.?\d+)(.*)$/);
        if (!m) return null;
        return { prefix: m[1], value: parseFloat(m[2].replace(/,/g, '')), suffix: m[3], decimals: (m[2].split('.')[1] || '').length, grouping: /,/.test(m[2]), numerals };
    }


    /* ─── Recipes: presets.recipes[name] bundles beat/scene choices under one semantic name ─── */
    const BEAT_RECIPE_KEYS = ['entry', 'emphasis', 'exit', 'idle', 'layout', 'staging', 'cameraMoves', 'split', 'strip', 'role', 'speed', 'captionLayout', 'tags'];
    const SCENE_RECIPE_KEYS = ['background', 'transition', 'staging', 'layout', 'exitMode', 'outro', 'split', 'palette', 'camera'];
    function recipeFields(lib, name, keys) {
        const all = lib.json.recipes || {};
        let r = all[name];
        if (!r) { Log.warn('recipe:' + name, `Recipe "${name}" not found in presets.recipes — ignored.`); return {}; }
        for (let d = 0; r.extends && d < 5; d++) r = U.merge(all[r.extends] || {}, Object.assign({}, r, { extends: undefined }));
        const out = {};
        keys.forEach(k => { if (r[k] != null) out[k] = U.clone(r[k]); });
        return out;
    }

    function framingPose(shot, move, theme, focal, seed) {
        const fr = (move && move.framing) || {};
        const cam = theme.camera || {};
        const R = rng(seed);
        const jit = cam.angleJitter || {};
        const ks = U.num(shot.framingScale, 1); // flat subjects (maps, charts) are framed closer to head-on
        return {
            tx: shot.pose.x, ty: shot.pose.y, tz: shot.pose.z,
            rotX: shot.pose.rotX + (U.num(fr.rotX, 0) + (R() * 2 - 1) * U.num(jit.rotX, 0)) * ks,
            rotY: shot.pose.rotY + (U.num(fr.rotY, 0) + (R() * 2 - 1) * U.num(jit.rotY, 0)) * ks,
            rotZ: shot.pose.rotZ + (U.num(fr.rotZ, 0) + (R() * 2 - 1) * U.num(jit.rotZ, 0)) * ks,
            dist: focal * U.num(fr.zoom, U.num(cam.framingZoom, 1.1)),
            fov: U.num(cam.fov, 40),
            fx: shot.pose.x, fy: shot.pose.y, fz: shot.pose.z,
            aperture: U.num(fr.aperture, U.num(cam.aperture, 0)),
            mblur: U.num(move && move.motionBlur, U.num(cam.motionBlur, 0))
        };
    }

    function compile(input, presetsJson, options) {
        options = options || {};
        const lib = presetsJson instanceof PresetLib ? presetsJson : new PresetLib(presetsJson);
        const content = normalizeContent(input, lib, options);
        const meta = content.meta || {};
        const designH = U.num(U.pick(lib.json, 'defaults.designHeight'), 1080);
        const outW = U.num(options.width, U.num(meta.width, SAFE.width));
        const outH = U.num(options.height, U.num(meta.height, SAFE.height));
        const frame = { width: outW * (designH / outH), height: designH, outW, outH, fps: U.num(options.fps, U.num(meta.fps, SAFE.fps)), scale: 1 };
        const baseTheme = lib.theme(options.theme || content.theme || meta.theme);
        const contentDefaults = content.defaults || {};
        const measure = makeMeasurer(options.measureCtx);
        const seedBase = meta.seed != null ? String(meta.seed) : 'kinetic';
        const pace = U.num(meta.pace, 1);

        const scenes = [];
        let cursor = 0;

        (content.scenes || []).forEach((sc, si) => {
            if (sc.recipe) sc = Object.assign({}, recipeFields(lib, sc.recipe, SCENE_RECIPE_KEYS), sc);
            const theme = U.merge(baseTheme, sc.theme || {}, sc.palette ? { palette: sc.palette } : {}, sc.typography ? { typography: sc.typography } : {});
            const D = U.merge(lib.json.defaults || {}, theme.defaults || {}, contentDefaults, sc.defaults || {});
            const timing = U.merge(theme.timing || {}, sc.timing || {});
            const focal = (frame.height / 2) / Math.tan(U.deg(U.num(U.pick(theme, 'camera.fov'), 40)) / 2);
            if (sc.pattern) resolvePatternScene(sc, lib, frame);
            const seed = `${seedBase}:${si}`;

            const stagingName = sc.staging || cycle(D.stagingCycle, si, D.staging);
            let stagingState = { last: null, index: 0 };
            const shots = [];
            const supps = [];
            const beatTimes = [];
            let t = U.num(timing.sceneLead, 0.3);
            const beats = U.asArray(sc.beats);

            const blockCtx = { lib, theme, frame, meta, measure, scene: sc };
            beats.forEach((rawBeat, bi) => {
                let beat = typeof rawBeat === 'string' ? { text: rawBeat } : Object.assign({}, rawBeat);
                Object.keys(beat).forEach(k => { if (beat[k] === undefined || beat[k] === null) delete beat[k]; });
                // recipes: named bundles of motion choices (definition, question, warning…) — explicit beat fields win
                const recipeName = beat.recipe || sc.beatRecipe || sc.recipe || null;
                if (recipeName) {
                    const r = recipeFields(lib, recipeName, BEAT_RECIPE_KEYS);
                    const rTags = r.tags; delete r.tags;
                    beat = Object.assign({}, r, beat);
                    if (rTags) beat.tags = [rTags, beat.tags].flat().filter(Boolean).join(' ');
                }
                const beatTags = beat.tags ? (Array.isArray(beat.tags) ? beat.tags.join(' ') : beat.tags) : '';
                const parsed = parseMarkup(beat.text || '', lib, beatTags ? parseTagString(beatTags, lib) : null);
                blockCtx.beatText = beat.text || '';
                const visuals = collectVisuals(beat, parsed, blockCtx);
                if (!parsed.words.length && !visuals.length) return;
                const split = beat.split || sc.split || D.split || 'auto';
                const captioned = visuals.length && visuals[0].caption !== false && parsed.words.length && parsed.words.length <= U.num(timing.maxCaptionWords, 16);
                // Shot plan: visual blocks (optionally carrying the sentence as a caption) + kinetic text shots.
                const plan = [];
                if (captioned) {
                    plan.push({ visual: visuals[0], words: parsed.words });
                    visuals.slice(1).forEach(v => plan.push({ visual: v, words: [] }));
                } else {
                    const groups = parsed.words.length ? fragment(parsed.words, split, theme, lib) : [];
                    const before = visuals.filter(v => v.at !== 'after'), after = visuals.filter(v => v.at === 'after');
                    before.forEach(v => plan.push({ visual: v, words: [] }));
                    groups.forEach(g => plan.push({ visual: null, words: g }));
                    after.forEach(v => plan.push({ visual: v, words: [] }));
                }
                let speed = U.num(beat.speed, 1) * pace;
                // Voice-over sync: squeeze visuals if narration is faster than the natural pacing.
                const voice = beat.voice && beat.voice.duration ? beat.voice : null;
                const voiceLead = U.num(timing.voiceLead, 0.25);
                if (voice) {
                    const est = plan.reduce((s0, it) => s0 + (it.visual ? 1.6 : 1.3) + it.words.length / U.num(timing.wordsPerSecond, 3), 0);
                    const k = est / Math.max(0.5, voice.duration);
                    if (k > 1.05) speed *= Math.min(U.num(timing.maxVoiceSqueeze, 2.2), k);
                }
                const staging = lib.get('staging', beat.staging || stagingName, theme);
                const staged = stageShots(plan.length, staging, stagingState.last, seed + ':stage:' + bi, stagingState.index);
                stagingState = { last: staged.last, index: stagingState.index + plan.length };
                const beatStart = t;
                const beatShots = [];

                plan.forEach((item, gi) => {
                    const gw = item.words;
                    const shotIndex = shots.length;
                    const moveName = U.asArray(beat.cameraMoves).length ? cycle(beat.cameraMoves, gi) : cycle(U.pick(sc, 'camera.moves') || D.cameraMoves, shotIndex + si, D.camera);
                    const move = lib.get('camera', item.visual && item.visual.camera ? item.visual.camera : moveName, theme) || {};
                    const mdur = U.num(move.duration, SAFE.duration) / speed;
                    // voice: land the first word of this shot as it is spoken
                    if (voice && gw.length && voice.wordTimes && voice.wordTimes[gw[0].index] != null) {
                        const want = beatStart + voiceLead + voice.wordTimes[gw[0].index] - mdur * U.num(timing.entryAtCamera, 0.5) - U.num(timing.voiceAnticipation, 0.1);
                        if (want > t) t = want;
                    }
                    const layoutName = beat.layout || sc.layout || cycle(D.layoutCycle, shotIndex + si, D.layout);
                    let layoutP = lib.get('layouts', item.visual ? (beat.captionLayout || item.visual.captionLayout || D.captionLayout || layoutName) : layoutName, theme) || {};
                    const baseStyle = beat.role ? { role: beat.role } : null;
                    let block = null, lay;
                    if (item.visual) {
                        const def = BLOCKS[item.visual.kind];
                        const size = def.size ? def.size(item.visual.spec, blockCtx) : { w: frame.width * 0.6, h: frame.height * 0.5 };
                        const capFrac = gw.length ? U.num(layoutP.captionHeight, 0.2) : 0;
                        const maxH = frame.height * U.num(U.pick(theme, 'layout.blockHeight'), 0.8) * (1 - capFrac);
                        const k = Math.min(1, maxH / size.h, (frame.width * U.num(U.pick(theme, 'layout.blockWidth'), 0.88)) / size.w);
                        block = { kind: item.visual.kind, def, spec: item.visual.spec, w: size.w * k, h: size.h * k, cx: 0, cy: 0, seed: seed + ':blk:' + shotIndex };
                        if (gw.length) {
                            lay = layoutShot(gw, theme, lib, U.merge(layoutP, { width: U.num(layoutP.width, 0.8), height: capFrac, maxLines: U.num(layoutP.maxLines, 2) }, baseStyle ? { style: baseStyle } : {}), measure, frame);
                            const gap = frame.height * U.num(layoutP.captionGap, 0.035);
                            const total = block.h + gap + lay.h;
                            block.cy = -total / 2 + block.h / 2;
                            const dy = block.cy + block.h / 2 + gap + lay.h / 2;
                            lay.words.forEach(w => { w.y += dy; });
                            lay.lines.forEach(l => { l.y += dy; l.baseline += dy; });
                        } else lay = { words: [], lines: [], w: 0, h: 0, minX: 0, maxX: 0 };
                    } else {
                        lay = layoutShot(gw, theme, lib, U.merge(layoutP, baseStyle ? { style: baseStyle } : {}), measure, frame);
                    }
                    const entryName = beat.entry || cycle(D.entryCycle, shotIndex + si * 3, D.entry);
                    const shot = {
                        index: shotIndex, beat: bi, pose: staged.poses[gi], layout: lay, layoutPreset: layoutP,
                        move, moveName: item.visual && item.visual.camera ? item.visual.camera : moveName, words: [], strips: [], seed: seed + ':shot:' + shotIndex,
                        block, framingScale: block ? U.num(block.def.framingScale, 0.5) : 1
                    };
                    shot.start = t;
                    shot.arrive = t + mdur;
                    let entryAt = t + mdur * U.num(timing.entryAtCamera, 0.5);
                    if (block) {
                        block.entryStart = entryAt;
                        block.dur = Math.max(0.5, (block.def.duration ? block.def.duration(block.spec, blockCtx) : 2.5)) / speed;
                        block.prepared = block.def.prepare ? block.def.prepare(block.spec, Object.assign({ block, speed }, blockCtx)) : null;
                        entryAt += U.num(block.def.captionDelay, 0.35) / speed;
                    }

                    // ── strips (paper cut-outs behind text) ──
                    const paper = layoutP.paper || {};
                    const stripMode = gw.length ? (beat.strip || paper.strip || 'none') : 'none';
                    const stripEntry = lib.get('entry', paper.entry || D.stripEntry, theme);
                    if (stripMode !== 'none') {
                        const boxes = stripMode === 'word' ? lay.words.map(w => ({ x: w.x, y: w.y - w.ascent, w: w.width, h: w.ascent + w.descent }))
                            : stripMode === 'shot' ? [{ x: lay.minX, y: lay.lines[0].y, w: lay.w, h: lay.h }]
                                : lay.lines.map(l => ({ x: l.x, y: l.y, w: l.w, h: l.h }));
                        const pad = U.asArray(paper.pad).length ? paper.pad : [0.06, 0.12];
                        boxes.forEach((b2, k) => {
                            const px = Math.max(b2.h * pad[0] * 2, 12), py = b2.h * pad[1];
                            const R = rng(shot.seed + ':strip:' + k);
                            shot.strips.push({
                                x: b2.x - px, y: b2.y - py, w: b2.w + px * 2, h: b2.h + py * 2,
                                rot: (R() * 2 - 1) * U.num(paper.rotJitter, 1.5),
                                color: resolveColor(theme, cycle(U.pick(theme, 'palette.strip') ? U.asArray(theme.palette.strip).map((_, j) => `@strip[${j}]`) : ['@paper2'], k + shotIndex + si)),
                                torn: U.num(paper.torn, 0.5), seed: shot.seed + ':strip:' + k, lift: U.num(paper.lift, 2),
                                entry: stripEntry, entryStart: entryAt + k * U.num(paper.stagger, 0.06), exit: null
                            });
                        });
                    }

                    // ── word + char layers ──
                    const entry = lib.get('entry', entryName, theme);
                    const complexMode = U.pick(theme, 'fragment.complexScript') || 'word';
                    const unit = (entry && entry.stagger && entry.stagger.unit) || 'char';
                    const nWords = lay.words.length;
                    const nChars = lay.words.reduce((s0, w) => s0 + w.chars.length, 0);
                    let charCursor = 0;
                    let entryEnd = entryAt;
                    lay.words.forEach((wl, wi) => {
                        const tagNames = wl.src.tags.map(tg => tg.name);
                        const inTag = wl.src.tags.find(tg => tg.name === 'in');
                        const wEntry = inTag ? lib.get('entry', inTag.args[0], theme) : entry;
                        let wUnit = inTag ? ((wEntry.stagger && wEntry.stagger.unit) || 'char') : unit;
                        // Hindi/Arabic/Thai… need shaping across the whole word: animate the word, never its letters.
                        const complex = isComplexScript(wl.text);
                        if (complex && complexMode === 'word') wUnit = 'word';
                        const edur = U.num(wEntry && wEntry.duration, SAFE.duration) / speed;
                        const staggerUnitWord = wUnit === 'word' || (complex && complexMode === 'word');
                        const wDelay = staggerDelay(wEntry && wEntry.stagger, staggerUnitWord ? wi : charCursor, staggerUnitWord ? nWords : nChars, shot.seed) / speed;
                        const word = {
                            text: wl.text, font: wl.font, size: wl.size, x: wl.x, y: wl.y, width: wl.width, ascent: wl.ascent, descent: wl.descent,
                            rot: wl.rot, style: wl.style, spanId: wl.src.spanId, tags: tagNames, tagObjs: wl.src.tags, seed: shot.seed + ':w' + wi,
                            color: resolveColor(theme, wl.style.color || (stripMode !== 'none' && paper.ink) || null, 'ink'),
                            entry: wEntry, entryStart: entryAt + wDelay, entryDur: edur, unit: wUnit, complex, emoji: hasEmoji(wl.text), srcIndex: wl.src.index,
                            chars: wl.chars.map((c, ci) => Object.assign({}, c, {
                                delay: wUnit === 'char' ? (staggerDelay(wEntry && wEntry.stagger, charCursor + ci, nChars, shot.seed) / speed) - wDelay : 0
                            })),
                            emphasis: [], loop: null, exit: null
                        };
                        const maxCharDelay = word.chars.length ? Math.max(...word.chars.map(c => c.delay)) : 0;
                        word.entryEnd = word.entryStart + edur + maxCharDelay;
                        entryEnd = Math.max(entryEnd, word.entryEnd);
                        charCursor += wl.chars.length;

                        // counters: [1,200](counter) · counter:40-87 · counter:0-18.6,1 · Devanagari digits ok
                        const ctag = wl.src.tags.find(tg => tg.name === 'counter');
                        const numParsed = parseNumberWord(wl.text);
                        if (ctag && numParsed) {
                            const rangeArg = ctag.args[0] || '';
                            const from = rangeArg.includes('-') && rangeArg.indexOf('-') > 0 ? parseFloat(rangeArg.split('-')[0]) : 0;
                            const cp = lib.get('supplements', 'counter', theme) || {};
                            const cst = cp.style || {};
                            word.counter = {
                                from, to: numParsed.value, prefix: numParsed.prefix, suffix: numParsed.suffix,
                                decimals: ctag.args[1] != null && ctag.args[1] !== '' ? +ctag.args[1] : numParsed.decimals,
                                grouping: numParsed.grouping, numerals: numParsed.numerals || meta.numerals || U.pick(theme, 'numbers.numerals'),
                                locale: meta.locale || U.pick(theme, 'numbers.locale') || 'en-US',
                                mode: ctag.args[2] || cst.mode || 'tick',
                                start: word.entryStart + U.num(cp.delay, 0), dur: U.num(cp.duration, 1.2) / speed, ease: cp.ease
                            };
                            word.unit = 'word';
                        }
                        shot.words.push(word);
                    });

                    // ── emphasis, idle loops ──
                    const emphDefault = beat.emphasis || null;
                    shot.words.forEach(w => {
                        const names = [];
                        if (emphDefault) names.push(...U.asArray(emphDefault));
                        if (w.style.emphasis) names.push(w.style.emphasis);
                        w.tagObjs.filter(tg => tg.name === 'fx').forEach(tg => names.push(tg.args[0]));
                        let at = entryEnd + U.num(timing.emphasisDelay, 0.15) / speed;
                        names.forEach(nm => {
                            const p2 = lib.get('emphasis', nm, theme);
                            if (!p2) return;
                            const d = U.num(p2.duration, SAFE.duration) / speed;
                            w.emphasis.push({ preset: p2, start: at + staggerDelay(p2.stagger, shot.words.indexOf(w), shot.words.length, w.seed), dur: d });
                            at += d * U.num(timing.emphasisChain, 0.7);
                        });
                        const loopName = beat.idle || w.style.idle || (w.emoji ? D.emojiIdle : null) || D.idle;
                        w.loop = loopName ? lib.get('loop', loopName, theme) : null;
                    });

                    // reading starts as soon as the first glyphs land; hold a beat after the entry settles
                    const read = Math.max(U.num(timing.minShot, 0.6), nWords / U.num(timing.wordsPerSecond, 3)) / speed;
                    shot.entryEnd = entryEnd;
                    shot.holdEnd = Math.max(entryAt + read, entryEnd) + U.num(timing.shotHold, 0.3) / speed;
                    if (block) shot.holdEnd = Math.max(shot.holdEnd, block.entryStart + block.dur + U.num(timing.shotHold, 0.3) / speed);
                    shot.lastEmph = Math.max(entryEnd, ...shot.words.flatMap(w => w.emphasis.map(e => e.start + e.dur * U.num(timing.emphasisBlocking, 0.5))));
                    shot.holdEnd = Math.max(shot.holdEnd, shot.lastEmph);
                    shot.exitName = beat.exit || D.exit;
                    shot.idx = gi;
                    shots.push(shot);
                    beatShots.push(shot);
                    t = shot.holdEnd;
                });

                // the sentence must stay on screen until its narration ends
                if (voice) {
                    const vEnd = beatStart + voiceLead + voice.duration + U.num(timing.voiceTail, 0.2);
                    if (vEnd > t) { beatShots[beatShots.length - 1].holdEnd = vEnd; t = vEnd; }
                }
                beatTimes.push({ start: beatStart, end: t, shots: beatShots.map(x => x.index), voice: voice ? { id: voice.id, at: beatStart + voiceLead, duration: voice.duration } : null, text: plainText(beat.text || '') });
                beat._shots = beatShots;
                beat._parsed = parsed;
                // supplementary layers from inline tags + beat annotations
                buildSupplements(beat, beatShots, parsed, lib, theme, supps, seed + ':b' + bi, speed);
                t += U.num(timing.beatGap, 0.25) / U.num(beat.speed, 1);
            });

            // scene-level annotations target any beat
            if (Array.isArray(sc.annotations) && sc.annotations.length) {
                const allBeats = beats.map(b => (typeof b === 'string' ? null : b)).filter(b => b && b._shots);
                sc.annotations.forEach((a, ai) => {
                    const target = String(a.target || a.title || '').toLowerCase();
                    const hit = allBeats.find(b => b._parsed.words.some(w => target && w.text.toLowerCase().includes(target.split(/\s+/)[0]))) || allBeats[0];
                    if (hit) buildSupplements({ annotations: [a], _shots: hit._shots }, hit._shots, hit._parsed, lib, theme, supps, seed + ':sa' + ai, 1, true);
                });
            }

            // ── exits ──
            const exitMode = sc.exitMode || D.exitMode || 'shot';
            shots.forEach((s, i) => {
                const next = shots[i + 1];
                const isLastBeat = s.beat === shots[shots.length - 1].beat;
                let exitAt = null;
                if (exitMode === 'shot' && next) exitAt = next.start + U.num(timing.exitDelay, 0.25);
                if (exitMode === 'beat' && next && next.beat !== s.beat) exitAt = next.start;
                if (exitMode === 'beat' && !next && !isLastBeat) exitAt = null;
                if (exitAt == null) return;
                const ex = lib.get('exit', s.exitName, theme);
                const exd = U.num(ex && ex.duration, SAFE.duration);
                s.words.forEach((w, wi) => {
                    const outTag = w.tagObjs.find(tg => tg.name === 'out');
                    w.exit = outTag ? lib.get('exit', outTag.args[0], theme) : ex; w.exitStart = exitAt + staggerDelay(ex && ex.stagger, wi, s.words.length, w.seed); w.exitDur = exd;
                });
                s.strips.forEach((st, k) => { st.exit = ex; st.exitStart = exitAt + k * 0.03; st.exitDur = exd; });
                s.exitAt = exitAt; s.exitEnd = exitAt + exd + staggerDelay(ex && ex.stagger, s.words.length - 1, s.words.length, s.words[0] && s.words[0].seed);
                if (s.block) { s.block.exitStart = exitAt; s.block.exitDur = U.num(s.block.def.exitDuration, 0.6); s.exitEnd = Math.max(s.exitEnd, exitAt + s.block.exitDur); }
            });
            supps.forEach(sp => {
                const s = shots[sp.shot];
                if (s && s.exitAt != null) { sp.exitStart = s.exitAt; sp.exitDur = U.num(sp.preset.exitDuration, 0.35); }
            });

            const natural = t + U.num(timing.sceneTail, 0.6);
            let dur = natural;
            if (sc.duration) {
                // Time-stretch the scene so authored durations are honoured exactly.
                const k = sc.duration / natural;
                stretchScene(shots, supps, beatTimes, k);
                dur = sc.duration;
            }

            const transName = sc.transition || cycle(D.transitionCycle, si, D.transition);
            const trans = typeof transName === 'object' ? U.merge(lib.get('transitions', transName.preset, theme) || {}, transName) : lib.get('transitions', transName, theme);
            const tdur = U.num(trans && trans.duration, SAFE.duration);

            // background + guides
            const bgName = sc.background || cycle(D.backgroundCycle, si, D.background);
            const background = typeof bgName === 'object' ? bgName : lib.get('backgrounds', bgName, theme);

            const scene = {
                index: si, id: sc.id || 'scene-' + si, title: plainText(applyEmojiShortcodes(sc.title || (beats[0] && (typeof beats[0] === 'string' ? beats[0] : beats[0].text)) || '', lib)),
                start: cursor, dur, end: cursor + dur, theme, shots, supps, beatTimes, seed, focal,
                transition: trans, transitionName: typeof transName === 'string' ? transName : transName.preset, transitionDur: tdur,
                background, backgroundName: typeof bgName === 'string' ? bgName : 'custom',
                guides: sc.guides ? { list: sc.guides, size: sc.guideSize || U.pick(meta, 'sourceSize') } : null,
                outro: sc.outro ? lib.get('camera', sc.outro, theme) : null
            };
            scene.camera = buildCamera(scene, sc.camera || {}, lib, theme, focal);
            scenes.push(scene);
            cursor = scene.end - (si < content.scenes.length - 1 ? tdur : 0);
        });

        const duration = scenes.length ? scenes[scenes.length - 1].end : 0;
        // Narration cues in global time — the voice module mixes audio from these.
        const voiceCues = [];
        scenes.forEach(sc2 => sc2.beatTimes.forEach(b => { if (b.voice) voiceCues.push({ id: b.voice.id, t: sc2.start + b.voice.at, duration: b.voice.duration, text: b.text, scene: sc2.index }); }));
        const assets = [];
        scenes.forEach(sc2 => sc2.shots.forEach(sh => { if (sh.block) assets.push({ kind: sh.block.kind, spec: sh.block.spec }); }));
        return {
            version: VERSION, frame, duration, scenes, lib, theme: baseTheme, meta, format: content._format,
            fonts: collectFonts(scenes), warnings: Log.warnings.slice(), voiceCues, assets
        };
    }

    /** Strip inline markup for display labels (scene picker, markers). */
    function plainText(t) {
        return String(t).replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\*([^*]+)\*/g, '$1').replace(/\s*\|\s*/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function stretchScene(shots, supps, beatTimes, k) {
        const sk = ['start', 'arrive', 'entryEnd', 'holdEnd', 'exitAt', 'exitEnd', 'lastEmph'];
        shots.forEach(s => {
            sk.forEach(key => { if (s[key] != null) s[key] *= k; });
            s.words.forEach(w => {
                ['entryStart', 'entryEnd', 'exitStart'].forEach(key => { if (w[key] != null) w[key] *= k; });
                w.entryDur *= k; if (w.exitDur) w.exitDur *= k;
                w.chars.forEach(c => { c.delay *= k; });
                w.emphasis.forEach(e => { e.start *= k; e.dur *= k; });
                if (w.counter) { w.counter.start *= k; w.counter.dur *= k; }
            });
            s.strips.forEach(st => { st.entryStart *= k; if (st.exitStart != null) st.exitStart *= k; });
            if (s.block) { s.block.entryStart *= k; s.block.dur *= k; if (s.block.exitStart != null) s.block.exitStart *= k; }
        });
        supps.forEach(sp => { sp.start *= k; sp.dur *= k; if (sp.exitStart != null) sp.exitStart *= k; });
        beatTimes.forEach(b => { b.start *= k; b.end *= k; if (b.voice) b.voice.at *= k; });
    }

    function collectFonts(scenes) {
        const fams = new Map();
        scenes.forEach(s => {
            const typo = s.theme.typography || {};
            Object.keys(typo).forEach(r => {
                const v = typo[r];
                if (U.isObj(v) && v.family) {
                    const set = fams.get(v.family) || new Set();
                    set.add(v.weight || 400); if (v.italic) set.add('italic');
                    fams.set(v.family, set);
                }
            });
        });
        return Array.from(fams.entries()).map(([family, w]) => ({ family, weights: Array.from(w) }));
    }

    function makeMeasurer(ctx) {
        const cache = new Map();
        let c = ctx;
        if (!c && typeof document !== 'undefined') c = document.createElement('canvas').getContext('2d');
        if (!c && typeof OffscreenCanvas !== 'undefined') c = new OffscreenCanvas(8, 8).getContext('2d');
        return (text, font) => {
            const key = font + '|' + text;
            if (cache.has(key)) return cache.get(key);
            let w;
            if (c) { c.font = font; w = c.measureText(text).width; } else {
                const px = parseFloat((font.match(/([\d.]+)px/) || [0, 16])[1]);
                w = text.length * px * 0.55;
            }
            cache.set(key, w);
            return w;
        };
    }

    /* ════════════════════════════════════════════════════════════════════
     * 9. SUPPLEMENTARY LAYERS — underline, highlight, circle, box, bracket,
     *    strike, arrow, counter, icon, burst, sparkle, badge, callout,
     *    threshold, shapeWipe, stamp… driven by tags + annotations.
     * ════════════════════════════════════════════════════════════════════ */
    function spanBox(words) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        words.forEach(w => {
            x0 = Math.min(x0, w.x); x1 = Math.max(x1, w.x + w.width);
            y0 = Math.min(y0, w.y - w.ascent); y1 = Math.max(y1, w.y + w.descent);
        });
        return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, baseline: Math.max(...words.map(w => w.y)) };
    }

    function makeSupp(type, args, shot, words, lib, theme, seed, speed, extra) {
        const preset = lib.get('supplements', type, theme);
        if (!preset || preset.kind === 'counter' || preset.kind === 'none') return null;
        const entryEnd = Math.max(...words.map(w => w.entryEnd));
        const box = spanBox(words);
        const style = U.merge(preset.style || {}, (extra && extra.style) || {});
        return {
            type, kind: preset.kind || type, preset, style, args: args || [], shot: shot.index, box,
            start: entryEnd + U.num(preset.delay, 0) / speed + U.num(extra && extra.delay, 0),
            dur: U.num(preset.duration, SAFE.duration) / speed,
            color: resolveColor(theme, (extra && extra.color) || style.color, 'accent'),
            color2: resolveColor(theme, style.color2 || '@ink', 'ink'),
            textColor: resolveColor(theme, style.textColor || '@paper', 'paper'),
            seed: seed + ':' + type, label: (extra && extra.label) || (args && args[0]) || '',
            text: words.map(w => w.text).join(' '),
            title: extra && extra.title, node: extra && extra.node,
            exitStart: null, exitDur: 0.3
        };
    }

    function buildSupplements(beat, beatShots, parsed, lib, theme, out, seed, speed, sceneLevel) {
        const supNames = new Set(Object.keys(lib.json.supplements || {}));
        if (!sceneLevel) {
            parsed.spans.forEach((span, si) => {
                span.tags.forEach(tag => {
                    if (!supNames.has(tag.name)) {
                        const known = ['in', 'out', 'fx', 'color', 'size', 'font', 'counter'].includes(tag.name) || (lib.json.typeStyles || {})[tag.name] || BLOCK_TAGS[tag.name];
                        if (!known) Log.warn('tag:' + tag.name, `Tag "${tag.name}" is not a supplement, type style or motion tag — ignored.`);
                        return;
                    }
                    beatShots.forEach(shot => {
                        const words = shot.words.filter(w => w.spanId === span.id);
                        if (!words.length) return;
                        const sp = makeSupp(tag.name, tag.args, shot, words, lib, theme, `${seed}:${si}`, speed);
                        if (sp) out.push(sp);
                    });
                });
            });
        }
        U.asArray(beat.annotations).forEach((raw, ai) => {
            const a = flattenAnnotation(raw);
            const mapped = raw.type && !String(raw.type).startsWith('d3.') && !String(raw.type).startsWith('annotation')
                ? { supplement: raw.type } : (lib.annotationTypes[a.typeKey] || lib.annotationTypes.__default || {});
            const types = U.asArray(mapped.supplement || mapped.supplements);
            const target = String(raw.target || '').toLowerCase().trim();
            let host = null, words = null;
            if (target) {
                const tw = target.split(/\s+/);
                for (const shot of beatShots) {
                    for (let i = 0; i < shot.words.length; i++) {
                        const ok = tw.every((t, k) => shot.words[i + k] && shot.words[i + k].text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').startsWith(t.replace(/[^\p{L}\p{N}]/gu, '')));
                        if (ok) { host = shot; words = shot.words.slice(i, i + tw.length); break; }
                    }
                    if (host) break;
                }
                if (!host) Log.warn('target:' + target, `Annotation target "${raw.target}" not found in beat — attaching to the whole phrase.`);
            }
            if (!host) { host = beatShots[0]; words = host ? host.words : []; }
            if (!host || !words.length) return;
            types.forEach(tp => {
                const args = U.asArray(mapped.args).map(x => fillTemplate(x, a).replace(/_/g, ' '));
                const sp = makeSupp(tp, args, host, words, lib, theme, `${seed}:a${ai}`, speed, {
                    label: a.label || raw.text || '', title: a.title, color: a.color, node: a,
                    delay: U.num(raw.delay, 0), style: raw.style
                });
                if (sp) out.push(sp);
            });
        });
    }

    /* ════════════════════════════════════════════════════════════════════
     * 10. 3D CAMERA RIG — auto-staged moves per shot + JSON keyframes
     * Orbit camera: target (tx,ty,tz) + rotation + distance. Dolly = dist,
     * orbit = rotY, tilt = rotX, roll = rotZ, whip = fast target change
     * with motion blur, rack-focus = delayed focus point (fx,fy,fz).
     * ════════════════════════════════════════════════════════════════════ */
    function addPose(p, off, k) {
        const o = Object.assign({}, p);
        if (!off) return o;
        const s = k == null ? 1 : k;
        for (const key of Object.keys(off)) {
            if (key === 'zoom') o.dist *= U.lerp(1, off.zoom, s);
            else if (key in o) o[key] += off[key] * s;
        }
        return o;
    }
    function lerpPose(a, b, t) {
        const o = {};
        for (const k of POSE_KEYS) o[k] = U.lerp(U.num(a[k], 0), U.num(b[k], 0), t);
        return o;
    }

    function buildCamera(scene, camJson, lib, theme, focal) {
        const segs = [];
        const shots = scene.shots;
        const camT = theme.camera || {};
        let prevEnd = null;
        shots.forEach((shot, i) => {
            const move = shot.move || {};
            const target = framingPose(shot, move, theme, focal, shot.seed + ':frame');
            const from = prevEnd || addPose(target, move.from || camT.establish);
            segs.push({ type: 'move', start: shot.start, end: Math.max(shot.arrive, shot.start + 1e-3), from, to: target, move });
            const next = shots[i + 1];
            const holdEnd = next ? next.start : (scene.outro ? shot.holdEnd : scene.dur + 1);
            const drift = U.merge(camT.drift || {}, move.drift || {});
            const holdLen = Math.max(1e-3, holdEnd - shot.arrive);
            const driftK = Math.min(1, holdLen / U.num(camT.driftRef, 3));
            const endPose = addPose(target, drift, driftK);
            segs.push({ type: 'hold', start: shot.arrive, end: holdEnd, from: target, to: endPose, ease: camT.driftEase });
            prevEnd = endPose;
        });
        if (scene.outro && shots.length) {
            // Pull back to reveal every shot at once (stacked paper diorama).
            const xs = shots.map(s => s.pose.x), ys = shots.map(s => s.pose.y), zs = shots.map(s => s.pose.z);
            const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
            const span = Math.max(Math.max(...xs) - Math.min(...xs) + 1600, (Math.max(...ys) - Math.min(...ys) + 900) * 1.8, Math.max(...zs) - Math.min(...zs));
            const fr = scene.outro.framing || {};
            const overview = { tx: cx, ty: cy, tz: cz, rotX: U.num(fr.rotX, 0), rotY: U.num(fr.rotY, 0), rotZ: U.num(fr.rotZ, 0), dist: focal * (span / 1920) * U.num(fr.zoom, 1.2), fov: U.num(camT.fov, 40), fx: cx, fy: cy, fz: cz, aperture: 0, mblur: 0 };
            const last = shots[shots.length - 1];
            segs.push({ type: 'move', start: last.holdEnd, end: Math.max(last.holdEnd + 0.01, Math.min(scene.dur, last.holdEnd + U.num(scene.outro.duration, 1.5))), from: prevEnd, to: overview, move: scene.outro });
            segs.push({ type: 'hold', start: segs[segs.length - 1].end, end: scene.dur + 1, from: overview, to: addPose(overview, scene.outro.drift || {}), ease: camT.driftEase });
        }
        const keys = U.asArray(camJson.keyframes).map(k => Object.assign({}, k, { t: resolveAt(k.at != null ? k.at : k.t || 0, scene) })).sort((a, b) => a.t - b.t);
        const mode = camJson.mode || (keys.length ? 'manual' : 'auto');
        return { segs, keys, mode, handheld: camT.handheld, focal };
    }

    function autoPose(cam, t, eases) {
        const segs = cam.segs;
        if (!segs.length) return { tx: 0, ty: 0, tz: 0, rotX: 0, rotY: 0, rotZ: 0, dist: cam.focal, fov: 40, fx: 0, fy: 0, fz: 0, aperture: 0, mblur: 0 };
        if (t <= segs[0].start) return Object.assign({}, segs[0].from);
        let seg = segs[segs.length - 1];
        for (const s of segs) { if (t >= s.start && t < s.end) { seg = s; break; } }
        const p = U.clamp((t - seg.start) / (seg.end - seg.start), 0, 1);
        if (seg.type === 'hold') return lerpPose(seg.from, seg.to, eases.get(seg.ease)(p));
        const mv = seg.move || {};
        const e = eases.get(mv.ease)(p);
        const pose = lerpPose(seg.from, seg.to, e);
        if (mv.rackFocus) {
            // Focus lags behind the move, then racks onto the new subject.
            const d = U.num(mv.rackFocus.delay, 0.5);
            const fp = eases.get(mv.rackFocus.ease || mv.ease)(U.clamp((p - d) / (1 - d), 0, 1));
            pose.fx = U.lerp(seg.from.fx, seg.to.fx, fp); pose.fy = U.lerp(seg.from.fy, seg.to.fy, fp); pose.fz = U.lerp(seg.from.fz, seg.to.fz, fp);
            pose.aperture = Math.max(pose.aperture, U.num(mv.rackFocus.aperture, 0) * Math.sin(Math.PI * p));
        }
        if (mv.props) {
            for (const ch of Object.keys(mv.props)) {
                const v = evalTrack(mv.props[ch], p, eases, mv.ease);
                if (v == null) continue;
                if (ch === 'zoom') pose.dist *= v; else if (ch in pose) pose[ch] += v;
            }
        }
        return pose;
    }

    function cameraAt(scene, t, lib) {
        const cam = scene.camera;
        const eases = lib.eases;
        let pose = autoPose(cam, t, eases);
        if (cam.keys.length && cam.mode !== 'auto') {
            const keyPose = k => {
                const base = cam.mode === 'additive' ? { tx: 0, ty: 0, tz: 0, rotX: 0, rotY: 0, rotZ: 0, dist: 0, fov: 0, fx: 0, fy: 0, fz: 0, aperture: 0, mblur: 0 } : autoPose(cam, k.t, eases);
                if (k.lookAt && cam.mode !== 'additive') {
                    const idx = +String(k.lookAt).split(':')[1] || 0;
                    const sh = scene.shots[Math.min(idx, scene.shots.length - 1)];
                    if (sh) Object.assign(base, framingPose(sh, sh.move, scene.theme, cam.focal, sh.seed + ':frame'));
                }
                for (const f of POSE_KEYS) if (typeof k[f] === 'number') base[f] = cam.mode === 'additive' ? k[f] : k[f];
                if (typeof k.zoom === 'number') base.dist = cam.mode === 'additive' ? cam.focal * (k.zoom - 1) : cam.focal * k.zoom;
                return base;
            };
            const ks = cam.keys;
            let kp;
            if (t <= ks[0].t) kp = keyPose(ks[0]);
            else if (t >= ks[ks.length - 1].t) kp = keyPose(ks[ks.length - 1]);
            else {
                for (let i = 1; i < ks.length; i++) {
                    if (t <= ks[i].t) {
                        const p = (t - ks[i - 1].t) / Math.max(1e-6, ks[i].t - ks[i - 1].t);
                        kp = lerpPose(keyPose(ks[i - 1]), keyPose(ks[i]), eases.get(ks[i].ease)(p));
                        break;
                    }
                }
            }
            if (cam.mode === 'additive') { for (const f of POSE_KEYS) pose[f] += kp[f]; } else pose = kp;
        }
        // Handheld drift (seeded smooth noise)
        const hh = cam.handheld;
        if (hh && hh.amp) {
            const fq = U.num(hh.freq, 0.3);
            let i = 1;
            for (const k of Object.keys(hh.amp)) pose[k] = U.num(pose[k], 0) + noise1(hashStr(scene.seed) + i++ * 31, t * fq) * hh.amp[k];
        }
        return pose;
    }

    /* ════════════════════════════════════════════════════════════════════
     * 11. 3D MATH + PROJECTION
     * World: x right, y down, z away from camera. Planes are drawn with a
     * per-layer affine fitted to the perspective projection (accurate for
     * glyph-sized layers, and good enough for paper sheets).
     * ════════════════════════════════════════════════════════════════════ */
    function rotMat(rx, ry, rz) {
        const x = U.deg(rx || 0), y = U.deg(ry || 0), z = U.deg(rz || 0);
        const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
        // M = Ry · Rx · Rz
        const Rx = [1, 0, 0, 0, cx, -sx, 0, sx, cx];
        const Ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
        const Rz = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
        return mul3(mul3(Ry, Rx), Rz);
    }
    function mul3(a, b) {
        const o = new Array(9);
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
        return o;
    }
    const tr3 = m => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
    const mv3 = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];

    /** A View holds camera state for one frame of one scene. */
    function makeView(pose, frame, theme) {
        const f = (frame.height / 2) / Math.tan(U.deg(U.num(pose.fov, 40)) / 2);
        const Rinv = tr3(rotMat(pose.rotX, pose.rotY, pose.rotZ));
        const L = U.pick(theme, 'material.light') || { x: 0.35, y: 0.55, z: 0.75 };
        const ll = Math.hypot(L.x, L.y, L.z) || 1;
        const light = [L.x / ll, L.y / ll, L.z / ll];
        const focusCam = mv3(Rinv, [pose.fx - pose.tx, pose.fy - pose.ty, pose.fz - pose.tz]);
        return {
            pose, f, Rinv, cx: frame.width / 2, cy: frame.height / 2, near: U.num(U.pick(theme, 'camera.near'), 40),
            light, headOn: light[2], focusZ: focusCam[2] + pose.dist,
            project(v) { // camera-space vector → screen
                const zc = v[2] + pose.dist;
                const k = f / zc;
                return [this.cx + v[0] * k, this.cy + v[1] * k, zc];
            }
        };
    }

    /** Pre-compute a shot's plane → camera transform for this frame. */
    function shotSpace(view, pose) {
        const M = rotMat(pose.rotX, pose.rotY, pose.rotZ);
        const C = mul3(view.Rinv, M);
        const o = mv3(view.Rinv, [pose.x - view.pose.tx, pose.y - view.pose.ty, pose.z - view.pose.tz]);
        return { C, o };
    }

    /**
     * Compute canvas affine for a layer.
     * L: layer position in shot space [x,y,z]; A: 3x3 layer matrix (rot+scale);
     * c: local point used as fitting centre; h: fitting step.
     */
    function layerAffine(view, sp, L, A, anchor, c, h) {
        const CA = mul3(sp.C, A);
        const base = mv3(sp.C, L);
        const bx = sp.o[0] + base[0], by = sp.o[1] + base[1], bz = sp.o[2] + base[2];
        const pt = r => {
            const w = mv3(CA, [r[0] - anchor[0], r[1] - anchor[1], 0]);
            return view.project([bx + w[0], by + w[1], bz + w[2]]);
        };
        const P0 = pt(c), P1 = pt([c[0] + h, c[1]]), P2 = pt([c[0], c[1] + h]);
        if (P0[2] < view.near || P1[2] < view.near || P2[2] < view.near) return null;
        const a = (P1[0] - P0[0]) / h, b = (P1[1] - P0[1]) / h, cc = (P2[0] - P0[0]) / h, d = (P2[1] - P0[1]) / h;
        const e = P0[0] - a * c[0] - cc * c[1], f = P0[1] - b * c[0] - d * c[1];
        const n = mv3(CA, [0, 0, -1]);
        const nl = Math.hypot(n[0], n[1], n[2]) || 1;
        const lam = -(n[0] * view.light[0] + n[1] * view.light[1] + n[2] * view.light[2]) / nl;
        return { a, b, c: cc, d, e, f, z: P0[2], back: a * d - b * cc < 0, lam: lam / (view.headOn || 1), scale: Math.sqrt(Math.abs(a * d - b * cc)) };
    }

    function layerMatrix(st, extraRotZ) {
        const R = rotMat(st.rotX, st.rotY, st.rotZ + (extraRotZ || 0));
        const sx = st.scale * st.scaleX, sy = st.scale * st.scaleY;
        const kx = Math.tan(U.deg(st.skewX)), ky = Math.tan(U.deg(st.skewY));
        const S = [sx, kx * sy, 0, ky * sx, sy, 0, 0, 0, 1];
        return mul3(R, S);
    }

    function anchorPoint(name, w, asc, desc) {
        const mid = (desc - asc) / 2;
        switch (name) {
            case 'baseline': return [w / 2, 0];
            case 'top': return [w / 2, -asc];
            case 'bottom': return [w / 2, desc];
            case 'left': return [0, mid];
            case 'right': return [w, mid];
            case 'bottomLeft': return [0, desc];
            case 'topLeft': return [0, -asc];
            default: return [w / 2, mid];
        }
    }

    /* ════════════════════════════════════════════════════════════════════
     * 12. LAYER STATE — stacks entry ⊕ emphasis ⊕ loop ⊕ exit per layer
     * ════════════════════════════════════════════════════════════════════ */
    function wordCharState(w, ci, n, t, eases) {
        const cd = w.unit === 'char' && ci >= 0 ? w.chars[ci].delay : 0;
        const es = w.entryStart + cd;
        const entry = w.entry;
        if (t < es) return null;
        const st = IDENTITY();
        const ue = (t - es) / Math.max(1e-6, w.entryDur);
        if (ue < 1) accumulate(st, entry, ue, eases);
        for (const e of w.emphasis) {
            const sd = e.preset.stagger && e.preset.stagger.unit === 'char' && ci >= 0 ? staggerDelay(e.preset.stagger, ci, n, w.seed) : 0;
            const u = (t - e.start - sd) / e.dur;
            if (u > 0 && u < 1) accumulate(st, e.preset, u, eases);
        }
        if (w.loop && t > w.entryEnd) {
            const lp = w.loop;
            const per = Math.max(0.05, U.num(lp.period, 1));
            const phase = lp.phase === 'random' ? rng(w.seed + ':' + ci)() * per : U.num(lp.phaseStep, 0) * Math.max(0, ci);
            const u = (((t - w.entryEnd + phase) / per) % 1 + 1) % 1;
            const amt = Math.min(1, (t - w.entryEnd) / U.num(lp.fadeIn, 0.4));
            accumulate(st, lp, u, eases, amt);
        }
        if (w.exit && w.exitStart != null) {
            const xs = w.exit.stagger && w.exit.stagger.unit === 'char' && ci >= 0 ? staggerDelay(w.exit.stagger, ci, n, w.seed + 'x') : 0;
            const u = (t - w.exitStart - xs) / Math.max(1e-6, w.exitDur);
            if (u >= 1) return null;
            if (u > 0) accumulate(st, w.exit, u, eases);
        }
        return st;
    }

    const NF_CACHE = new Map();
    /** Locale-aware number formatting: en-IN lakh/crore grouping, Devanagari (deva) or other native digits. */
    function numberFormat(cn) {
        const loc = (cn.locale || 'en-US') + (cn.numerals ? '-u-nu-' + cn.numerals : '');
        const key = loc + '|' + cn.decimals + '|' + (cn.grouping !== false);
        if (!NF_CACHE.has(key)) {
            let f;
            try { f = new Intl.NumberFormat(loc, { minimumFractionDigits: cn.decimals, maximumFractionDigits: cn.decimals, useGrouping: cn.grouping !== false }); }
            catch (e) { f = new Intl.NumberFormat('en-US', { minimumFractionDigits: cn.decimals, maximumFractionDigits: cn.decimals, useGrouping: cn.grouping !== false }); }
            NF_CACHE.set(key, f);
        }
        return NF_CACHE.get(key);
    }
    function counterText(cn, t, eases) {
        const p = U.clamp((t - cn.start) / Math.max(1e-6, cn.dur), 0, 1);
        const v = U.lerp(cn.from, cn.to, eases.get(cn.ease)(p));
        return cn.prefix + numberFormat(cn).format(v) + cn.suffix;
    }

    /* ════════════════════════════════════════════════════════════════════
     * 13. PAPER MATERIAL HELPERS — torn edges, rough strokes, draw-on
     * ════════════════════════════════════════════════════════════════════ */
    const tornCache = new Map();
    function tornRectPath(w, h, torn, seed, stepPx) {
        const key = `${w.toFixed(1)}|${h.toFixed(1)}|${torn}|${seed}`;
        if (tornCache.has(key)) return tornCache.get(key);
        const R = rng(seed);
        const step = Math.max(6, stepPx || 14);
        const amp = h * 0.06 * torn;
        const pts = [];
        for (let x = 0; x <= w; x += step) pts.push([Math.min(x, w), (R() * 2 - 1) * amp]);
        pts.push([w, (R() * 2 - 1) * amp * 0.5]);
        for (let y = step; y < h; y += step * 2) pts.push([w + (R() * 2 - 1) * amp * 0.4, y]);
        for (let x = w; x >= 0; x -= step) pts.push([Math.max(0, x), h + (R() * 2 - 1) * amp]);
        pts.push([0, h + (R() * 2 - 1) * amp * 0.5]);
        for (let y = h - step; y > 0; y -= step * 2) pts.push([(R() * 2 - 1) * amp * 0.4, y]);
        if (tornCache.size > 4000) tornCache.clear();
        tornCache.set(key, pts);
        return pts;
    }
    function pathFromPts(ctx, pts, close) {
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        if (close) ctx.closePath();
    }
    function roughLine(x0, y0, x1, y1, seed, wobble, segs) {
        const R = rng(seed);
        const n = Math.max(2, segs || 12);
        const pts = [];
        const nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny) || 1;
        for (let i = 0; i <= n; i++) {
            const u = i / n;
            const j = (R() * 2 - 1) * wobble * Math.sin(Math.PI * u + 0.3);
            pts.push([U.lerp(x0, x1, u) + (nx / nl) * j, U.lerp(y0, y1, u) + (ny / nl) * j]);
        }
        return pts;
    }
    /** Stroke a polyline up to fraction p of its length (hand-drawn draw-on). */
    function strokePartial(ctx, pts, p) {
        if (p <= 0 || pts.length < 2) return;
        let total = 0;
        const seg = [];
        for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); total += l; }
        let remain = total * U.clamp(p, 0, 1);
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length && remain > 0; i++) {
            const l = seg[i - 1];
            if (remain >= l) ctx.lineTo(pts[i][0], pts[i][1]);
            else { const u = remain / l; ctx.lineTo(U.lerp(pts[i - 1][0], pts[i][0], u), U.lerp(pts[i - 1][1], pts[i][1], u)); }
            remain -= l;
        }
        ctx.stroke();
    }
    function endOf(pts, p) {
        let total = 0; const seg = [];
        for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); total += l; }
        let remain = total * U.clamp(p, 0, 1);
        for (let i = 1; i < pts.length; i++) {
            const l = seg[i - 1];
            if (remain <= l) { const u = remain / (l || 1); return { x: U.lerp(pts[i - 1][0], pts[i][0], u), y: U.lerp(pts[i - 1][1], pts[i][1], u), ang: Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]) }; }
            remain -= l;
        }
        const a = pts[pts.length - 2], b = pts[pts.length - 1];
        return { x: b[0], y: b[1], ang: Math.atan2(b[1] - a[1], b[0] - a[0]) };
    }
    function quadPts(x0, y0, cx, cy, x1, y1, n) {
        const pts = [];
        for (let i = 0; i <= n; i++) { const u = i / n, v = 1 - u; pts.push([v * v * x0 + 2 * v * u * cx + u * u * x1, v * v * y0 + 2 * v * u * cy + u * u * y1]); }
        return pts;
    }
    function arrowHead(ctx, x, y, ang, size, style) {
        ctx.beginPath();
        if (style === 'dot') { ctx.arc(x, y, size * 0.45, 0, Math.PI * 2); ctx.fill(); return; }
        ctx.moveTo(x + Math.cos(ang - 2.6) * size, y + Math.sin(ang - 2.6) * size);
        ctx.lineTo(x, y);
        ctx.lineTo(x + Math.cos(ang + 2.6) * size, y + Math.sin(ang + 2.6) * size);
        ctx.stroke();
    }

    /* Grain texture (generated once, seeded — deterministic between frames) */
    const grainCache = new Map();
    function grainCanvas(opts, key) {
        if (grainCache.has(key)) return grainCache.get(key);
        const size = 256;
        const cv = opts.createCanvas ? opts.createCanvas(size, size) : (typeof document !== 'undefined' ? Object.assign(document.createElement('canvas'), { width: size, height: size }) : null);
        if (!cv) return null;
        const g = cv.getContext('2d');
        const img = g.createImageData(size, size);
        const R = rng(key);
        for (let i = 0; i < img.data.length; i += 4) {
            const v = 128 + (R() * 2 - 1) * 127;
            img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
        }
        g.putImageData(img, 0, 0);
        grainCache.set(key, cv);
        return cv;
    }

    /* ════════════════════════════════════════════════════════════════════
     * 14. RENDERER — words, paper strips, supplements, backgrounds
     * ════════════════════════════════════════════════════════════════════ */
    function setT(R, af, dx, dy) {
        const s = R.s;
        R.ctx.setTransform(af.a * s, af.b * s, af.c * s, af.d * s, (af.e + (dx || 0)) * s + R.ox, (af.f + (dy || 0)) * s + R.oy);
    }
    function setFilter(R, px) {
        const v = px > 0.35 ? `blur(${(px * R.s).toFixed(2)}px)` : 'none';
        if (R.filter !== v) { R.ctx.filter = v; R.filter = v; }
    }

    function paperShadow(R, af, lift, on) {
        const ctx = R.ctx;
        const sh = U.pick(R.theme, 'material.shadow');
        if (!on || !sh) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; return; }
        const k = (U.num(sh.distance, 4) + lift * U.num(sh.liftScale, 0.6)) * af.scale * R.s;
        ctx.shadowColor = resolveColor(R.theme, sh.color || '@shadow', 'shadow');
        ctx.shadowBlur = (U.num(sh.blur, 6) + lift * U.num(sh.liftBlur, 0.5)) * af.scale * R.s;
        ctx.shadowOffsetX = R.view.light[0] * k;
        ctx.shadowOffsetY = R.view.light[1] * k;
    }

    function drawGlyph(R, af, st, w, str, dof) {
        const ctx = R.ctx;
        const alpha = U.clamp(st.opacity, 0, 1) * R.alpha;
        if (alpha <= 0.004) return;
        const mat = R.theme.material || {};
        setFilter(R, dof + st.blur + R.mblur);
        ctx.globalAlpha = alpha;
        const back = af.back;
        const lift = U.num(mat.textLift, 6) + st.lift;
        // paper thickness: stacked copies offset away from the light
        const ex = mat.extrude;
        const emoji = EMOJI_RE.test(str);   // colour glyphs ignore fillStyle: no extrude / shade overlays on them
        if (ex && !back && !emoji && U.num(ex.depth, 0) > 0) {
            ctx.fillStyle = !ex.color || ex.color === 'auto' ? Color.shade(w.color, -U.num(ex.darken, 0.45)) : resolveColor(R.theme, ex.color);
            const n = Math.max(1, Math.round(U.num(ex.steps, 2)));
            const d = U.num(ex.depth, 2) / n;
            for (let k = n; k >= 1; k--) { setT(R, af, R.view.light[0] * d * k * af.scale, R.view.light[1] * d * k * af.scale); ctx.fillText(str, 0, 0); }
        }
        setT(R, af);
        paperShadow(R, af, lift, mat.shadow && !back);
        ctx.fillStyle = back ? resolveColor(R.theme, '@back', 'paper2') : w.color;
        ctx.fillText(str, 0, 0);
        paperShadow(R, af, 0, false);
        if (w.style.outline && !emoji) {
            ctx.lineWidth = U.num(w.style.outlineWidth, 0.04) * w.size;
            ctx.strokeStyle = resolveColor(R.theme, w.style.outlineColor || '@ink');
            ctx.strokeText(str, 0, 0);
        }
        const dark = U.clamp((1 - U.clamp(af.lam, 0, 1)) * U.num(mat.shadeStrength, 0.5) + st.shade, 0, 0.85);
        if (dark > 0.02 && !emoji) { ctx.fillStyle = `rgba(0,0,0,${dark.toFixed(3)})`; ctx.fillText(str, 0, 0); }
    }

    function drawChip(R, sp, w, st, dof) {
        const pad = w.size * U.num(w.style.chipPad, 0.14);
        const bw = w.width + pad * 2, bh = w.ascent + w.descent + pad * 1.2;
        const anc = [bw / 2, bh / 2];
        const L = [w.x - pad + bw / 2 + st.x, w.y - w.ascent - pad * 0.6 + bh / 2 + st.y, st.z - U.num(U.pick(R.theme, 'material.textLift'), 6) * 0.5];
        const af = layerAffine(R.view, sp, L, layerMatrix(st, w.rot), anc, anc, bh / 2);
        if (!af) return;
        const ctx = R.ctx;
        setFilter(R, dof + st.blur + R.mblur);
        ctx.globalAlpha = U.clamp(st.opacity, 0, 1) * R.alpha;
        setT(R, af);
        paperShadow(R, af, 4, true);
        ctx.fillStyle = af.back ? resolveColor(R.theme, '@back') : resolveColor(R.theme, w.style.chipColor || '@accent');
        pathFromPts(ctx, tornRectPath(bw, bh, U.num(w.style.chipTorn, 0.4), w.seed + 'chip'), true);
        ctx.fill();
        paperShadow(R, af, 0, false);
    }

    function drawWord(R, sp, w, dof) {
        const t = R.t, eases = R.lib.eases, ctx = R.ctx;
        const anchorName = (w.entry && w.entry.anchor) || 'center';
        if (w.style.chip) { const st0 = wordCharState(w, -1, 1, t, eases); if (st0) drawChip(R, sp, w, st0, dof); }
        ctx.font = w.font;
        ctx.textBaseline = 'alphabetic';
        const lift = -U.num(U.pick(R.theme, 'material.textLift'), 6);
        if (w.unit === 'word' || w.counter) {
            const st = wordCharState(w, -1, 1, t, eases);
            if (!st) return;
            let str = w.text, offX = 0;
            if (w.counter && w.counter.mode === 'odometer' && t >= w.counter.start) {
                const anc0 = anchorPoint(anchorName, w.width, w.ascent, w.descent);
                const L0 = [w.x + anc0[0] + st.x, w.y + anc0[1] + st.y, st.z + lift - st.lift];
                const af0 = layerAffine(R.view, sp, L0, layerMatrix(st, w.rot), anc0, [w.width / 2, (w.descent - w.ascent) / 2], Math.max(2, w.size / 2));
                if (af0) drawOdometer(R, af0, st, w, dof);
                return;
            }
            if (w.counter) { str = counterText(w.counter, t, eases); offX = (w.width - ctx.measureText(str).width) / 2; }
            const anc = anchorPoint(anchorName, w.width, w.ascent, w.descent);
            const ancLocal = [anc[0] - offX, anc[1]];
            const L = [w.x + anc[0] + st.x, w.y + anc[1] + st.y, st.z + lift - st.lift];
            const af = layerAffine(R.view, sp, L, layerMatrix(st, w.rot), ancLocal, [w.width / 2 - offX, (w.descent - w.ascent) / 2], Math.max(2, w.size / 2));
            if (af) drawGlyph(R, af, st, w, str, dof);
            return;
        }
        const n = w.chars.length;
        const rr = U.deg(w.rot || 0), cr = Math.cos(rr), sr = Math.sin(rr);
        for (let ci = 0; ci < n; ci++) {
            const ch = w.chars[ci];
            if (ch.ch === ' ') continue;
            const st = wordCharState(w, ci, n, t, eases);
            if (!st) continue;
            const anc = anchorPoint(anchorName, ch.w, w.ascent, w.descent);
            const ox = ch.dx + anc[0] + st.tracking * ci * w.size * 0.01;
            const L = [w.x + ox * cr - anc[1] * sr + st.x, w.y + ox * sr + anc[1] * cr + st.y, st.z + lift - st.lift];
            const af = layerAffine(R.view, sp, L, layerMatrix(st, w.rot), anc, [ch.w / 2, (w.descent - w.ascent) / 2], Math.max(2, w.size / 2));
            if (af) drawGlyph(R, af, st, w, ch.ch, dof);
        }
    }

    function stripState(s, t, eases) {
        if (t < s.entryStart) return null;
        const st = IDENTITY();
        const u = (t - s.entryStart) / Math.max(1e-6, U.num(s.entry && s.entry.duration, SAFE.duration));
        if (u < 1) accumulate(st, s.entry, u, eases);
        if (s.exit && s.exitStart != null) {
            const x = (t - s.exitStart) / Math.max(1e-6, s.exitDur);
            if (x >= 1) return null;
            if (x > 0) accumulate(st, s.exit, x, eases);
        }
        return st;
    }

    function drawStrip(R, sp, s, dof) {
        const st = stripState(s, R.t, R.lib.eases);
        if (!st || st.opacity <= 0.004 || st.reveal <= 0.001) return;
        const anc = anchorPoint((s.entry && s.entry.anchor) || 'left', s.w, s.h / 2, s.h / 2);
        const ancL = [anc[0], anc[1] + s.h / 2];
        const L = [s.x + ancL[0] + st.x, s.y + ancL[1] + st.y, st.z - s.lift];
        const af = layerAffine(R.view, sp, L, layerMatrix(st, s.rot), ancL, [s.w / 2, s.h / 2], s.h / 2);
        if (!af) return;
        const ctx = R.ctx;
        setFilter(R, dof + st.blur + R.mblur);
        ctx.globalAlpha = U.clamp(st.opacity, 0, 1) * R.alpha;
        setT(R, af);
        ctx.save();
        const rv = U.clamp(st.reveal, 0, 1);
        if (rv < 0.999) { ctx.beginPath(); ctx.rect(-s.h, -s.h, (s.w + s.h) * rv + s.h * 0.2, s.h * 3); ctx.clip(); }
        paperShadow(R, af, s.lift + 2, true);
        ctx.fillStyle = af.back ? resolveColor(R.theme, '@back') : s.color;
        pathFromPts(ctx, tornRectPath(s.w, s.h, s.torn, s.seed), true);
        ctx.fill();
        paperShadow(R, af, 0, false);
        const dark = U.clamp((1 - U.clamp(af.lam, 0, 1)) * U.num(U.pick(R.theme, 'material.shadeStrength'), 0.5) * 0.6 + st.shade, 0, U.num(U.pick(R.theme, 'material.maxStripShade'), 0.35));
        if (dark > 0.02) { ctx.fillStyle = `rgba(0,0,0,${dark.toFixed(3)})`; ctx.fill(); }
        ctx.restore();
        R.filter = null;
    }

    /* ─── Supplementary layers (drawn in shot-plane coordinates) ─── */
    function suppProgress(sp, t, eases) {
        if (t < sp.start) return null;
        const p = eases.get(sp.preset.ease)(U.clamp((t - sp.start) / Math.max(1e-6, sp.dur), 0, 1));
        let out = 1;
        if (sp.exitStart != null && t > sp.exitStart) {
            out = 1 - eases.get(sp.preset.exitEase || sp.preset.ease)(U.clamp((t - sp.exitStart) / Math.max(1e-6, sp.exitDur), 0, 1));
            if (out <= 0.001) return null;
        }
        return { p, raw: U.clamp((t - sp.start) / Math.max(1e-6, sp.dur), 0, 1), out, age: t - sp.start };
    }

    function drawHandText(R, text, x, y, px, color, role, align) {
        const ctx = R.ctx;
        ctx.font = fontFor(R.theme, { role: role || 'hand', size: 1 }, px);
        ctx.fillStyle = color;
        ctx.textAlign = align || 'center';
        ctx.textBaseline = 'middle';
        String(text).split('\n').forEach((line, i, arr) => ctx.fillText(line, x, y + (i - (arr.length - 1) / 2) * px * 1.1));
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }


    /** Rolling-digit odometer for counters (mode "odometer"). Digits roll with carry like a real meter. */
    function drawOdometer(R, af, st, w, dof) {
        const cn = w.counter, ctx = R.ctx, eases = R.lib.eases;
        const p = U.clamp((R.t - cn.start) / Math.max(1e-6, cn.dur), 0, 1);
        const v = U.lerp(cn.from, cn.to, eases.get(cn.ease)(p));
        const fmt = numberFormat(cn);
        const digitFmt = numberFormat(Object.assign({}, cn, { decimals: 0, grouping: false }));
        const glyph = d => digitFmt.format(d);
        const finalStr = cn.prefix + fmt.format(cn.to) + cn.suffix;
        const digitSet = new Set(Array.from({ length: 10 }, (_, d) => glyph(d)));
        const chars = Array.from(finalStr);
        const widths = chars.map((c, i) => ctx.measureText(chars.slice(0, i + 1).join('')).width);
        const total = widths[widths.length - 1] || 0;
        const off = (w.width - total) / 2;
        const vv = Math.abs(v) * Math.pow(10, cn.decimals);
        const lh = (w.ascent + w.descent) * 1.05;
        let k = 0;
        const cols = [];
        for (let i = chars.length - 1; i >= 0; i--) {
            const isDigit = digitSet.has(chars[i]) && i >= cn.prefix.length && i < chars.length - cn.suffix.length;
            cols[i] = isDigit ? k++ : null;
        }
        const maxShown = vv >= 1 ? Math.floor(Math.log10(vv)) : 0;
        for (let i = 0; i < chars.length; i++) {
            const x0 = off + (i ? widths[i - 1] : 0), cw = (widths[i] - (i ? widths[i - 1] : 0));
            const kk = cols[i];
            const place = (x, y) => Object.assign({}, af, { e: af.e + af.a * x + af.c * y, f: af.f + af.b * x + af.d * y });
            if (kk == null) {
                // separators only once a digit to their left is showing
                const leftDigit = cols.slice(0, i).reduce((m, c) => (c != null ? Math.max(m, c) : m), -1);
                const isAffix = i < cn.prefix.length || i >= chars.length - cn.suffix.length;
                if (isAffix || leftDigit <= Math.max(maxShown, cn.decimals)) drawGlyph(R, place(x0, 0), st, w, chars[i], dof);
                continue;
            }
            if (kk > Math.max(maxShown, cn.decimals)) continue;
            const pow = Math.pow(10, kk);
            const d = Math.floor(vv / pow) % 10;
            const frac = kk === 0 ? vv % 1 : Math.max(0, (vv % pow) - (pow - 1));
            ctx.save();
            R.ctx.setTransform(af.a * R.s, af.b * R.s, af.c * R.s, af.d * R.s, af.e * R.s + R.ox, af.f * R.s + R.oy);
            ctx.beginPath(); ctx.rect(x0 - 2, -w.ascent * 1.1, cw + 4, lh * 1.08); ctx.clip();
            drawGlyph(R, place(x0, -frac * lh), st, w, glyph(d), dof);
            if (frac > 0.001) drawGlyph(R, place(x0, (1 - frac) * lh), st, w, glyph((d + 1) % 10), dof);
            ctx.restore();
            R.filter = null;
        }
    }

    /** Draw a plug-in visual block (map, media, SVG, chart) inside its shot plane. */
    function drawBlock(R, sp, shot, dof) {
        const b = shot.block;
        if (!b || R.t < b.entryStart) return;
        let out = 1;
        if (b.exitStart != null && R.t > b.exitStart) { out = 1 - U.clamp((R.t - b.exitStart) / Math.max(1e-6, b.exitDur), 0, 1); if (out <= 0.001) return; }
        const ctx = R.ctx;
        ctx.save();
        setFilter(R, dof + R.mblur);
        ctx.globalAlpha = R.alpha * out;
        try { b.def.draw(R, sp, b, R.t - b.entryStart, out); } catch (e) { Log.warn('blockdraw:' + b.kind + e.message, `Visual "${b.kind}" failed to draw: ${e.message}`); }
        ctx.restore();
        R.filter = null; ctx.filter = 'none';
    }

    /** Helper for plug-ins: set the canvas transform to a region of the shot plane (optionally tilted/lifted). */
    function planeAffine(R, sp, o, fit) {
        const st = Object.assign(IDENTITY(), o || {});
        const af = layerAffine(R.view, sp, [st.x, st.y, st.z], layerMatrix(st, 0), [0, 0], [0, 0], Math.max(4, fit || 100));
        if (af) setT(R, af);
        return af;
    }

    const SUPP_DRAW = {

        ring(R, sp, b, pr) {
            // Progress ring around a percentage / value (special treatment for numbers).
            const s = sp.style, ctx = R.ctx;
            const num = parseNumberWord(sp.text || '') || { value: 0, suffix: '' };
            const max = sp.args[1] != null ? parseFloat(sp.args[1]) : (/%/.test(num.suffix) || num.value <= 100 ? 100 : num.value);
            const pct = U.clamp((sp.args[0] != null && sp.args[0] !== '' ? parseFloat(sp.args[0]) : num.value) / max, 0, 1);
            const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = Math.max(b.w, b.h) * U.num(s.radius, 0.62);
            ctx.lineWidth = b.h * U.num(s.thickness, 0.1);
            ctx.save(); ctx.globalAlpha *= U.num(s.trackOpacity, 0.18); ctx.strokeStyle = sp.color2; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
            ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct * pr.p); ctx.stroke();
        },
        bar(R, sp, b, pr) {
            const s = sp.style, ctx = R.ctx;
            const num = parseNumberWord(sp.text || '') || { value: 0, suffix: '' };
            const max = sp.args[0] != null ? parseFloat(sp.args[0]) : (/%/.test(num.suffix) ? 100 : num.value || 1);
            const pct = U.clamp(num.value / max, 0, 1);
            const w = Math.max(b.w, b.h * 3) * U.num(s.width, 1.2), h = b.h * U.num(s.height, 0.14);
            const x = b.x + b.w / 2 - w / 2, y = b.y + b.h * U.num(s.at, 1.15);
            ctx.save(); ctx.globalAlpha *= 0.2; ctx.fillStyle = sp.color2; ctx.fillRect(x, y, w, h); ctx.restore();
            ctx.fillRect(x, y, w * pct * pr.p, h);
        },
        underline(R, sp, b, pr) {
            const s = sp.style, ctx = R.ctx;
            const y = b.baseline + b.h * U.num(s.offset, 0.12);
            const over = b.h * U.num(s.overshoot, 0.08);
            ctx.lineWidth = b.h * U.num(s.thickness, 0.07);
            let pts;
            if (s.wave) {
                pts = [];
                const n = 40, amp = b.h * U.num(s.wave, 0.05), cyc = Math.max(2, Math.round(b.w / (b.h * 0.35)));
                for (let i = 0; i <= n; i++) pts.push([b.x - over + (b.w + over * 2) * i / n, y + Math.sin(i / n * Math.PI * 2 * cyc) * amp]);
            } else pts = roughLine(b.x - over, y, b.x + b.w + over, y + b.h * U.num(s.slope, 0.02), sp.seed, b.h * U.num(s.wobble, 0.03), 14);
            strokePartial(ctx, pts, pr.p);
            if (s.double) {
                const p2 = U.clamp((pr.raw - 0.35) / 0.65, 0, 1);
                strokePartial(ctx, roughLine(b.x, y + ctx.lineWidth * 1.8, b.x + b.w * 0.85, y + ctx.lineWidth * 2, sp.seed + 'd', b.h * 0.03, 10), R.lib.eases.get(sp.preset.ease)(p2));
            }
        },
        highlight(R, sp, b, pr) {
            const s = sp.style, ctx = R.ctx;
            const h = b.h * U.num(s.height, 0.55), y = b.y + b.h * U.num(s.top, 0.4);
            const padX = b.h * U.num(s.pad, 0.08);
            const w = (b.w + padX * 2) * pr.p;
            const sk = b.h * Math.tan(U.deg(U.num(s.skew, -6)));
            ctx.globalAlpha *= U.num(s.opacity, 0.9);
            if (s.blend) ctx.globalCompositeOperation = s.blend;
            const R2 = rng(sp.seed);
            ctx.beginPath();
            ctx.moveTo(b.x - padX + sk, y + (R2() - 0.5) * h * 0.1);
            ctx.lineTo(b.x - padX + w + sk, y + (R2() - 0.5) * h * 0.12);
            ctx.lineTo(b.x - padX + w, y + h + (R2() - 0.5) * h * 0.12);
            ctx.lineTo(b.x - padX, y + h);
            ctx.closePath();
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
        },
        circle(R, sp, b, pr) {
            const s = sp.style, ctx = R.ctx;
            const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
            const rx = b.w / 2 + b.h * U.num(s.pad, 0.3), ry = b.h / 2 + b.h * U.num(s.pad, 0.3) * 0.8;
            const turns = U.num(s.turns, 1.12), a0 = U.deg(U.num(s.startAngle, -150));
            const Rn = rng(sp.seed);
            const wob = U.num(s.wobble, 0.06);
            const pts = [];
            const phase = Rn() * 10;
            for (let i = 0; i <= 64; i++) {
                const a = a0 + (i / 64) * Math.PI * 2 * turns;
                const k = 1 + Math.sin(a * 3 + phase) * wob + (i / 64) * wob;
                pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
            }
            ctx.lineWidth = b.h * U.num(s.thickness, 0.06);
            strokePartial(ctx, pts, pr.p);
        },
        box(R, sp, b, pr) {
            const s = sp.style, ctx = R.ctx;
            const pad = b.h * U.num(s.pad, 0.18);
            const x0 = b.x - pad, y0 = b.y - pad * 0.6, x1 = b.x + b.w + pad, y1 = b.y + b.h + pad * 0.6;
            const w = b.h * U.num(s.wobble, 0.03);
            const pts = [].concat(roughLine(x0, y0, x1, y0, sp.seed + 1, w, 8), roughLine(x1, y0, x1, y1, sp.seed + 2, w, 4), roughLine(x1, y1, x0, y1, sp.seed + 3, w, 8), roughLine(x0, y1, x0 - pad * 0.1, y0 - pad * 0.3, sp.seed + 4, w, 4));
            ctx.lineWidth = b.h * U.num(s.thickness, 0.05);
            strokePartial(ctx, pts, pr.p);
        },
        bracket(R, sp, b, pr) {
            const s = sp.style, ctx = R.ctx;
            const pad = b.h * U.num(s.pad, 0.25), tick = b.h * U.num(s.tick, 0.18);
            const cy = b.y + b.h / 2, hh = (b.h / 2 + pad * 0.5) * pr.p;
            ctx.lineWidth = b.h * U.num(s.thickness, 0.05);
            const xl = b.x - pad, xr = b.x + b.w + pad;
            const tk = tick * pr.p;
            ctx.beginPath();
            ctx.moveTo(xl + tk, cy - hh); ctx.lineTo(xl, cy - hh); ctx.lineTo(xl, cy + hh); ctx.lineTo(xl + tk, cy + hh);
            ctx.moveTo(xr - tk, cy - hh); ctx.lineTo(xr, cy - hh); ctx.lineTo(xr, cy + hh); ctx.lineTo(xr - tk, cy + hh);
            ctx.stroke();
        },
        strike(R, sp, b, pr) {
            const s = sp.style, ctx = R.ctx;
            const y = b.y + b.h * U.num(s.at, 0.55);
            ctx.lineWidth = b.h * U.num(s.thickness, 0.08);
            strokePartial(ctx, roughLine(b.x - b.h * 0.1, y + b.h * 0.04, b.x + b.w + b.h * 0.1, y - b.h * 0.06, sp.seed, b.h * 0.02, 10), pr.p);
        },
        arrow(R, sp, b, pr) {
            const s = sp.style, ctx = R.ctx;
            const dirs = s.directions || {};
            const dirName = (sp.args[1] || s.from || 'topLeft');
            const d = dirs[dirName] || s.fromVector || [-1, -1];
            const node = sp.node || {};
            const tipX = b.x + b.w * (d[0] < 0 ? 0.1 : d[0] > 0 ? 0.9 : 0.5), tipY = d[1] < 0 ? b.y - b.h * 0.08 : d[1] > 0 ? b.y + b.h * 1.08 : b.y + b.h / 2;
            const len = b.h * U.num(s.length, 1.3);
            const tx = node.dx != null && s.useLegacyOffset ? tipX + node.dx * U.num(s.legacyScale, 2) : tipX + d[0] * len;
            const ty = node.dy != null && s.useLegacyOffset ? tipY + node.dy * U.num(s.legacyScale, 2) : tipY + d[1] * len;
            const bend = U.num(s.bend, 0.35) * (rng(sp.seed)() > 0.5 ? 1 : -1);
            const mx = (tx + tipX) / 2 - (tipY - ty) * bend, my = (ty + tipY) / 2 + (tipX - tx) * bend;
            const shape = s.connector || (node.connectorType === 'elbow' ? 'elbow' : node.connectorType === 'line' ? 'line' : 'curve');
            let pts;
            if (shape === 'elbow') pts = [[tx, ty], [tipX, ty], [tipX, tipY]];
            else if (shape === 'line') pts = roughLine(tx, ty, tipX, tipY, sp.seed, 2, 8);
            else pts = quadPts(tx, ty, mx, my, tipX, tipY, 24);
            ctx.lineWidth = b.h * U.num(s.thickness, 0.045);
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            if (s.dash) ctx.setLineDash(s.dash.map(v => v * b.h));
            strokePartial(ctx, pts, pr.p);
            ctx.setLineDash([]);
            const endStyle = s.head || node.connectorEnd || 'arrow';
            if (pr.p > 0.92 && endStyle !== 'none') {
                const e = endOf(pts, 1);
                arrowHead(ctx, e.x, e.y, e.ang, b.h * U.num(s.headSize, 0.22) * U.clamp((pr.p - 0.92) / 0.08, 0, 1), endStyle);
            }
            const label = sp.label;
            if (label) {
                const lp = U.clamp((pr.raw - 0.3) / 0.5, 0, 1);
                const k = R.lib.eases.get(s.labelEase || sp.preset.ease)(lp);
                ctx.save();
                ctx.translate(tx, ty);
                ctx.scale(k, k);
                ctx.rotate(U.deg(U.num(s.labelRotate, -4)));
                const px = b.h * U.num(s.labelSize, 0.32);
                drawHandText(R, label, d[0] * px * 0.6 * String(label).length * 0.25, d[1] * px * 0.7, px, sp.color2, s.labelRole || 'hand');
                ctx.restore();
            }
        },
        icon(R, sp, b, pr) {
            const s = sp.style, ctx = R.ctx;
            const name = sp.args[0] || s.icon;
            const d = R.lib.icons[name];
            const emojiIcon = !d && hasEmoji(name || '');
            if (!d && !emojiIcon) { Log.warn('icon:' + name, `Icon "${name}" not in presets.icons.`); return; }
            const size = b.h * U.num(s.size, 0.9);
            const at = sp.args[1] || s.at || 'right';
            const gap = b.h * U.num(s.gap, 0.25);
            const cx = at === 'left' ? b.x - gap - size / 2 : at === 'right' ? b.x + b.w + gap + size / 2 : b.x + b.w / 2;
            const cy = at === 'top' ? b.y - gap - size / 2 : at === 'bottom' ? b.y + b.h + gap + size / 2 : b.y + b.h / 2;
            const sc = pr.p;
            const wig = Math.sin(pr.age * U.num(s.wiggleSpeed, 3)) * U.num(s.wiggle, 4);
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(U.deg(wig + (1 - sc) * U.num(s.spinIn, -40)));
            ctx.scale(sc, sc);
            if (s.chip !== false) {
                ctx.fillStyle = resolveColor(R.theme, s.chipColor || '@paper');
                ctx.shadowColor = resolveColor(R.theme, '@shadow'); ctx.shadowBlur = 8 * R.s; ctx.shadowOffsetY = 4 * R.s;
                ctx.beginPath(); ctx.arc(0, 0, size * 0.62, 0, Math.PI * 2); ctx.fill();
                ctx.shadowColor = 'transparent';
            }
            const k = size / U.num(s.viewBox, 24);
            ctx.scale(k, k);
            ctx.translate(-U.num(s.viewBox, 24) / 2, -U.num(s.viewBox, 24) / 2);
            if (emojiIcon) {
                ctx.font = `${U.num(s.viewBox, 24) * 0.9}px ${U.pick(R.theme, 'typography.emojiFallback') || 'sans-serif'}`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText(name, U.num(s.viewBox, 24) / 2, U.num(s.viewBox, 24) / 2 + 1);
                ctx.restore();
                return;
            }
            const path = typeof Path2D !== 'undefined' ? new Path2D(d) : null;
            if (path) {
                ctx.fillStyle = sp.color;
                if (s.stroke) { ctx.lineWidth = U.num(s.strokeWidth, 2); ctx.strokeStyle = sp.color; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(path); } else ctx.fill(path, 'evenodd');
            }
            ctx.restore();
        },
        burst(R, sp, b, pr) {
            const s = sp.style, ctx = R.ctx;
            const n = U.num(s.rays, 10);
            const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
            const r0 = Math.hypot(b.w, b.h) / 2 + b.h * U.num(s.gap, 0.15);
            const len = b.h * U.num(s.length, 0.45);
            const a = pr.raw;
            const outer = r0 + len * R.lib.eases.get(sp.preset.ease)(U.clamp(a * 1.6, 0, 1));
            const inner = r0 + len * R.lib.eases.get(sp.preset.ease)(U.clamp((a - 0.4) * 1.6, 0, 1));
            if (outer - inner < 0.5) return;
            ctx.lineWidth = b.h * U.num(s.thickness, 0.05);
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (let i = 0; i < n; i++) {
                const ang = (i / n) * Math.PI * 2 + U.num(s.rotate, 0.2);
                const ky = U.num(s.squash, 0.55);
                ctx.moveTo(cx + Math.cos(ang) * inner, cy + Math.sin(ang) * inner * ky);
                ctx.lineTo(cx + Math.cos(ang) * outer, cy + Math.sin(ang) * outer * ky);
            }
            ctx.stroke();
        },
        sparkle(R, sp, b, pr) {
            const s = sp.style, ctx = R.ctx;
            const n = U.num(s.count, 5);
            const Rn = rng(sp.seed);
            for (let i = 0; i < n; i++) {
                const ang = Rn() * Math.PI * 2, rad = 0.55 + Rn() * 0.35;
                const x = b.x + b.w / 2 + Math.cos(ang) * (b.w / 2 + b.h * 0.3) * rad * 1.2;
                const y = b.y + b.h / 2 + Math.sin(ang) * (b.h / 2 + b.h * 0.3) * rad * 1.3;
                const tw = Math.max(0, Math.sin((pr.age - i * 0.13) * U.num(s.speed, 5) + Rn() * 6));
                const size = b.h * U.num(s.size, 0.14) * tw * pr.p;
                if (size < 0.5) continue;
                ctx.beginPath();
                ctx.moveTo(x, y - size); ctx.quadraticCurveTo(x, y, x + size, y); ctx.quadraticCurveTo(x, y, x, y + size);
                ctx.quadraticCurveTo(x, y, x - size, y); ctx.quadraticCurveTo(x, y, x, y - size);
                ctx.fill();
            }
        },
        badge(R, sp, b, pr) {
            const s = sp.style, ctx = R.ctx;
            const txt = sp.args[0] || (sp.node && sp.node.badgeText) || '1';
            const r = b.h * U.num(s.radius, 0.36);
            const at = s.at || 'left';
            const cx = at === 'left' ? b.x - r * 1.4 : b.x + b.w + r * 1.4, cy = b.y + b.h * U.num(s.y, 0.2);
            ctx.save();
            ctx.translate(cx, cy);
            ctx.scale(pr.p, pr.p);
            ctx.rotate(U.deg((1 - pr.p) * 90));
            ctx.shadowColor = resolveColor(R.theme, '@shadow'); ctx.shadowBlur = 8 * R.s; ctx.shadowOffsetY = 4 * R.s;
            ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
            ctx.shadowColor = 'transparent';
            drawHandText(R, txt, 0, r * 0.04, r * U.num(s.textSize, 1.1), sp.textColor, s.textRole || 'display');
            ctx.restore();
        },
        callout(R, sp, b, pr) {
            // Legacy annotationCallout/Label: paper note card + connector.
            const s = sp.style, ctx = R.ctx;
            const node = sp.node || {};
            const off = s.offset || [0.9, -1.2];
            const cxn = b.x + b.w + b.h * off[0], cyn = b.y + b.h * off[1];
            const tipX = b.x + b.w * 0.95, tipY = b.y + b.h * 0.1;
            const conn = node.connectorType || s.connector || 'curve';
            const pts = conn === 'elbow' ? [[tipX, tipY], [tipX, cyn], [cxn, cyn]] : conn === 'none' ? [] : quadPts(tipX, tipY, (tipX + cxn) / 2, tipY, cxn, cyn, 16);
            const pl = U.clamp(pr.raw / 0.5, 0, 1);
            ctx.lineWidth = b.h * U.num(s.thickness, 0.035); ctx.lineCap = 'round';
            if (pts.length) {
                strokePartial(ctx, pts, R.lib.eases.get(sp.preset.ease)(pl));
                const endStyle = node.connectorEnd || s.head || 'dot';
                if (endStyle !== 'none' && pl > 0.3) { const e = endOf(pts.slice().reverse(), 1); arrowHead(ctx, e.x, e.y, e.ang, b.h * 0.15, endStyle); }
            }
            const cp = R.lib.eases.get(s.cardEase || sp.preset.ease)(U.clamp((pr.raw - 0.35) / 0.65, 0, 1));
            if (cp <= 0) return;
            const title = sp.title && sp.title !== sp.label ? sp.title : '';
            const text = sp.label || title;
            if (!text) return;
            const px = b.h * U.num(s.textSize, 0.26);
            ctx.font = fontFor(R.theme, { role: s.textRole || 'hand', size: 1 }, px);
            const lines = String(text).split('\n').slice(0, 4);
            const tw = Math.max(...lines.map(l => ctx.measureText(l).width)) + px * 1.2;
            const th = lines.length * px * 1.15 + px * 0.9;
            ctx.save();
            ctx.translate(cxn, cyn);
            ctx.scale(1, cp);
            ctx.rotate(U.deg(U.num(s.rotate, 2)));
            ctx.fillStyle = resolveColor(R.theme, s.cardColor || '@paper');
            ctx.shadowColor = resolveColor(R.theme, '@shadow'); ctx.shadowBlur = 10 * R.s; ctx.shadowOffsetY = 5 * R.s;
            ctx.translate(0, -th / 2);
            pathFromPts(ctx, tornRectPath(tw, th, 0.6, sp.seed), true);
            ctx.fill();
            ctx.shadowColor = 'transparent';
            ctx.fillStyle = sp.color; ctx.fillRect(0, 0, px * 0.18, th);
            lines.forEach((l, i) => drawHandText(R, l, px * 0.6, px * 1.0 + i * px * 1.15, px, sp.color2, s.textRole || 'hand', 'left'));
            ctx.restore();
        },
        threshold(R, sp, b, pr) {
            const s = sp.style, ctx = R.ctx;
            const span = b.h * U.num(s.span, 6);
            const vertical = sp.args[0] === 'vertical' || s.vertical;
            ctx.lineWidth = b.h * U.num(s.thickness, 0.03);
            ctx.setLineDash((s.dash || [0.2, 0.12]).map(v => v * b.h));
            ctx.beginPath();
            if (vertical) { const x = b.x - b.h * 0.3; ctx.moveTo(x, b.y + b.h / 2 - span * pr.p / 2); ctx.lineTo(x, b.y + b.h / 2 + span * pr.p / 2); }
            else { const y = b.y + b.h * U.num(s.at, 1.15); const cx = b.x + b.w / 2; ctx.moveTo(cx - span * pr.p / 2, y); ctx.lineTo(cx + span * pr.p / 2, y); }
            ctx.stroke();
            ctx.setLineDash([]);
        },
        stamp(R, sp, b, pr) {
            const s = sp.style, ctx = R.ctx;
            const txt = sp.args[0] || s.text || '';
            if (!txt) return;
            const px = b.h * U.num(s.size, 0.34);
            const k = U.lerp(U.num(s.fromScale, 2.6), 1, pr.p);
            ctx.save();
            ctx.translate(b.x + b.w * U.num(s.x, 1.0), b.y + b.h * U.num(s.y, -0.05));
            ctx.rotate(U.deg(U.num(s.rotate, -12)));
            ctx.scale(k, k);
            ctx.globalAlpha *= U.clamp(pr.raw * 3, 0, 1) * U.num(s.opacity, 0.9);
            ctx.font = fontFor(R.theme, { role: s.role || 'display', size: 1 }, px);
            const w = ctx.measureText(txt).width + px * 0.8;
            ctx.lineWidth = px * 0.1;
            ctx.strokeRect(-w / 2, -px * 0.75, w, px * 1.5);
            drawHandText(R, txt, 0, 0, px, sp.color, s.role || 'display');
            ctx.restore();
        },
        label(R, sp, b, pr) {
            const s = sp.style;
            const txt = sp.label || sp.args[0] || '';
            if (!txt) return;
            const px = b.h * U.num(s.size, 0.3);
            const ctx = R.ctx;
            ctx.save();
            const below = (s.at || 'below') === 'below';
            ctx.translate(b.x + b.w / 2, below ? b.y + b.h + px * 1.1 : b.y - px * 0.9);
            ctx.rotate(U.deg(U.num(s.rotate, -2)));
            ctx.scale(pr.p, pr.p);
            drawHandText(R, txt, 0, 0, px, sp.color, s.role || 'hand');
            ctx.restore();
        }
    };

    function drawSupp(R, sp, shotSp, supp, dof) {
        const pr = suppProgress(supp, R.t, R.lib.eases);
        if (!pr) return;
        const fn = SUPP_DRAW[supp.kind];
        if (!fn) { Log.warn('supkind:' + supp.kind, `Supplement kind "${supp.kind}" has no renderer.`); return; }
        const b = supp.box;
        const lift = U.num(supp.style.lift, supp.preset.layer === 'under' ? 2 : 10);
        const c = [b.x + b.w / 2, b.y + b.h / 2];
        const af = layerAffine(R.view, shotSp, [c[0], c[1], -lift], rotMat(0, 0, 0), c, c, Math.max(4, b.h / 2));
        if (!af) return;
        const ctx = R.ctx;
        setFilter(R, dof + R.mblur);
        setT(R, af);
        ctx.save();
        if (pr.out < 1) { ctx.translate(c[0], c[1]); const k = U.lerp(U.num(supp.preset.exitScale, 0.85), 1, pr.out); ctx.scale(k, k); ctx.translate(-c[0], -c[1]); }
        ctx.globalAlpha = R.alpha * pr.out;
        ctx.strokeStyle = supp.color; ctx.fillStyle = supp.color;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (supp.style.shadow !== false && supp.preset.layer !== 'under') {
            ctx.shadowColor = resolveColor(R.theme, '@shadow'); ctx.shadowBlur = 4 * R.s * af.scale; ctx.shadowOffsetY = 3 * R.s * af.scale; ctx.shadowOffsetX = 2 * R.s * af.scale;
        }
        fn(R, supp, b, pr);
        ctx.restore();
        R.filter = null;
    }

    /** Screen-space accent wipe (shapeWipe) under the world layers. */
    function drawScreenSupp(R, supp) {
        const pr = suppProgress(supp, R.t, R.lib.eases);
        if (!pr) return;
        const s = supp.style, ctx = R.ctx, F = R.frame;
        const W = F.width, H = F.height;
        ctx.setTransform(R.s, 0, 0, R.s, R.ox, R.oy);
        setFilter(R, R.mblur);
        const band = W * U.num(s.band, 0.6);
        const x = U.lerp(-band - W * 0.2, W + band * 0.2, pr.raw);
        const sk = H * Math.tan(U.deg(U.num(s.skew, 18)));
        ctx.globalAlpha = R.alpha * U.num(s.opacity, 1);
        ctx.fillStyle = supp.color;
        ctx.beginPath();
        ctx.moveTo(x + sk, 0); ctx.lineTo(x + band + sk, 0); ctx.lineTo(x + band, H); ctx.lineTo(x, H);
        ctx.closePath(); ctx.fill();
    }

    /* ════════════════════════════════════════════════════════════════════
     * 15. KINETIC BACKGROUNDS (camera-space parallax, all from JSON)
     * ════════════════════════════════════════════════════════════════════ */
    function wrap(v, period) { return ((((v + period / 2) % period) + period) % period) - period / 2; }

    /** World (x,y) at a background depth → camera-relative coords (yaw/pitch give rotational parallax). */
    function camRel(R, x, y, depth) {
        const p = R.view.pose;
        return [x - p.tx - U.deg(p.rotY) * depth, y - p.ty + U.deg(p.rotX) * depth];
    }
    /** Project camera-relative coords at a depth, applying camera roll. */
    function bgProject(R, rx, ry, depth) {
        const roll = -U.deg(R.view.pose.rotZ), f = R.view.f;
        const cr = Math.cos(roll), sr = Math.sin(roll);
        const x = rx * cr - ry * sr, y = rx * sr + ry * cr;
        return { x: R.view.cx + (x * f) / depth, y: R.view.cy + (y * f) / depth, k: f / depth, roll };
    }
    function bgPoint(R, x, y, depth) { const r = camRel(R, x, y, depth); return bgProject(R, r[0], r[1], depth); }

    const BG_DRAW = {
        paperPlanes(R, L, i, t) {
            const ctx = R.ctx, Rn = rng(R.scene.seed + ':pp' + i);
            const n = U.num(L.count, 6);
            const cols = U.asArray(L.colors).length ? L.colors : ['@paper2'];
            for (let k = 0; k < n; k++) {
                const depth = U.lerp(U.num(L.depth && L.depth[0], 1800), U.num(L.depth && L.depth[1], 4200), Rn());
                const visW = R.frame.width * depth / R.view.f, visH = R.frame.height * depth / R.view.f;
                const period = Math.max(U.num(L.spread, 1.6) * visW, visW * 1.3);
                const bx = (Rn() - 0.5) * period, by = (Rn() - 0.5) * visH * 1.4;
                const drift = t * U.num(L.drift, 12) * (Rn() - 0.5);
                const rel = camRel(R, bx + drift, by, depth);
                const w = visW * U.lerp(U.num(L.size && L.size[0], 0.2), U.num(L.size && L.size[1], 0.5), Rn());
                const h = w * U.lerp(0.35, 0.9, Rn());
                const rot = (Rn() - 0.5) * U.num(L.rotJitter, 20) + Math.sin(t * 0.3 + k) * U.num(L.sway, 2);
                const P = bgProject(R, wrap(rel[0], period), wrap(rel[1], visH * 1.6), depth);
                ctx.setTransform(R.s, 0, 0, R.s, R.ox, R.oy);
                ctx.translate(P.x, P.y); ctx.rotate(P.roll + U.deg(rot)); ctx.scale(P.k, P.k);
                ctx.globalAlpha = R.alpha * U.num(L.opacity, 1);
                ctx.fillStyle = resolveColor(R.theme, cols[k % cols.length]);
                ctx.shadowColor = resolveColor(R.theme, '@shadow'); ctx.shadowBlur = 14 * R.s * P.k; ctx.shadowOffsetY = 8 * R.s * P.k;
                ctx.translate(-w / 2, -h / 2);
                pathFromPts(ctx, tornRectPath(w, h, U.num(L.torn, 0.8), R.scene.seed + 'ppt' + i + ':' + k, w / 30), true);
                ctx.fill();
                ctx.shadowColor = 'transparent';
            }
        },
        confetti(R, L, i, t) {
            const ctx = R.ctx, Rn = rng(R.scene.seed + ':cf' + i);
            const n = U.num(L.count, 40);
            const cols = U.asArray(L.colors).length ? L.colors : ['@accent'];
            const shapes = U.asArray(L.shapes).length ? L.shapes : ['rect'];
            for (let k = 0; k < n; k++) {
                const depth = U.lerp(U.num(L.depth && L.depth[0], 500), U.num(L.depth && L.depth[1], 3000), Math.pow(Rn(), 0.8));
                const visW = R.frame.width * depth / R.view.f, visH = R.frame.height * depth / R.view.f;
                const bx = Rn() * visW * 1.5, by = Rn() * visH * 1.5;
                const fall = t * U.num(L.fall, 40) * (0.5 + Rn());
                const sway = Math.sin(t * (0.6 + Rn()) + k) * U.num(L.sway, 30);
                const size = U.lerp(U.num(L.size && L.size[0], 8), U.num(L.size && L.size[1], 22), Rn());
                const spin = t * U.num(L.spin, 90) * (Rn() - 0.5) * 2 + Rn() * 360;
                const flip = Math.cos(U.deg(t * U.num(L.flip, 120) * (0.4 + Rn()) + k * 40));
                const rel = camRel(R, bx + sway, by + fall, depth);
                const P = bgProject(R, wrap(rel[0], visW * 1.5), wrap(rel[1], visH * 1.5), depth);
                const blur = depth < U.num(L.nearBlurDepth, 900) ? (U.num(L.nearBlurDepth, 900) - depth) / 60 : 0;
                setFilter(R, blur + R.mblur);
                ctx.setTransform(R.s, 0, 0, R.s, R.ox, R.oy);
                ctx.translate(P.x, P.y); ctx.rotate(P.roll + U.deg(spin)); ctx.scale(P.k, P.k * Math.max(0.08, Math.abs(flip)));
                ctx.globalAlpha = R.alpha * U.num(L.opacity, 0.9);
                const col = resolveColor(R.theme, cols[k % cols.length]);
                ctx.fillStyle = flip < 0 ? Color.shade(col, -0.25) : col;
                const sh = shapes[k % shapes.length];
                ctx.beginPath();
                if (sh === 'circle') ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
                else if (sh === 'tri') { ctx.moveTo(0, -size / 2); ctx.lineTo(size / 2, size / 2); ctx.lineTo(-size / 2, size / 2); }
                else if (sh === 'squiggle') { ctx.lineWidth = size * 0.25; ctx.strokeStyle = ctx.fillStyle; ctx.moveTo(-size, 0); ctx.bezierCurveTo(-size / 2, -size / 2, 0, size / 2, size / 2, 0); ctx.stroke(); continue; }
                else ctx.rect(-size / 2, -size * 0.3, size, size * 0.6);
                ctx.fill();
            }
            setFilter(R, 0);
        },
        sunburst(R, L, i, t) {
            const ctx = R.ctx;
            const n = U.num(L.rays, 16);
            const Ls = camRel(R, R.view.pose.tx, R.view.pose.ty, U.num(L.depth, 3000));
            const P = bgProject(R, wrap(Ls[0], R.frame.width * 3), Ls[1], U.num(L.depth, 3000));
            const r = Math.hypot(R.frame.width, R.frame.height);
            const rot = U.deg(t * U.num(L.speed, 4)) + P.roll;
            ctx.setTransform(R.s, 0, 0, R.s, R.ox, R.oy);
            ctx.translate(P.x, P.y); ctx.rotate(rot);
            ctx.globalAlpha = R.alpha * U.num(L.opacity, 0.35);
            ctx.fillStyle = resolveColor(R.theme, L.color || '@paper2');
            for (let k = 0; k < n; k += 2) {
                const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a0) * r, Math.sin(a0) * r); ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r); ctx.fill();
            }
        },
        dots(R, L) {
            const ctx = R.ctx;
            const depth = U.num(L.depth, 2500);
            const P = bgPoint(R, 0, 0, depth);
            const sp = U.num(L.spacing, 60) * P.k, rad = U.num(L.radius, 3) * P.k;
            if (sp < 4) return;
            ctx.setTransform(R.s, 0, 0, R.s, R.ox, R.oy);
            ctx.globalAlpha = R.alpha * U.num(L.opacity, 0.3);
            ctx.fillStyle = resolveColor(R.theme, L.color || '@ink');
            const ox = ((P.x % sp) + sp) % sp, oy = ((P.y % sp) + sp) % sp;
            ctx.beginPath();
            for (let x = ox - sp; x < R.frame.width + sp; x += sp) for (let y = oy - sp; y < R.frame.height + sp; y += sp) { ctx.moveTo(x + rad, y); ctx.arc(x, y, rad, 0, Math.PI * 2); }
            ctx.fill();
        },
        grid(R, L) {
            const ctx = R.ctx;
            const P = bgPoint(R, 0, 0, U.num(L.depth, 2500));
            const sp = U.num(L.spacing, 120) * P.k;
            if (sp < 6) return;
            ctx.setTransform(R.s, 0, 0, R.s, R.ox, R.oy);
            ctx.translate(R.view.cx, R.view.cy); ctx.rotate(P.roll); ctx.translate(-R.view.cx, -R.view.cy);
            ctx.globalAlpha = R.alpha * U.num(L.opacity, 0.25);
            ctx.strokeStyle = resolveColor(R.theme, L.color || '@ink');
            ctx.lineWidth = U.num(L.width, 1.5);
            const ox = ((P.x % sp) + sp) % sp, oy = ((P.y % sp) + sp) % sp;
            const ext = Math.hypot(R.frame.width, R.frame.height);
            ctx.beginPath();
            for (let x = ox - ext; x < ext; x += sp) { ctx.moveTo(x, -ext); ctx.lineTo(x, ext); }
            for (let y = oy - ext; y < ext; y += sp) { ctx.moveTo(-ext, y); ctx.lineTo(ext, y); }
            ctx.stroke();
        },
        blobs(R, L, i, t) {
            const ctx = R.ctx, Rn = rng(R.scene.seed + ':bl' + i);
            const n = U.num(L.count, 5);
            const cols = U.asArray(L.colors).length ? L.colors : ['@paper2'];
            for (let k = 0; k < n; k++) {
                const depth = U.lerp(2500, 5000, Rn());
                const visW = R.frame.width * depth / R.view.f, visH = R.frame.height * depth / R.view.f;
                const rel = camRel(R, (Rn() - 0.5) * visW * 1.6 + Math.sin(t * 0.2 + k) * visW * 0.05, (Rn() - 0.5) * visH * 1.2 + Math.cos(t * 0.17 + k) * visH * 0.05, depth);
                const P = bgProject(R, wrap(rel[0], visW * 1.6), wrap(rel[1], visH * 1.6), depth);
                const r = visH * U.lerp(0.15, 0.35, Rn());
                ctx.setTransform(R.s, 0, 0, R.s, R.ox, R.oy);
                ctx.translate(P.x, P.y); ctx.scale(P.k, P.k);
                ctx.globalAlpha = R.alpha * U.num(L.opacity, 0.6);
                ctx.fillStyle = resolveColor(R.theme, cols[k % cols.length]);
                ctx.beginPath();
                for (let a = 0; a <= 24; a++) {
                    const ang = (a / 24) * Math.PI * 2;
                    const rr = r * (1 + Math.sin(ang * 3 + k + t * 0.4) * 0.08 + (Rn() - 0.5) * 0.03);
                    a ? ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr) : ctx.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
                }
                ctx.fill();
            }
        }
    };

    function drawGuides(R, scene, t) {
        const g = scene.guides;
        if (!g || !g.list.length) return;
        const cfg = U.merge(U.pick(R.lib.json, 'defaults.guides') || {}, (scene.background && scene.background.guides) || {});
        const ctx = R.ctx;
        const depth = U.num(cfg.depth, 1800);
        const P = bgPoint(R, R.view.pose.tx, R.view.pose.ty, depth);
        const sw = (g.size && g.size.w) || R.frame.width, sh = (g.size && g.size.h) || R.frame.height;
        const visW = R.frame.width * depth / R.view.f;
        const k = (visW * U.num(cfg.fill, 0.9)) / sw * P.k;
        ctx.setTransform(R.s, 0, 0, R.s, R.ox, R.oy);
        ctx.translate(P.x, P.y); ctx.rotate(P.roll); ctx.scale(k, k); ctx.translate(-sw / 2, -sh / 2);
        const stag = U.num(cfg.stagger, 0.12), dur = U.num(cfg.duration, 1.2);
        g.list.forEach((gl, i) => {
            const p = R.lib.eases.get(cfg.ease)(U.clamp((t - U.num(cfg.delay, 0.2) - i * stag) / dur, 0, 1));
            if (p <= 0) return;
            ctx.globalAlpha = R.alpha * U.num(gl.opacity, 1) * U.num(cfg.opacity, 0.5);
            ctx.strokeStyle = gl.stroke ? gl.stroke : resolveColor(R.theme, cfg.stroke || '@ink');
            ctx.fillStyle = gl.fill && gl.fill !== 'none' ? gl.fill : 'transparent';
            ctx.lineWidth = U.num(gl.strokeWidth, 1.5) * U.num(cfg.lineScale, 2);
            ctx.setLineDash(gl.strokeDasharray ? String(gl.strokeDasharray).split(/[ ,]+/).map(Number) : []);
            switch (gl.kind) {
                case 'line': strokePartial(ctx, [[gl.x1, gl.y1], [gl.x2, gl.y2]], p); break;
                case 'polyline': strokePartial(ctx, String(gl.points).trim().split(/\s+/).map(q => q.split(',').map(Number)), p); break;
                case 'circle': ctx.beginPath(); ctx.arc(gl.cx, gl.cy, gl.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); if (gl.fill && gl.fill !== 'none') { ctx.globalAlpha *= p; ctx.fill(); } ctx.stroke(); break;
                case 'rect': strokePartial(ctx, [[gl.x, gl.y], [gl.x + gl.w, gl.y], [gl.x + gl.w, gl.y + gl.h], [gl.x, gl.y + gl.h], [gl.x, gl.y]], p); break;
                case 'dot': ctx.beginPath(); ctx.arc(gl.x, gl.y, (gl.r || 4) * p, 0, Math.PI * 2); ctx.fillStyle = gl.fill || ctx.strokeStyle; ctx.fill(); break;
                case 'text': ctx.globalAlpha *= p; ctx.font = `${gl.fontWeight || 600} ${gl.fontSize || 12}px ${gl.fontFamily || 'sans-serif'}`; ctx.fillStyle = gl.fill || ctx.strokeStyle; ctx.textAlign = gl.textAnchor === 'middle' ? 'center' : gl.textAnchor === 'end' ? 'right' : 'left'; ctx.fillText(gl.text || '', gl.x, gl.y); ctx.textAlign = 'left'; break;
                case 'path':
                    if (typeof Path2D !== 'undefined') {
                        const path = new Path2D(gl.d);
                        ctx.globalAlpha *= p;
                        if (gl.fill && gl.fill !== 'none') ctx.fill(path);
                        ctx.stroke(path);
                    }
                    break;
                default: break;
            }
            ctx.setLineDash([]);
        });
    }

    function drawOverlays(R) {
        const mat = R.theme.material || {};
        const ctx = R.ctx;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        setFilter(R, 0);
        const W = R.frame.outW, H = R.frame.outH;
        const gr = mat.grain;
        if (gr && U.num(gr.amount, 0) > 0) {
            const tex = grainCanvas(R.opts, 'grain:' + U.num(gr.seed, 7));
            if (tex) {
                const pat = ctx.createPattern(tex, 'repeat');
                const step = Math.floor(R.tGlobal * U.num(gr.fps, 12));
                const Rn = rng(step + 13);
                ctx.save();
                ctx.translate(R.ox - Rn() * 256, R.oy - Rn() * 256);
                ctx.scale(U.num(gr.scale, 1) * R.s, U.num(gr.scale, 1) * R.s);
                ctx.globalAlpha = U.num(gr.amount, 0.08) * R.alpha;
                ctx.globalCompositeOperation = gr.blend || 'overlay';
                ctx.fillStyle = pat;
                ctx.fillRect(-256, -256, (W / R.s) / U.num(gr.scale, 1) + 512, (H / R.s) / U.num(gr.scale, 1) + 512);
                ctx.restore();
            }
        }
        const vg = mat.vignette;
        if (vg && U.num(vg.amount, 0) > 0) {
            const g = ctx.createRadialGradient(R.ox + W / 2, R.oy + H / 2, Math.min(W, H) * U.num(vg.inner, 0.45), R.ox + W / 2, R.oy + H / 2, Math.hypot(W, H) * 0.55);
            g.addColorStop(0, 'rgba(0,0,0,0)');
            g.addColorStop(1, Color.alpha(resolveColor(R.theme, vg.color || '@shadow'), U.num(vg.amount, 0.3) / Math.max(0.01, (Color.parse(resolveColor(R.theme, vg.color || '@shadow')) || { a: 1 }).a)));
            ctx.globalAlpha = R.alpha;
            ctx.fillStyle = g;
            ctx.fillRect(R.ox, R.oy, W, H);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }

    /* ════════════════════════════════════════════════════════════════════
     * 16. SCENE RENDER + MOTIVATED TRANSITIONS + FRAME COMPOSITOR
     * ════════════════════════════════════════════════════════════════════ */
    function shotVisible(shot, t) {
        if (!shot.words.length && !shot.block) return false;
        const first = Math.min(...shot.words.map(w => w.entryStart), ...shot.strips.map(s => s.entryStart), shot.block ? shot.block.entryStart : Infinity);
        if (t < first) return false;
        if (shot.exitEnd != null && t > shot.exitEnd + 0.05) return false;
        return true;
    }

    function drawScene(scene, tl, t, ctx, opts, box) {
        const theme = scene.theme;
        const frame = tl.frame;
        const lib = tl.lib;
        const pose = cameraAt(scene, t, lib);
        const view = makeView(pose, frame, theme);
        const R = {
            ctx, t, tGlobal: scene.start + t, frame, theme, lib, view, scene, opts,
            s: box ? box.s : frame.outH / frame.height, ox: box ? box.ox : 0, oy: box ? box.oy : 0, alpha: 1, filter: null, mblur: 0
        };
        // motion blur from camera velocity (whip pans smear, holds are crisp)
        if (pose.mblur > 0 && !opts.noMotionBlur) {
            const dt = 1 / frame.fps;
            const p0 = cameraAt(scene, Math.max(0, t - dt), lib);
            const v = Math.hypot(pose.tx - p0.tx, pose.ty - p0.ty) * (view.f / pose.dist)
                + Math.hypot(U.deg(pose.rotY - p0.rotY), U.deg(pose.rotX - p0.rotX)) * view.f
                + Math.abs(pose.dist - p0.dist) * 0.2;
            R.mblur = Math.min(U.num(U.pick(theme, 'camera.maxMotionBlur'), 8), v * pose.mblur * U.num(U.pick(theme, 'camera.motionBlurScale'), 0.03));
            if (R.mblur < 0.5) R.mblur = 0;
        }
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.filter = 'none';
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        const bg = scene.background || {};
        const W = frame.outW, H = frame.outH;
        const base = resolveColor(theme, bg.color || '@paper', 'paper');
        if (bg.gradient) {
            const g = ctx.createLinearGradient(R.ox, R.oy, R.ox, R.oy + H);
            g.addColorStop(0, base);
            g.addColorStop(1, resolveColor(theme, bg.gradient.to || '@paper2'));
            ctx.fillStyle = g;
        } else ctx.fillStyle = base;
        ctx.fillRect(R.ox, R.oy, W, H);
        ctx.beginPath(); ctx.rect(R.ox, R.oy, W, H); ctx.clip();

        U.asArray(bg.layers).forEach((L, i) => {
            const fn = BG_DRAW[L.type];
            if (!fn) { Log.warn('bg:' + L.type, `Background layer type "${L.type}" unknown.`); return; }
            ctx.save(); fn(R, L, i, t); ctx.restore(); R.filter = null;
            ctx.filter = 'none';
        });
        ctx.save(); drawGuides(R, scene, t); ctx.restore();

        scene.supps.forEach(sp => { if (sp.preset.screen) { ctx.save(); drawScreenSupp(R, sp); ctx.restore(); R.filter = null; ctx.filter = 'none'; } });

        // depth-sort shots far → near
        const list = [];
        scene.shots.forEach(shot => {
            if (!shotVisible(shot, t)) return;
            const sp = shotSpace(view, shot.pose);
            const zc = sp.o[2] + pose.dist;
            if (zc < view.near) return;
            list.push({ shot, sp, zc });
        });
        list.sort((a, b) => b.zc - a.zc);
        const dofK = U.num(U.pick(theme, 'camera.dofScale'), 1), maxDof = U.num(U.pick(theme, 'camera.maxDof'), 12);
        list.forEach(({ shot, sp, zc }) => {
            const dof = pose.aperture > 0 ? Math.min(maxDof, pose.aperture * dofK * Math.abs(zc - view.focusZ) / zc * 10) : 0;
            const supps = scene.supps.filter(s => s.shot === shot.index && !s.preset.screen);
            ctx.save();
            if (shot.block) drawBlock(R, sp, shot, dof);
            shot.strips.forEach(s => drawStrip(R, sp, s, dof));
            supps.filter(s => s.preset.layer === 'under').forEach(s => drawSupp(R, sp, sp, s, dof));
            shot.words.forEach(w => drawWord(R, sp, w, dof));
            R.filter = null; ctx.filter = 'none';
            supps.filter(s => s.preset.layer !== 'under').forEach(s => drawSupp(R, sp, sp, s, dof));
            ctx.restore();
            R.filter = null;
        });
        ctx.filter = 'none';
        drawOverlays(R);
        ctx.restore();
        return R;
    }

    /* Buffers for transitions (reused between frames) */
    function getBuffer(store, key, w, h, opts) {
        let b = store[key];
        if (!b || b.width !== w || b.height !== h) {
            if (opts.createCanvas) b = opts.createCanvas(w, h);
            else if (typeof OffscreenCanvas !== 'undefined') b = new OffscreenCanvas(w, h);
            else { b = document.createElement('canvas'); b.width = w; b.height = h; }
            store[key] = b;
        }
        return b;
    }

    /** Screen position (0..1) of the last active shot — iris/match-cut origin. */
    function focusPoint(scene, t, tl) {
        const pose = cameraAt(scene, t, tl.lib);
        const view = makeView(pose, tl.frame, scene.theme);
        const live = scene.shots.filter(s => s.start <= t);
        const shot = live[live.length - 1];
        if (!shot) return [0.5, 0.5];
        const sp = shotSpace(view, shot.pose);
        const P = view.project(sp.o);
        return [U.clamp(P[0] / tl.frame.width, 0.1, 0.9), U.clamp(P[1] / tl.frame.height, 0.1, 0.9)];
    }

    const TRANSITIONS = {
        /** Paper sheet with a torn edge slides across, revealing the next scene behind it. */
        paperWipe(ctx, A, B, p, P) {
            const W = P.W, H = P.H;
            const ang = U.deg(U.num(P.tr.angle, 12));
            const band = W * U.num(P.tr.band, 0.12);
            const slant = Math.abs(Math.tan(ang)) * H;
            const x = -band - slant + (W + band * 2 + slant * 2) * p;
            const step = 12 * P.s, jag = U.num(P.tr.jag, 10) * P.s;
            const edge = (y, off, seed) => x + off + Math.tan(ang) * y + (rng(seed + Math.round(y / step))() - 0.5) * jag;
            ctx.drawImage(A, 0, 0);
            // B is revealed on the trailing side of the sheet
            ctx.save();
            ctx.beginPath(); ctx.moveTo(-10, -10);
            for (let y = -10; y <= H + step; y += step) ctx.lineTo(edge(y, 0, 1), y);
            ctx.lineTo(-10, H + step); ctx.closePath(); ctx.clip();
            ctx.drawImage(B, 0, 0);
            ctx.restore();
            // the travelling torn paper band (casts a soft shadow on both scenes)
            ctx.save();
            ctx.beginPath();
            for (let y = -10; y <= H + step; y += step) (y === -10 ? ctx.moveTo : ctx.lineTo).call(ctx, edge(y, 0, 1), y);
            for (let y = H + step; y >= -10; y -= step) ctx.lineTo(edge(y, band, 2), y);
            ctx.closePath();
            ctx.shadowColor = P.shadow; ctx.shadowBlur = 26 * P.s; ctx.shadowOffsetX = 8 * P.s;
            ctx.fillStyle = P.color; ctx.fill();
            ctx.restore();
        },
        /** Iris: circle opens from the last focused word. */
        iris(ctx, A, B, p, P) {
            ctx.drawImage(A, 0, 0);
            const [fx, fy] = P.focus;
            const cx = fx * P.W, cy = fy * P.H;
            const r = Math.hypot(Math.max(cx, P.W - cx), Math.max(cy, P.H - cy)) * p * 1.02;
            ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip(); ctx.drawImage(B, 0, 0); ctx.restore();
            ctx.lineWidth = U.num(P.tr.ring, 18) * P.s * (1 - p);
            if (ctx.lineWidth > 0.5) { ctx.strokeStyle = P.color; ctx.shadowColor = P.shadow; ctx.shadowBlur = 16 * P.s; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); }
        },
        /** Match cut via an accent blob: grows from the focus, then opens onto B. */
        matchCut(ctx, A, B, p, P) {
            const [fx, fy] = P.focus;
            const cx = fx * P.W, cy = fy * P.H, maxR = Math.hypot(P.W, P.H);
            if (p < 0.5) {
                const q = P.ease(p / 0.5);
                ctx.drawImage(A, 0, 0);
                ctx.fillStyle = P.color; ctx.beginPath(); ctx.arc(cx, cy, maxR * q, 0, Math.PI * 2); ctx.fill();
            } else {
                const q = P.ease((p - 0.5) / 0.5);
                ctx.drawImage(B, 0, 0);
                ctx.save(); ctx.fillStyle = P.color; ctx.beginPath(); ctx.rect(0, 0, P.W, P.H); ctx.arc(P.W / 2, P.H / 2, maxR * q, 0, Math.PI * 2, true); ctx.fill(); ctx.restore();
            }
        },
        /** Page fold: A folds away from an edge like a turning page. */
        fold(ctx, A, B, p, P) {
            const W = P.W, H = P.H;
            ctx.drawImage(B, 0, 0);
            ctx.fillStyle = `rgba(0,0,0,${(0.35 * (1 - p)).toFixed(3)})`; ctx.fillRect(0, 0, W, H);
            const vertical = P.tr.axis === 'y';
            const k = Math.cos(p * Math.PI / 2);
            if (k < 0.01) return;
            ctx.save();
            ctx.shadowColor = P.shadow; ctx.shadowBlur = 30 * P.s * p; ctx.shadowOffsetX = vertical ? 0 : 12 * P.s; ctx.shadowOffsetY = vertical ? 12 * P.s : 0;
            if (vertical) { ctx.translate(0, 0); ctx.scale(1, k); } else { ctx.scale(k, 1); }
            ctx.drawImage(A, 0, 0);
            ctx.shadowColor = 'transparent';
            const g = vertical ? ctx.createLinearGradient(0, 0, 0, H) : ctx.createLinearGradient(0, 0, W, 0);
            g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${(0.55 * p).toFixed(3)})`);
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
            ctx.restore();
        },
        /** Camera fly-through: push through A's plane into B arriving from depth. */
        flyThrough(ctx, A, B, p, P) {
            const W = P.W, H = P.H;
            const [fx, fy] = P.focus;
            const inS = U.lerp(U.num(P.tr.inScale, 0.55), 1, p), outS = U.lerp(1, U.num(P.tr.outScale, 3.2), p);
            ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(inS, inS); ctx.translate(-W / 2, -H / 2); ctx.drawImage(B, 0, 0); ctx.restore();
            ctx.save();
            ctx.globalAlpha = U.clamp(1 - Math.pow(p, U.num(P.tr.fadePower, 1.6)), 0, 1);
            const bl = U.num(P.tr.blur, 10) * p * P.s;
            if (bl > 0.5) ctx.filter = `blur(${bl.toFixed(1)}px)`;
            ctx.translate(fx * W, fy * H); ctx.scale(outS, outS); ctx.translate(-fx * W, -fy * H);
            ctx.drawImage(A, 0, 0);
            ctx.restore();
        },
        /** Push: B shoves A off-screen with a paper-edge shadow between them. */
        push(ctx, A, B, p, P) {
            const W = P.W, H = P.H;
            const dir = U.num(P.tr.direction, -1);
            const x = dir * W * p;
            ctx.drawImage(A, x, 0);
            ctx.save();
            ctx.shadowColor = P.shadow; ctx.shadowBlur = 28 * P.s; ctx.shadowOffsetX = dir * -8 * P.s;
            ctx.drawImage(B, x - dir * W, 0);
            ctx.restore();
        },
        /** Venetian paper shutters flip one after another. */
        shutter(ctx, A, B, p, P) {
            const W = P.W, H = P.H;
            const n = Math.max(2, U.num(P.tr.bands, 7));
            const bw = W / n;
            const stag = U.num(P.tr.stagger, 0.5);
            for (let i = 0; i < n; i++) {
                const q = U.clamp((p - (i / n) * stag) / (1 - stag), 0, 1);
                const e = P.ease(q);
                const ang = e * Math.PI;
                const k = Math.abs(Math.cos(ang));
                const src = ang < Math.PI / 2 ? A : B;
                ctx.save();
                ctx.fillStyle = P.color; ctx.fillRect(i * bw, 0, bw + 1, H);
                ctx.translate(i * bw + bw / 2, 0); ctx.scale(Math.max(0.001, k), 1); ctx.translate(-(i * bw + bw / 2), 0);
                ctx.drawImage(src, i * bw, 0, bw + 1, H, i * bw, 0, bw + 1, H);
                ctx.fillStyle = `rgba(0,0,0,${(0.4 * (1 - k)).toFixed(3)})`; ctx.fillRect(i * bw, 0, bw + 1, H);
                ctx.restore();
            }
        },
        /** Paper tear: A rips down a jagged seam and the halves pull apart. */
        tear(ctx, A, B, p, P) {
            const W = P.W, H = P.H;
            ctx.drawImage(B, 0, 0);
            const Rn = rng('tear');
            const seam = [];
            for (let y = 0; y <= H + 20 * P.s; y += 20 * P.s) seam.push([W / 2 + (Rn() - 0.5) * 60 * P.s, y]);
            const gap = W * 0.6 * p;
            [-1, 1].forEach(side => {
                ctx.save();
                ctx.translate(side * gap, 0);
                ctx.rotate(U.deg(side * 4 * p));
                ctx.beginPath();
                ctx.moveTo(side < 0 ? -W : W * 2, -20);
                seam.forEach(q => ctx.lineTo(q[0], q[1]));
                ctx.lineTo(side < 0 ? -W : W * 2, H + 20);
                ctx.closePath();
                ctx.shadowColor = P.shadow; ctx.shadowBlur = 20 * P.s;
                ctx.fillStyle = P.color; ctx.fill();
                ctx.shadowColor = 'transparent';
                ctx.clip();
                ctx.drawImage(A, 0, 0);
                ctx.restore();
            });
        }
    };

    function activeScenes(tl, t) {
        const out = [];
        for (const s of tl.scenes) if (t >= s.start && t < s.end) out.push(s);
        if (!out.length && tl.scenes.length) out.push(t < 0 ? tl.scenes[0] : tl.scenes[tl.scenes.length - 1]);
        return out;
    }

    /**
     * Render one frame at global time t (seconds) into a 2D context whose
     * canvas is frame.outW × frame.outH. Pure function of (timeline, t).
     */
    function renderFrame(tl, t, ctx, opts) {
        opts = opts || {};
        const store = opts.buffers || (tl._buffers = tl._buffers || {});
        const W = tl.frame.outW, H = tl.frame.outH;
        t = U.clamp(t, 0, Math.max(0, tl.duration - 1e-4));
        const act = activeScenes(tl, t);
        if (!act.length) { ctx.clearRect(0, 0, W, H); return; }
        if (act.length === 1) { drawScene(act[0], tl, t - act[0].start, ctx, opts); return; }
        const [A, B] = act;
        const tr = A.transition || {};
        const p = U.clamp((t - B.start) / Math.max(1e-6, A.end - B.start), 0, 1);
        const ease = tl.lib.eases.get(tr.ease);
        const fn = TRANSITIONS[tr.type];
        const bufA = getBuffer(store, 'A', W, H, opts), bufB = getBuffer(store, 'B', W, H, opts);
        const ca = bufA.getContext('2d'), cb = bufB.getContext('2d');
        drawScene(A, tl, t - A.start, ca, opts);
        drawScene(B, tl, t - B.start, cb, opts);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.filter = 'none';
        ctx.globalAlpha = 1;
        if (!fn) Log.warn('trans:' + tr.type, `Transition type "${tr.type}" unknown — using paperWipe.`);
        (fn || TRANSITIONS.paperWipe)(ctx, bufA, bufB, ease(p), {
            W, H, s: H / tl.frame.height, tr, ease,
            color: resolveColor(B.theme, tr.color || '@accent', 'accent'),
            shadow: resolveColor(B.theme, '@shadow', 'shadow'),
            focus: focusPoint(A, t - A.start, tl)
        });
        ctx.restore();
    }

    /* ════════════════════════════════════════════════════════════════════
     * 17b. PRESET PACKS + VALIDATION
     * A pack is a partial presets file (same sections) merged over the base:
     *   { "pack": { "name": "…", "version": "1.0" }, "entry": { "newPreset": {…} },
     *     "append": { "themes.paperWhimsy.defaults.entryCycle": ["newPreset"] },
     *     "remove": ["entry.oldPreset"] }
     * Objects merge deeply, arrays replace, "append" extends arrays, "remove" deletes keys.
     * ════════════════════════════════════════════════════════════════════ */
    function mergePresets(base, ...packs) {
        let out = U.clone(base || {});
        const loaded = [];
        packs.flat().filter(Boolean).forEach((pk, i) => {
            const pack = U.clone(pk);
            const meta = pack.pack || { name: 'pack-' + (i + 1) };
            const append = pack.append || {}, remove = U.asArray(pack.remove);
            delete pack.pack; delete pack.append; delete pack.remove; delete pack.$schema;
            out = U.merge(out, pack);
            Object.keys(append).forEach(path => {
                const parts = path.split('.');
                let cur = out;
                for (let j = 0; j < parts.length - 1; j++) { cur[parts[j]] = cur[parts[j]] || {}; cur = cur[parts[j]]; }
                const last = parts[parts.length - 1];
                const add = U.asArray(append[path]);
                cur[last] = U.asArray(cur[last]).concat(add.filter(x => !U.asArray(cur[last]).includes(x)));
            });
            remove.forEach(path => {
                const parts = String(path).split('.');
                let cur = out;
                for (let j = 0; j < parts.length - 1 && cur; j++) cur = cur[parts[j]];
                if (cur) delete cur[parts[parts.length - 1]];
            });
            loaded.push(Object.assign({ name: meta.name, version: meta.version || '', counts: countPresets(pk) }, meta));
        });
        out._packs = (out._packs || []).concat(loaded);
        return out;
    }
    function countPresets(pk) {
        let n = 0;
        CATEGORIES.concat(['easings', 'typeStyles', 'tagAliases', 'recipes', 'themes', 'icons']).forEach(c => { if (U.isObj(pk[c])) n += Object.keys(pk[c]).filter(k => k[0] !== '_').length; });
        return n;
    }

    const CHANNELS = ADDITIVE.concat(MULTIPLY);
    const CAMERA_CHANNELS = POSE_KEYS.concat(['zoom']);
    /**
     * validatePresets(json) → [{ level: 'error'|'warn', path, msg }]
     * Checks structure, keyframes, identity rules, references between presets and
     * that every primitive (transition type, background layer, supplement kind…) exists.
     */
    function validatePresets(json) {
        const issues = [];
        const err = (path, msg) => issues.push({ level: 'error', path, msg });
        const warn = (path, msg) => issues.push({ level: 'warn', path, msg });
        const J = json || {};
        const easings = J.easings || {};
        const easeOk = e => e == null || typeof e !== 'string' || !!easings[e] || /^cubic-bezier\(/.test(e) || e === '__default';
        const entries = (cat) => Object.entries(J[cat] || {}).filter(([k]) => k[0] !== '_');
        const names = cat => new Set(Object.keys(J[cat] || {}).filter(k => k[0] !== '_'));
        const checkEase = (path, e) => { if (!easeOk(e)) err(path, `ease "${e}" is not defined in "easings"`); };
        const checkTrack = (path, keys, identity, rule, channels) => {
            if (!Array.isArray(keys)) { err(path, 'track must be an array of [time, value, ease?] keys'); return; }
            if (!keys.length) { err(path, 'track is empty'); return; }
            if (!Array.isArray(keys[0])) return; // constant
            let prev = -1;
            keys.forEach((k, i) => {
                if (!Array.isArray(k) || k.length < 2) { err(`${path}[${i}]`, 'key must be [time, value] or [time, value, ease]'); return; }
                if (typeof k[0] !== 'number' || k[0] < 0 || k[0] > 1) err(`${path}[${i}]`, 'time must be a number from 0 to 1');
                if (k[0] < prev) err(`${path}[${i}]`, 'times must increase');
                if (typeof k[1] !== 'number') err(`${path}[${i}]`, 'value must be a number');
                if (k[2] != null) checkEase(`${path}[${i}][2]`, k[2]);
                prev = k[0];
            });
            const first = keys[0][1], last = keys[keys.length - 1][1];
            const isRot = /^rot/.test(path.split('.').pop());
            const eq = (a, b) => Math.abs(a - b) < 1e-6 || (isRot && Math.abs(((a - b) % 360 + 360) % 360) < 1e-6);
            if (rule === 'end' && !eq(last, identity)) warn(path, `entry presets should end at ${identity} (ends at ${last}) or the text stays offset`);
            if (rule === 'start' && !eq(first, identity)) warn(path, `exit presets should start at ${identity} (starts at ${first}) or the text jumps`);
            if (rule === 'both' && (!eq(first, identity) || !eq(last, identity))) warn(path, `emphasis presets should start and end at ${identity} or the text jumps`);
            if (rule === 'loop' && !eq(first, last)) warn(path, 'loop presets should end on the same value they start with, or the loop pops');
            void channels;
        };
        const checkMotion = (cat, rule) => entries(cat).forEach(([name, p]) => {
            const path = `${cat}.${name}`;
            if (!U.isObj(p)) { err(path, 'preset must be an object'); return; }
            if (p.extends && !names(cat).has(p.extends)) err(path + '.extends', `extends unknown ${cat} preset "${p.extends}"`);
            if (!p.intent) warn(path, 'add an "intent" line describing the motion');
            checkEase(path + '.ease', p.ease);
            if (p.duration != null && !(p.duration > 0)) err(path + '.duration', 'duration must be > 0 seconds');
            if (p.stagger) {
                if (p.stagger.unit && !['char', 'word'].includes(p.stagger.unit)) err(path + '.stagger.unit', 'unit must be "char" or "word"');
                if (p.stagger.from && !['start', 'end', 'center', 'edges', 'random'].includes(p.stagger.from)) err(path + '.stagger.from', 'from must be start | end | center | edges | random');
            }
            if (p.anchor && !['center', 'baseline', 'top', 'bottom', 'left', 'right', 'bottomLeft', 'topLeft'].includes(p.anchor)) err(path + '.anchor', 'anchor must be center | baseline | top | bottom | left | right | bottomLeft | topLeft');
            if (!p.props && !p.extends) err(path, 'missing "props"');
            Object.entries(p.props || {}).forEach(([ch, keys]) => {
                if (!CHANNELS.includes(ch)) { err(`${path}.props.${ch}`, `unknown channel "${ch}" (use ${CHANNELS.join(', ')})`); return; }
                checkTrack(`${path}.props.${ch}`, keys, MULTIPLY.includes(ch) ? 1 : 0, rule, CHANNELS);
            });
            if (cat === 'loop' && !(p.period > 0)) warn(path, 'loops need a "period" in seconds');
        });
        checkMotion('entry', 'end');
        checkMotion('emphasis', 'both');
        checkMotion('exit', 'start');
        checkMotion('loop', 'loop');

        entries('easings').forEach(([name, e]) => {
            const c = U.isObj(e) && e.curve !== undefined ? e.curve : e;
            if (typeof c === 'string') { if (!easings[c] && !/^cubic-bezier\(/.test(c)) err('easings.' + name, `refers to unknown ease "${c}"`); return; }
            if (Array.isArray(c)) { if (c.length !== 4 || c.some(v => typeof v !== 'number')) err('easings.' + name, 'bezier needs 4 numbers [x1,y1,x2,y2]'); else if (c[0] < 0 || c[0] > 1 || c[2] < 0 || c[2] > 1) err('easings.' + name, 'bezier x1 and x2 must be between 0 and 1'); return; }
            if (!U.isObj(c) || !['bezier', 'spring', 'elastic', 'bounce', 'anticipate', 'steps'].includes(c.type)) err('easings.' + name, 'curve must be a bezier array or {type: spring|elastic|bounce|anticipate|steps|bezier}');
        });

        entries('camera').forEach(([name, p]) => {
            const path = 'camera.' + name;
            if (!p.intent) warn(path, 'add an "intent" line');
            checkEase(path + '.ease', p.ease);
            ['from', 'drift', 'framing'].forEach(k => Object.keys(p[k] || {}).forEach(ch => { if (!CAMERA_CHANNELS.includes(ch) && ch !== 'aperture') err(`${path}.${k}.${ch}`, `unknown camera channel "${ch}" (use ${CAMERA_CHANNELS.join(', ')})`); }));
            Object.entries(p.props || {}).forEach(([ch, keys]) => {
                if (!CAMERA_CHANNELS.includes(ch)) err(`${path}.props.${ch}`, `unknown camera channel "${ch}"`);
                else checkTrack(`${path}.props.${ch}`, keys, ch === 'zoom' ? 1 : 0, 'both');
            });
        });
        entries('staging').forEach(([name, p]) => { if (p.type && !['linear', 'ring'].includes(p.type)) err(`staging.${name}.type`, 'type must be "linear" or "ring"'); });
        entries('layouts').forEach(([name, p]) => {
            if (p.mode && !['lockup', 'center', 'left', 'cascade', 'arc'].includes(p.mode)) err(`layouts.${name}.mode`, 'mode must be lockup | center | left | cascade | arc');
            if (p.paper && p.paper.strip && !['line', 'word', 'shot', 'none'].includes(p.paper.strip)) err(`layouts.${name}.paper.strip`, 'strip must be line | word | shot | none');
            if (p.paper && p.paper.entry && !names('entry').has(p.paper.entry)) err(`layouts.${name}.paper.entry`, `unknown entry preset "${p.paper.entry}"`);
        });
        entries('supplements').forEach(([name, p]) => {
            const kind = p.kind || (p.extends && (J.supplements[p.extends] || {}).kind) || name;
            if (!SUPP_DRAW[kind] && !['counter', 'none', 'shapeWipe'].includes(kind)) err(`supplements.${name}.kind`, `kind "${kind}" has no renderer (use ${Object.keys(SUPP_DRAW).concat('counter', 'shapeWipe').join(', ')})`);
            checkEase(`supplements.${name}.ease`, p.ease);
            if (p.layer && !['under', 'over'].includes(p.layer)) err(`supplements.${name}.layer`, 'layer must be "under" or "over"');
        });
        entries('transitions').forEach(([name, p]) => {
            if (!TRANSITIONS[p.type]) err(`transitions.${name}.type`, `type "${p.type}" does not exist (use ${Object.keys(TRANSITIONS).join(', ')})`);
            checkEase(`transitions.${name}.ease`, p.ease);
        });
        entries('backgrounds').forEach(([name, p]) => U.asArray(p.layers).forEach((L, i) => { if (!BG_DRAW[L.type]) err(`backgrounds.${name}.layers[${i}].type`, `layer type "${L.type}" does not exist (use ${Object.keys(BG_DRAW).join(', ')})`); }));

        // tags must resolve to something the engine understands
        const tagWords = new Set(Object.keys(J.typeStyles || {}).concat(Object.keys(J.supplements || {}), Object.keys(BLOCK_TAGS), ['in', 'out', 'fx', 'color', 'size', 'font', 'counter', 'em']));
        entries('tagAliases').forEach(([name, v]) => String(v).split(/\s+/).forEach(tok => {
            const base = tok.split(':')[0];
            if (base && !tagWords.has(base) && !(J.tagAliases || {})[base]) err(`tagAliases.${name}`, `"${base}" is not a type style, supplement, visual tag or alias`);
            if ((base === 'in' || base === 'out') && tok.split(':')[1] && !names(base === 'in' ? 'entry' : 'exit').has(tok.split(':')[1])) err(`tagAliases.${name}`, `unknown ${base === 'in' ? 'entry' : 'exit'} preset "${tok.split(':')[1]}"`);
            if (base === 'fx' && tok.split(':')[1] && !names('emphasis').has(tok.split(':')[1])) err(`tagAliases.${name}`, `unknown emphasis preset "${tok.split(':')[1]}"`);
        }));
        entries('typeStyles').forEach(([name, st]) => {
            if (st.emphasis && !names('emphasis').has(st.emphasis)) err(`typeStyles.${name}.emphasis`, `unknown emphasis "${st.emphasis}"`);
            if (st.idle && !names('loop').has(st.idle)) err(`typeStyles.${name}.idle`, `unknown loop "${st.idle}"`);
        });

        // recipes reference presets by name
        const ref = (path, cat, v) => U.asArray(v).forEach(n => { if (n && !names(cat).has(n)) err(path, `unknown ${cat} preset "${n}"`); });
        entries('recipes').forEach(([name, r]) => {
            const path = 'recipes.' + name;
            if (!r.intent) warn(path, 'add an "intent" line (which sentences it is for)');
            ref(path + '.entry', 'entry', r.entry); ref(path + '.emphasis', 'emphasis', r.emphasis); ref(path + '.exit', 'exit', r.exit); ref(path + '.idle', 'loop', r.idle);
            ref(path + '.layout', 'layouts', r.layout); ref(path + '.staging', 'staging', r.staging); ref(path + '.cameraMoves', 'camera', r.cameraMoves);
            ref(path + '.background', 'backgrounds', r.background); ref(path + '.outro', 'camera', r.outro);
            if (typeof r.transition === 'string') ref(path + '.transition', 'transitions', r.transition);
            if (r.extends && !names('recipes').has(r.extends)) err(path + '.extends', `extends unknown recipe "${r.extends}"`);
        });
        entries('annotationTypes').forEach(([name, a]) => ['titleRecipe', 'labelRecipe'].forEach(k => { if (a[k] && !names('recipes').has(a[k])) err(`annotationTypes.${name}.${k}`, `unknown recipe "${a[k]}"`); }));
        const rules = U.pick(J, 'auto.recipeRules') || [];
        rules.forEach((r, i) => {
            if (!names('recipes').has(r.recipe)) err(`auto.recipeRules[${i}]`, `unknown recipe "${r.recipe}"`);
            try { new RegExp(r.match, 'iu'); } catch (e) { err(`auto.recipeRules[${i}].match`, 'invalid regular expression: ' + e.message); }
        });

        // themes: palette tokens and default cycles
        const cycles = { entry: 'entry', entryCycle: 'entry', exit: 'exit', idle: 'loop', emojiIdle: 'loop', camera: 'camera', cameraMoves: 'camera', staging: 'staging', stagingCycle: 'staging', layout: 'layouts', layoutCycle: 'layouts', captionLayout: 'layouts', transition: 'transitions', transitionCycle: 'transitions', background: 'backgrounds', backgroundCycle: 'backgrounds', stripEntry: 'entry' };
        const checkDefaults = (path, d) => Object.entries(d || {}).forEach(([k, v]) => { if (cycles[k]) ref(`${path}.${k}`, cycles[k], v); });
        checkDefaults('defaults', J.defaults);
        const themeNames = names('themes');
        entries('themes').forEach(([name, t]) => {
            const path = 'themes.' + name;
            if (t.extends && !themeNames.has(t.extends)) err(path + '.extends', `extends unknown theme "${t.extends}"`);
            checkDefaults(path + '.defaults', t.defaults);
            const pal = Object.assign({}, t.extends && J.themes[t.extends] ? J.themes[t.extends].palette : {}, (J.themes[(J.defaults || {}).theme] || {}).palette, t.palette);
            JSON.stringify(t).replace(/"@([a-zA-Z0-9_]+)/g, (m, k) => { if (!(k in pal)) warn(path, `palette token @${k} is used but not defined`); return m; });
            Object.entries(t.typography || {}).forEach(([role, v]) => { if (U.isObj(v) && !v.family && !['numbers'].includes(role)) warn(`${path}.typography.${role}`, 'typography role needs a "family"'); });
        });
        if (J.defaults && J.defaults.theme && !themeNames.has(J.defaults.theme)) err('defaults.theme', `unknown theme "${J.defaults.theme}"`);
        return issues;
    }

    /* ════════════════════════════════════════════════════════════════════
     * 17. FONTS — load every typography family the timeline uses
     * ════════════════════════════════════════════════════════════════════ */
    async function ensureFonts(tl, opts) {
        opts = opts || {};
        if (typeof document === 'undefined' || !tl.fonts.length) return;
        const prov = tl.lib.json.fontProvider;
        if (prov && prov.url && !opts.skipLink) {
            const fams = tl.fonts.map(f => {
                const ws = f.weights.filter(w => w !== 'italic').map(Number).filter(Boolean).sort((a, b) => a - b);
                return fillTemplate(prov.familyParam || 'family={name}', { name: f.family.replace(/ /g, '+'), weights: (ws.length ? ws : [400]).join(';') }).replace(/_/g, '+');
            });
            const href = prov.url.replace('{families}', fams.join('&'));
            if (!document.querySelector(`link[data-kinetic-fonts="${href}"]`)) {
                const l = document.createElement('link');
                l.rel = 'stylesheet'; l.href = href; l.setAttribute('data-kinetic-fonts', href);
                document.head.appendChild(l);
                await new Promise(res => { l.onload = res; l.onerror = res; setTimeout(res, 4000); });
            }
        }
        if (document.fonts && document.fonts.load) {
            const jobs = [];
            tl.fonts.forEach(f => f.weights.forEach(w => { if (w !== 'italic') jobs.push(document.fonts.load(`${w} 64px "${f.family}"`).catch(() => null)); }));
            await Promise.race([Promise.all(jobs), new Promise(r => setTimeout(r, U.num(opts.timeout, 5000)))]);
        }
    }

    /** Async content transforms (auto-director, voice-over preparation…) run before compiling. */
    async function runHooks(content, presets, o) {
        let c = content;
        for (const fn of U.asArray(o.beforeCompile)) { if (typeof fn === 'function') c = (await fn(c, presets, o)) || c; }
        return c;
    }
    /** Ask each visual plug-in to load what the timeline needs (images, SVG, map data…). */
    async function preloadAssets(tl, o) {
        const jobs = tl.assets.map(a => {
            const def = BLOCKS[a.kind];
            if (!def || !def.preload) return null;
            return Promise.resolve(def.preload(a.spec, { lib: tl.lib, frame: tl.frame, meta: tl.meta, opts: o })).catch(e => Log.warn('preload:' + a.kind + e, `Could not load ${a.kind} asset: ${e.message || e}`));
        });
        await Promise.race([Promise.all(jobs), new Promise(r => setTimeout(r, U.num(o && o.preloadTimeout, 15000)))]);
    }

    /* ════════════════════════════════════════════════════════════════════
     * 18. PLAYER — play / pause / scrub / loop / speed / seek-to-scene
     * ════════════════════════════════════════════════════════════════════ */
    class Player {
        constructor(canvas, opts) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.opts = opts || {};
            this.time = 0; this.speed = 1; this.loop = true; this.playing = false;
            this.listeners = {};
            this._raf = null; this._last = 0; this._scene = -1;
            this.timeline = null;
            Log.onWarn(w => this.emit('warn', w));
        }
        on(evt, fn) { (this.listeners[evt] = this.listeners[evt] || []).push(fn); return this; }
        emit(evt, data) { (this.listeners[evt] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } }); }
        /** Compile and show new content. Returns the timeline. */
        async load(content, presets, options) {
            const o = Object.assign({}, this.opts, options || {});
            content = await runHooks(content, presets, o);
            const probe = compile(content, presets, Object.assign({}, o, { measureCtx: this.ctx }));
            await Promise.all([ensureFonts(probe, o), preloadAssets(probe, o)]);
            // recompile after fonts/assets are ready so text metrics and media sizes are exact
            Log.reset();
            const w = U.num(o.previewWidth, probe.frame.outW), h = Math.round(w * probe.frame.outH / probe.frame.outW);
            this.timeline = compile(content, presets, Object.assign({}, o, { width: w, height: h, measureCtx: this.ctx }));
            this.canvas.width = w; this.canvas.height = h;
            this.content = content; this.presets = presets; this.loadOptions = o;
            this.time = U.clamp(this.time, 0, this.timeline.duration);
            if (this.audio && this.audio.stop) this.audio.stop();
            this.audio = o.audioFor ? await o.audioFor(this.timeline) : null;
            this.render();
            this.emit('load', this.timeline);
            return this.timeline;
        }
        get duration() { return this.timeline ? this.timeline.duration : 0; }
        get fps() { return this.timeline ? this.timeline.frame.fps : SAFE.fps; }
        get frame() { return Math.round(this.time * this.fps); }
        render() {
            if (!this.timeline) return;
            renderFrame(this.timeline, this.time, this.ctx, this.opts.render || {});
            if (this.audio && this.audio.tick) this.audio.tick(this.time, this.playing);
            const si = this.sceneIndexAt(this.time);
            if (si !== this._scene) { this._scene = si; this.emit('scene', si); }
            this.emit('time', this.time);
        }
        sceneIndexAt(t) {
            const sc = this.timeline ? this.timeline.scenes : [];
            for (let i = sc.length - 1; i >= 0; i--) if (t >= sc[i].start) return i;
            return 0;
        }
        play() {
            if (!this.timeline || this.playing) return;
            if (this.time >= this.duration - 1e-3) this.time = 0;
            this.playing = true; this._last = performance.now();
            if (this.audio) this.audio.play(this.time, this.speed);
            const tick = now => {
                if (!this.playing) return;
                const dt = Math.min(0.1, (now - this._last) / 1000);
                this._last = now;
                // the narration clock is the master when a voice-over is attached (no drift)
                const clock = this.audio && this.audio.clock ? this.audio.clock() : null;
                this.time = clock != null ? clock : this.time + dt * this.speed;
                if (this.time >= this.duration) {
                    if (this.loop) { this.time = this.time % Math.max(1e-3, this.duration); if (this.audio) this.audio.play(this.time, this.speed); }
                    else { this.time = this.duration; this.render(); this.pause(); this.emit('ended'); return; }
                }
                this.render();
                this._raf = requestAnimationFrame(tick);
            };
            this._raf = requestAnimationFrame(tick);
            this.emit('play');
        }
        pause() { this.playing = false; if (this._raf) cancelAnimationFrame(this._raf); if (this.audio) this.audio.pause(); this.emit('pause'); }
        toggle() { this.playing ? this.pause() : this.play(); }
        seek(t) { this.time = U.clamp(t, 0, this.duration); if (this.audio && this.playing) this.audio.play(this.time, this.speed); this.render(); }
        seekFrame(f) { this.seek(f / this.fps); }
        step(n) { this.pause(); this.seekFrame(this.frame + (n || 1)); }
        seekScene(i) { const s = this.timeline && this.timeline.scenes[i]; if (s) this.seek(s.start + 1e-3); }
        setSpeed(x) { this.speed = U.num(+x, 1); if (this.audio && this.playing) this.audio.play(this.time, this.speed); }
        setLoop(b) { this.loop = !!b; }
        /** Markers for a scrubber UI: scenes, beats and shots. */
        markers() {
            if (!this.timeline) return [];
            const out = [];
            this.timeline.scenes.forEach(s => {
                out.push({ kind: 'scene', t: s.start, label: s.title, index: s.index, transition: s.transitionName });
                s.shots.forEach(sh => out.push({ kind: 'shot', t: s.start + sh.start, label: sh.moveName, scene: s.index }));
            });
            return out;
        }
    }

    /* ════════════════════════════════════════════════════════════════════
     * 19. FRAME-ACCURATE EXPORT
     *   • PNG sequence (.zip, After Effects / Premiere image-sequence ready)
     *   • MP4 / WebM via WebCodecs + muxer (exact timestamps, faster than RT)
     *   • WebM via MediaRecorder (fallback; one requestFrame per frame)
     * ════════════════════════════════════════════════════════════════════ */
    const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
    function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

    /** Minimal STORE-only zip writer (PNGs are already compressed). */
    function makeZip(files) {
        const enc = new TextEncoder();
        const chunks = [], central = [];
        let offset = 0;
        files.forEach(f => {
            const name = enc.encode(f.name), data = f.data, crc = crc32(data);
            const lh = new DataView(new ArrayBuffer(30));
            lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0, true); lh.setUint16(8, 0, true);
            lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true);
            lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
            chunks.push(new Uint8Array(lh.buffer), name, data);
            const ch = new DataView(new ArrayBuffer(46));
            ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0, true); ch.setUint16(10, 0, true);
            ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
            ch.setUint16(28, name.length, true); ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true);
            ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
            central.push(new Uint8Array(ch.buffer), name);
            offset += 30 + name.length + data.length;
        });
        const cdSize = central.reduce((s, c) => s + c.length, 0);
        const end = new DataView(new ArrayBuffer(22));
        end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
        end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
        return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
    }

    function makeCanvas(w, h, opts) {
        if (opts && opts.createCanvas) return opts.createCanvas(w, h);
        const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
    }

    async function prepareExport(content, presets, o) {
        content = await runHooks(content, presets, o);
        const probeCtx = makeCanvas(8, 8, o).getContext('2d');
        const tl = compile(content, presets, Object.assign({}, o, { measureCtx: probeCtx }));
        await Promise.all([ensureFonts(tl, o), preloadAssets(tl, o)]);
        const canvas = makeCanvas(tl.frame.outW, tl.frame.outH, o);
        const tl2 = compile(content, presets, Object.assign({}, o, { measureCtx: canvas.getContext('2d') }));
        const fps = tl2.frame.fps;
        const from = Math.max(0, Math.floor(U.num(o.from, 0) * fps));
        const to = Math.min(Math.ceil(tl2.duration * fps), o.to != null ? Math.ceil(o.to * fps) : Infinity);
        // optional narration track: o.mixdown(timeline) → AudioBuffer (see voice.js)
        let audio = null;
        if (o.mixdown && o.includeAudio !== false) { try { audio = await o.mixdown(tl2); } catch (e) { Log.warn('mixdown', 'Voice-over mixdown failed: ' + e.message); } }
        return { tl: tl2, canvas, ctx: canvas.getContext('2d'), fps, from, to, audio };
    }

    /** Slice [from,to) seconds of an AudioBuffer into interleaved-free planar Float32 frames. */
    function audioSlice(buf, t0, t1) {
        const sr = buf.sampleRate, a = Math.max(0, Math.floor(t0 * sr)), b = Math.min(buf.length, Math.ceil(t1 * sr));
        const ch = Math.min(2, buf.numberOfChannels);
        const out = [];
        for (let c = 0; c < ch; c++) out.push(buf.getChannelData(c).subarray(a, Math.max(a, b)));
        return { channels: out, sampleRate: sr, frames: Math.max(0, b - a) };
    }
    /** 16-bit PCM WAV (for PNG-sequence exports and editors). */
    function encodeWav(buf, t0, t1) {
        const sl = audioSlice(buf, t0 || 0, t1 == null ? buf.duration : t1);
        const ch = sl.channels.length, n = sl.frames, sr = sl.sampleRate;
        const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
        const wr = (o, str) => { for (let i = 0; i < str.length; i++) out.setUint8(o + i, str.charCodeAt(i)); };
        wr(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); wr(8, 'WAVE'); wr(12, 'fmt ');
        out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, sr, true);
        out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true); wr(36, 'data'); out.setUint32(40, n * ch * 2, true);
        let o2 = 44;
        for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, sl.channels[c][i])); out.setInt16(o2, v < 0 ? v * 0x8000 : v * 0x7FFF, true); o2 += 2; }
        return new Uint8Array(out.buffer);
    }

    const Export = {
        /** Render a single PNG frame (Blob). */
        async frame(content, presets, o) {
            o = o || {};
            const X = await prepareExport(content, presets, o);
            renderFrame(X.tl, U.num(o.time, 0), X.ctx, { buffers: {} });
            return new Promise(res => X.canvas.toBlob(res, 'image/png'));
        },
        /** PNG image sequence zipped: frame_00000.png … */
        async pngSequence(content, presets, o) {
            o = o || {};
            const X = await prepareExport(content, presets, o);
            const files = [];
            const pad = String(X.to).length > 5 ? String(X.to).length : 5;
            const buffers = {};
            for (let f = X.from; f < X.to; f++) {
                if (o.signal && o.signal.aborted) throw new Error('Export cancelled');
                renderFrame(X.tl, f / X.fps, X.ctx, { buffers });
                const blob = await new Promise(res => X.canvas.toBlob(res, 'image/png'));
                files.push({ name: `${o.prefix || 'frame_'}${String(f).padStart(pad, '0')}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
                if (o.onProgress) o.onProgress((f - X.from + 1) / (X.to - X.from), f);
            }
            if (X.audio) files.push({ name: 'voiceover.wav', data: encodeWav(X.audio, X.from / X.fps, X.to / X.fps) });
            return makeZip(files);
        },
        /** WebCodecs path. muxer: window.Mp4Muxer (mp4) or window.WebMMuxer (webm). */
        async encoded(content, presets, o) {
            o = o || {};
            if (typeof VideoEncoder === 'undefined') throw new Error('WebCodecs VideoEncoder is not available in this browser.');
            const format = o.format === 'webm' ? 'webm' : 'mp4';
            const lib = format === 'mp4' ? (typeof Mp4Muxer !== 'undefined' ? Mp4Muxer : null) : (typeof WebMMuxer !== 'undefined' ? WebMMuxer : null);
            if (!lib) throw new Error(`Muxer library for ${format} is not loaded.`);
            const X = await prepareExport(content, presets, o);
            const W = X.tl.frame.outW - (X.tl.frame.outW % 2), H = X.tl.frame.outH - (X.tl.frame.outH % 2);
            const target = new lib.ArrayBufferTarget();
            // Probe codec strings until the browser accepts one (H.264 needs Chrome/Edge with proprietary codecs).
            const candidates = o.codec ? [o.codec] : format === 'mp4' ? ['avc1.640033', 'avc1.4d0033', 'avc1.42003e', 'avc1.42001f'] : ['vp09.00.10.08', 'vp8'];
            let codec = null;
            for (const c of candidates) {
                try { const sup = await VideoEncoder.isConfigSupported({ codec: c, width: W, height: H, bitrate: U.num(o.bitrate, 12e6), framerate: X.fps }); if (sup.supported) { codec = c; break; } } catch (e) { /* try next */ }
            }
            if (!codec) throw new Error(format === 'mp4' ? 'This browser has no H.264 encoder (common in Chromium/Linux builds). Choose WebM or the PNG sequence.' : 'This browser cannot encode VP9/VP8.');
            // narration: AAC in MP4, Opus in WebM (skipped with a warning if the browser cannot encode it)
            let aCodec = null, aCfg = null;
            if (X.audio && typeof AudioEncoder !== 'undefined') {
                aCfg = { codec: format === 'mp4' ? 'mp4a.40.2' : 'opus', sampleRate: X.audio.sampleRate, numberOfChannels: Math.min(2, X.audio.numberOfChannels), bitrate: 160000 };
                try { if ((await AudioEncoder.isConfigSupported(aCfg)).supported) aCodec = format === 'mp4' ? 'aac' : 'A_OPUS'; } catch (e) { /* unsupported */ }
                if (!aCodec && format === 'mp4') Log.warn('aac', 'This browser cannot encode AAC audio — the MP4 is silent. Use WebM or the PNG sequence (includes voiceover.wav).');
            }
            const audioOpt = aCodec ? { codec: aCodec, sampleRate: aCfg.sampleRate, numberOfChannels: aCfg.numberOfChannels } : undefined;
            const muxer = new lib.Muxer(format === 'mp4'
                ? { target, video: { codec: 'avc', width: W, height: H, frameRate: X.fps }, audio: audioOpt, fastStart: 'in-memory' }
                : { target, video: { codec: codec === 'vp8' ? 'V_VP8' : 'V_VP9', width: W, height: H, frameRate: X.fps }, audio: audioOpt });
            let failure = null;
            const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: e => { failure = e; } });
            enc.configure({ codec, width: W, height: H, bitrate: U.num(o.bitrate, 12e6), framerate: X.fps });
            const buffers = {};
            for (let f = X.from; f < X.to; f++) {
                if (failure) throw failure;
                if (o.signal && o.signal.aborted) throw new Error('Export cancelled');
                renderFrame(X.tl, f / X.fps, X.ctx, { buffers });
                const vf = new VideoFrame(X.canvas, { timestamp: Math.round(((f - X.from) * 1e6) / X.fps), duration: Math.round(1e6 / X.fps) });
                enc.encode(vf, { keyFrame: (f - X.from) % (X.fps * 2) === 0 });
                vf.close();
                if (enc.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 0));
                if (o.onProgress) o.onProgress((f - X.from + 1) / (X.to - X.from), f);
            }
            await enc.flush();
            if (aCodec) {
                const aenc = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: e => { failure = e; } });
                aenc.configure(aCfg);
                const sl = audioSlice(X.audio, X.from / X.fps, X.to / X.fps);
                const step = 4096;
                for (let i = 0; i < sl.frames; i += step) {
                    const n = Math.min(step, sl.frames - i);
                    const data = new Float32Array(n * sl.channels.length);
                    sl.channels.forEach((c, ci) => data.set(c.subarray(i, i + n), ci * n));
                    const ad = new AudioData({ format: 'f32-planar', sampleRate: sl.sampleRate, numberOfFrames: n, numberOfChannels: sl.channels.length, timestamp: Math.round(i / sl.sampleRate * 1e6), data });
                    aenc.encode(ad); ad.close();
                }
                await aenc.flush();
                if (failure) throw failure;
            }
            muxer.finalize();
            return new Blob([target.buffer], { type: format === 'mp4' ? 'video/mp4' : 'video/webm' });
        },
        /** MediaRecorder fallback: frame-stepped capture stream (real-time pacing). */
        async recorded(content, presets, o) {
            o = o || {};
            const X = await prepareExport(content, presets, o);
            const stream = X.canvas.captureStream(0);
            const track = stream.getVideoTracks()[0];
            let actx = null, src = null;
            if (X.audio) {
                actx = new AudioContext({ sampleRate: X.audio.sampleRate });
                const dest = actx.createMediaStreamDestination();
                src = actx.createBufferSource(); src.buffer = X.audio; src.connect(dest);
                dest.stream.getAudioTracks().forEach(tr => stream.addTrack(tr));
            }
            const mimeCandidates = [
                'video/mp4;codecs=avc1',
                'video/mp4',
                'video/webm;codecs=vp9',
                'video/webm;codecs=vp8',
                'video/webm'
            ];
            const mime = mimeCandidates.find(m => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m));
            const recOpts = { videoBitsPerSecond: U.num(o.bitrate, 12e6) };
            if (mime) recOpts.mimeType = mime;
            const rec = new MediaRecorder(stream, recOpts);
            const parts = [];
            rec.ondataavailable = e => e.data.size && parts.push(e.data);
            const done = new Promise(r => { rec.onstop = r; });
            rec.start();
            if (src) src.start(0, X.from / X.fps);
            const buffers = {};
            const frameMs = 1000 / X.fps;
            let next = performance.now();
            for (let f = X.from; f < X.to; f++) {
                if (o.signal && o.signal.aborted) break;
                renderFrame(X.tl, f / X.fps, X.ctx, { buffers });
                if (track.requestFrame) track.requestFrame();
                next += frameMs;
                await new Promise(r => setTimeout(r, Math.max(0, next - performance.now())));
                if (o.onProgress) o.onProgress((f - X.from + 1) / (X.to - X.from), f);
            }
            rec.stop();
            await done;
            if (actx) actx.close();
            const outType = (mime && mime.includes('mp4')) ? 'video/mp4' : 'video/webm';
            return new Blob(parts, { type: outType });
        }
    };

    /* ════════════════════════════════════════════════════════════════════
     * 20. PUBLIC API
     * ════════════════════════════════════════════════════════════════════ */
    return {
        VERSION,
        compile, renderFrame, ensureFonts, Player, Export, PresetLib, registerBlock, preloadAssets,
        /** New drawing primitives for JSON presets: supplements.kind / transitions.type / backgrounds.layers[].type */
        registerSupplement: (kind, fn) => { SUPP_DRAW[kind] = fn; return fn; },
        registerTransition: (type, fn) => { TRANSITIONS[type] = fn; return fn; },
        registerBackgroundLayer: (type, fn) => { BG_DRAW[type] = fn; return fn; }, encodeWav, mergePresets, validatePresets,
        plainText, parseNumberWord, clusters, isComplexScript, hasEmoji, blocks: BLOCKS,
        api: { bgPoint, U, rng, noise1, Color, resolveColor, fontFor, layerAffine, layerMatrix, planeAffine, setT, setFilter, IDENTITY, accumulate,
            tornRectPath, pathFromPts, strokePartial, roughLine, quadPts, endOf, arrowHead, drawHandText, paperShadow, numberFormat, staggerDelay, Log },
        normalizeContent: (input, presets, o) => normalizeContent(input, presets instanceof PresetLib ? presets : new PresetLib(presets), o),
        detectFormat,
        parseMarkup: (text, presets) => parseMarkup(text, presets instanceof PresetLib ? presets : new PresetLib(presets)),
        cameraAt, Log, Color,
        internals: { U, rng, cubicBezier, springEase, evalTrack, staggerDelay, fragment, layoutShot, makeZip, TRANSITIONS, SUPP_DRAW, BG_DRAW }
    };
});
