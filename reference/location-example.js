// LOCATION MODULE — the model for every place re-created from an episode (copy, rename, redraw).
// Lives in: Vibe-nimation episodes/_Locatii/<Series>/<id>.js  (+ refs/<id>_1.jpg … the episode stills it copies)
// Used in a short as:  import * as diner from './sets/diner.js';
//   scene(c, cam, [...diner.layers({ time: 'night' }), L(0.85, actors), ...diner.front()], t)
// World space = the 9:16 frame (1080×1920) but wider: draw from x −900 to 2000 so the camera can pan.
// meta.floor = the y where full-body actors stand. meta.plate = the 16:9 window compared with the still on the sheet.
import { L } from '../core/scene.js';
import { OL, P, smooth, ink, shade, glow, circle, rgba, hash } from '../core/lib.js';

export const meta = {
  id: 'diner', name: 'Benny\'s diner — interior', series: 'Example', seen: 'S01E01 18:40–21:10, 33:05',
  floor: 1700, times: ['night'], refs: [],          // e.g. ['diner_1.jpg', 'diner_2.jpg'] in refs/
  plate: { x: -420, y: 700, w: 1920 },               // the 16:9 window that matches the reference still
  pan: 360,
  palette: { wall: '#D9CBA8', tile: '#3F7F7A', wood: '#6B3F2A', vinyl: '#A8232E', chrome: '#B9C2C6', floorA: '#E8E2D2', floorB: '#2A2628', glass: '#16213A', neon: '#FF4F6E' },
  notes: 'Long counter with chrome stools on the left, red vinyl booths along the windows on the right, black-and-white checkered floor, teal tiles under cream walls, a pink neon DINER sign in the window, pendant lamps. Night: cold blue street outside, warm light inside.',
};
const C = meta.palette;

