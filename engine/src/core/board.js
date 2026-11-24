// STORYBOARD — write a short as ONE LINE PER BEAT instead of a hand-coded draw() per shot (≈ 5–10× fewer output tokens).
// The board turns each beat into a complete shot: set + characters at the right scale (placeIn / shot helpers) + camera
// move + expression changes + FX + sound cues, all timed on the narration. Reference: reference/SHOTS.md → Storyboard.
//
//   import { board } from './core/board.js';
//   import * as diner from './sets/diner.js';
//   export function buildShots(T) {
//     const S = board(T, { sets: { diner }, time: 'night' }, [
//       { line: 0, shot: 'wide',  set: 'diner', who: ['mike', 'will'], cam: 'push' },
//       { line: 1, shot: 'close', set: 'diner', who: 'mike', expr: ['neutral', 'angry@furious'], fx: ['hit@furious'], cam: 'push' },
//       { line: 2, shot: 'xclose', set: 'void', who: 'will', expr: 'shout', fx: ['speed', 'pulse'], tint: 'rgba(160,20,40,0.35)' },
//       { line: 3, shot: 'ots', set: 'diner', who: ['will', 'mike'] },       // who[0] speaks (small), who[1] seen from behind (big)
//       { line: 4, custom: (c, lt, sh, t, h) => { /* any hand-written shot: h = { T, cam, scene, L, … } */ } },
//     ]);
//     S.music = { mood: 'tension', bpm: 76 };   // S.cues already filled
//     return S;
//   }
// A beat: line (script line it starts on; or at: seconds) · shot wide|medium|close|xclose|ots · set (module id in
// opts.sets | generic: sky|city|rooftop|street|forest|hallway|room|void) · time · who (id | {id,x,y,turn,back,pose,expr,
// look,hold,reach,hand,walk:[x0,x1]} | an array of them) · expr ('angry' | ['neutral','angry@word']) · cam (push|pull|
// panL|panR|drift|low|high|still | {from:{x,zoom,rot,cy}, to:{…}}) · fx (['hit@word','flash@word','shake@word','speed','pulse',
// 'bars','fadeIn','fadeOut']) · sound (['boom@word','hit@+0.3','riser','whoosh']) · tint · captions · allowOff · allowSmall ·
// talk (character id; default = the mimed character of that line) · blur (background blur) · void [c1, c2] · custom.
// "@word" = the start of that word in/after the beat's line (T.w); "@+0.4" = seconds after the shot starts.
// Nothing in a beat draws hands or limbs: gestures are poses / hand / reach / hold of the RIG (see CHARACTERS.md).
import { ease, clamp, lerp, key } from './lib.js';
import { scene, camAt, shakeAt, L, flash, speedLines, bars, pulse, fade, wide, medium, closeUp, extremeCloseUp, twoShot } from './scene.js';
import * as G from './sets.js';
import { drawCharacter, exprAt, walkPose, mixPose } from './rig.js';
import { placeIn, actorScale } from './scale.js';

const GENERIC = {
  sky: (t, o) => [...G.sky(t, o)], city: (t, o) => [...G.sky(t), ...G.city(t, o)], rooftop: (t, o) => [...G.sky(t), ...G.city(t, o), G.rooftop(t)],
  street: (t, o) => [...G.sky(t), ...G.street(t, o)], forest: (t, o) => [...G.sky(t), ...G.forest(t, o)], hallway: (t, o) => [...G.hallway(o)],
  room: (t, o) => [...G.room(o)],
};
const CAMS = {
  push: [{ zoom: 1.0 }, { zoom: 1.12 }], pull: [{ zoom: 1.12 }, { zoom: 1.0 }], still: [{ zoom: 1.0 }, { zoom: 1.04 }],
  panR: [{ x: -50, zoom: 1.03 }, { x: 60, zoom: 1.06 }], panL: [{ x: 50, zoom: 1.03 }, { x: -60, zoom: 1.06 }],
  drift: [{ x: -20, zoom: 1.03 }, { x: 20, zoom: 1.07 }], low: [{ rot: -0.04, cy: 1040, zoom: 1.0 }, { rot: -0.05, cy: 1060, zoom: 1.1 }],
  high: [{ rot: 0.03, cy: 900, zoom: 1.0 }, { rot: 0.035, cy: 880, zoom: 1.08 }],
};

