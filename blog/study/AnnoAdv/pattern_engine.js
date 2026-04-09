/**
 * pattern_engine.js  ·  D3 Annotation Studio — Pattern & Collision Engine
 * ─────────────────────────────────────────────────────────────────────────
 * Supplementary script that powers:
 *   1. 20+ spatial patterns (Grid, Radial, Spiral, Fibonacci, SolarSystem…)
 *   2. D3-force collision resolution (push-apart, canvas-clamped)
 *   3. Bulk multi-annotation property operations
 *   4. Advanced thread-slicer controls (multi-ratio, Y-offsets per seam)
 *   5. Multi-line bullet-point note support
 *   6. Pattern-specific sub-control UI (dynamically rendered into the sidebar)
 *
 * Connects to the base app through window.AppStore (set by fixed_script.js).
 */

(function () {
    'use strict';

    // ── Wait for AppStore ────────────────────────────────────────────────────────
    const _interval = setInterval(() => {
        if (window.AppStore && window.AppStore.getAnnotations) {
            clearInterval(_interval);
            initPatternEngine();
        }
    }, 80);

    // ── Seeded PRNG (Xorshift32) ─────────────────────────────────────────────────
    function makeRng(seed) {
        let s = ((seed || 1) >>> 0) || 1;
        return () => {
            s ^= s << 13; s ^= s >> 17; s ^= s << 5;
            return (s >>> 0) / 0xffffffff;
        };
    }

    const BADGE_SEQ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';
    function badgeChar(i) { return BADGE_SEQ[i % BADGE_SEQ.length]; }

    // ── Palette per importance ───────────────────────────────────────────────────
    const PALETTES = {
        high:   ['#E8336D', '#F43F5E', '#DC2626'],
        medium: ['#8B5CF6', '#7C3AED', '#6366F1'],
        low:    ['#10B981', '#3B82F6', '#0EA5E9']
    };
    function colorFor(importance, idx) {
        const p = PALETTES[importance] || PALETTES.medium;
        return p[idx % p.length];
    }

    // ── Annotation factory (mirrors PatternGenerator.ts makeAnnotation) ──────────
    const TYPE_BY_PATTERN = {
        grid:       (imp, idx) => imp === 'high' ? 'annotationCalloutRect' : imp === 'medium' ? 'annotationCalloutElbow' : 'annotationLabel',
        radial:     (imp)      => imp === 'high' ? 'annotationCalloutCircle' : imp === 'medium' ? 'annotationCalloutCurve' : 'annotationCallout',
        spiral:     (imp)      => imp === 'high' ? 'annotationCalloutCircle' : 'annotationCalloutCurve',
        clock:      (imp)      => imp === 'high' ? 'annotationCalloutCircle' : 'annotationCalloutCurve',
        circle:     (imp)      => imp === 'high' ? 'annotationCalloutCircle' : 'annotationCalloutCurve',
        fibonacci:  (imp)      => imp === 'high' ? 'annotationCalloutCircle' : 'annotationCalloutCurve',
        hexagonal:  (imp)      => imp === 'high' ? 'annotationCalloutRect' : imp === 'medium' ? 'annotationCalloutElbow' : 'annotationCallout',
        voronoi:    (imp)      => imp === 'high' ? 'annotationCalloutCircle' : imp === 'medium' ? 'annotationCalloutElbow' : 'annotationCallout',
        mandala:    (imp)      => imp === 'high' ? 'annotationCalloutCircle' : 'annotationCalloutCurve',
        molecular:  (imp)      => imp === 'high' ? 'annotationCalloutRect' : imp === 'medium' ? 'annotationCalloutElbow' : 'annotationCallout',
        radialHub:  (imp)      => imp === 'high' ? 'annotationCalloutCircle' : 'annotationCalloutCurve',
        tree:       (imp)      => imp === 'high' ? 'annotationCalloutRect' : imp === 'medium' ? 'annotationCalloutElbow' : 'annotationCallout',
        concentric: (imp)      => imp === 'high' ? 'annotationCalloutCircle' : 'annotationCalloutCurve',
        archSpiral: (imp)      => imp === 'high' ? 'annotationCalloutCircle' : 'annotationCalloutCurve',
        solarSystem:(imp)      => imp === 'high' ? 'annotationCalloutCircle' : 'annotationCalloutCurve',
        timeline:   (imp, idx) => imp === 'high' ? 'annotationCalloutElbow' : idx % 2 === 0 ? 'annotationCalloutElbow' : 'annotationCallout',
        cluster:    (imp, idx) => imp === 'high' ? 'annotationCalloutCircle' : idx % 3 === 0 ? 'annotationCalloutRect' : 'annotationCallout',
        flow:       (imp)      => imp === 'high' ? 'annotationCalloutCurve' : 'annotationCallout',
        diamond:    (imp)      => imp === 'high' ? 'annotationCalloutCircle' : 'annotationCallout',
        shelf:      (imp)      => imp === 'high' ? 'annotationCalloutRect' : imp === 'medium' ? 'annotationCalloutElbow' : 'annotationLabel',
        diagonal:   (imp)      => imp === 'high' ? 'annotationCalloutElbow' : 'annotationCallout',
    };

    const CONNECTOR_BY_PATTERN = {
        spiral: 'curve', fibonacci: 'curve', archSpiral: 'curve', voronoi: 'curve', flow: 'curve',
        cluster: 'curve', radial: 'line', radialHub: 'line', clock: 'line', circle: 'line',
        solarSystem: 'line', concentric: 'line', mandala: 'line', hexagonal: 'elbow',
        tree: 'elbow', molecular: 'elbow', grid: 'elbow', shelf: 'elbow', diagonal: 'elbow',
    };

    function makeAnnotation(source, idx, pattern, x, y, dx, dy) {
        const imp = source.importance || 'medium';
        const color = source.color || colorFor(imp, idx % 3);
        const typeFn = TYPE_BY_PATTERN[pattern] || TYPE_BY_PATTERN.radial;
        const typeKey = source.typeKey || typeFn(imp, idx);
        const connectorType = CONNECTOR_BY_PATTERN[pattern] || 'line';

        return {
            id: Date.now() + idx * 7 + Math.floor(Math.random() * 1000),
            typeKey,
            x, y, dx, dy,
            title: source.title || ('Item ' + (idx + 1)),
            label: source.label || '',
            wrap: source.wrap || 140,
            padding: 5,
            notePositionMode: 'offset',
            nx: null, ny: null,
            noteLineType: ['radial','clock','circle','concentric','mandala','solarSystem'].includes(pattern) ? 'horizontal' : 'vertical',
            noteOrientation: 'topBottom',
            noteAlign: ['radial','clock','circle','concentric','mandala','solarSystem','voronoi','flow','cluster'].includes(pattern) ? 'dynamic' : 'middle',
            connectorType,
            connectorEnd: 'arrow',
            connectorEndScale: 3,
            curveType: 'curveCatmullRom',
            curvePoints: 2,
            color,
            titleFont: 'Kalam',
            titleFontSize: imp === 'high' ? 18 : 14,
            titleFontWeight: 700,
            labelFont: 'Inter',
            labelFontSize: 11,
            labelFontWeight: 400,
            subjectFill: color,
            subjectFillOpacity: imp === 'high' ? 0.15 : 0.08,
            subjectRadius: imp === 'high' ? 55 : 40,
            subjectWidth: 100, subjectHeight: 60,
            thresholdOrientation: 'horizontal',
            badgeText: source.badgeText || badgeChar(idx),
            badgeRadius: 14,
            zIndex: imp === 'high' ? 12 : 10,
            disableParts: [],
            wrapSplitterEnabled: false,
            bgPadding: 0, bgPaddingTop: 0, bgPaddingBottom: 0, bgPaddingLeft: 0, bgPaddingRight: 0,
            connectorPoints: null,
            importance: imp,
        };
    }

    // ── Pattern implementations ──────────────────────────────────────────────────

    function applyGrid(anns, opts, w, h) {
        const { columns = 4, rowSpacing = 220, colSpacing = 250, offsetRows = false } = opts;
        const rng = makeRng(42);
        return anns.map((a, i) => {
            const col = i % columns, row = Math.floor(i / columns);
            const xOff = offsetRows && row % 2 === 1 ? colSpacing * 0.5 : 0;
            const x = 110 + xOff + col * colSpacing;
            const y = 110 + row * rowSpacing;
            const dx = (rng() > 0.5 ? 1 : -1) * (40 + rng() * 60);
            const dy = row % 2 === 0 ? -(60 + rng() * 60) : (60 + rng() * 60);
            return makeAnnotation(a, i, 'grid', x, y, dx, dy);
        });
    }

    function applyRadial(anns, opts, w, h) {
        const { radius = 260, angleStart = 0, spread = 1.0 } = opts;
        const cx = w / 2, cy = h / 2;
        const startRad = angleStart * Math.PI / 180;
        const totalArc = spread * Math.PI * 2;
        return anns.map((a, i) => {
            const angle = startRad + (anns.length > 1 ? i / (anns.length - 1) : 0) * totalArc;
            const r = radius + (a.importance === 'high' ? 30 : 0);
            const x = cx + r * Math.cos(angle), y = cy + r * Math.sin(angle);
            const cLen = a.importance === 'high' ? 120 : 95;
            return makeAnnotation(a, i, 'radial', x, y, Math.cos(angle) * cLen, Math.sin(angle) * cLen);
        });
    }

    function applySpiral(anns, opts, w, h) {
        const { tightness = 20, growthRate = 12, clockwise = true } = opts;
        const cx = w / 2, cy = h / 2, dir = clockwise ? 1 : -1;
        return anns.map((a, i) => {
            const angle = dir * i * 0.75;
            const r = tightness + growthRate * i * 0.6;
            const x = cx + r * Math.cos(angle), y = cy + r * Math.sin(angle);
            const pAngle = angle + Math.PI / 2;
            const dLen = a.importance === 'high' ? 100 : 75;
            return makeAnnotation(a, i, 'spiral', x, y, Math.cos(pAngle) * dLen, Math.sin(pAngle) * dLen);
        });
    }

    function applyClock(anns, opts, w, h) {
        const { radius = 200, rotation = 0 } = opts;
        const cx = w / 2, cy = h / 2;
        const rotRad = rotation * Math.PI / 180;
        return anns.map((a, i) => {
            const angle = rotRad + (i / 12) * Math.PI * 2 - Math.PI / 2;
            const x = cx + radius * Math.cos(angle), y = cy + radius * Math.sin(angle);
            return makeAnnotation(a, i, 'clock', x, y, Math.cos(angle) * 95, Math.sin(angle) * 95);
        });
    }

    function applyCircle(anns, opts, w, h) {
        const { radius = 240, randomness = 0 } = opts;
        const cx = w / 2, cy = h / 2;
        const rng = makeRng(101);
        return anns.map((a, i) => {
            const angle = (i / Math.max(1, anns.length)) * Math.PI * 2;
            const r = radius + (rng() - 0.5) * randomness * 2;
            const x = cx + r * Math.cos(angle), y = cy + r * Math.sin(angle);
            return makeAnnotation(a, i, 'circle', x, y, Math.cos(angle) * 110, Math.sin(angle) * 110);
        });
    }

    function applyFibonacci(anns, opts, w, h) {
        const { scaleVariation = 20, spread = 25 } = opts;
        const cx = w / 2, cy = h / 2;
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        return anns.map((a, i) => {
            const r = spread * Math.sqrt(i + 1);
            const theta = (i + 1) * goldenAngle;
            const x = cx + r * Math.cos(theta), y = cy + r * Math.sin(theta);
            return makeAnnotation(a, i, 'fibonacci', x, y, Math.cos(theta) * (80 + scaleVariation), Math.sin(theta) * (80 + scaleVariation));
        });
    }

    function applyHexagonal(anns, opts, w, h) {
        const { spacing = 145, size = 60 } = opts;
        const cols = Math.max(2, Math.ceil(Math.sqrt(anns.length)));
        const cx = w / 2, cy = h / 2;
        const offsetX = (cols - 1) * spacing * 0.5;
        const offsetY = Math.floor(anns.length / cols) * (spacing * 0.866) * 0.5;
        return anns.map((a, i) => {
            const col = i % cols, row = Math.floor(i / cols);
            const x = cx - offsetX + col * spacing + (row % 2 === 1 ? spacing / 2 : 0);
            const y = cy - offsetY + row * (spacing * 0.866);
            return makeAnnotation(a, i, 'hexagonal', x, y, (row % 2 === 0 ? 1 : -1) * size, (col % 2 === 0 ? 1 : -1) * size);
        });
    }

    function applyVoronoi(anns, opts, w, h) {
        const { cellSpread = 140, randomness = 50 } = opts;
        const cx = w / 2, cy = h / 2;
        const rng = makeRng(99);
        return anns.map((a, i) => {
            const r = cellSpread * Math.sqrt(i + 1) * 0.4;
            const theta = i * 2.39996 + (rng() - 0.5) * (randomness / 100);
            const x = cx + r * Math.cos(theta), y = cy + r * Math.sin(theta);
            return makeAnnotation(a, i, 'voronoi', x, y, Math.cos(theta) * 70, Math.sin(theta) * 70);
        });
    }

    function applyMandala(anns, opts, w, h) {
        const { layers = 3, symmetry = 8 } = opts;
        const cx = w / 2, cy = h / 2;
        return anns.map((a, i) => {
            const layerIdx = Math.floor(i / symmetry) % layers + 1;
            const symIdx = i % symmetry;
            const r = layerIdx * 110;
            const angle = (symIdx / symmetry) * Math.PI * 2 + (layerIdx % 2 === 0 ? Math.PI / symmetry : 0);
            const x = cx + r * Math.cos(angle), y = cy + r * Math.sin(angle);
            return makeAnnotation(a, i, 'mandala', x, y, Math.cos(angle) * (55 + layerIdx * 9), Math.sin(angle) * (55 + layerIdx * 9));
        });
    }

    function applyMolecular(anns, opts, w, h) {
        const { bondLength = 115, branches = 3 } = opts;
        const cx = w / 2, cy = h / 2;
        return anns.map((a, i) => {
            if (i === 0) return makeAnnotation(a, i, 'molecular', cx, cy, 95, 90);
            const depth = Math.floor(Math.log(i * (branches - 1) + 1) / Math.log(branches));
            const angle = (i % branches) * (Math.PI * 2 / branches) + depth * 0.5;
            const r = depth * bondLength;
            const x = cx + r * Math.cos(angle), y = cy + r * Math.sin(angle);
            return makeAnnotation(a, i, 'molecular', x, y, Math.cos(angle) * bondLength * 0.75, Math.sin(angle) * bondLength * 0.75);
        });
    }

    function applyRadialHub(anns, opts, w, h) {
        const { radius = 260, spokes = 8 } = opts;
        const cx = w / 2, cy = h / 2;
        return anns.map((a, i) => {
            if (i === 0) return makeAnnotation(a, i, 'radialHub', cx, cy, 130, -90);
            const spokeIdx = (i - 1) % spokes;
            const ringIdx = Math.floor((i - 1) / spokes) + 1;
            const angle = (spokeIdx / spokes) * Math.PI * 2 - Math.PI / 2;
            const r = radius * ringIdx * 0.55;
            const x = cx + r * Math.cos(angle), y = cy + r * Math.sin(angle);
            return makeAnnotation(a, i, 'radialHub', x, y, Math.cos(angle) * 90, Math.sin(angle) * 90);
        });
    }

    function applyTree(anns, opts, w, h) {
        const { spacingX = 175, spacingY = 145 } = opts;
        const cx = w / 2;
        return anns.map((a, i) => {
            const depth = Math.floor(Math.log2(i + 1));
            const wAtLevel = Math.pow(2, depth);
            const idxInLevel = i - (wAtLevel - 1);
            const x = cx + (idxInLevel - (wAtLevel - 1) / 2) * spacingX;
            const y = 80 + depth * spacingY;
            return makeAnnotation(a, i, 'tree', x, y, 75, 40);
        });
    }

    function applyConcentric(anns, opts, w, h) {
        const { rings = 3, spacing = 115 } = opts;
        const cx = w / 2, cy = h / 2;
        const ipr = Math.ceil(anns.length / rings);
        return anns.map((a, i) => {
            const ring = (i % rings) + 1;
            const r = ring * spacing;
            const idxInRing = Math.floor(i / rings);
            const angle = (idxInRing / ipr) * Math.PI * 2;
            const x = cx + r * Math.cos(angle), y = cy + r * Math.sin(angle);
            return makeAnnotation(a, i, 'concentric', x, y, Math.cos(angle) * 85, Math.sin(angle) * 85);
        });
    }

    function applyArchSpiral(anns, opts, w, h) {
        const { tightness = 15, spacing = 30 } = opts;
        const cx = w / 2, cy = h / 2;
        return anns.map((a, i) => {
            const theta = Math.sqrt(i + 1) * Math.PI;
            const r = tightness + theta * spacing * 0.1;
            const x = cx + r * Math.cos(theta), y = cy + r * Math.sin(theta);
            return makeAnnotation(a, i, 'archSpiral', x, y, Math.cos(theta) * 95, Math.sin(theta) * 95);
        });
    }

    function applySolarSystem(anns, opts, w, h) {
        const { orbits = 4, scaleVariation = 30 } = opts;
        const cx = w / 2, cy = h / 2;
        const rng = makeRng(111);
        return anns.map((a, i) => {
            if (i === 0) return makeAnnotation(a, i, 'solarSystem', cx, cy, 130, -95);
            const orbit = 1 + (i % orbits);
            const r = orbit * 115 + rng() * scaleVariation;
            const angle = rng() * Math.PI * 2;
            const x = cx + r * Math.cos(angle), y = cy + r * Math.sin(angle);
            return makeAnnotation(a, i, 'solarSystem', x, y, Math.cos(angle) * 75, Math.sin(angle) * 75);
        });
    }

    function applyTimeline(anns, opts, w, h) {
        const { direction = 'horizontal', spacing = 155, alternation = 'updown' } = opts;
        const pad = 115;
        return anns.map((a, i) => {
            let x, y, dx, dy;
            if (direction === 'horizontal') {
                const step = Math.min(spacing, (w - pad * 2) / Math.max(1, anns.length - 1));
                x = pad + i * step; y = h / 2; dx = 0;
                dy = alternation === 'updown' ? (i % 2 === 0 ? -125 : 125) : alternation === 'same' ? -115 : -(75 + i * 12);
            } else {
                const step = Math.min(spacing, (h - pad * 2) / Math.max(1, anns.length - 1));
                x = w / 2; y = pad + i * step; dy = 0;
                dx = alternation === 'updown' ? (i % 2 === 0 ? -130 : 130) : alternation === 'same' ? 115 : 75 + i * 9;
            }
            return makeAnnotation(a, i, 'timeline', x, y, dx, dy);
        });
    }

    function applyDiamond(anns, opts, w, h) {
        const { size = 145, skew = 18, colOffset = true } = opts;
        const rng = makeRng(13);
        const aspect = w / h;
        const cols = Math.max(2, Math.ceil(Math.sqrt(anns.length * aspect)));
        const rows = Math.ceil(anns.length / cols);
        const marginX = Math.max(80, (w - (cols - 1) * size) / 2);
        const marginY = Math.max(80, (h - (rows - 1) * size) / 2);
        return anns.map((a, i) => {
            const col = i % cols, row = Math.floor(i / cols);
            const offset = colOffset && col % 2 === 1 ? size * 0.5 : 0;
            const x = marginX + col * size + (rng() - 0.5) * skew;
            const y = marginY + row * size + offset + (rng() - 0.5) * skew;
            return makeAnnotation(a, i, 'diamond', x, y, (rng() > 0.5 ? 1 : -1) * (60 + rng() * 50), (rng() > 0.5 ? 1 : -1) * (50 + rng() * 40));
        });
    }

    function applyFlow(anns, opts, w, h) {
        const { amplitude = 150, frequency = 2, phase = 0 } = opts;
        const phRad = phase * Math.PI / 180;
        const n = anns.length, pad = 95;
        return anns.map((a, i) => {
            const t = n > 1 ? i / (n - 1) : 0.5;
            const x = pad + t * (w - pad * 2);
            const y = h / 2 + amplitude * Math.sin(frequency * t * Math.PI * 2 + phRad);
            const gradY = amplitude * frequency * Math.PI * 2 * Math.cos(frequency * t * Math.PI * 2 + phRad);
            const pAngle = Math.atan2(gradY, 1) + Math.PI / 2;
            const dLen = a.importance === 'high' ? 115 : 85;
            const side = i % 2 === 0 ? 1 : -1;
            return makeAnnotation(a, i, 'flow', x, y, Math.cos(pAngle) * dLen * side, Math.sin(pAngle) * dLen * side);
        });
    }

    function applyCluster(anns, opts, w, h) {
        const { clusterCount = 3, jitter = 55 } = opts;
        const rng = makeRng(7);
        const r = Math.min(w, h) * 0.3;
        const centers = Array.from({ length: clusterCount }, (_, c) => {
            const angle = (c / clusterCount) * Math.PI * 2 - Math.PI / 2;
            return { x: w / 2 + r * Math.cos(angle), y: h / 2 + r * Math.sin(angle) };
        });
        return anns.map((a, i) => {
            const ci = i % clusterCount, c = centers[ci];
            const angle = rng() * Math.PI * 2;
            const dist = rng() * jitter;
            const x = c.x + Math.cos(angle) * dist, y = c.y + Math.sin(angle) * dist;
            return makeAnnotation(a, i, 'cluster', x, y, (rng() > 0.5 ? 1 : -1) * (i < clusterCount ? 105 : 70), (rng() > 0.5 ? 1 : -1) * (i < clusterCount ? 75 : 50));
        });
    }

    // ── Pattern dispatcher ───────────────────────────────────────────────────────
function generatePatternPositions(type, count, spacing, centerX, centerY, rotation, randomness) {
    let positions = [];
    const rad = (rotation * Math.PI) / 180;

    switch (type) {
        case 'timelineHorizontal': {
            const startX = centerX - ((count - 1) * spacing) / 2;
            for (let i = 0; i < count; i++) {
                positions.push({ x: startX + i * spacing, y: centerY });
            }
            break;
        }
        case 'timelineVertical': {
            const startY = centerY - ((count - 1) * spacing) / 2;
            for (let i = 0; i < count; i++) {
                positions.push({ x: centerX, y: startY + i * spacing });
            }
            break;
        }
        case 'timelineZigzag': {
            const startY = centerY - ((count - 1) * (spacing * 0.7)) / 2;
            for (let i = 0; i < count; i++) {
                const offsetX = (i % 2 === 0) ? -spacing * 0.8 : spacing * 0.8;
                positions.push({ x: centerX + offsetX, y: startY + i * spacing * 0.7 });
            }
            break;
        }
        case 'timelineSnake': {
            const cols = Math.ceil(Math.sqrt(count * 2));
            const rows = Math.ceil(count / cols);
            const startX = centerX - ((cols - 1) * spacing) / 2;
            const startY = centerY - ((rows - 1) * spacing) / 2;
            let idx = 0;
            for (let r = 0; r < rows && idx < count; r++) {
                for (let c = 0; c < cols && idx < count; c++) {
                    const col = (r % 2 === 0) ? c : (cols - 1 - c);
                    positions.push({ x: startX + col * spacing, y: startY + r * spacing });
                    idx++;
                }
            }
            break;
        }
        case 'timelineCascade': {
            const cascadeStartX = centerX - (count * spacing * 0.3) / 2;
            const cascadeStartY = centerY - (count * spacing * 0.6) / 2;
            for (let i = 0; i < count; i++) {
                positions.push({ x: cascadeStartX + i * spacing * 0.3, y: cascadeStartY + i * spacing * 0.6 });
            }
            break;
        }
        case 'timelineRiver': {
            const riverStartX = centerX - ((count - 1) * spacing * 0.8) / 2;
            const amplitude = spacing * 1.5;
            const frequency = (2 * Math.PI) / Math.max(count - 1, 1);
            for (let i = 0; i < count; i++) {
                positions.push({ x: riverStartX + i * spacing * 0.8, y: centerY + Math.sin(i * frequency) * amplitude });
            }
            break;
        }
        case 'timelineDNA': {
            const dnaStartY = centerY - ((count - 1) * spacing * 0.5) / 2;
            const helixRadius = spacing * 1.2;
            for (let i = 0; i < count; i++) {
                const t = (i / Math.max(count - 1, 1)) * Math.PI * 3;
                const strand = (i % 2 === 0) ? 1 : -1;
                positions.push({ x: centerX + Math.sin(t) * helixRadius * strand, y: dnaStartY + i * spacing * 0.5 });
            }
            break;
        }
        case 'cornellNotes': {
            const totalH = spacing * Math.max(count, 4);
            const totalW = spacing * Math.max(count, 4);
            const leftCol = Math.max(1, Math.round(count * 0.3));
            const rightArea = Math.max(1, Math.round(count * 0.5));
            const bottomStrip = Math.max(1, count - leftCol - rightArea);

            const leftX = centerX - totalW * 0.35;
            const rightX = centerX + totalW * 0.1;
            const topY = centerY - totalH * 0.35;
            const bottomY = centerY + totalH * 0.35;

            let idx = 0;
            for (let i = 0; i < leftCol && idx < count; i++) {
                positions.push({ x: leftX, y: topY + i * (totalH * 0.6 / Math.max(leftCol - 1, 1)) });
                idx++;
            }
            const rCols = Math.ceil(Math.sqrt(rightArea));
            const rRows = Math.ceil(rightArea / rCols);
            for (let r = 0; r < rRows && idx < leftCol + rightArea && idx < count; r++) {
                for (let c = 0; c < rCols && idx < leftCol + rightArea && idx < count; c++) {
                    positions.push({ x: rightX + c * spacing * 0.8, y: topY + r * spacing * 0.8 });
                    idx++;
                }
            }
            for (let i = 0; i < bottomStrip && idx < count; i++) {
                positions.push({ x: centerX - totalW * 0.2 + i * spacing, y: bottomY });
                idx++;
            }
            break;
        }
        case 'mindmapRadial': {
            if (count === 0) break;
            positions.push({ x: centerX, y: centerY });
            const branches = Math.min(count - 1, 8);
            const perBranch = Math.ceil((count - 1) / Math.max(branches, 1));
            let idx = 1;
            for (let b = 0; b < branches && idx < count; b++) {
                const angle = (b / branches) * Math.PI * 2 - Math.PI / 2;
                const bx = centerX + Math.cos(angle) * spacing * 1.5;
                const by = centerY + Math.sin(angle) * spacing * 1.5;
                positions.push({ x: bx, y: by });
                idx++;
                for (let s = 1; s < perBranch && idx < count; s++) {
                    const subAngle = angle + (s - perBranch / 2) * 0.3;
                    positions.push({ x: bx + Math.cos(subAngle) * spacing * 0.8, y: by + Math.sin(subAngle) * spacing * 0.8 });
                    idx++;
                }
            }
            break;
        }
        case 'outlineIndent': {
            const indentStep = spacing * 0.5;
            const lineHeight = spacing * 0.6;
            const outlineStartY = centerY - (count * lineHeight) / 2;
            const outlineStartX = centerX - spacing * 2;
            for (let i = 0; i < count; i++) {
                let depth;
                if (i === 0) depth = 0;
                else if (i % 4 === 0) depth = 0;
                else if (i % 4 === 1) depth = 1;
                else depth = 2;
                positions.push({ x: outlineStartX + depth * indentStep, y: outlineStartY + i * lineHeight });
            }
            break;
        }
        case 'flashcardGrid': {
            const pairs = Math.ceil(count / 2);
            const fcStartX = centerX - spacing * 0.8;
            const fcStartY = centerY - (pairs * spacing * 0.7) / 2;
            for (let i = 0; i < count; i++) {
                const row = Math.floor(i / 2);
                const col = i % 2;
                positions.push({ x: fcStartX + col * spacing * 1.6, y: fcStartY + row * spacing * 0.7 });
            }
            break;
        }
        case 'kwlChart': {
            const kwlCols = 3;
            const perCol = Math.ceil(count / kwlCols);
            const kwlStartX = centerX - spacing * 1.5;
            const kwlStartY = centerY - (perCol * spacing * 0.6) / 2;
            for (let i = 0; i < count; i++) {
                const col = i % kwlCols;
                const row = Math.floor(i / kwlCols);
                positions.push({ x: kwlStartX + col * spacing * 1.5, y: kwlStartY + row * spacing * 0.6 });
            }
            break;
        }
        case 'sqr3Method': {
            const zones = 5;
            const perZone = Math.ceil(count / zones);
            const zoneHeight = spacing * 1.2;
            const sq3StartY = centerY - (zones * zoneHeight) / 2;
            for (let i = 0; i < count; i++) {
                const zone = Math.min(Math.floor(i / perZone), zones - 1);
                const indexInZone = i - zone * perZone;
                const zoneWidth = spacing * 0.8;
                positions.push({ x: centerX + (indexInZone - perZone / 2) * zoneWidth, y: sq3StartY + zone * zoneHeight });
            }
            break;
        }
        case 'conceptMap': {
            const clusterCount = Math.max(2, Math.ceil(count / 4));
            const clusterCenters = [];
            for (let c = 0; c < clusterCount; c++) {
                const angle = (c / clusterCount) * Math.PI * 2;
                clusterCenters.push({ x: centerX + Math.cos(angle) * spacing * 2, y: centerY + Math.sin(angle) * spacing * 2 });
            }
            for (let i = 0; i < count; i++) {
                const cluster = clusterCenters[i % clusterCount];
                const subAngle = ((i / clusterCount) | 0) * 1.2;
                const subDist = spacing * 0.5 * ((i / clusterCount | 0) + 0.5);
                positions.push({ x: cluster.x + Math.cos(subAngle) * subDist, y: cluster.y + Math.sin(subAngle) * subDist });
            }
            break;
        }
        case 'pyramidTop': {
            let row = 0, placed = 0;
            const pyrStartY = centerY - spacing * 2;
            while (placed < count) {
                const itemsInRow = row + 1;
                const rowWidth = itemsInRow * spacing;
                for (let c = 0; c < itemsInRow && placed < count; c++) {
                    positions.push({ x: centerX - rowWidth / 2 + c * spacing + spacing / 2, y: pyrStartY + row * spacing * 0.8 });
                    placed++;
                }
                row++;
            }
            break;
        }
        case 'invertedPyramid': {
            let totalRows = 0, totalItems = 0;
            while (totalItems < count) { totalRows++; totalItems += totalRows; }
            let placed = 0;
            const ipStartY = centerY - (totalRows * spacing * 0.8) / 2;
            for (let r = 0; r < totalRows && placed < count; r++) {
                const itemsInRow = totalRows - r;
                const rowWidth = itemsInRow * spacing;
                for (let c = 0; c < itemsInRow && placed < count; c++) {
                    positions.push({ x: centerX - rowWidth / 2 + c * spacing + spacing / 2, y: ipStartY + r * spacing * 0.8 });
                    placed++;
                }
            }
            break;
        }
        case 'funnelLayout': {
            const funnelRows = Math.ceil(Math.sqrt(count));
            let placed = 0;
            const fStartY = centerY - (funnelRows * spacing * 0.7) / 2;
            for (let r = 0; r < funnelRows && placed < count; r++) {
                const progress = r / Math.max(funnelRows - 1, 1);
                const rowWidth = spacing * (count / funnelRows) * (1 - progress * 0.7);
                const itemsInRow = Math.ceil((count - placed) / (funnelRows - r));
                for (let c = 0; c < itemsInRow && placed < count; c++) {
                    positions.push({ x: centerX - rowWidth / 2 + (c / Math.max(itemsInRow - 1, 1)) * rowWidth, y: fStartY + r * spacing * 0.7 });
                    placed++;
                }
            }
            break;
        }
        case 'diamondRank': {
            const diamondLevels = [1, 2, 3, 3, 2, 1];
            let placed = 0;
            const dStartY = centerY - (diamondLevels.length * spacing * 0.6) / 2;
            for (let r = 0; r < diamondLevels.length && placed < count; r++) {
                const itemsInRow = Math.min(diamondLevels[r % diamondLevels.length], count - placed);
                const rowWidth = itemsInRow * spacing;
                for (let c = 0; c < itemsInRow && placed < count; c++) {
                    positions.push({ x: centerX - rowWidth / 2 + c * spacing + spacing / 2, y: dStartY + r * spacing * 0.6 });
                    placed++;
                }
            }
            break;
        }
        case 'staircase': {
            const stairStartX = centerX - (count * spacing * 0.4) / 2;
            const stairStartY = centerY + (count * spacing * 0.4) / 2;
            for (let i = 0; i < count; i++) {
                positions.push({ x: stairStartX + i * spacing * 0.4, y: stairStartY - i * spacing * 0.4 });
            }
            break;
        }
        case 'waterfallTier': {
            const tierSize = Math.max(2, Math.ceil(Math.sqrt(count)));
            let placed = 0;
            const wStartX = centerX - spacing * 2;
            const wStartY = centerY - (Math.ceil(count / tierSize) * spacing) / 2;
            let tier = 0;
            while (placed < count) {
                const itemsInTier = Math.min(tierSize, count - placed);
                for (let c = 0; c < itemsInTier; c++) {
                    positions.push({ x: wStartX + tier * spacing * 0.3 + c * spacing * 0.8, y: wStartY + tier * spacing });
                    placed++;
                }
                tier++;
            }
            break;
        }
        case 'orgChart': {
            let level = 0, placed = 0;
            const ocStartY = centerY - spacing * 2;
            while (placed < count) {
                const itemsInLevel = Math.pow(2, level);
                const levelWidth = itemsInLevel * spacing;
                for (let c = 0; c < itemsInLevel && placed < count; c++) {
                    positions.push({ x: centerX - levelWidth / 2 + c * spacing + spacing / 2, y: ocStartY + level * spacing * 1.2 });
                    placed++;
                }
                level++;
            }
            break;
        }
        case 'vennDual': {
            const vRadius = spacing * 2;
            const overlap = spacing * 0.8;
            const leftCenter = { x: centerX - overlap, y: centerY };
            const rightCenter = { x: centerX + overlap, y: centerY };
            const third = Math.ceil(count / 3);
            let idx = 0;
            for (let i = 0; i < third && idx < count; i++) {
                const angle = (i / third) * Math.PI * 2;
                positions.push({ x: leftCenter.x - spacing * 0.6 + Math.cos(angle) * vRadius * 0.4, y: leftCenter.y + Math.sin(angle) * vRadius * 0.4 });
                idx++;
            }
            for (let i = 0; i < third && idx < count; i++) {
                const angle = (i / third) * Math.PI * 2;
                positions.push({ x: centerX + Math.cos(angle) * spacing * 0.3, y: centerY + Math.sin(angle) * spacing * 0.3 });
                idx++;
            }
            for (let i = 0; idx < count; i++) {
                const angle = (i / third) * Math.PI * 2;
                positions.push({ x: rightCenter.x + spacing * 0.6 + Math.cos(angle) * vRadius * 0.4, y: rightCenter.y + Math.sin(angle) * vRadius * 0.4 });
                idx++;
            }
            break;
        }
        case 'vennTriple': {
            const v3Radius = spacing * 1.8;
            const v3Centers = [
                { x: centerX, y: centerY - v3Radius * 0.6 },
                { x: centerX - v3Radius * 0.5, y: centerY + v3Radius * 0.4 },
                { x: centerX + v3Radius * 0.5, y: centerY + v3Radius * 0.4 }
            ];
            const quarter = Math.ceil(count / 4);
            let idx = 0;
            for (let c = 0; c < 3; c++) {
                for (let i = 0; i < quarter && idx < count; i++) {
                    const angle = (i / quarter) * Math.PI * 2;
                    const pushDir = Math.atan2(v3Centers[c].y - centerY, v3Centers[c].x - centerX);
                    positions.push({ x: v3Centers[c].x + Math.cos(pushDir) * spacing * 0.3 + Math.cos(angle) * spacing * 0.4, y: v3Centers[c].y + Math.sin(pushDir) * spacing * 0.3 + Math.sin(angle) * spacing * 0.4 });
                    idx++;
                }
            }
            while (idx < count) {
                const angle = (idx / count) * Math.PI * 2;
                positions.push({ x: centerX + Math.cos(angle) * spacing * 0.25, y: centerY + Math.sin(angle) * spacing * 0.25 });
                idx++;
            }
            break;
        }
        case 'tChart': {
            const half = Math.ceil(count / 2);
            const tStartY = centerY - (half * spacing * 0.6) / 2;
            const leftX = centerX - spacing * 1.2;
            const rightX = centerX + spacing * 1.2;
            for (let i = 0; i < count; i++) {
                positions.push({ x: i % 2 === 0 ? leftX : rightX, y: tStartY + Math.floor(i / 2) * spacing * 0.6 });
            }
            break;
        }
        case 'comparisonColumns': {
            const numCols = Math.min(Math.max(2, Math.ceil(Math.sqrt(count))), 5);
            const rowsNeeded = Math.ceil(count / numCols);
            const colWidth = spacing * 1.3;
            const ccStartX = centerX - ((numCols - 1) * colWidth) / 2;
            const ccStartY = centerY - ((rowsNeeded - 1) * spacing * 0.6) / 2;
            for (let i = 0; i < count; i++) {
                positions.push({ x: ccStartX + (i % numCols) * colWidth, y: ccStartY + Math.floor(i / numCols) * spacing * 0.6 });
            }
            break;
        }
        case 'swotGrid': {
            const quadrants = 4;
            const perQuad = Math.ceil(count / quadrants);
            const qOffsets = [{ qx: -1, qy: -1 }, { qx: 1, qy: -1 }, { qx: -1, qy: 1 }, { qx: 1, qy: 1 }];
            let idx = 0;
            for (let q = 0; q < quadrants && idx < count; q++) {
                const qCenterX = centerX + qOffsets[q].qx * spacing * 1.5;
                const qCenterY = centerY + qOffsets[q].qy * spacing * 1.2;
                const subCols = Math.ceil(Math.sqrt(perQuad));
                for (let i = 0; i < perQuad && idx < count; i++) {
                    positions.push({ x: qCenterX + (i % subCols - subCols / 2) * spacing * 0.5, y: qCenterY + (Math.floor(i / subCols) - 0.5) * spacing * 0.5 });
                    idx++;
                }
            }
            break;
        }
        case 'forceField': {
            const half2 = Math.ceil(count / 2);
            const ffStartY = centerY - (half2 * spacing * 0.5) / 2;
            for (let i = 0; i < count; i++) {
                const side = i % 2 === 0 ? -1 : 1;
                const distance = spacing * (1.0 + Math.random() * 0.5);
                positions.push({ x: centerX + side * distance, y: ffStartY + Math.floor(i / 2) * spacing * 0.5 });
            }
            break;
        }
        case 'matrixQuadrant': {
            const gridSize = Math.ceil(Math.sqrt(count));
            const mStartX = centerX - (gridSize * spacing * 0.6) / 2;
            const mStartY = centerY - (gridSize * spacing * 0.6) / 2;
            for (let i = 0; i < count; i++) {
                positions.push({ x: mStartX + (i % gridSize) * spacing * 0.6 + (Math.random() - 0.5) * spacing * 0.15, y: mStartY + Math.floor(i / gridSize) * spacing * 0.6 + (Math.random() - 0.5) * spacing * 0.15 });
            }
            break;
        }
        case 'flowchartLinear': {
            const flStartX = centerX - ((count - 1) * spacing * 1.2) / 2;
            for (let i = 0; i < count; i++) positions.push({ x: flStartX + i * spacing * 1.2, y: centerY });
            break;
        }
        case 'flowchartBranch': {
            if (count === 0) break;
            positions.push({ x: centerX - spacing * 3, y: centerY });
            let level = 1, placed = 1;
            while (placed < count) {
                const nodesInLevel = Math.pow(2, level);
                const levelHeight = nodesInLevel * spacing * 0.6;
                const levelX = centerX - spacing * 3 + level * spacing * 1.5;
                for (let n = 0; n < nodesInLevel && placed < count; n++) {
                    positions.push({ x: levelX, y: centerY - levelHeight / 2 + n * spacing * 0.6 + spacing * 0.3 });
                    placed++;
                }
                level++;
            }
            break;
        }
        case 'swimlane': {
            const lanes = Math.max(2, Math.ceil(Math.sqrt(count / 2)));
            const perLane = Math.ceil(count / lanes);
            const laneHeight = spacing * 1.2;
            const slStartY = centerY - (lanes * laneHeight) / 2;
            const slStartX = centerX - (perLane * spacing * 0.8) / 2;
            let idx = 0;
            for (let lane = 0; lane < lanes && idx < count; lane++) {
                for (let step = 0; step < perLane && idx < count; step++) {
                    positions.push({ x: slStartX + step * spacing * 0.8, y: slStartY + lane * laneHeight + laneHeight / 2 });
                    idx++;
                }
            }
            break;
        }
        case 'cyclicLoop': {
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
                const radius = spacing * Math.max(count / 4, 2);
                positions.push({ x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius });
            }
            break;
        }
        case 'convergeDiverge': {
            const cvHalf = Math.ceil(count / 2);
            const cvStartY = centerY - (count * spacing * 0.4) / 2;
            for (let i = 0; i < count; i++) {
                let xOffset = i < cvHalf ? (1 - i / cvHalf) * spacing * 2 : ((i - cvHalf) / (count - cvHalf)) * spacing * 2;
                positions.push({ x: centerX + (i % 2 === 0 ? -1 : 1) * xOffset, y: cvStartY + i * spacing * 0.4 });
            }
            break;
        }
        case 'pipelineStages': {
            const stages = Math.max(3, Math.ceil(Math.sqrt(count)));
            const perStage = Math.ceil(count / stages);
            const stageWidth = spacing * 1.3;
            const plStartX = centerX - ((stages - 1) * stageWidth) / 2;
            const plStartY = centerY - (perStage * spacing * 0.5) / 2;
            let idx = 0;
            for (let s = 0; s < stages && idx < count; s++) {
                for (let item = 0; item < perStage && idx < count; item++) {
                    positions.push({ x: plStartX + s * stageWidth, y: plStartY + item * spacing * 0.5 });
                    idx++;
                }
            }
            break;
        }
        case 'causeEffect': {
            if (count === 0) break;
            const spineLength = spacing * (count - 1) * 0.5;
            const spineStartX = centerX - spineLength / 2;
            positions.push({ x: centerX + spineLength / 2 + spacing, y: centerY });
            for (let i = 1; i < count; i++) {
                const spineX = spineStartX + (i / (count - 1)) * spineLength;
                positions.push({ x: spineX - spacing * 0.3, y: centerY + (i % 2 === 0 ? -1 : 1) * spacing * (0.8 + (i % 3) * 0.3) });
            }
            break;
        }
        case 'newspaperColumn': {
            const ncCols = Math.min(4, Math.max(2, Math.ceil(count / 3)));
            const perCol = Math.ceil(count / ncCols);
            const colSpacing = spacing * 1.4;
            const ncStartX = centerX - ((ncCols - 1) * colSpacing) / 2;
            const ncStartY = centerY - ((perCol - 1) * spacing * 0.5) / 2;
            let idx = 0;
            for (let c = 0; c < ncCols && idx < count; c++) {
                for (let r = 0; r < perCol && idx < count; r++) {
                    positions.push({ x: ncStartX + c * colSpacing, y: ncStartY + r * spacing * 0.5 });
                    idx++;
                }
            }
            break;
        }
        case 'magazineSpread': {
            if (count === 0) break;
            positions.push({ x: centerX, y: centerY - spacing * 1.5 });
            const secStartX = centerX - spacing * 0.8;
            for (let i = 1; i < Math.min(3, count); i++) {
                positions.push({ x: secStartX + (i - 1) * spacing * 1.6, y: centerY - spacing * 0.2 });
            }
            const gridStartY = centerY - spacing * 0.2 + spacing;
            for (let i = 3; i < count; i++) {
                positions.push({ x: centerX - spacing * 1.2 + ((i - 3) % 3) * spacing * 1.2, y: gridStartY + Math.floor((i - 3) / 3) * spacing * 0.7 });
            }
            break;
        }
        case 'bookSpine': {
            const bsStartY = centerY - (count * spacing * 0.4) / 2;
            for (let i = 0; i < count; i++) {
                positions.push({ x: centerX + Math.sin(i * 1.7) * spacing * 0.3, y: bsStartY + i * spacing * 0.4 });
            }
            break;
        }
        case 'marginNotes': {
            const mainCount = Math.ceil(count * 0.6);
            const marginCount = count - mainCount;
            const mnStartY = centerY - (Math.max(mainCount, marginCount) * spacing * 0.5) / 2;
            for (let i = 0; i < mainCount; i++) positions.push({ x: centerX - spacing * 0.5, y: mnStartY + i * spacing * 0.5 });
            for (let i = 0; i < marginCount; i++) {
                const linkedRow = Math.round((i / marginCount) * (mainCount - 1));
                positions.push({ x: centerX + spacing * 1.5, y: mnStartY + linkedRow * spacing * 0.5 + spacing * 0.1 });
            }
            break;
        }
        case 'annotatedParagraph': {
            const apCols = Math.max(3, Math.ceil(Math.sqrt(count * 1.5)));
            const apStartX = centerX - ((apCols - 1) * spacing * 0.7) / 2;
            const apStartY = centerY - (Math.ceil(count / apCols) * spacing * 0.6) / 2;
            for (let i = 0; i < count; i++) {
                positions.push({ x: apStartX + (i % apCols) * spacing * 0.7, y: apStartY + Math.floor(i / apCols) * spacing * 0.6 + (i % 5 === 3 ? -spacing * 0.3 : 0) });
            }
            break;
        }
        case 'headlineDrill': {
            const levels = [1, 2, 3, Math.max(1, count - 6)];
            let placed = 0;
            const hdStartY = centerY - spacing * 2.5;
            for (let lv = 0; lv < levels.length && placed < count; lv++) {
                const itemsInLevel = Math.min(levels[lv], count - placed);
                const levelWidth = itemsInLevel * spacing * 0.9;
                for (let c = 0; c < itemsInLevel && placed < count; c++) {
                    positions.push({ x: centerX - levelWidth / 2 + c * spacing * 0.9 + spacing * 0.45, y: hdStartY + lv * spacing * 1.2 });
                    placed++;
                }
            }
            break;
        }
        case 'pullQuoteLayout': {
            const pqStartY = centerY - (count * spacing * 0.45) / 2;
            for (let i = 0; i < count; i++) {
                positions.push({ x: i % 4 === 2 ? centerX + spacing * 1.5 : centerX - spacing * 0.3, y: pqStartY + i * spacing * 0.45 });
            }
            break;
        }
        case 'memoryPalace': {
            const roomW = spacing * 4, roomH = spacing * 3;
            const perimeter = 2 * (roomW + roomH);
            const perimeterCount = Math.min(count, Math.max(count - 2, 4));
            const centerCount = count - perimeterCount;
            for (let i = 0; i < perimeterCount; i++) {
                const t = (i / perimeterCount) * perimeter;
                let px, py;
                if (t < roomW) { px = centerX - roomW / 2 + t; py = centerY - roomH / 2; }
                else if (t < roomW + roomH) { px = centerX + roomW / 2; py = centerY - roomH / 2 + (t - roomW); }
                else if (t < 2 * roomW + roomH) { px = centerX + roomW / 2 - (t - roomW - roomH); py = centerY + roomH / 2; }
                else { px = centerX - roomW / 2; py = centerY + roomH / 2 - (t - 2 * roomW - roomH); }
                positions.push({ x: px, y: py });
            }
            for (let i = 0; i < centerCount; i++) positions.push({ x: centerX + (i - centerCount / 2) * spacing * 0.6, y: centerY });
            break;
        }
        case 'isometricShelves': {
            const shelfCols = Math.max(3, Math.ceil(Math.sqrt(count)));
            const shelfRows = Math.ceil(count / shelfCols);
            const isStartX = centerX - (shelfCols * spacing * 0.6) / 2;
            const isStartY = centerY - (shelfRows * spacing * 0.8) / 2;
            let idx = 0;
            for (let r = 0; r < shelfRows && idx < count; r++) {
                for (let c = 0; c < shelfCols && idx < count; c++) {
                    positions.push({ x: isStartX + c * spacing * 0.6 + r * spacing * 0.25, y: isStartY + r * spacing * 0.8 - c * spacing * 0.05 });
                    idx++;
                }
            }
            break;
        }
        case 'galaxyCluster': {
            for (let i = 0; i < count; i++) {
                const t = i / count;
                const armAngle = t * Math.PI * 4 + (i % 3) * Math.PI * 2 / 3;
                const dist = spacing * (0.5 + t * 3);
                const scatter = spacing * 0.3 * Math.random();
                positions.push({ x: centerX + Math.cos(armAngle) * dist + (Math.random() - 0.5) * scatter, y: centerY + Math.sin(armAngle) * dist + (Math.random() - 0.5) * scatter });
            }
            break;
        }
        case 'archipelago': {
            const islandCount = Math.max(2, Math.ceil(count / 4));
            const islandCenters = [];
            for (let ic = 0; ic < islandCount; ic++) {
                const angle = (ic / islandCount) * Math.PI * 2 + Math.PI / 6;
                const dist = spacing * 2.5;
                islandCenters.push({ x: centerX + Math.cos(angle) * dist * (0.6 + Math.random() * 0.4), y: centerY + Math.sin(angle) * dist * (0.6 + Math.random() * 0.4) });
            }
            for (let i = 0; i < count; i++) {
                const island = islandCenters[i % islandCount];
                const localAngle = ((i / islandCount) | 0) * 1.8 + i * 0.5;
                const localDist = spacing * 0.3 * (1 + ((i / islandCount) | 0) * 0.4);
                positions.push({ x: island.x + Math.cos(localAngle) * localDist, y: island.y + Math.sin(localAngle) * localDist });
            }
            break;
        }
        case 'metroMap': {
            const lines = Math.min(3, Math.max(2, Math.ceil(count / 5)));
            const perLine = Math.ceil(count / lines);
            const lineConfigs = [
                { startX: centerX - spacing * 3, startY: centerY - spacing, dirX: 1, dirY: 0.2 },
                { startX: centerX - spacing * 2, startY: centerY + spacing, dirX: 1, dirY: -0.15 },
                { startX: centerX - spacing * 1, startY: centerY - spacing * 2, dirX: 0.3, dirY: 1 }
            ];
            let idx = 0;
            for (let l = 0; l < lines && idx < count; l++) {
                const cfg = lineConfigs[l % lineConfigs.length];
                for (let s = 0; s < perLine && idx < count; s++) {
                    positions.push({ x: cfg.startX + s * spacing * 0.8 * cfg.dirX, y: cfg.startY + s * spacing * 0.8 * cfg.dirY });
                    idx++;
                }
            }
            break;
        }
        case 'chessboard': {
            const boardSize = Math.ceil(Math.sqrt(count));
            const cellSize = spacing * 0.7;
            const cbStartX = centerX - (boardSize * cellSize) / 2;
            const cbStartY = centerY - (boardSize * cellSize) / 2;
            let idx = 0;
            for (let r = 0; r < boardSize && idx < count; r++) {
                for (let c = 0; c < boardSize && idx < count; c++) {
                    if ((r + c) % 2 === 0) { positions.push({ x: cbStartX + c * cellSize + cellSize / 2, y: cbStartY + r * cellSize + cellSize / 2 }); idx++; }
                }
            }
            for (let r = 0; r < boardSize && idx < count; r++) {
                for (let c = 0; c < boardSize && idx < count; c++) {
                    if ((r + c) % 2 === 1) { positions.push({ x: cbStartX + c * cellSize + cellSize / 2, y: cbStartY + r * cellSize + cellSize / 2 }); idx++; }
                }
            }
            break;
        }
        case 'brickWall': {
            const bwCols = Math.max(3, Math.ceil(Math.sqrt(count * 1.5)));
            const bwRows = Math.ceil(count / bwCols);
            const bwStartX = centerX - ((bwCols - 1) * spacing * 0.7) / 2;
            const bwStartY = centerY - ((bwRows - 1) * spacing * 0.5) / 2;
            let idx = 0;
            for (let r = 0; r < bwRows && idx < count; r++) {
                const offset = (r % 2 === 0) ? 0 : spacing * 0.35;
                for (let c = 0; c < bwCols && idx < count; c++) {
                    positions.push({ x: bwStartX + c * spacing * 0.7 + offset, y: bwStartY + r * spacing * 0.5 });
                    idx++;
                }
            }
            break;
        }
        case 'barChartLayout': {
            const barWidth = spacing * 0.7;
            const barStartX = centerX - ((count - 1) * barWidth) / 2;
            const baseline = centerY + spacing * 2;
            for (let i = 0; i < count; i++) {
                const heightFactor = 0.3 + (Math.sin(i * 0.8 + 1) * 0.5 + 0.5) * 0.7;
                positions.push({ x: barStartX + i * barWidth, y: baseline - spacing * 4 * heightFactor });
            }
            break;
        }
        case 'bubbleChart': {
            for (let i = 0; i < count; i++) {
                const weight = 1 - (i / count);
                const dist = spacing * (0.5 + (1 - weight) * 2.5);
                const angle = (i / count) * Math.PI * 2 + Math.sin(i) * 0.5;
                positions.push({ x: centerX + Math.cos(angle) * dist + Math.sin(i * 3.7) * spacing * 0.3, y: centerY + Math.sin(angle) * dist + Math.cos(i * 2.3) * spacing * 0.3 });
            }
            break;
        }
        case 'scatterPlot': {
            const scatterW = spacing * 5, scatterH = spacing * 4;
            const scStartX = centerX - scatterW / 2, scStartY = centerY - scatterH / 2;
            for (let i = 0; i < count; i++) {
                const px = ((Math.sin(i * 12.9898 + 78.233) * 43758.5453) % 1 + 1) % 1;
                const py = ((Math.sin(i * 78.233 + 12.9898) * 23421.6312) % 1 + 1) % 1;
                positions.push({ x: scStartX + px * scatterW, y: scStartY + py * scatterH });
            }
            break;
        }
        case 'radarWeb': {
            const axes = Math.max(3, Math.min(count, 8));
            const rings = Math.max(1, Math.ceil(count / axes));
            let idx = 0;
            for (let ring = 1; ring <= rings && idx < count; ring++) {
                const ringRadius = (ring / rings) * spacing * 3;
                const itemsInRing = Math.min(axes, count - idx);
                for (let a = 0; a < itemsInRing && idx < count; a++) {
                    const angle = (a / axes) * Math.PI * 2 - Math.PI / 2;
                    positions.push({ x: centerX + Math.cos(angle) * ringRadius, y: centerY + Math.sin(angle) * ringRadius });
                    idx++;
                }
            }
            while (idx < count) {
                const angle = (idx / count) * Math.PI * 2;
                positions.push({ x: centerX + Math.cos(angle) * spacing * 0.3, y: centerY + Math.sin(angle) * spacing * 0.3 });
                idx++;
            }
            break;
        }
        case 'sankeyFlow': {
            const perColumn = [Math.max(1, Math.round(count * 0.35)), Math.max(1, Math.round(count * 0.30)), 0];
            perColumn[2] = Math.max(1, count - perColumn[0] - perColumn[1]);
            const sankeyColSpacing = spacing * 2.5;
            const sankeyStartX = centerX - sankeyColSpacing;
            let idx = 0;
            for (let col = 0; col < 3; col++) {
                const colItemCount = perColumn[col];
                const colStartY = centerY - (colItemCount * spacing * 0.7) / 2;
                for (let item = 0; item < colItemCount && idx < count; item++) {
                    const verticalShift = col === 1 ? Math.sin(item * 2.1) * spacing * 0.2 : 0;
                    positions.push({ x: sankeyStartX + col * sankeyColSpacing, y: colStartY + item * spacing * 0.7 + verticalShift });
                    idx++;
                }
            }
            break;
        }
        case 'treemapNested': {
            const tmW = spacing * 5, tmH = spacing * 4;
            let remainingArea = { x: centerX - tmW / 2, y: centerY - tmH / 2, w: tmW, h: tmH };
            for (let i = 0; i < count; i++) {
                const fraction = 1 / Math.max(count - i, 1);
                if (remainingArea.w >= remainingArea.h) {
                    const sliceW = remainingArea.w * Math.max(fraction, 0.15);
                    positions.push({ x: remainingArea.x + sliceW / 2, y: remainingArea.y + remainingArea.h / 2 });
                    remainingArea = { x: remainingArea.x + sliceW, y: remainingArea.y, w: remainingArea.w - sliceW, h: remainingArea.h };
                } else {
                    const sliceH = remainingArea.h * Math.max(fraction, 0.15);
                    positions.push({ x: remainingArea.x + remainingArea.w / 2, y: remainingArea.y + sliceH / 2 });
                    remainingArea = { x: remainingArea.x, y: remainingArea.y + sliceH, w: remainingArea.w, h: remainingArea.h - sliceH };
                }
            }
            break;
        }
        case 'gaugeArc': {
            const gaugeRadius = spacing * 3;
            for (let i = 0; i < count; i++) {
                const angle = Math.PI + (count === 1 ? 0.5 : i / (count - 1)) * (-Math.PI);
                positions.push({ x: centerX + Math.cos(angle) * gaugeRadius, y: centerY - Math.sin(angle) * gaugeRadius });
            }
            break;
        }
    }

    if (rotation !== 0 || randomness > 0) {
        positions = positions.map(pos => {
            let { x, y } = pos;
            if (rotation !== 0) {
                const dx = x - centerX, dy = y - centerY;
                x = centerX + dx * Math.cos(rad) - dy * Math.sin(rad);
                y = centerY + dx * Math.sin(rad) + dy * Math.cos(rad);
            }
            if (randomness > 0) {
                const jitterAmount = (randomness / 100) * spacing * 0.5;
                x += (Math.random() - 0.5) * 2 * jitterAmount;
                y += (Math.random() - 0.5) * 2 * jitterAmount;
            }
            return { x, y };
        });
    }
    return positions;
}

    const PATTERN_FN = {
        grid: applyGrid, radial: applyRadial, spiral: applySpiral,
        clock: applyClock, circle: applyCircle, fibonacci: applyFibonacci,
        hexagonal: applyHexagonal, voronoi: applyVoronoi, mandala: applyMandala,
        molecular: applyMolecular, radialHub: applyRadialHub, tree: applyTree,
        concentric: applyConcentric, archSpiral: applyArchSpiral,
        solarSystem: applySolarSystem, timeline: applyTimeline,
        diamond: applyDiamond, flow: applyFlow, cluster: applyCluster,
    };

    function applyPattern(anns, type, opts, w, h) {
        let result;
        if (PATTERN_FN[type]) {
            result = PATTERN_FN[type](anns, opts, w, h);
        } else {
            const spacing = opts.spacing || parseInt(document.getElementById('pattern-spacing')?.value) || 120;
            const rotation = parseInt(document.getElementById('pattern-rotation')?.value) || 0;
            const randomness = parseInt(document.getElementById('pattern-randomness')?.value) || 0;
            
            const positions = generatePatternPositions(type, anns.length, spacing, w/2, h/2, rotation, randomness);
            
            result = anns.map((a, i) => {
                const pos = positions[i] || { x: w/2, y: h/2 };
                const dx = (Math.random() > 0.5 ? 1 : -1) * (60 + Math.random() * 40);
                const dy = (Math.random() > 0.5 ? 1 : -1) * (50 + Math.random() * 40);
                return makeAnnotation(a, i, 'callout', pos.x, pos.y, dx, dy);
            });
        }

        // Auto-center on canvas
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        result.forEach(a => {
            if (a.x < minX) minX = a.x; if (a.x > maxX) maxX = a.x;
            if (a.y < minY) minY = a.y; if (a.y > maxY) maxY = a.y;
        });
        if (minX !== Infinity) {
            const shiftX = w / 2 - (minX + maxX) / 2;
            const shiftY = h / 2 - (minY + maxY) / 2;
            result = result.map(a => ({ ...a, x: a.x + shiftX, y: a.y + shiftY }));
        }

        // Canvas-clamp with padding
        const PAD = 55;
        result = result.map(a => ({
            ...a,
            x: Math.max(PAD, Math.min(w - PAD, a.x)),
            y: Math.max(PAD, Math.min(h - PAD, a.y))
        }));

        return result;
    }

    // ── Collision resolver (spatial hash + force repulsion) ──────────────────────
    function resolveCollisions(anns, minDist, iterations, w, h) {
        if (anns.length < 2) return anns;
        const ALLOWED = new Set([
            'annotationBadge|annotationCallout', 'annotationBadge|annotationCalloutElbow',
            'annotationBadge|annotationCalloutCurve', 'annotationBadge|annotationCalloutCircle',
            'annotationBadge|annotationCalloutRect', 'annotationBadge|annotationLabel',
            'annotationXYThreshold|annotationCallout', 'annotationXYThreshold|annotationLabel',
        ]);
        function canOverlap(a, b) {
            return ALLOWED.has(`${a}|${b}`) || ALLOWED.has(`${b}|${a}`);
        }

        const pos = anns.map(a => ({ x: a.x, y: a.y }));

        for (let iter = 0; iter < iterations; iter++) {
            let moved = false;
            for (let i = 0; i < pos.length; i++) {
                for (let j = i + 1; j < pos.length; j++) {
                    if (canOverlap(anns[i].typeKey, anns[j].typeKey)) continue;
                    const dx = pos[i].x - pos[j].x, dy = pos[i].y - pos[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < minDist && dist > 0.01) {
                        const overlap = (minDist - dist) / 2;
                        const nx = (dx / dist) * overlap, ny = (dy / dist) * overlap;
                        pos[i].x += nx; pos[i].y += ny;
                        pos[j].x -= nx; pos[j].y -= ny;
                        moved = true;
                    }
                }
            }
            const PAD = 55;
            pos.forEach(p => {
                p.x = Math.max(PAD, Math.min(w - PAD, p.x));
                p.y = Math.max(PAD, Math.min(h - PAD, p.y));
            });
            if (!moved) break;
        }

        return anns.map((a, i) => ({
            ...a,
            x: Math.round(pos[i].x * 10) / 10,
            y: Math.round(pos[i].y * 10) / 10
        }));
    }

    // ── DEFAULT OPTIONS per pattern ──────────────────────────────────────────────
    const DEFAULT_OPTS = {
        grid:        { columns: 4, rowSpacing: 220, colSpacing: 250, offsetRows: false },
        radial:      { radius: 260, angleStart: 0, spread: 1.0 },
        spiral:      { tightness: 20, growthRate: 12, clockwise: true },
        clock:       { radius: 200, rotation: 0 },
        circle:      { radius: 240, randomness: 0 },
        fibonacci:   { scaleVariation: 20, spread: 25 },
        hexagonal:   { spacing: 145, size: 60 },
        voronoi:     { cellSpread: 140, randomness: 50 },
        mandala:     { layers: 3, symmetry: 8 },
        molecular:   { bondLength: 115, branches: 3 },
        radialHub:   { radius: 260, spokes: 8 },
        tree:        { spacingX: 175, spacingY: 145 },
        concentric:  { rings: 3, spacing: 115 },
        archSpiral:  { tightness: 15, spacing: 30 },
        solarSystem: { orbits: 4, scaleVariation: 30 },
        timeline:    { direction: 'horizontal', spacing: 155, alternation: 'updown' },
        diamond:     { size: 145, skew: 18, colOffset: true },
        flow:        { amplitude: 150, frequency: 2, phase: 0 },
        cluster:     { clusterCount: 3, jitter: 55 },
    };

    // ── PATTERN-SPECIFIC PARAMETER UI definitions ────────────────────────────────
    const PATTERN_PARAMS_UI = {
        grid: [
            { id: 'pe_columns', label: 'Columns', type: 'number', default: 4, min: 1, max: 20, key: 'columns' },
            { id: 'pe_rowSpacing', label: 'Row Spacing', type: 'number', default: 220, min: 50, max: 500, key: 'rowSpacing' },
            { id: 'pe_colSpacing', label: 'Col Spacing', type: 'number', default: 250, min: 50, max: 500, key: 'colSpacing' },
            { id: 'pe_offsetRows', label: 'Offset Rows', type: 'checkbox', default: false, key: 'offsetRows' },
        ],
        radial: [
            { id: 'pe_radius', label: 'Radius (px)', type: 'number', default: 260, min: 50, max: 800, key: 'radius' },
            { id: 'pe_angleStart', label: 'Start Angle°', type: 'range', default: 0, min: 0, max: 360, key: 'angleStart' },
            { id: 'pe_spread', label: 'Arc Spread', type: 'range', default: 100, min: 10, max: 100, key: 'spread', scale: 0.01 },
        ],
        spiral: [
            { id: 'pe_tightness', label: 'Center Offset', type: 'number', default: 20, min: 0, max: 200, key: 'tightness' },
            { id: 'pe_growthRate', label: 'Growth Rate', type: 'range', default: 12, min: 1, max: 50, key: 'growthRate' },
            { id: 'pe_clockwise', label: 'Clockwise', type: 'checkbox', default: true, key: 'clockwise' },
        ],
        clock: [
            { id: 'pe_radius', label: 'Radius (px)', type: 'number', default: 200, min: 50, max: 600, key: 'radius' },
            { id: 'pe_rotation', label: 'Rotation°', type: 'range', default: 0, min: 0, max: 360, key: 'rotation' },
        ],
        circle: [
            { id: 'pe_radius', label: 'Radius (px)', type: 'number', default: 240, min: 50, max: 800, key: 'radius' },
            { id: 'pe_randomness', label: 'Randomness', type: 'range', default: 0, min: 0, max: 200, key: 'randomness' },
        ],
        fibonacci: [
            { id: 'pe_spread', label: 'Spread', type: 'number', default: 25, min: 5, max: 100, key: 'spread' },
            { id: 'pe_scaleVariation', label: 'Scale Var.', type: 'range', default: 20, min: 0, max: 100, key: 'scaleVariation' },
        ],
        hexagonal: [
            { id: 'pe_spacing', label: 'Hex Spacing', type: 'number', default: 145, min: 50, max: 400, key: 'spacing' },
            { id: 'pe_size', label: 'Connector Len', type: 'number', default: 60, min: 10, max: 200, key: 'size' },
        ],
        voronoi: [
            { id: 'pe_cellSpread', label: 'Cell Spread', type: 'number', default: 140, min: 30, max: 500, key: 'cellSpread' },
            { id: 'pe_randomness', label: 'Randomness', type: 'range', default: 50, min: 0, max: 200, key: 'randomness' },
        ],
        mandala: [
            { id: 'pe_layers', label: 'Layers', type: 'number', default: 3, min: 1, max: 8, key: 'layers' },
            { id: 'pe_symmetry', label: 'Symmetry (N)', type: 'number', default: 8, min: 3, max: 24, key: 'symmetry' },
        ],
        molecular: [
            { id: 'pe_bondLength', label: 'Bond Length', type: 'number', default: 115, min: 40, max: 300, key: 'bondLength' },
            { id: 'pe_branches', label: 'Branches', type: 'number', default: 3, min: 2, max: 8, key: 'branches' },
        ],
        radialHub: [
            { id: 'pe_radius', label: 'Orbit Radius', type: 'number', default: 260, min: 80, max: 700, key: 'radius' },
            { id: 'pe_spokes', label: 'Spokes', type: 'number', default: 8, min: 2, max: 24, key: 'spokes' },
        ],
        tree: [
            { id: 'pe_spacingX', label: 'H Spacing', type: 'number', default: 175, min: 50, max: 400, key: 'spacingX' },
            { id: 'pe_spacingY', label: 'V Spacing', type: 'number', default: 145, min: 50, max: 400, key: 'spacingY' },
        ],
        concentric: [
            { id: 'pe_rings', label: 'Rings', type: 'number', default: 3, min: 1, max: 10, key: 'rings' },
            { id: 'pe_spacing', label: 'Ring Spacing', type: 'number', default: 115, min: 40, max: 400, key: 'spacing' },
        ],
        archSpiral: [
            { id: 'pe_tightness', label: 'Center Gap', type: 'number', default: 15, min: 0, max: 100, key: 'tightness' },
            { id: 'pe_spacing', label: 'Spacing', type: 'number', default: 30, min: 5, max: 100, key: 'spacing' },
        ],
        solarSystem: [
            { id: 'pe_orbits', label: 'Orbit Count', type: 'number', default: 4, min: 1, max: 10, key: 'orbits' },
            { id: 'pe_scaleVariation', label: 'Orbit Jitter', type: 'range', default: 30, min: 0, max: 120, key: 'scaleVariation' },
        ],
        timeline: [
            {
                id: 'pe_direction', label: 'Direction', type: 'select', default: 'horizontal', key: 'direction',
                options: [{ value: 'horizontal', label: 'Horizontal' }, { value: 'vertical', label: 'Vertical' }]
            },
            { id: 'pe_spacing', label: 'Item Spacing', type: 'number', default: 155, min: 40, max: 600, key: 'spacing' },
            {
                id: 'pe_alternation', label: 'Alternation', type: 'select', default: 'updown', key: 'alternation',
                options: [{ value: 'updown', label: 'Up/Down' }, { value: 'same', label: 'Same Side' }, { value: 'stagger', label: 'Stagger' }]
            },
        ],
        diamond: [
            { id: 'pe_size', label: 'Cell Size', type: 'number', default: 145, min: 40, max: 400, key: 'size' },
            { id: 'pe_skew', label: 'Skew Jitter', type: 'range', default: 18, min: 0, max: 100, key: 'skew' },
            { id: 'pe_colOffset', label: 'Col Offset', type: 'checkbox', default: true, key: 'colOffset' },
        ],
        flow: [
            { id: 'pe_amplitude', label: 'Wave Height', type: 'number', default: 150, min: 20, max: 400, key: 'amplitude' },
            { id: 'pe_frequency', label: 'Frequency', type: 'range', default: 2, min: 1, max: 8, key: 'frequency' },
            { id: 'pe_phase', label: 'Phase°', type: 'range', default: 0, min: 0, max: 360, key: 'phase' },
        ],
        cluster: [
            { id: 'pe_clusterCount', label: 'Clusters', type: 'number', default: 3, min: 1, max: 12, key: 'clusterCount' },
            { id: 'pe_jitter', label: 'Jitter Radius', type: 'range', default: 55, min: 0, max: 200, key: 'jitter' },
        ],
    };

    // ── Bullet point conversion for note labels ──────────────────────────────────
    const BULLET_PRESETS = {
        '• ': '• ', '▸ ': '▸ ', '→ ': '→ ', '◆ ': '◆ ',
        '✓ ': '✓ ', '★ ': '★ ', '– ': '– ', '❯ ': '❯ '
    };
    function convertBullets(text, bulletStyle) {
        if (!text) return text;

        // Smart formatting: if text is one massive dense string without newlines, split by punctuation
        if (!text.includes('\n')) {
            const parts = text.split(/(?<=[.,!?;])\s+(?=[A-Z])/); // Split at punctuation followed by space and Capital
            if (parts.length === 1) {
                // simple fallback if no capitals, just split at comma/period
                text = text.split(/[,.]\s+(?!\s)/).filter(Boolean).join('\n');
            } else {
                text = parts.join('\n');
            }
        }

        // Replace existing bullets or prepend to raw lines
        return text.split('\n').map(line => {
            if (!line.trim()) return line;
            const m = line.match(/^(\s*)([-*•▸→◆✓★–❯]\s)/);
            if (m) return m[1] + bulletStyle + line.slice(m[1].length + m[2].length);
            return bulletStyle + line.trim();
        }).join('\n');
    }

    // ── MAIN INIT ────────────────────────────────────────────────────────────────
    function initPatternEngine() {
        const AS = window.AppStore;

        // ── _patchMultiSelect: bridge for Select All / Deselect All ───────────────
        window._patchMultiSelect = function(ids) {
            const idSet = new Set(ids.map(Number));
            // Apply multi-selected class directly after render
            setTimeout(() => {
                document.querySelectorAll('.ann-group').forEach(el => {
                    const id = parseInt(el.dataset.id);
                    if (idSet.has(id)) el.classList.add('multi-selected');
                    else el.classList.remove('multi-selected');
                });
                // Update selection info bar
                const info = document.getElementById('selectionInfo');
                if (info) {
                    if (idSet.size > 0) {
                        info.innerHTML = `<span style="color:var(--accent)">${idSet.size} annotations multi-selected</span>`;
                    } else {
                        info.innerHTML = '<span class="no-selection">No annotation selected</span>';
                    }
                }
                // Show/hide bulk type panel
                const panel = document.getElementById('bulkTypePanel');
                if (panel) panel.style.display = idSet.size > 0 ? 'block' : 'none';
            }, 80);
        };

        // ── BUILD PATTERN ENGINE UI (inject into sidebar panel) ──────────────────
        buildPatternUI();

        // ── BUILD BULLET EDITOR UI ────────────────────────────────────────────────
        buildBulletUI();

        // ── Wire "Resolve Collisions" button ──────────────────────────────────────
        const btnResolve = document.getElementById('btnResolveCollide');
        if (btnResolve) {
            btnResolve.addEventListener('click', () => {
                AS.captureState();
                const anns = AS.getAnnotations();
                const cs = AS.getCanvasSettings();
                const w = cs.customWidth || document.getElementById('canvas').clientWidth || 800;
                const h = cs.customHeight || document.getElementById('canvas').clientHeight || 500;
                const minDist = parseInt(document.getElementById('pe_collide_minDist').value) || 140;
                const iters = parseInt(document.getElementById('pe_collide_iters').value) || 60;
                const resolved = resolveCollisions(anns, minDist, iters, w, h);
                AS.setAnnotations(resolved);
                AS.render();
                AS.showToast(`Collisions resolved — ${anns.length} annotations spread.`);
            });
        }

        // ── Wire "Generate Layout" button ─────────────────────────────────────────
        const btnGenerate = document.getElementById('btnGeneratePattern');
        if (btnGenerate) {
            btnGenerate.addEventListener('click', () => {
                generatePattern();
            });
        }

        // ── Update pattern-specific params on pattern-type change ─────────────────
        const patternType = document.getElementById('pattern-type');
        if (patternType) {
            patternType.addEventListener('change', updatePatternSpecificUI);
            updatePatternSpecificUI();
        }

        // ── Wire Apply-All buttons (bulk property broadcast) ──────────────────────
        wireBulkApplyButtons();

        // ── Wire Thread Slicer count control ──────────────────────────────────────
        const sliceCount = document.getElementById('threadSliceCount');
        if (sliceCount) {
            sliceCount.addEventListener('change', updateSliceOffsetUI);
            updateSliceOffsetUI();
        }

        AS.showToast('Pattern Engine ready — 19 patterns loaded ✓', 2500);
    }

    // ── Generate Pattern ─────────────────────────────────────────────────────────
    function generatePattern() {
        const AS = window.AppStore;
        const type = document.getElementById('pattern-type').value;
        const count = parseInt(document.getElementById('pattern-count').value) || 12;
        const rotation = parseInt(document.getElementById('pattern-rotation').value) || 0;
        const randomness = parseInt(document.getElementById('pattern-randomness').value) || 0;

        // Gather pattern-specific opts
        const opts = { ...DEFAULT_OPTS[type] };
        const paramDefs = PATTERN_PARAMS_UI[type] || [];
        paramDefs.forEach(def => {
            const el = document.getElementById(def.id);
            if (!el) return;
            if (def.type === 'checkbox') opts[def.key] = el.checked;
            else if (def.type === 'select') opts[def.key] = el.value;
            else {
                let v = parseFloat(el.value);
                if (def.scale) v = v * def.scale;
                opts[def.key] = v;
            }
        });

        // Build blank annotation templates
        const templates = Array.from({ length: count }, (_, i) => ({
            title: 'Item ' + (i + 1),
            label: '',
            importance: i === 0 ? 'high' : (i % 5 === 0 ? 'medium' : 'low'),
        }));

        const cs = AS.getCanvasSettings();
        const svgEl = document.getElementById('canvas');
        const w = cs.customWidth || svgEl.clientWidth || 800;
        const h = cs.customHeight || svgEl.clientHeight || 500;

        // Apply randomness as scatter
        opts._randomness = randomness / 100;
        opts._rotation = rotation;

        AS.captureState();

        let arranged = applyPattern(templates, type, opts, w, h);

        // Apply global rotation offset if set
        if (rotation !== 0) {
            const cx = w / 2, cy = h / 2;
            const rad = rotation * Math.PI / 180;
            arranged = arranged.map(a => {
                const dx = a.x - cx, dy = a.y - cy;
                return {
                    ...a,
                    x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
                    y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
                };
            });
        }

        // Apply scatter randomness
        if (randomness > 0) {
            const rng = makeRng(Date.now() & 0xffff);
            const jitter = randomness * w * 0.002;
            arranged = arranged.map(a => ({
                ...a,
                x: Math.max(55, Math.min(w - 55, a.x + (rng() - 0.5) * jitter)),
                y: Math.max(55, Math.min(h - 55, a.y + (rng() - 0.5) * jitter)),
            }));
        }

        // Auto-resolve collisions if enabled
        const autoCollide = document.getElementById('pe_autoCollide');
        if (autoCollide && autoCollide.checked) {
            const minDist = parseInt(document.getElementById('pe_collide_minDist').value) || 140;
            arranged = resolveCollisions(arranged, minDist, 60, w, h);
        }

        // Assign unique IDs and merge
        let idCounter = AS.getIdCounter();
        arranged = arranged.map(a => {
            idCounter++;
            return { ...a, id: idCounter };
        });
        AS.setIdCounter(idCounter);

        const existing = AS.getAnnotations();
        const replaceMode = document.getElementById('pe_replaceMode');
        AS.setAnnotations(replaceMode && replaceMode.checked ? arranged : [...existing, ...arranged]);
        AS.render();
        AS.showToast(`Generated ${count}-node "${type}" pattern ✓`);
    }

    // ── Build Pattern Engine Sidebar UI ─────────────────────────────────────────
    function buildPatternUI() {
        const panel = document.getElementById('patterns-section');
        if (!panel) return;

        const body = panel.querySelector('.panel-body') || panel;

        // Collision controls row (persistent)
        const collideRow = document.createElement('div');
        collideRow.style.cssText = 'margin-top:8px; padding:6px; background:rgba(232,51,109,0.08); border-radius:6px; border:1px solid rgba(232,51,109,0.2);';
        collideRow.innerHTML = `
            <div class="field-label" style="color:#E8336D; margin-bottom:4px;">⚡ Collision Settings</div>
            <div class="num-row" style="margin-bottom:4px;">
                <div class="field"><label>Min Dist</label><input id="pe_collide_minDist" type="number" value="140" min="30" max="500" class="small-input" title="Minimum distance between annotation subjects"/></div>
                <div class="field"><label>Iterations</label><input id="pe_collide_iters" type="number" value="60" min="5" max="300" class="small-input" title="Solver passes — more = slower but cleaner"/></div>
            </div>
            <div class="checkbox-row">
                <label class="cb-label"><input type="checkbox" id="pe_autoCollide" checked /> Auto-resolve collisions on Generate</label>
            </div>`;
        body.appendChild(collideRow);

        // Pattern-specific params container (already in HTML or create one)
        let specificContainer = document.getElementById('pe_specific');
        if (!specificContainer) {
            specificContainer = document.createElement('div');
            specificContainer.id = 'pe_specific';
            specificContainer.style.cssText = 'margin-top:6px; padding:5px 0;';
            body.appendChild(specificContainer);
        }

        // Replace / Append mode toggle
        const modeRow = document.createElement('div');
        modeRow.className = 'checkbox-row';
        modeRow.style.cssText = 'margin-top:5px;';
        modeRow.innerHTML = `<label class="cb-label"><input type="checkbox" id="pe_replaceMode" /> Replace existing annotations on Generate</label>`;
        body.appendChild(modeRow);

        // Thread slicer extended controls
        buildSlicerUI();
    }

    // ── Pattern-specific param UI (dynamic render) ───────────────────────────────
    function updatePatternSpecificUI() {
        const type = document.getElementById('pattern-type').value;
        const container = document.getElementById('pe_specific');
        if (!container) return;

        const defs = PATTERN_PARAMS_UI[type] || [];
        if (defs.length === 0) { container.innerHTML = ''; return; }

        let html = `<div class="field-label" style="margin-bottom:4px; opacity:0.7;">Pattern Options</div>`;

        defs.forEach(def => {
            if (def.type === 'checkbox') {
                html += `<div class="checkbox-row"><label class="cb-label"><input type="checkbox" id="${def.id}" ${def.default ? 'checked' : ''}/> ${def.label}</label></div>`;
            } else if (def.type === 'select') {
                const opts = def.options.map(o => `<option value="${o.value}"${o.value === def.default ? ' selected' : ''}>${o.label}</option>`).join('');
                html += `<div class="field-label" style="margin:3px 0 1px;">${def.label}</div><select id="${def.id}" class="select-input" style="width:100%; margin-bottom:4px;">${opts}</select>`;
            } else if (def.type === 'range') {
                html += `<div class="slider-row"><span class="option-label">${def.label}</span><input type="range" id="${def.id}" min="${def.min}" max="${def.max}" value="${def.default}"><span class="slider-val" id="${def.id}_val">${def.default}</span></div>`;
            } else {
                html += `<div class="num-row" style="margin-bottom:3px;"><div class="field"><label>${def.label}</label><input type="number" id="${def.id}" value="${def.default}" min="${def.min || 0}" max="${def.max || 9999}" class="small-input"/></div></div>`;
            }
        });

        container.innerHTML = html;

        // Wire range slider live display
        defs.filter(d => d.type === 'range').forEach(def => {
            const el = document.getElementById(def.id);
            const val = document.getElementById(def.id + '_val');
            if (el && val) el.addEventListener('input', () => val.textContent = el.value);
        });
    }

    // ── Thread Slicer Extended UI ────────────────────────────────────────────────
    function buildSlicerUI() {
        const slicerPanel = document.getElementById('threadSlicerControls');
        if (!slicerPanel) return;

        slicerPanel.innerHTML = `
            <div class="field-label" style="font-size:10px; color:#1da1f2; margin-bottom:4px;">✂ Thread Slicer Controls</div>
            <div class="num-row" style="margin-bottom:4px;">
                <div class="field"><label>Slices</label><input type="number" id="threadSliceCount" value="3" min="2" max="10" class="small-input" title="Number of slices (2–10)"/></div>
                <div class="field"><label>Global Y-Off</label><input type="number" id="threadSliceOffsetY" value="0" class="small-input" placeholder="Shift all seams"/></div>
            </div>
            <div id="threadSeamOffsets" style="margin-bottom:4px;"></div>
            <div class="checkbox-row">
                <label class="cb-label" style="font-size:10px;"><input type="checkbox" id="threadEqualSlices" checked/> Equal slice height</label>
            </div>
            <div id="threadCustomRatios" style="display:none; margin-bottom:4px;">
                <div class="field-label" style="font-size:10px; margin-bottom:3px;">Custom ratios (e.g. 1:2:1)</div>
                <input type="text" id="threadRatioInput" value="1:1:1" style="width:100%; font-size:11px; padding:3px; box-sizing:border-box;"/>
            </div>`;

        const equalToggle = document.getElementById('threadEqualSlices');
        if (equalToggle) {
            equalToggle.addEventListener('change', () => {
                const custom = document.getElementById('threadCustomRatios');
                if (custom) custom.style.display = equalToggle.checked ? 'none' : 'block';
            });
        }

        updateSliceOffsetUI();
    }

    function updateSliceOffsetUI() {
        const count = parseInt(document.getElementById('threadSliceCount')?.value) || 3;
        const container = document.getElementById('threadSeamOffsets');
        const vizBuilder = document.getElementById('sliceVisualBuilder');

        // ── Visual slice bar builder ─────────────────────────────────────────
        if (vizBuilder) {
            const COLORS = ['#1da1f2','#8B5CF6','#10B981','#F59E0B','#E8336D','#06B6D4','#F97316','#EC4899','#84CC16','#A855F7'];
            let vizHtml = `<div style="display:flex; flex-direction:column; gap:2px; margin-bottom:5px;">`;
            for (let i = 0; i < count; i++) {
                const c = COLORS[i % COLORS.length];
                vizHtml += `
                <div style="display:flex; align-items:center; gap:5px;">
                    <div style="width:10px; height:10px; background:${c}; border-radius:2px; flex-shrink:0;"></div>
                    <div style="flex:1; background:${c}22; border:1px solid ${c}55; border-radius:3px; height:18px; display:flex; align-items:center; padding:0 5px; font-size:9px; color:${c}; font-weight:600;">Slice ${i+1}</div>
                    <div style="font-size:9px; opacity:0.6; width:30px; text-align:right;" id="slicePercent_${i}">—</div>
                </div>`;
                if (i < count - 1) {
                    vizHtml += `<div style="height:3px; background:repeating-linear-gradient(90deg,#1da1f2 0,#1da1f2 6px,transparent 6px,transparent 12px); margin:0 0;"></div>`;
                }
            }
            vizHtml += `</div>`;
            vizBuilder.innerHTML = vizHtml;

            // Update percent labels based on equal/ratio
            function updatePercentLabels() {
                const equalEl = document.getElementById('threadEqualSlices');
                const ratioInput = document.getElementById('threadRatioInput');
                let percents = Array(count).fill(Math.round(100/count));
                if (equalEl && !equalEl.checked && ratioInput) {
                    const parts = (ratioInput.value || '').split(':').map(s => parseFloat(s.trim()) || 1);
                    const sum = parts.reduce((a,b) => a+b, 0);
                    if (sum > 0) percents = parts.map(p => Math.round(p/sum*100));
                }
                for (let i = 0; i < count; i++) {
                    const el = document.getElementById(`slicePercent_${i}`);
                    if (el) el.textContent = (percents[i] || '?') + '%';
                }
            }
            updatePercentLabels();
            ['threadEqualSlices','threadRatioInput'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('input', updatePercentLabels);
                if (el) el.addEventListener('change', updatePercentLabels);
            });
        }

        // ── Per-seam offset inputs ────────────────────────────────────────────
        if (!container) return;
        let html = '';
        for (let i = 1; i < count; i++) {
            html += `<div class="num-row" style="margin-bottom:2px;">
                <div class="field"><label style="color:#1da1f2;">Seam ${i} Y±</label>
                <input type="number" id="threadSeamOffset_${i}" value="0" class="small-input" placeholder="px shift" title="Shift seam ${i} up(−) or down(+) in pixels"/></div>
            </div>`;
        }
        container.innerHTML = html || '<div style="font-size:9px;opacity:0.5; margin-bottom:3px;">2+ slices for internal seams</div>';

        // Wire seam offset changes to live seam preview if active
        for (let i = 1; i < count; i++) {
            const inp = document.getElementById(`threadSeamOffset_${i}`);
            if (inp) inp.addEventListener('input', () => {
                if (document.getElementById('threadShowPreview')?.checked) {
                    // Trigger re-render of seam preview lines
                    const previewBtn = document.getElementById('btnPreviewSeams');
                    if (previewBtn && window._seamPreviewRenderer) window._seamPreviewRenderer();
                }
            });
        }
    }

    // ── Bullet Point UI (injected below Text Content panel) ─────────────────────
    function buildBulletUI() {
        const textPanel = document.getElementById('textPanel');
        if (!textPanel) return;

        const body = textPanel.querySelector('.panel-body');
        if (!body) return;

        const div = document.createElement('div');
        div.style.cssText = 'margin-top:7px; padding-top:7px; border-top:1px solid var(--border);';
        div.innerHTML = `
            <div class="field-label" style="margin-bottom:3px;">
              • Bullet Style (Label field)
              <span title="How it works: Click a bullet style button below to select it (highlighted). Then click 'Apply Bullet Style to Label' to convert any line starting with - or * in your label into that bullet style. Use 'Apply to ALL' to broadcast to every annotation. 'Remove Bullets' strips all bullet characters back to plain text. Enable 'Auto-convert' to transform dashes as you type." 
                    style="cursor:help; color:#8B5CF6; font-size:10px; margin-left:4px; border:1px solid rgba(139,92,246,0.4); border-radius:3px; padding:0 4px;">? How to use</span>
            </div>
            <div style="font-size:9px; opacity:0.55; margin-bottom:4px; line-height:1.4;">
              Type <code>- text</code> or <code>* text</code> in Label. Select bullet style. Click Apply.<br/>
              Use \n for new lines (enable 'Respect line breaks' checkbox above).
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:3px; margin-bottom:5px;">
                ${Object.entries(BULLET_PRESETS).map(([sym]) =>
                    `<button class="btn-sm bullet-preset-btn" data-bullet="${sym}" title="Use ${sym.trim()} bullets" style="min-width:30px; font-size:13px;">${sym.trim()}</button>`
                ).join('')}
            </div>
            <div class="checkbox-row">
                <label class="cb-label"><input type="checkbox" id="bulletAutoConvert" /> Auto-convert - / * to bullet on type</label>
            </div>
            <div style="display:flex; gap:4px; margin-top:4px;">
              <button class="btn-sm" id="btnApplyBullets" style="flex:1;">Apply Style to Label</button>
              <button class="btn-sm" id="btnRemoveBullets" style="flex:0; padding:2px 7px; opacity:0.75;" title="Strip all bullet characters from selected annotation label">✕ Remove</button>
            </div>
            <button class="btn-sm" id="btnApplyBulletsAll" style="width:100%; margin-top:3px; background:rgba(139,92,246,0.12); border-color:rgba(139,92,246,0.3);">Apply to ALL Annotations</button>`;

        body.appendChild(div);

        let activeBullet = '• ';

        div.querySelectorAll('.bullet-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                activeBullet = btn.dataset.bullet;
                div.querySelectorAll('.bullet-preset-btn').forEach(b => b.style.background = '');
                btn.style.background = 'rgba(139,92,246,0.25)';
                btn.style.borderColor = 'rgba(139,92,246,0.6)';
            });
        });

        document.getElementById('btnApplyBullets').addEventListener('click', () => {
            const AS = window.AppStore;
            const selId = AS.getSelectedId();
            if (!selId) return AS.showToast('Select an annotation first', 2000);
            AS.captureState();
            const anns = AS.getAnnotations();
            anns.forEach(a => {
                if (a.id === selId) {
                    a.label = convertBullets(a.label, activeBullet);
                    a.wrapSplitterEnabled = true;
                    const el = document.getElementById('editLabel');
                    if (el) el.value = a.label;
                }
            });
            AS.setAnnotations(anns);
            AS.render();
            AS.showToast('Bullet style applied ✔');
        });

        document.getElementById('btnRemoveBullets').addEventListener('click', () => {
            const AS = window.AppStore;
            const selId = AS.getSelectedId();
            if (!selId) {
                // Remove from all
                AS.captureState();
                const anns = AS.getAnnotations();
                anns.forEach(a => {
                    a.label = a.label.replace(/(^|\n)[\u2022▸→◆✓★–\u276f\-\*]\s/g, '$1');
                });
                AS.setAnnotations(anns);
                AS.render();
                return AS.showToast('Bullets removed from all annotations');
            }
            AS.captureState();
            const anns = AS.getAnnotations();
            anns.forEach(a => {
                if (a.id === selId) {
                    a.label = a.label.replace(/(^|\n)[\u2022▸→◆✓★–\u276f\-\*]\s/g, '$1');
                    const el = document.getElementById('editLabel');
                    if (el) el.value = a.label;
                }
            });
            AS.setAnnotations(anns);
            AS.render();
            AS.showToast('Bullets removed from selected annotation');
        });

        document.getElementById('btnApplyBulletsAll').addEventListener('click', () => {
            const AS = window.AppStore;
            AS.captureState();
            const anns = AS.getAnnotations();
            anns.forEach(a => {
                a.label = convertBullets(a.label, activeBullet);
                a.wrapSplitterEnabled = true;
            });
            AS.setAnnotations(anns);
            AS.render();
            AS.showToast(`Bullet style applied to ${anns.length} annotations.`);
        });

        const labelInput = document.getElementById('editLabel');
        if (labelInput) {
            labelInput.addEventListener('keyup', () => {
                const autoConvert = document.getElementById('bulletAutoConvert');
                if (!autoConvert || !autoConvert.checked) return;
                const converted = convertBullets(labelInput.value, activeBullet);
                if (converted !== labelInput.value) labelInput.value = converted;
            });
        }
    }

    // ── Bulk Property Apply-All Buttons ──────────────────────────────────────────
    function wireBulkApplyButtons() {
        const AS = window.AppStore;

        // Helper to broadcast a property update to all / multi-selected / selected
        function broadcast(updater, message) {
            const anns = AS.getAnnotations();
            const selId = AS.getSelectedId();
            // Peek at multiSelected via DOM (no direct access — infer from .multi-selected class)
            const multiEls = document.querySelectorAll('.ann-group.multi-selected');
            const multiIds = new Set([...multiEls].map(el => parseInt(el.dataset.id)).filter(n => !isNaN(n)));

            AS.captureState();

            anns.forEach(a => {
                if (multiIds.size > 0) {
                    if (multiIds.has(a.id)) updater(a);
                } else if (selId) {
                    if (a.id === selId) updater(a);
                } else {
                    updater(a); // Apply All fallback
                }
            });

            AS.setAnnotations(anns);
            AS.render();
            if (message) AS.showToast(message);
        }

        // ── Color Apply All ─────────────────────────────────────────────────────
        const applyColorAll = document.createElement('button');
        applyColorAll.className = 'apply-all-btn';
        applyColorAll.textContent = '✓ All';
        applyColorAll.title = 'Apply current color to all / multi-selected';
        applyColorAll.style.cssText = 'margin-left:4px;';
        applyColorAll.addEventListener('click', () => {
            const color = document.getElementById('customColor').value;
            broadcast(a => { a.color = color; }, 'Color applied to selection/all');
        });

        const swatchRow = document.getElementById('colorSwatches');
        if (swatchRow) swatchRow.parentNode.appendChild(applyColorAll);

        // ── Font Size Apply All ─────────────────────────────────────────────────
        createApplyAllBtn('applyAllTitleFont', 'Apply title font/size to all', (a) => {
            a.titleFont = document.getElementById('titleFont').value;
            a.titleFontSize = parseInt(document.getElementById('titleFontSize').value) || 13;
            a.titleFontWeight = document.getElementById('titleFontWeight').value;
        });

        createApplyAllBtn('applyAllLabelFont', 'Apply label font/size to all', (a) => {
            a.labelFont = document.getElementById('labelFont').value;
            a.labelFontSize = parseInt(document.getElementById('labelFontSize').value) || 12;
            a.labelFontWeight = document.getElementById('labelFontWeight').value;
        });

        // ── Wrap / Padding Apply All (existing buttons already in HTML) ─────────
        const applyWrapBtn = document.getElementById('applyGlobalWrap');
        if (applyWrapBtn) {
            applyWrapBtn.addEventListener('click', () => {
                broadcast(a => {
                    a.wrap = parseInt(document.getElementById('textWrap').value) || 120;
                }, 'Wrap applied');
            });
        }

        const applyPaddingBtn = document.getElementById('applyGlobalPadding');
        if (applyPaddingBtn) {
            applyPaddingBtn.addEventListener('click', () => {
                broadcast(a => {
                    a.padding = parseInt(document.getElementById('padding').value) || 5;
                    a.bgPadding = parseInt(document.getElementById('bgPadding').value) || 0;
                }, 'Padding applied');
            });
        }

        // ── Connector Type Apply All ────────────────────────────────────────────
        addApplyAllNearGroup('connectorType', '[data-group="connectorType"]', () => {
            const active = document.querySelector('[data-group="connectorType"] .opt-btn.active');
            return active ? active.dataset.val : 'line';
        }, (a, val) => { a.connectorType = val; });

        // ── Connector End Apply All ─────────────────────────────────────────────
        addApplyAllNearGroup('connectorEnd', '[data-group="connectorEnd"]', () => {
            const active = document.querySelector('[data-group="connectorEnd"] .opt-btn.active');
            return active ? active.dataset.val : 'none';
        }, (a, val) => { a.connectorEnd = val; });

        // ── Note Align Apply All ────────────────────────────────────────────────
        addApplyAllNearGroup('noteAlign', '[data-group="noteAlign"]', () => {
            const active = document.querySelector('[data-group="noteAlign"] .opt-btn.active');
            return active ? active.dataset.val : 'middle';
        }, (a, val) => { a.noteAlign = val; });

        // ── Subject Size Apply All ──────────────────────────────────────────────
        const subjectPanel = document.getElementById('subjectSizePanel');
        if (subjectPanel) {
            const applySubjBtn = document.createElement('button');
            applySubjBtn.className = 'apply-all-btn';
            applySubjBtn.textContent = '✓ Apply Subject Sz to All';
            applySubjBtn.style.cssText = 'width:100%; margin-top:5px;';
            applySubjBtn.addEventListener('click', () => {
                broadcast(a => {
                    a.subjectRadius = parseInt(document.getElementById('subjectRadius').value) || 50;
                    a.subjectWidth = parseInt(document.getElementById('subjectWidth').value) || 100;
                    a.subjectHeight = parseInt(document.getElementById('subjectHeight').value) || 60;
                }, 'Subject size applied');
            });
            const body = subjectPanel.querySelector('.panel-body');
            if (body) body.appendChild(applySubjBtn);
        }

        // ── Note Line Type / Orientation Apply All ──────────────────────────────
        addApplyAllNearGroup('noteLineType', '[data-group="noteLineType"]', () => {
            const active = document.querySelector('[data-group="noteLineType"] .opt-btn.active');
            return active ? active.dataset.val : 'none';
        }, (a, val) => { a.noteLineType = val; });

        addApplyAllNearGroup('noteOrientation', '[data-group="noteOrientation"]', () => {
            const active = document.querySelector('[data-group="noteOrientation"] .opt-btn.active');
            return active ? active.dataset.val : 'topBottom';
        }, (a, val) => { a.noteOrientation = val; });

        // ── Z-Index Apply All ────────────────────────────────────────────────────
        const zInput = document.getElementById('annZIndex');
        if (zInput) {
            const zBtn = document.createElement('button');
            zBtn.className = 'apply-all-btn';
            zBtn.textContent = '✓ All';
            zBtn.title = 'Apply Z-Index to all / multi-selected';
            zBtn.style.cssText = 'margin-left:4px; margin-top:4px;';
            zBtn.addEventListener('click', () => {
                broadcast(a => { a.zIndex = parseInt(zInput.value) || 10; }, 'Z-Index applied');
            });
            zInput.parentNode.parentNode.appendChild(zBtn);
        }

        // ── Visibility Disable Parts Apply All ────────────────────────────────────
        ['disableConnector', 'disableSubject', 'disableNote'].forEach(cbId => {
            const cb = document.getElementById(cbId);
            if (!cb) return;
            const partName = cbId.replace('disable', '').toLowerCase();
            const btn = document.createElement('button');
            btn.className = 'btn-sm';
            btn.textContent = '✓ All';
            btn.title = `Toggle ${partName} on all / multi-selected`;
            btn.style.cssText = 'margin-left:4px; font-size:9px; padding:1px 5px;';
            btn.addEventListener('click', () => {
                const hide = cb.checked;
                broadcast(a => {
                    a.disableParts = a.disableParts || [];
                    if (hide && !a.disableParts.includes(partName)) a.disableParts.push(partName);
                    else if (!hide) a.disableParts = a.disableParts.filter(p => p !== partName);
                }, `${partName} visibility applied to all`);
            });
            cb.parentNode.appendChild(btn);
        });

        // ── Subject Fill Apply All ────────────────────────────────────────────────
        const sfPanel = document.getElementById('subjectFillPanel');
        if (sfPanel) {
            const btn = document.createElement('button');
            btn.className = 'apply-all-btn';
            btn.textContent = '✓ Apply Fill to All';
            btn.style.cssText = 'width:100%; margin-top:4px;';
            btn.addEventListener('click', () => {
                broadcast(a => {
                    a.subjectFill = document.getElementById('subjectFillColor').value;
                    a.subjectFillOpacity = parseFloat(document.getElementById('subjectFillOpacity').value) || 0.1;
                }, 'Subject fill applied');
            });
            const body = sfPanel.querySelector('.panel-body');
            if (body) body.appendChild(btn);
        }

        // ── Connector End Scale Apply All ─────────────────────────────────────────
        const endScaleInput = document.getElementById('connectorEndScale');
        if (endScaleInput) {
            const btn = document.createElement('button');
            btn.className = 'apply-all-btn';
            btn.textContent = '✓ All';
            btn.style.cssText = 'margin-left:4px;';
            btn.addEventListener('click', () => {
                broadcast(a => { a.connectorEndScale = parseFloat(endScaleInput.value) || 1; }, 'End scale applied');
            });
            endScaleInput.parentNode.parentNode.appendChild(btn);
        }
    }

    // ── Helper to create apply-all button attached to an existing button by ID ───
    function createApplyAllBtn(targetBtnId, toastMsg, updaterFn) {
        const existingBtn = document.getElementById(targetBtnId);
        if (!existingBtn) return;
        existingBtn.addEventListener('click', () => {
            const AS = window.AppStore;
            const anns = AS.getAnnotations();
            const multiEls = document.querySelectorAll('.ann-group.multi-selected');
            const multiIds = new Set([...multiEls].map(el => parseInt(el.dataset.id)).filter(n => !isNaN(n)));
            AS.captureState();
            anns.forEach(a => {
                if (multiIds.size > 0 ? multiIds.has(a.id) : true) updaterFn(a);
            });
            AS.setAnnotations(anns);
            AS.render();
            AS.showToast(toastMsg);
        });
    }

    // ── Helper to add Apply-All mini button next to option-icon groups ────────────
    function addApplyAllNearGroup(id, groupSelector, valueFn, updaterFn) {
        const AS = window.AppStore;
        const groupEl = document.querySelector(groupSelector);
        if (!groupEl) return;
        const btn = document.createElement('button');
        btn.className = 'apply-all-btn';
        btn.textContent = '✓ All';
        btn.title = 'Apply to all / multi-selected';
        btn.style.cssText = 'margin-left:4px; font-size:9px; padding:1px 5px;';
        btn.addEventListener('click', () => {
            const val = valueFn();
            const anns = AS.getAnnotations();
            const selId = AS.getSelectedId();
            const multiEls = document.querySelectorAll('.ann-group.multi-selected');
            const multiIds = new Set([...multiEls].map(el => parseInt(el.dataset.id)).filter(n => !isNaN(n)));
            AS.captureState();
            anns.forEach(a => {
                if (multiIds.size > 0) { if (multiIds.has(a.id)) updaterFn(a, val); }
                else if (selId) { if (a.id === selId) updaterFn(a, val); }
                else updaterFn(a, val);
            });
            AS.setAnnotations(anns);
            AS.render();
            AS.showToast(`Applied to ${multiIds.size > 0 ? multiIds.size + ' selected' : 'all'} annotations`);
        });
        groupEl.parentNode.appendChild(btn);
    }

    // ── Expose for x_monetization_features.js (thread slicer) ───────────────────
    window.PatternEngine = {
        getSliceCount: () => parseInt(document.getElementById('threadSliceCount').value) || 3,
        getSeamOffsets: () => {
            const count = parseInt(document.getElementById('threadSliceCount').value) || 3;
            const globalOffset = parseInt(document.getElementById('threadSliceOffsetY').value) || 0;
            const offsets = [0]; // seam 0 is always at 0
            for (let i = 1; i < count; i++) {
                const el = document.getElementById(`threadSeamOffset_${i}`);
                offsets.push(globalOffset + (el ? parseInt(el.value) || 0 : 0));
            }
            return offsets;
        },
        getSliceRatios: () => {
            const equalEl = document.getElementById('threadEqualSlices');
            if (!equalEl || equalEl.checked) return null; // null = equal
            const ratioStr = (document.getElementById('threadRatioInput').value || '1:1:1');
            const parts = ratioStr.split(':').map(s => parseFloat(s.trim()) || 1);
            const sum = parts.reduce((a, b) => a + b, 0);
            return parts.map(p => p / sum);
        },
        resolveCollisions,
        applyPattern,
    };

    console.log('[PatternEngine] v2.0 loaded — 19 patterns, D3-force collision, bulk-apply, bullet editor');

})();
