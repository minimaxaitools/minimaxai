/**
 * Headroom Animation Plugin for Kinetic Engine
 * Extracted and adapted from Headroom Animation (film & paper engines).
 *
 * 100% Browser Native — Zero Node.js required.
 * Registers custom supplements, transitions, and background layers with KineticEngine.
 */
(function (global) {
  'use strict';

  // ---------- Math & Deterministic Noise Utilities ----------
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const inv = (a, b, x) => clamp((x - a) / (b - a));

  function h1(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return x - Math.floor(x);
  }

  function vn(x) {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return lerp(h1(i), h1(i + 1), u) * 2 - 1;
  }

  function h2(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  function vn2p(x, y, p) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const w = v => ((v % p) + p) % p;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return lerp(
      lerp(h2(w(xi), w(yi)), h2(w(xi + 1), w(yi)), u),
      lerp(h2(w(xi), w(yi + 1)), h2(w(xi + 1), w(yi + 1)), u),
      v
    );
  }

  function rng(seed) {
    let a = (seed * 2654435761) >>> 0 || 1;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Damped harmonic wobble impulse from Headroom
  function wob(t, f = 14, damp = 5) {
    return t < 0 ? 0 : Math.exp(-t * damp) * Math.sin(t * f);
  }

  // Color helper with token resolution fallback
  function resolveColor(c, fallback = '#C9A24A', palette = {}) {
    if (!c) return fallback;
    if (c.startsWith('@')) {
      const key = c.slice(1);
      return palette[key] || fallback;
    }
    return c;
  }

  // ---------- Procedural Textures Cache ----------
  let grainCanvas = null;
  let grainPat = null;

  function ensureGrain(ctx) {
    if (grainPat || typeof document === 'undefined') return grainPat;
    try {
      grainCanvas = document.createElement('canvas');
      grainCanvas.width = grainCanvas.height = 128;
      const g = grainCanvas.getContext('2d');
      const id = g.createImageData(128, 128);
      for (let y = 0; y < 128; y++) {
        for (let x = 0; x < 128; x++) {
          const n = vn2p(x / 16, y / 16, 8) * 0.6 + h2(x, y) * 0.4;
          const v = Math.floor(255 - n * 45);
          const i = (y * 128 + x) * 4;
          id.data[i] = v;
          id.data[i + 1] = Math.floor(v * 0.99);
          id.data[i + 2] = Math.floor(v * 0.98);
          id.data[i + 3] = 255;
        }
      }
      g.putImageData(id, 0, 0);
      grainPat = ctx.createPattern(grainCanvas, 'repeat');
    } catch (e) {
      grainPat = null;
    }
    return grainPat;
  }

  // ---------- Plugin Registration Function ----------
  function registerWithEngine(Engine) {
    if (!Engine || typeof Engine.registerSupplement !== 'function') return false;

    // 1. Supplement: Brass Split Pin (P.brass from Headroom paper engine)
    Engine.registerSupplement('brassPin', function (R, sp, b, pr) {
      const ctx = R.ctx;
      const p = pr ? (pr.p ?? 1) : 1;
      if (p <= 0) return;
      ctx.save();
      const pal = (R.theme && R.theme.palette) || {};
      const col = resolveColor(sp.style && sp.style.color, '#C9A24A', pal);
      const radius = (sp.style && sp.style.radius) || 12;
      const at = (sp.style && sp.style.at) || 'topLeft';

      let x = b.x, y = b.y;
      if (at === 'topLeft') { x = b.x - radius * 0.8; y = b.y - radius * 0.8; }
      else if (at === 'topRight') { x = b.x + b.w + radius * 0.8; y = b.y - radius * 0.8; }
      else if (at === 'center') { x = b.x + b.w / 2; y = b.y - radius * 0.5; }

      // Physical scale pop
      const pop = Math.min(1, p * 1.2);
      ctx.translate(x, y);
      ctx.scale(pop, pop);

      // Shadow
      ctx.shadowColor = 'rgba(45,26,10,0.38)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 3;
      ctx.shadowOffsetY = 5;

      // Pin head
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();

      // Specular highlight
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = 'rgba(255,248,220,0.85)';
      ctx.beginPath();
      ctx.arc(-radius * 0.32, -radius * 0.35, radius * 0.38, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });

    // 2. Supplement: 3D Pushpin (pushpin from Headroom)
    Engine.registerSupplement('pushPin', function (R, sp, b, pr) {
      const ctx = R.ctx;
      const p = pr ? (pr.p ?? 1) : 1;
      if (p <= 0) return;
      ctx.save();
      const pal = (R.theme && R.theme.palette) || {};
      const col = resolveColor(sp.style && sp.style.color, '#D2463A', pal);
      const radius = (sp.style && sp.style.radius) || 15;

      const x = b.x + b.w * 0.1;
      const y = b.y - radius * 0.9;
      const bounce = wob(p - 0.1, 18, 6) * 4;

      ctx.translate(x, y - bounce);
      ctx.scale(p, p);

      // Deep pin shadow
      ctx.shadowColor = 'rgba(40,15,5,0.45)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 4;
      ctx.shadowOffsetY = 8;

      // Pin head
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner highlight circle
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(-radius * 0.3, -radius * 0.35, radius * 0.35, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });

    // 3. Supplement: Washi Tape (translucent taped edges)
    Engine.registerSupplement('washiTape', function (R, sp, b, pr) {
      const ctx = R.ctx;
      const p = pr ? (pr.p ?? 1) : 1;
      if (p <= 0) return;
      ctx.save();
      const pal = (R.theme && R.theme.palette) || {};
      const col = resolveColor(sp.style && sp.style.color, '#7FD8BE', pal);
      const angle = (sp.style && sp.style.tilt) || -6;
      const tw = b.w * 0.45 * clamp(p * 1.1);
      const th = 26;

      const cx = b.x + b.w * 0.15;
      const cy = b.y - 10;

      ctx.translate(cx, cy);
      ctx.rotate((angle * Math.PI) / 180);

      ctx.globalAlpha = 0.72;
      ctx.fillStyle = col;

      // Jagged torn ends
      ctx.beginPath();
      ctx.moveTo(-tw / 2, -th / 2);
      ctx.lineTo(tw / 2, -th / 2);
      ctx.lineTo(tw / 2 - 4, 0);
      ctx.lineTo(tw / 2, th / 2);
      ctx.lineTo(-tw / 2, th / 2);
      ctx.lineTo(-tw / 2 + 4, 0);
      ctx.closePath();
      ctx.fill();

      // Tape fiber texture
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    });

    // 4. Supplement: Filing Folder Tab
    Engine.registerSupplement('folderTab', function (R, sp, b, pr) {
      const ctx = R.ctx;
      const p = pr ? (pr.p ?? 1) : 1;
      if (p <= 0) return;
      ctx.save();
      const pal = (R.theme && R.theme.palette) || {};
      const col = resolveColor(sp.style && sp.style.color, '#EBE1C5', pal);
      const tabText = (sp.style && sp.style.label) || 'DOC';

      const tw = Math.max(70, b.w * 0.35);
      const th = 28 * clamp(p * 1.1);
      const x = b.x + 10;
      const y = b.y - th;

      ctx.fillStyle = col;
      ctx.shadowColor = 'rgba(60,40,20,0.2)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = -2;

      // Rounded trapezoid tab
      ctx.beginPath();
      ctx.moveTo(x, b.y);
      ctx.lineTo(x + 8, y);
      ctx.lineTo(x + tw - 8, y);
      ctx.lineTo(x + tw, b.y);
      ctx.closePath();
      ctx.fill();

      // Label on tab
      if (p > 0.5) {
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = resolveColor('@ink', '#2E2A24', pal);
        ctx.font = '700 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tabText, x + tw / 2, y + 14);
      }

      ctx.restore();
    });

    // 5. Supplement: Headroom Token Meter Gauge
    Engine.registerSupplement('tokenMeter', function (R, sp, b, pr) {
      const ctx = R.ctx;
      const p = pr ? (pr.p ?? 1) : 1;
      if (p <= 0) return;
      ctx.save();
      const pal = (R.theme && R.theme.palette) || {};
      const col = resolveColor(sp.style && sp.style.color, '#4F9E91', pal);
      const level = (sp.style && sp.style.level !== undefined) ? sp.style.level : 0.8;
      const mw = 18;
      const mh = Math.max(50, b.h);
      const x = b.x - mw - 16;
      const y = b.y;

      // Meter housing
      ctx.fillStyle = 'rgba(240,235,220,0.85)';
      ctx.strokeStyle = resolveColor('@ink', '#2E2A24', pal);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(x, y, mw, mh);
      ctx.fill();
      ctx.stroke();

      // Segmented level bars
      const segs = 5;
      const activeSegs = Math.round(level * segs * p);
      const segH = (mh - 6) / segs;

      for (let i = 0; i < segs; i++) {
        if (i < activeSegs) {
          ctx.fillStyle = (i === segs - 1 && level > 0.8) ? '#D2463A' : col;
          ctx.fillRect(x + 3, y + mh - 3 - (i + 1) * segH + 1, mw - 6, segH - 2);
        }
      }

      ctx.restore();
    });

    // 6. Supplement: Headroom Watercolor Wash (with edge pigment pooling)
    Engine.registerSupplement('watercolorWash', function (R, sp, b, pr) {
      const ctx = R.ctx;
      const p = pr ? (pr.p ?? 1) : 1;
      if (p <= 0) return;
      ctx.save();
      const pal = (R.theme && R.theme.palette) || {};
      const col = resolveColor(sp.style && sp.style.color, '#FFE5A3', pal);
      const opacity = (sp.style && sp.style.opacity) || 0.88;

      const padX = (sp.style && sp.style.padX) || 16;
      const padY = (sp.style && sp.style.padY) || 8;
      const x0 = b.x - padX, y0 = b.y - padY;
      const w = (b.w + padX * 2) * clamp(p * 1.05);
      const h = b.h + padY * 2;

      ctx.globalAlpha = opacity * Math.min(1, p * 2);
      ctx.fillStyle = col;

      // Soft jittered polygon boundary
      ctx.beginPath();
      ctx.moveTo(x0, y0 + 6);
      ctx.quadraticCurveTo(x0 + w * 0.5, y0 - 3, x0 + w, y0 + 4);
      ctx.quadraticCurveTo(x0 + w + 4, y0 + h * 0.5, x0 + w, y0 + h - 4);
      ctx.quadraticCurveTo(x0 + w * 0.5, y0 + h + 5, x0, y0 + h - 5);
      ctx.quadraticCurveTo(x0 - 5, y0 + h * 0.5, x0, y0 + 6);
      ctx.closePath();
      ctx.fill();

      // Pigment pooling border
      ctx.strokeStyle = col;
      ctx.globalAlpha = opacity * 0.45;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.restore();
    });

    // 7. Transition: Headroom Inked Iris Aperture
    Engine.registerTransition('headroomIris', function (ctx, A, B, p, P) {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const maxR = Math.hypot(w, h) * 0.55;
      const r = maxR * p;

      // Draw previous scene A
      ctx.drawImage(A, 0, 0);

      // Iris mask revealing scene B
      ctx.save();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(B, 0, 0);
      ctx.restore();

      // Inked contour ring around expanding iris
      if (p > 0.02 && p < 0.98) {
        ctx.save();
        ctx.strokeStyle = (P && P.color) || '#2E2A24';
        ctx.lineWidth = 6 * (1 - p * 0.5);
        ctx.beginPath();
        for (let i = 0; i <= 60; i++) {
          const a = (i / 60) * Math.PI * 2;
          const wobble = vn(a * 4 + p * 10) * 4;
          const px = w / 2 + Math.cos(a) * (r + wobble);
          const py = h / 2 + Math.sin(a) * (r + wobble);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
    });

    // 8. Transition: 48-Slice Page-Turn Strips (Headroom paper book page turn)
    Engine.registerTransition('pageTurnSlices', function (ctx, A, B, p, P) {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const slices = 48;
      const sliceW = w / slices;

      // Underneath: incoming scene B
      ctx.drawImage(B, 0, 0);

      // On top: outgoing scene A peeling in slices
      ctx.save();
      for (let i = 0; i < slices; i++) {
        const sliceFrac = i / slices;
        // Peel wavefront from left to right
        const peelProgress = clamp((p - sliceFrac * 0.5) / 0.5);
        if (peelProgress >= 1) continue; // Fully peeled

        const curl = Math.sin(peelProgress * Math.PI);
        const sx = i * sliceW;
        const dx = sx + curl * 30;
        const dy = -curl * 45;
        const sh = 1 - curl * 0.15;

        ctx.save();
        ctx.translate(dx, dy);
        ctx.scale(1, sh);
        ctx.drawImage(A, sx, 0, sliceW, h, 0, 0, sliceW, h);

        // Shadow under peel
        if (curl > 0.05) {
          ctx.fillStyle = `rgba(30,15,5,${curl * 0.35})`;
          ctx.fillRect(0, 0, sliceW, h);
        }
        ctx.restore();
      }
      ctx.restore();
    });

    // 9. Transition: Cabinet Sliding Drawer Transition
    Engine.registerTransition('cabinetSlide', function (ctx, A, B, p, P) {
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const easeP = p * p * (3 - 2 * p);
      const slideX = w * (1 - easeP);

      ctx.drawImage(A, 0, 0);

      ctx.save();
      // Drop shadow behind sliding cabinet edge
      ctx.shadowColor = 'rgba(30,20,10,0.5)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetX = -12;
      ctx.drawImage(B, slideX, 0);
      ctx.restore();
    });

    // 10. Background Layer: Headroom Workshop
    Engine.registerBackgroundLayer('headroomWorkshop', function (R, L, i, t) {
      const ctx = R.ctx;
      const w = ctx.canvas.width;
      const h = ctx.canvas.height;
      const pal = (R.theme && R.theme.palette) || {};

      const wallCol = pal.paper2 || '#F3E4C4';
      const floorCol = pal.strip ? pal.strip[0] : '#D8A56B';

      ctx.save();

      // Top wall wallpaper
      ctx.fillStyle = wallCol;
      ctx.fillRect(0, 0, w, h * 0.72);

      // Subtle diamond wallpaper dots
      ctx.fillStyle = 'rgba(215,190,145,0.35)';
      for (let y = 30; y < h * 0.7; y += 42) {
        for (let x = 30; x < w; x += 42) {
          ctx.fillRect(x - 2, y - 2, 4, 4);
        }
      }

      // Wooden baseboard trim
      ctx.fillStyle = '#B98E5E';
      ctx.fillRect(0, h * 0.71, w, 14);

      // Floor plane
      ctx.fillStyle = floorCol;
      ctx.fillRect(0, h * 0.72, w, h * 0.28);

      ctx.restore();
    });

    return true;
  }

  // Auto-register immediately if KineticEngine exists in global scope
  if (global.KineticEngine) {
    registerWithEngine(global.KineticEngine);
  }

  // Export module for dynamic attachment or browser usage
  global.HeadroomPlugin = {
    version: '1.0.0',
    register: registerWithEngine,
    utils: { clamp, lerp, inv, wob, vn, rng }
  };

  // Listen for late engine initialization if loaded asynchronously
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      if (global.KineticEngine) registerWithEngine(global.KineticEngine);
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
