// Reusable backgrounds as parallax layers. World space = the 1080×1920 frame; ground for full-body actors ≈ y 1700.
// Each set returns an array of layers for scene(ctx, cam, [...]):  [...sky('night'), ...city('night'), actors, ...]
// TIME: 'day' | 'sunset' | 'dusk' | 'night' | 'overcast' | 'storm'
import { L } from './scene.js';
import { OL, P, smooth, ink, circle, glow, hash, shade, mix, rgba } from './lib.js';

export const TIMES = {
  day:      { sky: ['#6FA8DC', '#A9CFEA', '#E6F0EA'], far: '#8DA6BF', mid: '#5F7590', win: 'rgba(255,255,255,0.15)', lit: 0.1, ground: '#6D7A5A', ambient: '#FFFFFF', sun: '#FFF6D8' },
  sunset:   { sky: ['#1E1B3A', '#4B3A6E', '#A0577A', '#F08A5D', '#FFC27A'], far: '#5B4170', mid: '#3A2A4E', win: 'rgba(255,200,130,0.8)', lit: 0.3, ground: '#3A2D44', ambient: '#FFB38A', sun: '#FFE2A8' },
  dusk:     { sky: ['#141632', '#2C2A5A', '#5A4A7E', '#9A6A8A'], far: '#3A3458', mid: '#26213F', win: 'rgba(255,205,140,0.85)', lit: 0.45, ground: '#2A2436', ambient: '#9A8ABE' },
  night:    { sky: ['#05060F', '#0E1330', '#1C2450', '#2B3263'], far: '#1D2240', mid: '#121530', win: 'rgba(255,210,140,0.9)', lit: 0.35, ground: '#16162A', ambient: '#5A6AAE', moon: '#E8ECF6' },
  overcast: { sky: ['#7D8794', '#A2AAB4', '#C3C8CE'], far: '#7C8592', mid: '#5E6672', win: 'rgba(255,240,200,0.25)', lit: 0.15, ground: '#5A6060', ambient: '#DDE2E8' },
  storm:    { sky: ['#14171F', '#262C38', '#3A4250', '#4A5260'], far: '#2A303C', mid: '#1C2029', win: 'rgba(255,220,160,0.6)', lit: 0.25, ground: '#1C1F26', ambient: '#8090A0' },
};
const tm = (time) => TIMES[time] || TIMES.day;

// ---------- sky ----------
export function sky(time = 'day', o = {}) {
  const T = tm(time), hor = o.horizon ?? 1300;
  const base = L(0, (c) => {
    const g = c.createLinearGradient(0, -400, 0, hor); T.sky.forEach((col, i) => g.addColorStop(i / (T.sky.length - 1), col));
    c.fillStyle = g; c.fillRect(-2000, -2000, 5080, hor + 2000); c.fillStyle = T.sky[T.sky.length - 1]; c.fillRect(-2000, hor, 5080, 3000);
    if (time === 'night' || time === 'dusk') for (let i = 0; i < 140; i++) { c.fillStyle = `rgba(255,255,255,${0.3 + 0.6 * hash(i * 3)})`; c.fillRect(-500 + hash(i) * 2100, -300 + hash(i * 7) * (hor - 400), 2 + hash(i * 5) * 2, 2 + hash(i * 5) * 2); }
  });
  const bodies = L(0.08, (c, t) => {
    if (T.sun && time !== 'overcast') { const y = time === 'sunset' ? hor - 110 : 420, r = time === 'sunset' ? 92 : 70; glow(c, o.sunX ?? 640, y, 420, time === 'sunset' ? '#FFAA66' : '#FFF6D8', 0.55); c.fillStyle = T.sun; circle(c, o.sunX ?? 640, y, r); c.fill(); }
    if (T.moon) { glow(c, o.moonX ?? 780, 360, 260, '#AFC3FF', 0.35); c.fillStyle = T.moon; circle(c, o.moonX ?? 780, 360, 64); c.fill(); c.fillStyle = 'rgba(160,170,200,0.35)'; circle(c, (o.moonX ?? 780) - 18, 345, 14); c.fill(); circle(c, (o.moonX ?? 780) + 20, 380, 9); c.fill(); }
    clouds(c, t, time);
  });
  return [base, bodies];
}
function clouds(c, t, time) {
  const col = { day: 'rgba(255,255,255,0.85)', sunset: 'rgba(122,82,130,0.55)', dusk: 'rgba(70,60,110,0.6)', night: 'rgba(40,46,80,0.6)', overcast: 'rgba(150,158,168,0.9)', storm: 'rgba(30,34,44,0.85)' }[time] || 'rgba(255,255,255,0.8)';
  const n = time === 'overcast' || time === 'storm' ? 9 : 5;
  for (let i = 0; i < n; i++) {
    const s = 0.8 + hash(i * 11) * 0.6, x = -300 + hash(i * 13) * 1700 + t * 12 * s, y = 250 + hash(i * 17) * 700;
    c.fillStyle = col; c.beginPath(); c.ellipse(x, y, 190 * s, 34 * s, 0, 0, 7); c.ellipse(x + 90 * s, y - 22 * s, 110 * s, 30 * s, 0, 0, 7); c.ellipse(x - 80 * s, y + 8 * s, 120 * s, 22 * s, 0, 0, 7); c.fill();
  }
}

