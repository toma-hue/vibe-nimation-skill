# Writing a short: script.json + src/shots.js

The engine copy in every short is self-contained: `index.html` (player), `src/main.js` (boot + capture API),
`src/core/*` (the kit), `src/shots.js` (YOUR short — starts as a complete working example, study it first).

## Script
- English, narrator's voice, **present tense, second-hand retelling**: "Mike runs. Behind him, the lights die one by one."
- Hook first. Short sentences, one idea each; every sentence is a possible cut. ~150–160 words per minute.
- Write for the ear: numbers and dates as spoken ("nineteen eighty-three"), no abbreviations, no symbols.
- Character lines: the narrator says them, with `"mime": "<id>"` → the character mouths them (`T.talk`). Use the line
  that matters (≤ ~12 words), a few per short. Put the speaker in the narration before or after when it's not obvious.
- `emotion`: 0.4 calm exposition · 0.55–0.65 normal storytelling · 0.75–0.85 tense / dramatic · 0.9–1.0 shouting.
- `gap` after a line: 0.25 normal · 0.4–0.6 a beat of suspense · 0.8+ before a reveal.
- End with a pull: a question, a threat, a reveal cut short ("And then the door opens.").

```json
{"lead_in": 0.4, "tail": 1.2, "lines": [
  {"text": "Three boys. One bike ride home. Only two make it.", "emotion": 0.7, "gap": 0.45},
  {"text": "Will, don't go out there!", "emotion": 0.9, "mime": "mike", "gap": 0.35}]}
```

## shots.js — the API
```js
import { key, ease, clamp, inv, lerp } from './core/lib.js';
import { scene, camAt, shakeAt, L, flash, speedLines, bars, pulse, fade, wide, medium, closeUp, extremeCloseUp, twoShot, focus, mark } from './core/scene.js';
import { sky, city, rooftop, railing, street, room, forest, trunks, hallway, voidBg, rain, snow, fog, motes, lightning } from './core/sets.js';
import { drawCharacter, exprAt, walkPose, mixPose, POSES, EXPR } from './core/rig.js';
export function buildShots(T) { const S = []; … S.cues = cues; S.music = { mood, bpm }; return S; }
```
**Timing** — `T.L(i)` start of script line i · `T.E(i)` end · `T.w('word', T.L(i))` start of a word in/after line i ·
`T.talk(id, t)` mouth for mimed lines · `T.mouthAt(t)` · `T.CH.<id>` a spec · `T.dur`.
**Shot** — `{ id, start, note, draw(c, lt, sh, t), finish?, captions?, over? }`; `lt` = time inside the shot,
`sh.dur` its length, `t` film time. Push in time order; cut with `start: T.L(i) - 0.15`. `captions: false` hides them
for a shot; `captions: {y: 600}` moves them (e.g. when a face is low). `finish: {tint: 'rgba(60,90,160,0.35)', vignette, grain}`.

**Camera** — `const cam = camAt(lt, [[0, {x, y, zoom, rot, cy}], [sh.dur, {…}]], ease.inOut)`; `cam.shake = shakeAt(lt, [[t0, amp, dur]])`.
`scene(c, cam, [layers…], t)` draws layers in order (back → front). A layer: `L(f, (c, t) => {…}, {blur})`;
f = parallax: 0 sky · 0.08 sun/clouds · 0.25 far · 0.5 mid · 0.85–1 actors · 1.2–1.6 foreground.
x pans (+ right), y moves down, zoom pushes in, rot tilts (rad), cy = which world y is at the frame centre (default 960).

