document.addEventListener("DOMContentLoaded", function () {
  // Destructure from global d3 object (loaded via CDNs)
  const {
    annotation,
    annotationLabel,
    annotationCallout,
    annotationCalloutElbow,
    annotationCalloutCurve,
    annotationCalloutCircle,
    annotationCalloutRect,
    annotationXYThreshold,
    annotationBadge
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
  let idCounter = 0;
  let currentTypeKey = 'annotationLabel';

  const svg = d3.select('#canvas');
  const svgEl = document.getElementById('canvas');

  function init() {
    populateFontSelects();
    bindSidebarEvents();
    bindToolbarEvents();
    bindCanvasClick();
    bindFileInputs();
    enablePanelToggles();
    updateUI();
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

  function buildConfig(ann) {
    const svgW = svgEl.clientWidth || 800;
    const svgH = svgEl.clientHeight || 500;

    const cfg = {
      x: ann.x, y: ann.y, dx: ann.dx, dy: ann.dy,
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

    const nativeConn = TYPE_CONNECTOR[ann.typeKey] || 'none';
    const connType = ann.connectorType || nativeConn;

    if (connType !== 'none') {
      cfg.connector = { type: connType };
      if (ann.connectorEnd && ann.connectorEnd !== 'none') cfg.connector.end = ann.connectorEnd;
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
    }

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
      // Restore badge pointer coordinates if they were dragged around
      if (ann.subjectX !== undefined) cfg.subject.x = ann.subjectX;
      if (ann.subjectY !== undefined) cfg.subject.y = ann.subjectY;
    }

    return cfg;
  }

  function render() {
    svg.selectAll('.obj-layer').remove();
    svg.selectAll('.ann-layer').remove();

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
      .attr('class', 'ann-layer ann-group' + (ann.id === selectedId ? ' selected' : ''))
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
      if (annObj.x != null) ann.x = annObj.x;
      if (annObj.y != null) ann.y = annObj.y;
      if (annObj.dx != null) ann.dx = annObj.dx;
      if (annObj.dy != null) ann.dy = annObj.dy;
      if (annObj.subject) {
        if (ann.typeKey === 'annotationCalloutCircle' && annObj.subject.radius)
          ann.subjectRadius = annObj.subject.radius;
        if (ann.typeKey === 'annotationCalloutRect') {
          if (annObj.subject.width) ann.subjectWidth = annObj.subject.width;
          if (annObj.subject.height) ann.subjectHeight = annObj.subject.height;
        }
        if (ann.typeKey === 'annotationBadge') {
          // Persist the badge handle dragging properties so it won't reset
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
    }

    makeAnn.on('dragend', syncAnn);

    try { group.call(makeAnn); } catch (e) { console.error('Ann render error', ann.id, e); }

    if (ann.typeKey === 'annotationXYThreshold')
      applyThresholdLine(group, ann, svgW, svgH);

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

    group.on('click', function () {
      d3.event.stopPropagation();
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
          selectObject(obj.id);
        })
        .on('drag', function () {
          if (d3.event.sourceEvent.target.classList.contains('resize-handle') ||
            d3.event.sourceEvent.target.classList.contains('rotate-handle')) return;
          obj.x = (obj.x || 0) + d3.event.dx;
          obj.y = (obj.y || 0) + d3.event.dy;
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
          .on('start', function () { d3.event.sourceEvent.stopPropagation(); })
          .on('drag', function () {
            const dx = d3.event.dx * corner.dx;
            const dy = d3.event.dy * corner.dy;
            obj.width = Math.max(20, (obj.width || 200) + dx);
            obj.height = Math.max(20, (obj.height || 150) + dy);
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
        .on('start', function () { d3.event.sourceEvent.stopPropagation(); })
        .on('drag', function () {
          const cx = (obj.x || 0) + (obj.width || 200) / 2;
          const cy = (obj.y || 0) + (obj.height || 150) / 2;
          const svgRect = svgEl.getBoundingClientRect();
          const mx = d3.event.sourceEvent.clientX - svgRect.left;
          const my = d3.event.sourceEvent.clientY - svgRect.top;
          const angle = Math.atan2(my - cy, mx - cx) * 180 / Math.PI + 90;
          obj.rotation = Math.round(angle);
          d3.select(g.node()).attr('transform', buildObjTransform(obj));
        })
      );
  }

  function selectAnnotation(id) {
    if (selectedId !== id) {
      selectedId = id;
      selectedObjId = null;
      render();
      updateUI();
    }
  }

  function selectObject(id) {
    if (selectedObjId === id) return;
    selectedObjId = id;
    selectedId = null;
    svg.selectAll('g.ann-group').classed('selected', false);
    render();
    updateUI();
  }

  function deselect() {
    if (selectedId !== null || selectedObjId !== null) {
      selectedId = null;
      selectedObjId = null;
      render();
      updateUI();
    }
  }

  function updateUI() {
    const ann = annotations.find(a => a.id === selectedId);
    const obj = objects.find(o => o.id === selectedObjId);

    const info = document.getElementById('selectionInfo');
    if (!info) return;

    if (ann) info.innerHTML = `<span style="color:var(--accent)">Annotation #${ann.id} — ${ann.typeKey.replace('annotation', '')}</span>`;
    else if (obj) info.innerHTML = `<span style="color:var(--accent)">Object: ${obj.originalFilename || obj.type}</span>`;
    else info.innerHTML = '<span class="no-selection">No annotation selected</span>';

    const btnDelete = document.getElementById('btnDelete');
    if (btnDelete) btnDelete.style.display = ann ? '' : 'none';

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

      const needsFill = ann.typeKey === 'annotationCalloutCircle' || ann.typeKey === 'annotationCalloutRect';
      const sfp = document.getElementById('subjectFillPanel');
      if (sfp) sfp.style.display = needsFill ? '' : 'none';
      if (needsFill) {
        const sf = ann.subjectFill || ann.color || '#E8336D';
        if (document.getElementById('subjectFillColor')) document.getElementById('subjectFillColor').value = (sf === 'transparent' || sf === 'none') ? '#E8336D' : sf;
        if (document.getElementById('subjectFillOpacity')) document.getElementById('subjectFillOpacity').value = ann.subjectFillOpacity || 0.1;
        if (document.getElementById('subjectFillOpacityVal')) document.getElementById('subjectFillOpacityVal').textContent = ann.subjectFillOpacity || 0.1;
      }

      const tp = document.getElementById('thresholdPanel');
      if (tp) tp.style.display = ann.typeKey === 'annotationXYThreshold' ? '' : 'none';
      if (ann.typeKey === 'annotationXYThreshold') setOptGroup('thresholdDir', ann.thresholdOrientation || 'horizontal');

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

    const op = document.getElementById('objPropsPanel');
    if (op) op.style.display = obj ? '' : 'none';
    if (obj) syncObjProps();
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
          if (act === 'up') o.zIndex = (o.zIndex || 0) + 1;
          else if (act === 'down') o.zIndex = Math.max(0, (o.zIndex || 0) - 1);
          else if (act === 'del') { objects = objects.filter(x => x.id !== oid); selectedObjId = null; }
          render(); updateUI();
        });
      });
      list.appendChild(div);
    });
  }

  function bindCanvasClick() {
    svg.on('click', function () {
      if (d3.event.target === svgEl) {
        const coords = d3.mouse(this);
        addAnnotation(coords[0], coords[1]);
      }
    });
  }

  function addAnnotation(x, y) {
    idCounter++;
    const tk = currentTypeKey;
    const nativeConn = TYPE_CONNECTOR[tk] || 'line';
    const ann = {
      id: idCounter, typeKey: tk,
      x, y, dx: 80 + Math.random() * 20, dy: -60 - Math.random() * 20,
      title: 'Title', label: 'Description',
      wrap: 120, padding: 5,
      noteLineType: 'none', noteOrientation: 'topBottom', noteAlign: 'middle',
      connectorType: nativeConn,
      connectorEnd: 'none',
      curveType: 'curveCatmullRom', curvePoints: 2,
      color: '#E8336D',
      titleFont: 'Inter', titleFontSize: 13, titleFontWeight: 700,
      labelFont: 'Inter', labelFontSize: 12, labelFontWeight: 400,
      subjectFill: '#E8336D', subjectFillOpacity: 0.1,
      subjectRadius: 50, subjectWidth: 100, subjectHeight: 60,
      thresholdOrientation: 'horizontal',
      badgeText: 'A', badgeRadius: 14,
      zIndex: 10
    };
    annotations.push(ann);
    render();
    selectAnnotation(ann.id);
  }

  function bindSidebarEvents() {
    document.querySelectorAll('#presetsGrid .preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentTypeKey = btn.dataset.type;
        setActivePreset(currentTypeKey);
        const ann = annotations.find(a => a.id === selectedId);
        if (ann) {
          ann.typeKey = currentTypeKey;
          ann.connectorType = TYPE_CONNECTOR[currentTypeKey] || 'line';
          render(); updateUI();
        }
      });
    });

    const btnDelete = document.getElementById('btnDelete');
    if (btnDelete) {
      btnDelete.addEventListener('click', () => {
        annotations = annotations.filter(a => a.id !== selectedId);
        selectedId = null; render(); updateUI();
      });
    }

    const editTitle = document.getElementById('editTitle');
    if (editTitle) {
      editTitle.addEventListener('input', function () {
        const ann = annotations.find(a => a.id === selectedId); if (!ann) return;
        ann.title = this.value; render();
      });
    }

    const editLabel = document.getElementById('editLabel');
    if (editLabel) {
      editLabel.addEventListener('input', function () {
        const ann = annotations.find(a => a.id === selectedId); if (!ann) return;
        ann.label = this.value; render();
      });
    }

    const textWrap = document.getElementById('textWrap');
    if (textWrap) {
      textWrap.addEventListener('input', function () {
        const ann = annotations.find(a => a.id === selectedId); if (!ann) return;
        ann.wrap = +this.value; render();
      });
    }

    const padding = document.getElementById('padding');
    if (padding) {
      padding.addEventListener('input', function () {
        const ann = annotations.find(a => a.id === selectedId); if (!ann) return;
        ann.padding = +this.value; render();
      });
    }

    ['titleFont', 'titleFontSize', 'titleFontWeight', 'labelFont', 'labelFontSize', 'labelFontWeight'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', function () {
          const ann = annotations.find(a => a.id === selectedId); if (!ann) return;
          ann[id] = id.includes('Size') ? +this.value : this.value;
          render();
        });
      }
    });

    const applyAllTitleFont = document.getElementById('applyAllTitleFont');
    if (applyAllTitleFont) {
      applyAllTitleFont.addEventListener('click', () => {
        const font = document.getElementById('titleFont').value;
        const size = +document.getElementById('titleFontSize').value;
        const weight = +document.getElementById('titleFontWeight').value;
        annotations.forEach(a => { a.titleFont = font; a.titleFontSize = size; a.titleFontWeight = weight; });
        render();
      });
    }

    const applyAllLabelFont = document.getElementById('applyAllLabelFont');
    if (applyAllLabelFont) {
      applyAllLabelFont.addEventListener('click', () => {
        const font = document.getElementById('labelFont').value;
        const size = +document.getElementById('labelFontSize').value;
        const weight = +document.getElementById('labelFontWeight').value;
        annotations.forEach(a => { a.labelFont = font; a.labelFontSize = size; a.labelFontWeight = weight; });
        render();
      });
    }

    document.querySelectorAll('#colorSwatches .color-swatch').forEach(s => {
      s.addEventListener('click', () => { applyColor(s.dataset.color); document.getElementById('customColor').value = s.dataset.color; });
    });

    const customColor = document.getElementById('customColor');
    if (customColor) {
      customColor.addEventListener('input', function () { applyColor(this.value); });
    }

    const subjectFillColor = document.getElementById('subjectFillColor');
    if (subjectFillColor) {
      subjectFillColor.addEventListener('input', function () {
        const ann = annotations.find(a => a.id === selectedId); if (!ann) return;
        ann.subjectFill = this.value; render();
      });
    }

    const subjectFillTransparent = document.getElementById('subjectFillTransparent');
    if (subjectFillTransparent) {
      subjectFillTransparent.addEventListener('click', () => {
        const ann = annotations.find(a => a.id === selectedId); if (!ann) return;
        ann.subjectFill = 'transparent'; render();
      });
    }

    const subjectFillOpacity = document.getElementById('subjectFillOpacity');
    if (subjectFillOpacity) {
      subjectFillOpacity.addEventListener('input', function () {
        const ann = annotations.find(a => a.id === selectedId); if (!ann) return;
        ann.subjectFillOpacity = +this.value;
        document.getElementById('subjectFillOpacityVal').textContent = this.value;
        render();
      });
    }

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
          render(); updateUI();
        });
      });
    });

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

    ['objX', 'objY', 'objW', 'objH'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', function () {
          const o = objects.find(x => x.id === selectedObjId); if (!o) return;
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
        o.opacity = +this.value; document.getElementById('objOpacityVal').textContent = this.value; render();
      });
    }

    const objBg = document.getElementById('objBg');
    if (objBg) {
      objBg.addEventListener('input', function () {
        const o = objects.find(x => x.id === selectedObjId); if (!o) return; o.background = this.value; render();
      });
    }

    const objBgTransparent = document.getElementById('objBgTransparent');
    if (objBgTransparent) {
      objBgTransparent.addEventListener('click', () => {
        const o = objects.find(x => x.id === selectedObjId); if (!o) return; o.background = 'transparent'; render();
      });
    }

    const objToFront = document.getElementById('objToFront');
    if (objToFront) {
      objToFront.addEventListener('click', () => {
        const o = objects.find(x => x.id === selectedObjId); if (!o) return;
        o.zIndex = Math.max(0, ...objects.map(x => x.zIndex || 0)) + 1; render(); updateUI();
      });
    }

    const objToBack = document.getElementById('objToBack');
    if (objToBack) {
      objToBack.addEventListener('click', () => {
        const o = objects.find(x => x.id === selectedObjId); if (!o) return;
        o.zIndex = 0; render(); updateUI();
      });
    }

    const objRemove = document.getElementById('objRemove');
    if (objRemove) {
      objRemove.addEventListener('click', () => {
        objects = objects.filter(x => x.id !== selectedObjId); selectedObjId = null; render(); updateUI();
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
          o.width = o.originalWidth;
          o.height = o.originalHeight;
          render(); updateUI();
        }
      });
    }

    const btnAddRect = document.getElementById('btnAddRect');
    if (btnAddRect) btnAddRect.addEventListener('click', () => addShape('rect'));

    const btnAddCircle = document.getElementById('btnAddCircle');
    if (btnAddCircle) btnAddCircle.addEventListener('click', () => addShape('circle'));

    const btnImportSvg = document.getElementById('btnImportSvg');
    if (btnImportSvg) btnImportSvg.addEventListener('click', () => document.getElementById('fileImportObj').click());
  }

  function applyColor(color) {
    const ann = annotations.find(a => a.id === selectedId); if (!ann) return;
    ann.color = color;
    syncColorSwatches(color);
    render();
  }

  function addShape(type) {
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

  function bindToolbarEvents() {
    const tbSave = document.getElementById('tbSave');
    if (tbSave) tbSave.addEventListener('click', saveProject);

    const tbOpen = document.getElementById('tbOpen');
    if (tbOpen) tbOpen.addEventListener('click', () => document.getElementById('fileOpenProject').click());

    const tbExportSvg = document.getElementById('tbExportSvg');
    if (tbExportSvg) tbExportSvg.addEventListener('click', exportSVG);
  }

  function bindFileInputs() {
    const fileOpenProject = document.getElementById('fileOpenProject');
    if (fileOpenProject) {
      fileOpenProject.addEventListener('change', function () {
        if (!this.files[0]) return;
        const reader = new FileReader();
        reader.onload = e => { try { loadProject(JSON.parse(e.target.result)); } catch (err) { alert('Invalid project file'); } };
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
          };
          reader.readAsText(file);
        } else {
          reader.onload = e => {
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
            };
            img.src = e.target.result;
          };
          reader.readAsDataURL(file);
        }
        this.value = '';
      });
    }
  }

  function saveProject() {
    const project = {
      version: '2.0',
      canvasWidth: svgEl.clientWidth, canvasHeight: svgEl.clientHeight,
      idCounter,
      annotations: annotations.map(a => ({ ...a })),
      objects: objects.map(o => ({ ...o }))
    };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'annotation-project.json';
    a.click();
  }

  function loadProject(p) {
    if (!p || !p.version) { alert('Invalid project file'); return; }
    annotations = (p.annotations || []).map(a => ({ ...a }));
    objects = (p.objects || []).map(o => ({ ...o }));
    idCounter = p.idCounter || 0;
    selectedId = null; selectedObjId = null;
    render(); updateUI();
  }

  function exportSVG() {
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

    svgClone.querySelectorAll('circle.handle, .resize-handle, .rotate-handle, .obj-sel-border, line[pointer-events="none"]').forEach(el => el.remove());
    svgClone.querySelectorAll('[class*="handle"]').forEach(el => el.remove());

    const fontUrl = 'https://fonts.googleapis.com/css2?'
      + FONTS.map(f => 'family=' + f.replace(/ /g, '+') + ':wght@400;600;700').join('&')
      + '&display=swap';
    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = `@import url('${fontUrl}');`;
    svgClone.insertBefore(styleEl, svgClone.firstChild);

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
  }

  // Start app
  init();
});