export function board(T, opts, beats) {
  const S = [], cues = [], q = (t, type, o = {}) => cues.push({ t, type, ...o });
  const sets = opts.sets || {};
  beats.forEach((b, i) => {
    const start = b.at != null ? b.at : b.line != null ? Math.max(0, T.L(b.line) - (b.lead ?? 0.15)) : 0, line = b.line ?? 0;
    const when = (tok) => { if (tok == null) return null; const m = String(tok); if (m.startsWith('+')) return start + parseFloat(m); return T.w(m, T.L(line)); };
    const parse = (s) => { const [name, w] = String(s).split('@'); return { name, t: when(w) ?? start }; };
    const fx = (b.fx || []).map(parse), snd = (b.sound || []).map(parse);
    const mime = T.lines && T.lines[line] && T.lines[line].mime;
    const whoList = (Array.isArray(b.who) ? b.who : b.who ? [b.who] : []).map((w, k, a) => ({ ...(typeof w === 'string' ? { id: w } : w), k, n: a.length }));
    const bgSet = b.set ?? opts.set, time = b.time ?? opts.time ?? 'dusk', blurOf = (shot) => b.blur ?? (shot === 'wide' ? 0 : shot === 'medium' ? 3 : shot === 'ots' ? 3 : 7);
    const mod = typeof bgSet === 'string' ? sets[bgSet] : null, meta = mod && mod.meta;

    const backdrop = (shot) => {
      if (bgSet === 'void') return [...G.voidBg(...(b.void || ['#14101C', '#4A3A5E']), { rays: b.rays !== false })];
      if (mod) return [...mod.layers({ time, blur: blurOf(shot), ...(b.setOpts || {}) })];
      const g = GENERIC[bgSet || 'city']; return g ? g(time, { blur: blurOf(shot), ...(b.setOpts || {}) }) : [];
    };
    const frontOf = () => (mod && mod.front ? mod.front({ time, ...(b.setOpts || {}) }) : []);

    // where and how big each character is, per shot type
    const place = (w, S_, shot, sh) => {
      const spread = w.n === 1 ? [540] : w.n === 2 ? [360, 720] : [250, 540, 830], x = w.x ?? spread[w.k] ?? 540;
      if (shot === 'close') return closeUp(S_, { x, faceY: w.faceY });
      if (shot === 'xclose') return extremeCloseUp(S_, { x, faceY: w.faceY });
      if (shot === 'medium') return w.n === 2 ? twoShot(T.CH[whoList[0].id], T.CH[whoList[1].id], { xA: whoList[0].x, xB: whoList[1].x })[w.k] : medium(S_, { x, faceY: w.faceY });
      if (shot === 'ots') {                                                  // listener from behind, big, low-left; speaker stands on the floor at true scale
        if (w.k === 1) return { x: w.x ?? 230, y: 2350, s: 1.35 };
        return meta ? placeIn(meta, S_, { x: w.x ?? 700, y: w.y }) : wide(S_, { x: w.x ?? 700, floor: w.y, s: opts.scale ?? 0.85 });
      }
      return meta ? placeIn(meta, S_, { x, y: w.y }) : wide(S_, { x, floor: w.y ?? 1700, s: opts.scale ?? 0.85 });   // wide: true scale in the location
    };

    S.push({
      id: b.id || 'S' + String(i + 1).padStart(2, '0'), start, note: b.note || `${b.shot || 'wide'} ${whoList.map((w) => w.id).join('+')}`,
      captions: b.captions, allowOff: b.allowOff || (b.shot === 'ots' ? [T.CH[whoList[1] && whoList[1].id]?.name].filter(Boolean) : []), allowSmall: b.allowSmall ?? b.shot === 'ots',
      finish: b.tint || b.vignette != null || b.grain ? { tint: b.tint, vignette: b.vignette, grain: b.grain } : undefined,
      draw(c, lt, sh, t) {
        if (b.custom) return b.custom(c, lt, sh, t, { T, camAt, scene, L, shakeAt, flash, speedLines, bars, pulse, fade, wide, medium, closeUp, extremeCloseUp, twoShot, placeIn, drawCharacter, exprAt, walkPose, mixPose, ease, clamp, lerp, key, G, mod });
        const shot = b.shot || 'wide', dur = sh.dur;
        const preset = typeof b.cam === 'object' && !Array.isArray(b.cam) ? [b.cam.from || {}, b.cam.to || {}] : CAMS[b.cam || (shot === 'xclose' ? 'still' : 'push')] || CAMS.push;
        const cam = camAt(lt, [[0, preset[0]], [dur, preset[1]]]);
        cam.shake = shakeAt(lt, fx.filter((f) => f.name === 'hit' || f.name === 'shake').map((f) => [f.t - start, f.name === 'hit' ? 9 : 5, 0.3]));
        const actors = L(shot === 'ots' ? 1 : 0.85, (cc) => {
          // far-to-near: ots draws the listener (who[1]) last and on f 1.25 (see below); others in listed order
          for (const w of whoList) {
            if (shot === 'ots' && w.k === 1) continue;
            drawWho(cc, w, lt, dur, t);
          }
        });
        const layers = [...backdrop(shot), actors];
        if (shot === 'ots' && whoList[1]) layers.push(L(1.25, (cc) => drawWho(cc, whoList[1], lt, dur, t)));
        layers.push(...frontOf());
        scene(c, cam, layers, t);
        for (const f of fx) {
          const l0 = f.t - start;
          if (f.name === 'flash' || f.name === 'hit') flash(c, lt, l0, 0.14);
          if (f.name === 'speed') speedLines(c, t, clamp(1 - (lt - l0) / 1.2) * 0.9, 540, 760);
          if (f.name === 'pulse') pulse(c, t, 0.8);
          if (f.name === 'bars') bars(c, ease.out(clamp((lt - l0) / 0.6)));
          if (f.name === 'fadeIn') fade(c, 1 - clamp((lt - l0) / 0.5));
          if (f.name === 'fadeOut') fade(c, clamp((lt - (dur - 0.6)) / 0.6));
        }
      },
    });
    function drawWho(cc, w, lt, dur, t) {
      const S_ = T.CH[w.id]; if (!S_) return;
      const shot = b.shot || 'wide', f = place(w, S_, shot), faceOther = w.n > 1 ? (w.k === 0 ? 1 : -1) : 1;
      let x = f.x, pose = w.pose || 'idle', turn = w.turn ?? (shot === 'ots' ? (w.k === 1 ? 0.2 : -0.35) : w.n > 1 ? 0.4 * faceOther : 0.2);
      if (w.walk) { const u = clamp(lt / (dur * 0.8)); x = lerp(w.walk[0], w.walk[1], ease.out(u)); pose = u < 1 ? walkPose(lt * 1.6) : mixPose(walkPose(0), w.pose || 'idle', clamp((lt - dur * 0.8) * 3)); turn = u < 1 ? 0.85 * Math.sign(w.walk[1] - w.walk[0] || 1) : w.turn ?? 0.2; }
      const ex = w.expr || b.expr, exprKeys = ex == null ? [[0, 'neutral']] : (Array.isArray(ex) ? ex : [ex]).map((e, k) => { const [n, wd] = String(e).split('@'); return [k === 0 ? 0 : Math.max(0.05, (when(wd) ?? start) - start - 0.2), n]; });
      const talk = (b.talk ?? mime) === w.id ? T.talk(w.id, t) * 0.8 : 0;
      drawCharacter(cc, S_, x, f.y, f.s, { t, pose, turn, back: w.back || (shot === 'ots' && w.k === 1), expr: exprAt(lt, exprKeys), talk, look: w.look, headTilt: w.headTilt, lean: w.lean, hold: w.hold, hand: w.hand, reach: w.reach, blink: Math.abs(lt - 0.6) < 0.06 ? 1 : 0 });
    }
    if (i > 0 && !b.noWhoosh) q(start, 'whoosh');
    for (const s of snd) q(s.t, s.name === 'whoosh' && s.t === start ? 'whoosh' : s.name, s.name === 'riser' ? { end: T.E(line) } : {});
    for (const f of fx) if (f.name === 'hit') q(f.t, 'hit');
  });
  S.cues = cues;
  return S;
}
