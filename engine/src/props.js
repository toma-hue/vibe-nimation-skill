// PROPS — objects a series keeps coming back to. new_short copies the series' own props.js
// (Vibe-nimation episodes/_Locatii/<Series>/props.js) over this default; start one by copying this file there.
// Every prop: name(ctx, x, y, s, o) — (x, y) = where it touches the floor / wall anchor, s = scale (1 ≈ next to an
// adult at wide-shot scale 1), drawn in the kit's style, and it registers itself for the framing check with mark().
import { OL, P, smooth, ink, shade, glow, circle, rgba } from './core/lib.js';
import { mark } from './core/scene.js';

/** a kid's bike (BMX-style), side view; o.color, o.flip */
export function bike(ctx, x, y, s = 1, o = {}) {
  const col = o.color || '#B8322E';
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (o.flip ? -1 : 1), s);
  for (const wx of [-120, 120]) { circle(ctx, wx, -78, 76); ctx.lineWidth = 14; ctx.strokeStyle = OL; ctx.stroke(); circle(ctx, wx, -78, 72); ctx.lineWidth = 7; ctx.strokeStyle = '#3A3638'; ctx.stroke(); circle(ctx, wx, -78, 8); ink(ctx, '#C9C4BC', 3); }
  ctx.lineCap = 'round';
  for (const [a, b] of [[[-120, -78], [-10, -78]], [[-10, -78], [70, -190]], [[-120, -78], [-40, -190]], [[-40, -190], [70, -190]], [[-40, -190], [-10, -78]], [[70, -190], [120, -78]], [[70, -190], [86, -238]]]) {
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.strokeStyle = OL; ctx.lineWidth = 16; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 9; ctx.stroke();
  }
  P(ctx, [[-70, -204], [-10, -204], [-14, -190], [-66, -190]]); ink(ctx, '#2A2628', 4);
  P(ctx, [[66, -246], [116, -246], [116, -236], [66, -236]]); ink(ctx, '#2A2628', 4);
  mark(ctx, o.name || 'bike', -200, -250, 200, 0);
  ctx.restore();
}

/** a wall phone with a coiled cord; o.ringing (0..1 shake), o.off = handset off the hook */
export function wallPhone(ctx, x, y, s = 1, o = {}) {
  const col = o.color || '#E8DCC4', sh = (o.ringing || 0) * Math.sin((o.t || 0) * 60) * 3;
  ctx.save(); ctx.translate(x + sh, y); ctx.scale(s, s);
  smooth(ctx, [[-34, -150], [34, -150], [38, 0], [-38, 0]], true, 0.3); ink(ctx, col);
  for (let k = 0; k < 9; k++) { circle(ctx, (k % 3 - 1) * 16, -70 + Math.floor(k / 3) * 18, 5); ink(ctx, shade(col, -0.25), 2); }
  if (!o.off) { smooth(ctx, [[-26, -164], [26, -164], [30, -120], [22, -100], [-22, -100], [-30, -120]], true, 0.5); ink(ctx, shade(col, -0.08)); }
  ctx.beginPath(); ctx.moveTo(0, 0); for (let k = 0; k < 14; k++) ctx.quadraticCurveTo((k % 2 ? 12 : -12), 10 + k * 10, 0, 16 + k * 10); ctx.strokeStyle = OL; ctx.lineWidth = 4; ctx.stroke();
  mark(ctx, o.name || 'wall phone', -40, -170, 40, 0);
  ctx.restore();
}

/** a walkie-talkie held at (x, y) (its bottom); o.led on/off */
export function walkie(ctx, x, y, s = 1, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(o.angle || 0);
  P(ctx, [[-22, -110], [22, -110], [22, 0], [-22, 0]]); ink(ctx, o.color || '#2A2A30');
  ctx.fillStyle = OL; ctx.fillRect(8, -170, 7, 62);
  for (let k = 0; k < 5; k++) { ctx.fillStyle = shade(o.color || '#2A2A30', 0.25); ctx.fillRect(-14, -96 + k * 9, 28, 4); }
  if (o.led) { glow(ctx, -12, -48, 22, '#FF4A3A', 0.6); } circle(ctx, -12, -48, 4); ink(ctx, o.led ? '#FF6A5A' : '#5A2A2A', 2);
  mark(ctx, o.name || 'walkie-talkie', -24, -172, 24, 0);
  ctx.restore();
}

/** a flashlight at (x, y) pointing at angle (rad); o.on draws the beam (length o.beam) */
export function flashlight(ctx, x, y, s = 1, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(o.angle || 0);
  if (o.on !== false) {
    const L = o.beam || 700, g = ctx.createLinearGradient(0, 0, L, 0); g.addColorStop(0, rgba('#FFF2C8', 0.55)); g.addColorStop(1, rgba('#FFF2C8', 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(40, -14); ctx.lineTo(L, -L * 0.22); ctx.lineTo(L, L * 0.22); ctx.lineTo(40, 14); ctx.fill();
  }
  P(ctx, [[-60, -12], [26, -12], [44, -20], [44, 20], [26, 12], [-60, 12]]); ink(ctx, o.color || '#3A4A6A', 4);
  mark(ctx, o.name || 'flashlight', -62, -22, 46, 22);
  ctx.restore();
}

/** a tall faceless creature in silhouette (o.open 0..1 opens the head like petals); never gory */
export function creature(ctx, x, y, s = 1, o = {}) {
  const t = o.t || 0, open = o.open || 0, col = o.color || '#2A2230';
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 30, -560); ctx.quadraticCurveTo(sd * 70, -300, sd * 46 + Math.sin(t * 2 + sd) * 6, 0); ctx.strokeStyle = OL; ctx.lineWidth = 30; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 22; ctx.stroke(); }
  smooth(ctx, [[-60, -980], [60, -980], [80, -760], [56, -540], [-56, -540], [-80, -760]], true, 0.5); ink(ctx, col);
  for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 70, -940); ctx.quadraticCurveTo(sd * 170, -700, sd * 120 + Math.sin(t * 3 + sd) * 10, -420); ctx.strokeStyle = OL; ctx.lineWidth = 24; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 16; ctx.stroke(); }
  if (open > 0) for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.55 * open; smooth(ctx, [[0, -1000], [Math.cos(a - 0.2) * 120 * open, -1000 + Math.sin(a - 0.2) * 120 * open], [Math.cos(a) * 170 * open, -1000 + Math.sin(a) * 170 * open], [Math.cos(a + 0.2) * 120 * open, -1000 + Math.sin(a + 0.2) * 120 * open]], true, 0.4); ink(ctx, shade(col, 0.12)); }
  else smooth(ctx, [[-34, -1000], [0, -1060], [34, -1000], [0, -975]], true, 0.6), ink(ctx, col);
  mark(ctx, o.name || 'creature', -180, -1070, 180, 0);
  ctx.restore();
}
