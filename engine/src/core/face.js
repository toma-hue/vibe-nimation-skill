// Individual faces: optional parameters in the spec (reference/CHARACTERS.md → "Face"). Defaults = the old shared face,
// so old cast files render exactly as before. Applied in front, 3/4 and profile, on top of every expression.
//   face   { shape: round|oval|long|heart|square, width, length, jaw (legacy), cheeks: {bones, chubby}, chin: {size, cleft},
//            age: {bags, forehead, smile}, marks: {freckles, mole: [x, y], bruise: {x, y, r}, scar: {x, y, len, angle}},
//            glasses, beard, mustache, freckles (legacy) }
//   eyes   { color, size, spacing, shape: round|almond|narrow|hooded|droopy, tilt, lashes }
//   brows  { color, thick, arch, length, tilt (+ stern / − worried) }
//   nose   { size, length, shape: button|straight|wide|hooked|upturned, bridge }
//   mouth  { width, lips, curve (+ slight smile / − slight frown), gap }
//   ears   { size, out }
import { OL, clamp, lerp, circle, shade, ink } from './lib.js';

export function faceParams(S) {
  const fem = S.gender === 'f', f = S.face || {}, e = S.eyes || {}, b = S.brows || {}, n = S.nose || {}, m = S.mouth || {}, ea = S.ears || {};
  const legacyShape = { square: 'square', narrow: 'heart', soft: 'oval' }[f.jaw] || (fem ? 'heart' : 'oval');
  const marks = f.marks || {};
  return {
    shape: f.shape || legacyShape, width: f.width ?? 1, length: f.length ?? 1,
    cheeks: { bones: (f.cheeks || {}).bones ?? 0, chubby: (f.cheeks || {}).chubby ?? 0 },
    chin: { size: (f.chin || {}).size ?? 1, cleft: !!(f.chin || {}).cleft },
    age: { bags: (f.age || {}).bags ?? 0, forehead: (f.age || {}).forehead ?? 0, smile: (f.age || {}).smile ?? 0 },
    marks: { freckles: marks.freckles ?? (f.freckles ? 0.6 : 0), mole: marks.mole || null, bruise: marks.bruise || null, scar: marks.scar || null },
    eyes: { size: e.size ?? 1, spacing: e.spacing ?? 0, shape: e.shape || 'almond', tilt: e.tilt ?? 0, lashes: e.lashes ?? (fem ? 1 : 0) },
    brows: { thick: b.thick ?? (fem ? 6 : 8), arch: b.arch ?? 0.4, length: b.length ?? 1, tilt: b.tilt ?? 0 },
    nose: { size: n.size ?? 1, length: n.length ?? 1, shape: n.shape || 'straight', bridge: n.bridge ?? 0 },
    mouth: { width: m.width ?? 1, lips: m.lips ?? (fem ? 0.5 : 0), curve: m.curve ?? 0, gap: !!m.gap },
    ears: { size: ea.size ?? 1, out: ea.out ?? 0 },
    fem,
  };
}

/** face geometry numbers shared by every view */
export function faceGeom(F) {
  const W = 64 * F.width * (F.shape === 'round' ? 1.04 : F.shape === 'long' ? 0.95 : 1);
  const chinY = -726 + (F.length - 1) * 60 + (F.shape === 'long' ? 14 : 0) + (F.chin.size - 1) * 10;
  const jaw = { oval: W - 16, round: W - 5, square: W - 3, heart: W - 26, long: W - 14 }[F.shape] ?? W - 16;
  const chinW = ({ oval: 6, round: 13, square: 16, heart: 1, long: 6 }[F.shape] ?? 6) * F.chin.size;
  return { W, chinY, jawW: jaw + F.cheeks.chubby * 8, jawY: F.shape === 'square' ? -752 : -760, chinW, cheekW: W + 3 * F.cheeks.bones + 6 * F.cheeks.chubby,
    mouthY: -752 + (F.length - 1) * 30 + (F.shape === 'long' ? 6 : 0), noseY: -775 + (F.length - 1) * 16 * F.nose.length };
}

