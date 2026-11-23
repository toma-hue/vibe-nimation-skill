// 2.5D camera: a scene is a stack of layers, each with a parallax factor f
//   f = 0 sky (never moves) · 0.1 sun/clouds · 0.25 far city · 0.5 mid · 0.85–1 actors · 1.3–1.6 foreground
// The camera {x, y, zoom, rot, shake, cy} moves; each layer moves/zooms by its own f → depth.
import { W, H, key, ease, clamp, noise1, scratch, hash, rgba } from './lib.js';

/** a layer: L(f, draw(ctx, t), {blur}) — blur in px for depth of field (drawn at 1/4 size, cheap) */
export const L = (f, draw, o = {}) => ({ f, draw, ...o });

/** camera at shot-local time lt from keyframes: camAt(lt, [[0, {x:-60, zoom:1}], [3, {x:40, zoom:1.15}]]) */
export function camAt(lt, ks, e = ease.inOut) {
  const keys = ['x', 'y', 'zoom', 'rot', 'cy'];
  const base = { x: 0, y: 0, zoom: 1, rot: 0, cy: 960 };
  const vals = keys.map((k) => key(lt, ks.map(([t, v]) => [t, v[k] ?? base[k]]), e));
  const cam = {}; keys.forEach((k, i) => (cam[k] = vals[i])); cam.shake = 0; return cam;
}
/** add a decaying shake burst at time t0 (seconds, shot-local): cam.shake = shakeAt(lt, [[t0, amp, dur]]) */
export function shakeAt(lt, hits) { let s = 0; for (const [t0, a, d = 0.35] of hits) if (lt >= t0 && lt < t0 + d) s += a * (1 - (lt - t0) / d); return s; }

export function scene(ctx, cam, layers, t = 0) {
  const sx = cam.shake ? noise1(t * 30) * cam.shake : 0, sy = cam.shake ? noise1(t * 30 + 50) * cam.shake : 0;
  for (const ly of layers) {
    if (!ly) continue;
    const z = 1 + (cam.zoom - 1) * ly.f;
    const setCam = (c, k) => {
      c.scale(k, k); c.translate(W / 2 + sx * ly.f, H / 2 + sy * ly.f); c.scale(z, z); c.rotate((cam.rot || 0) * ly.f);
      c.translate(-W / 2 - cam.x * ly.f, -(cam.cy ?? 960) - cam.y * ly.f);
    };
    if (!ly.blur) { ctx.save(); setCam(ctx, 1); ly.draw(ctx, t); ctx.restore(); continue; }
    const [oc, o] = scratch('blur', W / 4, H / 4);
    o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, W / 4, H / 4); o.save(); setCam(o, 0.25); ly.draw(o, t); o.restore();
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = `blur(${ly.blur}px)`; ctx.drawImage(oc, 0, 0, W, H); ctx.restore();
  }
}

// ---------- finishing FX (full frame, after the scene) ----------
let GRAIN = null;
function grainTex() {
  if (GRAIN) return GRAIN;
  const c = document.createElement('canvas'); c.width = W + 200; c.height = H + 200;
  const g = c.getContext('2d'), d = g.createImageData(c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) { const v = hash(i * 0.37) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0); return (GRAIN = c);
}
export function finish(ctx, t, o = {}) {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = 'none';
  if (o.tint) { ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = o.tint; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.78);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(10,0,20,${o.vignette ?? 0.5})`); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  // grain re-rolls at 12 fps: film look, and it compresses far better than per-frame noise
  const f = Math.floor(t * 12); ctx.globalAlpha = o.grain ?? 0.04; ctx.drawImage(grainTex(), -(f * 37 % 200), -(f * 53 % 200)); ctx.restore();
}
/** white/colour flash that fades over d seconds */
export function flash(ctx, lt, t0 = 0, d = 0.15, color = '255,235,210', a = 0.6) {
  if (lt < t0 || lt > t0 + d) return; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = `rgba(${color},${a * (1 - (lt - t0) / d)})`; ctx.fillRect(0, 0, W, H); ctx.restore();
}
/** anime speed lines toward a point (impact / shock), k 0..1 */
export function speedLines(ctx, t, k = 1, cx = W / 2, cy = H * 0.45, color = '#FFFFFF') {
  if (k <= 0) return; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.55 * k; ctx.fillStyle = color;
  const fr = Math.floor(t * 12);
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2 + hash(i + fr * 7) * 0.08, r0 = 420 + hash(i * 3 + fr) * 260, r1 = 1500, w = 0.004 + hash(i * 5 + fr) * 0.01;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a - w) * r1, cy + Math.sin(a - w) * r1); ctx.lineTo(cx + Math.cos(a + w) * r1, cy + Math.sin(a + w) * r1); ctx.fill();
  }
  ctx.restore();
}
/** cinema bars, k 0..1 */
export function bars(ctx, k = 1, h = 160) { if (k <= 0) return; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, h * k); ctx.fillRect(0, H - h * k, W, h * k); ctx.restore(); }
/** fade to/from black: k 0 clear … 1 black */
export function fade(ctx, k, color = '#000') { if (k <= 0) return; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = clamp(k); ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); ctx.restore(); }
/** red/teal pulse for danger, k 0..1 */
export function pulse(ctx, t, k = 1, color = '#C0182F') { if (k <= 0) return; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); const a = (0.25 + 0.2 * Math.sin(t * 8)) * k; const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.7); g.addColorStop(0, rgba(color, 0)); g.addColorStop(1, rgba(color, a)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore(); }
