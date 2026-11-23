// Cutout / puppet rig driven by a character spec (data/characters.json, see reference/CHARACTERS.md).
// Character units: feet at (0,0), y up is negative, an adult is ≈ 930 units tall (head top ≈ -930).
// drawCharacter(ctx, spec, x, y, scale, opts) — opts:
//   t (s, for wind/breath), expr (EXPR name or object), talk 0..1 (mouth open, e.g. mouthAt(t)), blink 0..1,
//   pose (POSES name or object, or walkPose(phase)), turn -1..1 (+ faces screen-right), back (true = seen from behind),
//   look [x, y] (-1..1 eyes), headTilt (rad), lean (rad, whole body around the hips), wind 0..2, flip, alpha, shadow
import { OL, P, smooth, ink, shadeIn, capsule, circle, shade, mix, clamp, lerp, hash, ease } from './lib.js';

// ---------- expressions ----------
export const EXPR = {
  neutral:    { brow: 0.05, browY: 0, open: 0.9, look: [0, 0], mouth: 'flat', mo: 0 },
  happy:      { brow: -0.12, browY: -3, open: 0.8, look: [0, 0], mouth: 'smile', mo: 0.15 },
  laugh:      { brow: -0.2, browY: -5, open: 0.25, look: [0, 0], mouth: 'grin', mo: 0.8 },
  smirk:      { brow: -0.05, browY: -2, open: 0.75, look: [0.3, 0], mouth: 'smirk', mo: 0 },
  angry:      { brow: 0.45, browY: 8, open: 0.9, look: [0, 0], mouth: 'frown', mo: 0 },
  shout:      { brow: 0.5, browY: 8, open: 0.95, look: [0, 0], mouth: 'open', mo: 1 },
  determined: { brow: 0.35, browY: 5, open: 0.85, look: [0, 0], mouth: 'tight', mo: 0 },
  shocked:    { brow: -0.3, browY: -10, open: 1.25, look: [0, 0], mouth: 'o', mo: 0.6 },
  scared:     { brow: -0.4, browY: -8, open: 1.15, look: [0.4, 0], mouth: 'wobble', mo: 0.25 },
  sad:        { brow: -0.4, browY: 0, open: 0.65, look: [0, 0.35], mouth: 'down', mo: 0 },
  crying:     { brow: -0.45, browY: 0, open: 0.4, look: [0, 0.4], mouth: 'down', mo: 0.3, tears: 1 },
  tired:      { brow: -0.22, browY: 2, open: 0.35, look: [0, 0.3], mouth: 'flat', mo: 0 },
  suspicious: { brow: 0.25, browY: 4, open: 0.45, look: [0.6, 0], mouth: 'smirk', mo: 0, asym: 1 },
  thinking:   { brow: -0.1, browY: -4, open: 0.8, look: [0.5, -0.6], mouth: 'side', mo: 0, asym: 1 },
  disgust:    { brow: 0.3, browY: 4, open: 0.55, look: [0, 0], mouth: 'down', mo: 0.1, asym: 1 },
  embarrassed:{ brow: -0.25, browY: -2, open: 0.7, look: [-0.5, 0.3], mouth: 'wobble', mo: 0.1, blush: 1 },
};
export function mixExpr(a, b, t) {
  a = typeof a === 'string' ? EXPR[a] : a; b = typeof b === 'string' ? EXPR[b] : b;
  const o = {}; for (const k of ['brow', 'browY', 'open', 'mo']) o[k] = lerp(a[k], b[k], t);
  for (const k of ['tears', 'blush', 'asym']) o[k] = lerp(a[k] || 0, b[k] || 0, t);
  o.look = [lerp(a.look[0], b.look[0], t), lerp(a.look[1], b.look[1], t)];
  o.mouth = t < 0.5 ? a.mouth : b.mouth; return o;
}
/** expression timeline for a shot: exprAt(lt, [[0, 'neutral'], [1.2, 'shocked'], [1.6, 'angry']]) — 0.18 s blends */
export function exprAt(t, ks, blend = 0.18) {
  let cur = ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    if (t < ks[i][0]) break;
    const u = ease.inOut(clamp((t - ks[i][0]) / blend));
    cur = mixExpr(typeof cur === 'string' ? EXPR[cur] : cur, ks[i][1], u);
  }
  return typeof cur === 'string' ? EXPR[cur] : cur;
}

// ---------- poses ----------
// arms: [out, bend] — out = upper arm angle from hanging (rad, + away from the body, ~3 = straight up),
//        bend = forearm angle relative to the upper arm (+ outward/up, − inward across the body); swing = fwd/back (walks)
// legs: [out, swing, knee] — swing = forward/back (shows when turned), knee = bend
export const POSES = {
  idle:        { L: [0.12, -0.06], R: [0.12, -0.06], legL: [0.05, 0, 0], legR: [0.05, 0, 0] },
  pockets:     { L: [0.30, -0.70], R: [0.30, -0.70], legL: [0.06, 0, 0], legR: [0.06, 0, 0] },
  point:       { L: [0.12, -0.06], R: [1.50, 0.05], legL: [0.08, 0, 0], legR: [0.05, 0, 0] },
  pointUp:     { L: [0.12, -0.06], R: [2.75, 0.1], legL: [0.05, 0, 0], legR: [0.05, 0, 0] },
  wave:        { L: [0.12, -0.06], R: [2.3, 0.7], legL: [0.05, 0, 0], legR: [0.05, 0, 0] },
  cheer:       { L: [2.7, 0.25], R: [2.7, 0.25], legL: [0.12, 0, 0], legR: [0.12, 0, 0] },
  handsOnHead: { L: [2.25, 1.95], R: [2.25, 1.95], legL: [0.06, 0, 0], legR: [0.06, 0, 0], over: true },
  fistUp:      { L: [0.15, -0.1], R: [0.55, 2.3], legL: [0.1, 0, 0], legR: [0.1, 0, 0] },
  crossed:     { L: [0.32, -2.05], R: [0.36, -1.95], legL: [0.06, 0, 0], legR: [0.06, 0, 0] },
  shrug:       { L: [0.75, 1.55], R: [0.75, 1.55], legL: [0.05, 0, 0], legR: [0.05, 0, 0] },
  reach:       { L: [0.12, -0.06], R: [1.25, -0.15], legL: [0.12, 0, 0], legR: [0.02, 0, 0] },
  defend:      { L: [0.9, 2.0], R: [0.9, 2.0], legL: [0.14, 0, 0.1], legR: [0.14, 0, 0.1], over: true },
  facepalm:    { L: [0.15, -0.1], R: [0.75, 2.55], legL: [0.05, 0, 0], legR: [0.05, 0, 0], over: true },
  hug:         { L: [1.1, -1.4], R: [1.1, -1.4], legL: [0.05, 0, 0], legR: [0.05, 0, 0] },
  sit:         { L: [0.25, -0.9], R: [0.25, -0.9], legL: [0.1, 1.45, 1.5], legR: [0.1, 1.45, 1.5] },
  kneel:       { L: [0.2, -0.3], R: [0.2, -0.3], legL: [0.05, 1.5, 1.5], legR: [0.05, 0.05, 1.6] },
  crouch:      { L: [0.5, -0.9], R: [0.5, -0.9], legL: [0.25, 0.9, 1.9], legR: [0.25, 0.9, 1.9] },
};
export function getPose(p) { return typeof p === 'string' ? POSES[p] || POSES.idle : p || POSES.idle; }
export function mixPose(a, b, u) {
  a = getPose(a); b = getPose(b); const m = (x, y) => x.map((v, i) => lerp(v, y[i], u)), o = {};
  for (const k of ['L', 'R', 'legL', 'legR']) o[k] = m(a[k], b[k]);
  for (const k of ['swingL', 'swingR', 'bob']) o[k] = lerp(a[k] || 0, b[k] || 0, u);
  o.over = u < 0.5 ? a.over : b.over; return o;
}
/** walk / run cycle: phase in cycles (e.g. t * 1.8 for a walk); show it with turn ≈ ±0.8 */
export function walkPose(phase, run = false) {
  const p = phase * Math.PI * 2, A = run ? 0.6 : 0.3, s = Math.sin(p);
  const knee = (x) => Math.max(0, -Math.sin(x)) * (run ? 1.6 : 0.8) + (run ? 0.25 : 0.05);
  return {
    L: [0.1, run ? 1.2 : 0.12], R: [0.1, run ? 1.2 : 0.12], swingL: -s * (run ? 0.7 : 0.35), swingR: s * (run ? 0.7 : 0.35),
    legL: [0.04, s * A, knee(p)], legR: [0.04, -s * A, knee(p + Math.PI)], bob: Math.abs(Math.cos(p)) * (run ? 26 : 12),
  };
}

// ---------- colours from the spec ----------
function palette(S) {
  const top = S.top || {}, bot = S.bottom || {}, hair = S.hair || {};
  const c = {
    skin: S.skin || '#E6B58E', hair: hair.color || '#2A1C18', iris: (S.eyes || {}).iris || (S.eyes || {}).color || '#5A3A26',
    top: top.color || '#6E1B2E', inner: top.inner || '#E8DCCB', bottom: bot.color || '#252027',
    shoe: (S.shoes || {}).color || '#3A3340', sole: (S.shoes || {}).sole || '#EDE6DC', rim: '#FF9E5E',
  };
  c.skinSh = shade(c.skin, -0.22); c.hairHi = shade(c.hair, 0.22); c.topSh = shade(c.top, -0.32); c.topHi = shade(c.top, 0.16);
  c.innerSh = shade(c.inner, -0.18); c.bottomSh = shade(c.bottom, -0.3); c.bottomHi = shade(c.bottom, 0.14);
  c.brow = (S.brows || {}).color || shade(c.hair, -0.1);
  return c;
}

