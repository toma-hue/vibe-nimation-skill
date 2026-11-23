// Shared constants and helpers. Every frame is a pure function of time t: never Math.random() or Date.
export const W = 1080, H = 1920, FPS = 30;
export const OL = '#1C1418';                 // the one outline ink
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, x) => clamp((x - a) / (b - a));
export const ease = {
  lin: (t) => t, inOut: (t) => t * t * (3 - 2 * t), out: (t) => 1 - (1 - t) ** 3, in: (t) => t ** 3,
  outBack: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2, sine: (t) => 0.5 - Math.cos(Math.PI * t) / 2,
  outElastic: (t) => (t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1),
};
/** keyframes: key(t, [[t0, v0], [t1, v1], …], ease.inOut) — numbers or arrays of numbers */
export function key(t, ks, e = ease.inOut) {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    if (t <= ks[i][0]) {
      const u = e((t - ks[i - 1][0]) / (ks[i][0] - ks[i - 1][0])), a = ks[i - 1][1], b = ks[i][1];
      return Array.isArray(a) ? a.map((v, k) => lerp(v, b[k], u)) : lerp(a, b, u);
    }
  }
  return ks[ks.length - 1][1];
}
export function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
export function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export function noise1(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; }

// colours
const toRGB = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
export function mix(a, b, t) { const A = toRGB(a), B = toRGB(b); return toHex(...A.map((v, i) => lerp(v, B[i], t))); }
/** shade(c, -0.3) darker toward cool purple-black, shade(c, 0.2) lighter toward warm */
export function shade(c, k) { return k < 0 ? mix(c, '#1A1030', -k) : mix(c, '#FFF4E0', k); }
export function rgba(c, a) { const [r, g, b] = toRGB(c); return `rgba(${r},${g},${b},${a})`; }

const SCR = {};
export function scratch(name, w, h) {
  let s = SCR[name];
  if (!s || s[0].width !== w || s[0].height !== h) { const c = document.createElement('canvas'); c.width = w; c.height = h; s = SCR[name] = [c, c.getContext('2d')]; }
  return s;
}

// ---------- vector drawing kit (clean lines, cel shading) ----------
export function P(ctx, pts, close = true) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}
/** smooth path through points (Catmull-Rom → bezier); k = 0 sharp corners … 0.6 round */
export function smooth(ctx, pts, close = true, k = 0.5) {
  const n = pts.length; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  const g = (i) => pts[close ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < (close ? n : n - 1); i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * k / 3, p1[1] + (p2[1] - p0[1]) * k / 3, p2[0] - (p3[0] - p1[0]) * k / 3, p2[1] - (p3[1] - p1[1]) * k / 3, p2[0], p2[1]);
  }
  if (close) ctx.closePath();
}
/** fill the current path and outline it in ink */
export function ink(ctx, fill, w = 5) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (w > 0) { ctx.lineWidth = w; ctx.strokeStyle = OL; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
}
/** cel shading: clip to a shape (pathFn builds its path), then draw shadows/highlights inside it */
export function shadeIn(ctx, pathFn, drawFn) { ctx.save(); pathFn(); ctx.clip(); drawFn(); ctx.restore(); }
/** a limb: round-capped thick line with an ink outline */
export function capsule(ctx, a, b, w, fill, olw = 5) {
  ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
  if (olw) { ctx.strokeStyle = OL; ctx.lineWidth = w + olw * 2; ctx.stroke(); }
  ctx.strokeStyle = fill; ctx.lineWidth = w; ctx.stroke();
}
export function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); }
export function glow(ctx, x, y, r, color, a = 0.6) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
