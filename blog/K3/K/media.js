/*!
 * KineticMedia — images, emoji stickers and animated SVG vector graphics for KineticEngine
 * ----------------------------------------------------------------------------------------
 * Asset library sources (all optional, combine freely):
 *   • kinetic/assets/ folder  + assets.manifest.js (built by `node build-wrappers.js`)
 *   • drag & drop / file picker in Kinetic Studio            → KineticMedia.addFiles(files)
 *   • content JSON:  "assets": [{ "name":"volcano", "src":"data:…" | "assets/volcano.jpg", "keywords":["lava"] }]
 * Content usage
 *   inline  "[volcano](img)"  "[heart](svg:heart-diagram)"  "[rocket](img:🚀)"
 *   visual  { "type":"media", "asset":"heart-diagram", "frame":"polaroid", "label":"Human heart",
 *             "svg": { "mode":"auto", "animate":[{ "select":"#valve", "loop":"pulse" }] } }
 * Missing assets render as a labelled placeholder so a teacher knows exactly what to drop in.
 */
(function (root) {
    'use strict';
    const E = root.KineticEngine;
    if (!E) { console.error('[KineticMedia] load engine.js first'); return; }
    const A = E.api, U = A.U;

    const ASSETS = new Map();          // name → asset
    const MISSING = new Map();         // query → { query, count }
    const listeners = [];
    let BASE = '';
    const norm = s => String(s || '').toLowerCase().normalize('NFKC').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim();
    const emit = () => listeners.forEach(fn => { try { fn(); } catch (e) { /* ui */ } });

    /* ─── asset registry ─── */
    function keywordsOf(a) {
        const kws = new Set([norm(a.name)]);
        norm(a.name).split(' ').forEach(k => k.length > 2 && kws.add(k));
        U.asArray(a.keywords).forEach(k => kws.add(norm(k)));
        return kws;
    }
    function typeOf(src, hint) {
        if (hint) return hint;
        if (/^data:image\/svg|\.svg(\?|$)|^\s*<svg/i.test(src)) return 'svg';
        if (/^data:audio|\.(mp3|wav|ogg|m4a|aac)(\?|$)/i.test(src)) return 'audio';
        return 'image';
    }
    /** Register an asset. a = { name, src | svg (text) | file, keywords, type } → Promise<asset> */
    async function add(a) {
        if (!a) return null;
        const asset = Object.assign({ keywords: [] }, a);
        if (a.file) {
            asset.name = asset.name || a.file.name.replace(/\.[^.]+$/, '');
            asset.type = typeOf(a.file.name, a.type);
            asset.src = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(a.file); });
            if (asset.type === 'svg') asset.svgText = await a.file.text();
            delete asset.file;
        }
        if (a.svg && !asset.svgText) asset.svgText = a.svg;
        asset.type = asset.type || (asset.svgText ? 'svg' : typeOf(asset.src || ''));
        asset.name = asset.name || ('asset-' + ASSETS.size);
        asset._kw = keywordsOf(asset);
        ASSETS.set(asset.name, asset);
        await load(asset);
        MISSING.forEach((m, q) => { if (match(q)) MISSING.delete(q); });
        emit();
        return asset;
    }
    async function addFiles(files) {
        const out = [];
        for (const f of Array.from(files || [])) out.push(await add({ file: f }));
        return out.filter(Boolean);
    }
    function remove(name) { ASSETS.delete(name); emit(); }

    async function load(asset) {
        if (asset._loaded) return asset;
        try {
            if (asset.type === 'svg') {
                if (!asset.svgText && asset.src) {
                    if (/^data:image\/svg\+xml;base64,/.test(asset.src)) asset.svgText = atob(asset.src.split(',')[1]);
                    else if (/^data:image\/svg\+xml/.test(asset.src)) asset.svgText = decodeURIComponent(asset.src.split(',')[1]);
                    else { try { const r = await fetch(resolveSrc(asset.src)); if (r.ok) asset.svgText = await r.text(); } catch (e) { /* file:// */ } }
                }
                if (asset.svgText && typeof document !== 'undefined') asset.model = parseSVG(asset.svgText);
                if (!asset.model && asset.src) asset.img = await loadImage(resolveSrc(asset.src)); // animate as a whole picture
            } else if (asset.type === 'image') {
                asset.img = await loadImage(resolveSrc(asset.src));
            } else if (asset.type === 'audio') {
                asset.url = resolveSrc(asset.src);
            }
            asset._loaded = true;
        } catch (e) {
            asset.error = e.message || String(e);
            E.Log.warn('asset:' + asset.name, `Asset "${asset.name}" could not be loaded (${asset.error}).`);
        }
        return asset;
    }
    function resolveSrc(src) { return /^(data:|blob:|https?:|\/)/.test(src) ? src : BASE + src; }
    function loadImage(src) {
        return new Promise((res, rej) => {
            const img = new Image();
            if (/^https?:/.test(src)) img.crossOrigin = 'anonymous'; // untainted canvas → export keeps working
            img.onload = () => res(img);
            img.onerror = () => rej(new Error('image failed: ' + String(src).slice(0, 80)));
            img.src = src;
        });
    }

    /** Best asset for a word/phrase: exact name → keyword → singular/plural → partial. */
    function match(query, minScore) {
        const q = norm(query);
        if (!q) return null;
        if (ASSETS.has(query)) return ASSETS.get(query);
        const words = q.split(' ');
        const variants = new Set([q, q.replace(/(es|s)$/, ''), q + 's']);
        let best = null, score = 0;
        ASSETS.forEach(a => {
            let s = 0;
            variants.forEach(v => { if (a._kw.has(v)) s = Math.max(s, 3); });
            words.forEach(wd => { if (wd.length > 2 && a._kw.has(wd)) s = Math.max(s, 2); if (wd.length > 3 && a._kw.has(wd.replace(/(es|s)$/, ''))) s = Math.max(s, 2); });
            if (!s) a._kw.forEach(k => { if (k.length > 3 && (q.includes(k) || k.includes(q))) s = Math.max(s, 1); });
            if (s > score) { score = s; best = a; }
        });
        return score >= (minScore || 1) ? best : null;
    }

    /** Ingest content.assets + window.KineticAssets (assets.manifest.js). Use as a beforeCompile hook. */
    async function ingest(content) {
        MISSING.clear();
        const list = [].concat(root.KineticAssets || [], (content && content.assets) || []);
        for (const a of list) if (a && a.name && !ASSETS.has(a.name)) await add(a);
        return content;
    }
    /** Embed every loaded asset as data URLs so a content JSON is fully portable. */
    function exportEmbedded(names) {
        const out = [];
        ASSETS.forEach(a => {
            if (names && !names.includes(a.name)) return;
            if (a.type === 'audio' && !/^data:/.test(a.src || '')) return;
            out.push({ name: a.name, type: a.type, keywords: Array.from(a._kw).filter(k => k !== norm(a.name)), src: a.svgText ? 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(a.svgText))) : a.src });
        });
        return out;
    }

    /* ─── SVG → animatable parts (paths, shapes, text) with computed styles ─── */
    const GEOM = 'path,rect,circle,ellipse,line,polyline,polygon,text';
    function sanitize(text) {
        return String(text).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '').replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '');
    }
    function shapeToD(el) {
        const g = n => parseFloat(el.getAttribute(n)) || 0;
        switch (el.tagName.toLowerCase()) {
            case 'path': return el.getAttribute('d') || '';
            case 'rect': { const x = g('x'), y = g('y'), w = g('width'), h = g('height'); let rx = g('rx') || g('ry'), ry = g('ry') || rx; rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
                return rx ? `M${x + rx},${y}H${x + w - rx}A${rx},${ry} 0 0 1 ${x + w},${y + ry}V${y + h - ry}A${rx},${ry} 0 0 1 ${x + w - rx},${y + h}H${x + rx}A${rx},${ry} 0 0 1 ${x},${y + h - ry}V${y + ry}A${rx},${ry} 0 0 1 ${x + rx},${y}Z` : `M${x},${y}H${x + w}V${y + h}H${x}Z`; }
            case 'circle': { const cx = g('cx'), cy = g('cy'), r = g('r'); return `M${cx - r},${cy}A${r},${r} 0 1 0 ${cx + r},${cy}A${r},${r} 0 1 0 ${cx - r},${cy}Z`; }
            case 'ellipse': { const cx = g('cx'), cy = g('cy'), rx = g('rx'), ry = g('ry'); return `M${cx - rx},${cy}A${rx},${ry} 0 1 0 ${cx + rx},${cy}A${rx},${ry} 0 1 0 ${cx - rx},${cy}Z`; }
            case 'line': return `M${g('x1')},${g('y1')}L${g('x2')},${g('y2')}`;
            case 'polyline': case 'polygon': { const pts = (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number); let d = ''; for (let i = 0; i + 1 < pts.length; i += 2) d += (i ? 'L' : 'M') + pts[i] + ',' + pts[i + 1]; return d + (el.tagName.toLowerCase() === 'polygon' ? 'Z' : ''); }
            default: return '';
        }
    }
    function paintOf(v, svg) {
        if (!v || v === 'none') return null;
        const m = String(v).match(/url\(["']?#([^"')]+)["']?\)/);
        if (m) {
            const grad = svg.querySelector('#' + CSS.escape(m[1]));
            const stop = grad && grad.querySelector('stop');
            return stop ? (getComputedStyle(stop).stopColor || stop.getAttribute('stop-color') || '#888') : '#888';
        }
        return v;
    }
    function parseSVG(text) {
        const holder = document.createElement('div');
        holder.style.cssText = 'position:absolute;left:-100000px;top:0;width:10px;height:10px;overflow:hidden;visibility:hidden';
        holder.innerHTML = sanitize(text);
        document.body.appendChild(holder);
        try {
            const svg = holder.querySelector('svg');
            if (!svg) return null;
            let vb = svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width ? svg.viewBox.baseVal : null;
            const aw = parseFloat(svg.getAttribute('width')) || 0, ah = parseFloat(svg.getAttribute('height')) || 0;
            if (!vb) { const bb = svg.getBBox(); vb = { x: 0, y: 0, width: aw || bb.x + bb.width || 100, height: ah || bb.y + bb.height || 100 }; }
            svg.setAttribute('width', vb.width); svg.setAttribute('height', vb.height);
            svg.style.visibility = 'visible';
            const parts = [];
            svg.querySelectorAll(GEOM).forEach(el => {
                if (el.closest('defs,clipPath,mask,symbol,pattern,marker')) return;
                const cs = getComputedStyle(el);
                if (cs.display === 'none' || cs.visibility === 'hidden') return;
                const m = el.getCTM();
                if (!m) return;
                const tag = el.tagName.toLowerCase();
                const sel = [tag];
                for (let n = el; n && n !== svg; n = n.parentElement) {
                    if (n.id) sel.push('#' + n.id);
                    (n.getAttribute('class') || '').split(/\s+/).filter(Boolean).forEach(c => sel.push('.' + c));
                    if (n !== el && n.tagName) sel.push('>' + n.tagName.toLowerCase());
                }
                let bb = null;
                try { const b = el.getBBox(); bb = [b.x, b.y, b.width, b.height]; } catch (e) { bb = [0, 0, 0, 0]; }
                const cx = bb[0] + bb[2] / 2, cy = bb[1] + bb[3] / 2;
                const part = {
                    tag, sel, m: [m.a, m.b, m.c, m.d, m.e, m.f],
                    center: [m.a * cx + m.c * cy + m.e, m.b * cx + m.d * cy + m.f], bbox: bb,
                    area: Math.abs(bb[2] * bb[3] * (m.a * m.d - m.b * m.c)),
                    fill: paintOf(cs.fill, svg), stroke: paintOf(cs.stroke, svg), sw: parseFloat(cs.strokeWidth) || 1,
                    opacity: (parseFloat(cs.opacity) || 1), fillOpacity: parseFloat(cs.fillOpacity), strokeOpacity: parseFloat(cs.strokeOpacity),
                    cap: cs.strokeLinecap, join: cs.strokeLinejoin, fillRule: cs.fillRule === 'evenodd' ? 'evenodd' : 'nonzero'
                };
                if (isNaN(part.fillOpacity)) part.fillOpacity = 1;
                if (isNaN(part.strokeOpacity)) part.strokeOpacity = 1;
                if (tag === 'text') {
                    part.text = el.textContent;
                    part.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
                    part.x = parseFloat(el.getAttribute('x')) || 0; part.y = parseFloat(el.getAttribute('y')) || 0;
                    part.anchor = cs.textAnchor === 'middle' ? 'center' : cs.textAnchor === 'end' ? 'right' : 'left';
                    part.len = 0;
                } else {
                    part.d = shapeToD(el);
                    try { part.len = el.getTotalLength ? el.getTotalLength() : 0; } catch (e) { part.len = 0; }
                }
                if (part.d || part.text) parts.push(part);
            });
            const model = { w: vb.width, h: vb.height, ox: vb.x || 0, oy: vb.y || 0, parts };
            model.auto = autoMode(model);
            return model;
        } finally {
            holder.remove();
        }
    }
    /** Smart default: line art draws on, flat illustrations "sketch then colour", few big shapes pop. */
    function autoMode(model) {
        const P = model.parts;
        const stroked = P.filter(p => p.stroke).length, filled = P.filter(p => p.fill).length;
        if (P.length >= 3 && stroked >= Math.max(1, filled * 0.6)) return 'draw';
        if (P.length >= 5) return 'strokeThenFill';
        return 'pop';
    }
    function selMatch(part, selector) {
        return String(selector).split(',').map(s => s.trim()).filter(Boolean).some(s => (s[0] === '#' || s[0] === '.') ? part.sel.includes(s) : part.sel.includes(s.toLowerCase()) || part.sel.includes('>' + s.toLowerCase()));
    }
    function orderParts(model, how, seed) {
        const idx = model.parts.map((p, i) => i);
        const c = [model.ox + model.w / 2, model.oy + model.h / 2];
        const key = {
            'top-down': i => model.parts[i].center[1],
            'left-right': i => model.parts[i].center[0],
            'center-out': i => Math.hypot(model.parts[i].center[0] - c[0], model.parts[i].center[1] - c[1]),
            'size': i => -model.parts[i].area,
            'random': i => A.rng(seed + i)()
        }[how];
        if (key) idx.sort((a, b) => key(a) - key(b));
        const rank = new Array(idx.length);
        idx.forEach((pi, r) => { rank[pi] = r; });
        return rank;
    }

    /* ─── block ─── */
    function cfg(lib) { return (lib && lib.json && lib.json.media) || {}; }
    function lookup(spec) {
        const key = spec.asset || spec.src || spec.query;
        if (!key) return null;
        return ASSETS.get(key) || match(key) || null;
    }
    const def = {
        tags: ['img', 'image', 'photo', 'pic', 'picture', 'media', 'svg', 'vector', 'diagram'],
        framingScale: 0.5,
        captionDelay: 0.45,
        exitDuration: 0.5,
        fromTag(tag, text) {
            const arg = tag.args[0];
            const spec = { type: 'media', query: arg || text };
            if (tag.name === 'svg' || tag.name === 'vector' || tag.name === 'diagram') spec.frame = 'none';
            if (tag.args[1]) spec.frame = tag.args[1];
            return spec;
        },
        size(spec, ctx) {
            const c = cfg(ctx.lib);
            const asset = lookup(spec);
            let aspect = 4 / 3;
            if (E.hasEmoji(spec.query || '')) aspect = 1;
            else if (asset && asset.model) aspect = asset.model.w / Math.max(1, asset.model.h);
            else if (asset && asset.img) aspect = asset.img.naturalWidth / Math.max(1, asset.img.naturalHeight);
            const frac = U.num(spec.width, asset && asset.model ? U.num(c.svgWidth, 0.6) : U.num(c.imageWidth, 0.52));
            let w = ctx.frame.width * frac, h = w / aspect;
            const maxH = ctx.frame.height * U.num(c.maxHeight, 0.62);
            if (h > maxH) { h = maxH; w = h * aspect; }
            return { w, h };
        },
        duration(spec, ctx) {
            const c = cfg(ctx.lib);
            const asset = lookup(spec);
            if (asset && asset.model) {
                const pre = svgPreset(spec, asset.model, ctx.lib);
                const n = asset.model.parts.length;
                return U.clamp(U.num(spec.duration, (n - 1) * U.num(pre.each, 0.08) + U.num(pre.duration, 0.8) + U.num(pre.fillDuration, 0.6) + U.num(c.hold, 1.4)), 1.5, U.num(c.maxSvgDuration, 7));
            }
            return U.num(spec.duration, U.num(c.imageDuration, 3));
        },
        async preload(spec) {
            if (spec.src && !ASSETS.has(spec.src)) await add({ name: spec.asset || spec.src, src: spec.src });
            if (lookup(spec)) return true;
            // convention: kinetic/assets/<query>.(svg|png|jpg|webp|gif)
            const q = spec.asset || spec.query;
            if (q && !E.hasEmoji(q)) {
                const base = norm(q).replace(/\s+/g, '-');
                for (const ext of ['svg', 'png', 'jpg', 'jpeg', 'webp', 'gif']) {
                    const a = { name: q, src: 'assets/' + base + '.' + ext, keywords: [q] };
                    a.type = ext === 'svg' ? 'svg' : 'image';
                    try {
                        await loadImage(resolveSrc(a.src)); // probe (works from file:// too)
                        await add(a);
                        return true;
                    } catch (e) { /* try next */ }
                }
            }
            return false;
        },
        prepare(spec, ctx) {
            const asset = lookup(spec);
            const c = cfg(ctx.lib);
            const emoji = E.hasEmoji(spec.query || '') && !asset;
            const iconPath = !asset && !emoji && ctx.lib.icons[norm(spec.query || '').replace(/ /g, '')] ? ctx.lib.icons[norm(spec.query).replace(/ /g, '')] : null;
            if (!asset && !emoji && !iconPath) {
                const q = spec.asset || spec.query || 'image';
                MISSING.set(q, { query: q, label: spec.label || q });
                emit();
            }
            const out = { asset, emoji, iconPath, k: ctx.speed || 1, style: U.merge(c.frames && c.frames[spec.frame || (asset && asset.model ? 'none' : c.defaultFrame || 'polaroid')] || {}, U.isObj(spec.style) ? spec.style : {}), entry: (c.entries || {})[spec.entry || c.defaultEntry || 'drop'] || {} };
            out.frameName = spec.frame || (asset && asset.model ? 'none' : emoji || iconPath ? 'sticker' : c.defaultFrame || 'polaroid');
            if (asset && asset.model) {
                out.svg = svgPreset(spec, asset.model, ctx.lib);
                out.rank = orderParts(asset.model, out.svg.order || 'document', ctx.block.seed);
                out.rules = U.asArray(spec.svg && spec.svg.animate).map(r => Object.assign({}, r, { loopDef: r.loop ? (c.svgLoops || {})[r.loop] || { type: r.loop } : null }));
            }
            out.label = spec.label != null ? spec.label : '';
            out.kenBurns = spec.kenBurns != null ? spec.kenBurns : c.kenBurns !== false;
            return out;
        },
        draw(R, sp, block, t, out) { drawMedia(R, sp, block, t, out); }
    };

    function svgPreset(spec, model, lib) {
        const c = cfg(lib);
        const presets = c.svgPresets || {};
        let mode = (spec.svg && (spec.svg.preset || spec.svg.mode)) || 'auto';
        if (mode === 'auto') mode = model.auto;
        return Object.assign({ mode }, presets[mode] || {}, spec.svg || {}, { mode: (presets[mode] && presets[mode].mode) || mode });
    }

    function drawMedia(R, sp, block, t, out) {
        const M = block.prepared;
        const ctx = R.ctx, E2 = R.lib.eases, theme = R.theme;
        const col = c => A.resolveColor(theme, c);
        const w = block.w, h = block.h;
        const en = M.entry, k = M.k;
        const pe = U.clamp(t / (U.num(en.duration, 0.8) / k), 0, 1);
        const e = E2.get(en.ease || 'springy')(pe);
        const rest = (A.rng(block.seed)() - 0.5) * U.num(M.style.tilt, 5);
        const o = {
            x: block.cx + U.num(en.x, 0) * (1 - e) * w, y: block.cy + U.num(en.y, -0.6) * (1 - e) * h, z: -4 + U.num(en.z, 0) * (1 - e),
            rotX: U.num(en.rotX, 0) * (1 - e), rotY: U.num(en.rotY, 0) * (1 - e), rotZ: rest + U.num(en.rotZ, -12) * (1 - e),
            scale: U.lerp(U.num(en.scale, 1), 1, e) * U.lerp(0.85, 1, out)
        };
        const af = A.planeAffine(R, sp, o, Math.max(w, h) / 2);
        if (!af) return;
        ctx.globalAlpha *= U.clamp(pe * 3, 0, 1);
        const st = M.style;
        const pad = Math.min(w, h) * U.num(st.pad, 0.05), padB = Math.min(w, h) * U.num(st.padBottom, st.pad || 0.05);
        const fw = w + pad * 2, fh = h + pad + padB;
        // frame / card
        if (M.frameName !== 'none') {
            ctx.save();
            ctx.translate(-fw / 2, -h / 2 - pad);
            A.paperShadow(R, af, 12, true);
            ctx.fillStyle = col(st.color || '@paper');
            if (M.frameName === 'circle' || M.frameName === 'sticker') { ctx.beginPath(); ctx.ellipse(fw / 2, fh / 2, fw / 2, fh / 2, 0, 0, Math.PI * 2); ctx.fill(); }
            else { A.pathFromPts(ctx, A.tornRectPath(fw, fh, U.num(st.torn, 0.15), block.seed + 'frame'), true); ctx.fill(); }
            A.paperShadow(R, af, 0, false);
            ctx.restore();
        }
        // content
        ctx.save();
        const clipR = () => {
            ctx.beginPath();
            if (M.frameName === 'circle' || M.frameName === 'sticker') ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); else ctx.rect(-w / 2, -h / 2, w, h);
            ctx.clip();
        };
        if (M.asset && M.asset.model) {
            drawSVG(R, M, block, t, w, h);
        } else if (M.asset && M.asset.img) {
            clipR();
            const img = M.asset.img;
            const kb = M.kenBurns ? 1 + U.num(st.kenBurns, 0.1) * U.clamp(t / 8, 0, 1) : 1;
            const ar = img.naturalWidth / img.naturalHeight, br = w / h;
            let dw = w, dh = h;
            if ((st.fit || 'cover') === 'cover' ? ar > br : ar < br) { dh = h; dw = h * ar; } else { dw = w; dh = w / ar; }
            const R2 = A.rng(block.seed + 'kb');
            const px = (R2() - 0.5) * w * 0.06 * (kb - 1) * 10, py = (R2() - 0.5) * h * 0.06 * (kb - 1) * 10;
            ctx.drawImage(img, -dw * kb / 2 + px, -dh * kb / 2 + py, dw * kb, dh * kb);
        } else if (M.emoji) {
            ctx.font = `${Math.round(h * 0.72)}px ${(theme.typography && theme.typography.emojiFallback) || 'sans-serif'}`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            const bob = Math.sin(t * 2.2) * h * 0.02;
            ctx.fillText(block.spec.query, 0, bob + h * 0.04);
        } else if (M.iconPath && typeof Path2D !== 'undefined') {
            const s2 = Math.min(w, h) * 0.7 / 24;
            ctx.scale(s2, s2); ctx.translate(-12, -12);
            ctx.fillStyle = col('@accent');
            ctx.fill(new Path2D(M.iconPath), 'evenodd');
        } else {
            drawPlaceholder(R, block, w, h, col);
        }
        ctx.restore();
        // handwritten label (polaroid bottom strip or under the card)
        if (M.label) {
            const pl = E2.get('smoothOut')(U.clamp((t - 0.5 / k) / 0.5, 0, 1));
            ctx.save(); ctx.globalAlpha *= pl;
            const fs = Math.min(w, h) * U.num(st.labelSize, 0.085);
            const y = M.frameName === 'polaroid' ? h / 2 + padB / 2 : h / 2 + fs * 1.2;
            A.drawHandText(R, M.label, 0, y, fs, col(st.labelInk || '@ink'), 'hand');
            ctx.restore();
        }
        // washi tape corners
        if (st.tape) {
            ctx.save();
            ctx.globalAlpha *= 0.75 * U.clamp(pe * 2 - 0.5, 0, 1);
            ctx.fillStyle = col(st.tape);
            [[-fw / 2 + fw * 0.08, -h / 2 - pad, -35], [fw / 2 - fw * 0.08, -h / 2 - pad, 35]].forEach(([x, y, r]) => {
                ctx.save(); ctx.translate(x, y); ctx.rotate(U.deg(r)); ctx.fillRect(-fw * 0.09, -fh * 0.035, fw * 0.18, fh * 0.07); ctx.restore();
            });
            ctx.restore();
        }
    }

    function drawPlaceholder(R, block, w, h, col) {
        const ctx = R.ctx;
        ctx.fillStyle = col('@paper2'); ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.setLineDash([14, 10]); ctx.lineWidth = 3; ctx.strokeStyle = col('@accent');
        ctx.strokeRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20); ctx.setLineDash([]);
        // mountain + sun glyph
        const s = Math.min(w, h) * 0.22;
        ctx.save(); ctx.translate(0, -h * 0.08);
        ctx.fillStyle = col('@accent2'); ctx.globalAlpha *= 0.6;
        ctx.beginPath(); ctx.moveTo(-s, s * 0.5); ctx.lineTo(-s * 0.25, -s * 0.4); ctx.lineTo(s * 0.2, s * 0.15); ctx.lineTo(s * 0.5, -s * 0.15); ctx.lineTo(s, s * 0.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = col('@accent3'); ctx.beginPath(); ctx.arc(s * 0.55, -s * 0.55, s * 0.18, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        const q = block.spec.asset || block.spec.query || 'image';
        A.drawHandText(R, 'Drop image: ' + q, 0, h * 0.24, Math.min(w, h) * 0.075, col('@ink'), 'hand');
    }

    function drawSVG(R, M, block, t, w, h) {
        const ctx = R.ctx, E2 = R.lib.eases;
        const model = M.asset.model, pre = M.svg, k = M.k;
        const s = Math.min(w / model.w, h / model.h) * U.num(M.style.svgScale, 0.94);
        ctx.scale(s, s);
        ctx.translate(-model.ox - model.w / 2, -model.oy - model.h / 2);
        const each = U.num(pre.each, 0.08) / k, dur = U.num(pre.duration, 0.8) / k, fillDur = U.num(pre.fillDuration, 0.6) / k;
        const n = model.parts.length;
        const maxEach = n > 1 ? Math.min(each, U.num(pre.maxStagger, 3) / k / (n - 1)) : each;
        const ink = A.resolveColor(R.theme, pre.sketchColor || '@ink');
        model.parts.forEach((part, i) => {
            const rule = M.rules.find(r => r.select && selMatch(part, r.select));
            const mode = (rule && rule.preset) || pre.mode;
            const t0 = (rule && rule.delay != null ? rule.delay / k : M.rank[i] * maxEach);
            const pd = U.clamp((t - t0) / ((rule && rule.duration ? rule.duration / k : dur)), 0, 1);
            if (pd <= 0 && mode !== 'none') return;
            if (!part.path && part.d && typeof Path2D !== 'undefined') { try { part.path = new Path2D(part.d); } catch (e) { part.path = null; } }
            ctx.save();
            ctx.transform(...part.m);
            const cx = part.bbox[0] + part.bbox[2] / 2, cy = part.bbox[1] + part.bbox[3] / 2;
            let alpha = part.opacity, fillA = 1, drawP = 1, strokeFromFill = false;
            const e = E2.get(pre.ease || 'springy')(pd);
            switch (mode) {
                case 'draw': drawP = E2.get('handDrawn')(pd); fillA = U.clamp((t - t0 - dur * 0.6) / fillDur, 0, 1); break;
                case 'strokeThenFill': drawP = E2.get('handDrawn')(pd); strokeFromFill = true; fillA = U.clamp((t - t0 - dur) / fillDur, 0, 1); break;
                case 'pop': { const sc = Math.max(0.001, e); ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy); break; }
                case 'build': ctx.translate(0, (1 - e) * part.bbox[3] * 0.8 + (1 - e) * 30); alpha *= U.clamp(pd * 2, 0, 1); break;
                case 'assemble': { const R2 = A.rng(block.seed + i); const d = (1 - e); ctx.translate((R2() - 0.5) * model.w * d, (R2() - 0.5) * model.h * d); ctx.translate(cx, cy); ctx.rotate(U.deg((R2() - 0.5) * 180 * d)); ctx.translate(-cx, -cy); break; }
                case 'fade': alpha *= pd; break;
                default: break;
            }
            // continuous loops on selected parts (spin, pulse, float, wiggle, blink)
            if (rule && rule.loopDef && t > t0 + dur) {
                const lt = t - t0 - dur, L = rule.loopDef, sp2 = U.num(rule.speed, U.num(L.speed, 1));
                if (L.type === 'spin') { ctx.translate(cx, cy); ctx.rotate(U.deg(lt * 90 * sp2)); ctx.translate(-cx, -cy); }
                if (L.type === 'pulse') { const q = 1 + Math.sin(lt * Math.PI * 2 * sp2) * U.num(L.amount, 0.06); ctx.translate(cx, cy); ctx.scale(q, q); ctx.translate(-cx, -cy); }
                if (L.type === 'float') ctx.translate(0, Math.sin(lt * 2 * sp2) * U.num(L.amount, 4));
                if (L.type === 'wiggle') { ctx.translate(cx, cy); ctx.rotate(U.deg(Math.sin(lt * 9 * sp2) * U.num(L.amount, 4))); ctx.translate(-cx, -cy); }
                if (L.type === 'blink') alpha *= 0.55 + 0.45 * Math.abs(Math.cos(lt * Math.PI * sp2));
            }
            ctx.globalAlpha *= alpha;
            ctx.lineCap = part.cap || 'round'; ctx.lineJoin = part.join || 'round';
            if (part.text != null) {
                ctx.globalAlpha *= mode === 'draw' || mode === 'strokeThenFill' ? U.clamp(pd * 1.5, 0, 1) : 1;
                ctx.font = part.font; ctx.textAlign = part.anchor; ctx.fillStyle = part.fill || ink;
                ctx.fillText(part.text, part.x, part.y);
            } else if (part.path) {
                if (part.fill && fillA > 0) { ctx.save(); ctx.globalAlpha *= part.fillOpacity * fillA; ctx.fillStyle = part.fill; ctx.fill(part.path, part.fillRule); ctx.restore(); }
                const stroke = part.stroke || (strokeFromFill || mode === 'draw' ? (pre.sketchWithFill ? part.fill : ink) : null);
                const strokeFade = part.stroke ? 1 : (1 - fillA);
                if (stroke && drawP > 0 && strokeFade > 0.01) {
                    ctx.save();
                    ctx.globalAlpha *= (part.stroke ? part.strokeOpacity : 0.9) * strokeFade;
                    ctx.strokeStyle = stroke;
                    ctx.lineWidth = part.stroke ? part.sw : U.num(pre.sketchWidth, 2) / (s * Math.sqrt(Math.abs(part.m[0] * part.m[3] - part.m[1] * part.m[2])) || 1);
                    if (drawP < 1 && part.len > 0) { ctx.setLineDash([part.len * drawP, part.len + 1]); }
                    ctx.stroke(part.path);
                    ctx.restore();
                }
            }
            ctx.restore();
        });
    }

    E.registerBlock('media', def);

    root.KineticMedia = {
        add, addFiles, remove, match, ingest, exportEmbedded, parseSVG, load,
        get: name => ASSETS.get(name) || null,
        list: () => Array.from(ASSETS.values()),
        missing: () => Array.from(MISSING.values()),
        clearMissing: () => { MISSING.clear(); emit(); },
        onChange: fn => listeners.push(fn),
        setBase: b => { BASE = b; },
        hook: ingest
    };
})(typeof window !== 'undefined' ? window : globalThis);