// ---------- head ----------
function faceCurve(ctx, fx, jaw) {
  const w = jaw === 'square' ? 68 : jaw === 'narrow' ? 60 : 64, chin = jaw === 'square' ? 14 : jaw === 'narrow' ? 0 : 6;
  ctx.beginPath(); ctx.moveTo(-w + fx * 0.3, -880);
  ctx.bezierCurveTo(-w - 4 + fx * 0.3, -820, -w + 2 + fx * 0.6, -790, -w + 16 + fx * 0.8, -760 + (jaw === 'square' ? 6 : 0));
  ctx.quadraticCurveTo(-22 + fx - chin * 0.3, -730, -chin + fx * 1.2, -726); ctx.lineTo(chin + fx * 1.2, -726);
  ctx.quadraticCurveTo(22 + fx + chin * 0.3, -730, w - 16 + fx * 0.8, -760 + (jaw === 'square' ? 6 : 0));
  ctx.bezierCurveTo(w - 2 + fx * 0.6, -790, w + 4 + fx * 0.3, -820, w + fx * 0.3, -880); ctx.closePath();
}

function hairBack(ctx, S, c, t, wind, back) {
  const st = (S.hair || {}).style || 'short', sway = Math.sin(t * 2.2) * 4 * wind;
  if (st === 'bald') return;
  ctx.save();
  if (st === 'messy' || st === 'spiky') {
    const pts = [], N = st === 'spiky' ? 12 : 10;
    for (let i = 0; i <= N; i++) {
      const a = Math.PI * (0.98 + 1.04 * i / N), side = Math.cos(a);
      pts.push([Math.cos(a) * (94 + 6 * hash(i * 3)) * 1.08, -840 + Math.sin(a) * (94 + 6 * hash(i * 3))]);
      if (i < N) {
        const am = a + Math.PI * 1.04 / N * 0.5 + side * 0.12, rt = (st === 'spiky' ? 125 : 113) + 13 * hash(i);
        pts.push([Math.cos(am) * rt * 1.1 + Math.sin(t * 2.2 + i * 1.7) * 4 * wind + side * 8, -840 + Math.sin(am) * rt + Math.abs(side) * 6]);
      }
    }
    pts.push([84, -770], [72, -790], [-72, -790], [-84, -770]);
    smooth(ctx, pts, true, st === 'spiky' ? 0.3 : 0.55); ink(ctx, c.hair);
  } else if (st === 'long' || st === 'bob' || st === 'wavy') {
    const bottom = st === 'bob' ? -735 : -600, w = st === 'bob' ? 92 : 96;
    const pts = [[-w + 2, -860], [-w + 4, -915], [-52, -952], [0, -960], [52, -952], [w - 4, -915], [w - 2, -860], [w + 4 + sway * 0.5, bottom + 40], [w - 6 + sway, bottom],
      [w * 0.4, bottom + 14], [-w * 0.4, bottom + 14], [-w + 6 + sway, bottom], [-w - 4 + sway * 0.5, bottom + 40]];
    if (st === 'wavy') pts.splice(5, 0, [w + 14, -760], [w - 2, -700]);
    smooth(ctx, pts, true, 0.5); ink(ctx, c.hair);
  } else if (st === 'curly' || st === 'afro') {
    const R = st === 'afro' ? 128 : 100, cy = st === 'afro' ? -858 : -845, n = st === 'afro' ? 16 : 13;
    ctx.beginPath();
    for (let i = 0; i < n; i++) { const a = Math.PI * (0.92 + 1.16 * i / (n - 1)); circle(ctx, Math.cos(a) * R, cy + Math.sin(a) * R * 0.9, st === 'afro' ? 34 : 26); ctx.fillStyle = c.hair; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = OL; ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(0, cy + 10, R * 0.98, R * 0.85, 0, 0, Math.PI * 2); ctx.fillStyle = c.hair; ctx.fill();
  } else if (st === 'ponytail' || st === 'bun') {
    if (st === 'ponytail') { smooth(ctx, [[30, -900], [118 + sway, -880], [140 + sway * 1.5, -790], [120 + sway * 2, -700], [96 + sway, -760], [70, -850]], true, 0.5); ink(ctx, c.hair); }
    else { circle(ctx, 0, -955, 40); ink(ctx, c.hair); }
    smooth(ctx, [[-82, -800], [-90, -880], [-40, -935], [40, -935], [90, -880], [82, -800], [0, -880]], true, 0.45); ink(ctx, c.hair);
  } else { // short, swept, buzz, sidepart
    const r = st === 'buzz' ? 84 : 92, top = st === 'buzz' ? -918 : st === 'swept' ? -945 : -935;
    smooth(ctx, [[-r + 6, -790], [-r - 2, -870], [-55, top + 8], [10, top], [60, top + 10], [r + 2, -870], [r - 6, -790], [0, -860]], true, 0.5); ink(ctx, c.hair);
  }
  if (back) { // strands seen from behind
    ctx.strokeStyle = c.hairHi; ctx.lineWidth = 4;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-50 + i * 25, -905); ctx.quadraticCurveTo(-45 + i * 24, -840, -40 + i * 22, st === 'long' ? -640 : -790); ctx.stroke(); }
  }
  ctx.restore();
}

function hairFront(ctx, S, c, t, wind, fx) {
  const st = (S.hair || {}).style || 'short', bangs = (S.hair || {}).bangs, sway = Math.sin(t * 2.6) * 2.5 * wind;
  if (st === 'bald' || st === 'buzz') {
    if (st === 'buzz') { smooth(ctx, [[-70, -870], [-40, -905], [40, -905], [70, -870], [40, -890], [-40, -890]], true, 0.4); ctx.fillStyle = c.hair; ctx.fill(); }
    return;
  }
  ctx.save(); ctx.translate(fx * 0.5, 0);
  if (st === 'messy' || st === 'spiky' || bangs === 'messy') {
    const b = [[-84, -905], [-80, -842], [-70, -888], [-56, -852], [-44, -892], [-30, -828], [-20, -884], [-4, -856], [8, -896], [20, -834], [30, -886], [46, -860], [56, -894], [70, -838], [80, -880], [86, -905]]
      .map(([x, y], i) => [x + (i % 2 ? sway : 0), y]);
    smooth(ctx, [...b, [40, -935], [-40, -935]], true, 0.18); ink(ctx, c.hair);
  } else if (bangs === 'full') {
    smooth(ctx, [[-86, -900], [-80, -846], [-40, -852 + sway * 0.3], [0, -848], [40, -852], [80, -846], [86, -900], [0, -935]], true, 0.35); ink(ctx, c.hair);
  } else if (st === 'long' || st === 'bob' || st === 'wavy' || st === 'ponytail' || st === 'bun' || bangs === 'part') {
    // middle part: two curtains
    for (const s of [-1, 1]) {
      smooth(ctx, [[s * 4, -930], [s * 52, -905], [s * 86, -850], [s * 88 + sway * 0.3, -780], [s * 70, -800], [s * 54, -860], [s * 18, -890]], true, 0.45); ink(ctx, c.hair);
    }
  } else if (st === 'curly' || st === 'afro') {
    for (let i = 0; i < 6; i++) { circle(ctx, -62 + i * 25, -878 + (i % 2) * 8, 17); ink(ctx, c.hair, 4); }
  } else if (st === 'swept' || bangs === 'side') {
    smooth(ctx, [[-86, -890], [-60, -930], [20, -942], [88, -905], [84, -860], [40, -878], [-10, -862 + sway * 0.4], [-60, -840], [-80, -850]], true, 0.4); ink(ctx, c.hair);
  } else { // short
    smooth(ctx, [[-86, -880], [-78, -910], [0, -935], [78, -910], [86, -880], [55, -880], [30, -866 + sway * 0.3], [0, -874], [-30, -864], [-60, -872]], true, 0.35); ink(ctx, c.hair);
  }
  ctx.strokeStyle = c.hairHi; ctx.lineWidth = 4;
  for (const [x, y] of [[-48, -915], [-8, -920], [32, -915]]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 5, y + 14, x + sway, y + 26); ctx.stroke(); }
  ctx.restore();
}