/** the front face outline (closed). fx = small-turn shift. Top is a rounded skull so the hairline never shows a seam. */
export function faceCurveF(ctx, F, fx = 0) {
  const g = faceGeom(F), W = g.W, topW = F.shape === 'heart' ? W + 3 : W;
  ctx.beginPath(); ctx.moveTo(-topW + fx * 0.3, -880);
  ctx.bezierCurveTo(-W * 1.02 + fx * 0.3, -930, W * 1.02 + fx * 0.3, -930, topW + fx * 0.3, -880);
  ctx.bezierCurveTo(g.cheekW + 4 + fx * 0.3, -820, g.cheekW - 2 + fx * 0.6, -790, g.jawW + fx * 0.8, g.jawY);
  ctx.quadraticCurveTo(22 + g.chinW * 0.6 + fx, g.chinY - 4, g.chinW + fx * 1.2, g.chinY); ctx.lineTo(-g.chinW + fx * 1.2, g.chinY);
  ctx.quadraticCurveTo(-22 - g.chinW * 0.6 + fx, g.chinY - 4, -g.jawW + fx * 0.8, g.jawY);
  ctx.bezierCurveTo(-g.cheekW + 2 + fx * 0.6, -790, -g.cheekW - 4 + fx * 0.3, -820, -topW + fx * 0.3, -880); ctx.closePath();
}

