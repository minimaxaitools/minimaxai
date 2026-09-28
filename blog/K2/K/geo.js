/*!
 * KineticGeo — map plug-in for KineticEngine (GeoLayers-style country / city animation)
 * -------------------------------------------------------------------------------------
 * Data: amCharts 5 geodata (world + country/region maps, linkware licence), GeoNames
 * cities (CC BY 4.0), i18n-iso-countries names (English, Hindi and 10 more languages).
 * You can add or replace any of it at runtime:
 *     KineticGeo.addGeoJSON('world' | 'myCountryStates', geojson)
 *     KineticGeo.addPlaces([{ name, lat, lon, country, aliases:[…] }])   // or CSV text
 *
 * Content usage
 *   inline tag     "[India](map)"  "[Delhi](city)"  "[28.61_77.2](place:Home)"
 *   beat visual    { "type":"map", "focus":"IN", "places":[…], "routes":[["Delhi","London"]],
 *                    "highlight":["IN","NP"], "values":{"IN":1.43,"CN":1.41}, "region":"indiaLow" }
 * Places accept your annotation node fields (typeKey, title, label, badgeText, color, dx, dy,
 * connectorType, connectorEnd, subjectRadius) and are drawn with matching kinetic markers.
 */
(function (root) {
    'use strict';
    const E = root.KineticEngine;
    if (!E) { console.error('[KineticGeo] load engine.js first'); return; }
    const A = E.api, U = A.U;

    /* ─── data store ─── */
    const DATA = { world: null, countries: {}, cities: [], regions: {}, custom: {}, places: [] };
    const IDX = { country: new Map(), city: new Map(), region: new Map(), place: new Map() };
    const PATHS = new Map();          // feature → Path2D per projection
    let BASE = '';
    let readyPromise = null;

    const norm = s => String(s || '').toLowerCase().normalize('NFKC').replace(/['’]s\b/g, '').replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

    function indexCountries() {
        IDX.country.clear();
        Object.keys(DATA.countries).forEach(id => {
            const c = DATA.countries[id];
            const names = [c.name].concat(...Object.values(c.names || {}), c.aliases || []);
            names.forEach(n => { const k = norm(n); if (k && !IDX.country.has(k)) IDX.country.set(k, id); });
        });
    }
    function indexCities() {
        IDX.city.clear();
        DATA.cities.forEach(r => {
            [r[0], r[6]].filter(Boolean).forEach(n => {
                const k = norm(n);
                if (!IDX.city.has(k)) IDX.city.set(k, []);
                IDX.city.get(k).push(r);
            });
        });
    }
    function indexRegion(mapName, geo) {
        (geo.features || []).forEach(f => {
            const p = f.properties || {};
            [p.name, p.name_hi, p.name_local].filter(Boolean).forEach(n => IDX.region.set(norm(n), { map: mapName, id: f.id || p.id, feature: f }));
        });
    }

    /** Load bundled data (window.KineticGeoData from geo/geo-data.js) or fetch geo/*.json. */
    function ready(base) {
        if (readyPromise) return readyPromise;
        BASE = base != null ? base : BASE;
        readyPromise = (async () => {
            const G = root.KineticGeoData;
            if (G) {
                DATA.world = G.world; DATA.countries = G.countries.countries || G.countries; DATA.cities = G.cities.rows || G.cities;
                Object.keys(G.regions || {}).forEach(k => { DATA.regions[k] = G.regions[k]; });
            } else {
                const get = async f => { const r = await fetch(BASE + 'geo/' + f); if (!r.ok) throw new Error(f + ' ' + r.status); return r.json(); };
                const [w, c, ci] = await Promise.all([get('world.json'), get('countries.json'), get('cities.json')]);
                DATA.world = w; DATA.countries = c.countries; DATA.cities = ci.rows;
                try { DATA.regions.indiaLow = await get('regions/indiaLow.json'); } catch (e) { /* optional */ }
            }
            indexCountries(); indexCities();
            Object.keys(DATA.regions).forEach(k => indexRegion(k, DATA.regions[k]));
            return true;
        })().catch(e => { readyPromise = null; E.Log.warn('geo:load', 'Map data could not be loaded: ' + e.message); return false; });
        return readyPromise;
    }

    /** Fetch an amCharts region map by name (e.g. "usaLow", "chinaLow") — local geo/regions first, then jsDelivr. */
    async function loadRegion(name) {
        if (DATA.regions[name] || DATA.custom[name]) return DATA.regions[name] || DATA.custom[name];
        const urls = [BASE + 'geo/regions/' + name + '.json', 'https://cdn.jsdelivr.net/npm/@amcharts/amcharts5-geodata@5/json/' + name + '.json'];
        for (const u of urls) {
            try { const r = await fetch(u); if (r.ok) { const g = await r.json(); DATA.regions[name] = g; indexRegion(name, g); return g; } } catch (e) { /* next */ }
        }
        E.Log.warn('region:' + name, `Region map "${name}" not found. Put ${name}.json in geo/regions/ or upload it in the Maps tab.`);
        return null;
    }

    /** User uploads: replace the world map, or add a country/region map (GeoJSON FeatureCollection). */
    function addGeoJSON(name, geo) {
        if (typeof geo === 'string') geo = JSON.parse(geo);
        if (!geo || !Array.isArray(geo.features)) throw new Error('Not a GeoJSON FeatureCollection');
        geo.features.forEach((f, i) => { if (f.id == null) f.id = (f.properties && (f.properties.id || f.properties.ISO_A2 || f.properties.iso_a2 || f.properties.name)) || name + '-' + i; });
        if (name === 'world') { DATA.world = geo; PATHS.clear(); }
        else { DATA.custom[name] = geo; DATA.regions[name] = geo; indexRegion(name, geo); }
        return geo.features.length;
    }
    /** Add your own places (array or CSV "name,lat,lon[,country][,alias|alias]"). */
    function addPlaces(list) {
        if (typeof list === 'string') {
            list = list.split(/\r?\n/).map(l => l.trim()).filter(l => l && !/^name\s*,/i.test(l)).map(l => {
                const c = l.split(',').map(x => x.trim());
                return { name: c[0], lat: +c[1], lon: +c[2], country: c[3] || '', aliases: (c[4] || '').split('|').filter(Boolean) };
            });
        }
        let n = 0;
        list.forEach(p => {
            if (!p || !isFinite(p.lat) || !isFinite(p.lon)) return;
            DATA.places.push(p); n++;
            [p.name].concat(p.aliases || []).forEach(a => IDX.place.set(norm(a), p));
        });
        return n;
    }

    /* ─── lookup ─── */
    function countryHit(id) {
        const c = DATA.countries[id];
        if (!c) return null;
        return { type: 'country', id, name: c.name, names: c.names, lon: c.centroid[0], lat: c.centroid[1], bbox: fixBox(c.bbox, c.centroid), capital: c.capital, maps: c.maps };
    }
    function fixBox(b, c) {
        if (!b) return null;
        if (b[2] - b[0] > 180) return [c[0] - 40, Math.max(-60, c[1] - 20), c[0] + 40, Math.min(85, c[1] + 20)];
        return b;
    }
    /** find("India") · find("दिल्ली") · find("Madhya Pradesh") · find("28.61,77.20") · find("IN") */
    function find(query, context) {
        if (query == null) return null;
        if (typeof query === 'object') {
            if (isFinite(query.lat) && isFinite(query.lon)) return Object.assign({ type: 'point', name: query.name || query.label || '' }, query);
            return find(query.query || query.place || query.name || query.title, context);
        }
        const q = String(query).trim();
        const coord = q.match(/^(-?\d+(?:\.\d+)?)[\s,_;]+(-?\d+(?:\.\d+)?)$/);
        if (coord) return { type: 'point', name: '', lat: +coord[1], lon: +coord[2] };
        if (/^[A-Z]{2}$/.test(q) && DATA.countries[q]) return countryHit(q);
        const k = norm(q);
        if (!k) return null;
        if (IDX.place.has(k)) { const p = IDX.place.get(k); return { type: 'city', name: p.name, lat: p.lat, lon: p.lon, country: p.country }; }
        if (IDX.country.has(k)) return countryHit(IDX.country.get(k));
        if (IDX.region.has(k) && !IDX.city.has(k)) {
            const r = IDX.region.get(k);
            const bb = featureBox(r.feature);
            return { type: 'region', id: r.id, map: r.map, name: r.feature.properties.name, name_hi: r.feature.properties.name_hi, lon: (bb[0] + bb[2]) / 2, lat: (bb[1] + bb[3]) / 2, bbox: bb, feature: r.feature };
        }
        if (IDX.city.has(k)) {
            let rows = IDX.city.get(k).slice();
            const ctxCountry = context && (context.country || context.focusCountry);
            rows.sort((a, b) => (ctxCountry ? (b[1] === ctxCountry) - (a[1] === ctxCountry) : 0) || b[4] - a[4]);
            const r = rows[0];
            return { type: 'city', name: r[0], name_hi: r[6], country: r[1], lon: r[2], lat: r[3], population: r[4], capital: r[5] === 1 };
        }
        return null;
    }
    function featureBox(f) {
        let w = 180, s = 90, e = -180, n = -90;
        const each = g => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []).forEach(p => p[0].forEach(([x, y]) => { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }));
        each(f.geometry);
        return [w, s, e, n];
    }

    /**
     * Detect places in free text (English + Hindi). Returns [{start,end,text,hit}] by word index.
     * City names must be capitalised in Latin script (avoids "reading", "mobile"…); stop-words from presets.
     */
    function detect(words, opts) {
        opts = opts || {};
        const stop = new Set((opts.stopwords || []).map(norm));
        const out = [];
        for (let i = 0; i < words.length; i++) {
            for (let n = Math.min(4, words.length - i); n >= 1; n--) {
                const raw = words.slice(i, i + n).join(' ');
                const k = norm(raw);
                if (!k || stop.has(k)) continue;
                let hit = null;
                if (IDX.place.has(k) || IDX.country.has(k) || IDX.region.has(k)) hit = find(raw, opts);
                else if (IDX.city.has(k) && (opts.cities !== false)) {
                    const latin = /[a-z]/i.test(raw);
                    const cap = !latin || /^[A-ZÀ-ɏ]/.test(raw.replace(/^[^\p{L}]+/u, ''));
                    if (cap && k.length >= 3) hit = find(raw, opts);
                }
                if (hit) { out.push({ start: i, end: i + n, text: raw, hit }); i += n - 1; break; }
            }
        }
        return out;
    }

    /* ─── projections (radians in, unitless out; y up) ─── */
    const PROJ = {
        naturalEarth(lon, lat) {
            const l = lon * Math.PI / 180, p = lat * Math.PI / 180, p2 = p * p, p4 = p2 * p2;
            return [l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4))), p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)))];
        },
        mercator(lon, lat) { const p = U.clamp(lat, -85, 85) * Math.PI / 180; return [lon * Math.PI / 180, Math.log(Math.tan(Math.PI / 4 + p / 2))]; },
        equirect(lon, lat) { return [lon * Math.PI / 180, lat * Math.PI / 180]; }
    };

    function featurePath(f, proj, key) {
        const cacheKey = key + '|' + proj;
        let entry = PATHS.get(f);
        if (entry && entry.key === cacheKey) return entry;
        const P = PROJ[proj] || PROJ.naturalEarth;
        const path = typeof Path2D !== 'undefined' ? new Path2D() : null;
        let len = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];
        polys.forEach(poly => poly.forEach(ring => {
            let px = null, py = null;
            ring.forEach(([lo, la], i) => {
                const [x, y] = P(lo, la);
                if (i === 0) path && path.moveTo(x, y); else { path && path.lineTo(x, y); len += Math.hypot(x - px, y - py); }
                px = x; py = y;
                x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
            });
            path && path.closePath();
        }));
        entry = { key: cacheKey, path, len, box: [x0, y0, x1, y1] };
        PATHS.set(f, entry);
        return entry;
    }

    /* ─── spec helpers ─── */
    function cfg(lib) { return (lib && lib.json && lib.json.geo) || {}; }
    function resolvePlace(p, ctx, i) {
        const q = typeof p === 'string' ? { query: p } : Object.assign({}, p);
        const hit = find(q.lat != null ? q : (q.query || q.name || q.place || q.title), ctx);
        if (!hit) { E.Log.warn('place:' + (q.query || q.name), `Place "${q.query || q.name || q.title}" not found — add it with the Maps tab (lat, lon).`); return null; }
        return Object.assign({ index: i }, hit, q, { lat: q.lat != null ? +q.lat : hit.lat, lon: q.lon != null ? +q.lon : hit.lon });
    }
    function labelFor(hit, lang) {
        if (!hit) return '';
        if (lang && lang !== 'en') {
            if (hit.names && hit.names[lang]) return hit.names[lang][0];
            if (lang === 'hi' && hit.name_hi) return hit.name_hi;
        }
        return hit.label || hit.name || '';
    }
    function pickLang(spec, ctx) {
        if (spec.lang) return spec.lang;
        const m = ctx.meta || {};
        if (m.lang) return m.lang;
        return /[ऀ-ॿ]/.test(spec._text || '') ? 'hi' : 'en';
    }

    /* ─── block definition ─── */
    const def = {
        tags: ['map', 'country', 'city', 'place', 'state', 'region', 'route'],
        framingScale: 0.35,
        captionDelay: 0.6,
        exitDuration: 0.6,
        fromTag(tag, text) {
            const q = tag.args[0] && tag.name !== 'place' ? tag.args[0] : text;
            const spec = { type: 'map', _text: text };
            if (tag.name === 'place') { spec.places = [{ query: text.replace(/_/g, ' '), label: tag.args[0] || '' }]; return spec; }
            if (tag.name === 'route') { spec.routes = [[tag.args[0], tag.args[1]]]; return spec; }
            if (tag.name === 'city') { spec.places = [{ query: q }]; return spec; }
            if (tag.name === 'state' || tag.name === 'region') { spec.regions = [q]; return spec; }
            spec.focus = q;
            return spec;
        },
        merge(specs) {
            const out = { type: 'map', places: [], routes: [], highlight: [], regions: [] };
            specs.forEach(s => {
                if (s.focus) { if (out.focus) out.highlight.push(s.focus); else out.focus = s.focus; }
                ['places', 'routes', 'highlight', 'regions'].forEach(k => { if (s[k]) out[k].push(...s[k]); });
                Object.keys(s).forEach(k => { if (!(k in out)) out[k] = s[k]; });
            });
            return out;
        },
        size(spec, ctx) {
            const c = cfg(ctx.lib);
            const aspect = U.num(spec.aspect, U.num(c.aspect, 1.6));
            const w = ctx.frame.width * U.num(spec.width, U.num(c.width, 0.82));
            return { w, h: w / aspect };
        },
        duration(spec, ctx) {
            const T = cfg(ctx.lib).timing || {};
            const places = U.asArray(spec.places).length, routes = U.asArray(spec.routes).length;
            return U.num(spec.duration, U.num(T.intro, 0.9) + U.num(T.fly, 1.5) + U.num(T.highlight, 0.6) + places * U.num(T.markerStagger, 0.3) + routes * U.num(T.route, 1.3) + U.num(T.hold, 1.4));
        },
        async preload(spec) {
            await ready();
            const regs = U.asArray(spec.region).concat(U.asArray(spec.regionMap));
            for (const r of regs) if (r) await loadRegion(r);
            return true;
        },
        prepare(spec, ctx) {
            const c = cfg(ctx.lib);
            const styles = c.styles || {};
            const resolve = (n, d = 0) => { const x = styles[n]; if (!x) return {}; return x.extends && d < 4 ? U.merge(resolve(x.extends, d + 1), x) : x; };
            const style = U.merge(resolve(c.defaultStyle || 'paper'), typeof spec.style === 'string' ? resolve(spec.style) : {}, U.isObj(spec.style) ? spec.style : {});
            const lang = pickLang(spec, ctx);
            const focus = spec.focus ? find(spec.focus) : null;
            const focusCountry = focus ? (focus.type === 'country' ? focus.id : focus.country) : null;
            const places = U.asArray(spec.places).map((p, i) => resolvePlace(p, { country: focusCountry }, i)).filter(Boolean);
            // a focused city is also a place marker
            if (focus && (focus.type === 'city' || focus.type === 'point') && !places.length) places.push(Object.assign({ index: 0 }, focus));
            const routes = U.asArray(spec.routes).map(r => [resolvePlace(r[0], { country: focusCountry }, 0), resolvePlace(r[1], { country: focusCountry }, 1)]).filter(r => r[0] && r[1]);
            const regions = U.asArray(spec.regions).map(r => find(r)).filter(Boolean);
            const highlight = U.asArray(spec.highlight).map(h => find(h)).filter(h => h && h.type === 'country').map(h => h.id);
            if (focus && focus.type === 'country') highlight.unshift(focus.id);
            if (focus && focus.type === 'city' && focus.country) highlight.unshift(focus.country);
            // countries that only contain markers get a soft tint so the viewer knows where we are
            const soft = Array.from(new Set(places.concat(...routes).map(p => p.country).filter(c => c && !highlight.includes(c))));
            regions.forEach(r => { if (r.map === 'indiaLow' && !highlight.includes('IN')) highlight.push('IN'); });
            // region (state) map to draw inside the focus country
            let regionMap = spec.region || (regions[0] && regions[0].map) || null;
            if (!regionMap && focusCountry && style.autoRegions && DATA.countries[focusCountry]) {
                regionMap = (DATA.countries[focusCountry].maps || []).find(m => DATA.regions[m]) || null;
            }
            // target view: focus bbox ∪ places ∪ routes
            let box = null;
            const grow = (lo, la) => { if (!box) box = [lo, la, lo, la]; else { box[0] = Math.min(box[0], lo); box[1] = Math.min(box[1], la); box[2] = Math.max(box[2], lo); box[3] = Math.max(box[3], la); } };
            if (focus && focus.bbox && focus.type !== 'city') { grow(focus.bbox[0], focus.bbox[1]); grow(focus.bbox[2], focus.bbox[3]); }
            regions.forEach(r => { grow(r.bbox[0], r.bbox[1]); grow(r.bbox[2], r.bbox[3]); });
            places.forEach(p => grow(p.lon, p.lat));
            routes.forEach(r => r.forEach(p => grow(p.lon, p.lat)));
            highlight.slice(1).forEach(id => { const c2 = countryHit(id); if (c2 && c2.bbox) { grow(c2.bbox[0], c2.bbox[1]); grow(c2.bbox[2], c2.bbox[3]); } });
            if (box) {
                const minSpan = U.num(spec.minSpan, U.num(style.minSpan, 10));
                const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2;
                const sx = Math.max(box[2] - box[0], minSpan), sy = Math.max(box[3] - box[1], minSpan * 0.6);
                box = [cx - sx / 2, cy - sy / 2, cx + sx / 2, cy + sy / 2];
            }
            const values = spec.values || null;
            const annotations = U.asArray(spec.annotations).map((a, i) => resolvePlace(a, { country: focusCountry }, places.length + i)).filter(Boolean);
            return {
                style, lang, focus, focusCountry, places: places.concat(annotations), routes, regions, highlight, soft, regionMap, box, values,
                proj: spec.projection || style.projection || 'naturalEarth', timing: cfg(ctx.lib).timing || {}, k: ctx.speed || 1,
                title: spec.title || (focus ? labelFor(focus, lang) : ''), showTitle: spec.showTitle !== false && style.showTitle !== false,
                view: spec.view || (box ? 'fly' : 'world')
            };
        },
        draw(R, sp, block, t, out) { drawMap(R, sp, block, t, out); }
    };

    /* ─── rendering ─── */
    function viewFor(box, P, w, h, pad) {
        const pts = [[box[0], box[1]], [box[2], box[3]], [box[0], box[3]], [box[2], box[1]], [(box[0] + box[2]) / 2, box[3]], [(box[0] + box[2]) / 2, box[1]]].map(([lo, la]) => P(lo, la));
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
        const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys);
        const s = Math.min(w / Math.max(1e-6, bw), h / Math.max(1e-6, bh)) * (1 - pad);
        return { cx: (Math.max(...xs) + Math.min(...xs)) / 2, cy: (Math.max(...ys) + Math.min(...ys)) / 2, s };
    }
    function flyView(a, b, e, bump) {
        const s = Math.exp(U.lerp(Math.log(a.s), Math.log(b.s), e));
        const ratio = Math.max(a.s, b.s) / Math.min(a.s, b.s);
        const k = 1 - Math.min(0.35, bump * Math.log(ratio) * 0.15) * Math.sin(Math.PI * e);
        // the centre travels ahead of the zoom so the subject is already in frame as we push in
        const ce = 1 - (1 - e) * (1 - e);
        return { cx: U.lerp(a.cx, b.cx, ce), cy: U.lerp(a.cy, b.cy, ce), s: s * k };
    }
    function greatCircle(a, b, n) {
        const toV = p => { const l = p.lon * Math.PI / 180, f = p.lat * Math.PI / 180; return [Math.cos(f) * Math.cos(l), Math.cos(f) * Math.sin(l), Math.sin(f)]; };
        const va = toV(a), vb = toV(b);
        const d = Math.acos(U.clamp(va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2], -1, 1));
        const out = [];
        for (let i = 0; i <= n; i++) {
            const f = i / n;
            const A2 = d < 1e-6 ? 1 - f : Math.sin((1 - f) * d) / Math.sin(d), B = d < 1e-6 ? f : Math.sin(f * d) / Math.sin(d);
            const v = [A2 * va[0] + B * vb[0], A2 * va[1] + B * vb[1], A2 * va[2] + B * vb[2]];
            out.push([Math.atan2(v[1], v[0]) * 180 / Math.PI, Math.atan2(v[2], Math.hypot(v[0], v[1])) * 180 / Math.PI]);
        }
        return out;
    }

    function drawMap(R, sp, block, t, out) {
        const M = block.prepared;
        if (!M || !DATA.world) { drawPlaceholder(R, sp, block, 'Loading map…'); return; }
        const ctx = R.ctx, st = M.style, theme = R.theme, E2 = R.lib.eases;
        const col = c => A.resolveColor(theme, c);
        const T = M.timing, k = M.k;
        const tIntro = U.num(T.intro, 0.9) / k, tFly = U.num(T.fly, 1.5) / k, tHi = U.num(T.highlight, 0.6) / k, tStag = U.num(T.markerStagger, 0.3) / k, tRoute = U.num(T.route, 1.3) / k;
        const w = block.w, h = block.h;
        const P = PROJ[M.proj] || PROJ.naturalEarth;

        // card enters: unfold + tilt settle (GeoLayers-style 3D reveal)
        const pIn = E2.get(st.enterEase || 'wobbly')(U.clamp(t / U.num(st.enterDuration, 0.8), 0, 1));
        const tilt = U.num(st.tilt, 18) * (1 - pIn) + Math.sin(t * 0.4) * U.num(st.tiltDrift, 1.2);
        const af = A.planeAffine(R, sp, { x: block.cx, y: block.cy, z: -2, rotX: tilt, scale: U.lerp(0.85, 1, pIn) * U.lerp(0.9, 1, out) }, w / 2);
        if (!af) return;
        ctx.globalAlpha *= U.clamp(pIn * 1.5, 0, 1);

        // paper card (sea)
        ctx.save();
        ctx.translate(-w / 2, -h / 2);
        A.paperShadow(R, af, 10, true);
        ctx.fillStyle = col(st.water || '@paper2');
        A.pathFromPts(ctx, A.tornRectPath(w, h, U.num(st.torn, 0.5), block.seed + 'map'), true);
        ctx.fill();
        A.paperShadow(R, af, 0, false);
        ctx.clip();
        ctx.translate(w / 2, h / 2);

        // view: world → focus
        const worldBox = st.worldBox || [-170, -58, 190, 84];
        const vWorld = viewFor(worldBox, P, w, h, 0.02);
        const vFocus = M.box ? viewFor(M.box, P, w, h, U.num(st.focusPad, 0.28)) : vWorld;
        const pFly = M.view === 'world' ? 0 : E2.get(st.flyEase || 'glide')(U.clamp((t - tIntro * 0.7) / tFly, 0, 1));
        const view = M.view === 'world' ? vWorld : flyView(vWorld, vFocus, pFly, U.num(st.flyBump, 1));
        const toLocal = (lo, la) => { const [x, y] = P(lo, la); return [(x - view.cx) * view.s, -(y - view.cy) * view.s]; };

        // graticule
        if (st.graticule) {
            ctx.save();
            ctx.strokeStyle = col(st.graticuleColor || '@ink'); ctx.globalAlpha *= U.num(st.graticuleOpacity, 0.08); ctx.lineWidth = 1;
            const step = view.s > 900 ? 5 : view.s > 300 ? 10 : 20;
            ctx.beginPath();
            for (let lo = -180; lo <= 180; lo += step) for (let la = -80; la <= 80; la += 4) { const p = toLocal(lo, la); la === -80 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]); }
            for (let la = -80; la <= 80; la += step) for (let lo = -180; lo <= 180; lo += 4) { const p = toLocal(lo, la); lo === -180 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]); }
            ctx.stroke();
            ctx.restore();
        }

        // land + borders (draw-on during intro)
        const pLand = E2.get('smoothOut')(U.clamp(t / tIntro, 0, 1));
        const vmin = [(-w / 2) / view.s + view.cx, view.cy - (h / 2) / view.s, (w / 2) / view.s + view.cx, view.cy + (h / 2) / view.s];
        const values = M.values;
        let vMin = Infinity, vMax = -Infinity;
        if (values) Object.values(values).forEach(v => { vMin = Math.min(vMin, +v); vMax = Math.max(vMax, +v); });
        ctx.save();
        ctx.transform(view.s, 0, 0, -view.s, -view.cx * view.s, view.cy * view.s);
        const lw = 1 / view.s;
        DATA.world.features.forEach(f => {
            if (st.hideAntarctica !== false && f.id === 'AQ') return;
            const fp = featurePath(f, M.proj, 'w');
            if (!fp.path) return;
            const b = fp.box;
            if (b[2] < vmin[0] || b[0] > vmin[2] || b[3] < vmin[1] || b[1] > vmin[3]) return;
            let fill = col(st.land || '@paper');
            if (values && values[f.id] != null) {
                const q = (values[f.id] - vMin) / Math.max(1e-9, vMax - vMin);
                fill = A.Color.mix(col(st.rampLow || '@highlight'), col(st.rampHigh || '@accent'), q);
            }
            ctx.globalAlpha = R.alpha * out * pLand * (values && values[f.id] == null ? U.num(st.otherOpacity, 0.85) : 1);
            ctx.fillStyle = fill;
            ctx.fill(fp.path);
            ctx.globalAlpha = R.alpha * out * U.num(st.borderOpacity, 0.55);
            ctx.strokeStyle = col(st.border || '@ink');
            ctx.lineWidth = lw * U.num(st.borderWidth, 0.9);
            ctx.setLineDash([fp.len * pLand, fp.len]);
            ctx.stroke(fp.path);
            ctx.setLineDash([]);
        });

        // soft tint for countries that only hold markers
        (M.soft || []).forEach(id => {
            const f = DATA.world.features.find(x => x.id === id);
            if (!f) return;
            const fp = featurePath(f, M.proj, 'w');
            ctx.globalAlpha = R.alpha * out * pLand * U.num(st.softOpacity, 0.35);
            ctx.fillStyle = col(st.softFill || st.highlight || '@accent');
            ctx.fill(fp.path);
        });

        // highlighted countries: fill sweep + outline draw-on
        M.highlight.forEach((id, i) => {
            const f = DATA.world.features.find(x => x.id === id);
            if (!f) return;
            const fp = featurePath(f, M.proj, 'w');
            const t0 = tIntro * 0.7 + tFly * 0.7 + i * tStag;
            const ph = E2.get(st.highlightEase || 'smoothOut')(U.clamp((t - t0) / tHi, 0, 1));
            if (ph <= 0) return;
            ctx.globalAlpha = R.alpha * out * ph * U.num(st.highlightOpacity, 0.95);
            ctx.fillStyle = col(i === 0 ? (st.highlight || '@accent') : (st.highlight2 || '@accent2'));
            ctx.fill(fp.path);
            ctx.globalAlpha = R.alpha * out;
            ctx.strokeStyle = col(st.outline || '@ink');
            ctx.lineWidth = lw * U.num(st.outlineWidth, 2.4);
            ctx.setLineDash([fp.len * ph, fp.len]);
            ctx.stroke(fp.path);
            ctx.setLineDash([]);
        });

        // region (state) layer inside the focus
        const reg = M.regionMap && DATA.regions[M.regionMap];
        if (reg) {
            const t0 = tIntro * 0.7 + tFly * 0.85;
            const pr = U.clamp((t - t0) / (tHi * 1.6), 0, 1);
            reg.features.forEach(f => {
                const fp = featurePath(f, M.proj, M.regionMap);
                if (!fp.path) return;
                const hit = M.regions.find(r => r.id === (f.id || (f.properties || {}).id));
                ctx.globalAlpha = R.alpha * out * pr * (hit ? 0.95 : U.num(st.regionOpacity, 0.35));
                if (hit) { ctx.fillStyle = col(st.regionHighlight || '@accent3'); ctx.fill(fp.path); }
                ctx.strokeStyle = col(st.regionBorder || '@paper');
                ctx.lineWidth = lw * U.num(st.regionBorderWidth, 1.1);
                ctx.setLineDash([fp.len * pr, fp.len]);
                ctx.stroke(fp.path);
                ctx.setLineDash([]);
            });
        }
        ctx.restore();
        ctx.globalAlpha = R.alpha * out;

        // latitude thresholds (annotationXYThreshold places)
        M.places.filter(p => p.typeKey === 'annotationXYThreshold').forEach((p, i) => {
            const t0 = tIntro + tFly + i * tStag;
            const pr = E2.get('glide')(U.clamp((t - t0) / 0.8, 0, 1));
            if (pr <= 0) return;
            const y = toLocal(0, p.lat)[1];
            ctx.save();
            ctx.strokeStyle = p.color || col(st.threshold || '@accent2'); ctx.lineWidth = 2.2; ctx.setLineDash([12, 8]);
            ctx.beginPath(); ctx.moveTo(-w / 2, y); ctx.lineTo(-w / 2 + w * pr, y); ctx.stroke(); ctx.setLineDash([]);
            A.drawHandText(R, p.label || p.title || p.name || '', -w / 2 + 16, y - 18, h * 0.045, ctx.strokeStyle, 'hand', 'left');
            ctx.restore();
        });

        // routes: great-circle arc draw-on with a travelling icon
        M.routes.forEach((r, i) => {
            const t0 = tIntro + tFly + tHi + U.asArray(M.places).length * tStag * 0.5 + i * tRoute;
            const pr = E2.get(st.routeEase || 'glide')(U.clamp((t - t0) / tRoute, 0, 1));
            if (pr <= 0) return;
            const pts = greatCircle(r[0], r[1], 64).map(([lo, la]) => toLocal(lo, la));
            // lift the arc off the paper for a 3D feel
            const lifted = pts.map((p, j) => [p[0], p[1] - Math.sin(Math.PI * j / 64) * Math.hypot(pts[64][0] - pts[0][0], pts[64][1] - pts[0][1]) * U.num(st.routeArc, 0.18)]);
            ctx.save();
            ctx.strokeStyle = col(st.route || '@accent'); ctx.lineWidth = U.num(st.routeWidth, 4); ctx.lineCap = 'round';
            ctx.setLineDash([14, 10]);
            A.strokePartial(ctx, lifted, pr);
            ctx.setLineDash([]);
            const e = A.endOf(lifted, pr);
            if (pr < 1 || st.routeIconStays) {
                ctx.translate(e.x, e.y); ctx.rotate(e.ang);
                const icon = st.routeIcon || '✈️';
                ctx.font = `${Math.round(h * 0.06)}px ${(theme.typography && theme.typography.emojiFallback) || 'sans-serif'}`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                if (E.hasEmoji(icon)) { ctx.rotate(U.deg(U.num(st.routeIconRotate, 45))); ctx.fillText(icon, 0, 0); }
                else { ctx.fillStyle = col('@accent'); ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill(); }
            }
            ctx.restore();
        });

        // place markers styled by your annotation typeKeys
        M.places.forEach((p, i) => {
            if (p.typeKey === 'annotationXYThreshold') return;
            const t0 = tIntro * 0.7 + tFly + tHi * 0.5 + i * tStag;
            const pm = U.clamp((t - t0) / U.num(st.markerDuration, 0.6), 0, 1);
            if (pm <= 0) return;
            const [x, y] = toLocal(p.lon, p.lat);
            drawMarker(R, p, x, y, pm, t - t0, M, h, i, w);
        });

        // title label
        if (M.showTitle && M.title) {
            const pt = E2.get('springy')(U.clamp((t - tIntro - tFly * 0.8) / 0.6, 0, 1));
            if (pt > 0) {
                ctx.save();
                const fs = h * U.num(st.titleSize, 0.085);
                ctx.translate(-w / 2 + fs * 0.6, -h / 2 + fs * 1.1);
                ctx.scale(pt, pt);
                ctx.font = A.fontFor(theme, { role: 'display', size: 1 }, fs);
                const tw = ctx.measureText(M.title).width;
                ctx.fillStyle = col(st.titleChip || '@accent');
                ctx.save(); ctx.translate(-fs * 0.35, -fs * 0.85); A.pathFromPts(ctx, A.tornRectPath(tw + fs * 0.7, fs * 1.25, 0.5, block.seed + 't'), true); ctx.fill(); ctx.restore();
                ctx.fillStyle = col(st.titleInk || '@paper');
                ctx.fillText(M.title, 0, 0);
                ctx.restore();
            }
        }

        // choropleth legend
        if (values && isFinite(vMin)) {
            const pl = U.clamp((t - tIntro - tFly) / 0.6, 0, 1);
            if (pl > 0) {
                ctx.save(); ctx.globalAlpha *= pl;
                const lw2 = w * 0.22, lh = h * 0.025, lx = -w / 2 + w * 0.04, ly = h / 2 - h * 0.09;
                const g = ctx.createLinearGradient(lx, 0, lx + lw2, 0);
                g.addColorStop(0, col(st.rampLow || '@highlight')); g.addColorStop(1, col(st.rampHigh || '@accent'));
                ctx.fillStyle = g; ctx.fillRect(lx, ly, lw2, lh);
                const fmt = A.numberFormat({ locale: (R.scene && R.scene.theme && R.scene.theme.numbers && R.scene.theme.numbers.locale) || 'en-US', decimals: 0, grouping: true });
                A.drawHandText(R, fmt.format(vMin), lx, ly + lh * 2.4, h * 0.04, col('@ink'), 'hand', 'left');
                A.drawHandText(R, fmt.format(vMax), lx + lw2, ly + lh * 2.4, h * 0.04, col('@ink'), 'hand', 'right');
                ctx.restore();
            }
        }
        ctx.restore(); // clip
        // attribution (amCharts linkware licence asks for it)
        if (st.attribution !== false) {
            ctx.save(); ctx.globalAlpha *= 0.45;
            A.drawHandText(R, st.attributionText || 'Map data: amCharts · GeoNames', w / 2 - 8, h / 2 + h * 0.03, h * 0.028, col('@ink'), 'body', 'right');
            ctx.restore();
        }
    }

    function drawMarker(R, p, x, y, pm, age, M, h, i, cw) {
        const ctx = R.ctx, st = M.style, E2 = R.lib.eases;
        const col = c => A.resolveColor(R.theme, c);
        const color = p.color || col(i === 0 ? (st.marker || '@accent') : (st.marker2 || '@accent2'));
        const r = h * U.num(st.markerSize, 0.028);
        const e = E2.get('springy')(pm);
        const label = p.label != null && p.label !== '' ? p.label : (p.title || labelFor(p, M.lang));
        const kind = p.typeKey || p.marker || st.markerKind || 'pin';
        ctx.save();
        ctx.translate(x, y);
        // ripple rings (loop)
        if (st.pulse !== false) {
            for (let k = 0; k < 2; k++) {
                const q = ((age * 0.8 + k * 0.5) % 1);
                ctx.globalAlpha = R.alpha * (1 - q) * 0.6 * Math.min(1, pm * 2);
                ctx.strokeStyle = color; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(0, 0, r * (1 + q * 2.4), 0, Math.PI * 2); ctx.stroke();
            }
            ctx.globalAlpha = R.alpha;
        }
        ctx.shadowColor = col('@shadow'); ctx.shadowBlur = 6 * R.s; ctx.shadowOffsetY = 3 * R.s;
        ctx.fillStyle = color; ctx.strokeStyle = color;
        if (kind === 'annotationBadge') {
            const br = r * 1.3 * e;
            ctx.beginPath(); ctx.arc(0, -br * 1.4, br, 0, Math.PI * 2); ctx.fill();
            ctx.shadowColor = 'transparent';
            A.drawHandText(R, String(p.badgeText || i + 1), 0, -br * 1.4, br * 1.2, col('@paper'), 'display');
            ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2); ctx.fill();
        } else if (kind === 'annotationCalloutCircle') {
            const rr = (p.subjectRadius ? p.subjectRadius * 0.6 : r * 3);
            ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * E2.get('handDrawn')(pm)); ctx.stroke();
            ctx.beginPath(); ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2); ctx.fill();
        } else if (kind === 'annotationCalloutRect') {
            const ww = (p.subjectWidth || 100) * 0.6 * e, hh = (p.subjectHeight || 60) * 0.6 * e;
            ctx.lineWidth = 3; ctx.strokeRect(-ww / 2, -hh / 2, ww, hh);
        } else if (kind === 'dot' || kind === 'annotationLabel') {
            ctx.beginPath(); ctx.arc(0, 0, r * 0.6 * e, 0, Math.PI * 2); ctx.fill();
        } else if (kind === 'emoji') {
            ctx.shadowColor = 'transparent';
            ctx.font = `${Math.round(r * 2.6 * e)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(p.emoji || '📍', 0, 0);
        } else {
            // teardrop pin drops in and bounces
            const drop = (1 - E2.get('bounce')(pm)) * -h * 0.12;
            ctx.translate(0, drop);
            const pr = r * 1.1;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(-pr * 0.2, -pr * 0.9, -pr * 1.1, -pr * 1.3, -pr * 1.1, -pr * 2.1);
            ctx.arc(0, -pr * 2.1, pr * 1.1, Math.PI, 0);
            ctx.bezierCurveTo(pr * 1.1, -pr * 1.3, pr * 0.2, -pr * 0.9, 0, 0);
            ctx.fill();
            ctx.shadowColor = 'transparent';
            ctx.fillStyle = col('@paper'); ctx.beginPath(); ctx.arc(0, -pr * 2.1, pr * 0.45, 0, Math.PI * 2); ctx.fill();
            if (p.capital) { ctx.fillStyle = color; A.drawHandText(R, '★', 0, -pr * 2.1, pr * 0.8, color, 'body'); }
        }
        ctx.shadowColor = 'transparent';
        // label: plain, or a callout card for callout typeKeys
        const lp = E2.get('smoothOut')(U.clamp((pm - 0.3) / 0.7, 0, 1));
        if (label && lp > 0) {
            const fs = h * U.num(st.labelSize, 0.045);
            const callout = /Callout(Elbow|Curve)?$/.test(kind) || p.note;
            ctx.globalAlpha = R.alpha * lp;
            if (callout) {
                const dx = (p.dx != null ? p.dx : 70) * U.num(st.calloutScale, 1.2), dy = (p.dy != null ? p.dy : -60) * U.num(st.calloutScale, 1.2);
                ctx.strokeStyle = color; ctx.lineWidth = 2.2;
                const pts = kind === 'annotationCalloutElbow' ? [[0, 0], [dx, 0], [dx, dy]] : kind === 'annotationCalloutCurve' ? A.quadPts(0, 0, dx * 0.1, dy, dx, dy, 16) : [[0, 0], [dx, dy]];
                A.strokePartial(ctx, pts, lp);
                const text = [p.title, p.label || p.note].filter(Boolean).join('\n') || label;
                ctx.font = A.fontFor(R.theme, { role: 'hand', size: 1 }, fs);
                const lines = String(text).split('\n');
                const tw = Math.max(...lines.map(l => ctx.measureText(l).width)) + fs;
                const th = lines.length * fs * 1.15 + fs * 0.5;
                // keep the note card inside the map card
                let cx0 = dx - (dx < 0 ? tw : 0), cy0 = dy - th / 2;
                const m2 = fs * 0.5;
                cx0 = U.clamp(x + cx0, -cw / 2 + m2, cw / 2 - m2 - tw) - x;
                cy0 = U.clamp(y + cy0, -h / 2 + m2, h / 2 - m2 - th) - y;
                ctx.save(); ctx.translate(cx0, cy0); ctx.scale(1, lp);
                ctx.fillStyle = col('@paper'); ctx.shadowColor = col('@shadow'); ctx.shadowBlur = 8 * R.s; ctx.shadowOffsetY = 4 * R.s;
                A.pathFromPts(ctx, A.tornRectPath(tw, th, 0.5, 'c' + i), true); ctx.fill(); ctx.shadowColor = 'transparent';
                ctx.fillStyle = color; ctx.fillRect(0, 0, fs * 0.18, th);
                lines.forEach((l, j) => A.drawHandText(R, l, fs * 0.5, fs * 0.75 + j * fs * 1.15, fs, col('@ink'), 'hand', 'left'));
                ctx.restore();
            } else {
                const up = kind === 'pin' || !p.typeKey ? -r * 3.2 - fs * 0.4 : -r * 1.6 - fs * 0.5;
                ctx.font = A.fontFor(R.theme, { role: 'hand', size: 1 }, fs);
                const tw = ctx.measureText(label).width;
                ctx.fillStyle = col(st.labelChip || '@paper');
                ctx.save(); ctx.translate(-tw / 2 - fs * 0.35, up - fs * 0.7); ctx.globalAlpha *= 0.92;
                A.pathFromPts(ctx, A.tornRectPath(tw + fs * 0.7, fs * 1.3, 0.4, 'l' + i), true); ctx.fill(); ctx.restore();
                A.drawHandText(R, label, 0, up, fs, col(st.labelInk || '@ink'), 'hand');
            }
        }
        ctx.restore();
    }

    function drawPlaceholder(R, sp, block, text) {
        const af = A.planeAffine(R, sp, { x: block.cx, y: block.cy }, block.w / 2);
        if (!af) return;
        const ctx = R.ctx;
        ctx.setLineDash([12, 8]); ctx.strokeStyle = A.resolveColor(R.theme, '@ink'); ctx.lineWidth = 2;
        ctx.strokeRect(-block.w / 2, -block.h / 2, block.w, block.h); ctx.setLineDash([]);
        A.drawHandText(R, text, 0, 0, block.h * 0.07, A.resolveColor(R.theme, '@ink'), 'hand');
    }

    E.registerBlock('map', def);

    root.KineticGeo = {
        ready, find, detect, addGeoJSON, addPlaces, loadRegion, norm, data: DATA,
        countryName: (id, lang) => { const c = DATA.countries[id]; return c ? labelFor(countryHit(id), lang) : id; },
        projections: PROJ
    };
})(typeof window !== 'undefined' ? window : globalThis);
