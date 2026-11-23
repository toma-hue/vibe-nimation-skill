// PROPS — objects a series keeps coming back to. new_short copies the series' own props.js
// (Vibe-nimation episodes/_Locatii/<Series>/props.js) over this default; start one by copying this file there.
// Every prop: name(ctx, x, y, s, o) — (x, y) = where it touches the floor / wall anchor, s = scale (1 ≈ next to an
// adult at wide-shot scale 1), drawn in the kit's style, and it registers itself for the framing check with mark().
import { OL, P, smooth, ink, shade, glow, circle, rgba } from './core/lib.js';
import { mark } from './core/scene.js';
import { drawCharacter, getPose, project, palette } from './core/rig.js';

// ---------- a bike, modelled in 3D and projected into the view (front, 3/4, profile, back, 3/4 from behind) ----------
// Units: the rider's body units (a character is ~960 tall; hips 430). x forward, y up (ground 0), z to the rider's right.
const BIKE = { R: 152, rear: [-285, 152, 0], front: [285, 152, 0], bb: [70, 175, 0], crank: 90, seat: [0, 400, 0],
  seatTop: [20, 380, 0], head: [245, 525, 0], headLow: [262, 455, 0], bar: [232, 600, 0], grip: 150, pedalZ: 80 };
const RIDE_LIFT = 50;                                     // the rider's hips (430) sit on the saddle (≈480 above ground)
function bikeParts(o) {
  const B = BIKE, a = o.pedal || 0, roll = o.roll ?? a * 2.2, col = o.color || '#B8322E', parts = [];
  const tube = (p, q, w, c, extra = {}) => parts.push({ kind: 'tube', p, q, w, c, ...extra });
  for (const [hub, nm] of [[B.rear, 'rear'], [B.front, 'front']]) parts.push({ kind: 'wheel', hub, R: B.R, roll, nm });
  // frame: chain/seat stays, seat tube, top + down tube, head tube, fork, stem, seat post
  tube(B.bb, B.rear, 12, col); tube(B.seatTop, B.rear, 11, col); tube(B.bb, B.seatTop, 15, col);
  tube(B.seatTop, B.head, 15, col); tube(B.bb, B.headLow, 16, col); tube(B.headLow, B.head, 18, col);
  for (const z of [-22, 22]) tube([B.headLow[0], B.headLow[1], z * 0.4], [B.front[0], B.front[1], z], 11, col);
  tube(B.head, B.bar, 12, '#9A9590'); tube(B.seatTop, B.seat, 10, '#9A9590');
  parts.push({ kind: 'saddle' });
  // handlebar + grips
  tube([B.bar[0], B.bar[1], -B.grip + 30], [B.bar[0], B.bar[1], B.grip - 30], 11, '#B9B4AE');
  for (const sd of [-1, 1]) tube([B.bar[0], B.bar[1], sd * (B.grip - 34)], [B.bar[0], B.bar[1], sd * (B.grip + 22)], 20, '#2A2628', { grip: sd });
  // chainring (right side), cranks and pedals — opposite each other
  parts.push({ kind: 'ring', c: [B.bb[0], B.bb[1], 30] });
  for (const sd of [-1, 1]) {
    const ang = a + (sd > 0 ? 0 : Math.PI), pd = [B.bb[0] + Math.cos(ang) * B.crank, B.bb[1] + Math.sin(ang) * B.crank, sd * B.pedalZ];
    tube([B.bb[0], B.bb[1], sd * 32], [pd[0], pd[1], sd * 32], 10, '#8E8984', { pedal: true });
    tube([pd[0], pd[1], sd * (B.pedalZ - 28)], [pd[0], pd[1], sd * (B.pedalZ + 26)], 18, '#2A2628', { pedal: true });
  }
  return parts;
}
/** where the rider's hands, feet and hips go for a pedal angle (body units, for pose.ik) */
export function bikeTargets(pedal = 0) {
  const B = BIKE, up = (p) => [p[0], p[1] - RIDE_LIFT, p[2]];
  const pd = (sd) => { const ang = pedal + (sd > 0 ? 0 : Math.PI); return up([B.bb[0] + Math.cos(ang) * B.crank - 10, B.bb[1] + Math.sin(ang) * B.crank + 18, sd * B.pedalZ]); };
  // pose.ik keys: L / legL are on the rider's right (+z), R / legR on the left (−z)
  return { L: up([B.bar[0] - 30, B.bar[1] - 10, B.grip - 4]), R: up([B.bar[0] - 30, B.bar[1] - 10, -B.grip + 4]), legL: pd(1), legR: pd(-1) };
}
function drawBikePart(ctx, q, th, lift, ol) {
  const P3 = (v) => { const r = project(v, th); return [r[0], r[1] + lift]; };
  if (q.kind === 'tube') {
    const a = P3(q.p), b = P3(q.q); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b);
    ctx.strokeStyle = OL; ctx.lineWidth = q.w + 8; ctx.stroke(); ctx.strokeStyle = q.c; ctx.lineWidth = q.w; ctx.stroke();
  } else if (q.kind === 'wheel') {
    const ring = (r, z = 0) => { ctx.beginPath(); for (let k = 0; k <= 40; k++) { const f = k / 40 * Math.PI * 2, p = P3([q.hub[0] + Math.cos(f) * r, q.hub[1] + Math.sin(f) * r, q.hub[2] + z]); k ? ctx.lineTo(...p) : ctx.moveTo(...p); } };
    ring(q.R); ctx.strokeStyle = OL; ctx.lineWidth = 30; ctx.stroke(); ctx.strokeStyle = '#3A3638'; ctx.lineWidth = 20; ctx.stroke();
    ring(q.R - 16); ctx.strokeStyle = '#8E8984'; ctx.lineWidth = 4; ctx.stroke();
    ctx.strokeStyle = 'rgba(214,208,200,0.8)'; ctx.lineWidth = 2.5;
    for (let k = 0; k < 9; k++) { const f = q.roll + k / 9 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(...P3(q.hub)); ctx.lineTo(...P3([q.hub[0] + Math.cos(f) * (q.R - 18), q.hub[1] + Math.sin(f) * (q.R - 18), q.hub[2]])); ctx.stroke(); }
    const hb = P3(q.hub); circle(ctx, hb[0], hb[1], 11); ink(ctx, '#C9C4BC', 3);
  } else if (q.kind === 'saddle') {
    const S0 = BIKE.seat, pts = [[-62, -24], [30, -12], [58, 0], [30, 12], [-62, 24]].map(([dx, dz]) => P3([S0[0] + dx, S0[1] + 12, dz]));
    const top = pts.map((p) => [p[0], p[1]]), bot = pts.map((p) => [p[0], p[1] + 18]);
    P(ctx, [...top, ...bot.reverse()]); ink(ctx, '#2A2628', 4);
    P(ctx, top); ink(ctx, '#3C3739', 3);
  } else if (q.kind === 'ring') {
    ctx.beginPath(); for (let k = 0; k <= 30; k++) { const f = k / 30 * Math.PI * 2, p = P3([q.c[0] + Math.cos(f) * 46, q.c[1] + Math.sin(f) * 46, q.c[2]]); k ? ctx.lineTo(...p) : ctx.moveTo(...p); }
    ctx.strokeStyle = OL; ctx.lineWidth = 12; ctx.stroke(); ctx.strokeStyle = '#8E8984'; ctx.lineWidth = 6; ctx.stroke();
  }
}
const partDepth = (q, th) => { const m = q.kind === 'tube' ? q.p.map((v, i) => (v + q.q[i]) / 2) : q.kind === 'wheel' ? q.hub : q.kind === 'ring' ? q.c : BIKE.seat; return project(m, th)[2]; };
/** split the bike into the parts behind the rider, inside (between the legs) and in front of the rider, for this view */
function bikeLayers(o, th) {
  const L = { before: [], between: [], after: [] };
  for (const q of bikeParts(o)) {
    const d = partDepth(q, th); q.d = d;
    let g = d < -60 ? 'before' : d > 60 ? 'after' : 'between';
    if (q.pedal && g === 'after') g = 'between';          // a pedal is under the shoe, never over it
    L[g].push(q);
  }
  for (const k in L) L[k].sort((a, b) => a.d - b.d);
  return L;
}
function bikeBox(th, lift) { const xs = [], ys = []; for (const v of [BIKE.rear, BIKE.front]) for (const dy of [-BIKE.R, BIKE.R]) for (const dz of [-BIKE.grip, BIKE.grip]) { const r = project([v[0], v[1] + dy, dz], th); xs.push(r[0]); ys.push(r[1] + lift); } const b = project([BIKE.bar[0], BIKE.bar[1], 0], th); ys.push(b[1] + lift - 20); return [Math.min(...xs) - 20, Math.min(...ys), Math.max(...xs) + 20, Math.max(...ys) + 16]; }