/** one eye (front / 3/4). s = side (−1 left, +1 right), far = the far eye in 3/4 */
export function drawEye(ctx, F, e, c, { ex, ey, w, h, s, look, t, far = false, k3 = 0 }) {
  const E = F.eyes;
  const shp = { round: [0.9, 1.3], almond: [1, 1], narrow: [1.06, 0.68], hooded: [1, 0.86], droopy: [1, 0.95] }[E.shape] || [1, 1];
  w *= E.size * shp[0]; h *= E.size * shp[1];
  const tilt = (E.tilt + (E.shape === 'droopy' ? -0.22 : 0)) * w * 0.5;
  const L = [ex - w, ey + s * tilt], R = [ex + w, ey - s * tilt];
  const almond = () => { ctx.beginPath(); ctx.moveTo(L[0], L[1]); ctx.quadraticCurveTo(ex, ey - h * 1.6, R[0], R[1]); ctx.quadraticCurveTo(ex, ey + h * 1.1, L[0], L[1]); ctx.closePath(); };
  almond(); ctx.fillStyle = '#FBF6F0'; ctx.fill();
  ctx.save(); almond(); ctx.clip();
  const ir = (e.open > 1.1 ? 8 : 10.5) * E.size * (far ? 0.85 : 1), ix = ex + look[0] * 7 + (k3 ? w * 0.3 : 0), iy = ey + look[1] * 4 - 1;
  ctx.fillStyle = c.iris; ctx.beginPath(); ctx.ellipse(ix, iy, ir * (far ? 0.75 : k3 ? 0.92 : 1), ir, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = OL; ctx.beginPath(); ctx.ellipse(ix, iy, ir * 0.45, ir * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; circle(ctx, ix - 3, iy - 4, far ? 2.2 : 3); ctx.fill();
  ctx.fillStyle = 'rgba(60,20,40,0.25)'; ctx.fillRect(ex - w - 4, ey - h * 1.7, w * 2 + 8, h * 0.7);
  if (E.shape === 'hooded') { ctx.fillStyle = c.skinSh; ctx.fillRect(ex - w - 4, ey - h * 1.7, w * 2 + 8, h * 1.05); }
  ctx.restore();
  ctx.strokeStyle = OL; ctx.lineCap = 'round';
  const lw = 6 + E.lashes * 1.2;
  ctx.beginPath(); ctx.moveTo(L[0] - 2, L[1] + 1); ctx.quadraticCurveTo(ex, ey - h * 1.75, R[0] + 2, R[1] - 1); ctx.lineWidth = lw; ctx.stroke();
  if (E.shape === 'hooded') { ctx.beginPath(); ctx.moveTo(L[0], L[1] - h * 0.9); ctx.quadraticCurveTo(ex, ey - h * 2.1, R[0], R[1] - h * 0.9); ctx.lineWidth = 2.5; ctx.strokeStyle = c.skinSh; ctx.stroke(); ctx.strokeStyle = OL; }
  if (!far) {                                      // outer flick (+ lashes)
    const O = s > 0 ? R : L, fl = 7 + 3 * E.lashes;
    ctx.beginPath(); ctx.moveTo(O[0], O[1] - 2); ctx.lineTo(O[0] + s * fl, O[1] - 2 - fl * 0.8); ctx.lineWidth = 4; ctx.stroke();
    if (E.lashes > 0.5) { ctx.beginPath(); ctx.moveTo(ex + s * (w - 6), ey - h * 1.2); ctx.lineTo(ex + s * (w + 2), ey - h * 1.2 - 8); ctx.lineWidth = 3; ctx.stroke(); }
  }
  // lower lid: a short light stroke (a full ring would read as glasses on big round eyes)
  const ll = E.size > 1.1 || E.shape === 'round' ? 0.4 : 0.6;
  ctx.beginPath(); ctx.moveTo(ex - w * ll, ey + h * 0.85); ctx.quadraticCurveTo(ex, ey + h * 1.05, ex + w * ll, ey + h * 0.85); ctx.lineWidth = 2; ctx.stroke();
  if (F.age.bags > 0) { ctx.strokeStyle = shade(c.skin, -0.16 - 0.1 * F.age.bags); ctx.lineWidth = 1.5 + F.age.bags * 1.5; ctx.beginPath(); ctx.moveTo(ex - w * 0.45, ey + h * 1.3 + 6); ctx.quadraticCurveTo(ex + s * w * 0.1, ey + h * 1.3 + 10 + F.age.bags * 3, ex + s * w * 0.55, ey + h * 1.3 + 4); ctx.stroke(); }
  if (e.tears) { ctx.fillStyle = 'rgba(170,215,255,0.85)'; const ty = ey + 14 + ((t * 40 + s * 7) % 40); ctx.beginPath(); ctx.ellipse(ex - s * 6, ty, 4, 7, 0, 0, Math.PI * 2); ctx.fill(); }
  return { w, h };
}

/** one brow over an eye at (ex, ey). s = side; inner end toward the nose */
export function drawBrow(ctx, F, e, c, { ex, ey, w, s, eo, asym = 0, scale = 1, far = false }) {
  const B = F.brows, by = ey - 30 * F.eyes.size + e.browY + (eo > 1.1 ? -6 : 0) - asym * 8;
  const bi = (e.brow + B.tilt * 0.35) * 18 * (1 - asym * 1.6);
  const inner = [ex - s * w * 0.75 * (B.length - 1), by + bi + 2], outer = [ex + s * (w + 4) * B.length, by - bi * 0.5 - 2 + (B.tilt < 0 ? -B.tilt * 4 : 0)];
  ctx.beginPath(); ctx.moveTo(inner[0], inner[1]); ctx.quadraticCurveTo(ex + s * w * 0.2, by - (4 + 10 * B.arch) - bi * 0.2, outer[0], outer[1]);
  ctx.lineWidth = B.thick * scale * (far ? 0.85 : 1); ctx.strokeStyle = c.brow; ctx.lineCap = 'round'; ctx.stroke();
}

/** the front nose at x = nx */
export function drawNoseFront(ctx, F, c, nx, by) {
  const N = F.nose, z = N.size, top = by - 18 * N.length * z, tip = by;
  ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.lineCap = 'round';
  if (N.bridge > 0) { ctx.strokeStyle = c.skinSh; ctx.lineWidth = 2 + N.bridge; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(nx + s * 8, top - 14); ctx.lineTo(nx + s * 6 * (1 + N.bridge * 0.3), tip - 6); ctx.stroke(); } ctx.strokeStyle = OL; ctx.lineWidth = 3; }
  ctx.beginPath();
  switch (N.shape) {
    case 'button': ctx.arc(nx, tip - 4, 6 * z, 0.2, Math.PI - 0.2); ctx.stroke(); ctx.fillStyle = shade(c.skin, -0.45); circle(ctx, nx - 5 * z, tip - 1, 1.8); ctx.fill(); circle(ctx, nx + 5 * z, tip - 1, 1.8); ctx.fill(); return;
    case 'wide': ctx.moveTo(nx + 2, top); ctx.quadraticCurveTo(nx - 4, tip - 6, nx - 12 * z, tip - 2); ctx.quadraticCurveTo(nx, tip + 5, nx + 12 * z, tip - 2); ctx.stroke(); return;
    case 'hooked': ctx.moveTo(nx + 1, top - 8); ctx.quadraticCurveTo(nx + 7 * z, top + 6, nx + 2, tip + 4); ctx.quadraticCurveTo(nx - 3, tip + 2, nx - 6 * z, tip - 2); ctx.stroke(); return;
    case 'upturned': ctx.moveTo(nx + 2, top + 4); ctx.quadraticCurveTo(nx - 4, tip - 4, nx + 3, tip - 4); ctx.stroke(); ctx.fillStyle = shade(c.skin, -0.45); circle(ctx, nx - 4 * z, tip - 1, 2.2); ctx.fill(); circle(ctx, nx + 5 * z, tip - 1, 2.2); ctx.fill(); return;
    default: ctx.moveTo(nx + 2, top); ctx.quadraticCurveTo(nx - 5 * z, tip - 3, nx + 3, tip); ctx.stroke();
  }
}

/** age lines, cheekbones, chubby cheeks, chin cleft, marks — inside the face (front: m = identity; 3/4: m = mapping) */
export function faceDetails(ctx, F, c, g, m = (x) => x, fx = 0) {
  ctx.lineCap = 'round';
  if (F.age.forehead > 0) { ctx.strokeStyle = shade(c.skin, -0.14 - 0.08 * F.age.forehead); ctx.lineWidth = 1.5 + F.age.forehead; for (const y of [-866, -856]) { ctx.beginPath(); ctx.moveTo(m(-26) + fx, y); ctx.quadraticCurveTo(m(0) + fx, y - 3, m(26) + fx, y); ctx.stroke(); } }
  if (F.age.smile > 0) { ctx.strokeStyle = shade(c.skin, -0.14 - 0.08 * F.age.smile); ctx.lineWidth = 1.5 + F.age.smile; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(m(s * 14) + fx * 1.3, g.noseY - 2); ctx.quadraticCurveTo(m(s * 24) + fx * 1.3, g.mouthY - 10, m(s * 21) + fx * 1.3, g.mouthY + 2); ctx.stroke(); } }
  if (F.cheeks.bones > 0) { ctx.strokeStyle = c.skinSh; ctx.lineWidth = 2.5; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(m(s * (g.W - 6)) + fx, -792); ctx.lineTo(m(s * (g.W - 18)) + fx, -778 - F.cheeks.bones * 4); ctx.stroke(); } }
  if (F.cheeks.chubby > 0) { ctx.fillStyle = `rgba(220,120,120,${0.18 * F.cheeks.chubby})`; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(m(s * 38) + fx, -778, 16, 10, 0, 0, Math.PI * 2); ctx.fill(); } }
  if (F.chin.cleft) { ctx.strokeStyle = c.skinSh; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(m(0) + fx * 1.2, g.chinY - 12); ctx.lineTo(m(0) + fx * 1.2, g.chinY - 4); ctx.stroke(); }
  const M = F.marks;
  if (M.freckles > 0) { ctx.fillStyle = shade(c.skin, -0.35); const n = Math.round(6 + M.freckles * 12); for (let i = 0; i < n; i++) { const s = i % 2 ? 1 : -1, j = Math.floor(i / 2); circle(ctx, m(s * (20 + (j % 4) * 6)) + fx, -790 + (j % 3) * 5 + (j > 3 ? 4 : 0), 1.8); ctx.fill(); } }
  if (M.mole) { ctx.fillStyle = shade(c.skin, -0.6); circle(ctx, m(M.mole[0]) + fx, M.mole[1], 2.6); ctx.fill(); }
  if (M.bruise) { const b = M.bruise; ctx.fillStyle = 'rgba(110,70,140,0.35)'; ctx.beginPath(); ctx.ellipse(m(b.x) + fx, b.y, b.r || 12, (b.r || 12) * 0.7, 0, 0, Math.PI * 2); ctx.fill(); }
  if (M.scar) { const sc = M.scar, a = sc.angle || 0.6, L = sc.len || 18; ctx.strokeStyle = shade(c.skin, -0.3); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(m(sc.x) + fx, sc.y); ctx.lineTo(m(sc.x + Math.cos(a) * L) + fx, sc.y + Math.sin(a) * L); ctx.stroke(); }
}

/** the ears (front): returns nothing; earrings handled by the caller */
export function drawEarsFront(ctx, F, c, g, fx, turn, showSide = [-1, 1]) {
  for (const s of showSide) {
    if (turn * s > 0.45) continue;
    const ex = s * (g.W + 0 + F.ears.out * 7) + fx * 0.4;
    ctx.save(); ctx.translate(ex, -812); ctx.rotate(s * F.ears.out * 0.35);
    ctx.beginPath(); ctx.ellipse(0, 0, 11 * F.ears.size * (1 + F.ears.out * 0.25), 17 * F.ears.size, 0, 0, Math.PI * 2); ink(ctx, c.skin, 4);
    ctx.beginPath(); ctx.arc(s * 1, 0, 6 * F.ears.size, s > 0 ? -1.4 : 1.7, s > 0 ? 1.4 : 4.6); ctx.strokeStyle = c.skinSh; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.restore();
  }
}
export { lerp, clamp };
