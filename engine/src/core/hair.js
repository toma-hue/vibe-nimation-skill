// Parametric hair — every character gets their own haircut from a few numbers (spec.hair, see reference/CHARACTERS.md).
// The same parameters drive every view: front, 3/4 (both sides, via a mapping), profile (both sides) and back.
// Head units: skull centre (0, −840), skull ≈ ±80 wide (+ width), top −930; ears at x ±64, y −831…−793; face top edge −880.
//
//   style   'custom' (the default way) or a legacy preset name (short messy spiky swept buzz bowl curly afro long wavy bob
//           ponytail bun bald) — presets are just parameter sets, so old cast files keep rendering
//   top     crown volume above the skull (px)               width   side volume beyond the skull (px, < 0 = hugs)
//   length  y where the hair ends: −830 above the ears · −790 ear bottom · −735 jaw · −650 neck · −560 shoulders
//   fringe  none | full | messy | side | curtain | part | swept        fringeLen  y of the fringe tips (−845 brows …)
//   texture straight | wavy | curly | shaggy | spiky, amp = bump size (px)
//   part    x of the parting        taper   width of the ends (1 = straight down, 0.7 = narrower)
//   flip    how far the ends kick out (px)    quiff  0..1 upward volume at the front    hairline  y of the bare hairline
import { OL, smooth, ink, hash, clamp, lerp, circle, shade } from './lib.js';

/** skull half-width the side volume is added to (the face is ±64 at the temples) */
export const SKULL = 80;
const BASE = { top: 12, width: 6, length: -834, fringe: 'side', fringeLen: -866, texture: 'straight', amp: 6, part: -24, taper: 1, flip: 0, quiff: 0, hairline: -884 };
export const HAIR_PRESETS = {
  short:    { top: 12, width: 4, length: -834, fringe: 'side', fringeLen: -868, part: -26 },
  messy:    { top: 22, width: 14, length: -800, fringe: 'messy', fringeLen: -840, texture: 'shaggy', amp: 9, part: 0 },
  spiky:    { top: 34, width: 22, length: -812, fringe: 'messy', fringeLen: -836, texture: 'spiky', amp: 22, part: 0 },
  swept:    { top: 22, width: 4, length: -836, fringe: 'swept', quiff: 0.7, hairline: -888 },
  buzz:     { top: 3, width: -4, length: -850, fringe: 'none', hairline: -886, buzz: true },
  bowl:     { top: 16, width: 12, length: -826, fringe: 'full', fringeLen: -846, part: 0 },
  curly:    { top: 22, width: 16, length: -800, fringe: 'none', hairline: -878, texture: 'curly', amp: 8, part: 0 },
  afro:     { top: 58, width: 44, length: -790, fringe: 'none', hairline: -880, texture: 'curly', amp: 11, part: 0 },
  long:     { top: 12, width: 10, length: -600, fringe: 'curtain', fringeLen: -830, part: 0 },
  wavy:     { top: 14, width: 16, length: -610, fringe: 'curtain', fringeLen: -830, part: 0, texture: 'wavy', amp: 8 },
  bob:      { top: 14, width: 14, length: -742, fringe: 'full', fringeLen: -842, part: 0, taper: 0.95, flip: 4 },
  ponytail: { top: 10, width: 2, length: -836, fringe: 'part', part: -6, extra: 'ponytail' },
  bun:      { top: 8, width: 2, length: -836, fringe: 'part', part: 0, extra: 'bun' },
};

/** the full parameter set for a spec (null = bald) */
export function hairParams(S) {
  const h = S.hair || {}, st = h.style || 'short';
  if (st === 'bald') return null;
  const p = { ...BASE, ...(st === 'custom' ? {} : HAIR_PRESETS[st] || HAIR_PRESETS.short), ...h };
  if (h.bangs && !h.fringe) p.fringe = h.bangs === 'part' ? 'part' : h.bangs;        // legacy "bangs" override
  p.seed = 7 + [...String(S.id || S.name || 'x')].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  return p;
}
/** long hair (ends below −700) is drawn behind the body by drawCharacter */
export const isLong = (p) => !!p && p.length > -700;