// ---------- city ----------
function skyline(c, base, hMin, hMax, col, winCol, lit, seed, wMin, wMax) {
  let x = -900, i = 0;
  while (x < 2000) {
    const w = wMin + hash(seed + i) * (wMax - wMin), h = hMin + hash(seed + i * 7.3) * (hMax - hMin);
    c.fillStyle = col; c.fillRect(x, base - h, w + 1, h + 1200);
    if (hash(seed + i * 3.1) > 0.6) c.fillRect(x + w * 0.4, base - h - 40, 6, 40);
    if (hash(seed + i * 5.7) > 0.5) c.fillRect(x + w * 0.1, base - h - 18, w * 0.4, 18);
    const cols = Math.floor(w / 26), rows = Math.floor(h / 34);
    for (let r = 1; r < rows; r++) for (let k = 0; k < cols; k++) {
      const on = hash(seed * 3 + i * 101 + r * 13 + k) < lit; c.fillStyle = on ? winCol : 'rgba(0,0,0,0.18)'; c.fillRect(x + 8 + k * 26, base - h + r * 34, 12, 18);
    }
    x += w + 6 + hash(seed + i * 2.2) * 20; i++;
  }
}
function haze(c, y, color, a) { const g = c.createLinearGradient(0, y - 200, 0, y + 40); g.addColorStop(0, rgba(color, 0)); g.addColorStop(1, rgba(color, a)); c.fillStyle = g; c.fillRect(-1000, y - 200, 3080, 240); }
export function city(time = 'day', o = {}) {
  const T = tm(time), hz = T.sky[T.sky.length - 1];
  return [
    L(0.25, (c) => { skyline(c, o.farBase ?? 1300, 140, 330, T.far, T.win, T.lit * 0.8, 3, 60, 130); haze(c, o.farBase ?? 1300, hz, 0.45); }, { blur: o.blur ? o.blur * 0.6 : 0 }),
    L(0.5, (c) => { skyline(c, o.midBase ?? 1440, 220, 560, T.mid, T.win, T.lit, 11, 110, 210); haze(c, o.midBase ?? 1440, hz, 0.22); }, { blur: o.blur || 0 }),
  ];
}
export function rooftop(time = 'sunset') {
  const T = tm(time);
  return L(0.85, (c) => {
    c.fillStyle = shade(T.ground, 0.05); c.fillRect(-900, 1480, 2900, 900);
    c.fillStyle = shade(T.ground, 0.15); c.fillRect(-900, 1420, 2900, 62); c.strokeStyle = OL; c.lineWidth = 4; c.strokeRect(-900, 1420, 2900, 62);
    c.fillStyle = rgba(T.ambient, 0.3); c.fillRect(-900, 1420, 2900, 6);
    c.strokeStyle = 'rgba(20,10,30,0.35)'; c.lineWidth = 2; for (let k = -14; k < 26; k++) { c.beginPath(); c.moveTo(540 + k * 40, 1488); c.lineTo(540 + k * 160, 2300); c.stroke(); }
    c.fillStyle = shade(T.mid, -0.1); c.fillRect(70, 1180, 150, 240); c.strokeRect(70, 1180, 150, 240); c.beginPath(); c.moveTo(60, 1180); c.lineTo(145, 1120); c.lineTo(230, 1180); c.closePath(); c.fill(); c.stroke();
  });
}
export function railing(time = 'sunset') {
  const T = tm(time);
  return L(1.5, (c) => {
    c.fillStyle = '#17111C'; c.fillRect(-400, 1790, 1900, 26); c.fillRect(-400, 1880, 1900, 300); for (let k = -4; k < 14; k++) c.fillRect(k * 120, 1790, 16, 120);
    c.fillStyle = rgba(T.ambient, 0.25); c.fillRect(-400, 1790, 1900, 5);
  });
}

