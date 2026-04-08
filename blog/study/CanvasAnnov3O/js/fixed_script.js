// Wrap everything in document.fonts.ready to fix custom font spacing issues
// per the d3-annotation library documentation tips
document.fonts.ready.then(function () {
  document.addEventListener("DOMContentLoaded", function () {
    startApp();
  });
  // If DOM already loaded (fonts loaded after DOMContentLoaded)
  if (document.readyState !== 'loading') {
    startApp();
  }
});

let _appStarted = false;
function startApp() {
  if (_appStarted) return;
  _appStarted = true;

  const {
    annotation,
    annotationLabel,
    annotationCallout,
    annotationCalloutElbow,
    annotationCalloutCurve,
    annotationCalloutCircle,
    annotationCalloutRect,
    annotationXYThreshold,
    annotationBadge,
    annotationCustomType
  } = d3;

  const FONTS = ['Inter', 'Outfit', 'Poppins', 'Lobster', 'Pacifico', 'Dancing Script', 'Satisfy',
    'Caveat', 'Hind', 'Noto Sans Devanagari', 'Kalam', 'Martel', 'Yantramanav', 'Baloo 2',
    'Gajraj One', 'Biryani', 'Anek Devanagari'];

  const COLOR_PRESETS = ['#E8336D', '#2196F3', '#10B981', '#F59E0B', '#8B5CF6'];

  const TYPE_MAP = {
    annotationLabel: annotationLabel,
    annotationCallout: annotationCallout,
    annotationCalloutElbow: annotationCalloutElbow,
    annotationCalloutCurve: annotationCalloutCurve,
    annotationCalloutCircle: annotationCalloutCircle,
    annotationCalloutRect: annotationCalloutRect,
    annotationXYThreshold: annotationXYThreshold,
    annotationBadge: annotationBadge
  };

  const TYPE_CONNECTOR = {
    annotationLabel: 'none',
    annotationCallout: 'line',
    annotationCalloutElbow: 'elbow',
    annotationCalloutCurve: 'curve',
    annotationCalloutCircle: 'line',
    annotationCalloutRect: 'line',
    annotationXYThreshold: 'none',
    annotationBadge: 'none'
  };

  const CURVE_MAP = {
    curveBasis: d3.curveBasis,
    curveCatmullRom: d3.curveCatmullRom,
    curveLinear: d3.curveLinear,
    curveStep: d3.curveStep
  };

  let annotations = [];
  let objects = [];
  let selectedId = null;
  let selectedObjId = null;
  let multiSelectedIds = new Set();
  let idCounter = 0;
  let currentTypeKey = 'annotationLabel';

  // Undo/Redo stacks
  let undoStack = [];
  let redoStack = [];
  const MAX_UNDO = 50;

  // Canvas settings
  let canvasSettings = {
    bgColor: '#faf9f7',
    customWidth: null,
    customHeight: null,
    snapGrid: false,
    snapGridSize: 20
  };

  const svg = d3.select('#canvas');
  const svgEl = document.getElementById('canvas');

  // ─── TOAST NOTIFICATION ───
  function showToast(msg, duration) {
    duration = duration || 2000;
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove('show'), duration);
  }

  // ─── UNDO / REDO ───
  function captureState() {
    const state = JSON.stringify({
      annotations: annotations.map(a => ({ ...a, connectorPoints: a.connectorPoints ? JSON.parse(JSON.stringify(a.connectorPoints)) : null })),
      objects: objects.map(o => ({ ...o })),
      idCounter,
      selectedId,
      selectedObjId,
      canvasSettings: { ...canvasSettings }
    });
    undoStack.push(state);
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack = [];
    updateUndoRedoButtons();
  }

  function undo() {
    if (undoStack.length === 0) return;
    const currentState = JSON.stringify({
      annotations: annotations.map(a => ({ ...a })),
      objects: objects.map(o => ({ ...o })),
      idCounter, selectedId, selectedObjId,
      canvasSettings: { ...canvasSettings }
    });
    redoStack.push(currentState);
    const prev = JSON.parse(undoStack.pop());
    restoreState(prev);
    showToast('Undo');
  }

  function redo() {
    if (redoStack.length === 0) return;
    const currentState = JSON.stringify({
      annotations: annotations.map(a => ({ ...a })),
      objects: objects.map(o => ({ ...o })),
      idCounter, selectedId, selectedObjId,
      canvasSettings: { ...canvasSettings }
    });
    undoStack.push(currentState);
    const next = JSON.parse(redoStack.pop());
    restoreState(next);
    showToast('Redo');
  }

  function restoreState(state) {
    annotations = (state.annotations || []).map(a => ({ ...a }));
    objects = (state.objects || []).map(o => ({ ...o }));
    idCounter = state.idCounter || idCounter;
    selectedId = state.selectedId || null;
    selectedObjId = state.selectedObjId || null;
    if (state.canvasSettings) canvasSettings = { ...canvasSettings, ...state.canvasSettings };
    multiSelectedIds.clear();
    applyCanvasSettings();
    render();
    updateUI();
    updateUndoRedoButtons();
  }

  function updateUndoRedoButtons() {
    const ubtn = document.getElementById('tbUndo');
    const rbtn = document.getElementById('tbRedo');
    if (ubtn) ubtn.disabled = undoStack.length === 0;
    if (rbtn) rbtn.disabled = redoStack.length === 0;
  }

  // ─── SNAP TO GRID ───
  function snapValue(val) {
    if (!canvasSettings.snapGrid) return val;
    const gs = canvasSettings.snapGridSize || 20;
    return Math.round(val / gs) * gs;
  }

  function renderGrid() {
    svg.selectAll('.grid-line').remove();
    if (!canvasSettings.snapGrid) return;
    const w = svgEl.clientWidth || 800;
    const h = svgEl.clientHeight || 500;
    const gs = canvasSettings.snapGridSize || 20;
    const gridGroup = svg.insert('g', ':first-child').attr('class', 'grid-line-group');
    for (let x = gs; x < w; x += gs) {
      gridGroup.append('line').attr('class', 'grid-line')
          .attr('x1', x).attr('y1', 0).attr('x2', x).attr('y2', h);
    }
    for (let y = gs; y < h; y += gs) {
      gridGroup.append('line').attr('class', 'grid-line')
          .attr('x1', 0).attr('y1', y).attr('x2', w).attr('y2', y);
    }
  }

  // ─── INIT ───
  function init() {
    populateFontSelects();
    bindSidebarEvents();
    bindToolbarEvents();
    bindCanvasClick();
    bindFileInputs();
    bindKeyboardShortcuts();
    enablePanelToggles();
    applyCanvasSettings();
    updateUI();
    updateUndoRedoButtons();
  }

  function enablePanelToggles() {
    document.querySelectorAll('.panel-title').forEach(title => {
      title.addEventListener('click', () => {
        title.parentElement.classList.toggle('collapsed');
      });
    });
  }

  function populateFontSelects() {
    ['titleFont', 'labelFont'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = '';
      FONTS.forEach(f => {
        const o = document.createElement('option');
        o.value = f; o.textContent = f; o.style.fontFamily = f;
        sel.appendChild(o);
      });
    });
  }

  // ─── CANVAS SETTINGS ───
  function applyCanvasSettings() {
    if (canvasSettings.customWidth && canvasSettings.customHeight) {
      svgEl.style.width = canvasSettings.customWidth + 'px';
      svgEl.style.height = canvasSettings.customHeight + 'px';
    } else {
      svgEl.style.width = '100%';
      svgEl.style.height = '100%';
    }
    svgEl.style.background = canvasSettings.bgColor || '#faf9f7';
  }

  // ─── BUILD CONFIG ───
  function buildConfig(ann) {
    const svgW = svgEl.clientWidth || 800;
    const svgH = svgEl.clientHeight || 500;

    const cfg = {
      id: ann.id,
      x: ann.x,
      y: ann.y,
      note: {
        title: ann.title || '',
        label: ann.label || '',
        wrap: ann.wrap || 120,
        padding: ann.padding || 5,
        lineType: ann.noteLineType || 'none',
        orientation: ann.noteOrientation || 'topBottom',
        align: ann.noteAlign || 'middle'
      }
    };

    // Note positioning: offset vs absolute
    if (ann.notePositionMode === 'absolute') {
      cfg.nx = ann.nx != null ? ann.nx : (ann.x + 80);
      cfg.ny = ann.ny != null ? ann.ny : (ann.y - 60);
    } else {
      cfg.dx = ann.dx;
      cfg.dy = ann.dy;
    }

    // wrapSplitter (v2.1.0+)
    if (ann.wrapSplitterEnabled) {
      cfg.note.wrapSplitter = /\n/;
    }

    // bgPadding (v2.3.0+)
    if (ann.bgPadding && ann.bgPadding > 0) {
      cfg.note.bgPadding = ann.bgPadding;
    } else {
      const bp = {};
      let hasBp = false;
      ['top', 'bottom', 'left', 'right'].forEach(side => {
        const key = 'bgPadding' + side.charAt(0).toUpperCase() + side.slice(1);
        if (ann[key] && ann[key] > 0) { bp[side] = ann[key]; hasBp = true; }
      });
      if (hasBp) cfg.note.bgPadding = bp;
    }

    // Disable parts
    if (ann.disableParts && ann.disableParts.length > 0) {
      cfg.disable = ann.disableParts.slice();
    }

    // Color (v2.0)
    if (ann.color) {
      cfg.color = ann.color;
    }

    // Connector
    const nativeConn = TYPE_CONNECTOR[ann.typeKey] || 'none';
    const connType = ann.connectorType || nativeConn;

    if (connType !== 'none') {
      cfg.connector = { type: connType };
      if (ann.connectorEnd && ann.connectorEnd !== 'none') {
        cfg.connector.end = ann.connectorEnd;
      }
      // endScale (v2.1.0+)
      if (ann.connectorEndScale && ann.connectorEndScale !== 1) {
        cfg.connector.endScale = ann.connectorEndScale;
      }
      if (connType === 'curve') {
        cfg.connector.curve = CURVE_MAP[ann.curveType || 'curveCatmullRom'] || d3.curveCatmullRom;
        if (ann.connectorPoints) {
          cfg.connector.points = ann.connectorPoints;
        } else if (ann.curvePoints && ann.curvePoints > 0) {
          cfg.connector.points = ann.curvePoints;
        }
      }
    } else if (ann.connectorEnd && ann.connectorEnd !== 'none') {
      cfg.connector = { end: ann.connectorEnd };
      if (ann.connectorEndScale && ann.connectorEndScale !== 1) {
        cfg.connector.endScale = ann.connectorEndScale;
      }
    }

    // Subject settings per type
    const tk = ann.typeKey;
    if (tk === 'annotationCalloutCircle') {
      cfg.subject = { radius: ann.subjectRadius || 50, radiusPadding: 5 };
    } else if (tk === 'annotationCalloutRect') {
      cfg.subject = { width: ann.subjectWidth || 100, height: ann.subjectHeight || 60 };
    } else if (tk === 'annotationXYThreshold') {
      cfg.subject = ann.thresholdOrientation === 'vertical'
          ? { y1: 0, y2: svgH }
          : { x1: 0, x2: svgW };
    } else if (tk === 'annotationBadge') {
      cfg.subject = { text: ann.badgeText || 'A', radius: ann.badgeRadius || 14 };
      if (ann.subjectX !== undefined) cfg.subject.x = ann.subjectX;
      if (ann.subjectY !== undefined) cfg.subject.y = ann.subjectY;
    }

    return cfg;
  }

  // ─── RENDER ───
  function render() {
    svg.selectAll('.obj-layer').remove();
    svg.selectAll('.ann-layer').remove();
    svg.selectAll('.grid-line-group').remove();

    renderGrid();

    const items = [
      ...objects.map(o => ({ kind: 'obj', data: o, z: o.zIndex || 0 })),
      ...annotations.map(a => ({ kind: 'ann', data: a, z: a.zIndex || 10 }))
    ].sort((a, b) => a.z - b.z);

    items.forEach(item => {
      if (item.kind === 'obj') renderObject(item.data);
      else renderAnnotation(item.data);
    });

    updateCounts();
    renderObjectsList();
  }

  function renderAnnotation(ann) {
    const group = svg.append('g')
        .attr('class', 'ann-layer ann-group'
            + (ann.id === selectedId ? ' selected' : '')
            + (multiSelectedIds.has(ann.id) ? ' multi-selected' : ''))
        .attr('id', 'ann-' + ann.id)
        .attr('data-id', ann.id)
        .style('cursor', 'pointer');

    const svgW = svgEl.clientWidth || 800;
    const svgH = svgEl.clientHeight || 500;

    const makeAnn = annotation()
        .type(TYPE_MAP[ann.typeKey] || annotationLabel)
        .annotations([buildConfig(ann)])
        .editMode(ann.id === selectedId);

    function syncAnn(annObj) {
      if (!annObj) return;
      if (annObj.x != null) ann.x = snapValue(annObj.x);
      if (annObj.y != null) ann.y = snapValue(annObj.y);
      if (annObj.dx != null) ann.dx = annObj.dx;
      if (annObj.dy != null) ann.dy = annObj.dy;
      // Sync nx/ny if in absolute mode
      if (ann.notePositionMode === 'absolute') {
        if (annObj.nx != null) ann.nx = annObj.nx;
        if (annObj.ny != null) ann.ny = annObj.ny;
      }
      if (annObj.subject) {
        if (ann.typeKey === 'annotationCalloutCircle' && annObj.subject.radius)
          ann.subjectRadius = annObj.subject.radius;
        if (ann.typeKey === 'annotationCalloutRect') {
          if (annObj.subject.width) ann.subjectWidth = annObj.subject.width;
          if (annObj.subject.height) ann.subjectHeight = annObj.subject.height;
        }
        if (ann.typeKey === 'annotationBadge') {
          if (annObj.subject.radius) ann.badgeRadius = annObj.subject.radius;
          if (annObj.subject.x !== undefined) ann.subjectX = annObj.subject.x;
          if (annObj.subject.y !== undefined) ann.subjectY = annObj.subject.y;
        }
      }
      if (annObj.connector && annObj.connector.points) {
        ann.connectorPoints = JSON.parse(JSON.stringify(annObj.connector.points));
      }
      if (ann.typeKey === 'annotationXYThreshold')
        applyThresholdLine(group, ann, svgW, svgH);
      // Update sidebar fields if this is the selected annotation
      if (ann.id === selectedId) updateUI();
    }

    makeAnn.on('dragstart', function () {
      captureState();
    });
    makeAnn.on('dragend', syncAnn);

    try { group.call(makeAnn); } catch (e) { console.error('Ann render error', ann.id, e); }

    if (ann.typeKey === 'annotationXYThreshold')
      applyThresholdLine(group, ann, svgW, svgH);

    // ─── APPLY COLORS / STYLES ───
    const c = ann.color || '#E8336D';

    group.selectAll('path').each(function () {
      const p = d3.select(this);
      const cls = this.getAttribute('class') || '';
      if (cls.includes('connector-arrow')) {
        p.style('fill', c).style('stroke', c).style('stroke-width', '1.5px');
      } else if (cls.includes('subject-pointer') || (cls.includes('subject') && !cls.includes('subject-ring'))) {
        if (ann.typeKey === 'annotationCalloutCircle' || ann.typeKey === 'annotationCalloutRect') {
          const sf = ann.subjectFill || c;
          const isTransp = sf === 'transparent' || sf === 'none';
          p.style('fill', isTransp ? 'none' : sf)
              .style('fill-opacity', isTransp ? '0' : String(ann.subjectFillOpacity || 0.1))
              .style('stroke', c).style('stroke-width', '1.5px');
        } else {
          p.style('fill', c).style('stroke', c).style('stroke-width', '1.5px');
        }
      } else {
        p.style('fill', 'none').style('stroke', c).style('stroke-width', '1.5px');
      }
    });

    group.selectAll('.connector-dot')
        .style('fill', c).style('stroke', c);

    group.selectAll('path.subject-ring')
        .style('fill', 'white').style('stroke', c).style('stroke-width', '3px');

    group.selectAll('text:not(.badge-text)').style('fill', c).style('stroke', 'none');

    group.selectAll('.annotation-note-bg')
        .style('fill', 'transparent').style('fill-opacity', '0')
        .attr('fill', 'transparent');

    const titleFs = ann.titleFontSize || 13;
    const labelFs = ann.labelFontSize || 12;

    group.selectAll('.annotation-note-title')
        .style('font-family', `'${ann.titleFont || 'Inter'}', sans-serif`)
        .style('font-size', titleFs + 'px')
        .style('font-weight', String(ann.titleFontWeight || 700));

    group.selectAll('.annotation-note-label')
        .style('font-family', `'${ann.labelFont || 'Inter'}', sans-serif`)
        .style('font-size', labelFs + 'px')
        .style('font-weight', String(ann.labelFontWeight || 400));

    // Fix title/label overlap
    const titleNode = group.select('.annotation-note-title').node();
    const labelNode = group.select('.annotation-note-label').node();
    if (titleNode && labelNode) {
      try {
        const tBox = titleNode.getBBox();
        const lBox = labelNode.getBBox();
        const gap = 4;
        const expectedLabelY = tBox.y + tBox.height + gap;
        if (lBox.y < expectedLabelY) {
          const delta = expectedLabelY - lBox.y;
          const curY = parseFloat(labelNode.getAttribute('y') || 0);
          labelNode.setAttribute('y', curY + delta);
        }
      } catch (e) { }
    }

    // Click handler with multi-select support
    group.on('click', function () {
      d3.event.stopPropagation();
      if (d3.event.shiftKey) {
        // Multi-select toggle
        if (multiSelectedIds.has(ann.id)) {
          multiSelectedIds.delete(ann.id);
        } else {
          multiSelectedIds.add(ann.id);
        }
        render();
        return;
      }
      multiSelectedIds.clear();
      if (selectedId !== ann.id) {
        selectedId = ann.id;
        selectedObjId = null;
        render();
        updateUI();
      }
    });
  }

  function applyThresholdLine(group, ann, svgW, svgH) {
    const line = group.select('line.subject');
    if (!line.empty()) {
      if (ann.thresholdOrientation === 'vertical') {
        line.attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', svgH);
      } else {
        line.attr('x1', 0).attr('x2', svgW).attr('y1', 0).attr('y2', 0);
      }
    }
  }

  // ─── RENDER OBJECT ───
  function renderObject(obj) {
    const isSelected = obj.id === selectedObjId;
    const g = svg.append('g')
        .attr('class', 'obj-layer obj-group' + (isSelected ? ' selected' : ''))
        .attr('data-obj-id', obj.id)
        .attr('transform', buildObjTransform(obj))
        .style('opacity', obj.opacity != null ? obj.opacity : 1);

    if (obj.background && obj.background !== 'transparent') {
      g.append('rect')
          .attr('width', obj.width || 200).attr('height', obj.height || 150)
          .attr('fill', obj.background).attr('rx', 4);
    }

    const w = obj.width || 200;
    const h = obj.height || 150;

    if (obj.type === 'image') {
      g.append('image')
          .attr('href', obj.data)
          .attr('width', w).attr('height', h)
          .attr('preserveAspectRatio', 'xMidYMid meet');
    } else if (obj.type === 'svg') {
      const foreign = g.append('g').attr('class', 'embedded-svg');
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(obj.data, 'image/svg+xml');
        const innerSvg = doc.documentElement;

        if (!innerSvg.getAttribute('viewBox')) {
          const iw = parseFloat(innerSvg.getAttribute('width'));
          const ih = parseFloat(innerSvg.getAttribute('height'));
          if (iw > 0 && ih > 0) {
            innerSvg.setAttribute('viewBox', `0 0 ${iw} ${ih}`);
          } else if (obj.originalWidth && obj.originalHeight) {
            innerSvg.setAttribute('viewBox', `0 0 ${obj.originalWidth} ${obj.originalHeight}`);
          }
        }

        innerSvg.setAttribute('width', w);
        innerSvg.setAttribute('height', h);
        innerSvg.setAttribute('x', 0);
        innerSvg.setAttribute('y', 0);
        innerSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        foreign.node().appendChild(document.importNode(innerSvg, true));
      } catch (e) { console.error('SVG object parse error', e); }
    } else if (obj.type === 'rect') {
      g.append('rect').attr('width', w).attr('height', h)
          .attr('fill', obj.shapeColor || '#2196F3').attr('fill-opacity', 0.5)
          .attr('stroke', obj.shapeColor || '#2196F3').attr('rx', 4);
    } else if (obj.type === 'circle') {
      const r = Math.min(w, h) / 2;
      g.append('circle').attr('cx', r).attr('cy', r).attr('r', r)
          .attr('fill', obj.shapeColor || '#10B981').attr('fill-opacity', 0.5)
          .attr('stroke', obj.shapeColor || '#10B981');
    }

    if (!obj.locked) {
      g.call(d3.drag()
          .on('start', function () {
            d3.event.sourceEvent.stopPropagation();
            captureState();
            selectObject(obj.id);
          })
          .on('drag', function () {
            if (d3.event.sourceEvent.target.classList.contains('resize-handle') ||
                d3.event.sourceEvent.target.classList.contains('rotate-handle')) return;
            obj.x = snapValue((obj.x || 0) + d3.event.dx);
            obj.y = snapValue((obj.y || 0) + d3.event.dy);
            d3.select(this).attr('transform', buildObjTransform(obj));
            syncObjProps();
          })
      );
    }

    g.on('click', function () {
      d3.event.stopPropagation();
      selectObject(obj.id);
    });

    if (isSelected && !obj.locked) addObjectHandles(g, obj);
  }

  function buildObjTransform(obj) {
    const x = obj.x || 0, y = obj.y || 0;
    const cx = (obj.width || 200) / 2, cy = (obj.height || 150) / 2;
    const rot = obj.rotation || 0;
    return `translate(${x},${y}) rotate(${rot},${cx},${cy})`;
  }

  function addObjectHandles(g, obj) {
    const w = obj.width || 200;
    const h = obj.height || 150;
    const hs = 8;

    g.append('rect').attr('class', 'obj-sel-border')
        .attr('x', -2).attr('y', -2).attr('width', w + 4).attr('height', h + 4)
        .attr('fill', 'none').attr('stroke', '#E8336D')
        .attr('stroke-width', '1.5').attr('stroke-dasharray', '6,3')
        .attr('pointer-events', 'none');

    const corners = [
      { name: 'se', cx: w, cy: h, cursor: 'se-resize', dx: 1, dy: 1 },
      { name: 'sw', cx: 0, cy: h, cursor: 'sw-resize', dx: -1, dy: 1 },
      { name: 'ne', cx: w, cy: 0, cursor: 'ne-resize', dx: 1, dy: -1 },
      { name: 'nw', cx: 0, cy: 0, cursor: 'nw-resize', dx: -1, dy: -1 }
    ];

    corners.forEach(corner => {
      g.append('rect').attr('class', 'resize-handle')
          .attr('x', corner.cx - hs / 2).attr('y', corner.cy - hs / 2)
          .attr('width', hs).attr('height', hs)
          .attr('fill', 'white').attr('stroke', '#E8336D').attr('stroke-width', '1.5')
          .attr('cursor', corner.cursor).attr('rx', 2)
          .call(d3.drag()
              .on('start', function () {
                d3.event.sourceEvent.stopPropagation();
                captureState();
              })
              .on('drag', function () {
                const ddx = d3.event.dx * corner.dx;
                const ddy = d3.event.dy * corner.dy;
                obj.width = Math.max(20, (obj.width || 200) + ddx);
                obj.height = Math.max(20, (obj.height || 150) + ddy);
                if (corner.dx === -1) obj.x = (obj.x || 0) + d3.event.dx;
                if (corner.dy === -1) obj.y = (obj.y || 0) + d3.event.dy;
                render();
                syncObjProps();
              })
          );
    });

    const rotX = w / 2, rotY = -24;
    g.append('line')
        .attr('x1', w / 2).attr('y1', 0).attr('x2', rotX).attr('y2', rotY)
        .attr('stroke', '#E8336D').attr('stroke-width', '1.5')
        .attr('pointer-events', 'none');

    g.append('circle').attr('class', 'rotate-handle')
        .attr('cx', rotX).attr('cy', rotY).attr('r', 6)
        .attr('fill', 'white').attr('stroke', '#E8336D').attr('stroke-width', '1.5')
        .attr('cursor', 'grab')
        .call(d3.drag()
            .on('start', function () {
              d3.event.sourceEvent.stopPropagation();
              captureState();
            })
            .on('drag', function () {
              const ccx = (obj.x || 0) + (obj.width || 200) / 2;
              const ccy = (obj.y || 0) + (obj.height || 150) / 2;
              const svgRect = svgEl.getBoundingClientRect();
              const mx = d3.event.sourceEvent.clientX - svgRect.left;
              const my = d3.event.sourceEvent.clientY - svgRect.top;
              const angle = Math.atan2(my - ccy, mx - ccx) * 180 / Math.PI + 90;
              obj.rotation = Math.round(angle);
              d3.select(g.node()).attr('transform', buildObjTransform(obj));
            })
        );
  }

  // ─── SELECTION ───
  function selectAnnotation(id) {
    if (selectedId !== id) {
      selectedId = id;
      selectedObjId = null;
      multiSelectedIds.clear();
      render();
      updateUI();
    }
  }

  function selectObject(id) {
    if (selectedObjId === id) return;
    selectedObjId = id;
    selectedId = null;
    multiSelectedIds.clear();
    svg.selectAll('g.ann-group').classed('selected', false);
    render();
    updateUI();
  }

  function deselect() {
    if (selectedId !== null || selectedObjId !== null || multiSelectedIds.size > 0) {
      selectedId = null;
      selectedObjId = null;
      multiSelectedIds.clear();
      render();
      updateUI();
    }
  }

  // ─── UPDATE UI ───
  function updateUI() {
    const ann = annotations.find(a => a.id === selectedId);
    const obj = objects.find(o => o.id === selectedObjId);

    const info = document.getElementById('selectionInfo');
    if (!info) return;

    if (ann) info.innerHTML = `<span style="color:var(--accent)">Annotation #${ann.id} — ${ann.typeKey.replace('annotation', '')}</span>`;
    else if (obj) info.innerHTML = `<span style="color:var(--accent)">Object: ${obj.originalFilename || obj.type}</span>`;
    else if (multiSelectedIds.size > 0) info.innerHTML = `<span style="color:var(--accent)">${multiSelectedIds.size} annotations selected (Shift+Click)</span>`;
    else info.innerHTML = '<span class="no-selection">No annotation selected</span>';

    const btnDelete = document.getElementById('btnDelete');
    if (btnDelete) btnDelete.style.display = (ann || multiSelectedIds.size > 0) ? '' : 'none';

    if (ann) {
      setActivePreset(ann.typeKey);
      if (document.getElementById('editTitle')) document.getElementById('editTitle').value = ann.title || '';
      if (document.getElementById('editLabel')) document.getElementById('editLabel').value = ann.label || '';
      if (document.getElementById('textWrap')) document.getElementById('textWrap').value = ann.wrap || 120;
      if (document.getElementById('padding')) document.getElementById('padding').value = ann.padding || 5;
      if (document.getElementById('titleFont')) document.getElementById('titleFont').value = ann.titleFont || 'Inter';
      if (document.getElementById('titleFontSize')) document.getElementById('titleFontSize').value = ann.titleFontSize || 13;
      if (document.getElementById('titleFontWeight')) document.getElementById('titleFontWeight').value = ann.titleFontWeight || 700;
      if (document.getElementById('labelFont')) document.getElementById('labelFont').value = ann.labelFont || 'Inter';
      if (document.getElementById('labelFontSize')) document.getElementById('labelFontSize').value = ann.labelFontSize || 12;
      if (document.getElementById('labelFontWeight')) document.getElementById('labelFontWeight').value = ann.labelFontWeight || 400;
      if (document.getElementById('customColor')) document.getElementById('customColor').value = ann.color || '#E8336D';
      syncColorSwatches(ann.color || '#E8336D');
      setOptGroup('noteLineType', ann.noteLineType || 'none');
      setOptGroup('noteOrientation', ann.noteOrientation || 'topBottom');
      setOptGroup('noteAlign', ann.noteAlign || 'middle');
      setOptGroup('connectorType', ann.connectorType || TYPE_CONNECTOR[ann.typeKey] || 'line');
      setOptGroup('connectorEnd', ann.connectorEnd || 'none');

      // Connector endScale
      const endScaleEl = document.getElementById('connectorEndScale');
      const endScaleVal = document.getElementById('connectorEndScaleVal');
      if (endScaleEl) endScaleEl.value = ann.connectorEndScale || 1;
      if (endScaleVal) endScaleVal.textContent = ann.connectorEndScale || 1;

      // Note position mode
      setOptGroup('notePositionMode', ann.notePositionMode || 'offset');
      const offsetFields = document.getElementById('offsetFields');
      const absoluteFields = document.getElementById('absoluteFields');
      if (offsetFields) offsetFields.style.display = ann.notePositionMode === 'absolute' ? 'none' : '';
      if (absoluteFields) absoluteFields.style.display = ann.notePositionMode === 'absolute' ? '' : 'none';
      if (document.getElementById('annDx')) document.getElementById('annDx').value = Math.round(ann.dx || 80);
      if (document.getElementById('annDy')) document.getElementById('annDy').value = Math.round(ann.dy || -60);
      if (document.getElementById('annNx')) document.getElementById('annNx').value = Math.round(ann.nx || (ann.x + 80));
      if (document.getElementById('annNy')) document.getElementById('annNy').value = Math.round(ann.ny || (ann.y - 60));

      // wrapSplitter
      const wsEl = document.getElementById('wrapSplitterEnabled');
      if (wsEl) wsEl.checked = !!ann.wrapSplitterEnabled;

      // bgPadding
      if (document.getElementById('bgPadding')) document.getElementById('bgPadding').value = ann.bgPadding || 0;
      if (document.getElementById('bgPaddingTop')) document.getElementById('bgPaddingTop').value = ann.bgPaddingTop || 0;
      if (document.getElementById('bgPaddingBottom')) document.getElementById('bgPaddingBottom').value = ann.bgPaddingBottom || 0;
      if (document.getElementById('bgPaddingLeft')) document.getElementById('bgPaddingLeft').value = ann.bgPaddingLeft || 0;
      if (document.getElementById('bgPaddingRight')) document.getElementById('bgPaddingRight').value = ann.bgPaddingRight || 0;

      // Disable parts
      const dc = document.getElementById('disableConnector');
      const ds = document.getElementById('disableSubject');
      const dn = document.getElementById('disableNote');
      const parts = ann.disableParts || [];
      if (dc) dc.checked = parts.includes('connector');
      if (ds) ds.checked = parts.includes('subject');
      if (dn) dn.checked = parts.includes('note');

      // Subject fill
      const needsFill = ann.typeKey === 'annotationCalloutCircle' || ann.typeKey === 'annotationCalloutRect';
      const sfp = document.getElementById('subjectFillPanel');
      if (sfp) sfp.style.display = needsFill ? '' : 'none';
      if (needsFill) {
        const sf = ann.subjectFill || ann.color || '#E8336D';
        if (document.getElementById('subjectFillColor')) document.getElementById('subjectFillColor').value = (sf === 'transparent' || sf === 'none') ? '#E8336D' : sf;
        if (document.getElementById('subjectFillOpacity')) document.getElementById('subjectFillOpacity').value = ann.subjectFillOpacity || 0.1;
        if (document.getElementById('subjectFillOpacityVal')) document.getElementById('subjectFillOpacityVal').textContent = ann.subjectFillOpacity || 0.1;
      }

      // Threshold
      const tp = document.getElementById('thresholdPanel');
      if (tp) tp.style.display = ann.typeKey === 'annotationXYThreshold' ? '' : 'none';
      if (ann.typeKey === 'annotationXYThreshold') setOptGroup('thresholdDir', ann.thresholdOrientation || 'horizontal');

      // Curve panel
      const isCurve = ann.typeKey === 'annotationCalloutCurve' || ann.connectorType === 'curve';
      const cp = document.getElementById('curvePanel');
      if (cp) cp.style.display = isCurve ? '' : 'none';
      if (isCurve) {
        const ctEl = document.getElementById('curveType');
        if (ctEl) ctEl.value = ann.curveType || 'curveCatmullRom';
        const cpEl = document.getElementById('curvePoints');
        if (cpEl) cpEl.value = ann.curvePoints || 2;
      }

      if (document.getElementById('subjectRadius')) document.getElementById('subjectRadius').value = ann.subjectRadius || 50;
      if (document.getElementById('subjectWidth')) document.getElementById('subjectWidth').value = ann.subjectWidth || 100;
      if (document.getElementById('subjectHeight')) document.getElementById('subjectHeight').value = ann.subjectHeight || 60;
      if (document.getElementById('annZIndex')) document.getElementById('annZIndex').value = ann.zIndex || 10;
      if (document.getElementById('badgeText')) document.getElementById('badgeText').value = ann.badgeText || 'A';
      if (document.getElementById('badgeRadius')) document.getElementById('badgeRadius').value = ann.badgeRadius || 14;
    }

    // Object props panel
    const op = document.getElementById('objPropsPanel');
    if (op) op.style.display = obj ? '' : 'none';
    if (obj) syncObjProps();

    // Canvas settings fields
    const cwEl = document.getElementById('canvasWidth');
    const chEl = document.getElementById('canvasHeight');
    if (cwEl && !cwEl.matches(':focus')) cwEl.value = canvasSettings.customWidth || svgEl.clientWidth || 800;
    if (chEl && !chEl.matches(':focus')) chEl.value = canvasSettings.customHeight || svgEl.clientHeight || 500;
    const cbgEl = document.getElementById('canvasBgColor');
    if (cbgEl) cbgEl.value = canvasSettings.bgColor || '#faf9f7';
    const sgEl = document.getElementById('snapGridEnabled');
    if (sgEl) sgEl.checked = !!canvasSettings.snapGrid;
    const sgoEl = document.getElementById('snapGridOptions');
    if (sgoEl) sgoEl.style.display = canvasSettings.snapGrid ? '' : 'none';
    const sgsEl = document.getElementById('snapGridSize');
    if (sgsEl && !sgsEl.matches(':focus')) sgsEl.value = canvasSettings.snapGridSize || 20;
  }

  function syncObjProps() {
    const obj = objects.find(o => o.id === selectedObjId);
    if (!obj) return;
    if (document.getElementById('objX')) document.getElementById('objX').value = Math.round(obj.x || 0);
    if (document.getElementById('objY')) document.getElementById('objY').value = Math.round(obj.y || 0);
    if (document.getElementById('objW')) document.getElementById('objW').value = Math.round(obj.width || 200);
    if (document.getElementById('objH')) document.getElementById('objH').value = Math.round(obj.height || 150);
    if (document.getElementById('objOpacity')) document.getElementById('objOpacity').value = obj.opacity != null ? obj.opacity : 1;
    if (document.getElementById('objOpacityVal')) document.getElementById('objOpacityVal').textContent = obj.opacity != null ? obj.opacity : 1;

    const lockBtn = document.getElementById('objLock');
    if (lockBtn) {
      lockBtn.textContent = obj.locked ? '🔓 Unlock' : '🔒 Lock';
      lockBtn.classList.toggle('active', !!obj.locked);
    }
  }

  function setActivePreset(typeKey) {
    document.querySelectorAll('#presetsGrid .preset-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.type === typeKey));
  }

  function setOptGroup(group, val) {
    document.querySelectorAll(`[data-group="${group}"] .opt-btn`).forEach(b =>
        b.classList.toggle('active', b.dataset.val === val));
  }

  function syncColorSwatches(color) {
    document.querySelectorAll('#colorSwatches .color-swatch').forEach(s =>
        s.classList.toggle('active', s.dataset.color === color));
  }

  function updateCounts() {
    if (document.getElementById('annCount')) document.getElementById('annCount').textContent = annotations.length;
    if (document.getElementById('objCount')) document.getElementById('objCount').textContent = objects.length;
  }

  function renderObjectsList() {
    const list = document.getElementById('objectsList');
    if (!list) return;
    list.innerHTML = '';
    objects.forEach(obj => {
      const div = document.createElement('div');
      div.className = 'obj-item' + (obj.id === selectedObjId ? ' active' : '');
      div.innerHTML = `<span>${obj.locked ? '🔒 ' : ''}${obj.originalFilename || obj.type} (z:${obj.zIndex || 0})</span>
        <div class="obj-actions">
          <button data-oid="${obj.id}" data-act="up" title="Z up">↑</button>
          <button data-oid="${obj.id}" data-act="down" title="Z down">↓</button>
          <button data-oid="${obj.id}" data-act="del" title="Remove">✕</button>
        </div>`;
      div.addEventListener('click', () => selectObject(obj.id));
      div.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const act = btn.dataset.act, oid = btn.dataset.oid;
          const o = objects.find(x => x.id === oid);
          if (!o) return;
          captureState();
          if (act === 'up') o.zIndex = (o.zIndex || 0) + 1;
          else if (act === 'down') o.zIndex = Math.max(0, (o.zIndex || 0) - 1);
          else if (act === 'del') { objects = objects.filter(x => x.id !== oid); selectedObjId = null; }
          render(); updateUI();
        });
      });
      list.appendChild(div);
    });
  }

  // ─── CANVAS CLICK ───
  function bindCanvasClick() {
    svg.on('click', function () {
      if (d3.event.target === svgEl) {
        if (d3.event.shiftKey) {
          // Shift+click on canvas deselects
          deselect();
          return;
        }
        const coords = d3.mouse(this);
        addAnnotation(coords[0], coords[1]);
      }
    });
  }

  function addAnnotation(x, y) {
    captureState();
    idCounter++;
    const tk = currentTypeKey;
    const nativeConn = TYPE_CONNECTOR[tk] || 'line';
    const ann = {
      id: idCounter, typeKey: tk,
      x: snapValue(x), y: snapValue(y),
      dx: 80 + Math.random() * 20, dy: -60 - Math.random() * 20,
      title: 'Title', label: 'Description',
      wrap: 120, padding: 5,
      noteLineType: 'none', noteOrientation: 'topBottom', noteAlign: 'middle',
      notePositionMode: 'offset',
      nx: null, ny: null,
      connectorType: nativeConn,
      connectorEnd: 'none',
      connectorEndScale: 1,
      curveType: 'curveCatmullRom', curvePoints: 2,
      color: '#E8336D',
      titleFont: 'Inter', titleFontSize: 13, titleFontWeight: 700,
      labelFont: 'Inter', labelFontSize: 12, labelFontWeight: 400,
      subjectFill: '#E8336D', subjectFillOpacity: 0.1,
      subjectRadius: 50, subjectWidth: 100, subjectHeight: 60,
      thresholdOrientation: 'horizontal',
      badgeText: 'A', badgeRadius: 14,
      zIndex: 10,
      disableParts: [],
      wrapSplitterEnabled: false,
      bgPadding: 0,
      bgPaddingTop: 0, bgPaddingBottom: 0, bgPaddingLeft: 0, bgPaddingRight: 0
    };
    annotations.push(ann);
    render();
    selectAnnotation(ann.id);
  }

  // ─── KEYBOARD SHORTCUTS ───
  function bindKeyboardShortcuts() {
    document.addEventListener('keydown', function (e) {
      // Don't capture when typing in inputs
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      // Ctrl+Z / Cmd+Z = Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      // Ctrl+Y / Cmd+Shift+Z = Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }
      // Ctrl+S = Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveProject();
        showToast('Project saved');
        return;
      }
      // Ctrl+A = Select all annotations
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        multiSelectedIds.clear();
        annotations.forEach(a => multiSelectedIds.add(a.id));
        render();
        updateUI();
        return;
      }

      // Delete / Backspace = Remove selected
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId !== null) {
          captureState();
          annotations = annotations.filter(a => a.id !== selectedId);
          selectedId = null;
          render(); updateUI();
          showToast('Annotation deleted');
        } else if (multiSelectedIds.size > 0) {
          captureState();
          annotations = annotations.filter(a => !multiSelectedIds.has(a.id));
          multiSelectedIds.clear();
          selectedId = null;
          render(); updateUI();
          showToast('Annotations deleted');
        } else if (selectedObjId !== null) {
          captureState();
          objects = objects.filter(o => o.id !== selectedObjId);
          selectedObjId = null;
          render(); updateUI();
          showToast('Object deleted');
        }
        return;
      }

      // Escape = Deselect
      if (e.key === 'Escape') {
        deselect();
        return;
      }

      // Arrow keys = Nudge selected annotation or object
      const nudge = e.shiftKey ? 10 : 1;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const dx = e.key === 'ArrowLeft' ? -nudge : e.key === 'ArrowRight' ? nudge : 0;
        const dy = e.key === 'ArrowUp' ? -nudge : e.key === 'ArrowDown' ? nudge : 0;

        if (selectedId !== null) {
          captureState();
          const ann = annotations.find(a => a.id === selectedId);
          if (ann) {
            ann.x = snapValue(ann.x + dx);
            ann.y = snapValue(ann.y + dy);
            render(); updateUI();
          }
        } else if (multiSelectedIds.size > 0) {
          captureState();
          annotations.forEach(a => {
            if (multiSelectedIds.has(a.id)) {
              a.x = snapValue(a.x + dx);
              a.y = snapValue(a.y + dy);
            }
          });
          render();
        } else if (selectedObjId !== null) {
          captureState();
          const obj = objects.find(o => o.id === selectedObjId);
          if (obj && !obj.locked) {
            obj.x = snapValue((obj.x || 0) + dx);
            obj.y = snapValue((obj.y || 0) + dy);
            render(); syncObjProps();
          }
        }
        return;
      }

      // D = Duplicate selected annotation
      if (e.key === 'd' || e.key === 'D') {
        if (selectedId !== null) {
          captureState();
          const src = annotations.find(a => a.id === selectedId);
          if (src) {
            idCounter++;
            const dup = { ...src, id: idCounter, x: src.x + 30, y: src.y + 30 };
            if (dup.connectorPoints) dup.connectorPoints = JSON.parse(JSON.stringify(src.connectorPoints));
            annotations.push(dup);
            render();
            selectAnnotation(dup.id);
            showToast('Annotation duplicated');
          }
        }
        return;
      }
    });
  }

  // ─── BIND SIDEBAR EVENTS ───
  function bindSidebarEvents() {
    // Annotation type presets
    document.querySelectorAll('#presetsGrid .preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentTypeKey = btn.dataset.type;
        setActivePreset(currentTypeKey);
        const ann = annotations.find(a => a.id === selectedId);
        if (ann) {
          captureState();
          ann.typeKey = currentTypeKey;
          ann.connectorType = TYPE_CONNECTOR[currentTypeKey] || 'line';
          render(); updateUI();
        }
      });
    });

    // Delete button
    const btnDelete = document.getElementById('btnDelete');
    if (btnDelete) {
      btnDelete.addEventListener('click', () => {
        captureState();
        if (multiSelectedIds.size > 0) {
          annotations = annotations.filter(a => !multiSelectedIds.has(a.id));
          multiSelectedIds.clear();
        }
        annotations = annotations.filter(a => a.id !== selectedId);
        selectedId = null;
        render(); updateUI();
      });
    }

    // Title input
    const editTitle = document.getElementById('editTitle');
    if (editTitle) {
      editTitle.addEventListener('input', function () {
        const ann = annotations.find(a => a.id === selectedId); if (!ann) return;
        ann.title = this.value; render();
      });
    }

    // Label input
    const editLabel = document.getElementById('editLabel');
    if (editLabel) {
      editLabel.addEventListener('input', function () {
        const ann = annotations.find(a => a.id === selectedId); if (!ann) return;
        ann.label = this.value; render();
      });
    }

    // Text wrap
    const textWrap = document.getElementById('textWrap');
    if (textWrap) {
      textWrap.addEventListener('input', function () {
        const ann = annotations.find(a => a.id === selectedId); if (!ann) return;
        ann.wrap = +this.value; render();
      });
    }

    // Padding
    const padding = document.getElementById('padding');
    if (padding) {
      padding.addEventListener('input', function () {
        const ann = annotations.find(a => a.id === selectedId); if (!ann) return;
        ann.padding = +this.value; render();
      });
    }

    // wrapSplitter checkbox
    const wsEl = document.getElementById('wrapSplitterEnabled');
    if (wsEl) {
      wsEl.addEventListener('change', function () {
        const ann = annotations.find(a => a.id === selectedId); if (!ann) return;
        ann.wrapSplitterEnabled = this.checked; render();
      });
    }

    // bgPadding fields
    ['bgPadding', 'bgPaddingTop', 'bgPaddingBottom', 'bgPaddingLeft', 'bgPaddingRight'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', function () {
          const ann = annotations.find(a => a.id === selectedId); if (!ann) return;
          ann[id] = +this.value; render();
        });
      }
    });

    // Global wrap / padding apply
    const applyGlobalWrap = document.getElementById('applyGlobalWrap');
    if (applyGlobalWrap) {
      applyGlobalWrap.addEventListener('click', () => {
        const wrap = +(document.getElementById('textWrap').value || 120);
        captureState();
        annotations.forEach(a => a.wrap = wrap);
        render();
        showToast('Wrap applied to all');
      });
    }

    const applyGlobalPadding = document.getElementById('applyGlobalPadding');
    if (applyGlobalPadding) {
      applyGlobalPadding.addEventListener('click', () => {
        const pad = +(document.getElementById('padding').value || 5);
        captureState();
        annotations.forEach(a => a.padding = pad);
        render();
        showToast('Padding applied to all');
      });
    }

    // Font inputs
    ['titleFont', 'titleFontSize', 'titleFontWeight', 'labelFont', 'labelFontSize', 'labelFontWeight'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', function () {
          const ann = annotations.find(a => a.id === selectedId); if (!ann) return;
          ann[id] = id.includes('Size') || id.includes('Weight') ? +this.value : this.value;
          render();
        });
      }
    });

    // Apply all title font
    const applyAllTitleFont = document.getElementById('applyAllTitleFont');
    if (applyAllTitleFont) {
      applyAllTitleFont.addEventListener('click', () => {
        const font = document.getElementById('titleFont').value;
        const size = +document.getElementById('titleFontSize').value;
        const weight = +document.getElementById('titleFontWeight').value;
        captureState();
        annotations.forEach(a => { a.titleFont = font; a.titleFontSize = size; a.titleFontWeight = weight; });
        render();
        showToast('Title font applied to all');
      });
    }

    // Apply all label font
    const applyAllLabelFont = document.getElementById('applyAllLabelFont');
    if (applyAllLabelFont) {
      applyAllLabelFont.addEventListener('click', () => {
        const font = document.getElementById('labelFont').value;
        const size = +document.getElementById('labelFontSize').value;
        const weight = +document.getElementById('labelFontWeight').value;
        captureState();
        annotations.forEach(a => { a.labelFont = font; a.labelFontSize = size; a.labelFontWeight = weight; });
        render();
        showToast('Label font applied to all');
      });
    }

    // Color swatches
    document.querySelectorAll('#colorSwatches .color-swatch').forEach(s => {
      s.addEventListener('click', () => {
        applyColor(s.dataset.color);
        document.getElementById('customColor').value = s.dataset.color;
      });
    });

    // Custom color picker
    const customColor = document.getElementById('customColor');
    if (customColor) {
      customColor.addEventListener('input', function () { applyColor(this.value); });
    }

    // Subject fill color
    const subjectFillColor = document.getElementById('subjectFillColor');
    if (subjectFillColor) {
      subjectFillColor.addEventListener('input', function () {
        const ann = annotations.find(a => a.id === selectedId); if (!ann) return;
        ann.subjectFill = this.value; render();
      });
    }

    // Subject fill transparent
    const subjectFillTransparent = document.getElementById('subjectFillTransparent');
    if (subjectFillTransparent) {
      subjectFillTransparent.addEventListener('click', () => {
        const ann = annotations.find(a => a.id === selectedId); if (!ann) return;
        ann.subjectFill = 'transparent'; render();
      });
    }

    // Subject fill opacity
    const subjectFillOpacity = document.getElementById('subjectFillOpacity');
    if (subjectFillOpacity) {
      subjectFillOpacity.addEventListener('input', function () {
        const ann = annotations.find(a => a.id === selectedId); if (!ann) return;
        ann.subjectFillOpacity = +this.value;
        document.getElementById('subjectFillOpacityVal').textContent = this.value;
        render();
      });
    }

    // Connector end scale
    const connectorEndScale = document.getElementById('connectorEndScale');
    if (connectorEndScale) {
      connectorEndScale.addEventListener('input', function () {
        const ann = annotations.find(a => a.id === selectedId); if (!ann) return;
        ann.connectorEndScale = +this.value;
        document.getElementById('connectorEndScaleVal').textContent = this.value;
        render();
      });
    }

    // Disable parts checkboxes
    ['disableConnector', 'disableSubject', 'disableNote'].forEach(cbId => {
      const el = document.getElementById(cbId);
      if (el) {
        el.addEventListener('change', function () {
          const ann = annotations.find(a => a.id === selectedId); if (!ann) return;
          const part = cbId.replace('disable', '').toLowerCase();
          if (!ann.disableParts) ann.disableParts = [];
          if (this.checked) {
            if (!ann.disableParts.includes(part)) ann.disableParts.push(part);
          } else {
            ann.disableParts = ann.disableParts.filter(p => p !== part);
          }
          render();
        });
      }
    });

    // Note position mode + dx/dy/nx/ny fields
    const annDx = document.getElementById('annDx');
    const annDy = document.getElementById('annDy');
    const annNx = document.getElementById('annNx');
    const annNy = document.getElementById('annNy');

    if (annDx) {
      annDx.addEventListener('input', function () {
        const ann = annotations.find(a => a.id === selectedId); if (!ann) return;
        ann.dx = +this.value; render();
      });
    }
    if (annDy) {
      annDy.addEventListener('input', function () {
        const ann = annotations.find(a => a.id === selectedId); if (!ann) return;
        ann.dy = +this.value; render();
      });
    }
    if (annNx) {
      annNx.addEventListener('input', function () {
        const ann = annotations.find(a => a.id === selectedId); if (!ann) return;
        ann.nx = +this.value; render();
      });
    }
    if (annNy) {
      annNy.addEventListener('input', function () {
        const ann = annotations.find(a => a.id === selectedId); if (!ann) return;
        ann.ny = +this.value; render();
      });
    }

    // Option group buttons (noteLineType, noteOrientation, noteAlign, connectorType, connectorEnd, thresholdDir, notePositionMode)
    document.querySelectorAll('[data-group]').forEach(grpEl => {
      grpEl.querySelectorAll('.opt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const grp = grpEl.dataset.group, val = btn.dataset.val;
          setOptGroup(grp, val);
          const ann = annotations.find(a => a.id === selectedId); if (!ann) return;

          if (grp === 'noteLineType') ann.noteLineType = val;
          else if (grp === 'noteOrientation') ann.noteOrientation = val;
          else if (grp === 'noteAlign') ann.noteAlign = val;
          else if (grp === 'connectorType') ann.connectorType = val;
          else if (grp === 'connectorEnd') ann.connectorEnd = val;
          else if (grp === 'thresholdDir') ann.thresholdOrientation = val;
          else if (grp === 'notePositionMode') {
            ann.notePositionMode = val;
            if (val === 'absolute' && ann.nx == null) {
              ann.nx = ann.x + (ann.dx || 80);
              ann.ny = ann.y + (ann.dy || -60);
            }
          }
          render(); updateUI();
        });
      });
    });

    // Curve type / points
    const curveTypeEl = document.getElementById('curveType');
    if (curveTypeEl) {
      curveTypeEl.addEventListener('input', function () {
        const ann = annotations.find(a => a.id === selectedId); if (!ann) return;
        ann.curveType = this.value; render();
      });
    }
    const curvePointsEl = document.getElementById('curvePoints');
    if (curvePointsEl) {
      curvePointsEl.addEventListener('input', function () {
        const ann = annotations.find(a => a.id === selectedId); if (!ann) return;
        ann.curvePoints = +this.value;
        ann.connectorPoints = null;
        render();
      });
    }

    // Subject size / z-index / badge
    ['subjectRadius', 'subjectWidth', 'subjectHeight', 'annZIndex', 'badgeText', 'badgeRadius'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', function () {
        const ann = annotations.find(a => a.id === selectedId); if (!ann) return;
        if (id === 'annZIndex') ann.zIndex = +this.value;
        else if (id === 'badgeText') ann.badgeText = this.value;
        else ann[id] = +this.value;
        render();
      });
    });

    // Object property inputs
    ['objX', 'objY', 'objW', 'objH'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', function () {
          const o = objects.find(x => x.id === selectedObjId); if (!o) return;
          captureState();
          if (id === 'objX') o.x = +this.value;
          else if (id === 'objY') o.y = +this.value;
          else if (id === 'objW') o.width = +this.value;
          else if (id === 'objH') o.height = +this.value;
          render();
        });
      }
    });

    const objOpacity = document.getElementById('objOpacity');
    if (objOpacity) {
      objOpacity.addEventListener('input', function () {
        const o = objects.find(x => x.id === selectedObjId); if (!o) return;
        o.opacity = +this.value;
        document.getElementById('objOpacityVal').textContent = this.value;
        render();
      });
    }

    const objBg = document.getElementById('objBg');
    if (objBg) {
      objBg.addEventListener('input', function () {
        const o = objects.find(x => x.id === selectedObjId); if (!o) return;
        o.background = this.value; render();
      });
    }

    const objBgTransparent = document.getElementById('objBgTransparent');
    if (objBgTransparent) {
      objBgTransparent.addEventListener('click', () => {
        const o = objects.find(x => x.id === selectedObjId); if (!o) return;
        o.background = 'transparent'; render();
      });
    }

    const objToFront = document.getElementById('objToFront');
    if (objToFront) {
      objToFront.addEventListener('click', () => {
        const o = objects.find(x => x.id === selectedObjId); if (!o) return;
        captureState();
        o.zIndex = Math.max(0, ...objects.map(x => x.zIndex || 0)) + 1;
        render(); updateUI();
      });
    }

    const objToBack = document.getElementById('objToBack');
    if (objToBack) {
      objToBack.addEventListener('click', () => {
        const o = objects.find(x => x.id === selectedObjId); if (!o) return;
        captureState();
        o.zIndex = 0; render(); updateUI();
      });
    }

    const objRemove = document.getElementById('objRemove');
    if (objRemove) {
      objRemove.addEventListener('click', () => {
        captureState();
        objects = objects.filter(x => x.id !== selectedObjId);
        selectedObjId = null; render(); updateUI();
      });
    }

    const objLock = document.getElementById('objLock');
    if (objLock) {
      objLock.addEventListener('click', () => {
        const o = objects.find(x => x.id === selectedObjId); if (!o) return;
        o.locked = !o.locked; render(); updateUI();
      });
    }

    const objResetSize = document.getElementById('objResetSize');
    if (objResetSize) {
      objResetSize.addEventListener('click', () => {
        const o = objects.find(x => x.id === selectedObjId); if (!o) return;
        if (o.originalWidth && o.originalHeight) {
          captureState();
          o.width = o.originalWidth;
          o.height = o.originalHeight;
          render(); updateUI();
        }
      });
    }

    // Shape buttons
    const btnAddRect = document.getElementById('btnAddRect');
    if (btnAddRect) btnAddRect.addEventListener('click', () => addShape('rect'));

    const btnAddCircle = document.getElementById('btnAddCircle');
    if (btnAddCircle) btnAddCircle.addEventListener('click', () => addShape('circle'));

    const btnImportSvg = document.getElementById('btnImportSvg');
    if (btnImportSvg) btnImportSvg.addEventListener('click', () => document.getElementById('fileImportObj').click());

    // ─── CANVAS SETTINGS SIDEBAR EVENTS ───
    const canvasWidth = document.getElementById('canvasWidth');
    if (canvasWidth) {
      canvasWidth.addEventListener('change', function () {
        const val = +this.value;
        if (val > 0) {
          canvasSettings.customWidth = val;
          canvasSettings.customHeight = +(document.getElementById('canvasHeight').value) || canvasSettings.customHeight || 500;
          applyCanvasSettings(); renderGrid(); render();
        }
      });
    }

    const canvasHeight = document.getElementById('canvasHeight');
    if (canvasHeight) {
      canvasHeight.addEventListener('change', function () {
        const val = +this.value;
        if (val > 0) {
          canvasSettings.customHeight = val;
          canvasSettings.customWidth = +(document.getElementById('canvasWidth').value) || canvasSettings.customWidth || 800;
          applyCanvasSettings(); renderGrid(); render();
        }
      });
    }

    const canvasBgColor = document.getElementById('canvasBgColor');
    if (canvasBgColor) {
      canvasBgColor.addEventListener('input', function () {
        canvasSettings.bgColor = this.value;
        applyCanvasSettings();
      });
    }

    const canvasBgWhite = document.getElementById('canvasBgWhite');
    if (canvasBgWhite) {
      canvasBgWhite.addEventListener('click', () => {
        canvasSettings.bgColor = '#ffffff';
        if (document.getElementById('canvasBgColor')) document.getElementById('canvasBgColor').value = '#ffffff';
        applyCanvasSettings();
      });
    }

    const canvasBgTransparent = document.getElementById('canvasBgTransparent');
    if (canvasBgTransparent) {
      canvasBgTransparent.addEventListener('click', () => {
        canvasSettings.bgColor = 'transparent';
        applyCanvasSettings();
      });
    }

    const snapGridEnabled = document.getElementById('snapGridEnabled');
    if (snapGridEnabled) {
      snapGridEnabled.addEventListener('change', function () {
        canvasSettings.snapGrid = this.checked;
        const opts = document.getElementById('snapGridOptions');
        if (opts) opts.style.display = this.checked ? '' : 'none';
        renderGrid(); render();
      });
    }

    const snapGridSize = document.getElementById('snapGridSize');
    if (snapGridSize) {
      snapGridSize.addEventListener('change', function () {
        const val = +this.value;
        if (val >= 5) {
          canvasSettings.snapGridSize = val;
          renderGrid(); render();
        }
      });
    }
  }

  // ─── APPLY COLOR ───
  function applyColor(color) {
    if (multiSelectedIds.size > 0) {
      captureState();
      annotations.forEach(a => {
        if (multiSelectedIds.has(a.id)) a.color = color;
      });
      syncColorSwatches(color);
      render();
      return;
    }
    const ann = annotations.find(a => a.id === selectedId);
    if (!ann) return;
    ann.color = color;
    syncColorSwatches(color);
    render();
  }

  // ─── ADD SHAPE ───
  function addShape(type) {
    captureState();
    const id = 'obj-' + (++idCounter);
    const svgW = svgEl.clientWidth || 800, svgH = svgEl.clientHeight || 500;
    objects.push({
      id, type, x: svgW / 2 - 50, y: svgH / 2 - 30, width: 100, height: 60,
      opacity: 1, zIndex: 5, background: 'transparent', rotation: 0,
      shapeColor: COLOR_PRESETS[Math.floor(Math.random() * 5)],
      originalFilename: type
    });
    selectObject(id);
  }

  // ─── TOOLBAR EVENTS ───
  function bindToolbarEvents() {
    const tbSave = document.getElementById('tbSave');
    if (tbSave) tbSave.addEventListener('click', () => { saveProject(); showToast('Project saved'); });

    const tbOpen = document.getElementById('tbOpen');
    if (tbOpen) tbOpen.addEventListener('click', () => document.getElementById('fileOpenProject').click());

    const tbExportSvg = document.getElementById('tbExportSvg');
    if (tbExportSvg) tbExportSvg.addEventListener('click', exportSVG);

    const tbExportPng = document.getElementById('tbExportPng');
    if (tbExportPng) tbExportPng.addEventListener('click', exportPNG);

    const tbExportD3Json = document.getElementById('tbExportD3Json');
    if (tbExportD3Json) tbExportD3Json.addEventListener('click', exportD3Json);

    const tbUndo = document.getElementById('tbUndo');
    if (tbUndo) tbUndo.addEventListener('click', undo);

    const tbRedo = document.getElementById('tbRedo');
    if (tbRedo) tbRedo.addEventListener('click', redo);
  }

  // ─── FILE INPUTS ───
  function bindFileInputs() {
    const fileOpenProject = document.getElementById('fileOpenProject');
    if (fileOpenProject) {
      fileOpenProject.addEventListener('change', function () {
        if (!this.files[0]) return;
        const reader = new FileReader();
        reader.onload = e => {
          try {
            loadProject(JSON.parse(e.target.result));
            showToast('Project loaded');
          } catch (err) {
            alert('Invalid project file');
          }
        };
        reader.readAsText(this.files[0]);
        this.value = '';
      });
    }

    const fileImportObj = document.getElementById('fileImportObj');
    if (fileImportObj) {
      fileImportObj.addEventListener('change', function () {
        if (!this.files[0]) return;
        const file = this.files[0];
        const isSvg = file.type === 'image/svg+xml' || file.name.endsWith('.svg');
        const reader = new FileReader();
        const svgW = svgEl.clientWidth || 800, svgH = svgEl.clientHeight || 500;
        if (isSvg) {
          reader.onload = e => {
            captureState();
            const id = 'obj-' + (++idCounter);
            let w = 200, h = 150;
            try {
              const parser = new DOMParser();
              const doc = parser.parseFromString(e.target.result, 'image/svg+xml');
              const innerSvg = doc.documentElement;
              const vb = innerSvg.getAttribute('viewBox');
              if (vb) {
                const parts = vb.split(/[\s,]+/).map(Number);
                if (parts.length >= 4 && parts[2] > 0 && parts[3] > 0) {
                  w = parts[2]; h = parts[3];
                }
              } else {
                const iw = parseFloat(innerSvg.getAttribute('width'));
                const ih = parseFloat(innerSvg.getAttribute('height'));
                if (iw > 0 && ih > 0) { w = iw; h = ih; }
              }
            } catch (err) { }

            const maxW = svgW * 0.8;
            const maxH = svgH * 0.8;
            if (w > maxW || h > maxH) {
              const scale = Math.min(maxW / w, maxH / h);
              w *= scale; h *= scale;
            }

            objects.push({
              id, type: 'svg', data: e.target.result,
              x: svgW / 2 - w / 2, y: svgH / 2 - h / 2, width: w, height: h,
              opacity: 1, zIndex: 5, background: 'transparent', rotation: 0,
              originalFilename: file.name, originalWidth: w, originalHeight: h
            });
            selectObject(id); render();
            showToast('SVG imported');
          };
          reader.readAsText(file);
        } else {
          reader.onload = e => {
            captureState();
            const id = 'obj-' + (++idCounter);
            const img = new Image();
            img.onload = () => {
              let w = img.width || 200;
              let h = img.height || 150;
              const maxW = svgW * 0.8;
              const maxH = svgH * 0.8;
              if (w > maxW || h > maxH) {
                const scale = Math.min(maxW / w, maxH / h);
                w *= scale; h *= scale;
              }
              objects.push({
                id, type: 'image', data: e.target.result,
                x: svgW / 2 - w / 2, y: svgH / 2 - h / 2, width: w, height: h,
                opacity: 1, zIndex: 5, background: 'transparent', rotation: 0,
                originalFilename: file.name, originalWidth: w, originalHeight: h
              });
              selectObject(id); render();
              showToast('Image imported');
            };
            img.src = e.target.result;
          };
          reader.readAsDataURL(file);
        }
        this.value = '';
      });
    }
  }

  // ─── SAVE / LOAD PROJECT ───
  function saveProject() {
    const project = {
      version: '3.0',
      canvasWidth: svgEl.clientWidth, canvasHeight: svgEl.clientHeight,
      canvasSettings: { ...canvasSettings },
      idCounter,
      annotations: annotations.map(a => {
        const copy = { ...a };
        if (copy.connectorPoints) copy.connectorPoints = JSON.parse(JSON.stringify(a.connectorPoints));
        return copy;
      }),
      objects: objects.map(o => ({ ...o }))
    };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'annotation-project.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function loadProject(p) {
    if (!p || !p.version) { alert('Invalid project file'); return; }
    captureState();
    annotations = (p.annotations || []).map(a => ({ ...a }));
    objects = (p.objects || []).map(o => ({ ...o }));
    idCounter = p.idCounter || 0;
    selectedId = null;
    selectedObjId = null;
    multiSelectedIds.clear();
    if (p.canvasSettings) {
      canvasSettings = { ...canvasSettings, ...p.canvasSettings };
    }
    applyCanvasSettings();
    render();
    updateUI();
  }

  // ─── EXPORT d3-annotation COMPATIBLE JSON ───
  function exportD3Json() {
    const configs = annotations.map(ann => {
      const cfg = buildConfig(ann);
      // Replace curve function references with string names for JSON
      if (cfg.connector && cfg.connector.curve) {
        const curveKey = ann.curveType || 'curveCatmullRom';
        cfg.connector.curve = 'd3.' + curveKey;
      }
      // Add type as string reference
      cfg.type = 'd3.' + ann.typeKey;
      return cfg;
    });

    const jsonStr = JSON.stringify(configs, null, 2);

    // Copy to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(jsonStr).then(() => {
        showToast('d3-annotation JSON copied to clipboard!');
      }).catch(() => {
        fallbackCopyToClipboard(jsonStr);
      });
    } else {
      fallbackCopyToClipboard(jsonStr);
    }

    // Also log to console for easy access
    console.log('─── d3-annotation JSON Config ───');
    console.log(jsonStr);
    console.log('─── End Config ───');
  }

  function fallbackCopyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showToast('d3-annotation JSON copied to clipboard!');
    } catch (e) {
      showToast('JSON logged to console (copy failed)');
    }
    document.body.removeChild(textarea);
  }

  // ─── EXPORT SVG ───
  function exportSVG() {
    // Deselect to remove edit handles
    const prevSelected = selectedId;
    const prevObjSelected = selectedObjId;
    selectedId = null;
    selectedObjId = null;
    multiSelectedIds.clear();
    render();

    function deepInlineStyles(srcEl, dstEl) {
      const cs = window.getComputedStyle(srcEl);
      const svgProps = [
        'fill', 'fill-opacity', 'fill-rule',
        'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin',
        'font-family', 'font-size', 'font-weight', 'font-style',
        'text-anchor', 'dominant-baseline', 'alignment-baseline',
        'opacity', 'display', 'visibility', 'overflow'
      ];
      let styleStr = '';
      svgProps.forEach(prop => {
        const val = cs.getPropertyValue(prop);
        if (val && val !== '') styleStr += `${prop}:${val};`;
      });
      if (srcEl.style.cssText) styleStr += srcEl.style.cssText;
      dstEl.setAttribute('style', styleStr);

      ['fill', 'stroke', 'font-family', 'font-size', 'font-weight'].forEach(attr => {
        const val = cs.getPropertyValue(attr);
        if (val) dstEl.setAttribute(attr, val);
      });

      const srcChildren = srcEl.children;
      const dstChildren = dstEl.children;
      for (let i = 0; i < srcChildren.length; i++) {
        if (dstChildren[i]) deepInlineStyles(srcChildren[i], dstChildren[i]);
      }
    }

    const svgClone = svgEl.cloneNode(true);
    deepInlineStyles(svgEl, svgClone);

    svgClone.querySelectorAll('.annotation-note-bg').forEach(el => {
      el.setAttribute('fill', 'transparent');
      el.style.setProperty('fill', 'transparent', 'important');
      el.style.setProperty('fill-opacity', '0', 'important');
    });

    // Remove edit handles and grid
    svgClone.querySelectorAll('circle.handle, .resize-handle, .rotate-handle, .obj-sel-border, line[pointer-events="none"]').forEach(el => el.remove());
    svgClone.querySelectorAll('[class*="handle"]').forEach(el => el.remove());
    svgClone.querySelectorAll('.grid-line-group').forEach(el => el.remove());

    // Embed fonts
    const fontUrl = 'https://fonts.googleapis.com/css2?'
        + FONTS.map(f => 'family=' + f.replace(/ /g, '+') + ':wght@400;600;700').join('&')
        + '&display=swap';
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = `@import url('${fontUrl}');`;
    svgClone.insertBefore(styleEl, svgClone.firstChild);

    // Set background
    if (canvasSettings.bgColor && canvasSettings.bgColor !== 'transparent') {
      const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bgRect.setAttribute('width', '100%');
      bgRect.setAttribute('height', '100%');
      bgRect.setAttribute('fill', canvasSettings.bgColor);
      svgClone.insertBefore(bgRect, svgClone.firstChild);
    }

    svgClone.setAttribute('width', svgEl.clientWidth);
    svgClone.setAttribute('height', svgEl.clientHeight);
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

    const svgStr = new XMLSerializer().serializeToString(svgClone);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'annotation-canvas.svg';
    a.click();
    URL.revokeObjectURL(a.href);

    // Restore selection
    selectedId = prevSelected;
    selectedObjId = prevObjSelected;
    render();
    updateUI();
    showToast('SVG exported');
  }

  // ─── EXPORT PNG ───
  function exportPNG() {
    // Deselect to remove edit handles
    const prevSelected = selectedId;
    const prevObjSelected = selectedObjId;
    selectedId = null;
    selectedObjId = null;
    multiSelectedIds.clear();
    render();

    const w = svgEl.clientWidth || 800;
    const h = svgEl.clientHeight || 500;
    const scaleFactor = 2; // High-DPI export

    // Clone and inline styles
    function deepInlineStyles(srcEl, dstEl) {
      try {
        const cs = window.getComputedStyle(srcEl);
        const svgProps = [
          'fill', 'fill-opacity', 'fill-rule',
          'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin',
          'font-family', 'font-size', 'font-weight', 'font-style',
          'text-anchor', 'dominant-baseline', 'alignment-baseline',
          'opacity', 'display', 'visibility', 'overflow'
        ];
        let styleStr = '';
        svgProps.forEach(prop => {
          const val = cs.getPropertyValue(prop);
          if (val && val !== '') styleStr += `${prop}:${val};`;
        });
        if (srcEl.style.cssText) styleStr += srcEl.style.cssText;
        dstEl.setAttribute('style', styleStr);
      } catch (e) { }

      const srcChildren = srcEl.children;
      const dstChildren = dstEl.children;
      for (let i = 0; i < srcChildren.length; i++) {
        if (dstChildren[i]) deepInlineStyles(srcChildren[i], dstChildren[i]);
      }
    }

    const svgClone = svgEl.cloneNode(true);
    deepInlineStyles(svgEl, svgClone);

    svgClone.querySelectorAll('.annotation-note-bg').forEach(el => {
      el.setAttribute('fill', 'transparent');
      el.style.setProperty('fill', 'transparent', 'important');
      el.style.setProperty('fill-opacity', '0', 'important');
    });

    // Remove handles and grid
    svgClone.querySelectorAll('circle.handle, .resize-handle, .rotate-handle, .obj-sel-border, line[pointer-events="none"]').forEach(el => el.remove());
    svgClone.querySelectorAll('[class*="handle"]').forEach(el => el.remove());
    svgClone.querySelectorAll('.grid-line-group').forEach(el => el.remove());

    // Add background rect
    if (canvasSettings.bgColor && canvasSettings.bgColor !== 'transparent') {
      const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bgRect.setAttribute('width', '100%');
      bgRect.setAttribute('height', '100%');
      bgRect.setAttribute('fill', canvasSettings.bgColor);
      svgClone.insertBefore(bgRect, svgClone.firstChild);
    }

    svgClone.setAttribute('width', w);
    svgClone.setAttribute('height', h);
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

    // Embed fonts inline for PNG rendering
    const fontUrl = 'https://fonts.googleapis.com/css2?'
        + FONTS.map(f => 'family=' + f.replace(/ /g, '+') + ':wght@400;600;700').join('&')
        + '&display=swap';
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = `@import url('${fontUrl}');`;
    svgClone.insertBefore(styleEl, svgClone.firstChild);

    const svgStr = new XMLSerializer().serializeToString(svgClone);
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement('canvas');
      canvas.width = w * scaleFactor;
      canvas.height = h * scaleFactor;
      const ctx = canvas.getContext('2d');
      ctx.scale(scaleFactor, scaleFactor);

      // Draw background
      if (canvasSettings.bgColor && canvasSettings.bgColor !== 'transparent') {
        ctx.fillStyle = canvasSettings.bgColor;
        ctx.fillRect(0, 0, w, h);
      }

      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(function (blob) {
        if (!blob) {
          showToast('PNG export failed — try SVG instead');
          return;
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'annotation-canvas.png';
        a.click();
        URL.revokeObjectURL(a.href);
        URL.revokeObjectURL(url);
        showToast('PNG exported (2x resolution)');
      }, 'image/png');
    };

    img.onerror = function () {
      URL.revokeObjectURL(url);
      showToast('PNG export failed — external images may block rendering. Try SVG export.');
    };

    img.src = url;

    // Restore selection
    selectedId = prevSelected;
    selectedObjId = prevObjSelected;
    render();
    updateUI();
  }

  // ─── ANNOTATION EVENTS (hover/click dispatch) ───
  // Expose d3-annotation's built-in event system for interactive features
  function bindAnnotationEvents(makeAnn, group, ann) {
    const events = ['subjectover', 'subjectout', 'subjectclick',
      'connectorover', 'connectorout', 'connectorclick',
      'noteover', 'noteout', 'noteclick'];

    events.forEach(evt => {
      makeAnn.on(evt, function () {
        // Dispatch custom DOM event for extensibility
        const customEvent = new CustomEvent('annotation-' + evt, {
          detail: { annotationId: ann.id, annotation: ann }
        });
        document.dispatchEvent(customEvent);

        // Visual feedback on hover events
        if (evt === 'subjectover' || evt === 'connectorover' || evt === 'noteover') {
          group.classed('hovered', true);
        } else if (evt === 'subjectout' || evt === 'connectorout' || evt === 'noteout') {
          group.classed('hovered', false);
        }
      });
    });
  }

  // ─── COLLECTION ACCESS (for console/debugging) ───
  // Expose annotation collection to global scope for power users
  window.getAnnotationCollection = function () {
    return annotations.map(a => ({ ...a }));
  };

  window.getD3AnnotationConfigs = function () {
    return annotations.map(ann => buildConfig(ann));
  };

  window.setAnnotations = function (newAnnotations) {
    captureState();
    annotations = newAnnotations.map(a => ({ ...a }));
    render();
    updateUI();
    showToast('Annotations updated programmatically');
  };

  // ─── CUSTOM TYPE BUILDER (annotationCustomType) ───
  // Utility: create a custom annotation type with default overrides
  window.createCustomAnnotationType = function (baseTypeKey, overrides) {
    const baseType = TYPE_MAP[baseTypeKey];
    if (!baseType) {
      console.error('Unknown base type:', baseTypeKey);
      return null;
    }
    return d3.annotationCustomType(baseType, overrides);
  };

  // ─── START ───
  init();

} // end startApp