// REAL-WORLD SCALE — one source of truth so doors, furniture and people keep their proportions in every shot.
// A figure drawn with scale k (= s · build.height) is 960·k px tall from the floor to the top of the hair, and an adult
// (build.height 1.0) is 1.75 m. So at actor scale s: 1 m = PPM · s px (PPM ≈ 548) — for an adult-height reference.
// Kids are NOT drawn smaller than their true height relative to the furniture: a 12-year-old is 0.80–0.86 · adult
// (1.40–1.50 m) next to a 2.05 m door, never half of it.
//
// A location module declares  meta.scale  (the actor scale s at meta.floor) and  meta.horizon (world y of the eye
// level / vanishing line). Everything on the actors' plane is then written in METRES:
//     const U = units(meta);            // U.h(2.05)            → px height of a 2.05 m door standing at meta.floor
//     U.h(0.9, 1500)                     // a 0.9 m dresser whose base is at world y 1500 (further away → smaller)
//     U.x(1.2)                           // a horizontal distance of 1.2 m at the floor line
// Props and furniture on the back wall get the perspective scale of THEIR floor line (floorY), never a number
// picked by eye. `check` compares marked objects (mark(…, {m})) with the characters in the shot.
export const ADULT_M = 1.75, FIG_PX = 960;                 // figure height in px at k = 1 (floor → top of hair)
export const PPM = FIG_PX / ADULT_M;                       // px per metre at k = 1

/** real-world sizes in metres (use these, do not invent) */
export const REAL = {
  adult: 1.75, teen: 1.62, kid: 1.45, kidSmall: 1.30,          // people (the cast's build.height × 1.75 gives the exact one)
  door: 2.05, doorWidth: 0.85, doorHandle: 1.0, interiorDoorFrame: 2.1, frontDoor: 2.1,
  window: [1.2, 1.1], windowSill: 0.9, ceiling: 2.5, stair: 0.18,
  dresser: 0.9, kitchenCounter: 0.9, table: 0.75, deskChair: 0.45, chair: 0.9, sofaSeat: 0.45, sofaBack: 0.85,
  bed: 0.55, bedHeadboard: 1.0, bookshelf: 1.8, fridge: 1.75, tv: 0.5, lamp: 1.5, tableLamp: 0.45,
  poster: [0.6, 0.9], posterBottom: 1.3, lightSwitch: 1.2, outlet: 0.3, wallPhone: 1.5,
  car: 1.45, bike: 1.0, bikeLength: 1.75, streetLamp: 4.5, tree: 7, fence: 1.2, mailbox: 1.1, locker: 1.8, schoolDesk: 0.75,
};

/** the true height of a cast spec in metres */
export const heightM = (S) => ADULT_M * (((S && S.build) || {}).height || 1);

/** perspective: scale of an object standing at world y (feet / base line) relative to the floor line.
 *  1 at meta.floor, → 0 at meta.horizon. */
export function depthK(meta, y) {
  const hor = meta.horizon ?? (meta.floor ?? 1700) - 450, fl = meta.floor ?? 1700;
  return Math.max(0.05, (y - hor) / Math.max(1, fl - hor));
}
/** the actor scale s (for drawCharacter, adult-height reference — drawCharacter multiplies by build.height itself)
 *  of a figure whose feet are at world y in this location */
export const actorScale = (meta, y) => (meta.scale ?? 0.62) * depthK(meta, y ?? meta.floor);

/** unit helpers for one location: U.h(metres, baseY) vertical px, U.x(metres, baseY) horizontal px at that depth */
export function units(meta) {
  const s0 = meta.scale ?? 0.62;
  return {
    s: (y) => s0 * depthK(meta, y ?? meta.floor),
    h: (m, y) => m * PPM * s0 * depthK(meta, y ?? meta.floor),
    x: (m, y) => m * PPM * s0 * depthK(meta, y ?? meta.floor),
    /** top y of an object `m` metres tall standing on world y */
    top: (m, y) => (y ?? meta.floor) - m * PPM * s0 * depthK(meta, y ?? meta.floor),
    meta,
  };
}

/** draw a faint scale ruler for the location sheet: metre ticks and a 1.75 m adult / 1.45 m kid outline at (x, baseY) */
export function ruler(c, meta, x, baseY, label = '') {
  const U = units(meta);
  c.save(); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,0.85)'; c.fillStyle = 'rgba(255,255,255,0.9)'; c.font = '700 22px Inter, Arial';
  for (let m = 0; m <= 2.5; m += 0.5) { const y = baseY - U.h(m, baseY); c.beginPath(); c.moveTo(x, y); c.lineTo(x + (m % 1 === 0 ? 34 : 20), y); c.stroke(); if (m % 1 === 0 || m === 0.5) c.fillText(m + ' m', x + 40, y + 7); }
  c.beginPath(); c.moveTo(x, baseY); c.lineTo(x, baseY - U.h(2.5, baseY)); c.stroke();
  for (const [m, dx, col] of [[ADULT_M, -70, '#FFD23F'], [1.45, -130, '#5EEAD4']]) { const y = baseY - U.h(m, baseY); c.strokeStyle = col; c.beginPath(); c.moveTo(x + dx - 18, y); c.lineTo(x + dx + 18, y); c.moveTo(x + dx, y); c.lineTo(x + dx, baseY); c.stroke(); }
  if (label) c.fillText(label, x - 140, baseY + 30);
  c.restore();
}

/** place a character IN a location at the right scale for its depth: drawCharacter(c, S, f.x, f.y, f.s, …) with
 *  const f = placeIn(diner.meta, T.CH.mike, { x: 540, y: 1700 })  — kids come out at their true size next to the door
 *  and furniture (drawCharacter multiplies by build.height itself). Use it for every full-body / wide shot. */
export const placeIn = (meta, S, o = {}) => { const y = o.y ?? meta.floor ?? 1700; return { x: o.x ?? 540, y, s: actorScale(meta, y) }; };
