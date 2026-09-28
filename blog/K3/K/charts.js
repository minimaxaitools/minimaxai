/*!
 * KineticCharts — paper-craft infographic charts for KineticEngine
 * ----------------------------------------------------------------
 * Chart kinds: bar · column · donut · pie · progress · pictogram · stat · compare · line · timeline
 *   visual  { "type":"chart", "chart":"bar", "title":"Population", "data":[{ "label":"India", "value":1428, "emoji":"🇮🇳" }, …],
 *             "suffix":" M", "decimals":0 }
 *   inline  "[India 140 crore, China 141 crore, USA 33 crore](chart)"   → data parsed from the text
 *   auto    the Auto-Director turns sentences with 2+ label–value pairs into charts.
 * Numbers use the video locale (e.g. en-IN lakh/crore grouping) and optional native digits.
 */
(function (root) {
    'use strict';
    const E = root.KineticEngine;
    if (!E) { console.error('[KineticCharts] load engine.js first'); return; }
    const A = E.api, U = A.U;

    /* ─── text → data pairs ─── */
    const SCALE = {
        thousand: 1e3, k: 1e3, lakh: 1e5, lakhs: 1e5, lac: 1e5, million: 1e6, mn: 1e6, m: 1e6, crore: 1e7, crores: 1e7, cr: 1e7, billion: 1e9, bn: 1e9, b: 1e9, trillion: 1e12,
        'हज़ार': 1e3, 'हजार': 1e3, 'लाख': 1e5, 'करोड़': 1e7, 'करोड': 1e7, 'अरब': 1e9, 'मिलियन': 1e6, 'बिलियन': 1e9
    };
    const SEP = /^(,|;|and|or|while|whereas|but|vs\.?|versus|और|तथा|एवं|जबकि|लेकिन|व)$/i;
    const JOIN = /^(the|a|an|of|in|is|are|was|has|have|had|with|about|around|nearly|over|under|only|just|to|from|at|for|में|की|का|के|है|हैं|था|थे|लगभग|करीब|से|को|पर|ने)$/i;
    const clean = w => w.replace(/[(),;:!?"“”।॥]/g, '').replace(/\.$/, '');
    /**
     * parseDataPairs("India has 140 crore people, China 141 crore and USA 33 crore")
     *   → [{label:'India', value:1.4e9, display:'140 crore'}, …]
     */
    function parseDataPairs(text) {
        const raw = String(text || '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\*([^*]+)\*/g, '$1').split(/\s+/).filter(Boolean);
        const pairs = [];
        let lastEnd = 0;
        for (let i = 0; i < raw.length; i++) {
            const w = clean(raw[i]);
            const num = E.parseNumberWord(w);
            if (!num) continue;
            let value = num.value, display = w;
            const next = raw[i + 1] ? clean(raw[i + 1]).toLowerCase() : '';
            let j = i;
            if (SCALE[next] || SCALE[clean(raw[i + 1] || '')]) { value *= SCALE[next] || SCALE[clean(raw[i + 1])]; display += ' ' + clean(raw[i + 1]); j = i + 1; }
            else if (/^(\d+(\.\d+)?)(k|m|bn|cr)$/i.test(w)) { const m = w.match(/(k|m|bn|cr)$/i)[1].toLowerCase(); value = parseFloat(w) * SCALE[m]; }
            // label: words before the number back to the previous pair / separator
            const back = [];
            for (let b = i - 1; b >= lastEnd && back.length < 4; b--) {
                const bw = clean(raw[b]);
                if (SEP.test(bw) || /[,;।]$/.test(raw[b])) { if (back.length) break; else continue; }
                if (JOIN.test(bw) && back.length) break;
                if (!JOIN.test(bw) && bw) back.unshift(bw);
            }
            let label = back.slice(-3).join(' ');
            if (!label) { // label after the number: "87% students"
                const fwd = [];
                for (let f = j + 1; f < raw.length && fwd.length < 3; f++) { const fw = clean(raw[f]); if (SEP.test(fw) || E.parseNumberWord(fw)) break; if (!JOIN.test(fw)) fwd.push(fw); if (/[,;।.]$/.test(raw[f])) break; }
                label = fwd.join(' ');
            }
            pairs.push({ label: label || display, value, display, suffix: num.suffix, prefix: num.prefix, pct: /%/.test(w) });
            lastEnd = j + 1;
            i = j;
        }
        return pairs;
    }
    function pickKind(data) {
        const n = data.length;
        const allPct = data.every(d => d.pct || /%/.test(d.suffix || ''));
        const sum = data.reduce((s, d) => s + d.value, 0);
        if (data.every(d => /^(1[0-9]|20)\d\d$/.test(String(d.label)))) return 'line';
        if (allPct && sum > 90 && sum < 110 && n >= 2) return 'donut';
        if (allPct) return 'progress';
        if (n === 2) return 'compare';
        if (n >= 6) return 'column';
        return 'bar';
    }

    function cfg(lib) { return (lib && lib.json && lib.json.charts) || {}; }
    const def = {
        tags: ['chart', 'bars', 'donut', 'pie', 'stats', 'compare', 'timeline', 'progress', 'pictogram'],
        framingScale: 0.3,
        captionDelay: 0.4,
        exitDuration: 0.5,
        fromTag(tag, text, ctx) {
            let data = parseDataPairs(text);
            if (data.length < 2 && ctx && ctx.beatText) data = parseDataPairs(ctx.beatText);
            if (!data.length) { E.Log.warn('chart:nodata:' + text, `No numbers found for chart in "${text}".`); return null; }
            const kind = tag.name === 'chart' ? (tag.args[0] || pickKind(data)) : tag.name === 'bars' ? 'bar' : tag.name === 'stats' ? 'stat' : tag.name;
            return { type: 'chart', chart: kind, data: data.map(d => ({ label: d.label, value: d.value, display: d.display, pct: d.pct })), title: tag.args[1] ? tag.args[1] : '' };
        },
        size(spec, ctx) {
            const c = cfg(ctx.lib);
            const kind = spec.chart || 'bar';
            const w = ctx.frame.width * U.num(spec.width, U.num(c.width, 0.74));
            const aspect = U.num(spec.aspect, { stat: 2.6, compare: 1.7, progress: 1.9, timeline: 2.6, pictogram: 1.8 }[kind] || U.num(c.aspect, 1.65));
            return { w, h: w / aspect };
        },
        duration(spec, ctx) {
            const T = cfg(ctx.lib).timing || {};
            const n = U.asArray(spec.data).length;
            return U.num(spec.duration, U.num(T.intro, 0.6) + n * U.num(T.stagger, 0.22) + U.num(T.grow, 1.1) + U.num(T.hold, 1.8));
        },
        prepare(spec, ctx) {
            const c = cfg(ctx.lib);
            const data = U.asArray(spec.data).map((d, i) => (typeof d === 'number' ? { label: String(i + 1), value: d } : Object.assign({}, d, { value: +d.value || 0 })));
            if (spec.sort === 'desc') data.sort((a, b) => b.value - a.value);
            if (spec.sort === 'asc') data.sort((a, b) => a.value - b.value);
            const kind = spec.chart || pickKind(data);
            const meta = ctx.meta || {};
            const fmt = A.numberFormat({ locale: spec.locale || meta.locale || U.pick(ctx.theme, 'numbers.locale') || 'en-US', numerals: spec.numerals || meta.numerals, decimals: U.num(spec.decimals, data.some(d => d.value % 1) ? 1 : 0), grouping: true });
            return {
                data, kind, fmt, title: spec.title || '', prefix: spec.prefix || '', suffix: spec.suffix != null ? spec.suffix : (data.every(d => d.pct) ? '%' : ''),
                max: U.num(spec.max, Math.max(...data.map(d => d.value), 1)), unit: spec.unit, style: U.merge(c.style || {}, U.isObj(spec.style) ? spec.style : {}),
                timing: c.timing || {}, k: ctx.speed || 1, highlightMax: spec.highlightMax !== false
            };
        },
        draw(R, sp, block, t, out) { drawChart(R, sp, block, t, out); }
    };

    function colorFor(R, d, i, C) {
        if (d.color) return A.resolveColor(R.theme, d.color);
        const pal = U.asArray(C.style.colors).length ? C.style.colors : ['@accent', '@accent2', '@accent3', '@strip[1]', '@strip[2]', '@strip[3]'];
        return A.resolveColor(R.theme, pal[i % pal.length]);
    }

    function drawChart(R, sp, block, t, out) {
        const C = block.prepared, ctx = R.ctx, E2 = R.lib.eases, theme = R.theme;
        const col = c => A.resolveColor(theme, c);
        const w = block.w, h = block.h, k = C.k, T = C.timing;
        const pIn = E2.get('wobbly')(U.clamp(t / 0.7, 0, 1));
        const af = A.planeAffine(R, sp, { x: block.cx, y: block.cy, z: -2, rotX: 14 * (1 - pIn), scale: U.lerp(0.9, 1, pIn) * U.lerp(0.9, 1, out) }, w / 2);
        if (!af) return;
        ctx.globalAlpha *= U.clamp(pIn * 2, 0, 1);
        const st = C.style;
        // card
        if (st.card !== false) {
            ctx.save(); ctx.translate(-w / 2, -h / 2);
            A.paperShadow(R, af, 10, true);
            ctx.fillStyle = col(st.cardColor || '@paper');
            A.pathFromPts(ctx, A.tornRectPath(w, h, 0.3, block.seed + 'chart'), true); ctx.fill();
            A.paperShadow(R, af, 0, false);
            ctx.restore();
        }
        const pad = Math.min(w, h) * 0.08;
        let top = -h / 2 + pad;
        if (C.title) {
            const fs = h * 0.075;
            A.drawHandText(R, C.title, -w / 2 + pad, top + fs * 0.5, fs, col(st.titleInk || '@ink'), 'display', 'left');
            top += fs * 1.4;
        }
        const area = { x: -w / 2 + pad, y: top, w: w - pad * 2, h: h / 2 - pad - top };
        const tIn = U.num(T.intro, 0.6) / k, stag = U.num(T.stagger, 0.22) / k, grow = U.num(T.grow, 1.1) / k;
        const prog = i => E2.get(st.growEase || 'springy')(U.clamp((t - tIn - i * stag) / grow, 0, 1));
        const lin = i => U.clamp((t - tIn - i * stag) / grow, 0, 1);
        const valueText = (d, p) => (d.display && p >= 0.999 && !C.suffix ? d.display : C.prefix + C.fmt.format(d.value * p) + C.suffix);
        const fsL = Math.min(h * 0.07, area.h / Math.max(3, C.data.length) * 0.55);
        const maxI = C.data.reduce((m, d, i) => (d.value > C.data[m].value ? i : m), 0);
        const ink = col('@ink');
        switch (C.kind) {
            case 'column': {
                const n = C.data.length, gap = area.w / n, bw = gap * 0.62, base = area.y + area.h - fsL * 1.8;
                ctx.strokeStyle = ink; ctx.lineWidth = 2; A.strokePartial(ctx, [[area.x, base], [area.x + area.w, base]], U.clamp(t / tIn, 0, 1));
                C.data.forEach((d, i) => {
                    const p = prog(i), bh = (area.h - fsL * 3.6) * d.value / C.max * p;
                    const x = area.x + gap * i + (gap - bw) / 2;
                    ctx.fillStyle = C.highlightMax && i === maxI ? col('@accent') : colorFor(R, d, i + 1, C);
                    ctx.save(); ctx.translate(x, base - bh); A.pathFromPts(ctx, A.tornRectPath(bw, Math.max(1, bh), 0.25, block.seed + i), true); ctx.fill(); ctx.restore();
                    if (lin(i) > 0) {
                        A.drawHandText(R, valueText(d, lin(i) < 1 ? E2.get('smoothOut')(lin(i)) : 1), x + bw / 2, base - bh - fsL * 0.8, fsL, ink, 'display');
                        A.drawHandText(R, (d.emoji ? d.emoji + ' ' : '') + d.label, x + bw / 2, base + fsL * 0.9, fsL * 0.85, ink, 'body');
                    }
                });
                break;
            }
            case 'donut': case 'pie': {
                const total = C.data.reduce((s, d) => s + d.value, 0) || 1;
                const r = Math.min(area.w * 0.28, area.h * 0.46), cx = area.x + area.w * 0.3, cy = area.y + area.h / 2;
                let a0 = -Math.PI / 2;
                C.data.forEach((d, i) => {
                    const p = E2.get('smoothOut')(lin(i));
                    const sweep = (d.value / total) * Math.PI * 2;
                    if (p > 0) {
                        ctx.fillStyle = colorFor(R, d, i, C);
                        ctx.save(); ctx.shadowColor = col('@shadow'); ctx.shadowBlur = 6 * R.s; ctx.shadowOffsetY = 3 * R.s;
                        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r * (i === maxI && C.highlightMax ? 1.05 : 1), a0, a0 + sweep * p); ctx.closePath(); ctx.fill(); ctx.restore();
                        // legend
                        const ly = area.y + area.h * 0.12 + i * fsL * 1.6;
                        ctx.globalAlpha *= 1;
                        ctx.fillRect(area.x + area.w * 0.62, ly - fsL * 0.4, fsL * 0.8, fsL * 0.8);
                        A.drawHandText(R, `${d.emoji ? d.emoji + ' ' : ''}${d.label} — ${C.fmt.format(d.value * p)}${C.suffix || (C.kind === 'donut' ? '' : '')}`, area.x + area.w * 0.62 + fsL * 1.2, ly, fsL * 0.9, ink, 'body', 'left');
                    }
                    a0 += sweep;
                });
                if (C.kind === 'donut') {
                    ctx.fillStyle = col(st.cardColor || '@paper'); ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2); ctx.fill();
                    const d = C.data[maxI];
                    if (lin(C.data.length - 1) > 0) A.drawHandText(R, C.prefix + C.fmt.format(d.value * E2.get('smoothOut')(lin(maxI))) + C.suffix, cx, cy, r * 0.32, ink, 'display');
                }
                break;
            }
            case 'progress': {
                const rowH = area.h / C.data.length;
                C.data.forEach((d, i) => {
                    const p = prog(i), y = area.y + rowH * i + rowH * 0.25;
                    A.drawHandText(R, (d.emoji ? d.emoji + ' ' : '') + d.label, area.x, y, fsL, ink, 'body', 'left');
                    const tx = area.x, tw = area.w * 0.8, th = rowH * 0.22, ty = y + rowH * 0.18;
                    ctx.save(); ctx.globalAlpha *= 0.18; ctx.fillStyle = ink; ctx.fillRect(tx, ty, tw, th); ctx.restore();
                    ctx.fillStyle = colorFor(R, d, i, C); ctx.fillRect(tx, ty, tw * U.clamp(d.value / (C.suffix === '%' ? 100 : C.max), 0, 1) * p, th);
                    A.drawHandText(R, valueText(d, p), tx + tw + area.w * 0.1, ty + th / 2, fsL, ink, 'display');
                });
                break;
            }
            case 'stat': {
                const n = C.data.length, cw = area.w / n;
                C.data.forEach((d, i) => {
                    const p = prog(i), cx = area.x + cw * (i + 0.5), cy = area.y + area.h * 0.42;
                    const fs = Math.min(area.h * 0.42, cw * 0.28);
                    ctx.save(); ctx.translate(cx, cy); ctx.scale(Math.max(0.01, p), Math.max(0.01, p));
                    A.drawHandText(R, valueText(d, E2.get('smoothOut')(lin(i))), 0, 0, fs, colorFor(R, d, i, C), 'display');
                    ctx.restore();
                    if (p > 0.2) A.drawHandText(R, (d.emoji ? d.emoji + ' ' : '') + d.label, cx, cy + fs * 0.95, fs * 0.36, ink, 'hand');
                });
                break;
            }
            case 'compare': {
                const [a, b] = C.data;
                const cy = area.y + area.h * 0.5;
                [a, b].forEach((d, i) => {
                    if (!d) return;
                    const p = prog(i), side = i ? 1 : -1, cx = side * area.w * 0.25;
                    const bh = area.h * 0.6 * d.value / C.max * p, bw = area.w * 0.2;
                    ctx.fillStyle = colorFor(R, d, i, C);
                    ctx.save(); ctx.translate(cx - bw / 2, cy + area.h * 0.28 - bh); A.pathFromPts(ctx, A.tornRectPath(bw, Math.max(1, bh), 0.3, block.seed + i), true); ctx.fill(); ctx.restore();
                    A.drawHandText(R, valueText(d, E2.get('smoothOut')(lin(i))), cx, cy + area.h * 0.28 - bh - fsL * 1.2, fsL * 1.6, ink, 'display');
                    A.drawHandText(R, (d.emoji ? d.emoji + ' ' : '') + d.label, cx, cy + area.h * 0.28 + fsL * 1.1, fsL * 1.2, ink, 'hand');
                });
                const pv = E2.get('bigOvershoot')(U.clamp((t - tIn) / 0.5, 0, 1));
                ctx.save(); ctx.translate(0, cy); ctx.scale(pv, pv); ctx.rotate(U.deg(-8));
                ctx.fillStyle = col('@accent'); ctx.beginPath(); ctx.arc(0, 0, fsL * 1.4, 0, Math.PI * 2); ctx.fill();
                A.drawHandText(R, st.vsText || 'vs', 0, 0, fsL * 1.3, col('@paper'), 'display');
                ctx.restore();
                break;
            }
            case 'pictogram': {
                const unit = C.unit || Math.max(1, C.max / U.num(st.maxIcons, 10));
                const rowH = area.h / C.data.length;
                C.data.forEach((d, i) => {
                    const y = area.y + rowH * (i + 0.5);
                    const count = Math.max(1, Math.round(d.value / unit));
                    const size = Math.min(rowH * 0.7, area.w * 0.7 / Math.max(10, count));
                    A.drawHandText(R, d.label, area.x, y, fsL, ink, 'body', 'left');
                    ctx.font = `${size}px ${(theme.typography && theme.typography.emojiFallback) || 'sans-serif'}`;
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    for (let j = 0; j < count; j++) {
                        const pj = E2.get('bigOvershoot')(U.clamp((t - tIn - i * stag - j * 0.05 / k) / 0.35, 0, 1));
                        if (pj <= 0) break;
                        ctx.save(); ctx.translate(area.x + area.w * 0.28 + j * size * 1.05, y); ctx.scale(pj, pj); ctx.fillText(d.emoji || st.pictoEmoji || '🧍', 0, 0); ctx.restore();
                    }
                });
                A.drawHandText(R, `1 ${st.pictoEmojiLabel || '●'} = ${C.fmt.format(unit)}${C.suffix}`, area.x + area.w, area.y + area.h, fsL * 0.8, ink, 'hand', 'right');
                break;
            }
            case 'line': case 'timeline': {
                const n = C.data.length;
                const base = area.y + area.h - fsL * 1.6;
                const xs = C.data.map((d, i) => area.x + (n > 1 ? i / (n - 1) : 0.5) * area.w * 0.94 + area.w * 0.03);
                const min = C.kind === 'timeline' ? 0 : Math.min(0, ...C.data.map(d => d.value));
                const ys = C.data.map(d => (C.kind === 'timeline' ? area.y + area.h * 0.45 : base - (d.value - min) / (C.max - min || 1) * (area.h - fsL * 3.4)));
                const pl = E2.get('glide')(U.clamp((t - tIn) / (grow + n * stag), 0, 1));
                ctx.strokeStyle = ink; ctx.lineWidth = 2;
                if (C.kind === 'line') A.strokePartial(ctx, [[area.x, area.y], [area.x, base], [area.x + area.w, base]], U.clamp(t / tIn, 0, 1));
                ctx.strokeStyle = col('@accent'); ctx.lineWidth = Math.max(3, h * 0.012);
                A.strokePartial(ctx, xs.map((x, i) => [x, ys[i]]), pl);
                C.data.forEach((d, i) => {
                    const pi = E2.get('bigOvershoot')(U.clamp((pl * (n - 1) - i + 0.4) / 0.4, 0, 1));
                    if (pi <= 0) return;
                    ctx.save(); ctx.translate(xs[i], ys[i]); ctx.scale(pi, pi);
                    ctx.fillStyle = colorFor(R, d, i, C); ctx.beginPath(); ctx.arc(0, 0, h * 0.022, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                    if (C.kind === 'timeline') {
                        A.drawHandText(R, d.label, xs[i], ys[i] - fsL * 1.4, fsL * 1.1, ink, 'display');
                        if (d.note || d.display) A.drawHandText(R, d.note || '', xs[i], ys[i] + fsL * 1.4, fsL * 0.85, ink, 'hand');
                    } else {
                        A.drawHandText(R, valueText(d, 1), xs[i], ys[i] - fsL, fsL * 0.9, ink, 'display');
                        A.drawHandText(R, d.label, xs[i], base + fsL * 0.9, fsL * 0.8, ink, 'body');
                    }
                });
                break;
            }
            default: { // bar (horizontal)
                const n = C.data.length, rowH = area.h / n, lw = area.w * 0.26;
                C.data.forEach((d, i) => {
                    const p = prog(i), y = area.y + rowH * i + rowH * 0.15, bh = rowH * 0.62;
                    A.drawHandText(R, (d.emoji ? d.emoji + ' ' : '') + d.label, area.x + lw - fsL * 0.4, y + bh / 2, fsL, ink, 'body', 'right');
                    const bw = (area.w - lw - area.w * 0.16) * d.value / C.max * p;
                    ctx.fillStyle = C.highlightMax && i === maxI ? col('@accent') : colorFor(R, d, i + 1, C);
                    ctx.save(); ctx.translate(area.x + lw, y); A.paperShadow(R, af, 3, true); A.pathFromPts(ctx, A.tornRectPath(Math.max(1, bw), bh, 0.35, block.seed + i), true); ctx.fill(); A.paperShadow(R, af, 0, false); ctx.restore();
                    if (lin(i) > 0) A.drawHandText(R, valueText(d, E2.get('smoothOut')(lin(i))), area.x + lw + bw + fsL * 0.5, y + bh / 2, fsL, ink, 'display', 'left');
                });
            }
        }
    }

    E.registerBlock('chart', def);
    root.KineticCharts = { parseDataPairs, pickKind };
})(typeof window !== 'undefined' ? window : globalThis);