export function drawHead(ctx, S, o = {}) {
  const c = o._c || palette(S), e = typeof o.expr === 'string' ? EXPR[o.expr] : o.expr || EXPR.neutral;
  const t = o.t || 0, turn = clamp(o.turn || 0, -0.8, 0.8), wind = o.wind ?? 1, fx = turn * 24;
  const fem = S.gender === 'f', face = S.face || {}, jaw = face.jaw || (fem ? 'narrow' : 'soft');
  if (!(o._longDone && ['long', 'wavy'].includes((S.hair || {}).style))) hairBack(ctx, S, c, t, wind, o.back);
  if (o.back) {
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 66, -812, 11, 17, 0, 0, Math.PI * 2); ink(ctx, c.skin, 4); }
    const st = (S.hair || {}).style || 'short';
    if (st !== 'bald' && st !== 'long' && st !== 'bob') { smooth(ctx, [[-80, -800], [-70, -762], [-35, -775], [0, -758], [35, -775], [70, -762], [80, -800], [60, -905], [-60, -905]], true, 0.3); ink(ctx, c.hair); }
    accessoriesHead(ctx, S, c, 0, true);
    return;
  }
  // ears
  for (const s of [-1, 1]) {
    if (turn * s > 0.45) continue;
    ctx.beginPath(); ctx.ellipse(s * 64 + fx * 0.4, -812, 11, 17, 0, 0, Math.PI * 2); ink(ctx, c.skin, 4);
    if ((S.accessories || []).some((a) => a.type === 'earrings')) { circle(ctx, s * 64 + fx * 0.4, -792, 5); ink(ctx, '#E8C46A', 2); }
  }
  const fc = () => faceCurve(ctx, fx, jaw);
  fc(); ink(ctx, c.skin);
  shadeIn(ctx, fc, () => {
    ctx.fillStyle = c.skinSh; ctx.beginPath(); ctx.moveTo(30 + fx, -900); ctx.quadraticCurveTo(62 + fx, -800, 20 + fx, -720); ctx.lineTo(95, -720); ctx.lineTo(95, -900); ctx.fill();
    ctx.fillStyle = 'rgba(80,30,60,0.22)'; ctx.fillRect(-95, -905, 190, 50);
    if (face.beard === 'full') { ctx.fillStyle = c.hair; ctx.beginPath(); ctx.moveTo(-70, -800); ctx.quadraticCurveTo(-50, -715, 0 + fx, -712); ctx.quadraticCurveTo(50, -715, 70, -800); ctx.lineTo(50, -790); ctx.quadraticCurveTo(0, -735, -50, -790); ctx.fill(); }
    if (face.beard === 'stubble') { ctx.fillStyle = 'rgba(40,25,25,0.22)'; ctx.beginPath(); ctx.moveTo(-66, -800); ctx.quadraticCurveTo(-45, -718, fx, -715); ctx.quadraticCurveTo(45, -718, 66, -800); ctx.quadraticCurveTo(0, -760, -66, -800); ctx.fill(); }
    if (face.freckles) { ctx.fillStyle = shade(c.skin, -0.35); for (let i = 0; i < 10; i++) { circle(ctx, (i < 5 ? -38 : 22) + (i % 5) * 4 + fx, -786 + (i % 3) * 5, 1.8); ctx.fill(); } }
    if (e.blush) { ctx.fillStyle = `rgba(230,90,110,${0.35 * e.blush})`; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 38 + fx, -782, 15, 7, 0, 0, Math.PI * 2); ctx.fill(); } }
    // warm rim light on the sunset side
    ctx.save(); ctx.beginPath(); ctx.rect(-100, -900, 52, 200); ctx.clip(); fc(); ctx.strokeStyle = c.rim; ctx.globalAlpha = 0.45; ctx.lineWidth = 14; ctx.stroke(); ctx.restore();
  });
  // eyes
  const eo = clamp(e.open * (1 - (o.blink || 0)), 0.04, 1.4), look = o.look || e.look;
  for (const s of [-1, 1]) {
    const far = turn * s > 0 ? 1 - Math.abs(turn) * 0.35 : 1, asym = (e.asym || 0) * (s > 0 ? 1 : 0);
    const ex = s * 29 * far + fx * 1.1, ey = -808, w = (fem ? 20 : 19) * far, h = (fem ? 14.5 : 13) * eo * (1 - asym * 0.35);
    const almond = () => { ctx.beginPath(); ctx.moveTo(ex - w, ey); ctx.quadraticCurveTo(ex, ey - h * 1.6, ex + w, ey); ctx.quadraticCurveTo(ex, ey + h * 1.1, ex - w, ey); ctx.closePath(); };
    almond(); ctx.fillStyle = '#FBF6F0'; ctx.fill();
    shadeIn(ctx, almond, () => {
      const ix = ex + look[0] * 7 + turn * 4, iy = ey + look[1] * 4 - 1, ir = e.open > 1.1 ? 8 : 10.5;
      ctx.fillStyle = c.iris; circle(ctx, ix, iy, ir); ctx.fill();
      ctx.fillStyle = OL; circle(ctx, ix, iy, ir * 0.5); ctx.fill();
      ctx.fillStyle = '#fff'; circle(ctx, ix - 3, iy - 4, 3); ctx.fill();
      ctx.fillStyle = 'rgba(60,20,40,0.25)'; ctx.fillRect(ex - w, ey - h * 1.6, w * 2, h * 0.7);
    });
    ctx.strokeStyle = OL; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ex - w + 2 * s, ey + 1); ctx.quadraticCurveTo(ex, ey - h * 1.75, ex + w + 2, ey - 1); ctx.lineWidth = fem ? 7 : 6; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex + s * w, ey - 2); ctx.lineTo(ex + s * (w + (fem ? 10 : 7)), ey - (fem ? 9 : 6)); ctx.lineWidth = 4; ctx.stroke();
    if (fem) { ctx.beginPath(); ctx.moveTo(ex + s * (w - 6), ey - h * 1.2); ctx.lineTo(ex + s * (w + 2), ey - h * 1.2 - 8); ctx.lineWidth = 3; ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(ex - w * 0.6, ey + h * 0.85); ctx.quadraticCurveTo(ex, ey + h * 1.05, ex + w * 0.6, ey + h * 0.85); ctx.lineWidth = 2.5; ctx.stroke();
    if (e.tears) { ctx.fillStyle = 'rgba(170,215,255,0.85)'; const ty = ey + 14 + ((t * 40 + s * 7) % 40); ctx.beginPath(); ctx.ellipse(ex - s * 6, ty, 4, 7, 0, 0, Math.PI * 2); ctx.fill(); }
    // brow
    const by = ey - 30 + e.browY + (eo > 1.1 ? -6 : 0) - asym * 8, bi = e.brow * 18 * (1 - asym * 1.6);
    ctx.beginPath(); ctx.moveTo(ex + s * 6 - s * 8 * -1 - s * 14, by + bi + 2); ctx.quadraticCurveTo(ex + s * 6, by - 8 - bi * 0.2, ex + s * 24 * far, by - bi * 0.5 - 2);
    ctx.lineWidth = (S.brows || {}).thick || (fem ? 6 : 8); ctx.strokeStyle = c.brow; ctx.stroke();
  }
  // glasses
  if (face.glasses) {
    const g = typeof face.glasses === 'object' ? face.glasses : {}; ctx.strokeStyle = g.color || '#221A1E'; ctx.lineWidth = 5;
    for (const s of [-1, 1]) { const ex = s * 29 + fx * 1.1; ctx.beginPath(); if (g.shape === 'square') ctx.rect(ex - 25, -828, 50, 38); else ctx.ellipse(ex, -808, 26, 22, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-4 + fx, -812); ctx.lineTo(4 + fx, -812); ctx.stroke();
  }
  // nose
  ctx.beginPath(); ctx.moveTo(fx * 1.4 + 2, -792); ctx.quadraticCurveTo(fx * 1.4 - 5, -778, fx * 1.4 + 3, -775); ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.stroke();
  drawMouth(ctx, e, clamp((e.mo || 0) + (o.talk || 0)), fx * 1.3, -752, fem, t);
  if (face.mustache) { ctx.fillStyle = c.hair; ctx.beginPath(); ctx.ellipse(fx * 1.3 - 12, -764, 15, 6, 0.2, 0, Math.PI * 2); ctx.ellipse(fx * 1.3 + 12, -764, 15, 6, -0.2, 0, Math.PI * 2); ctx.fill(); }
  hairFront(ctx, S, c, t, wind, fx);
  accessoriesHead(ctx, S, c, fx, false);
}

