/*!
 * KineticDirector — smart automation for KineticEngine
 * ----------------------------------------------------
 * Reads plain teacher text (English, Hindi or mixed) or your annotation projects and adds
 * the motion-graphics decisions an editor would make, as ordinary tags / visuals you can
 * see and edit afterwards:
 *
 *   maps       countries, states and cities → animated map with markers; "from X to Y" → route
 *   charts     2+ label–value pairs in one sentence → bar / donut / compare / line chart
 *   numbers    counters (odometer for big numbers), rings for percentages, data styling
 *   media      words that match your asset library → picture / SVG card
 *   placeholders  (optional) one "drop image here" card per scene for the key noun
 *   emoji      keyword → emoji sticker next to the word (💧 water, 🌍 earth, पानी → 💧)
 *   emphasis   one key word per sentence gets accent / highlight / underline
 *
 * Every switch is "on", "off" or "smart" (smart = avoid repetition, max one visual per sentence).
 *   const { content, report } = await KineticDirector.direct(content, presets, { maps:'smart', … })
 * Words you already tagged are never touched, so manual choices always win.
 */
(function (root) {
    'use strict';
    const E = root.KineticEngine;
    if (!E) { console.error('[KineticDirector] load engine.js first'); return; }
    const U = E.api.U;

    const DEFAULTS = { maps: 'smart', charts: 'smart', numbers: 'on', media: 'smart', placeholders: 'off', emoji: 'smart', emphasis: 'smart', recipes: 'smart', mapLabels: 'auto' };

    /* ─── token model over the raw beat text (keeps existing markup untouched) ─── */
    function tokenize(text) {
        const parts = String(text || '').split(/(\[[^\]]+\]\([^)]*\)|\*[^*]+\*|\s+|\|)/).filter(p => p !== '' && p != null);
        const toks = [];
        parts.forEach(p => {
            if (/^\s+$/.test(p) || p === '|') toks.push({ raw: p, space: true });
            else if (/^\[[^\]]+\]\(|^\*[^*]+\*$/.test(p)) toks.push({ raw: p, tagged: true });
            else toks.push({ raw: p, word: true, tags: [] });
        });
        return toks;
    }
    function rebuild(toks) {
        let out = '';
        for (let i = 0; i < toks.length; i++) {
            const t = toks[i];
            if (t.spanStart != null) {
                // multi-word span: collect until spanEnd
                const end = t.spanEnd;
                let inner = '';
                let j = i;
                for (; j < toks.length && j <= end; j++) inner += toks[j].raw;
                const m = inner.match(/^(.*?)([,.;:!?।॥]*)$/s);
                out += `[${m[1]}](${t.spanTags.join(' ')})${m[2]}`;
                i = j - 1;
                continue;
            }
            if (t.word && t.tags.length) {
                const m = t.raw.match(/^(.*?)([,.;:!?।॥]*)$/s);
                out += m[1] ? `[${m[1]}](${t.tags.join(' ')})${m[2]}` : t.raw;
            } else out += t.raw;
        }
        return out;
    }
    const bare = s => String(s).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{M}\p{N}%]+$/gu, '');

    function lib(presets) { return presets instanceof E.PresetLib ? presets : new E.PresetLib(presets); }

    /**
     * direct(content, presets, options) → Promise<{ content, report }>
     * content can be anything the engine accepts (native, annotation project, d3, text).
     */
    async function direct(input, presets, options) {
        const L = lib(presets);
        const conf = Object.assign({}, DEFAULTS, (L.json.auto && L.json.auto.defaults) || {}, (input && input.meta && input.meta.auto) || {}, options || {});
        const content = E.normalizeContent(input, L, {});
        const auto = L.json.auto || {};
        const stop = new Set([].concat(L.language.joiners || [], auto.stopwords || []).map(s => s.toLowerCase()));
        const emojiMap = auto.emojiKeywords || {};
        const report = { maps: 0, routes: 0, charts: 0, counters: 0, rings: 0, media: 0, placeholders: 0, emoji: 0, emphasis: 0, recipes: 0, notes: [] };
        const on = k => conf[k] === 'on' || conf[k] === 'smart' || conf[k] === true;
        const smart = k => conf[k] === 'smart';

        if (on('maps') && root.KineticGeo) await root.KineticGeo.ready();
        const geo = on('maps') ? root.KineticGeo : null;
        const media = (on('media') || on('placeholders')) ? root.KineticMedia : null;
        const charts = on('charts') ? root.KineticCharts : null;
        let lastMapKey = null, lastMediaKey = null;
        const recipeRules = U.asArray(auto.recipeRules).map(r => { try { return { recipe: r.recipe, re: new RegExp(r.match, 'iu') }; } catch (e) { return null; } }).filter(Boolean);
        let emphCycle = 0;

        content.scenes.forEach((scene, si) => {
            const legacyType = scene.legacy && scene.legacy[0] && scene.legacy[0].typeKey;
            let sceneHasVisual = false;
            let emojiUsed = 0;
            const nounCounts = new Map();
            scene.beats = U.asArray(scene.beats).map((raw, bi) => {
                const beat = typeof raw === 'string' ? { text: raw } : Object.assign({}, raw);
                if (beat.auto === false) return beat;
                const notes = [];
                const toks = tokenize(beat.text || '');
                const words = toks.filter(t => t.word);
                const plain = words.map(t => bare(t.raw));
                let hasVisual = !!(beat.visual || beat.visuals) || /\]\((?:[^)]*\b)?(map|img|image|svg|chart|city|country)\b/.test(beat.text || '');

                // 1 · charts: several label–value pairs in one sentence
                let chartUsed = false;
                if (charts && !hasVisual) {
                    const pairs = charts.parseDataPairs(words.map(w => w.raw).join(' '));
                    if (pairs.length >= 2) {
                        beat.visual = { type: 'chart', chart: charts.pickKind(pairs), data: pairs.map(p => ({ label: p.label, value: p.value, display: p.display, pct: p.pct })) };
                        hasVisual = chartUsed = true; report.charts++; notes.push('chart:' + beat.visual.chart);
                    }
                }

                // 2 · maps: countries / states / cities (+ routes)
                if (geo && !hasVisual) {
                    const hits = geo.detect(plain, { stopwords: auto.placeStopwords || [] });
                    hits.forEach(h => { for (let q = h.start; q < h.end; q++) if (words[q]) words[q].reserved = true; });
                    if (hits.length) {
                        const key = hits.map(h => h.hit.id || h.hit.name).join('|');
                        const repeat = smart('maps') && key === lastMapKey;
                        if (!repeat) {
                            const spec = { type: 'map', places: [], highlight: [], regions: [], caption: true };
                            hits.forEach(h => {
                                if (h.hit.type === 'country') { if (!spec.focus) spec.focus = h.hit.id; else spec.highlight.push(h.hit.id); }
                                else if (h.hit.type === 'region') spec.regions.push(h.hit.name);
                                else spec.places.push({ query: h.text, label: h.text, typeKey: legacyType && legacyType !== 'annotationLabel' ? legacyType : undefined });
                            });
                            const routeWords = auto.routeWords || ['from', 'to', 'towards', 'between', 'via', 'से', 'तक', 'की ओर', 'होते हुए'];
                            const plainText = ' ' + plain.join(' ').toLowerCase() + ' ';
                            const pts = hits.filter(h => h.hit.type !== 'region');
                            if (pts.length >= 2 && routeWords.some(rw => plainText.includes(' ' + rw + ' '))) {
                                spec.routes = [[pts[0].hit.type === 'country' ? pts[0].hit.capital && pts[0].hit.capital.name || pts[0].text : pts[0].text, pts[1].hit.type === 'country' ? pts[1].hit.capital && pts[1].hit.capital.name || pts[1].text : pts[1].text]];
                                report.routes++;
                            }
                            if (!spec.focus && !spec.places.length && spec.regions.length) spec.focus = spec.regions[0];
                            if (conf.mapLabels !== 'auto') spec.lang = conf.mapLabels;
                            beat.visual = spec;
                            hasVisual = true; report.maps++; notes.push('map:' + hits.map(h => h.text).join(', '));
                            lastMapKey = key;
                        } else {
                            // already on screen: just highlight the place names in the sentence
                            hits.forEach(h => { const tk = words[h.start]; if (tk && !tk.tags.length && h.end - h.start === 1) tk.tags.push('highlight'); });
                        }
                    }
                }

                // 3 · media: words that match your asset library
                if (media && on('media') && !hasVisual) {
                    for (let i = 0; i < words.length; i++) {
                        const w = plain[i];
                        if (!w || w.length < 3 || stop.has(w.toLowerCase())) continue;
                        const a = media.match(w, smart('media') ? 2 : 1);
                        if (a && (!smart('media') || a.name !== lastMediaKey)) {
                            beat.visual = { type: 'media', asset: a.name, caption: true };
                            hasVisual = true; report.media++; notes.push('media:' + a.name); lastMediaKey = a.name;
                            break;
                        }
                    }
                }
                sceneHasVisual = sceneHasVisual || hasVisual;

                // 4 · numbers: counters, rings for %, odometer for big values (not inside charts)
                if (on('numbers') && !chartUsed) {
                    words.forEach((tk, i) => {
                        if (tk.tags.length) return;
                        const w = bare(tk.raw);
                        const n = E.parseNumberWord(w);
                        if (!n || !/[\d०-९]/.test(w)) return;
                        const isYear = /^(1[5-9]|20)\d\d$/.test(w);
                        if (isYear) { tk.tags.push('number'); return; }
                        const big = n.value >= U.num(auto.odometerFrom, 1000);
                        tk.tags.push(big ? 'counter:,,odometer' : 'counter', 'number');
                        report.counters++;
                        if (/%/.test(w) || (plain[i + 1] || '').toLowerCase() === 'percent' || plain[i + 1] === 'प्रतिशत') { tk.tags.push('ring'); report.rings++; }
                    });
                }

                // 5 · emoji stickers from keywords
                if (on('emoji') && (!smart('emoji') || emojiUsed < U.num(auto.emojiPerScene, 2))) {
                    for (let i = 0; i < words.length; i++) {
                        const tk = words[i];
                        if (tk.tags.length || tk.reserved) continue;
                        const k = plain[i].toLowerCase();
                        const em = emojiMap[k] || emojiMap[k.replace(/(es|s)$/, '')];
                        if (em) {
                            // the emoji becomes its own word right after the keyword, so layout reserves space for it
                            const m = tk.raw.match(/^(.*?)([,.;:!?।॥]*)$/s);
                            tk.raw = m[1] + ' ' + em + m[2];
                            report.emoji++; emojiUsed++; notes.push('emoji:' + em);
                            break;
                        }
                    }
                }

                // 6 · emphasis: one key word per sentence
                if (on('emphasis') && !/\]\([^)]*\b(em|accent|big|huge|highlight|underline|circle)\b/.test(beat.text || '')) {
                    let best = -1, bestScore = 0;
                    words.forEach((tk, i) => {
                        if (tk.tags.length || tk.reserved) return;
                        const w = plain[i];
                        if (!w || stop.has(w.toLowerCase()) || /^\d/.test(w)) return;
                        let score = [...w].length;
                        if (/^[A-Z]/.test(w) && i > 0) score += 4;
                        if ([...w].length < 4) score = 0;
                        if (score > bestScore) { bestScore = score; best = i; }
                        const nk = w.toLowerCase();
                        if ([...w].length >= 5) nounCounts.set(nk, (nounCounts.get(nk) || 0) + 1);
                    });
                    if (best >= 0 && bestScore >= 6) {
                        const styles = auto.emphasisCycle || ['em', 'highlight', 'underline', 'em circle'];
                        words[best].tags.push(...styles[emphCycle++ % styles.length].split(' '));
                        report.emphasis++;
                    }
                }

                // 7 · recipes: sentence type → a motion bundle (question, definition, warning, step…)
                if (on('recipes') && !beat.recipe && !beat.entry && !beat.layout && !scene.recipe) {
                    const sentence = plain.join(' ').trim();
                    const rule = recipeRules.find(r => r.re.test(sentence));
                    let pick = rule ? rule.recipe : null;
                    if (!pick && si === 0 && bi === 0 && auto.titleRecipe && words.length <= U.num(auto.titleMaxWords, 7) && !hasVisual) pick = auto.titleRecipe;
                    if (pick && L.json.recipes && L.json.recipes[pick]) { beat.recipe = pick; report.recipes++; notes.push('recipe:' + pick); }
                }

                beat.text = rebuild(toks);
                if (notes.length) beat._auto = notes;
                return beat;
            });

            // 7 · optional placeholder so the teacher knows where a picture helps
            if (on('placeholders') && !sceneHasVisual && scene.beats.length) {
                const noun = Array.from(nounCounts.entries()).sort((a, b) => b[1] - a[1])[0];
                const first = scene.beats[0];
                if (noun && typeof first === 'object') {
                    first.visual = { type: 'media', query: noun[0], caption: true };
                    report.placeholders++;
                }
            }
        });
        content.meta = Object.assign({}, content.meta, { directed: conf });
        delete content._format;
        return { content, report };
    }

    /** Short human summary for the UI. */
    function summarize(r) {
        const parts = [];
        if (r.maps) parts.push(`${r.maps} map${r.maps > 1 ? 's' : ''}${r.routes ? ` (${r.routes} route${r.routes > 1 ? 's' : ''})` : ''}`);
        if (r.charts) parts.push(`${r.charts} chart${r.charts > 1 ? 's' : ''}`);
        if (r.counters) parts.push(`${r.counters} counter${r.counters > 1 ? 's' : ''}`);
        if (r.rings) parts.push(`${r.rings} % ring${r.rings > 1 ? 's' : ''}`);
        if (r.media) parts.push(`${r.media} picture${r.media > 1 ? 's' : ''}`);
        if (r.placeholders) parts.push(`${r.placeholders} placeholder${r.placeholders > 1 ? 's' : ''}`);
        if (r.emoji) parts.push(`${r.emoji} emoji`);
        if (r.emphasis) parts.push(`${r.emphasis} emphasised word${r.emphasis > 1 ? 's' : ''}`);
        if (r.recipes) parts.push(`${r.recipes} sentence recipe${r.recipes > 1 ? 's' : ''}`);
        return parts.length ? 'Auto-Director added ' + parts.join(', ') + '.' : 'Auto-Director found nothing to add.';
    }

    /** Engine hook: runs the director before compiling when content.meta.auto is not false. */
    function hook(options) {
        return async (content, presets) => {
            if (content && content.meta && content.meta.auto === false) return content;
            const r = await direct(content, presets, typeof options === 'function' ? options() : options);
            hook.lastReport = r.report;
            return r.content;
        };
    }

    root.KineticDirector = { direct, summarize, hook, tokenize, rebuild, DEFAULTS };
})(typeof window !== 'undefined' ? window : globalThis);