// ---------- suburban street ----------
export function street(time = 'day', o = {}) {
  const T = tm(time), night = time === 'night' || time === 'dusk' || time === 'storm';
  const house = (c, x, base, w, h, col, seed) => {
    P(c, [[x, base], [x, base - h], [x + w / 2, base - h - w * 0.35], [x + w, base - h], [x + w, base]]); ink(c, col, 4);
    P(c, [[x - 12, base - h], [x + w / 2, base - h - w * 0.38 - 8], [x + w + 12, base - h], [x + w / 2, base - h - w * 0.3]]); ink(c, shade(col, -0.4), 4);
    for (let k = 0; k < 2; k++) { const wx = x + w * (0.18 + k * 0.46), on = night && hash(seed + k) > 0.35; P(c, [[wx, base - h * 0.75], [wx + w * 0.2, base - h * 0.75], [wx + w * 0.2, base - h * 0.42], [wx, base - h * 0.42]]); ink(c, on ? '#FFD38A' : shade(T.sky[1], -0.2), 3); if (on) glow(c, wx + w * 0.1, base - h * 0.6, 90, '#FFC46A', 0.35); }
    P(c, [[x + w * 0.42, base], [x + w * 0.42, base - h * 0.34], [x + w * 0.58, base - h * 0.34], [x + w * 0.58, base]]); ink(c, shade(col, -0.5), 3);
  };
  const tree = (c, x, base, s, col) => { c.fillStyle = shade(col, -0.45); c.fillRect(x - 10 * s, base - 140 * s, 20 * s, 140 * s); smooth(c, [[x - 90 * s, base - 140 * s], [x - 70 * s, base - 260 * s], [x, base - 320 * s], [x + 70 * s, base - 260 * s], [x + 90 * s, base - 140 * s], [x, base - 110 * s]], true, 0.6); ink(c, col, 4); };
  const leaf = night ? '#1E3A2E' : time === 'sunset' ? '#3E5A3A' : '#4F7A45';
  return [...(o.sky === false ? [] : sky(time, { horizon: 1400 })),
    L(0.3, (c) => { for (let i = 0; i < 9; i++) tree(c, -400 + i * 260 + hash(i) * 80, 1330, 0.7 + hash(i * 3) * 0.3, shade(leaf, -0.25)); }, { blur: o.blur ? 2 : 0 }),
    L(0.55, (c) => { const cols = ['#C9B79A', '#9FB0B8', '#B98E7A', '#D8CBB0', '#A7A27E']; for (let i = 0; i < 6; i++) house(c, -500 + i * 360, 1420, 260, 190, night ? shade(cols[i % 5], -0.55) : cols[i % 5], i); for (let i = 0; i < 6; i++) tree(c, -300 + i * 380, 1440, 0.9, leaf); }, { blur: o.blur || 0 }),
    L(0.85, (c) => {
      c.fillStyle = night ? '#2A2C34' : '#9A9A92'; c.fillRect(-900, 1440, 2900, 90); c.strokeStyle = OL; c.lineWidth = 4; c.strokeRect(-900, 1440, 2900, 90);
      c.fillStyle = night ? '#1C1D24' : '#4A4C50'; c.fillRect(-900, 1530, 2900, 900);
      c.fillStyle = night ? '#8A8460' : '#E8DFAA'; for (let k = -6; k < 12; k++) c.fillRect(k * 220, 1700, 120, 12);
      for (let k = -2; k < 5; k++) { const x = k * 520 + 100; c.fillStyle = '#2A2830'; c.fillRect(x, 1160, 12, 290); c.fillRect(x - 40, 1160, 52, 10); if (night) { glow(c, x - 34, 1172, 260, '#FFC46A', 0.4); c.fillStyle = '#FFE3A8'; circle(c, x - 34, 1174, 9); c.fill(); } }
    }),
  ];
}