**Location modules** (the episode's own places, `src/sets/<id>.js`, see LOCATIONS.md) come first: `import * as diner from './sets/diner.js'` → `...diner.layers({time, blur})`, actors at `diner.meta.floor`, `...diner.front()`.
**Generic sets** (fallback for places too brief to model; each returns layers; TIME = day | sunset | dusk | night | overcast | storm) — `...sky(TIME, {horizon, sunX, moonX})`,
`...city(TIME, {blur})`, `rooftop(TIME)`, `railing(TIME)` (foreground), `...street(TIME, {blur})` (suburban houses, road,
lamps), `...room({wall, floor, window: TIME|null, door, furniture: ['bed','desk','lamp','shelf','sofa','poster','tv'], dark})`,
`...forest(TIME, {fog, blur})`, `trunks()` (foreground tree trunks), `...hallway({wall, lockers, floor})`,
`...voidBg(dark, light, {rays})` (emotional close-ups, flashbacks, shouts), weather `rain(k)`, `snow(k)`, `fog(color, a)`,
`motes()`, `lightning(lt, [t0…])`. Floor line for full-body actors ≈ y 1700 (rooftop 1712, street 1650–1750, room 1600–1680).
New places: write a set in the shot file with the same kit (`P`, `smooth`, `ink`, `shade`, `glow` from lib.js): flat
shapes, ink outlines, a few layers at different f. Keep it simple and readable.

**Characters** — `drawCharacter(c, T.CH.mike, x, yFeet, scale, opts)` inside an actors layer. opts:
`t`, `expr` (name or `exprAt(lt, [[0,'neutral'], [1.2,'shocked'], [1.6,'angry']])`), `talk` (0..1), `blink` (0..1),
`pose` (name, `walkPose(lt * 1.6)` / `walkPose(lt * 2.6, true)` to run, or `mixPose(a, b, u)`), `turn` (−1..1, + faces right;
walk/run with ±0.8), `back` (seen from behind), `look: [x, y]`, `headTilt`, `lean`, `wind`, `flip`, `alpha`, `shadow: false`, `hold: { R: held(prop, {…}) }` (an object in
that hand), `before / between / after: (ctx, th) => …` (parts of a 3D prop drawn behind / inside / in front of the body).
Expressions: neutral happy laugh smirk angry shout determined shocked scared sad crying tired suspicious thinking disgust embarrassed.
Poses: idle pockets point pointUp wave cheer handsOnHead fistUp crossed shrug reach defend facepalm hug sit kneel crouch.
Views: `turn` 0 front · ±0.4–0.6 three-quarter · ±0.75…1 **true profile** (own head drawing: nose, chin, side eye; body side-on; facing left is the mirror) · `back: true` · `back: true, turn: ±0.4–0.6` **three-quarter from behind** (back of the head with the near cheek and ear, shoulders turned; + walks away to the right). `sit`, `kneel`, `crouch`, walks and runs read best in profile (turn ±1).
**Shot helpers (use them — framing bugs were most of the re-renders)** — each returns `{x, y, s}` for
`drawCharacter(c, S, f.x, f.y, f.s, opts)`, computed from the character's build so a kid and an adult get the same
face size and the face lands where the captions don't: `wide(S, {x, floor})` (full body, one scale for everyone so
heights stay true) · `medium(S, {x, faceY})` (waist up) · `closeUp(S, {x, faceY})` (head + shoulders, face ≈ 440 px) ·
`extremeCloseUp(S, {x, faceY})` · `twoShot(A, B, {xA, xB})` → `[fA, fB]` at their true relative heights.
`const f = closeUp(T.CH.will); drawCharacter(c, T.CH.will, f.x, f.y, f.s, { t, expr: 'scared' })`.
**Aiming the camera at something on another layer** — a point drawn on a layer with parallax f ≠ 1 moves differently
from the actors; `focus(worldX, worldY, f, {zoom, sx, sy})` returns the camera that puts it at the screen point
(default the centre): `camAt(lt, [[0, focus(820, 1180, 0.6)], [sh.dur, focus(820, 1180, 0.6, { zoom: 1.25 })]])`.
**Framing check** — `build --preview` / `node tools/capture.mjs check` renders sample frames of every shot and prints,
per shot, any character off-frame, any face cut by the edge or under the caption band, and any marked prop off-frame
or under the captions. Props from props.js mark themselves; mark your own important objects with
`mark(c, 'name', x0, y0, x1, y1)` where you draw them. A deliberate exit / partial figure: `allowOff: ['Mike Wheeler']`
on the shot. Faces too low for the captions: raise `faceY`, or move the captions for that shot (`captions: {y: 560}`).
Manual scale guide (if you must): wide 0.5–0.7 (feet ~1700) · medium 1.5 (feet ~2500) · close-up 2.75 (feet ~3150) · extreme 3.6 (feet ~3900) — for an adult; divide by height × headSize for kids.
Moving a character: `x = lerp(x0, x1, ease.inOut(clamp(lt / d)))`; entering/exiting frame = start/end off-screen.