function drawMouth(ctx, e, mo, mx, my, fem, t) {
  ctx.strokeStyle = OL; ctx.lineWidth = 4; ctx.lineCap = 'round';
  const sadM = e.mouth === 'down' || e.mouth === 'wobble' || e.mouth === 'frown' ? 0.5 : 0, angry = Math.max(0, e.brow, sadM);
  if (mo > 0.08 || e.mouth === 'o' || e.mouth === 'open' || e.mouth === 'grin') {
    const w = e.mouth === 'o' ? 9 + mo * 3 : 15 + mo * 6, h = 4 + mo * 15;
    if (e.mouth === 'o') { ctx.beginPath(); ctx.ellipse(mx, my + h * 0.25, w, h, 0, 0, Math.PI * 2); }
    else {
      const smile = e.mouth === 'smile' || e.mouth === 'grin' ? 1 : 0;
      const cy2 = my - 2 + angry * 16 - smile * 6, top = my - 6 - angry * 4;
      ctx.beginPath(); ctx.moveTo(mx - w, cy2); ctx.quadraticCurveTo(mx, top - 4 + smile * 4, mx + w, cy2);
      const bot = angry > 0.2 ? 1.1 : 1.6;
      ctx.quadraticCurveTo(mx + w * 0.5, my + h * bot, mx, my + h * (bot - 0.05)); ctx.quadraticCurveTo(mx - w * 0.5, my + h * bot, mx - w, cy2); ctx.closePath();
    }
    ctx.fillStyle = '#5A1220'; ctx.fill(); ctx.stroke();
    ctx.save(); ctx.clip(); ctx.fillStyle = '#fff'; ctx.fillRect(mx - w, my - 12, w * 2, 8 + angry * 10);
    if (angry > 0.2) ctx.fillRect(mx - w, my + h * 0.9, w * 2, 8);
    ctx.fillStyle = '#C0505E'; ctx.beginPath(); ctx.ellipse(mx, my + h * 1.5, w * 0.6, h * 0.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    return;
  }
  ctx.beginPath();
  switch (e.mouth) {
    case 'frown': ctx.moveTo(mx - 13, my + 3); ctx.quadraticCurveTo(mx, my - 4, mx + 13, my + 3); break;
    case 'down': ctx.moveTo(mx - 12, my + 5); ctx.quadraticCurveTo(mx, my - 3, mx + 12, my + 5); break;
    case 'smile': ctx.moveTo(mx - 14, my - 3); ctx.quadraticCurveTo(mx, my + 9, mx + 14, my - 3); break;
    case 'smirk': ctx.moveTo(mx - 12, my + 1); ctx.quadraticCurveTo(mx + 2, my + 4, mx + 14, my - 5); break;
    case 'side': ctx.moveTo(mx + 2, my); ctx.lineTo(mx + 14, my - 2); break;
    case 'tight': ctx.moveTo(mx - 12, my); ctx.lineTo(mx + 12, my); ctx.lineWidth = 5; break;
    case 'wobble': ctx.moveTo(mx - 12, my + 2); for (let k = 1; k <= 6; k++) ctx.lineTo(mx - 12 + k * 4, my + 2 + (k % 2 ? -3 : 2) + Math.sin(t * 20) * 0.8); break;
    default: ctx.moveTo(mx - 10, my); ctx.quadraticCurveTo(mx, my + 2, mx + 10, my);
  }
  ctx.stroke();
  if (fem && e.mouth !== 'tight') { ctx.strokeStyle = 'rgba(190,70,90,0.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(mx - 7, my + 6); ctx.quadraticCurveTo(mx, my + 9, mx + 7, my + 6); ctx.stroke(); }
}

function accessoriesHead(ctx, S, c, fx, back) {
  for (const a of S.accessories || []) {
    const col = a.color || '#333';
    if (a.type === 'cap') {
      smooth(ctx, [[-90, -860], [-86, -920], [-30, -962], [40, -960], [88, -915], [92, -860]], true, 0.45); ink(ctx, col);
      if (!back) { smooth(ctx, [[-80 + fx, -862], [20 + fx, -870], [118 + fx, -852], [110 + fx, -838], [-80 + fx, -846]], true, 0.3); ink(ctx, shade(col, -0.25)); }
    } else if (a.type === 'beanie') {
      smooth(ctx, [[-92, -850], [-88, -920], [-40, -965], [40, -965], [88, -920], [92, -850]], true, 0.45); ink(ctx, col);
      P(ctx, [[-94, -880], [94, -880], [94, -846], [-94, -846]]); ink(ctx, shade(col, -0.2));
    } else if (a.type === 'headband') {
      ctx.beginPath(); ctx.moveTo(-88, -872); ctx.quadraticCurveTo(0, -905, 88, -872); ctx.strokeStyle = OL; ctx.lineWidth = 16; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 10; ctx.stroke();
    }
  }
}

// ---------- body ----------
/** turned views: the far half (+x when facing right) is foreshortened */
const kx = (x, turn) => (x > 0 && turn > 0 ? x * (1 - 0.34 * clamp(turn / 0.75)) : x);
function seg(o, out, bend, swing, L1, L2, side, turn) {
  // upper + lower segment end points in the picture plane. p → 1 in profile: "out" then reads as forward/up
  const a1 = out, a2 = out + bend, ft = Math.abs(turn), p = clamp((ft - 0.3) / 0.5), dir = Math.sign(turn) || 1;
  const hx = (a) => Math.sin(a) * side * (1 - ft * 0.4) * (1 - p) + Math.sin(a) * dir * p;
  const e = [o[0] + L1 * (hx(a1) + Math.sin(swing) * turn), o[1] + L1 * Math.cos(a1) * Math.cos(swing)];
  const sw2 = swing * 1.1;
  const w = [e[0] + L2 * (hx(a2) + Math.sin(sw2) * turn), e[1] + L2 * Math.cos(a2) * Math.cos(sw2)];
  return [e, w];
}

function drawLeg(ctx, S, c, side, lp, turn, t) {
  const bt = (S.bottom || {}).type || 'pants', p = clamp((Math.abs(turn) - 0.3) / 0.5);
  const hipX = kx(side * 46 * (1 - p * 0.85), turn) + turn * 6 * (1 - p);
  const hip = [hipX, -430];
  const [out, swing, knee] = lp;
  const kneeP = [hip[0] + 205 * (Math.sin(out) * side * (1 - p) + Math.sin(swing) * turn), hip[1] + 205 * Math.cos(swing) * Math.cos(out)];
  const shinA = swing - knee;
  const ank = [kneeP[0] + 195 * (Math.sin(out * 0.6) * side * (1 - p) + Math.sin(shinA) * turn), kneeP[1] + 195 * Math.cos(shinA)];
  const baggy = bt === 'cargo' ? 1.12 : bt === 'jeans' ? 0.92 : 1;
  const legSkin = bt === 'shorts' || bt === 'skirt' || (S.top || {}).type === 'dress';
  // thigh
  if (bt === 'skirt' || (S.top || {}).type === 'dress') capsule(ctx, hip, kneeP, 44, c.skin);
  else capsule(ctx, hip, kneeP, 74 * baggy, c.bottom);
  // shin
  if (legSkin) capsule(ctx, kneeP, ank, 38, c.skin); else capsule(ctx, kneeP, ank, 64 * baggy, c.bottom);
  if (bt === 'shorts') capsule(ctx, hip, [lerp(hip[0], kneeP[0], 0.85), lerp(hip[1], kneeP[1], 0.85)], 76, c.bottom);
  if (!legSkin) { // folds + side shade
    ctx.strokeStyle = c.bottomSh; ctx.lineWidth = 12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hip[0] + side * 22, hip[1] + 20); ctx.lineTo(kneeP[0] + side * 20, kneeP[1]); ctx.lineTo(ank[0] + side * 18, ank[1] - 20); ctx.stroke();
    ctx.strokeStyle = OL; ctx.lineWidth = 3;
    for (let k = 0; k < 2; k++) { const y = ank[1] - 40 + k * 16; ctx.beginPath(); ctx.moveTo(ank[0] - 20, y); ctx.quadraticCurveTo(ank[0], y + 8, ank[0] + 22, y - 2); ctx.stroke(); }
    if (bt === 'cargo') { const m = [lerp(hip[0], kneeP[0], 0.55), lerp(hip[1], kneeP[1], 0.55)]; P(ctx, [[m[0] + side * 8, m[1] - 40], [m[0] + side * 40, m[1] - 40], [m[0] + side * 42, m[1] + 30], [m[0] + side * 8, m[1] + 30]]); ink(ctx, c.bottomHi, 3); }
    if (bt === 'jeans') { ctx.strokeStyle = shade(c.bottom, 0.3); ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(hip[0] + side * 26, hip[1] + 30); ctx.lineTo(ank[0] + side * 24, ank[1] - 10); ctx.stroke(); ctx.setLineDash([]); }
  }
  // shoe: front view = rounded toe toward camera; turned = points where the character faces
  const dir = Math.abs(turn) > 0.3 ? Math.sign(turn) : side * 0.4, len = Math.abs(turn) > 0.3 ? 70 : 52;
  smooth(ctx, [[ank[0] - 30 * Math.sign(dir || 1) * 0.6, ank[1] - 14], [ank[0] + dir * len, ank[1] - 6], [ank[0] + dir * (len + 14), ank[1] + 22], [ank[0] + dir * len * 0.6, ank[1] + 40],
    [ank[0] - 34 * Math.sign(dir || 1) * 0.6, ank[1] + 40], [ank[0] - 40 * Math.sign(dir || 1) * 0.6, ank[1] + 12]], true, 0.45); ink(ctx, c.shoe);
  P(ctx, [[ank[0] - 42 * Math.sign(dir || 1) * 0.6, ank[1] + 28], [ank[0] + dir * (len + 12), ank[1] + 28], [ank[0] + dir * len * 0.7, ank[1] + 44], [ank[0] - 36 * Math.sign(dir || 1) * 0.6, ank[1] + 44]]); ink(ctx, c.sole, 4);
  return ank;
}

function drawArm(ctx, S, c, side, ap, swing, turn, t) {
  const top = S.top || {}, sleeve = top.type === 'tshirt' || top.type === 'dress' && top.sleeves !== 'long' ? 'short' : top.type === 'tank' ? 'none' : top.sleeves || 'long';
  const sw = (S.build || {}).shoulders || 1;
  const p = clamp((Math.abs(turn) - 0.3) / 0.5);
  const sh = [kx(side * 98 * sw * (1 - Math.abs(turn) * 0.15) * (1 - p * 0.95), turn) + turn * 8 * (1 - p) - p * 4, -682];
  const [elbow, wrist] = seg(sh, ap[0], ap[1], swing || 0, 140, 128, side, turn);
  const upCol = sleeve === 'none' ? c.skin : c.top, loCol = sleeve === 'long' ? c.top : c.skin;
  capsule(ctx, sh, elbow, sleeve === 'none' ? 40 : 58, upCol);
  capsule(ctx, elbow, wrist, sleeve === 'long' ? 50 : 36, loCol);
  if (sleeve === 'short') capsule(ctx, sh, [lerp(sh[0], elbow[0], 0.75), lerp(sh[1], elbow[1], 0.75)], 62, c.top);
  if (sleeve === 'long') {
    ctx.save(); ctx.strokeStyle = side * (turn || 1) > 0 ? c.topSh : c.topHi; ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(sh[0] + side * 16, sh[1] + 12); ctx.lineTo(elbow[0] + side * 14, elbow[1]); ctx.lineTo(lerp(elbow[0], wrist[0], 0.8) + side * 12, lerp(elbow[1], wrist[1], 0.8)); ctx.stroke(); ctx.restore();
    capsule(ctx, [lerp(elbow[0], wrist[0], 0.86), lerp(elbow[1], wrist[1], 0.86)], wrist, 44, c.topSh, 4);
  }
  // hand, pointing along the forearm
  const ang = Math.atan2(wrist[1] - elbow[1], wrist[0] - elbow[0]), hx = wrist[0] + Math.cos(ang) * 22, hy = wrist[1] + Math.sin(ang) * 22;
  ctx.beginPath(); ctx.ellipse(hx, hy, 20, 25, ang - Math.PI / 2, 0, Math.PI * 2); ink(ctx, c.skin);
  ctx.beginPath(); ctx.ellipse(hx + Math.cos(ang + side * 1.4) * 16, hy + Math.sin(ang + side * 1.4) * 16, 7, 12, ang, 0, Math.PI * 2); ink(ctx, c.skin, 4);
  return { elbow, wrist, hand: [hx, hy] };
}

function drawTorso(ctx, S, c, turn, t, wind, back) {
  const top = S.top || {}, ty = top.type || 'tshirt', b = S.build || {}, sw = (b.shoulders || 1) * (1 - Math.abs(turn) * 0.2), hw = (b.hips || 1) * (1 - Math.abs(turn) * 0.2);
  const zx = turn * 26, fem = S.gender === 'f';
  // hood behind the neck
  if (ty === 'hoodie') { smooth(ctx, [[-92 * sw, -690], [-84, -742], [-50, -772], [50, -772], [84, -742], [92 * sw, -690]].map(([x, y]) => [kx(x, turn) - turn * 10, y]), false, 0.4); ctx.closePath(); ink(ctx, back ? c.top : c.topSh); }
  // neck
  P(ctx, [[-22 + zx * 0.3, -760], [22 + zx * 0.3, -760], [24 + zx * 0.3, -684], [-24 + zx * 0.3, -684]]); ink(ctx, c.skinSh, 4);
  const waist = fem ? 0.86 : 1, hem = ty === 'dress' ? -170 : -412;
  const body = () => smooth(ctx, (ty === 'dress'
    ? [[-96 * sw, -694], [-100 * sw, -640], [-84 * waist, -540], [-104 * hw, -430], [-150 * hw, hem], [0, hem + 8], [150 * hw, hem], [104 * hw, -430], [84 * waist, -540], [100 * sw, -640], [96 * sw, -694], [40, -702], [0, -690], [-40, -702]]
    : [[-100 * sw, -694], [-106 * sw, -640], [-100 * waist, -520], [-104 * hw, hem], [0, hem + 6], [104 * hw, hem], [100 * waist, -520], [106 * sw, -640], [100 * sw, -694], [40, -702], [0, -690], [-40, -702]]).map(([x, y]) => [kx(x, turn), y]), true, 0.35);
  body(); ink(ctx, c.top);
  shadeIn(ctx, body, () => {
    ctx.fillStyle = c.topSh; ctx.beginPath(); ctx.moveTo(52 + zx, -720); ctx.quadraticCurveTo(80 + zx, -560, 60 + zx, -400); ctx.lineTo(180, hem + 20); ctx.lineTo(180, -720); ctx.fill();
    if (ty !== 'dress') ctx.fillRect(-140, hem - 26, 280, 30);
    ctx.strokeStyle = c.rim; ctx.globalAlpha = 0.5; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-100 * sw, -690); ctx.quadraticCurveTo(-108 * sw, -560, -100 * hw, -430); ctx.stroke(); ctx.globalAlpha = 1;
    if (top.detail === 'stripe') { ctx.fillStyle = top.detailColor || '#E8DCCB'; ctx.fillRect(-140, -600, 280, 22); }
  });
  if (back) {
    if (ty === 'hoodie') { smooth(ctx, [[-80, -700], [-70, -600], [0, -560], [70, -600], [80, -700], [0, -720]], true, 0.4); ink(ctx, c.topSh); }
    return;
  }
  ctx.strokeStyle = OL; ctx.lineWidth = 3.5;
  const openFront = (ty === 'hoodie' && top.open !== false) || ty === 'jacket';
  if (openFront) {
    const tee = () => P(ctx, [[-30 + zx, -696], [30 + zx, -696], [22 + zx, hem - 4], [-22 + zx, hem - 4]]);
    tee(); ink(ctx, c.inner, 4);
    shadeIn(ctx, tee, () => { ctx.fillStyle = c.innerSh; ctx.fillRect(zx, -700, 40, 300); ctx.fillStyle = 'rgba(70,20,40,.35)'; ctx.fillRect(-40 + zx, -700, 80, 26); });
    if (ty === 'jacket') for (const s of [-1, 1]) { P(ctx, [[s * 30 + zx, -700], [s * 64 + zx, -680], [s * 40 + zx, -600], [s * 26 + zx, -620]]); ink(ctx, c.topSh, 4); }
  } else if (ty === 'hoodie') {
    ctx.beginPath(); ctx.moveTo(zx, -690); ctx.lineTo(zx, hem); ctx.stroke();
  } else if (ty === 'shirt') {
    for (const s of [-1, 1]) { P(ctx, [[zx, -700], [s * 40 + zx, -712], [s * 34 + zx, -672]]); ink(ctx, shade(c.top, 0.25), 3.5); }
    for (let k = 0; k < 5; k++) { circle(ctx, zx, -660 + k * 50, 4); ctx.fillStyle = OL; ctx.fill(); }
  } else { // tshirt, sweater, tank, dress: round neckline
    ctx.beginPath(); ctx.moveTo(-28 + zx, -698); ctx.quadraticCurveTo(zx, -664, 28 + zx, -698); ctx.fillStyle = c.skinSh; ctx.fill(); ctx.stroke();
    if (ty === 'sweater') { ctx.beginPath(); ctx.moveTo(-104, hem - 20); ctx.lineTo(104, hem - 20); ctx.stroke(); }
  }
  if (ty === 'hoodie') {
    ctx.beginPath(); ctx.moveTo(-78, hem - 28); ctx.lineTo(-66, -530); ctx.lineTo(-26 + zx, -530); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(kx(78, turn), hem - 28); ctx.lineTo(kx(66, turn), -530); ctx.lineTo(26 + zx, -530); ctx.stroke();
    for (const s of [-1, 1]) {
      const swy = Math.sin(t * 3 + s) * 6 * wind;
      ctx.beginPath(); ctx.moveTo(s * 24 + zx, -700); ctx.quadraticCurveTo(s * 30 + zx + swy * 0.5, -650, s * 28 + zx + swy, -600);
      ctx.strokeStyle = OL; ctx.lineWidth = 9; ctx.stroke(); ctx.strokeStyle = c.inner; ctx.lineWidth = 5; ctx.stroke();
    }
  }
  if (ty !== 'dress') { ctx.strokeStyle = OL; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(-104 * hw, hem - 28); ctx.lineTo(kx(104 * hw, turn), hem - 28); ctx.stroke(); }
  for (const a of S.accessories || []) {
    if (a.type === 'necklace') { ctx.beginPath(); ctx.moveTo(-26 + zx, -700); ctx.quadraticCurveTo(zx, -640, 26 + zx, -700); ctx.strokeStyle = a.color || '#E8C46A'; ctx.lineWidth = 4; ctx.stroke(); }
    if (a.type === 'scarf') { smooth(ctx, [[-60, -700], [60, -700], [64, -670], [0, -650], [-64, -670]], true, 0.4); ink(ctx, a.color || '#B3A996'); P(ctx, [[20, -670], [50, -670], [46, -560], [24, -560]]); ink(ctx, a.color || '#B3A996'); }
    if (a.type === 'backpack') for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 62, -696); ctx.quadraticCurveTo(s * 70, -620, s * 66, -540); ctx.strokeStyle = OL; ctx.lineWidth = 16; ctx.stroke(); ctx.strokeStyle = a.color || '#3B4A6B'; ctx.lineWidth = 10; ctx.stroke(); }
  }
}

