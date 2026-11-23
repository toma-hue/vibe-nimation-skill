// THE SHORT: one shot per beat, cut on the narration. Rewrite this file for every short (see reference/SHOTS.md).
// T = timing + cast: T.L(i) start of script line i, T.E(i) its end, T.w('word', t0) a word's start,
// T.talk(id, t) mouth for a mimed line, T.CH.<id> a character spec.
// A shot: { id, start, note, draw(ctx, lt, sh, t), captions?, finish?, over? } — lt = time inside the shot.
import { key, ease, clamp, inv, lerp } from './core/lib.js';
import { scene, camAt, shakeAt, L, flash, speedLines, bars, pulse, fade } from './core/scene.js';
import { sky, city, rooftop, railing, motes, voidBg } from './core/sets.js';
import { drawCharacter, exprAt, walkPose, mixPose } from './core/rig.js';

export function buildShots(T) {
  const S = [], cues = [], q = (t, type, o = {}) => cues.push({ t, type, ...o });
  const cut = (i) => Math.max(0, T.L(i) - 0.15);          // a new shot starts just before its line
  const A = T.CH.alex, M = T.CH.maya;
  const TIME = 'dusk';

  // S01 — wide: Alex walks onto the roof; slow pan + push-in, 6 parallax planes
  S.push({ id: 'S01', start: 0, note: 'wide roof, Alex walks in', draw(c, lt, sh, t) {
    const cam = camAt(lt, [[0, { x: -80, zoom: 1.0 }], [sh.dur, { x: 50, zoom: 1.12 }]]);
    const walk = clamp(lt / (sh.dur * 0.8)), x = lerp(180, 520, ease.out(walk));
    scene(c, cam, [...sky(TIME), ...city(TIME), rooftop(TIME),
      L(0.85, (c) => drawCharacter(c, A, x, 1712, 0.66, { t, pose: walk < 1 ? walkPose(lt * 1.6) : mixPose(walkPose(0), 'pockets', clamp((lt - sh.dur * 0.8) * 3)), turn: walk < 1 ? 0.85 : 0.2, expr: 'tired' })),
      motes(), railing(TIME)], t);
  } });
  q(0, 'wind', { end: 99, gain: 0.5 });

  // S02 — over the shoulder: Alex (back, big, left) sees Maya far away at the edge
  S.push({ id: 'S02', start: cut(1), note: 'OTS: Maya already there', draw(c, lt, sh, t) {
    const cam = camAt(lt, [[0, { x: 20, zoom: 1.0 }], [sh.dur, { x: -10, zoom: 1.08 }]]);
    scene(c, cam, [...sky(TIME), ...city(TIME, { blur: 3 }), rooftop(TIME),
      L(0.8, (c) => drawCharacter(c, M, 700, 1560, 0.42, { t, pose: 'crossed', turn: -0.3, back: true })),
      L(1.25, (c) => drawCharacter(c, A, 230, 2350, 1.35, { t, back: true, pose: 'idle' }))], t);
  } });
  q(cut(1), 'whoosh');

  // S03 — Maya turns: close-up, depth of field, anger lands on "furious"
  const furious = T.w('furious', T.L(2));
  S.push({ id: 'S03', start: cut(2), note: 'Maya close-up, furious', draw(c, lt, sh, t) {
    const hit = furious - sh.start;
    const cam = camAt(lt, [[0, { zoom: 1.0, x: 10 }], [sh.dur, { zoom: 1.1, x: -10 }]]); cam.shake = shakeAt(lt, [[hit, 9]]);
    scene(c, cam, [...sky(TIME), ...city(TIME, { blur: 6 }),
      L(1, (c) => drawCharacter(c, M, 540, 3150, 2.75, { t, turn: key(lt, [[0, -0.6], [0.5, 0.1]]), expr: exprAt(lt, [[0, 'neutral'], [hit - 0.25, 'angry']]), blink: Math.abs(lt - 0.6) < 0.06 ? 1 : 0 }))], t);
    flash(c, lt, hit, 0.12);
  } });
  q(cut(2), 'whoosh'); q(furious, 'boom');

  // S04 — the mimed line: extreme close-up, Maya shouts it (narrator's voice, her mouth), speed lines + red pulse
  S.push({ id: 'S04', start: cut(3), note: 'Maya shouts (mime)', finish: { tint: 'rgba(160,20,40,0.35)' }, draw(c, lt, sh, t) {
    const cam = camAt(lt, [[0, { zoom: 1.0 }], [sh.dur, { zoom: 1.06 }]]); cam.shake = shakeAt(lt, [[0.05, 12, 0.5]]);
    scene(c, cam, [...voidBg('#1A0610', '#7A1028', { rays: true }),
      L(1, (c) => drawCharacter(c, M, 540, 3900, 3.6, { t, expr: 'shout', talk: T.talk('maya', t) * 0.8, headTilt: Math.sin(lt * 9) * 0.015 }))], t);
    speedLines(c, t, clamp(1 - lt / 1.2) * 0.9, 540, 720); pulse(c, t, 0.8);
  } });
  q(T.L(3), 'hit');

  // S05 — Alex reacts: cold close-up, push-in, cinema bars, shocked → sad
  S.push({ id: 'S05', start: cut(4), note: 'Alex freezes', finish: { tint: 'rgba(60,90,160,0.35)' }, draw(c, lt, sh, t) {
    const cam = camAt(lt, [[0, { zoom: 1.0, x: -20 }], [sh.dur, { zoom: 1.14, x: 10 }]]);
    scene(c, cam, [...sky('night'), ...city('night', { blur: 7 }),
      L(1, (c) => drawCharacter(c, A, 540, 3150, 2.75, { t, turn: 0.15, expr: exprAt(lt, [[0, 'shocked'], [T.w('knew', T.L(4)) - sh.start, 'sad']]) }))], t);
    bars(c, ease.out(clamp(lt / 0.6)));
    fade(c, inv(sh.dur - 0.6, sh.dur, lt));
  } });
  q(cut(4), 'riser', { end: T.E(4) });

  S.cues = cues;
  S.music = { mood: 'tension', bpm: 76, key: 'D', duck: 0.35 };   // scripts/music.py reads this
  return S;
}