// ---------- texture along an outline ----------
function resample(pts, step, closed) {
  const out = [], n = pts.length, segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = pts[i], b = pts[(i + 1) % n], d = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.round(d / step));
    for (let j = 0; j < k; j++) out.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]);
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}
/** add curls / waves / shag / spikes along an outline; dir = +1 pushes bumps to the left of the travel direction */
export function textured(pts, texture, amp, seed = 1, closed = true, dir = 1, phase = 0) {
  if (!texture || texture === 'straight' || amp <= 0) return pts;
  const per = { wavy: 74, curly: Math.max(12, amp * 2.4), shaggy: Math.max(26, amp * 3.4), spiky: Math.max(34, amp * 2.6) }[texture] || 40;
  const r = resample(pts, texture === 'curly' ? 5 : 7, closed), n = r.length, out = [];
  let s = phase;
  for (let i = 0; i < n; i++) {
    const a = r[(i - 1 + n) % n], b = r[(i + 1) % n];
    if (!closed && (i === 0 || i === n - 1)) { out.push(r[i]); continue; }
    if (i > 0) s += Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]);
    const tx = b[0] - a[0], ty = b[1] - a[1], L = Math.hypot(tx, ty) || 1, nx = -ty / L * dir, ny = tx / L * dir;
    const u = s / per, k = Math.floor(u), f = u - k, rnd = 0.65 + 0.7 * hash(seed + k * 13.7);
    // shag and spikes grow toward the ends (lower on the head), the crown stays calmer
    const wy = texture === 'shaggy' || texture === 'spiky' ? clamp(0.35 + (r[i][1] + 900) / 90, 0.35, 1.25) : 1;
    let off = 0;
    if (texture === 'wavy') off = amp * 0.7 * Math.sin(u * Math.PI * 2);
    else if (texture === 'curly') off = amp * Math.sin(f * Math.PI) * rnd;
    else if (texture === 'shaggy') off = amp * (f < 0.6 ? f / 0.6 : (1 - f) / 0.4) * rnd;
    else if (texture === 'spiky') off = amp * Math.pow(f < 0.5 ? f * 2 : (1 - f) * 2, 2.2) * rnd * 1.4;
    out.push([r[i][0] + nx * off * wy, r[i][1] + ny * off * wy]);
  }
  return out;
}
const kOf = (tex) => (tex === 'curly' ? 0.5 : tex === 'shaggy' ? 0.22 : tex === 'spiky' ? 0.12 : 0.45);
function strokeOpen(ctx, pts, w = 5, k = 0.3) { smooth(ctx, pts, false, k); ctx.strokeStyle = OL; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
function fillOnly(ctx, pts, color, k) { smooth(ctx, pts, true, k); ctx.fillStyle = color; ctx.fill(); }

// ---------- front geometry ----------
/** half-width of the hair mass at height y (front view) */
function halfW(p, y) {
  const W0 = SKULL + p.width, cy = -840, ryT = 90 + p.top, ryB = p.length <= -800 ? 74 : 92;
  if (y <= -800 || p.length <= -800) {
    const ry = y < cy ? ryT : ryB, v = clamp((y - cy) / ry, -1, 1);
    return W0 * Math.sqrt(Math.max(0, 1 - v * v * (y < cy ? 1 : p.length <= -800 ? 0.8 : 0.35)));
  }
  const u = clamp((y + 800) / (p.length + 800)), wAt800 = W0 * Math.sqrt(1 - Math.pow(40 / ryB, 2) * 0.35);
  return lerp(wAt800, W0 * p.taper, u) + p.flip * u * u;
}
/** outline of the mass behind the face (closed, clockwise from bottom-left) */
function massPts(p, back = false) {
  const top = -840 - (90 + p.top), pts = [];
  const Lside = p.length;
  const ys = []; for (let y = Lside; y > -834; y -= 12) ys.push(y);      // the sides, up to where the crown arc starts
  for (const y of ys) pts.push([-halfW(p, y), y]);
  for (let i = 0; i <= 16; i++) {                       // crown arc, with the quiff lifting the front middle
    const a = Math.PI * (1 + i / 16), x = Math.cos(a) * (SKULL + p.width) * 0.98, yy = -840 + Math.sin(a) * (90 + p.top);
    pts.push([x, yy - p.quiff * 26 * Math.exp(-(x * x) / 4200)]);
  }
  for (const y of ys.slice().reverse()) pts.push([halfW(p, y), y]);
  if (p.length > -800) {                                // long: ends, with a soft U across the back
    const w = halfW(p, p.length);
    pts.push([w * 0.55, p.length + 6], [0, p.length + 10], [-w * 0.55, p.length + 6]);
  } else if (back) {                                    // short, seen from behind: sides end at L, the nape dips to −790
    const wn = halfW(p, Lside);                                       // a rounded nape, never a V
    pts.push([wn * 0.92, Math.max(Lside, -810) + 6], [wn * 0.66, -795], [26, p.buzz ? -799 : -789], [-26, p.buzz ? -799 : -789], [-wn * 0.66, -795], [-wn * 0.92, Math.max(Lside, -810) + 6]);
  } else pts.push([halfW(p, Lside) * 0.5, Lside + 4], [-halfW(p, Lside) * 0.5, Lside + 4]);
  return pts;
}
/** the lower edge of the fringe, from x = +X to −X (front view), before texture */
function fringeEdge(p, W) {
  const X = p.buzz ? W + 4 : W + 18, H = p.hairline - p.quiff * 6, fl = p.fringeLen, pts = [];
  for (let i = 0; i <= 24; i++) {
    const x = X - (2 * X) * i / 24, ax = Math.abs(x), r = clamp(ax / W);
    let y;
    switch (p.fringe) {
      case 'none': y = H + 22 * Math.pow(r, 3); break;
      case 'full': case 'messy': y = fl - 5 * (1 - r * r) + (ax > W - 6 ? (ax - W + 6) * 1.2 : 0); break;
      case 'side': {
        const dir = p.part <= 0 ? 1 : -1, u = clamp(((x - p.part) * dir) / (W - p.part * dir + 1));
        y = (x - p.part) * dir < 0 ? H + 14 * Math.pow(r, 3) : lerp(H - 2, fl, Math.pow(u, 0.8)); break;
      }
      case 'curtain': y = lerp(H - 4, fl, Math.pow(clamp(Math.abs(x - p.part) / W), 1.5)); break;
      case 'part': y = lerp(H - 2, Math.max(fl, -862), Math.pow(clamp(Math.abs(x - p.part) / W), 1.3)); break;
      case 'swept': y = H - 6 + 10 * Math.pow(r, 2); break;
      default: y = H;
    }
    pts.push([x, y]);
  }
  return pts;
}

// a mapping of front-view x into a view: identity in front, the 3/4 squeeze/stretch around the face centre cx
const ident = (x) => x;
export function map3q(cx, k, W = 64) {
  return (x) => (x < 0 ? cx + x * (cx + W + 6 * k) / W : cx + x * (42 + 4 * k) / W);
}

/** the mass behind the face (front / 3/4). Call before the face. */
export function hairBehind(ctx, p, c, o = {}) {
  if (!p) return;
  const m = o.map || ident, t = o.t || 0, wind = o.wind ?? 1;
  let pts = massPts(p).map(([x, y]) => [m(x), y]);
  if (p.extra === 'ponytail' && !o.noExtras) { const sw = Math.sin(t * 2.2) * 6 * wind; smooth(ctx, [[m(40), -900], [m(118) + sw, -880], [m(136) + sw * 1.4, -790], [m(118) + sw * 2, -690], [m(96) + sw, -760], [m(70), -850]], true, 0.5); ink(ctx, c.hair); }
  if (p.extra === 'bun' && !o.noExtras) { circle(ctx, m(0), -955 - p.top, 40); ink(ctx, c.hair); }
  pts = textured(pts, p.texture, p.amp, p.seed, true, 1);
  const sway = Math.sin(t * 2.2) * 3 * wind;
  if (isLong(p)) pts = pts.map(([x, y]) => [x + (y > -760 ? sway * (y + 760) / (p.length + 760) : 0), y]);
  smooth(ctx, pts, true, kOf(p.texture)); ink(ctx, c.hair);
}

/** fringe + temple locks over the face (front / 3/4). Filled, ink only on the lower edges that hang over skin. */
export function hairFrontPiece(ctx, p, c, o = {}) {
  if (!p) return;
  const m = o.map || ident, W = o.faceW || 64, t = o.t || 0, wind = o.wind ?? 1, sway = Math.sin(t * 2.6) * 1.6 * wind;
  const near = o.sides || [-1, 1];
  // 1 · the fringe / hairline piece
  let edge = fringeEdge(p, W).map(([x, y]) => [x + (y > p.hairline ? sway : 0), y]);
  if (p.fringe === 'messy') edge = textured(edge, 'shaggy', p.amp + 6, p.seed + 3, false, -1);
  else if (p.fringe !== 'none' || p.texture === 'curly') edge = textured(edge, p.texture, p.amp * (p.fringe === 'none' ? 0.8 : 1), p.seed + 3, false, -1);
  edge = edge.map(([x, y]) => [m(x), y]);
  const X = p.buzz ? W + 4 : W + 18, topY = -840 - (90 + p.top) + 10;
  const cap = [[m(X), Math.min(edge[0][1], -870)], [m(X * 0.7), topY + 18], [m(0), topY - p.quiff * 20], [m(-X * 0.7), topY + 18], [m(-X), Math.min(edge[edge.length - 1][1], -870)]];
  fillOnly(ctx, [...edge, ...cap.slice().reverse()], c.hair, 0.25);         // edge right→left, then back over the crown
  strokeOpen(ctx, edge, p.buzz ? 3 : 4.5, p.fringe === 'messy' || p.texture === 'shaggy' || p.texture === 'spiky' ? 0.1 : 0.35);
  // strands
  if (!p.buzz && !o.flat) {
    ctx.strokeStyle = c.hairHi; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    for (const x0 of [-34, 2, 36]) { const y0 = topY + 22, y1 = Math.max(lerp(y0, fringeEdge(p, W)[Math.round(12 - x0 / (W + 18) * 12)][1], 0.55), y0 + 10); ctx.beginPath(); ctx.moveTo(m(x0), y0); ctx.quadraticCurveTo(m(x0 + 6), (y0 + y1) / 2, m(x0 + 2) + sway, y1); ctx.stroke(); }
  }
  // 2 · temple locks: down the temple, over the top of the ear, a sideburn — or long locks framing the face
  // slicked / swept-back hair: short neat temples; everything else: down the temple to the length
  const end = isLong(p) ? -730 : p.buzz ? clamp(p.length, -850, -836) : p.fringe === 'swept' ? Math.max(clamp(p.length, -872, -760), -850) : clamp(p.length, -872, -760), inner = p.buzz ? W - 6 : W - 4;
  for (const s of near) {
    const cap = isLong(p) ? 1e9 : W + 12 + Math.max(0, p.width) * 0.6;
    const outerX = (y) => s * Math.min(halfW(p, Math.min(y, -800)), cap);
    let pts = [[s * (W - 14), -880], [outerX(-878), -878]];
    for (let y = -860; y <= end; y += 14) pts.push([outerX(y) + (isLong(p) ? s * 6 : 0), y]);
    const lowIn = isLong(p) ? s * (W - 6) : s * inner;
    pts.push([lowIn + s * 4, end + 2], [lowIn, Math.min(end - 12, -812)], [s * (W - 5), -848], [s * (W - 12), -866]);
    let lower = pts.slice(pts.length - 4);
    if (p.texture !== 'straight') lower = textured(lower, p.texture, p.amp * 0.7, p.seed + s * 5, false, s);
    const all = [...pts.slice(0, pts.length - 4), ...lower].map(([x, y]) => [m(x), y]);
    fillOnly(ctx, all, c.hair, kOf(p.texture));
    strokeOpen(ctx, lower.map(([x, y]) => [m(x), y]), 4, kOf(p.texture));
  }
}

/** the whole head of hair seen from behind */
export function hairBackView(ctx, p, c, o = {}) {
  if (!p) return;
  const t = o.t || 0, wind = o.wind ?? 1;
  if (p.extra === 'ponytail') { const sw = Math.sin(t * 2.2) * 6 * wind; smooth(ctx, [[-26, -880], [26, -880], [30 + sw, -760], [12 + sw * 1.5, -660], [-12 + sw * 1.5, -660], [-30 + sw, -760]], true, 0.5); }
  const m = o.map || ident;                                   // 3/4 from behind: m(x, y) slides the nape to the far side
  let pts = massPts(p, true);
  pts = textured(pts, p.texture, p.amp, p.seed + 9, true, 1).map(([x, y]) => [m(x, y), y]);
  smooth(ctx, pts, true, kOf(p.texture)); ink(ctx, c.hair);
  if (p.extra === 'ponytail') { const sw = Math.sin(t * 2.2) * 6 * wind; smooth(ctx, [[-24, -890], [24, -890], [28 + sw, -760], [10 + sw * 1.5, -650], [-10 + sw * 1.5, -650], [-28 + sw, -760]], true, 0.5); ink(ctx, c.hair); }
  if (p.extra === 'bun') { circle(ctx, 0, -940 - p.top, 40); ink(ctx, c.hair); }
  if (!o.flat && !p.buzz) {                                   // cel shade on the far side (no ink inside the mass)
    ctx.save(); smooth(ctx, pts, true, kOf(p.texture)); ctx.clip(); ctx.fillStyle = shade(c.hair, -0.25); ctx.globalAlpha = 0.55;
    ctx.beginPath(); ctx.ellipse(m(70), -820, 60, 150, 0.15, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
}

// ---------- profile (facing right) ----------
/** hair drawn behind the profile head (ponytail, bun, long hair falling down the back) */
export function hairProfileBehind(ctx, p, c, o = {}) {
  if (!p) return;
  const t = o.t || 0, wind = o.wind ?? 1;
  if (p.extra === 'ponytail') { smooth(ctx, [[-70, -880], [-118, -870 + Math.sin(t * 2) * 4], [-140, -790], [-128, -700], [-104, -760], [-84, -840]], true, 0.5); ink(ctx, c.hair); }
  if (p.extra === 'bun') { circle(ctx, -72, -930 - p.top * 0.5, 36); ink(ctx, c.hair); }
}
/** the hair in profile: ONE silhouette (fringe + crown + back + nape) over the whole skull. Call after the face.
 *  Depth ≈ 1.1 × the front width; the lower edge goes around the ear (covered down to `length`); ink only on the outline. */
export function hairProfile(ctx, p, c, o = {}) {
  if (!p) return;
  const t = o.t || 0, wind = o.wind ?? 1, sway = Math.sin(t * 2.4) * 3 * wind, swf = Math.sin(t * 2.6) * 2 * wind;
  const pts = profileOutline(p, sway, swf);
  const outline = textured(pts, p.texture, p.amp * (p.buzz ? 0.5 : 1), p.seed + 11, true, -1);
  smooth(ctx, outline, true, kOf(p.texture)); ink(ctx, c.hair, p.buzz ? 4 : 5);
  if (!o.flat && !p.buzz) {                                      // cel shade on the back of the head (no lines inside)
    const sh = () => smooth(ctx, outline, true, kOf(p.texture));
    ctx.save(); sh(); ctx.clip(); ctx.fillStyle = shade(c.hair, -0.25); ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.ellipse(profileBack(p) + 6, -800, 70, 120, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
}
/** x of the back of the hair in profile (head units, facing right) */
export function profileBack(p) { const W0 = SKULL + p.width; return 66 - 1.1 * 2 * W0 * (p.buzz ? 0.93 : 1); }
function profileOutline(p, sway = 0, swf = 0) {
  const F = 60, H = p.hairline - p.quiff * 6, q = p.quiff, L = p.length;
  const front = (p.buzz ? 63 : 68) + Math.max(0, p.width) * 0.1, back = profileBack(p);
  const rx = (front - back) / 2, cxh = back + rx, cy = -850, ryT = (p.buzz ? 88 : 92) + p.top;
  const pts = [];
  // 1 · the front edge, from the fringe tip / hairline up to the crown
  const fl = p.fringeLen;
  let lower;                                                    // fringe lower edge, from the temple forward to the tip
  if (p.fringe === 'full' || p.fringe === 'messy') {
    pts.push([F + 10 + swf, fl], [F + 8, (H + fl) / 2]);
    lower = [[F - 26, H + 16], [F - 26, fl - 6], [F - 12, fl + 3]];
  } else if (p.fringe === 'side' || p.fringe === 'curtain' || p.fringe === 'part') {
    const fs = Math.max(fl, p.fringe === 'part' ? -866 : -854);
    pts.push([F + 4 + swf, fs], [F + 6, (H + fs) / 2]);
    lower = [[F - 26, H + 14], [F - 16, fs - 3]];
  } else {
    pts.push([F - 2, H]);
    lower = [[F - 18, H + 14], [F - 8, H + 4]];
  }
  pts.push([front, H - 12]);
  if (q > 0) pts.push([front - 6 + q * 14, -906 - q * 22], [front - 24 + q * 10, -928 - q * 34]);
  // 2 · over the crown to the back of the head
  const a0 = -Math.PI * (q > 0 ? 0.36 : 0.22);
  for (let i = 0; i <= 12; i++) { const a = a0 + (-Math.PI - a0) * i / 12; pts.push([cxh + Math.cos(a) * rx, cy + Math.sin(a) * ryT]); }
  // 3 · down the back, the nape / ends, forward along the lower edge around the ear
  const ear = -22;
  if (L > -740) {                                               // long: down the back, the ends, up behind the ear
    const w = (back - 6) * p.taper;
    pts.push([back - 2, -800], [w - p.flip + sway, L - 20], [w * 0.92 - p.flip + sway, L], [-42 + sway * 0.5, L + 4]);
    pts.push([-38, Math.max(L - 40, -786)], [-38, -810], [ear, -846], [-4, -852], [12, -858]);
  } else {
    const ye = clamp(L, -856, -776);                            // over the ear: above it, or covering it down to L
    const nape = L > -800 ? L : p.buzz ? -802 : -794;              // the back of the head always reaches the nape
    pts.push([back + 2, Math.max(nape - 24, -826)], [lerp(back, ear, 0.45), nape + 2], [ear - 20, ye + 4], [ear - 8, ye - 2], [ear + 6, ye - 3]);
    const sb = Math.max(ye, -812);                              // the sideburn in front of the ear
    pts.push([ear + 14, ye], [ear + 16, sb], [ear + 26, sb], [ear + 30, Math.min(ye, sb - 6)]);
  }
  pts.push([24, -852]);                                         // the temple
  pts.push(...lower);
  return pts;
}

// ---------- hats (wide brim, pinched crown, band) ----------
export function hatFront(ctx, col, band, m = ident, back = false) {
  const B = band || shade(col, -0.45);
  ctx.beginPath(); ctx.ellipse(m(0), -896, Math.abs(m(150) - m(-150)) / 2, back ? 20 : 22, 0, 0, Math.PI * 2); ink(ctx, shade(col, -0.12));
  const crown = [[-74, -898], [-62, -986], [-34, -1008], [-14, -994], [0, -1012], [14, -994], [34, -1008], [62, -986], [74, -898]].map(([x, y]) => [m(x), y]);
  smooth(ctx, crown, true, 0.3); ink(ctx, col);
  smooth(ctx, [[-75, -900], [75, -900], [72, -924], [-72, -924]].map(([x, y]) => [m(x), y]), true, 0.1); ink(ctx, B, 4);
  if (!back) { ctx.beginPath(); ctx.ellipse(m(0), -893, Math.abs(m(150) - m(-150)) / 2 - 4, 12, 0, 0.05, Math.PI - 0.05); ctx.strokeStyle = OL; ctx.lineWidth = 5; ctx.stroke(); }
}
export function hatProfile(ctx, col, band) {
  const B = band || shade(col, -0.45);
  ctx.save(); ctx.translate(0, -900); ctx.rotate(-0.04);
  ctx.beginPath(); ctx.ellipse(0, 0, 150, 12, 0, 0, Math.PI * 2); ink(ctx, shade(col, -0.12)); ctx.restore();
  smooth(ctx, [[-62, -902], [-52, -990], [-14, -1004], [16, -992], [44, -1004], [58, -902]], true, 0.3); ink(ctx, col);
  smooth(ctx, [[-63, -904], [59, -904], [57, -928], [-61, -928]], true, 0.1); ink(ctx, B, 4);
}