/** a bike on its own (parked, pushed, lying): o.turn (−1..1, 1 = side view facing right, default) / o.back, o.color,
 *  o.pedal (crank angle), o.lean (tilt, rad). s = the scale of the character it belongs to × their build.height */
export function bike(ctx, x, y, s = 1, o = {}) {
  const turn = o.turn ?? 1, th = o.back ? 180 - 90 * turn : 90 * turn;
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (o.flip ? -1 : 1), s); if (o.lean) ctx.rotate(o.lean);
  if (o.shadow !== false) { const b = bikeBox(th, 0); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse((b[0] + b[2]) / 2, 0, (b[2] - b[0]) / 2, 22, 0, 0, Math.PI * 2); ctx.fill(); }
  const parts = bikeParts(o).map((q) => ({ q, d: partDepth(q, th) })).sort((a, b) => a.d - b.d);
  for (const { q } of parts) drawBikePart(ctx, q, th, 0);
  const b = bikeBox(th, 0); mark(ctx, o.name || 'bike', ...b);
  ctx.restore();
}

/** a character riding a bike, correct in every view: rideBike(ctx, CH.mike, x, y, s, { turn, back, pedal, expr, … })
 *  (x, y) = the ground under the bike. The bike's parts are depth-sorted around the rider for the view: riding toward the
 *  camera (turn 0) the front wheel, fork and handlebar are in front of the body, the rear wheel shows behind the legs;
 *  riding away (back) it is the other way round; in profile the frame sits between the far and the near leg.
 *  o.pedal = crank angle (rad) — animate it: pedal: t * 7. Other options go to drawCharacter. */