// ---------- interior room ----------
// room({wall, floor, window: 'night'|…|null, door: true, furniture: ['bed','desk','lamp','shelf','sofa','poster','tv']})
export function room(o = {}) {
  const wall = o.wall || '#7C8496', floor = o.floor || '#7A5A40', win = o.window === undefined ? 'night' : o.window, F = o.furniture || ['bed', 'desk', 'lamp', 'poster'];
  const dark = o.dark ? 0.5 : 0;
  return [
    L(0.0, (c) => { c.fillStyle = shade(wall, -0.15 - dark); c.fillRect(-900, -900, 2900, 3800); }),
    L(0.55, (c, t) => {
      c.fillStyle = shade(wall, -dark); c.fillRect(-900, 500, 2900, 1080); c.strokeStyle = OL; c.lineWidth = 4;
      c.fillStyle = shade(wall, -0.2 - dark); c.fillRect(-900, 1500, 2900, 40); // skirting
      if (win) { const T = tm(win); const g = c.createLinearGradient(0, 760, 0, 1180); T.sky.forEach((col, i) => g.addColorStop(i / (T.sky.length - 1), col)); P(c, [[620, 760], [900, 760], [900, 1180], [620, 1180]]); c.fillStyle = g; c.fill(); c.stroke();
        c.fillStyle = shade(wall, -0.35); c.fillRect(756, 760, 8, 420); c.fillRect(620, 966, 280, 8); c.strokeRect(612, 752, 296, 436);
        if (T.moon) { c.fillStyle = T.moon; circle(c, 840, 830, 26); c.fill(); } }
      if (o.door !== false) { P(c, [[90, 1500], [90, 1020], [300, 1020], [300, 1500]]); ink(c, shade('#6E5A48', -dark), 5); circle(c, 270, 1270, 9); ink(c, '#D8B878', 3); }
      if (F.includes('poster')) { P(c, [[380, 820], [540, 820], [540, 1040], [380, 1040]]); ink(c, shade('#B84A4A', -dark), 4); c.fillStyle = rgba('#FFE8C8', 0.6); circle(c, 460, 900, 40); c.fill(); }
      if (F.includes('shelf')) { c.fillStyle = shade('#80603F', -dark); c.fillRect(-60, 900, 160, 14); c.strokeRect(-60, 900, 160, 14); for (let k = 0; k < 6; k++) { P(c, [[-50 + k * 24, 900], [-50 + k * 24, 840 - (k % 3) * 10], [-30 + k * 24, 840 - (k % 3) * 10], [-30 + k * 24, 900]]); ink(c, ['#B84A4A', '#3B4A6B', '#C8952F', '#3E6A4C'][k % 4], 3); } }
    }),
    L(0.8, (c, t) => {
      c.fillStyle = shade(floor, -dark); c.fillRect(-900, 1540, 2900, 900);
      c.strokeStyle = rgba('#000000', 0.25); c.lineWidth = 3; for (let k = 0; k < 8; k++) { c.beginPath(); c.moveTo(-900, 1580 + k * 60); c.lineTo(2000, 1580 + k * 60); c.stroke(); }
      if (F.includes('bed')) { P(c, [[-200, 1640], [-200, 1450], [380, 1450], [380, 1640]]); ink(c, shade('#4B5A7A', -dark)); P(c, [[-200, 1480], [-200, 1380], [-140, 1380], [-140, 1480]]); ink(c, shade('#80603F', -dark)); smooth(c, [[-120, 1450], [-110, 1415], [40, 1410], [60, 1450]], true, 0.4); ink(c, shade('#E8DCCB', -dark)); }
      if (F.includes('sofa')) { P(c, [[-160, 1640], [-160, 1420], [420, 1420], [420, 1640]]); ink(c, shade('#3E6A4C', -dark)); P(c, [[-130, 1520], [390, 1520], [390, 1580], [-130, 1580]]); ink(c, shade('#3E6A4C', 0.12 - dark)); }
      if (F.includes('desk')) { P(c, [[640, 1430], [1000, 1430], [1000, 1460], [640, 1460]]); ink(c, shade('#80603F', -dark)); c.fillStyle = shade('#5E4430', -dark); c.fillRect(660, 1460, 20, 180); c.fillRect(960, 1460, 20, 180); c.strokeRect(660, 1460, 20, 180); c.strokeRect(960, 1460, 20, 180); }
      if (F.includes('tv')) { P(c, [[660, 1250], [960, 1250], [960, 1420], [660, 1420]]); ink(c, '#1A1A22'); c.fillStyle = rgba('#8AB4FF', 0.35 + 0.1 * Math.sin(t * 9)); c.fillRect(672, 1262, 276, 146); }
      if (F.includes('lamp')) { const on = !o.dark; c.fillStyle = '#2A2028'; c.fillRect(905, 1330, 10, 100); P(c, [[870, 1340], [950, 1340], [930, 1280], [890, 1280]]); ink(c, on ? '#F0B15A' : '#6A5A4A', 4); if (on) glow(c, 910, 1320, 320, '#FFC46A', 0.35); }
    }),
  ];
}