**Props** — `import { bike, rideBike, held, wallPhone, walkie, flashlight, creature } from './props.js'` (the series' own
props.js replaces the default): `wallPhone(c, x, y, s, { ringing, t, off })`, `walkie(c, x, y, s, { led, angle, backSide })`,
`flashlight(c, x, y, s, { on, angle, beam })`, `creature(c, x, y, s, { open, t })`.
**Every object must read correctly from the view it is seen from** — never a side-view drawing pasted on a front or
back view. Two tools:
- **3D props** (vehicles, furniture the characters sit on or move with): modelled in 3D and projected with the
  character's view angle — `bike(c, x, y, s, { turn, back, color, pedal })` alone, and
  **`rideBike(c, S, x, y, s, { turn, back, pedal: lt * 7, expr, … })`**: the rider's hips on the saddle, hands on the
  grips and feet on the pedals (IK), the bike's parts sorted around the body for the view — riding **toward the
  camera** (turn 0) the front wheel, fork and handlebar are in front of the body and the rear wheel shows below/behind
  the legs; riding **away** (`back: true`) the rear wheel is in front; profile: the frame between the far and the near
  leg; 3/4 and 3/4-from-behind in between. (x, y) = the ground under the bike; s as for the rider (`wide(S)`'s `f.s`).
  A new 3D prop: list its parts in 3D (x forward, y up, z right, body units), `project(p, th)` them and draw them from
  drawCharacter's `before` / `between` / `after` hooks by depth (see `rideBike` in props.js).
- **Held props**: `drawCharacter(c, S, x, y, s, { pose: 'point', hold: { R: held(flashlight, { alongArm: true }) } })`
  — drawn right after that arm, at the hand, so it turns, mirrors and hides with the hand (from behind, a hand in front
  of the body hides what it holds) and gets `backSide` in back views (the walkie shows its back and clip).
Add series props to `_Locatii/<Series>/props.js` in the same style (flat fills, ink, `mark()` at the end; a `backSide`
look when it can be seen from behind), then render **`vn.py locations "<work>" --objects <character id>`** →
`_Locatii/<Series>/_Obiecte.png` (riding, the bike, held props, every series prop × all 8 views) and read it.
**FX** (after `scene`) — `flash(c, lt, t0, d)`, `speedLines(c, t, k, cx, cy)`, `pulse(c, t, k, color)`, `bars(c, k)`, `fade(c, k)`.

**Sound** — `q(t, type, {gain, end, pan})`: whoosh (cuts, fast moves), boom (big reveal), hit (impact), riser (`end`),
wind / rain / heartbeat / steps / swell (`end`), thunder, thump (door, fall), glass, silence (`end`: music drops out).
Keep it sparse: a whoosh on some cuts, one boom/hit per peak. **Music** — `S.music = {mood, bpm, key, duck}`:
moods tension sad epic mystery action hopeful horror calm romantic comedy (scripts/music.py). duck 0.3 (more) – 0.6 (less).

## Recipes
- **Walk in**: wide, `pose: walkPose(lt * 1.6)`, `turn: 0.85`, x lerp; switch to `idle`/`pockets` with `mixPose` when stopping.
- **Over the shoulder**: speaker small and sharp in the mid layer; listener `back: true`, scale ~1.3, feet ~2350, at x 200–250, f 1.25.
- **Reaction**: close-up, `exprAt` change on the word, a blink, push-in, maybe `bars`.
- **Mimed line**: close-up/extreme, `talk: T.talk(id, t)`, expression matching the line, shake/flash on the strongest word.
- **Riding toward / away from the camera**: `rideBike(c, S, f.x, f.y, f.s, { turn: 0, pedal: lt * 7 })` (toward) or
  `{ back: true }` (away); a tracking shot alongside: `turn: ±1`, background f < 1 slides; a group: several riders,
  the nearer one lower and bigger, drawn last.
- **Chase/run**: `walkPose(lt * 2.6, true)`, `turn: ±0.9`, camera tracking (x moves with the runner, background f < 1 slides),
  `motes`/`speedLines` low k, heartbeat/steps cues.
- **Two-shot dialogue**: two characters medium, `turn` toward each other, alternate close-ups on the line changes.
- **Flashback/memory**: `voidBg` or a set with `finish: {tint: 'rgba(200,160,90,0.35)'}`, slow push, `fade` in/out.
- **Danger/monster** (don't show gore): silhouettes (a character spec all dark colours), `pulse`, lightning, fog, a scream
  as a mimed line, cut to the reaction instead of the act.