function drawPelvis(ctx, S, c, turn) {
  const bt = (S.bottom || {}).type || 'pants', hw = ((S.build || {}).hips || 1) * (1 - Math.abs(turn) * 0.2);
  if ((S.top || {}).type === 'dress') return;
  if (bt === 'skirt') { smooth(ctx, [[-102 * hw, -440], [102 * hw, -440], [140 * hw, -250], [0, -240], [-140 * hw, -250]].map(([x, y]) => [kx(x, turn), y]), true, 0.2); ink(ctx, c.bottom); return; }
  P(ctx, [[-98 * hw, -445], [98 * hw, -445], [92 * hw, -372], [0, -350], [-92 * hw, -372]].map(([x, y]) => [kx(x, turn), y])); ink(ctx, c.bottom);
}

// ---------- three-quarter (0.3 ≤ |turn| < 0.75): own head drawing, facing right (mirrored for left) ----------
function drawHead3q(ctx, S, o) {
  const c = o._c || palette(S), e = typeof o.expr === 'string' ? EXPR[o.expr] : o.expr || EXPR.neutral, t = o.t || 0, wind = o.wind ?? 1;
  const k = clamp((Math.abs(o.turn) - 0.3) / 0.45), fem = S.gender === 'f', face = S.face || {}, st = (S.hair || {}).style || 'short';
  const cx = 14 + 14 * k;                 // the face's centre line moves toward where they look
  const sq = (face.jaw || (fem ? 'narrow' : 'soft')) === 'square' ? 6 : 0;
  // hair behind: shifted back so more of the back of the head shows
  if (!(o._longDone && ['long', 'wavy'].includes(st))) { ctx.save(); ctx.translate(-12 - 8 * k, 0); ctx.scale(0.96, 1); hairBack(ctx, S, c, t, wind, false); ctx.restore(); }
  // near ear only
  ctx.beginPath(); ctx.ellipse(-58 + 4 * k, -812, 12, 18, 0, 0, Math.PI * 2); ink(ctx, c.skin, 4);
  ctx.beginPath(); ctx.arc(-58 + 4 * k, -812, 7, 1.4, 4.6); ctx.strokeStyle = c.skinSh; ctx.lineWidth = 3; ctx.stroke();
  if ((S.accessories || []).some((a) => a.type === 'earrings')) { circle(ctx, -58 + 4 * k, -792, 5); ink(ctx, '#E8C46A', 2); }
  // face: full cheek on the near side; brow ridge, eye socket, cheekbone and chin on the far side
  const fp = [[-60, -884], [-64, -834], [-58, -792], [-44, -762 + sq * 0.5], [-16, -738 + sq], [cx + 4, -727], [cx + 22, -731 + sq * 0.5],
    [cx + 34 + 2 * k, -756 + sq], [cx + 40 + 4 * k, -788], [cx + 36 + 4 * k, -806], [cx + 42 + 6 * k, -834], [cx + 38 + 4 * k, -884], [0, -918]];
  const head = () => smooth(ctx, fp, true, 0.42);
  head(); ink(ctx, c.skin);
  shadeIn(ctx, head, () => {
    // the far side of the face turns away from the light
    ctx.fillStyle = c.skinSh; ctx.beginPath(); ctx.moveTo(cx + 18, -900); ctx.quadraticCurveTo(cx + 12, -800, cx + 30, -720); ctx.lineTo(150, -720); ctx.lineTo(150, -900); ctx.fill();
    ctx.fillStyle = 'rgba(80,30,60,0.2)'; ctx.fillRect(-95, -912, 220, 52);
    if (face.beard === 'full') { ctx.fillStyle = c.hair; ctx.beginPath(); ctx.moveTo(-58, -800); ctx.quadraticCurveTo(-40, -716, cx + 6, -714); ctx.quadraticCurveTo(cx + 34, -720, cx + 42, -790); ctx.lineTo(cx + 28, -780); ctx.quadraticCurveTo(cx, -738, -40, -792); ctx.fill(); }
    if (face.beard === 'stubble') { ctx.fillStyle = 'rgba(40,25,25,0.22)'; ctx.beginPath(); ctx.moveTo(-58, -800); ctx.quadraticCurveTo(-40, -718, cx + 6, -716); ctx.quadraticCurveTo(cx + 34, -722, cx + 42, -790); ctx.quadraticCurveTo(cx, -760, -58, -800); ctx.fill(); }
    if (face.freckles) { ctx.fillStyle = shade(c.skin, -0.35); for (let i = 0; i < 8; i++) { circle(ctx, -28 + (i % 4) * 5, -786 + (i % 3) * 5, 1.8); ctx.fill(); } }
    if (e.blush) { ctx.fillStyle = `rgba(230,90,110,${0.35 * e.blush})`; ctx.beginPath(); ctx.ellipse(-26, -782, 16, 7, 0, 0, Math.PI * 2); ctx.ellipse(cx + 26, -782, 9, 6, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.save(); ctx.beginPath(); ctx.rect(-100, -900, 46, 200); ctx.clip(); head(); ctx.strokeStyle = c.rim; ctx.globalAlpha = 0.45; ctx.lineWidth = 14; ctx.stroke(); ctx.restore();
  });
  // eyes: the near one full, the far one narrower and closer to the face edge
  const eo = clamp(e.open * (1 - (o.blink || 0)), 0.04, 1.4), look = o.look || e.look;
  for (const [ex, w, far] of [[cx - 34, fem ? 20 : 19, false], [cx + 22 + 2 * k, (fem ? 13 : 12) - 3 * k, true]]) {
    const ey = -808, asym = (e.asym || 0) * (far ? 1 : 0), h = (fem ? 14.5 : 13) * eo * (1 - asym * 0.35);
    const almond = () => { ctx.beginPath(); ctx.moveTo(ex - w, ey); ctx.quadraticCurveTo(ex, ey - h * 1.6, ex + w, ey); ctx.quadraticCurveTo(ex, ey + h * 1.1, ex - w, ey); ctx.closePath(); };
    almond(); ctx.fillStyle = '#FBF6F0'; ctx.fill();
    shadeIn(ctx, almond, () => {
      const ix = ex + look[0] * 6 + w * 0.3, iy = ey + look[1] * 4 - 1, ir = (e.open > 1.1 ? 8 : 10.5) * (far ? 0.85 : 1);
      ctx.fillStyle = c.iris; ctx.beginPath(); ctx.ellipse(ix, iy, ir * (far ? 0.75 : 0.92), ir, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = OL; ctx.beginPath(); ctx.ellipse(ix, iy, ir * 0.42, ir * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; circle(ctx, ix - 3, iy - 4, far ? 2.2 : 3); ctx.fill();
      ctx.fillStyle = 'rgba(60,20,40,0.25)'; ctx.fillRect(ex - w, ey - h * 1.6, w * 2, h * 0.7);
    });
    ctx.strokeStyle = OL; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ex - w - 2, ey + 1); ctx.quadraticCurveTo(ex, ey - h * 1.75, ex + w + 2, ey - 1); ctx.lineWidth = fem ? 7 : 6; ctx.stroke();
    if (!far) { ctx.beginPath(); ctx.moveTo(ex - w, ey - 2); ctx.lineTo(ex - w - (fem ? 10 : 7), ey - (fem ? 9 : 6)); ctx.lineWidth = 4; ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(ex - w * 0.6, ey + h * 0.85); ctx.quadraticCurveTo(ex, ey + h * 1.05, ex + w * 0.6, ey + h * 0.85); ctx.lineWidth = 2.5; ctx.stroke();
    if (e.tears) { ctx.fillStyle = 'rgba(170,215,255,0.85)'; ctx.beginPath(); ctx.ellipse(ex - 4, ey + 14 + ((t * 40 + (far ? 7 : 0)) % 40), 4, 7, 0, 0, Math.PI * 2); ctx.fill(); }
    const by = ey - 30 + e.browY + (eo > 1.1 ? -6 : 0) - asym * 8, bi = e.brow * 18 * (1 - asym * 1.6), s2 = far ? 1 : -1;
    ctx.beginPath(); ctx.moveTo(ex - s2 * w * 0.9, by + bi + 2); ctx.quadraticCurveTo(ex, by - 8 - bi * 0.2, ex + s2 * (w + 4), by - bi * 0.5 - 2);
    ctx.lineWidth = ((S.brows || {}).thick || (fem ? 6 : 8)) * (far ? 0.85 : 1); ctx.strokeStyle = c.brow; ctx.stroke();
  }
  if (face.glasses) {
    const g = typeof face.glasses === 'object' ? face.glasses : {}; ctx.strokeStyle = g.color || '#221A1E'; ctx.lineWidth = 5;
    ctx.beginPath(); if (g.shape === 'square') ctx.rect(cx - 60, -828, 52, 38); else ctx.ellipse(cx - 34, -808, 27, 22, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); if (g.shape === 'square') ctx.rect(cx + 8, -826, 30, 36); else ctx.ellipse(cx + 24, -808, 16, 21, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 7, -812); ctx.lineTo(cx + 8, -812); ctx.moveTo(cx - 60, -812); ctx.lineTo(-56, -816); ctx.stroke();
  }
  // nose: a small wedge pointing where they look, its shadow on the far side
  ctx.beginPath(); ctx.moveTo(cx + 4, -806); ctx.quadraticCurveTo(cx + 12, -794, cx + 16, -783); ctx.quadraticCurveTo(cx + 8, -775, cx - 1, -780);
  ctx.fillStyle = c.skinSh; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 3.5; ctx.stroke();
  // mouth: the far half shorter
  ctx.save(); ctx.translate(cx + 2, 0); ctx.scale(0.86, 1); drawMouth(ctx, e, clamp((e.mo || 0) + (o.talk || 0)), 0, -752, fem, t); ctx.restore();
  if (face.mustache) { ctx.fillStyle = c.hair; ctx.beginPath(); ctx.ellipse(cx - 10, -764, 15, 6, 0.2, 0, Math.PI * 2); ctx.ellipse(cx + 12, -764, 10, 5, -0.2, 0, Math.PI * 2); ctx.fill(); }
  // front hair, shifted toward the face side
  ctx.save(); ctx.translate(cx * 0.55, 0); ctx.scale(0.94, 1); hairFront(ctx, S, c, t, wind, 0); ctx.restore();
  accessoriesHead(ctx, S, c, cx * 0.6, false);
}

// ---------- profile (|turn| ≥ 0.75): drawn facing right; drawCharacter mirrors it for facing left ----------
function profileHairShapes(S, c, t, wind) {
  const st = (S.hair || {}).style || 'short', sway = Math.sin(t * 2.4) * 3 * wind;
  const cap = { // silhouette over the top and back of the head, front edge at the hairline
    buzz: [[46, -884], [30, -912], [-20, -924], [-62, -900], [-74, -850], [-66, -800], [-50, -812], [-40, -870], [20, -896]],
    short: [[56, -872], [44, -918], [-10, -942], [-64, -918], [-82, -860], [-76, -792], [-56, -800], [-44, -862], [24, -888]],
    swept: [[68, -880], [52, -932], [-6, -956], [-66, -924], [-84, -862], [-78, -792], [-56, -800], [-42, -864], [30, -890]],
  };
  if (st === 'bald') return null;
  if (cap[st]) return { pts: cap[st], k: 0.45 };
  if (st === 'messy' || st === 'spiky') {
    const pts = [[58, -862]], N = 9;
    for (let i = 0; i <= N; i++) { // spikes sweeping back over the top
      const a = -0.25 - (Math.PI * 1.05) * (i / N), r = i % 2 ? 98 : (st === 'spiky' ? 132 : 122) + 10 * hash(i);
      pts.push([-8 + Math.cos(a) * r * 1.05 - (i % 2 ? 0 : 10 + sway), -846 + Math.sin(a) * r]);
    }
    pts.push([-96, -790], [-70, -770], [-56, -806], [-40, -862], [10, -880], [36, -846], [46, -872]);
    return { pts, k: 0.3 };
  }
  if (st === 'long' || st === 'wavy' || st === 'bob' || st === 'ponytail' || st === 'bun') {
    const low = st === 'bob' ? -735 : st === 'ponytail' || st === 'bun' ? -800 : -610;
    return { pts: [[60, -868], [48, -922], [-8, -952], [-70, -926], [-92, -860], [-96 + sway, low + 50], [-80 + sway, low], [-40, low + 20], [-36, -800], [-30, -862], [24, -890]], k: 0.45 };
  }
  // curly / afro: a cloud of curls
  const R = st === 'afro' ? 130 : 104, pts = [];
  for (let i = 0; i <= 14; i++) { const a = Math.PI * (0.7 + 1.35 * i / 14); pts.push([-14 + Math.cos(a) * R * (i % 2 ? 0.88 : 1.02), -852 + Math.sin(a) * R * (i % 2 ? 0.86 : 1.0)]); }
  pts.push([-40, -800], [-30, -860], [40, -880]);
  return { pts, k: 0.55 };
}

function drawHeadProfile(ctx, S, o) {
  const c = o._c || palette(S), e = typeof o.expr === 'string' ? EXPR[o.expr] : o.expr || EXPR.neutral, t = o.t || 0, wind = o.wind ?? 1;
  const fem = S.gender === 'f', face = S.face || {}, st = (S.hair || {}).style || 'short';
  const hair = profileHairShapes(S, c, t, wind);
  // hair that falls behind the head/neck is drawn first
  if (st === 'ponytail') { smooth(ctx, [[-70, -880], [-118, -870 + Math.sin(t * 2) * 4], [-140, -790], [-128, -700], [-104, -760], [-84, -840]], true, 0.5); ink(ctx, c.hair); }
  if (st === 'bun') { circle(ctx, -70, -930, 36); ink(ctx, c.hair); }
  // head + face silhouette: forehead, brow, nose, lips, chin, jaw, back of the skull
  const sq = (face.jaw || (fem ? 'narrow' : 'soft')) === 'square' ? 6 : 0;
  const head = () => smooth(ctx, [[52, -900], [60, -860], [62, -830], [60, -818], [78, -790], [62, -780], [66, -766], [60, -758], [64, -748], [58, -730 + sq], [38, -722 + sq],
    [6, -740 + sq], [-30, -770], [-58, -800], [-70, -850], [-58, -912], [0, -940]], true, 0.35);
  head(); ink(ctx, c.skin);
  shadeIn(ctx, head, () => {
    ctx.fillStyle = c.skinSh; ctx.beginPath(); ctx.moveTo(-80, -900); ctx.quadraticCurveTo(-20, -820, -40, -700); ctx.lineTo(-90, -700); ctx.fill();
    ctx.fillStyle = 'rgba(80,30,60,0.18)'; ctx.beginPath(); ctx.moveTo(10, -746); ctx.quadraticCurveTo(30, -735, 55, -738); ctx.lineTo(55, -715); ctx.lineTo(0, -715); ctx.fill();
    if (face.beard === 'full') { ctx.fillStyle = c.hair; ctx.beginPath(); ctx.moveTo(-34, -790); ctx.quadraticCurveTo(-10, -720, 46, -722); ctx.lineTo(62, -748); ctx.quadraticCurveTo(20, -760, -10, -800); ctx.fill(); }
    if (face.beard === 'stubble') { ctx.fillStyle = 'rgba(40,25,25,0.22)'; ctx.beginPath(); ctx.moveTo(-34, -790); ctx.quadraticCurveTo(-10, -722, 50, -724); ctx.lineTo(62, -750); ctx.quadraticCurveTo(20, -770, -10, -800); ctx.fill(); }
    if (e.blush) { ctx.fillStyle = `rgba(230,90,110,${0.35 * e.blush})`; ctx.beginPath(); ctx.ellipse(28, -782, 16, 8, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = c.rim; ctx.globalAlpha = 0.45; ctx.lineWidth = 12; head(); ctx.stroke(); ctx.globalAlpha = 1;
  });
  // ear
  ctx.beginPath(); ctx.ellipse(-16, -812, 12, 19, 0.15, 0, Math.PI * 2); ink(ctx, c.skin, 4);
  ctx.beginPath(); ctx.arc(-16, -812, 7, -1.2, 1.6); ctx.strokeStyle = c.skinSh; ctx.lineWidth = 3; ctx.stroke();
  if ((S.accessories || []).some((a) => a.type === 'earrings')) { circle(ctx, -14, -790, 5); ink(ctx, '#E8C46A', 2); }
  // eye (side view: a wedge, iris to the front)
  const eo = clamp(e.open * (1 - (o.blink || 0)), 0.04, 1.4), ex = 36, ey = -808, w = 14, h = 12 * eo;
  const eye = () => { ctx.beginPath(); ctx.moveTo(ex - w * 0.7, ey - h * 0.3); ctx.quadraticCurveTo(ex + 2, ey - h * 1.4, ex + w, ey); ctx.quadraticCurveTo(ex + 2, ey + h * 0.9, ex - w * 0.7, ey + h * 0.3); ctx.closePath(); };
  eye(); ctx.fillStyle = '#FBF6F0'; ctx.fill();
  shadeIn(ctx, eye, () => { const ix = ex + 6 + (o.look || e.look)[0] * 3, iy = ey + (o.look || e.look)[1] * 3; ctx.fillStyle = c.iris; ctx.beginPath(); ctx.ellipse(ix, iy, 6, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = OL; ctx.beginPath(); ctx.ellipse(ix + 1, iy, 3, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; circle(ctx, ix - 1, iy - 4, 2.5); ctx.fill(); });
  ctx.strokeStyle = OL; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(ex - w * 0.8, ey - h * 0.35); ctx.quadraticCurveTo(ex + 2, ey - h * 1.5, ex + w + 2, ey - 1); ctx.lineWidth = fem ? 7 : 6; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ex - w * 0.8, ey - h * 0.35); ctx.lineTo(ex - w * 0.8 - (fem ? 10 : 6), ey - h * 0.35 - (fem ? 7 : 4)); ctx.lineWidth = 4; ctx.stroke();
  if (e.tears) { ctx.fillStyle = 'rgba(170,215,255,0.85)'; ctx.beginPath(); ctx.ellipse(ex + 4, ey + 16 + ((t * 40) % 40), 4, 7, 0, 0, Math.PI * 2); ctx.fill(); }
  // brow
  const by = ey - 28 + e.browY + (eo > 1.1 ? -6 : 0), bi = e.brow * 14;
  ctx.beginPath(); ctx.moveTo(ex - 14, by - bi * 0.4); ctx.quadraticCurveTo(ex + 2, by - 7 - bi * 0.1, ex + 18, by + bi); ctx.lineWidth = (S.brows || {}).thick || (fem ? 6 : 8); ctx.strokeStyle = c.brow; ctx.stroke();
  // mouth (side view)
  const mo = clamp((e.mo || 0) + (o.talk || 0)), angry = Math.max(0, e.brow), down = e.mouth === 'down' || e.mouth === 'wobble' || e.mouth === 'frown' ? 1 : 0, up = e.mouth === 'smile' || e.mouth === 'grin' || e.mouth === 'smirk' ? 1 : 0;
  ctx.strokeStyle = OL; ctx.lineWidth = 4;
  if (mo > 0.08 || e.mouth === 'o' || e.mouth === 'open') {
    const hgt = 4 + mo * 16; ctx.beginPath(); ctx.moveTo(64, -763); ctx.lineTo(44, -760 + (down - up) * 4 + angry * 4); ctx.lineTo(60, -758 + hgt); ctx.closePath();
    ctx.fillStyle = '#5A1220'; ctx.fill(); ctx.stroke();
  } else { ctx.beginPath(); ctx.moveTo(62, -760); ctx.quadraticCurveTo(54, -759, 46, -760 + (down - up) * 5); ctx.stroke(); }
  if (fem) { ctx.strokeStyle = 'rgba(190,70,90,0.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(62, -754); ctx.lineTo(54, -752); ctx.stroke(); }
  if (face.mustache) { ctx.fillStyle = c.hair; ctx.beginPath(); ctx.ellipse(60, -770, 14, 6, 0.2, 0, Math.PI * 2); ctx.fill(); }
  // glasses: one lens + the arm to the ear
  if (face.glasses) { const g = typeof face.glasses === 'object' ? face.glasses : {}; ctx.strokeStyle = g.color || '#221A1E'; ctx.lineWidth = 5; ctx.beginPath(); if (g.shape === 'square') ctx.rect(ex - 10, ey - 18, 28, 34); else ctx.ellipse(ex + 4, ey, 15, 18, 0, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(ex - 12, ey - 6); ctx.lineTo(-10, -818); ctx.stroke(); }
  // hair on top
  if (hair) {
    smooth(ctx, hair.pts, true, hair.k); ink(ctx, c.hair);
    ctx.strokeStyle = c.hairHi; ctx.lineWidth = 4;
    for (const [x, y] of [[20, -912], [-20, -920], [-56, -890]]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 14, y + 16, x - 30, y + 22); ctx.stroke(); }
    if (st === 'messy' || st === 'spiky' || (S.hair || {}).bangs === 'messy') { // fringe tips over the forehead
      const sw = Math.sin(t * 2.6) * 2 * wind;
      smooth(ctx, [[60, -862], [70 + sw, -836], [50, -850], [56 + sw, -822], [38, -846], [30, -872]], true, 0.15); ink(ctx, c.hair, 4);
    } else if ((S.hair || {}).bangs === 'full') { smooth(ctx, [[62, -872], [66, -842], [44, -846], [30, -880]], true, 0.3); ink(ctx, c.hair, 4); }
  }
  for (const a of S.accessories || []) {
    const col = a.color || '#333';
    if (a.type === 'cap') { smooth(ctx, [[60, -870], [50, -930], [-10, -962], [-70, -930], [-86, -870]], true, 0.45); ink(ctx, col); smooth(ctx, [[46, -876], [130, -868], [132, -852], [46, -858]], true, 0.3); ink(ctx, shade(col, -0.25)); }
    if (a.type === 'beanie') { smooth(ctx, [[62, -858], [50, -930], [-10, -968], [-74, -930], [-90, -858]], true, 0.45); ink(ctx, col); P(ctx, [[66, -884], [-92, -884], [-92, -852], [66, -852]]); ink(ctx, shade(col, -0.2)); }
    if (a.type === 'headband') { ctx.beginPath(); ctx.moveTo(58, -880); ctx.quadraticCurveTo(-10, -930, -78, -870); ctx.strokeStyle = OL; ctx.lineWidth = 16; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 10; ctx.stroke(); }
  }
}

function drawTorsoProfile(ctx, S, c, t, wind) {
  const top = S.top || {}, ty = top.type || 'tshirt', fem = S.gender === 'f', b = S.build || {}, d = (b.shoulders || 1);
  const hem = ty === 'dress' ? -170 : -412;
  if (ty === 'hoodie') { smooth(ctx, [[-44, -700], [-78, -712], [-82, -760], [-50, -786], [-10, -772], [0, -720]], true, 0.4); ink(ctx, c.topSh); }
  P(ctx, [[-12, -768], [22, -768], [26, -684], [-16, -684]]); ink(ctx, c.skinSh, 4);
  const body = () => smooth(ctx, ty === 'dress'
    ? [[-44 * d, -700], [28, -704], [50, -664], [fem ? 60 : 54, -610], [44, -540], [56, -430], [96, hem], [-80, hem], [-50, -430], [-48, -540], [-56 * d, -640]]
    : [[-44 * d, -700], [28, -704], [50, -664], [fem ? 60 : 56, -610], [50, -540], [54, hem], [-50, hem], [-50, -540], [-56 * d, -640]], true, 0.4);
  body(); ink(ctx, c.top);
  shadeIn(ctx, body, () => {
    ctx.fillStyle = c.topSh; ctx.beginPath(); ctx.moveTo(-70, -720); ctx.quadraticCurveTo(-20, -560, -40, -380); ctx.lineTo(-120, hem + 20); ctx.lineTo(-120, -720); ctx.fill();
    if (ty !== 'dress') ctx.fillRect(-140, hem - 26, 280, 30);
    ctx.strokeStyle = c.rim; ctx.globalAlpha = 0.45; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(48, -664); ctx.quadraticCurveTo(58, -560, 50, -430); ctx.stroke(); ctx.globalAlpha = 1;
    if (top.detail === 'stripe') { ctx.fillStyle = top.detailColor || '#E8DCCB'; ctx.fillRect(-140, -600, 280, 22); }
    const openFront = (ty === 'hoodie' && top.open !== false) || ty === 'jacket';
    if (openFront) { ctx.fillStyle = c.inner; ctx.beginPath(); ctx.moveTo(30, -704); ctx.lineTo(70, -704); ctx.lineTo(70, hem); ctx.lineTo(44, hem); ctx.quadraticCurveTo(48, -560, 36, -640); ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(36, -700); ctx.quadraticCurveTo(48, -560, 44, hem); ctx.stroke(); }
  });
  ctx.strokeStyle = OL; ctx.lineWidth = 3.5;
  if (ty !== 'dress') { ctx.beginPath(); ctx.moveTo(-50, hem - 28); ctx.lineTo(54, hem - 28); ctx.stroke(); }
  if (ty === 'shirt') { P(ctx, [[4, -708], [40, -712], [30, -680]]); ink(ctx, shade(c.top, 0.25), 3.5); }
  if (ty === 'hoodie') { const swy = Math.sin(t * 3) * 6 * wind; ctx.beginPath(); ctx.moveTo(30, -700); ctx.quadraticCurveTo(42 + swy * 0.5, -650, 40 + swy, -600); ctx.strokeStyle = OL; ctx.lineWidth = 9; ctx.stroke(); ctx.strokeStyle = c.inner; ctx.lineWidth = 5; ctx.stroke(); }
  for (const a of S.accessories || []) {
    if (a.type === 'backpack') { smooth(ctx, [[-50, -690], [-120, -680], [-130, -520], [-110, -470], [-50, -480]], true, 0.4); ink(ctx, a.color || '#3B4A6B'); ctx.beginPath(); ctx.moveTo(-20, -700); ctx.quadraticCurveTo(10, -620, -20, -540); ctx.strokeStyle = OL; ctx.lineWidth = 14; ctx.stroke(); ctx.strokeStyle = a.color || '#3B4A6B'; ctx.lineWidth = 8; ctx.stroke(); }
    if (a.type === 'scarf') { smooth(ctx, [[-30, -712], [36, -712], [40, -676], [-30, -676]], true, 0.4); ink(ctx, a.color || '#B3A996'); }
  }
}

function drawPelvisProfile(ctx, S, c) {
  const bt = (S.bottom || {}).type || 'pants';
  if ((S.top || {}).type === 'dress') return;
  if (bt === 'skirt') { smooth(ctx, [[-52, -440], [56, -440], [86, -250], [-74, -250]], true, 0.2); ink(ctx, c.bottom); return; }
  P(ctx, [[-50, -445], [54, -445], [50, -372], [-46, -366]]); ink(ctx, c.bottom);
}

export function drawCharacter(ctx, S, x, y, s, o = {}) {
  if (!S) return;
  const c = palette(S), b = S.build || {}, t = o.t || 0, turn = clamp(o.turn || 0, -1, 1), back = !!o.back, wind = o.wind ?? 1;
  const pose = getPose(o.pose), height = b.height || 1, headK = b.headSize || 1;
  ctx.save(); ctx.translate(x, y); if (o.alpha != null) ctx.globalAlpha = o.alpha;
  if (o.shadow !== false) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(0, 0, 120 * s, 18 * s, 0, 0, Math.PI * 2); ctx.fill(); }
  const PROF = !back && Math.abs(turn) >= 0.75, TQ = !back && !PROF && Math.abs(turn) >= 0.3;
  // turned views are drawn facing right; facing left = the same drawing mirrored
  const mir = (PROF || TQ) && turn < 0;
  ctx.scale(s * ((o.flip ? -1 : 1) * (mir ? -1 : 1)), s * height);
  const turnD = mir ? -turn : turn;
  // keep the lower foot on the ground for sits/kneels/crouches
  const legY = (lp) => -430 + 205 * Math.cos(lp[1]) * Math.cos(lp[0]) + 195 * Math.cos(lp[1] - lp[2]);
  const drop = -40 - Math.max(legY(pose.legL), legY(pose.legR));
  const br = Math.sin(t * 2.1) * 3, bob = -(pose.bob || 0);
  ctx.translate(0, drop + bob);
  if (o.lean) { ctx.translate(0, -430); ctx.rotate(o.lean); ctx.translate(0, 430); }
  // long hair hangs behind the body
  const longHair = ['long', 'wavy'].includes((S.hair || {}).style);
  const L = [pose.L[0] + Math.sin(t * 2.1) * 0.02, pose.L[1]], R = [pose.R[0] + Math.sin(t * 2.1 + 1) * 0.02, pose.R[1]];
  const turnD0 = (PROF || TQ) && turn < 0 ? -turn : turn;
  const farFirst = Math.abs(turnD0) > 0.3;               // the far arm goes behind the torso when turned
  const farSide = turnD0 > 0 ? 1 : -1;
  const arm = (side) => drawArm(ctx, S, c, side, side < 0 ? L : R, side < 0 ? pose.swingL : pose.swingR, turnD0, t);
  const headBlock = () => {
    ctx.save(); ctx.translate(0, br);
    ctx.translate(0, -760); if (o.headTilt) ctx.rotate(o.headTilt); ctx.scale(headK, headK); ctx.translate(0, 760);
    if (TQ) drawHead3q(ctx, S, { ...o, _c: c, turn: turnD, _longDone: longHair });
    else drawHead(ctx, S, { ...o, _c: c, turn: turnD, back, _longDone: longHair && !back });
    ctx.restore();
  };
  if (PROF) {
    const tp = Math.abs(turn), dim = { ...c, top: c.topSh, bottom: c.bottomSh, shoe: shade(c.shoe, -0.3), skin: c.skinSh, inner: c.innerSh };
    const head = () => { ctx.save(); ctx.translate(0, br - 760); if (o.headTilt) ctx.rotate(o.headTilt); ctx.scale(headK, headK); ctx.translate(0, 760); drawHeadProfile(ctx, S, { ...o, _c: c }); ctx.restore(); };
    // far side first (darker), then the body, then the near side
    drawLeg(ctx, S, dim, -1, pose.legL, tp, t);
    drawArm(ctx, S, dim, -1, L, pose.swingL, tp, t);
    drawLeg(ctx, S, c, 1, pose.legR, tp, t);
    drawPelvisProfile(ctx, S, c);
    ctx.save(); ctx.translate(0, br * 0.4); drawTorsoProfile(ctx, S, c, t, wind); ctx.restore();
    if (pose.over) { head(); drawArm(ctx, S, c, 1, R, pose.swingR, tp, t); }
    else { drawArm(ctx, S, c, 1, R, pose.swingR, tp, t); head(); }
    ctx.restore(); return;
  }
  if (longHair && !back) { ctx.save(); ctx.translate(0, br - 760); if (o.headTilt) ctx.rotate(o.headTilt); ctx.scale(headK, headK); ctx.translate(0, 760); hairBack(ctx, S, c, t, wind, false); ctx.restore(); }
  if (back) { for (const side of [-1, 1]) drawLeg(ctx, S, c, side, side < 0 ? pose.legL : pose.legR, turnD, t); drawPelvis(ctx, S, c, turnD); }
  else {
    // the leg nearer the camera last
    const order = turnD > 0.2 ? [1, -1] : turnD < -0.2 ? [-1, 1] : [-1, 1];
    for (const side of order) drawLeg(ctx, S, c, side, side < 0 ? pose.legL : pose.legR, turnD, t);
    drawPelvis(ctx, S, c, turnD);
  }
  if (farFirst && !back) arm(farSide);
  ctx.save(); ctx.translate(0, br * 0.4); drawTorso(ctx, S, c, turnD, t, wind, back); ctx.restore();
  if (back) { arm(-1); arm(1); headBlock(); }
  else if (pose.over) { headBlock(); if (!farFirst) arm(farSide); arm(-farSide); }
  else { if (!farFirst) arm(farSide); arm(-farSide); headBlock(); }
  ctx.restore();
}

/** a character standing in for a narrator mime: talk from the mouth track only while their line plays */
export function talkFor(id, t, T) {
  const ln = T.lines.find((l) => l.mime === id && t >= l.start && t <= l.end);
  return ln ? T.mouthAt(t) : 0;
}
export { palette };
