/**
 * plugin.example.js — how to add NEW drawing primitives that JSON presets can then use.
 *
 * JSON presets can combine and re-time everything that already exists. Only when you need a brand-new
 * *kind of drawing* (a new supplement shape, a new transition compositor, a new background layer) do you
 * write a few lines of JS like this. After registering, presets refer to it by name:
 *
 *   "supplements": { "wavyLine": { "kind": "zigzag", "style": { "color": "@accent2", "waves": 7 } } }
 *   "transitions": { "curtain":  { "type": "curtain", "duration": 1, "ease": "glide", "color": "@accent" } }
 *   "backgrounds": { "rainy":    { "color": "@paper", "layers": [ { "type": "rain", "count": 80 } ] } }
 *
 * Load it:  <script src="presets/plugin.example.js"></script> right after engine.js (Studio index.html and your Index.html),
 *           or Studio → Presets → "Load preset pack…" (session only),
 *           or CLI:  node validate-presets.js presets/plugin.example.js presets/my-pack.json
 *
 * Rules: draw functions must be PURE functions of their inputs (time comes in as progress/age/t) — never keep
 * state between frames, never use Math.random() (use api.rng(seed)), so export stays frame-accurate.
 */
(function () {
    const K = window.KineticEngine;
    if (!K || !K.registerSupplement) return;
    const { U, rng, resolveColor, bgPoint } = K.api;

    /* ── Supplement kind: "zigzag" — a hand-drawn wavy underline that draws on left→right.
     *    fn(R, sp, b, pr)
     *      R   renderer: R.ctx (already transformed into the phrase plane), R.theme, R.lib, R.s (px scale)
     *      sp  the supplement: sp.style (merged preset style), sp.color / sp.color2 (resolved), sp.args (tag args), sp.text
     *      b   phrase box in plane units {x, y, w, h}
     *      pr  progress: pr.p (0→1 eased entry), pr.out (1→0 exit), pr.age (seconds since start)            */
    K.registerSupplement('zigzag', (R, sp, b, pr) => {
        const s = sp.style, ctx = R.ctx;
        const waves = U.num(s.waves, 6), amp = b.h * U.num(s.amplitude, 0.08);
        const y0 = b.y + b.h * (1 + U.num(s.offset, 0.12));
        const x0 = b.x - b.h * 0.05, x1 = x0 + (b.w + b.h * 0.1) * pr.p;
        ctx.lineWidth = b.h * U.num(s.thickness, 0.05);
        ctx.beginPath();
        for (let x = x0; x <= x1; x += 2) {
            const u = (x - x0) / (b.w + b.h * 0.1);
            const y = y0 + Math.sin(u * waves * Math.PI * 2) * amp;
            x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
    });

    /* ── Transition type: "curtain" — two paper panels close, then open on the next scene.
     *    fn(ctx, A, B, p, P)  A = outgoing scene canvas, B = incoming, p = eased progress 0→1,
     *    P = { W, H, s, tr (the preset), color, shadow, focus:[fx,fy] }                                   */
    K.registerTransition('curtain', (ctx, A, B, p, P) => {
        const W = P.W, H = P.H;
        ctx.drawImage(p < 0.5 ? A : B, 0, 0);
        const close = p < 0.5 ? p * 2 : (1 - p) * 2;            // 0 → 1 → 0
        const half = (W / 2) * close;
        ctx.fillStyle = P.color;
        ctx.shadowColor = P.shadow; ctx.shadowBlur = 24 * P.s;
        ctx.fillRect(0, 0, half, H);
        ctx.fillRect(W - half, 0, half, H);
    });

    /* ── Background layer type: "rain" — slanted streaks that parallax with the camera.
     *    fn(R, L, i, t)  L = the layer object from the preset, i = layer index, t = scene time (s).
     *    bgPoint(R, x, y, depth) → {x, y, k} projects a world point at a depth, so layers move with the camera. */
    K.registerBackgroundLayer('rain', (R, L, i, t) => {
        const ctx = R.ctx, n = U.num(L.count, 60), depth = U.num(L.depth, 2200);
        const P = bgPoint(R, 0, 0, depth);
        const rand = rng((R.scene && R.scene.seed || 'rain') + ':rain' + i);
        ctx.setTransform(R.s, 0, 0, R.s, R.ox, R.oy);
        ctx.globalAlpha = R.alpha * U.num(L.opacity, 0.25);
        ctx.strokeStyle = resolveColor(R.theme, L.color || '@ink');
        ctx.lineWidth = U.num(L.width, 2);
        const Wf = R.frame.width, Hf = R.frame.height, len = U.num(L.length, 40), speed = U.num(L.speed, 500);
        ctx.beginPath();
        for (let k = 0; k < n; k++) {
            const x = ((rand() * Wf + P.x) % Wf + Wf) % Wf;
            const y = ((rand() * Hf + t * speed * (0.7 + rand() * 0.6) + P.y) % (Hf + len) + (Hf + len)) % (Hf + len) - len;
            ctx.moveTo(x, y); ctx.lineTo(x - len * 0.25, y + len);
        }
        ctx.stroke();
    });
})();
