// THE SHORT as a STORYBOARD: one line per beat (reference/SHOTS.md → Storyboard). Rewrite this file for every short.
// board() builds each shot — set, characters at the RIGHT SCALE, camera move, expression changes, FX, sound — and cuts on
// the narration: `line` = the script line the shot starts on, "word@" = a word's start (check data/words.txt, a
// misspelled word silently falls back to the line start). A shot the board cannot express → `custom: (c, lt, sh, t, h) => …`
// (see reference/shots-manual-example.js for a fully hand-written short and the engine API).
// The ids below (alex, maya) come from the cast file: use the real character ids of the series.
import { board } from './core/board.js';
// import * as diner from './sets/diner.js';            // the series' own locations (src/sets/): { sets: { diner } }, set: 'diner'
// import { walkie } from './props.js';

export function buildShots(T) {
  const S = board(T, { time: 'dusk' /*, sets: { diner } */ }, [
    // wide: Alex walks onto the roof (walk: [x0, x1]); generic set 'rooftop' (city + sky + railing)
    { line: 0, at: 0, shot: 'wide', set: 'rooftop', who: [{ id: 'alex', walk: [180, 520], expr: 'tired' }], cam: 'panR', sound: ['wind'] },
    // over the shoulder: who[0] speaks (on the floor, true scale), who[1] is seen from behind, big, low-left
    { line: 1, shot: 'ots', set: 'rooftop', who: ['maya', 'alex'], cam: 'push' },
    // close-up: the expression changes on a word, a hit lands on it
    { line: 2, shot: 'close', set: 'rooftop', who: 'maya', expr: ['neutral', 'angry@furious'], fx: ['hit@furious'] },
    // extreme close-up on the mimed line (script line 3 has "mime": "maya" → her mouth moves with the narrator's voice)
    { line: 3, shot: 'xclose', set: 'void', void: ['#1A0610', '#7A1028'], who: 'maya', expr: 'shout', fx: ['speed', 'pulse'], tint: 'rgba(160,20,40,0.35)' },
    // reaction + fade out; two characters in one shot: who: ['alex', 'maya'] with shot: 'medium'
    { line: 4, shot: 'close', set: 'rooftop', time: 'night', who: 'alex', expr: ['shocked', 'sad@knew'], fx: ['bars', 'fadeOut'], tint: 'rgba(60,90,160,0.35)' },
  ]);
  S.music = { mood: 'tension', bpm: 76, key: 'D', duck: 0.35 };   // scripts/music.py reads this
  return S;
}