// ---------- forest ----------
export function forest(time = 'night', o = {}) {
  const T = tm(time), leaf = time === 'day' ? '#3E6A4C' : time === 'sunset' ? '#3A3A48' : '#141E26';
  const pineSky = o.sky === false ? [] : sky(time, { horizon: 1420 });
  const pine = (c, x, base, s, col) => { c.fillStyle = shade(col, -0.3); c.fillRect(x - 8 * s, base - 80 * s, 16 * s, 80 * s); for (let k = 0; k < 4; k++) { const y = base - 70 * s - k * 70 * s, w = (110 - k * 22) * s; P(c, [[x - w, y], [x, y - 120 * s], [x + w, y]]); ink(c, col, 3); } };
  return [...pineSky,
    L(0.2, (c) => { for (let i = 0; i < 18; i++) pine(c, -600 + i * 140 + hash(i) * 60, 1340, 0.8 + hash(i * 2) * 0.4, mix(leaf, T.sky[T.sky.length - 1], 0.55)); }, { blur: 2 }),
    L(0.45, (c) => { for (let i = 0; i < 12; i++) pine(c, -700 + i * 210 + hash(i * 5) * 80, 1450, 1.2 + hash(i * 3) * 0.5, mix(leaf, T.sky[T.sky.length - 1], 0.25)); haze(c, 1450, T.sky[T.sky.length - 1], o.fog ?? 0.35); }, { blur: o.blur || 0 }),
    L(0.85, (c) => { c.fillStyle = shade(T.ground, -0.1); c.fillRect(-900, 1500, 2900, 900); for (let i = 0; i < 40; i++) { c.fillStyle = shade(leaf, 0.1 * hash(i)); c.beginPath(); c.ellipse(-800 + hash(i * 9) * 2700, 1520 + hash(i * 4) * 400, 40, 10, 0, 0, 7); c.fill(); } }),
  ];
}
export function trunks(time = 'night') { return L(1.45, (c) => { c.fillStyle = '#0D0A10'; c.fillRect(-120, -200, 150, 2400); c.fillRect(1010, -200, 190, 2400); c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(20, -200, 8, 2400); }); }