export function layers(o = {}) {
  const night = (o.time || 'night') === 'night', blur = o.blur || 0;
  return [
    // ceiling + upper wall: a set must fill the whole 9:16 frame at every camera move (y −900…2400)
    L(0.2, (c) => {
      c.fillStyle = shade(C.wall, night ? -0.45 : -0.25); c.fillRect(-900, -900, 2900, 1500);
      c.fillStyle = shade(C.wall, night ? -0.3 : -0.12); c.fillRect(-900, 380, 2900, 140);
      c.strokeStyle = rgba('#000000', 0.2); c.lineWidth = 3; for (let x = -900; x < 2000; x += 180) { c.beginPath(); c.moveTo(x, -900); c.lineTo(x, 520); c.stroke(); }
    }, { blur: blur * 0.5 }),
    // back wall + windows (far, slow)
    L(0.35, (c, t) => {
      c.fillStyle = shade(C.wall, night ? -0.15 : 0); c.fillRect(-900, 500, 2900, 1100);
      c.fillStyle = C.tile; c.fillRect(-900, 1240, 2900, 260); c.strokeStyle = rgba('#000000', 0.18); c.lineWidth = 2;
      for (let x = -900; x < 2000; x += 40) { c.beginPath(); c.moveTo(x, 1240); c.lineTo(x, 1500); c.stroke(); }
      for (let y = 1240; y < 1500; y += 40) { c.beginPath(); c.moveTo(-900, y); c.lineTo(2000, y); c.stroke(); }
      // windows onto the street
      for (let i = 0; i < 4; i++) {
        const x = 560 + i * 330;
        P(c, [[x, 760], [x + 290, 760], [x + 290, 1180], [x, 1180]]); ink(c, night ? C.glass : '#9CC3D8', 6);
        if (night) { glow(c, x + 80 + hash(i) * 120, 1120, 90, '#FFC46A', 0.35); glow(c, x + 200, 1150, 60, '#FF5A5A', 0.3); }
        c.fillStyle = rgba('#FFFFFF', 0.08); P(c, [[x + 20, 780], [x + 90, 780], [x + 30, 1160], [x + 10, 1160]]); c.fill();
      }
      // neon sign in the first window (seen from inside → mirrored text)
      c.save(); c.translate(705, 860); c.scale(-1, 1); c.font = '900 64px Montserrat, Arial Black'; c.textAlign = 'center';
      glow(c, 0, -20, 170, C.neon, 0.5); c.lineWidth = 6; c.strokeStyle = C.neon; c.strokeText('DINER', 0, 0); c.fillStyle = '#FFD1DA'; c.fillText('DINER', 0, 0); c.restore();
      // menu board above the counter
      P(c, [[-420, 700], [220, 700], [220, 880], [-420, 880]]); ink(c, '#2A2228', 6);
      c.fillStyle = '#F3E9D8'; c.font = '700 30px Montserrat, Arial'; ['BURGER  4.50', 'FRIES   1.75', 'SHAKES  2.25', 'PIE     2.00'].forEach((s, k) => c.fillText(s, -380 + (k % 2) * 320, 770 + Math.floor(k / 2) * 60));
    }, { blur: blur * 0.6 }),
    // counter, stools, pendant lamps (middle)
    L(0.6, (c) => {
      P(c, [[-900, 1330], [420, 1330], [420, 1560], [-900, 1560]]); ink(c, C.wood, 6);
      P(c, [[-900, 1310], [440, 1310], [440, 1340], [-900, 1340]]); ink(c, C.chrome, 5);
      c.fillStyle = shade(C.wood, -0.35); c.fillRect(-900, 1500, 1320, 60);
      // pie stand + coffee machine on the counter
      smooth(c, [[-200, 1310], [-200, 1250], [-160, 1210], [-120, 1250], [-120, 1310]], true, 0.4); ink(c, rgba('#E8F4FF', 0.5), 4);
      P(c, [[60, 1310], [60, 1200], [160, 1200], [160, 1310]]); ink(c, C.chrome, 5); circle(c, 110, 1240, 16); ink(c, '#2A2228', 3);
      for (let k = 0; k < 6; k++) { const x = -760 + k * 200; c.fillStyle = C.chrome; c.fillRect(x - 6, 1560, 12, 140); P(c, [[x - 46, 1560], [x + 46, 1560], [x + 40, 1590], [x - 40, 1590]]); ink(c, C.vinyl, 4); }
      for (let k = 0; k < 4; k++) { const x = -500 + k * 380; c.strokeStyle = '#2A2228'; c.lineWidth = 4; c.beginPath(); c.moveTo(x, 400); c.lineTo(x, 600); c.stroke(); P(c, [[x - 50, 640], [x + 50, 640], [x + 30, 600], [x - 30, 600]]); ink(c, '#2E4A48', 4); glow(c, x, 660, 220, '#FFD08A', 0.35); }
    }, { blur }),
    // floor + booths by the windows (actors' layer depth)
    L(0.85, (c) => {
      const vx = 540, vy = 1250;
      for (let r = 0; r < 14; r++) for (let k = -16; k < 16; k++) {     // checkerboard in perspective
        const y0 = 1600 + r * r * 4.2 + r * 22, y1 = 1600 + (r + 1) * (r + 1) * 4.2 + (r + 1) * 22;
        const xa = (u, y) => vx + u * 46 * (y - vy) / 350;
        P(c, [[xa(k, y0), y0], [xa(k + 1, y0), y0], [xa(k + 1, y1), y1], [xa(k, y1), y1]]); c.fillStyle = (r + k) % 2 ? C.floorA : C.floorB; c.fill();
      }
      for (let i = 0; i < 3; i++) {                                        // booths along the windows
        const x = 620 + i * 430;
        P(c, [[x, 1640], [x, 1420], [x + 60, 1420], [x + 60, 1640]]); ink(c, C.vinyl, 5);
        P(c, [[x + 100, 1520], [x + 330, 1520], [x + 330, 1545], [x + 100, 1545]]); ink(c, C.floorA, 5);
        c.fillStyle = C.chrome; c.fillRect(x + 205, 1545, 16, 120);
      }
    }),
  ];
}

/** layers in front of the actors */
export function front(o = {}) {
  return [L(1.45, (c) => { P(c, [[-300, 1760], [180, 1760], [180, 2200], [-300, 2200]]); ink(c, shade(C.vinyl, -0.3), 6); smooth(c, [[-300, 1760], [-60, 1700], [180, 1760]], false, 0.5); c.strokeStyle = OL; c.lineWidth = 6; c.stroke(); })];
}
