// Cutout / puppet rig driven by a character spec (data/characters.json, see reference/CHARACTERS.md).
// Character units: feet at (0,0), y up is negative, an adult is ≈ 930 units tall (head top ≈ -930).
// drawCharacter(ctx, spec, x, y, scale, opts) — opts:
//   t (s, for wind/breath), expr (EXPR name or object), talk 0..1 (mouth open, e.g. mouthAt(t)), blink 0..1,
//   pose (POSES name or object, or walkPose(phase)), turn -1..1 (+ faces screen-right), back (true = seen from behind),
//   look [x, y] (-1..1 eyes), headTilt (rad), lean (rad, whole body around the hips), wind 0..2, flip, alpha, shadow
import { OL, P, smooth, ink, shadeIn, capsule, circle, shade, mix, clamp, lerp, hash, ease } from './lib.js';
import { hairParams, isLong, hairBehind, hairFrontPiece, hairBackView, hairProfile, hairProfileBehind, map3q, hatFront, hatProfile } from './hair.js';
import { faceParams, faceGeom, faceCurveF, drawEye, drawBrow, drawNoseFront, faceDetails, drawEarsFront } from './face.js';

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
  for (const k of ['L', 'R', 'legL', 'legR']) { o[k] = m(a[k].slice(0, k[0] === 'l' ? 3 : 2), b[k].slice(0, k[0] === 'l' ? 3 : 2)); if (k.length === 1 && (u < 0.5 ? a[k][2] : b[k][2])) o[k].push(1); }
  for (const k of ['swingL', 'swingR', 'bob']) o[k] = lerp(a[k] || 0, b[k] || 0, u);
  o.over = u < 0.5 ? a.over : b.over; return o;
}
/** walk / run cycle: phase in cycles (e.g. t * 1.8 for a walk); show it with turn ≈ ±0.8 */
export function walkPose(phase, run = false) {
  const p = phase * Math.PI * 2, A = run ? 0.6 : 0.3, s = Math.sin(p);
  const knee = (x) => Math.max(0, -Math.sin(x)) * (run ? 1.6 : 0.8) + (run ? 0.25 : 0.05);
  return {
    L: [0.1, run ? 1.65 : 0.12, 1], R: [0.1, run ? 1.65 : 0.12, 1], swingL: -s * (run ? 0.7 : 0.35), swingR: s * (run ? 0.7 : 0.35),
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
  if (S._flatHair) c.hair = '#55505C';
  c.skinSh = shade(c.skin, -0.22); c.hairHi = S._flatHair ? c.hair : shade(c.hair, 0.22); c.topSh = shade(c.top, -0.32); c.topHi = shade(c.top, 0.16);
  c.innerSh = shade(c.inner, -0.18); c.bottomSh = shade(c.bottom, -0.3); c.bottomHi = shade(c.bottom, 0.14);
  c.brow = (S.brows || {}).color || shade(hair.color || '#2A1C18', -0.1);
  return c;
}

// ---------- head: front and back ----------
/** the head itself seen from behind (skull, the backs of the cheeks, the jaw corners, the nape into the neck), as points;
 *  the hair is drawn over it. m maps x (3/4 from behind squeezes the far side). */
function backSkullPts(g, m = (x) => x) {
  const pts = [];
  for (let i = 0; i <= 16; i++) { const a = Math.PI * (1 + i / 16); pts.push([Math.cos(a) * (g.W + 2), -858 + Math.sin(a) * 68]); }
  const side = [[g.W + 1, -840], [g.cheekW - 1, -806], [g.jawW, g.jawY], [g.jawW * 0.62, g.jawY + 12], [26, g.jawY + 20]];
  pts.push(...side, ...side.reverse().map(([x, y]) => [-x, y]));
  return pts.map(([x, y]) => [m(x), y]);
}
function drawBackSkull(ctx, g, c, m = (x) => x) {
  const pts = backSkullPts(g, m), path = () => smooth(ctx, pts, true, 0.4);
  path(); ink(ctx, c.skin);
  shadeIn(ctx, path, () => {                                   // the nape in shadow under the skull, a soft side shade
    ctx.fillStyle = c.skinSh; ctx.beginPath(); ctx.ellipse(m(0), g.jawY + 22, 70, 34, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.5; ctx.fillRect(m(g.W * 0.45), -960, 200, 260); ctx.globalAlpha = 1;
  });
}

export function drawHead(ctx, S, o = {}) {
  const c = o._c || palette(S), e = typeof o.expr === 'string' ? EXPR[o.expr] : o.expr || EXPR.neutral;
  const t = o.t || 0, turn = clamp(o.turn || 0, -0.8, 0.8), wind = o.wind ?? 1, fx = turn * 24;
  const F = faceParams(S), g = faceGeom(F), HP = hairParams(S), face = S.face || {}, fem = F.fem, flat = !!S._flatHair;
  if (o.back) {
    // ears, then the head itself (skin), then the hair over it
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * (g.W + 2 + F.ears.out * 7), -812, 11 * F.ears.size, 17 * F.ears.size, 0, 0, Math.PI * 2); ink(ctx, c.skin, 4); }
    drawBackSkull(ctx, g, c);
    if (face.beard === 'full') for (const s of [-1, 1]) { smooth(ctx, [[s * g.jawW, g.jawY - 34], [s * (g.jawW + 2), g.jawY], [s * g.jawW * 0.6, g.jawY + 12], [s * g.jawW * 0.7, g.jawY - 30]], true, 0.4); ctx.fillStyle = c.hair; ctx.fill(); }
    hairBackView(ctx, HP, c, { t, wind, flat });
    accessoriesHead(ctx, S, c, 0, true);
    return;
  }
  if (!(o._longDone && isLong(HP))) hairBehind(ctx, HP, c, { t, wind });
  drawEarsFront(ctx, F, c, g, fx, turn);
  if ((S.accessories || []).some((a) => a.type === 'earrings')) for (const s of [-1, 1]) if (turn * s <= 0.45) { circle(ctx, s * g.W + fx * 0.4, -792, 5); ink(ctx, '#E8C46A', 2); }
  const fc = () => faceCurveF(ctx, F, fx);
  fc(); ink(ctx, c.skin);
  shadeIn(ctx, fc, () => {
    ctx.fillStyle = c.skinSh; ctx.beginPath(); ctx.moveTo(30 + fx, -900); ctx.quadraticCurveTo(62 + fx, -800, 20 + fx, -720); ctx.lineTo(140, -680); ctx.lineTo(140, -900); ctx.fill();
    const hs = ctx.createLinearGradient(0, -930, 0, -846); hs.addColorStop(0, 'rgba(80,30,60,0.28)'); hs.addColorStop(1, 'rgba(80,30,60,0)'); ctx.fillStyle = hs; ctx.fillRect(-120, -935, 240, 90);
    const cy = g.chinY;
    if (face.beard === 'full') { ctx.fillStyle = c.hair; ctx.beginPath(); ctx.moveTo(-70, -800); ctx.quadraticCurveTo(-50, cy + 11, 0 + fx, cy + 14); ctx.quadraticCurveTo(50, cy + 11, 70, -800); ctx.lineTo(50, -790); ctx.quadraticCurveTo(0, -735, -50, -790); ctx.fill(); }
    if (face.beard === 'stubble') { ctx.fillStyle = 'rgba(40,25,25,0.22)'; ctx.beginPath(); ctx.moveTo(-66, -800); ctx.quadraticCurveTo(-45, cy + 8, fx, cy + 11); ctx.quadraticCurveTo(45, cy + 8, 66, -800); ctx.quadraticCurveTo(0, -760, -66, -800); ctx.fill(); }
    if (e.blush) { ctx.fillStyle = `rgba(230,90,110,${0.35 * e.blush})`; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 38 + fx, -782, 15, 7, 0, 0, Math.PI * 2); ctx.fill(); } }
    faceDetails(ctx, F, c, g, (x) => x, fx);
    // warm rim light on the sunset side
    ctx.save(); ctx.beginPath(); ctx.rect(-110, -900, 58, 220); ctx.clip(); fc(); ctx.strokeStyle = c.rim; ctx.globalAlpha = 0.45; ctx.lineWidth = 14; ctx.stroke(); ctx.restore();
  });
  // eyes + brows
  const eo = clamp(e.open * (1 - (o.blink || 0)), 0.04, 1.4), look = o.look || e.look, eyeX = [];
  for (const s of [-1, 1]) {
    const far = turn * s > 0 ? 1 - Math.abs(turn) * 0.35 : 1, asym = (e.asym || 0) * (s > 0 ? 1 : 0);
    const ex = s * (29 + F.eyes.spacing) * far + fx * 1.1, ey = -808;
    const r = drawEye(ctx, F, e, c, { ex, ey, w: (fem ? 20 : 19) * far, h: (fem ? 14.5 : 13) * eo * (1 - asym * 0.35), s, look: [look[0] + turn * 0.5, look[1]], t });
    drawBrow(ctx, F, e, c, { ex, ey, w: r.w, s, eo, asym });
    eyeX.push(ex);
  }
  if (face.glasses) {
    const gl = typeof face.glasses === 'object' ? face.glasses : {}; ctx.strokeStyle = gl.color || '#221A1E'; ctx.lineWidth = 5;
    for (const ex of eyeX) { ctx.beginPath(); if (gl.shape === 'square') ctx.rect(ex - 25, -828, 50, 38); else ctx.ellipse(ex, -808, 26, 22, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(eyeX[0] + 25, -812); ctx.lineTo(eyeX[1] - 25, -812); ctx.stroke();
  }
  drawNoseFront(ctx, F, c, fx * 1.4, g.noseY);
  drawMouth(ctx, e, clamp((e.mo || 0) + (o.talk || 0)), fx * 1.3, g.mouthY, fem, t, F);
  if (face.mustache) { ctx.fillStyle = c.hair; ctx.beginPath(); ctx.ellipse(fx * 1.3 - 12, g.mouthY - 12, 15, 6, 0.2, 0, Math.PI * 2); ctx.ellipse(fx * 1.3 + 12, g.mouthY - 12, 15, 6, -0.2, 0, Math.PI * 2); ctx.fill(); }
  hairFrontPiece(ctx, HP, c, { t, wind, faceW: g.W, flat });
  accessoriesHead(ctx, S, c, fx, false);
}

function drawMouth(ctx, e, mo, mx, my, fem, t, F) {
  const M = F ? F.mouth : { width: 1, lips: fem ? 0.5 : 0, curve: 0, gap: false };
  ctx.save(); ctx.translate(mx, 0); ctx.scale(M.width, 1); ctx.translate(-mx, 0);
  ctx.strokeStyle = OL; ctx.lineWidth = 4 / M.width; ctx.lineCap = 'round';
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
    if (M.gap) { ctx.fillStyle = '#3A0A14'; ctx.fillRect(mx - 2, my - 12, 4, 8 + angry * 10); }
    if (angry > 0.2) ctx.fillRect(mx - w, my + h * 0.9, w * 2, 8);
    ctx.fillStyle = '#C0505E'; ctx.beginPath(); ctx.ellipse(mx, my + h * 1.5, w * 0.6, h * 0.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.restore(); return;
  }
  const cu = M.curve * 5;                                 // resting curve: + corners up, − corners down
  ctx.beginPath();
  switch (e.mouth) {
    case 'frown': ctx.moveTo(mx - 13, my + 3); ctx.quadraticCurveTo(mx, my - 4, mx + 13, my + 3); break;
    case 'down': ctx.moveTo(mx - 12, my + 5); ctx.quadraticCurveTo(mx, my - 3, mx + 12, my + 5); break;
    case 'smile': ctx.moveTo(mx - 14, my - 3); ctx.quadraticCurveTo(mx, my + 9, mx + 14, my - 3); break;
    case 'smirk': ctx.moveTo(mx - 12, my + 1); ctx.quadraticCurveTo(mx + 2, my + 4, mx + 14, my - 5); break;
    case 'side': ctx.moveTo(mx + 2, my); ctx.lineTo(mx + 14, my - 2); break;
    case 'tight': ctx.moveTo(mx - 12, my); ctx.lineTo(mx + 12, my); ctx.lineWidth = 5 / M.width; break;
    case 'wobble': ctx.moveTo(mx - 12, my + 2); for (let k = 1; k <= 6; k++) ctx.lineTo(mx - 12 + k * 4, my + 2 + (k % 2 ? -3 : 2) + Math.sin(t * 20) * 0.8); break;
    default: ctx.moveTo(mx - 10, my - cu); ctx.quadraticCurveTo(mx, my + 2 + cu * 0.6, mx + 10, my - cu);
  }
  ctx.stroke();
  if (M.lips > 0 && e.mouth !== 'tight') { ctx.strokeStyle = fem ? 'rgba(190,70,90,0.55)' : 'rgba(120,50,50,0.35)'; ctx.lineWidth = (2 + M.lips * 2) / M.width; ctx.beginPath(); ctx.moveTo(mx - 7, my + 6 + M.lips * 2); ctx.quadraticCurveTo(mx, my + 9 + M.lips * 3, mx + 7, my + 6 + M.lips * 2); ctx.stroke(); }
  ctx.restore();
}

function accessoriesHead(ctx, S, c, fx, back) {
  for (const a of S.accessories || []) {
    const col = a.color || '#333';
    if (a.type === 'cap') {
      smooth(ctx, [[-92, -858], [-88, -914], [-34, -950], [34, -950], [88, -914], [92, -858], [0, -874]], true, 0.42); ink(ctx, col);
      if (!back) { smooth(ctx, [[-80 + fx, -862], [20 + fx, -870], [118 + fx, -852], [110 + fx, -838], [-80 + fx, -846]], true, 0.3); ink(ctx, shade(col, -0.25)); }
    } else if (a.type === 'beanie') {
      smooth(ctx, [[-92, -850], [-88, -920], [-40, -965], [40, -965], [88, -920], [92, -850]], true, 0.45); ink(ctx, col);
      P(ctx, [[-94, -880], [94, -880], [94, -846], [-94, -846]]); ink(ctx, shade(col, -0.2));
    } else if (a.type === 'headband') {
      ctx.beginPath(); ctx.moveTo(-88, -872); ctx.quadraticCurveTo(0, -905, 88, -872); ctx.strokeStyle = OL; ctx.lineWidth = 16; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 10; ctx.stroke();
    } else if (a.type === 'hat') hatFront(ctx, col, a.band, (x) => x + fx * 0.3, back);
  }
}

// ---------- body ----------
/** turned views: the far half (+x when facing right) is foreshortened */
const kx = (x, turn) => (x > 0 && turn > 0 ? x * (1 - 0.34 * clamp(turn / 0.75)) : x);
function seg(o, out, bend, swing, L1, L2, side, turn, fwd = false) {
  // upper + lower segment end points in the picture plane. p → 1 in profile: "out" then reads as forward/up
  const ft = Math.abs(turn), p = clamp((ft - 0.3) / 0.5), dir = Math.sign(turn) || 1;
  if (fwd) bend = lerp(-0.35, bend, p);        // a forward bend (walk/run) seen from the front: forearm toward the camera
  const a1 = out, a2 = out + bend;
  const hx = (a) => Math.sin(a) * side * (1 - ft * 0.4) * (1 - p) + Math.sin(a) * dir * p;
  const e = [o[0] + L1 * (hx(a1) + Math.sin(swing) * turn), o[1] + L1 * Math.cos(a1) * Math.cos(swing)];
  const sw2 = swing * 1.1;
  const w = [e[0] + L2 * (hx(a2) + Math.sin(sw2) * turn), e[1] + L2 * Math.cos(a2) * Math.cos(sw2)];
  return [e, w];
}

function drawLeg(ctx, S, c, side, lp, turn, t, sq = turn) {
  const bt = (S.bottom || {}).type || 'pants', p = clamp((Math.abs(turn) - 0.3) / 0.5);
  const hipX = kx(side * 46 * (1 - p * 0.85), sq) + turn * 6 * (1 - p);
  const hip = lp.root || [hipX, -430];
  const [out, swing, knee] = lp;
  let kneeP, ank;
  if (lp.pts) [kneeP, ank] = lp.pts;                        // IK (riding, reaching): joints already solved and projected
  else {
    kneeP = [hip[0] + 205 * (Math.sin(out) * side * (1 - p) + Math.sin(swing) * turn), hip[1] + 205 * Math.cos(swing) * Math.cos(out)];
    const shinA = swing - knee;
    ank = [kneeP[0] + 195 * (Math.sin(out * 0.6) * side * (1 - p) + Math.sin(shinA) * turn), kneeP[1] + 195 * Math.cos(shinA)];
  }
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

function drawArm(ctx, S, c, side, ap, swing, turn, t, sq = turn) {
  const top = S.top || {}, sleeve = top.type === 'tshirt' || top.type === 'dress' && top.sleeves !== 'long' ? 'short' : top.type === 'tank' ? 'none' : top.sleeves || 'long';
  const sw = (S.build || {}).shoulders || 1;
  const p = clamp((Math.abs(turn) - 0.3) / 0.5);
  const sh = ap.root || [kx(side * 98 * sw * (1 - Math.abs(turn) * 0.15) * (1 - p * 0.95), sq) + turn * 8 * (1 - p) - p * 4, -682];
  const [elbow, wrist] = ap.pts || seg(sh, ap[0], ap[1], swing || 0, 140, 128, side, turn, !!ap[2]);
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
  const k = clamp((Math.abs(o.turn) - 0.3) / 0.45), F = faceParams(S), g = faceGeom(F), HP = hairParams(S), fem = F.fem, face = S.face || {}, flat = !!S._flatHair;
  const cx = 14 + 14 * k;                 // the face's centre line moves toward where they look
  const m = map3q(cx, k, g.W), sq = F.shape === 'square' ? 6 : 0, ws = g.W / 64, jw = g.jawW / 48;
  // hair behind: the back of the head shows more on the near side
  if (!(o._longDone && isLong(HP))) hairBehind(ctx, HP, c, { t, wind, map: m });
  // near ear only
  const earX = m(-g.W) + 8 - F.ears.out * 6;
  ctx.save(); ctx.translate(earX, -812); ctx.rotate(-F.ears.out * 0.3);
  ctx.beginPath(); ctx.ellipse(0, 0, 12 * F.ears.size * (1 + F.ears.out * 0.2), 18 * F.ears.size, 0, 0, Math.PI * 2); ink(ctx, c.skin, 4);
  ctx.beginPath(); ctx.arc(0, 0, 7 * F.ears.size, 1.4, 4.6); ctx.strokeStyle = c.skinSh; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
  if ((S.accessories || []).some((a) => a.type === 'earrings')) { circle(ctx, earX, -792, 5); ink(ctx, '#E8C46A', 2); }
  // face: full cheek on the near side; brow ridge, eye socket, cheekbone and chin on the far side
  const cy = g.chinY, ch = F.cheeks.chubby * 8;
  const fp = [[-60 * ws, -884], [-64 * ws - ch * 0.3, -834], [-58 * ws - ch, -792], [-(g.jawW - 4), g.jawY - 2 + sq * 0.5], [-16 - g.chinW * 0.4, cy - 12 + sq], [cx + 4 - g.chinW * 0.3, cy - 1], [cx + 22 + g.chinW * 0.4, cy - 5 + sq * 0.5],
    [cx + 34 * jw + 2 * k, g.jawY + 4 + sq], [cx + (40 + 4 * k) * ws + ch * 0.4, -788], [cx + (36 + 4 * k) * ws, -806], [cx + (42 + 6 * k) * ws + F.cheeks.bones * 2, -834], [cx + (38 + 4 * k) * ws, -884], [0, -920]];
  const head = () => smooth(ctx, fp, true, 0.42);
  head(); ink(ctx, c.skin);
  shadeIn(ctx, head, () => {
    ctx.fillStyle = c.skinSh; ctx.beginPath(); ctx.moveTo(cx + 18, -900); ctx.quadraticCurveTo(cx + 12, -800, cx + 30, -720); ctx.lineTo(160, -680); ctx.lineTo(160, -900); ctx.fill();
    const hs = ctx.createLinearGradient(0, -930, 0, -846); hs.addColorStop(0, 'rgba(80,30,60,0.26)'); hs.addColorStop(1, 'rgba(80,30,60,0)'); ctx.fillStyle = hs; ctx.fillRect(-110, -935, 270, 90);
    if (face.beard === 'full') { ctx.fillStyle = c.hair; ctx.beginPath(); ctx.moveTo(-58, -800); ctx.quadraticCurveTo(-40, cy + 10, cx + 6, cy + 12); ctx.quadraticCurveTo(cx + 34, cy + 6, cx + 42, -790); ctx.lineTo(cx + 28, -780); ctx.quadraticCurveTo(cx, -738, -40, -792); ctx.fill(); }
    if (face.beard === 'stubble') { ctx.fillStyle = 'rgba(40,25,25,0.22)'; ctx.beginPath(); ctx.moveTo(-58, -800); ctx.quadraticCurveTo(-40, cy + 8, cx + 6, cy + 10); ctx.quadraticCurveTo(cx + 34, cy + 4, cx + 42, -790); ctx.quadraticCurveTo(cx, -760, -58, -800); ctx.fill(); }
    if (e.blush) { ctx.fillStyle = `rgba(230,90,110,${0.35 * e.blush})`; ctx.beginPath(); ctx.ellipse(-26, -782, 16, 7, 0, 0, Math.PI * 2); ctx.ellipse(cx + 26, -782, 9, 6, 0, 0, Math.PI * 2); ctx.fill(); }
    faceDetails(ctx, F, c, g, m, 0);
    ctx.save(); ctx.beginPath(); ctx.rect(-110, -900, 52, 220); ctx.clip(); head(); ctx.strokeStyle = c.rim; ctx.globalAlpha = 0.45; ctx.lineWidth = 14; ctx.stroke(); ctx.restore();
  });
  // eyes: the near one full, the far one narrower and closer to the face edge
  const eo = clamp(e.open * (1 - (o.blink || 0)), 0.04, 1.4), look = o.look || e.look, sp = F.eyes.spacing;
  const eyes = [[cx - 34 - sp, fem ? 20 : 19, false], [cx + 22 + 2 * k + sp * 0.6, (fem ? 13 : 12) - 3 * k, true]];
  for (const [ex, w0, far] of eyes) {
    const asym = (e.asym || 0) * (far ? 1 : 0), s = far ? 1 : -1;
    const r = drawEye(ctx, F, e, c, { ex, ey: -808, w: w0, h: (fem ? 14.5 : 13) * eo * (1 - asym * 0.35), s, look, t, far, k3: 1 });
    drawBrow(ctx, F, e, c, { ex, ey: -808, w: r.w, s, eo, asym, far });
  }
  if (face.glasses) {
    const gl = typeof face.glasses === 'object' ? face.glasses : {}; ctx.strokeStyle = gl.color || '#221A1E'; ctx.lineWidth = 5;
    const [nx, fx2] = [eyes[0][0], eyes[1][0]];
    ctx.beginPath(); if (gl.shape === 'square') ctx.rect(nx - 26, -828, 52, 38); else ctx.ellipse(nx, -808, 27, 22, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); if (gl.shape === 'square') ctx.rect(fx2 - 14, -826, 30, 36); else ctx.ellipse(fx2 + 2, -808, 16, 21, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(nx + 27, -812); ctx.lineTo(fx2 - 14, -812); ctx.moveTo(nx - 26, -812); ctx.lineTo(earX + 4, -816); ctx.stroke();
  }
  // nose: a wedge pointing where they look, its shadow on the far side (shape/size/length from the spec)
  const N = F.nose, z = N.size * (N.shape === 'button' ? 0.78 : N.shape === 'wide' ? 1.1 : 1), ln = N.length, ny = g.noseY + 5;
  const up = N.shape === 'upturned' ? -5 : N.shape === 'hooked' ? 5 : 0;
  const np = [[cx + 4, ny - 31 * ln], ...(N.shape === 'hooked' ? [[cx + 13 * z, ny - 18 * ln]] : []), [cx + 12 * z, ny - 19 * ln + 4], [cx + 16 * z, ny - 8 + up], [cx + 8 * z, ny + (N.shape === 'wide' ? 2 : 0)], [cx - 1 - (N.shape === 'wide' ? 6 : 0), ny - 5]];
  smooth(ctx, np, false, N.shape === 'button' ? 0.6 : 0.4); ctx.fillStyle = c.skinSh; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.stroke();
  if (N.shape === 'upturned' || N.shape === 'wide') { ctx.fillStyle = shade(c.skin, -0.45); circle(ctx, cx + 5 * z, ny - 3, 2.2); ctx.fill(); }
  if (N.bridge > 0) { ctx.strokeStyle = c.skinSh; ctx.lineWidth = 2 + N.bridge; ctx.beginPath(); ctx.moveTo(cx - 2, ny - 44); ctx.lineTo(cx - 3, ny - 14); ctx.stroke(); }
  // mouth: the far half shorter
  ctx.save(); ctx.translate(cx + 2, 0); ctx.scale(0.86, 1); drawMouth(ctx, e, clamp((e.mo || 0) + (o.talk || 0)), 0, g.mouthY, fem, t, F); ctx.restore();
  if (face.mustache) { ctx.fillStyle = c.hair; ctx.beginPath(); ctx.ellipse(cx - 10, g.mouthY - 12, 15, 6, 0.2, 0, Math.PI * 2); ctx.ellipse(cx + 12, g.mouthY - 12, 10, 5, -0.2, 0, Math.PI * 2); ctx.fill(); }
  // fringe + temple locks, mapped to 3/4 (near lock full, far lock narrow)
  hairFrontPiece(ctx, HP, c, { t, wind, map: m, faceW: g.W, flat });
  for (const a of S.accessories || []) {
    const col = a.color || '#333';
    if (a.type === 'cap' || a.type === 'beanie') {
      smooth(ctx, [[-92, a.type === 'beanie' ? -846 : -852], [-88, -912], [-40, -952], [30, -954], [cx + 44, -920], [cx + 50, -858], [cx - 10, -866]], true, 0.42); ink(ctx, col);
      if (a.type === 'cap') { smooth(ctx, [[cx - 20, -870], [cx + 40, -878], [cx + 118, -858], [cx + 110, -842], [cx + 30, -852], [cx - 20, -852]], true, 0.3); ink(ctx, shade(col, -0.25)); }
      else { smooth(ctx, [[-96, -884], [cx + 54, -888], [cx + 54, -852], [-96, -846]], true, 0.2); ink(ctx, shade(col, -0.2)); }
    } else if (a.type === 'headband') { ctx.beginPath(); ctx.moveTo(-80, -868); ctx.quadraticCurveTo(-10, -912, cx + 44, -880); ctx.strokeStyle = OL; ctx.lineWidth = 16; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 10; ctx.stroke(); }
    else if (a.type === 'hat') hatFront(ctx, col, a.band, (x) => (x < 0 ? cx * 0.4 + x * 1.05 : cx * 0.4 + x * 0.92));
  }
}

// ---------- three-quarter from behind (back + 0.3 ≤ |turn| < 0.75): mirrored so the near side is local −x ----------
function drawHeadBack3q(ctx, S, o) {
  const c = o._c || palette(S), t = o.t || 0, wind = o.wind ?? 1, k = clamp((Math.abs(o.turn) - 0.3) / 0.45);
  const F = faceParams(S), g = faceGeom(F), HP = hairParams(S), face = S.face || {};
  const cx = -(14 + 14 * k), m = map3q(cx, k, g.W);           // the head's centre line moves AWAY from the near side
  // the head itself (skin) — skull, the near cheek and jaw corner reach past the hair on the near side
  drawBackSkull(ctx, g, c, m);
  if (face.beard === 'full') { smooth(ctx, [[m(-g.jawW) + 4, g.jawY - 30], [m(-g.jawW) - 2, g.jawY], [m(-g.jawW * 0.5), g.chinY + 10], [m(-g.W * 0.35), -770]], true, 0.4); ctx.fillStyle = c.hair; ctx.fill(); }
  // near ear
  const earX = m(-g.W) + 8 - F.ears.out * 6;
  ctx.save(); ctx.translate(earX, -812); ctx.rotate(-F.ears.out * 0.3);
  ctx.beginPath(); ctx.ellipse(0, 0, 12 * F.ears.size, 18 * F.ears.size, 0, 0, Math.PI * 2); ink(ctx, c.skin, 4); ctx.restore();
  if ((S.accessories || []).some((a) => a.type === 'earrings')) { circle(ctx, earX, -792, 5); ink(ctx, '#E8C46A', 2); }
  // the hair covers the back of the head but stops at the ear: less stretch on the near side than the face edge
  const mh = (x) => (x < 0 ? cx + x * (1 + 0.12 * k) : cx + x * (1 - 0.32 * k));
  if (HP) hairBackView(ctx, HP, c, { t, wind, flat: !!S._flatHair, map: mh });
  else { ctx.beginPath(); ctx.ellipse(m(0), -842, (m(g.W + 18) - m(-g.W - 18)) / 2, 90, 0, 0, Math.PI * 2); ink(ctx, c.skin); }
  for (const a of S.accessories || []) {
    const col = a.color || '#333';
    if (a.type === 'cap') {                                   // brim points forward = away, peeking out on the near side
      smooth(ctx, [[m(-120), -858], [m(-70), -872], [m(-40), -858], [m(-100), -848]], true, 0.3); ink(ctx, shade(col, -0.25));
      smooth(ctx, [[-92, -858], [-88, -914], [-34, -950], [34, -950], [88, -914], [92, -858], [0, -846]].map(([x, y]) => [m(x), y]), true, 0.42); ink(ctx, col);
    } else if (a.type === 'beanie') {
      smooth(ctx, [[-92, -850], [-88, -920], [-40, -965], [40, -965], [88, -920], [92, -850]].map(([x, y]) => [m(x), y]), true, 0.45); ink(ctx, col);
      smooth(ctx, [[-94, -880], [94, -880], [94, -846], [-94, -846]].map(([x, y]) => [m(x), y]), true, 0.2); ink(ctx, shade(col, -0.2));
    } else if (a.type === 'headband') { ctx.beginPath(); ctx.moveTo(m(-88), -872); ctx.quadraticCurveTo(m(0), -905, m(88), -872); ctx.strokeStyle = OL; ctx.lineWidth = 16; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 10; ctx.stroke(); }
    else if (a.type === 'hat') hatFront(ctx, col, a.band, m, true);
  }
}

// ---------- reaching for exact points (riding, holding a bar): two-bone IK in 3D, projected into the view ----------
// pose.ik = { L: [x, y, z], R: […], legL: […], legR: […] } in body units: x forward, y up (feet 0, hips 430, shoulders 682),
// z to the character's right. L / legL = the limbs on screen-left in front view (the character's right side).
function ik2(root, target, L1, L2, pole) {
  const d = [target[0] - root[0], target[1] - root[1], target[2] - root[2]], dl = Math.hypot(...d) || 1, D = Math.min(dl, L1 + L2 - 0.5);
  const u = d.map((v) => v / dl), a = (L1 * L1 + D * D - L2 * L2) / (2 * D), hh = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const pd = pole[0] * u[0] + pole[1] * u[1] + pole[2] * u[2], pp = pole.map((v, i) => v - pd * u[i]), pl = Math.hypot(...pp) || 1;
  const joint = root.map((v, i) => v + u[i] * a + pp[i] / pl * hh), end = root.map((v, i) => v + u[i] * D);
  return [joint, end];
}
/** the view angle of a drawn (possibly mirrored) figure: 0 front, 90 profile (local facing +x), 180 back */
export function viewAngle(turnLocal, back, bq) { return back ? (bq ? 180 + 90 * turnLocal : 180 - 90 * turnLocal) : 90 * clamp(turnLocal, -1, 1); }
export function project(p, th) { const a = th * Math.PI / 180; return [p[0] * Math.sin(a) - p[2] * Math.cos(a), -p[1], p[0] * Math.cos(a) + p[2] * Math.sin(a)]; }
function ikLimbs(S, pose, th) {
  const sw = (S.build || {}).shoulders || 1, out = {};
  for (const [key, side, isLeg] of [['L', -1, false], ['R', 1, false], ['legL', -1, true], ['legR', 1, true]]) {
    const tgt = pose.ik[key]; if (!tgt) continue;
    const root = isLeg ? [0, 430, -side * 46] : [0, 682, -side * 98 * sw];
    const [j, e] = ik2(root, tgt, isLeg ? 205 : 140, isLeg ? 195 : 128, isLeg ? [1, 0.3, 0] : [-0.6, -0.3, -side * 0.6]);
    const P = (q) => project(q, th);
    out[key] = { root: P(root).slice(0, 2), pts: [P(j).slice(0, 2), P(e).slice(0, 2)] };
  }
  return out;
}

// ---------- profile (|turn| ≥ 0.75): drawn facing right; drawCharacter mirrors it for facing left ----------
function drawHeadProfile(ctx, S, o) {
  const c = o._c || palette(S), e = typeof o.expr === 'string' ? EXPR[o.expr] : o.expr || EXPR.neutral, t = o.t || 0, wind = o.wind ?? 1;
  const F = faceParams(S), g = faceGeom(F), HP = hairParams(S), fem = F.fem, face = S.face || {}, flat = !!S._flatHair;
  hairProfileBehind(ctx, HP, c, { t, wind });
  // head + face silhouette: forehead, brow, nose, lips, chin, jaw, back of the skull — all from the face parameters
  const sq = F.shape === 'square' ? 6 : 0, N = F.nose, z = N.size, dm = g.mouthY + 752, dc = g.chinY + 726, lp = F.mouth.lips;
  const tipX = 60 + 18 * z * ({ button: 0.62, upturned: 0.82, wide: 1.02, hooked: 1.12 }[N.shape] || 1);
  const tipY = -790 + (N.length - 1) * 14 + (N.shape === 'upturned' ? -7 : N.shape === 'hooked' ? 6 : 0) + dm * 0.3;
  const brow = 62 + (F.age.forehead > 0 ? 1 : 0) + (F.brows.thick > 9 ? 2 : 0);
  const sil = [[52, -900], [60, -860], [brow, -830], [60, -818], ...(N.shape === 'hooked' ? [[66 + 4 * z, -808]] : []), [tipX, tipY], [61, -780 + dm * 0.35],
    [64 + 2 * lp, -766 + dm], [60, -758 + dm], [62 + 3 * lp, -748 + dm], [57 + (F.chin.size - 1) * 10, -730 + dc + sq], [38, -722 + dc + sq],
    [6 - F.cheeks.chubby * 4, -740 + dc * 0.6 + sq], [-30, -770], [-58, -800], [-70, -850], [-58, -912], [0, -942]];
  const head = () => smooth(ctx, sil, true, N.shape === 'button' ? 0.42 : 0.35);
  head(); ink(ctx, c.skin);
  shadeIn(ctx, head, () => {
    ctx.fillStyle = c.skinSh; ctx.beginPath(); ctx.moveTo(-80, -900); ctx.quadraticCurveTo(-20, -820, -40, -700); ctx.lineTo(-90, -700); ctx.fill();
    ctx.fillStyle = 'rgba(80,30,60,0.18)'; ctx.beginPath(); ctx.moveTo(10, -746 + dc); ctx.quadraticCurveTo(30, -735 + dc, 55, -738 + dc); ctx.lineTo(55, -700); ctx.lineTo(0, -700); ctx.fill();
    if (face.beard === 'full') { ctx.fillStyle = c.hair; ctx.beginPath(); ctx.moveTo(-34, -790); ctx.quadraticCurveTo(-10, -720 + dc, 46, -722 + dc); ctx.lineTo(62, -748 + dm); ctx.quadraticCurveTo(20, -760, -10, -800); ctx.fill(); }
    if (face.beard === 'stubble') { ctx.fillStyle = 'rgba(40,25,25,0.22)'; ctx.beginPath(); ctx.moveTo(-34, -790); ctx.quadraticCurveTo(-10, -722 + dc, 50, -724 + dc); ctx.lineTo(62, -750 + dm); ctx.quadraticCurveTo(20, -770, -10, -800); ctx.fill(); }
    if (e.blush) { ctx.fillStyle = `rgba(230,90,110,${0.35 * e.blush})`; ctx.beginPath(); ctx.ellipse(28, -782, 16, 8, 0, 0, Math.PI * 2); ctx.fill(); }
    if (F.cheeks.chubby > 0) { ctx.fillStyle = `rgba(220,120,120,${0.18 * F.cheeks.chubby})`; ctx.beginPath(); ctx.ellipse(24, -778, 18, 11, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.lineCap = 'round';
    if (F.age.smile > 0) { ctx.strokeStyle = c.skinSh; ctx.lineWidth = 2 + F.age.smile * 1.5; ctx.beginPath(); ctx.moveTo(50, -780); ctx.quadraticCurveTo(40, -764 + dm, 46, -746 + dm); ctx.stroke(); }
    if (F.age.forehead > 0) { ctx.strokeStyle = c.skinSh; ctx.lineWidth = 2 + F.age.forehead; for (const y of [-866, -856]) { ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(52, y - 2); ctx.stroke(); } }
    if (F.cheeks.bones > 0) { ctx.strokeStyle = c.skinSh; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(6, -790); ctx.lineTo(24, -776 - F.cheeks.bones * 4); ctx.stroke(); }
    const M = F.marks;
    if (M.freckles > 0) { ctx.fillStyle = shade(c.skin, -0.35); for (let i = 0; i < 4 + M.freckles * 6; i++) { circle(ctx, 30 + (i % 4) * 5, -790 + Math.floor(i / 4) * 5, 1.8); ctx.fill(); } }
    if (M.mole) { ctx.fillStyle = shade(c.skin, -0.6); circle(ctx, 22 + Math.abs(M.mole[0]) * 0.3, M.mole[1], 2.6); ctx.fill(); }
    if (M.bruise) { ctx.fillStyle = 'rgba(110,70,140,0.35)'; ctx.beginPath(); ctx.ellipse(22 + Math.abs(M.bruise.x) * 0.3, M.bruise.y, M.bruise.r || 12, (M.bruise.r || 12) * 0.7, 0, 0, Math.PI * 2); ctx.fill(); }
    if (M.scar) { const sc = M.scar, a = sc.angle || 0.6, L = sc.len || 18; ctx.strokeStyle = shade(c.skin, -0.3); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(22 + Math.abs(sc.x) * 0.3, sc.y); ctx.lineTo(22 + Math.abs(sc.x) * 0.3 + Math.cos(a) * L, sc.y + Math.sin(a) * L); ctx.stroke(); }
    ctx.strokeStyle = c.rim; ctx.globalAlpha = 0.45; ctx.lineWidth = 12; head(); ctx.stroke(); ctx.globalAlpha = 1;
  });
  // ear
  const er = F.ears.size, ex0 = -22 - F.ears.out * 4;
  ctx.beginPath(); ctx.ellipse(ex0, -812, 12 * er * (1 - F.ears.out * 0.25), 19 * er, 0.15, 0, Math.PI * 2); ink(ctx, c.skin, 4);
  ctx.beginPath(); ctx.arc(ex0, -812, 7 * er, -1.2, 1.6); ctx.strokeStyle = c.skinSh; ctx.lineWidth = 3; ctx.stroke();
  if ((S.accessories || []).some((a) => a.type === 'earrings')) { circle(ctx, ex0 + 2, -790, 5); ink(ctx, '#E8C46A', 2); }
  // eye (side view: a wedge, iris to the front) — size and shape from the spec
  const E = F.eyes, shp = { round: 1.25, almond: 1, narrow: 0.7, hooded: 0.85, droopy: 0.95 }[E.shape] || 1;
  const eo = clamp(e.open * (1 - (o.blink || 0)), 0.04, 1.4), ex = 36, ey = -808, w = 14 * E.size, h = 12 * eo * E.size * shp;
  const tl = (E.tilt + (E.shape === 'droopy' ? -0.22 : 0)) * 5;
  const eye = () => { ctx.beginPath(); ctx.moveTo(ex - w * 0.7, ey - h * 0.3 + tl); ctx.quadraticCurveTo(ex + 2, ey - h * 1.4, ex + w, ey - tl * 0.4); ctx.quadraticCurveTo(ex + 2, ey + h * 0.9, ex - w * 0.7, ey + h * 0.3 + tl); ctx.closePath(); };
  eye(); ctx.fillStyle = '#FBF6F0'; ctx.fill();
  shadeIn(ctx, eye, () => {
    const ix = ex + 6 + (o.look || e.look)[0] * 3, iy = ey + (o.look || e.look)[1] * 3;
    ctx.fillStyle = c.iris; ctx.beginPath(); ctx.ellipse(ix, iy, 6 * E.size, 10 * E.size, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = OL; ctx.beginPath(); ctx.ellipse(ix + 1, iy, 3 * E.size, 5 * E.size, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; circle(ctx, ix - 1, iy - 4, 2.5); ctx.fill();
    if (E.shape === 'hooded') { ctx.fillStyle = c.skinSh; ctx.fillRect(ex - w, ey - h * 1.6, w * 2.2, h * 1.05); }
  });
  ctx.strokeStyle = OL; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(ex - w * 0.8, ey - h * 0.35 + tl); ctx.quadraticCurveTo(ex + 2, ey - h * 1.5, ex + w + 2, ey - 1 - tl * 0.4); ctx.lineWidth = 6 + E.lashes * 1.2; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ex - w * 0.8, ey - h * 0.35 + tl); ctx.lineTo(ex - w * 0.8 - (6 + 4 * E.lashes), ey - h * 0.35 + tl - (4 + 3 * E.lashes)); ctx.lineWidth = 4; ctx.stroke();
  if (F.age.bags > 0) { ctx.strokeStyle = c.skinSh; ctx.lineWidth = 2 + F.age.bags * 2; ctx.beginPath(); ctx.moveTo(ex - w * 0.5, ey + h + 6); ctx.quadraticCurveTo(ex + 2, ey + h + 11 + F.age.bags * 3, ex + w * 0.7, ey + h + 4); ctx.stroke(); }
  if (e.tears) { ctx.fillStyle = 'rgba(170,215,255,0.85)'; ctx.beginPath(); ctx.ellipse(ex + 4, ey + 16 + ((t * 40) % 40), 4, 7, 0, 0, Math.PI * 2); ctx.fill(); }
  // brow
  const B = F.brows, by = ey - 28 * E.size + e.browY + (eo > 1.1 ? -6 : 0), bi = (e.brow + B.tilt * 0.35) * 14;
  ctx.beginPath(); ctx.moveTo(ex - 14 * B.length, by - bi * 0.4); ctx.quadraticCurveTo(ex + 2, by - (3 + 8 * B.arch) - bi * 0.1, ex + 18, by + bi); ctx.lineWidth = B.thick; ctx.strokeStyle = c.brow; ctx.stroke();
  // mouth (side view)
  const mo = clamp((e.mo || 0) + (o.talk || 0)), angry = Math.max(0, e.brow), down = e.mouth === 'down' || e.mouth === 'wobble' || e.mouth === 'frown' ? 1 : 0, upm = e.mouth === 'smile' || e.mouth === 'grin' || e.mouth === 'smirk' ? 1 : 0;
  const rest = F.mouth.curve, mw = F.mouth.width;
  ctx.strokeStyle = OL; ctx.lineWidth = 4;
  if (mo > 0.08 || e.mouth === 'o' || e.mouth === 'open') {
    const hgt = 4 + mo * 16; ctx.beginPath(); ctx.moveTo(64 + lp * 2, -763 + dm); ctx.lineTo(64 - 20 * mw, -760 + dm + (down - upm) * 4 + angry * 4); ctx.lineTo(60, -758 + dm + hgt); ctx.closePath();
    ctx.fillStyle = '#5A1220'; ctx.fill(); ctx.stroke();
    if (F.mouth.gap) { ctx.fillStyle = '#fff'; ctx.fillRect(56, -762 + dm, 6, 4); }
  } else { ctx.beginPath(); ctx.moveTo(62, -760 + dm); ctx.quadraticCurveTo(54, -759 + dm, 62 - 16 * mw, -760 + dm + (down - upm) * 5 - rest * 4); ctx.stroke(); }
  if (lp > 0) { ctx.strokeStyle = fem ? 'rgba(190,70,90,0.55)' : 'rgba(120,50,50,0.35)'; ctx.lineWidth = 2 + lp * 2; ctx.beginPath(); ctx.moveTo(62 + lp * 2, -754 + dm); ctx.lineTo(54, -752 + dm); ctx.stroke(); }
  if (F.chin.cleft) { ctx.strokeStyle = c.skinSh; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(58, -738 + dc); ctx.lineTo(52, -734 + dc); ctx.stroke(); }
  if (face.mustache) { ctx.fillStyle = c.hair; ctx.beginPath(); ctx.ellipse(60, -770 + dm, 14, 6, 0.2, 0, Math.PI * 2); ctx.fill(); }
  // glasses: one lens + the arm to the ear
  if (face.glasses) { const gl = typeof face.glasses === 'object' ? face.glasses : {}; ctx.strokeStyle = gl.color || '#221A1E'; ctx.lineWidth = 5; ctx.beginPath(); if (gl.shape === 'square') ctx.rect(ex - 10, ey - 18, 28, 34); else ctx.ellipse(ex + 4, ey, 15, 18, 0, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(ex - 12, ey - 6); ctx.lineTo(ex0 + 8, -818); ctx.stroke(); }
  // hair over the head, then head accessories
  hairProfile(ctx, HP, c, { t, wind, flat });
  for (const a of S.accessories || []) {
    const col = a.color || '#333';
    if (a.type === 'cap') { smooth(ctx, [[62, -866], [54, -926], [-8, -954], [-74, -928], [-92, -856], [-50, -850], [10, -862]], true, 0.42); ink(ctx, col); smooth(ctx, [[44, -874], [128, -866], [130, -850], [44, -854]], true, 0.3); ink(ctx, shade(col, -0.25)); }
    if (a.type === 'beanie') { smooth(ctx, [[64, -856], [52, -934], [-10, -970], [-78, -932], [-94, -846], [-40, -848]], true, 0.42); ink(ctx, col); smooth(ctx, [[68, -886], [-96, -880], [-96, -844], [68, -852]], true, 0.2); ink(ctx, shade(col, -0.2)); }
    if (a.type === 'headband') { ctx.beginPath(); ctx.moveTo(58, -880); ctx.quadraticCurveTo(-10, -930, -78, -870); ctx.strokeStyle = OL; ctx.lineWidth = 16; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 10; ctx.stroke(); }
    if (a.type === 'hat') hatProfile(ctx, col, a.band);
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
  probeCharacter(ctx, S, s * height, headK, o);
  if (o.shadow !== false) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(0, 0, 120 * s, 18 * s, 0, 0, Math.PI * 2); ctx.fill(); }
  // views: front · 3/4 (TQ) · profile (PROF, also when turned away that far) · back · 3/4 from behind (BQ)
  const PROF = Math.abs(turn) >= 0.75, TQ = !back && !PROF && Math.abs(turn) >= 0.3, BQ = back && !PROF && Math.abs(turn) >= 0.3;
  // turned views are drawn facing right; facing left = the same drawing mirrored (3/4 from behind: the other way)
  const mir = ((PROF || TQ) && turn < 0) || (BQ && turn > 0);
  ctx.scale(s * height * ((o.flip ? -1 : 1) * (mir ? -1 : 1)), s * height);     // uniform: a kid is a smaller person, not a squashed one
  const turnD = mir ? -turn : turn;
  // keep the lower foot on the ground for sits/kneels/crouches
  const legY = (lp) => -430 + 205 * Math.cos(lp[1]) * Math.cos(lp[0]) + 195 * Math.cos(lp[1] - lp[2]);
  const drop = pose.fixed || pose.ik ? 0 : -40 - Math.max(legY(pose.legL), legY(pose.legR));
  const br = Math.sin(t * 2.1) * 3, bob = -(pose.bob || 0);
  ctx.translate(0, drop + bob);
  if (o.lean) { ctx.translate(0, -430); ctx.rotate(o.lean); ctx.translate(0, 430); }
  // long hair hangs behind the body
  const HP = hairParams(S), longHair = isLong(HP);
  // (3/4 from behind is drawn mirrored the other way, so the limbs that are on screen-left/right in the straight back
  //  view must swap to stay on the same side of the body)
  const sw = BQ ? (a, b) => [b, a] : (a, b) => [a, b];
  const [pL, pR] = sw(pose.L, pose.R), [qL, qR] = sw(pose.legL, pose.legR), [swL, swR] = sw(pose.swingL, pose.swingR);
  const L = [pL[0] + Math.sin(t * 2.1) * 0.02, pL[1], pL[2]], R = [pR[0] + Math.sin(t * 2.1 + 1) * 0.02, pR[1], pR[2]];
  const legL = [...qL], legR = [...qR];
  const turnD0 = mir ? -turn : turn;
  // 3/4 from behind: squeezed on local +x (far), facing local −x (limb swings and toes go that way)
  const tA = Math.abs(turn), limbTurn = BQ ? -tA : turnD0, sqTurn = BQ ? tA : turnD0;
  // the view angle of this (possibly mirrored) drawing: 3D props (a bike) and IK limbs are projected with it
  const th = PROF ? 90 : viewAngle(BQ ? tA : turnD0, back, BQ);
  L.key = BQ ? 'R' : 'L'; R.key = BQ ? 'L' : 'R';         // which pose hand each drawn arm is (o.hold follows it)
  if (o.before) o.before(ctx, th);                        // parts of a 3D prop farther than the body (bike: far wheel)
  if (pose.ik) {                                          // riding / reaching: solve the limbs in 3D for this view
    const S2 = ikLimbs(S, pose, th);
    const keys = BQ ? [[L, 'R'], [R, 'L'], [legL, 'legR'], [legR, 'legL']] : [[L, 'L'], [R, 'R'], [legL, 'legL'], [legR, 'legR']];
    for (const [arr, key] of keys) if (S2[key]) { arr.root = S2[key].root; arr.pts = S2[key].pts; }
  }
  const farFirst = Math.abs(turnD0) > 0.3 || BQ;          // the far arm goes behind the torso when turned
  const farSide = BQ ? 1 : turnD0 > 0 ? 1 : -1;
  // a held object is drawn right after its arm, at the hand: it is hidden exactly when the hand is
  const held = (A, h) => { const f = o.hold && o.hold[A.key]; if (f) f(ctx, h.hand, Math.atan2(h.wrist[1] - h.elbow[1], h.wrist[0] - h.elbow[0]), { th, back, mir }); };
  const arm = (side) => { const A = side < 0 ? L : R; held(A, drawArm(ctx, S, c, side, A, side < 0 ? swL : swR, limbTurn, t, sqTurn)); };
  const headBlock = () => {
    ctx.save(); ctx.translate(0, br);
    ctx.translate(0, -760); if (o.headTilt) ctx.rotate(o.headTilt); ctx.scale(headK, headK); ctx.translate(0, 760);
    if (BQ) drawHeadBack3q(ctx, S, { ...o, _c: c, turn: turnD });
    else if (TQ) drawHead3q(ctx, S, { ...o, _c: c, turn: turnD, _longDone: longHair });
    else drawHead(ctx, S, { ...o, _c: c, turn: turnD, back, _longDone: longHair && !back });
    ctx.restore();
  };
  if (PROF) {
    const tp = Math.abs(turn), dim = { ...c, top: c.topSh, bottom: c.bottomSh, shoe: shade(c.shoe, -0.3), skin: c.skinSh, inner: c.innerSh };
    const head = () => { ctx.save(); ctx.translate(0, br - 760); if (o.headTilt) ctx.rotate(o.headTilt); ctx.scale(headK, headK); ctx.translate(0, 760); drawHeadProfile(ctx, S, { ...o, _c: c }); ctx.restore(); };
    // far side first (darker), then the body, then the near side
    drawLeg(ctx, S, dim, -1, legL, tp, t);
    held(L, drawArm(ctx, S, dim, -1, L, pose.swingL, tp, t));
    if (o.between) o.between(ctx, th);                            // e.g. a bike frame between the far and the near leg
    drawLeg(ctx, S, c, 1, legR, tp, t);
    drawPelvisProfile(ctx, S, c);
    ctx.save(); ctx.translate(0, br * 0.4); drawTorsoProfile(ctx, S, c, t, wind); ctx.restore();
    if (pose.over) { head(); held(R, drawArm(ctx, S, c, 1, R, pose.swingR, tp, t)); }
    else { held(R, drawArm(ctx, S, c, 1, R, pose.swingR, tp, t)); head(); }
    if (o.after) o.after(ctx, th);
    ctx.restore(); return;
  }
  if (longHair && !back) {                                                  // long hair hangs behind the body
    const k3 = clamp((Math.abs(turnD) - 0.3) / 0.45), map = TQ ? map3q(14 + 14 * k3, k3, faceGeom(faceParams(S)).W) : undefined;
    ctx.save(); ctx.translate(0, br - 760); if (o.headTilt) ctx.rotate(o.headTilt); ctx.scale(headK, headK); ctx.translate(0, 760);
    hairBehind(ctx, HP, c, { t, wind, map }); ctx.restore();
  }
  // the leg nearer the camera last (3/4 from behind: local −x is near)
  const order = BQ ? [1, -1] : back ? [-1, 1] : turnD > 0.2 ? [1, -1] : turnD < -0.2 ? [-1, 1] : [-1, 1];
  for (const side of order) drawLeg(ctx, S, c, side, side < 0 ? legL : legR, limbTurn, t, sqTurn);
  drawPelvis(ctx, S, c, sqTurn);
  if (o.between) o.between(ctx, th);
  // from behind, arms in front of the body (folded, holding a bar, reaching forward) are hidden behind it
  const hidden = (A) => A[1] <= -1 || (A.pts && back);
  if (back) for (const sd of (BQ ? [1, -1] : [-1, 1])) if (hidden(sd < 0 ? L : R) || (BQ && sd === 1)) arm(sd);
  if (farFirst && !back) arm(farSide);
  ctx.save(); ctx.translate(0, br * 0.4); drawTorso(ctx, S, c, sqTurn, t, wind, back); ctx.restore();
  if (back) { for (const sd of (BQ ? [-1] : [-1, 1])) if (!hidden(sd < 0 ? L : R)) arm(sd); headBlock(); }
  else if (pose.over) { headBlock(); if (!farFirst) arm(farSide); arm(-farSide); }
  else { if (!farFirst) arm(farSide); arm(-farSide); headBlock(); }
  if (o.after) o.after(ctx, th);                          // parts nearer than the body (bike: front wheel, handlebar)
  ctx.restore();
}

/** framing check: record the character's and face's screen boxes while OP.probe() renders a frame (see tools/capture.mjs check) */
function probeCharacter(ctx, S, k, headK, o) {
  const R = globalThis.__VN_PROBE; if (!R || !ctx.canvas || ctx.canvas.id !== 'out') return;
  const M = ctx.getTransform(), tp = (x, y) => { const p = M.transformPoint({ x, y }); return [p.x, p.y]; };
  const box = (x0, y0, x1, y1) => { const ps = [tp(x0, y0), tp(x1, y0), tp(x0, y1), tp(x1, y1)]; return [Math.min(...ps.map((p) => p[0])), Math.min(...ps.map((p) => p[1])), Math.max(...ps.map((p) => p[0])), Math.max(...ps.map((p) => p[1]))]; };
  const hc = -(760 + 70 * headK) * k, hr = 105 * headK * k;
  R.push({ kind: 'character', name: S.name || S.id, box: box(-130 * k, -(960 + 80 * (headK - 1)) * k, 130 * k, 0), face: box(-hr * 0.8, hc - hr * 0.6, hr * 0.8, hc + hr * 0.7) });
}

/** a character standing in for a narrator mime: talk from the mouth track only while their line plays */
export function talkFor(id, t, T) {
  const ln = T.lines.find((l) => l.mime === id && t >= l.start && t <= l.end);
  return ln ? T.mouthAt(t) : 0;
}
export { palette };