// ---------- school hallway (one-point perspective) ----------
export function hallway(o = {}) {
  const wall = o.wall || '#A9B3A8', lock = o.lockers || '#3B4A6B', vy = 1180, vx = 540;
  return [
    L(0.0, (c) => { c.fillStyle = shade(wall, -0.2); c.fillRect(-900, -900, 2900, 3800); }),
    L(0.6, (c) => {
      c.fillStyle = shade(wall, 0.1); P(c, [[-900, 200], [vx - 160, vy - 220], [vx + 160, vy - 220], [1980, 200]]); c.fill();
      c.fillStyle = shade(wall, -0.05); P(c, [[vx - 160, vy - 220], [vx + 160, vy - 220], [vx + 160, vy + 120], [vx - 160, vy + 120]]); c.fill(); c.strokeStyle = OL; c.lineWidth = 4; c.stroke();
      for (const s of [-1, 1]) {
        c.fillStyle = shade(wall, -0.1); P(c, [[vx + s * 160, vy - 220], [s < 0 ? -900 : 1980, 200], [s < 0 ? -900 : 1980, 2100], [vx + s * 160, vy + 120]]); c.fill(); c.stroke();
        for (let k = 0; k < 9; k++) { const u0 = k / 9, u1 = (k + 0.85) / 9, f = (u) => [vx + s * (160 + u ** 1.6 * 1300), vy - 200 - u ** 1.6 * 1100, vy + 60 + u ** 1.6 * 520];
          const [x0, t0, b0] = f(u0), [x1, t1, b1] = f(u1); P(c, [[x0, t0], [x1, t1], [x1, b1], [x0, b0]]); ink(c, shade(lock, -0.15 + (k % 2) * 0.08), 3); }
      }
      for (let k = 0; k < 5; k++) { const u = k / 5, y = vy - 220 - u ** 1.6 * 1300; c.fillStyle = 'rgba(255,255,240,0.75)'; c.fillRect(vx - 60 - u * 260, y, 120 + u * 520, 16 + u * 30); }
    }),
    L(0.85, (c) => { c.fillStyle = o.floor || '#8C8A7E'; P(c, [[vx - 160, vy + 120], [vx + 160, vy + 120], [2300, 2100], [-1200, 2100]]); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = 3; for (let k = -6; k <= 6; k++) { c.beginPath(); c.moveTo(vx + k * 26, vy + 120); c.lineTo(vx + k * 380, 2100); c.stroke(); } }),
  ];
}

// ---------- dramatic void (emotional close-ups, inner monologue, flashbacks) ----------
export function voidBg(c1 = '#2A0F1E', c2 = '#6E1B2E', o = {}) {
  return [L(0, (c, t) => {
    const g = c.createRadialGradient(540, 900, 50, 540, 960, 1300); g.addColorStop(0, c2); g.addColorStop(1, c1); c.fillStyle = g; c.fillRect(-900, -900, 2900, 3800);
    if (o.rays) { c.save(); c.translate(540, 900); c.rotate(t * 0.05); c.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 16; i++) { c.rotate(Math.PI / 8); c.beginPath(); c.moveTo(0, 0); c.lineTo(1800, -120); c.lineTo(1800, 120); c.fill(); } c.restore(); }
  })];
}

// ---------- weather & particles (put them in front: f ≈ 1.2) ----------
export function rain(amount = 1, f = 1.2) { return L(f, (c, t) => { c.strokeStyle = 'rgba(190,210,255,0.45)'; c.lineWidth = 2.5; for (let i = 0; i < 160 * amount; i++) { const x = (hash(i) * 2400 - 600 + t * 120) % 2400 - 600, y = ((hash(i * 3) * 2600 + t * 2400) % 2600) - 400; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 10, y + 60); c.stroke(); } }); }
export function snow(amount = 1, f = 1.1) { return L(f, (c, t) => { c.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 140 * amount; i++) { const x = -300 + hash(i) * 1700 + Math.sin(t + i) * 30, y = ((hash(i * 7) * 2400 + t * (60 + hash(i * 2) * 80)) % 2400) - 300; circle(c, x, y, 2 + hash(i * 5) * 4); c.fill(); } }); }
export function fog(color = '#B8C0D0', a = 0.35, f = 1.0) { return L(f, (c, t) => { for (let i = 0; i < 6; i++) { const x = -600 + ((hash(i) * 2000 + t * 25 * (1 + i % 3)) % 2600), y = 1300 + hash(i * 3) * 500; const g = c.createRadialGradient(x, y, 0, x, y, 600); g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, 0)); c.fillStyle = g; c.fillRect(x - 600, y - 600, 1200, 1200); } }); }
export function motes(color = '#FFD296', n = 28, f = 1.1) { return L(f, (c, t) => { for (let i = 0; i < n; i++) { const x = (hash(i) * 1400 + t * (20 + hash(i * 3) * 30)) % 1400 - 160, y = 300 + hash(i * 7) * 1300 + Math.sin(t + i) * 20; c.fillStyle = rgba(color, 0.25 + 0.4 * hash(i * 9)); circle(c, x, y, 2 + 3 * hash(i * 5)); c.fill(); } }); }
export function lightning(lt, at = [], f = 0) { return L(f, (c) => { for (const t0 of at) if (lt > t0 && lt < t0 + 0.18) { c.fillStyle = `rgba(220,230,255,${0.7 * (1 - (lt - t0) / 0.18)})`; c.fillRect(-900, -900, 2900, 3800); } }); }
