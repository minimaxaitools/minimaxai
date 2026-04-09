// x_monetization_features.js — v3.0
// Enhanced bulk import with proper annotation schema + pattern apply,
// standalone 5-mode background engine, seam preview, Select All / Bulk Type Change
document.addEventListener('DOMContentLoaded', () => {
    const interval = setInterval(() => {
        if (window.AppStore) { clearInterval(interval); initMonetizationFeatures(); }
    }, 100);
});

function initMonetizationFeatures() {
    const AS = window.AppStore;

    // ─── 1. BULK DATA IMPORT (full annotation schema) ──────────────────────────
    function parseCsvToTemplates(text) {
        return text.split('\n').filter(l => l.trim()).map((line, i) => {
            let tpl = {};
            // Extract key=value attributes first
            const kvRegex = /(?:,\s*)?([a-zA-Z0-9_]+)\s*=\s*([^,]+)/g;
            let cleanLine = line.replace(kvRegex, (match, k, v) => {
                k = k.trim(); v = v.trim();
                if (v === 'true') tpl[k] = true;
                else if (v === 'false') tpl[k] = false;
                else if (!isNaN(Number(v)) && v !== '') tpl[k] = Number(v);
                else tpl[k] = v;
                return ''; // strip out the kv pair
            });

            // Clean trailing commas and whitespace
            cleanLine = cleanLine.replace(/[\s,]+$/, '');
            
            // Positional parts processing
            const parts = cleanLine.split(',').map(s => s.trim());
            const title = (parts[0] || '').substring(0, 60);
            
            let label = '', importance = 'medium', color = null;
            let remaining = parts.slice(1);

            // Pop color if it's the last element
            if (remaining.length > 0) {
                const last = remaining[remaining.length - 1];
                if (last.startsWith('#') || last.startsWith('rgb') || last.toLowerCase() === 'transparent' || last.toLowerCase() === 'none') {
                    color = last;
                    remaining.pop();
                }
            }

            // Pop importance if it's the new last element
            if (remaining.length > 0) {
                const last = remaining[remaining.length - 1].toLowerCase();
                if (['high','medium','low'].includes(last)) {
                    importance = last;
                    remaining.pop();
                }
            }

            // Everything else in the middle is the label
            label = remaining.join(', ');

            return { title: title || ('Item ' + (i + 1)), label, importance, color, ...tpl };
        });
    }

    function buildProperAnnotation(tpl, i, id, x, y, dx, dy) {
        let imp = tpl.importance || 'medium';
        let color = tpl.color || (imp === 'high' ? '#E8336D' : imp === 'low' ? '#10B981' : '#8B5CF6');
        let typeKey = tpl.typeKey || (imp === 'high' ? 'annotationCalloutCircle'
                    : imp === 'medium' ? 'annotationCalloutElbow' : 'annotationCallout');

        const ann = {
            id, typeKey, x, y, dx, dy,
            title: tpl.title, label: tpl.label,
            wrap: 140, padding: 5,
            noteLineType: 'vertical', noteOrientation: 'topBottom', noteAlign: 'middle',
            notePositionMode: 'offset', nx: null, ny: null,
            connectorType: imp === 'high' ? 'line' : 'elbow',
            connectorEnd: 'arrow', connectorEndScale: 3,
            curveType: 'curveCatmullRom', curvePoints: 2,
            color,
            titleFont: 'Kalam', titleFontSize: imp === 'high' ? 16 : 13, titleFontWeight: 700,
            labelFont: 'Inter', labelFontSize: 11, labelFontWeight: 400,
            subjectFill: color, subjectFillOpacity: imp === 'high' ? 0.12 : 0.08,
            subjectRadius: imp === 'high' ? 50 : 38, subjectWidth: 100, subjectHeight: 60,
            thresholdOrientation: 'horizontal',
            badgeText: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i % 26], badgeRadius: 14, badgeFont: 'Inter', badgeFontSize: 12,
            zIndex: imp === 'high' ? 12 : 10,
            disableParts: [],
            wrapSplitterEnabled: !!(tpl.label && tpl.label.includes('\n')),
            bgPadding: 0, bgPaddingTop: 0, bgPaddingBottom: 0, bgPaddingLeft: 0, bgPaddingRight: 0,
            connectorPoints: null, importance: imp,
        };

        // Override custom attributes given via key=value in CSV
        for (let k in tpl) {
            if (!['title','label','importance','color'].includes(k)) {
                ann[k] = tpl[k];
            }
        }
        return ann;
    }

    function doImport(usePattern) {
        const bulkCsvInput = document.getElementById('bulkCsvInput');
        const text = bulkCsvInput ? bulkCsvInput.value.trim() : '';
        if (!text) return AS.showToast('Paste CSV data or text lines first', 3000);

        const templates = parseCsvToTemplates(text);
        if (templates.length === 0) return;

        AS.captureState();
        let idCounter = AS.getIdCounter();
        const svgEl = document.getElementById('canvas');
        const cs = AS.getCanvasSettings();
        const w = cs.customWidth || svgEl.clientWidth || 800;
        const h = cs.customHeight || svgEl.clientHeight || 500;

        let newAnns;
        if (usePattern && window.PatternEngine) {
            const patType = document.getElementById('pattern-type');
            const type = patType ? patType.value : 'grid';
            newAnns = window.PatternEngine.applyPattern(templates, type, {}, w, h);
            newAnns = newAnns.map(a => { idCounter++; return { ...a, id: idCounter }; });
            newAnns = window.PatternEngine.resolveCollisions(newAnns, 130, 60, w, h);
        } else {
            const cols = Math.max(2, Math.ceil(Math.sqrt(templates.length)));
            const spacingX = Math.min(210, (w - 100) / cols);
            const spacingY = Math.min(190, (h - 100) / Math.ceil(templates.length / cols));
            newAnns = templates.map((tpl, i) => {
                const col = i % cols, row = Math.floor(i / cols);
                idCounter++;
                const x = 80 + col * spacingX + (row % 2 === 0 ? 0 : spacingX / 4);
                const y = 80 + row * spacingY;
                const dx = col < cols / 2 ? 55 + Math.random() * 30 : -(55 + Math.random() * 30);
                const dy = row % 2 === 0 ? -(65 + Math.random() * 30) : (65 + Math.random() * 30);
                return buildProperAnnotation(tpl, i, idCounter, x, y, dx, dy);
            });
        }

        AS.setIdCounter(idCounter);
        AS.setAnnotations([...AS.getAnnotations(), ...newAnns]);
        AS.render();
        if (bulkCsvInput) bulkCsvInput.value = '';
        AS.showToast(`✓ Imported ${newAnns.length} annotations${usePattern ? ' with pattern layout' : ''}`, 3000);
    }

    const btnBI = document.getElementById('btnBulkImport');
    const btnBIP = document.getElementById('btnBulkImportPattern');
    const btnCopyAI = document.getElementById('btnCopyAIPrompt');

    if (btnBI) btnBI.addEventListener('click', () => doImport(false));
    if (btnBIP) btnBIP.addEventListener('click', () => doImport(true));
    if (btnCopyAI) {
        btnCopyAI.addEventListener('click', () => {
            const promptText = `Please generate an informative multi-point dataset formatted EXACTLY in this custom CSV format for D3 Annotation Studio.

Format per line:
Title, Label text highlighting the insight, Importance (high/medium/low), [HexColor OR transparent], optionalKey=value

Available optional properties (append as key=value):
- typeKey=annotationBadge | annotationCallout | annotationCalloutElbow | annotationCalloutCircle | annotationCalloutCurve
- curvePoints=<number>
- badgeRadius=<number>
- connectorType=elbow | curve | line | none

Example:
Core Feature, Refactored to support async streaming flawlessly, high, #E8336D, typeKey=annotationBadge, badgeRadius=24, curvePoints=4

Topic to generate on: [INSERT TOPIC HERE]
Please generate 10 insightful points. Output ONLY the raw CSV rows, no code blocks or markdown headers.`;
            navigator.clipboard.writeText(promptText)
                .then(() => AS.showToast('📋 AI Prompt Template Copied to Clipboard!', 3000))
                .catch(e => AS.showToast('Failed to copy clipboard: ' + e, 3000));
        });
    }

    // ─── 2. BACKGROUND CANVAS ENGINE (5 patterns, always standalone) ──────────
    function applyBgPattern(type) {
        const svgEl = AS.svgEl;
        const cellSize = parseInt(document.getElementById('bgPatternSize')?.value) || 20;
        const color    = document.getElementById('bgPatternColor')?.value || '#d1d5db';
        const opacity  = parseFloat(document.getElementById('bgPatternOpacity')?.value) || 0.4;

        let defs = svgEl.querySelector('defs.dynamic-bg');
        if (!defs) {
            defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            defs.setAttribute('class', 'dynamic-bg');
            svgEl.insertBefore(defs, svgEl.firstChild);
        }
        defs.innerHTML = '';

        let bgRect = svgEl.querySelector('#canvasBgRect');
        if (!bgRect) {
            bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bgRect.setAttribute('id', 'canvasBgRect');
            bgRect.setAttribute('width', '100%'); bgRect.setAttribute('height', '100%');
            bgRect.setAttribute('pointer-events', 'none');
            if (svgEl.firstChild) svgEl.insertBefore(bgRect, svgEl.firstChild);
            else svgEl.appendChild(bgRect);
        }

        const ns = 'http://www.w3.org/2000/svg';
        function mkEl(tag, attrs) {
            const el = document.createElementNS(ns, tag);
            Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
            return el;
        }
        function mkPat(id, pw, ph, buildFn) {
            const pat = mkEl('pattern', { id, width: pw, height: ph, patternUnits: 'userSpaceOnUse' });
            buildFn(pat); defs.appendChild(pat);
            return `url(#${id})`;
        }

        const canvasSettings = AS.getCanvasSettings();
        let fill = null;

        if (type === 'dot-grid') {
            canvasSettings.bgColor = '#faf9f7';
            fill = mkPat('bg-dots', cellSize, cellSize, p => {
                p.appendChild(mkEl('circle', { cx: 2, cy: 2, r: Math.max(1, cellSize * 0.08), fill: color, 'fill-opacity': opacity }));
            });
        } else if (type === 'blueprint') {
            canvasSettings.bgColor = '#0f172a';
            const s = cellSize * 2;
            fill = mkPat('bg-bp', s, s, p => {
                p.appendChild(mkEl('path', { d: `M ${s} 0 L 0 0 0 ${s}`, fill: 'none', stroke: color, 'stroke-width': 0.5, 'stroke-opacity': Math.min(1, opacity * 0.9) }));
            });
        } else if (type === 'lines') {
            canvasSettings.bgColor = '#faf9f7';
            fill = mkPat('bg-lines', cellSize, cellSize, p => {
                p.appendChild(mkEl('line', { x1: 0, y1: cellSize, x2: cellSize, y2: cellSize, stroke: color, 'stroke-width': 0.6, 'stroke-opacity': opacity }));
            });
        } else if (type === 'crosshatch') {
            canvasSettings.bgColor = '#faf9f7';
            fill = mkPat('bg-cross', cellSize, cellSize, p => {
                p.appendChild(mkEl('path', { d: `M 0,0 L 0,${cellSize} M 0,0 L ${cellSize},0`, fill: 'none', stroke: color, 'stroke-width': 0.5, 'stroke-opacity': opacity }));
            });
        } else {
            // Solid — clear pattern fill
            bgRect.setAttribute('fill', 'none');
        }

        if (fill) bgRect.setAttribute('fill', fill);
        AS.setCanvasSettings(canvasSettings);
        AS.applyCanvasSettings();
    }

    ['canvasBgPattern'].forEach(selId => {
        const sel = document.getElementById(selId);
        if (sel) sel.addEventListener('change', e => applyBgPattern(e.target.value));
    });
    ['bgPatternSize', 'bgPatternColor', 'bgPatternOpacity'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', () => {
            const sel = document.getElementById('canvasBgPattern');
            if (sel && sel.value !== 'none') applyBgPattern(sel.value);
            if (id === 'bgPatternOpacity') {
                const v = document.getElementById('bgPatternOpacityVal');
                if (v) v.textContent = parseFloat(el.value).toFixed(2);
            }
        });
    });

    // ─── 3. SELECT ALL / DESELECT / REARRANGE ────────────────────────────────
    const btnSelectAll = document.getElementById('btnSelectAll');
    const btnDeselectAll = document.getElementById('btnDeselectAll');
    const btnRearrangeSelected = document.getElementById('btnRearrangeSelected');

    if (btnSelectAll) {
        btnSelectAll.addEventListener('click', () => {
            const anns = AS.getAnnotations();
            if (anns.length === 0) return AS.showToast('No annotations on canvas', 2000);
            // Clear single select, add all to multiSelectedIds via AppStore
            AS.setSelectedId(null);
            // We inject IDs via DOM multi-select pattern — re-render with all marked
            // Since multiSelectedIds is internal, we patch via AppStore:
            if (window._patchMultiSelect) {
                window._patchMultiSelect(anns.map(a => a.id));
            } else {
                AS.showToast(`${anns.length} annotations selected (green ring = multi)`, 2500);
            }
            AS.render();
            updateBulkTypePanel();
        });
    }

    if (btnDeselectAll) {
        btnDeselectAll.addEventListener('click', () => {
            AS.setSelectedId(null);
            if (window._patchMultiSelect) window._patchMultiSelect([]);
            AS.render();
            updateBulkTypePanel();
        });
    }

    if (btnRearrangeSelected) {
        btnRearrangeSelected.addEventListener('click', () => {
            const PE = window.PatternEngine;
            if (!PE) return AS.showToast('Pattern Engine not loaded', 2000);
            const anns = AS.getAnnotations();
            const patType = document.getElementById('pattern-type');
            const type = patType ? patType.value : 'grid';
            const svgEl = document.getElementById('canvas');
            const cs = AS.getCanvasSettings();
            const w = cs.customWidth || svgEl.clientWidth || 800;
            const h = cs.customHeight || svgEl.clientHeight || 500;

            // Get multi-selected IDs from DOM
            const multiEls = document.querySelectorAll('.ann-group.multi-selected');
            const multiIds = new Set([...multiEls].map(el => parseInt(el.dataset.id)).filter(n => !isNaN(n)));
            const toRearrange = multiIds.size > 0 ? anns.filter(a => multiIds.has(a.id)) : anns;
            const unchanged = multiIds.size > 0 ? anns.filter(a => !multiIds.has(a.id)) : [];

            if (toRearrange.length === 0) return AS.showToast('Nothing to rearrange', 2000);

            AS.captureState();
            let rearranged = PE.applyPattern(toRearrange, type, {}, w, h);
            rearranged = PE.resolveCollisions(rearranged, 130, 60, w, h);
            AS.setAnnotations([...unchanged, ...rearranged]);
            AS.render();
            AS.showToast(`✓ Rearranged ${rearranged.length} annotations → ${type}`, 2500);
        });
    }

    // ─── 4. BULK TYPE CHANGE ─────────────────────────────────────────────────
    const btnBulkTypeChange = document.getElementById('btnBulkTypeChange');
    if (btnBulkTypeChange) {
        btnBulkTypeChange.addEventListener('click', () => {
            const newType = document.getElementById('bulkTypeSelect').value;
            if (!newType) return;
            const anns = AS.getAnnotations();
            const multiEls = document.querySelectorAll('.ann-group.multi-selected');
            const multiIds = new Set([...multiEls].map(el => parseInt(el.dataset.id)).filter(n => !isNaN(n)));
            AS.captureState();
            let count = 0;
            anns.forEach(a => {
                if (multiIds.size > 0 ? multiIds.has(a.id) : true) {
                    a.typeKey = newType; count++;
                }
            });
            AS.setAnnotations(anns);
            AS.render();
            AS.showToast(`✓ Changed ${count} annotations → ${newType.replace('annotation','')}`, 2500);
        });
    }

    function updateBulkTypePanel() {
        const panel = document.getElementById('bulkTypePanel');
        if (!panel) return;
        const multiEls = document.querySelectorAll('.ann-group.multi-selected');
        const anns = AS.getAnnotations();
        panel.style.display = (multiEls.length > 0 || anns.length > 0) ? 'block' : 'none';
    }

    // Show bulk type panel when multi-select active
    const svgCanvas = document.getElementById('canvas');
    if (svgCanvas) {
        svgCanvas.addEventListener('click', () => setTimeout(updateBulkTypePanel, 100));
    }
    // Always show if there are any annotations
    setTimeout(updateBulkTypePanel, 500);

    // ─── 5. ADVANCED VIEW MODES ────────────────────────────────────────────────
    const spotlightToggle = document.getElementById('spotlightToggle');
    if (spotlightToggle) {
        spotlightToggle.addEventListener('change', (e) => {
            const isSpotlight = e.target.checked;
            const svgEl = AS.svgEl;
            if (isSpotlight) {
                svgEl.classList.add('spotlight-mode');
                if (!document.getElementById('spotlight-style')) {
                    const style = document.createElement('style');
                    style.id = 'spotlight-style';
                    style.textContent = `
                        svg.spotlight-mode .ann-group { opacity: 0.1 !important; transition: opacity 0.3s; }
                        svg.spotlight-mode .ann-group.selected { opacity: 1.0 !important; }
                        svg.spotlight-mode .ann-group.multi-selected { opacity: 0.85 !important; }
                        svg.spotlight-mode .obj-group { opacity: 0.1 !important; transition: opacity 0.3s; }
                        svg.spotlight-mode .obj-group.selected { opacity: 1.0 !important; }
                    `;
                    document.head.appendChild(style);
                }
            } else {
                svgEl.classList.remove('spotlight-mode');
            }
        });
    }

    // ─── 6. SEAM PREVIEW on canvas ────────────────────────────────────────────
    let seamPreviewActive = false;
    const btnPreviewSeams = document.getElementById('btnPreviewSeams');
    if (btnPreviewSeams) {
        btnPreviewSeams.addEventListener('click', () => {
            seamPreviewActive = !seamPreviewActive;
            renderSeamPreview(seamPreviewActive);
            btnPreviewSeams.textContent = seamPreviewActive ? '🚫 Hide Seam Preview' : '👁 Toggle Seam Preview on Canvas';
        });
    }
    const showPreviewCb = document.getElementById('threadShowPreview');
    if (showPreviewCb) {
        showPreviewCb.addEventListener('change', () => {
            seamPreviewActive = showPreviewCb.checked;
            renderSeamPreview(seamPreviewActive);
        });
    }

    function renderSeamPreview(show) {
        const svgEl = AS.svgEl;
        svgEl.querySelectorAll('.seam-preview-line').forEach(el => el.remove());
        if (!show) return;
        const PE = window.PatternEngine;
        const count = PE ? PE.getSliceCount() : parseInt(document.getElementById('threadSliceCount')?.value) || 3;
        const offsets = PE ? PE.getSeamOffsets() : [0];
        const h = svgEl.clientHeight || 500;
        const w = svgEl.clientWidth || 800;
        const sliceH = h / count;
        for (let i = 1; i < count; i++) {
            const seamOff = offsets[i] || 0;
            const y = Math.round(i * sliceH + seamOff);
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('class', 'seam-preview-line');
            line.setAttribute('x1', 0); line.setAttribute('y1', y);
            line.setAttribute('x2', w); line.setAttribute('y2', y);
            line.setAttribute('stroke', '#1da1f2'); line.setAttribute('stroke-width', '1.5');
            line.setAttribute('stroke-dasharray', '8,4');
            line.setAttribute('pointer-events', 'none');
            svgEl.appendChild(line);
        }
    }

    // Re-render seam preview when slice count changes
    ['threadSliceCount','threadSliceOffsetY','threadRatioInput'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => { if (seamPreviewActive) renderSeamPreview(true); });
    });

    // ─── 7. PROFESSIONAL EXPORT ───────────────────────────────────────────────
    const btnProExport = document.getElementById('btnProExport');
    const proExportPreset = document.getElementById('proExportPreset');
    const watermarkToggle = document.getElementById('watermarkToggle');
    const watermarkText = document.getElementById('watermarkText');

    if (btnProExport && proExportPreset) {
        btnProExport.addEventListener('click', async () => {
            const preset = proExportPreset.value;
            const useWatermark = watermarkToggle && watermarkToggle.checked;
            const wmStr = watermarkText && watermarkText.value ? watermarkText.value : 'D3 Annotation Studio PRO';
            const cs = AS.getCanvasSettings();
            const w = cs.customWidth || document.getElementById('canvas').clientWidth || 800;
            const h = cs.customHeight || document.getElementById('canvas').clientHeight || 500;

            AS.showToast('Preparing ' + preset + ' export…', 2500);

            if (preset === '4k' || preset === '8k') {
                await triggerHighResExport(w, h, preset === '4k' ? 4 : 8, useWatermark, wmStr);
            } else if (preset === 'pdf') {
                await triggerPdfExport(w, h, useWatermark, wmStr);
            } else if (preset === 'thread') {
                await triggerThreadSlicer(w, h, useWatermark, wmStr);
            }
        });
    }

    // ─── UTILITIES ────────────────────────────────────────────────────────────
    async function triggerHighResExport(w, h, scaleFactor, showWatermark, wmStr) {
        await customCanvasRender(w, h, scaleFactor, showWatermark, wmStr, (canvas) => {
            const a = document.createElement('a');
            a.download = `x-export-${scaleFactor}x.png`;
            a.href = canvas.toDataURL('image/png');
            a.click();
            AS.showToast('High-Res Export Complete!');
        });
    }

    async function triggerPdfExport(w, h, showWatermark, wmStr) {
        if (!window.jspdf) return AS.showToast('jsPDF library not loaded', 3000);
        await customCanvasRender(w, h, 2, showWatermark, wmStr, (canvas) => {
            const imgData = canvas.toDataURL('image/png');
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF(w > h ? 'l' : 'p', 'pt', [w, h]);
            doc.addImage(imgData, 'PNG', 0, 0, w, h);
            doc.save('annotation-studio-export.pdf');
            AS.showToast('PDF Export Complete!');
        });
    }

    async function triggerThreadSlicer(w, h, showWatermark, wmStr) {
        const PE = window.PatternEngine;
        const scale = 2;
        const sliceCount = PE ? PE.getSliceCount() : parseInt(document.getElementById('threadSliceCount')?.value) || 3;
        const seamOffsets = PE ? PE.getSeamOffsets() : Array(sliceCount).fill(0);
        const ratios = PE ? PE.getSliceRatios() : null;

        const sliceHeights = [];
        if (ratios && ratios.length === sliceCount) {
            ratios.forEach(r => sliceHeights.push(Math.round(h * r)));
        } else {
            for (let i = 0; i < sliceCount; i++) sliceHeights.push(Math.round(h / sliceCount));
        }

        // Remove seam preview lines before export
        AS.svgEl.querySelectorAll('.seam-preview-line').forEach(el => el.remove());

        await customCanvasRender(w, h, scale, showWatermark, wmStr, (canvas) => {
            let yPos = 0;
            for (let i = 0; i < sliceCount; i++) {
                const sliceH = sliceHeights[i];
                const seamOff = seamOffsets[i] || 0;
                const sy = Math.max(0, (yPos + seamOff) * scale);
                const sh = Math.min(sliceH * scale, canvas.height - sy);

                const sc = document.createElement('canvas');
                sc.width = w * scale; sc.height = sh;
                sc.getContext('2d').drawImage(canvas, 0, sy, w * scale, sh, 0, 0, w * scale, sh);

                const a = document.createElement('a');
                a.download = `x-thread-${i + 1}-of-${sliceCount}.png`;
                a.href = sc.toDataURL('image/png');
                a.click();
                yPos += sliceH;
            }
            AS.showToast(`✓ Exported ${sliceCount} Thread Slices!`, 3000);
        });
    }

    async function customCanvasRender(w, h, scaleFactor, showWatermark, wmStr, callback) {
        const prevId = AS.getSelectedId();
        AS.setSelectedId(null);
        if (AS.setSelectedObjId) AS.setSelectedObjId(null);
        AS.render();

        const svgClone = AS.svgEl.cloneNode(true);

        // Inline computed styles for faithful rendering
        try {
            const srcEls = AS.svgEl.querySelectorAll('*');
            const dstEls = svgClone.querySelectorAll('*');
            const PROPS = ['fill','fill-opacity','stroke','stroke-width','stroke-opacity',
                           'stroke-dasharray','font-family','font-size','font-weight',
                           'text-anchor','dominant-baseline','opacity','display','visibility'];
            srcEls.forEach((src, i) => {
                const dst = dstEls[i]; if (!dst) return;
                const cs = window.getComputedStyle(src);
                let css = '';
                PROPS.forEach(p => { const v = cs.getPropertyValue(p); if (v) css += `${p}:${v};`; });
                dst.setAttribute('style', css);
            });
        } catch(e) {}

        // Clean export artifacts
        svgClone.querySelectorAll('.annotation-note-bg').forEach(el => {
            el.setAttribute('fill', 'transparent');
            el.style.setProperty('fill', 'transparent', 'important');
        });
        svgClone.querySelectorAll('.resize-handle,.rotate-handle,.obj-sel-border,.grid-line-group,.seam-preview-line').forEach(el => el.remove());

        // Watermark
        if (showWatermark) {
            const wmFontSize = parseInt(document.getElementById('watermarkFontSize')?.value) || 42;
            const wmOpacity  = parseFloat(document.getElementById('watermarkOpacity')?.value) || 0.18;
            const wmColor    = document.getElementById('watermarkColor')?.value || '#1da1f2';
            const wmPos      = document.getElementById('watermarkPosition')?.value || 'bottom-right';
            const wmAngle    = parseInt(document.getElementById('watermarkAngle')?.value) || 0;

            let wx = w - 20, wy = h - 20, anchor = 'end';
            if (wmPos === 'bottom-left')  { wx = 20; wy = h - 20; anchor = 'start'; }
            if (wmPos === 'top-right')    { wx = w - 20; wy = wmFontSize + 10; }
            if (wmPos === 'top-left')     { wx = 20; wy = wmFontSize + 10; anchor = 'start'; }
            if (wmPos === 'center')       { wx = w / 2; wy = h / 2; anchor = 'middle'; }

            const wm = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            wm.setAttribute('x', wx); wm.setAttribute('y', wy);
            wm.setAttribute('fill', wmColor); wm.setAttribute('fill-opacity', wmOpacity);
            wm.setAttribute('font-size', wmFontSize + 'px');
            wm.setAttribute('font-family', 'Inter, sans-serif');
            wm.setAttribute('font-weight', 'bold');
            wm.setAttribute('text-anchor', anchor);
            if (wmAngle !== 0) wm.setAttribute('transform', `rotate(${wmAngle},${wx},${wy})`);
            wm.textContent = wmStr || 'D3 Annotation Studio PRO';
            svgClone.appendChild(wm);
        }

        // Background
        const cs = AS.getCanvasSettings();
        if (cs.bgColor) {
            const existingBgRect = svgClone.querySelector('#canvasBgRect');
            if (!existingBgRect) {
                const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                bgRect.setAttribute('width', '100%'); bgRect.setAttribute('height', '100%');
                bgRect.setAttribute('fill', cs.bgColor);
                svgClone.insertBefore(bgRect, svgClone.firstChild);
            }
            const defsEl = svgClone.querySelector('defs');
            if (defsEl) svgClone.insertBefore(defsEl, svgClone.firstChild);
        }

        svgClone.setAttribute('width', w);
        svgClone.setAttribute('height', h);
        svgClone.setAttribute('viewBox', `0 0 ${w} ${h}`);
        svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

        const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        styleEl.textContent = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Kalam:wght@400;700&display=swap');`;
        svgClone.insertBefore(styleEl, svgClone.firstChild);

        const svgStr = new XMLSerializer().serializeToString(svgClone);
        const url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' }));

        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = w * scaleFactor; canvas.height = h * scaleFactor;
            const ctx = canvas.getContext('2d');
            ctx.scale(scaleFactor, scaleFactor);
            ctx.drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            AS.setSelectedId(prevId);
            AS.render();
            callback(canvas);
        };
        img.onerror = () => { URL.revokeObjectURL(url); AS.showToast('Export render failed', 3000); };
        img.src = url;
    }
}