export function rideBike(ctx, S, x, y, s = 1, o = {}) {
  const h = (S.build || {}).height || 1, k = s * h, pedal = o.pedal ?? 0, lift = RIDE_LIFT;
  const base = getPose('idle');
  const pose = { ...base, ik: bikeTargets(pedal), fixed: true };
  if (o.shadow !== false) {
    const turn = o.turn || 0, th = o.back ? 180 - 90 * turn : 90 * turn, b = bikeBox(th, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(x + (b[0] + b[2]) / 2 * k, y, (b[2] - b[0]) / 2 * k, 22 * k, 0, 0, Math.PI * 2); ctx.fill();
  }
  let layers = null, skin = palette(S).skin;
  const layer = (name) => (c, th) => {
    if (!layers) layers = bikeLayers({ ...o, pedal }, th);
    for (const q of layers[name]) drawBikePart(c, q, th, lift);
    if (name === 'after') for (const q of layers.after) if (q.grip) {   // the fists close over the grips in front
      const g = project([BIKE.bar[0], BIKE.bar[1], q.grip * (BIKE.grip - 10)], th); circle(c, g[0], g[1] + lift, 24); ink(c, skin, 4);
    }
    if (name === 'after') mark(c, o.name || 'bike', ...bikeBox(th, lift));
  };
  drawCharacter(ctx, S, x, y - lift * k, s, { ...o, pose, shadow: false, before: layer('before'), between: layer('between'), after: layer('after') });
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

/** a walkie-talkie held at (x, y) (its bottom); o.led on/off, o.backSide = seen from behind (no grille, belt clip) */
export function walkie(ctx, x, y, s = 1, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(o.angle || 0);
  P(ctx, [[-22, -110], [22, -110], [22, 0], [-22, 0]]); ink(ctx, o.color || '#2A2A30');
  ctx.fillStyle = OL; ctx.fillRect(o.backSide ? -15 : 8, -170, 7, 62);              // the antenna swaps sides from behind
  if (o.backSide) { P(ctx, [[-10, -96], [10, -96], [10, -40], [-10, -40]]); ink(ctx, shade(o.color || '#2A2A30', 0.18), 3); }
  else {
    for (let k = 0; k < 5; k++) { ctx.fillStyle = shade(o.color || '#2A2A30', 0.25); ctx.fillRect(-14, -96 + k * 9, 28, 4); }
    if (o.led) { glow(ctx, -12, -48, 22, '#FF4A3A', 0.6); } circle(ctx, -12, -48, 4); ink(ctx, o.led ? '#FF6A5A' : '#5A2A2A', 2);
  }
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

/** put a prop in a character's hand: drawCharacter(ctx, S, x, y, s, { pose: 'point', hold: { R: held(flashlight, { alongArm: true }) } })
 *  The prop is drawn right after that arm, at the hand, in the character's own units (s 1 ≈ the size next to them):
 *  it turns, mirrors and hides with the hand (from behind, a hand in front of the body hides it), and it is told
 *  backSide in back views. o.alongArm = point along the forearm (flashlight, gun, stick); o.dx/o.dy nudge it into the fist. */
export function held(fn, o = {}) {
  return (ctx, hand, ang, v) => fn(ctx, hand[0] + (o.dx || 0), hand[1] + (o.dy ?? (o.alongArm ? 0 : 40)), o.s || 1,
    { ...o, angle: o.alongArm ? ang : o.angle || 0, backSide: v.back });
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
