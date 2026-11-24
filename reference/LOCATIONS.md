# Locations — every place of the episode, re-created faithfully in vector

Each episode has its own places. Every place that appears in the shorts is re-created as a **location module**:
a vector set that keeps the original's layout, key props, colours and light, in the skill's style. Modules live per
series and are reused by later episodes (a recurring house, school or diner is drawn once).

```
Vibe-nimation episodes/_Locatii/<Series>/
  diner.js, byers-living.js, …     the modules (one per place; a place at night vs day = the same module, `time`)
  refs/diner_1.jpg, diner_2.jpg …  the episode stills each module re-creates
  <Name>.png                       the location sheet (made by vn.py locations)
```

## 1. Find the places (during the analysis)
Group the scenes by place: same room / street / building, even when the camera angle changes. For each place note:
name, the scene numbers and times where it appears, time of day, and whether a later short needs it. Places that
appear for a second or only behind a close-up can use a generic set (`sets.js`) or `voidBg` — say which.

## 2. Look at it properly
- Pull 2–4 **full stills** that show the place widest and clearest: `vn.py analyze <file> --frames 612.5,618,640`.
  Open them. Copy the best ones to `refs/<id>_1.jpg`, `_2.jpg` (the first one is the main comparison).
- Get its colours: `vn.py analyze <file> --palette 612.5,618` → the main hex colours with their share.
- Write down, in this order: the **layout** (where the horizon / vanishing point sits, back wall, side walls, doors,
  windows and what is seen through them), the **big masses** (furniture, counters, cars, trees, buildings), the
  **signature details** that make it recognisable (a sign, a poster, wallpaper pattern, Christmas lights, a lamp, a
  mural), the **light** (sources you can see, warm/cold, where the shadows fall), and the **mood**.

## 3. Write the module
`vn.py locations <work> --new <id>` starts from `reference/location-example.js` (a complete working diner — read it).
- `meta`: id, name, series, `seen` (episode + times), `floor` (y where full-body actors stand), **`scale`** (the actor scale
  at the floor line: 0.8–0.9 for rooms, 0.65–0.75 outdoors) and **`horizon`** (world y of the vanishing line) — both
  obligatory, see Scale below — `times`,
  `refs`, `plate` (the 16:9 world window `{x, y, w}` that matches the main still — tune it so the comparison lines up),
  `palette` (from step 2), `notes` (the written description, shown on the sheet).
- `layers(o)`: back → front, each `L(f, draw, {blur})` with parallax f (0.2 ceiling/sky · 0.35 far wall · 0.6 middle
  furniture · 0.85 floor and the actors' depth); `o.time`, `o.blur` (close-ups pass a blur). `front(o)`: optional
  layers in front of the actors (f 1.2–1.6: a chair back, a door frame, a plant, foliage).
- The world is the 9:16 frame but **wider and taller**: draw x from −900 to 2000 and **fill y from −900 to 2400**, so no
  camera move shows black.
- Same kit and look as the characters: flat fills, one ink outline (`ink`), cel shade (`shade`), light only from
  visible sources (`glow`), no gradients except skies/light pools, no photo textures. Simplify, never invent: every big
  shape in the still is there, in the right place and colour; small clutter becomes 2–3 representative props.
- Text on signs/screens: real words from the still (mirrored when seen from behind glass).
- Keep it fast (< 15 ms a frame): loops of simple shapes, no per-pixel work.

## Scale — real proportions, constant (obligatory)
A door drawn too big or kids drawn too small next to the furniture is a defect, not a style. The kit (`core/scale.js`):
```js
import { units, REAL } from '../core/scale.js';
import { mark } from '../core/scene.js';
const U = units(meta);                         // meta.scale + meta.horizon → pixels per metre at any depth
const doorTop = U.top(2.05, 1600);             // top y of a 2.05 m door whose base is on world y 1600
P(c, [[x, 1600], [x, doorTop], [x + U.x(0.85, 1600), doorTop], [x + U.x(0.85, 1600), 1600]]);
mark(c, 'back door', x, doorTop, x + U.x(0.85, 1600), 1600, { m: 2.05 });   // `check` compares it with the people
```
- One figure at scale s is 960·s·height px tall and an adult is 1.75 m, so 1 m = 548·s px at the floor line. A base line
  nearer the horizon is smaller by perspective (`depthK`), never by eye.
- Sizes: `REAL` in scale.js — adult 1.75, kid 1.33–1.5 (the cast's `build.height × 1.75`), door 2.05 × 0.85, handle 1.0,
  window sill 0.9, counter/dresser 0.9, table 0.75, chair seat 0.45, sofa seat 0.45, bed 0.55, shelf 1.8, fridge 1.75,
  ceiling 2.5, poster bottom 1.3, light switch 1.2, car 1.45, street lamp 4.5. When the still shows otherwise (a tall
  door), measure it against the people in the still and keep THAT ratio.
- A door at the back of a room: its base line is higher (nearer the horizon) → `U.h(2.05, baseY)` is already smaller.
  A door next to the actors uses the actors' floor line and must reach ≈ 1.15 × an adult's head height.
- In shots: `placeIn(meta, S, { x, y })` for full-body actors (true size at their depth, kids included). Close-ups and
  mediums use the shot helpers (the background is blurred / further away there). Wide shots are framed with the camera
  (zoom, crop the room): kids ≥ 28 % of the frame height; a deliberate far shot sets `allowSmall: true`.

## 4. Check it (mandatory)
`vn.py locations <work>` renders `<Name>.png`: the still and the vector plate over the same 16:9 window, plus three
9:16 short frames (wide, pan, close-up with depth of field) with a character for scale. The sheet also draws a **ruler** (0.5 m ticks, a 1.75 m adult and a 1.45 m kid) at the left of the plate: the door must
reach ≈ 2 m on it and the furniture its real height, and it prints a red warning when `meta.scale` / `meta.horizon` are
missing. Open it and compare **side by side**: layout and proportions, every big shape present and placed right, colours (hex) close, light from the
same side, the signature details recognisable, a character at the right scale against the furniture (door ≈ 2.05 m on the ruler, kid ≈ 1.45 m), no black areas
in the short frames. Fix and re-render until someone who watched the episode would say "that's the place".

## 5. Use it in a short
`new_short` copies every module of the series into `src/sets/`. In `shots.js`:
```js
import * as diner from './sets/diner.js';
scene(c, cam, [...diner.layers({ time: 'night', blur: 6 }), L(0.85, (c) => drawCharacter(c, T.CH.mike, 540, diner.meta.floor, 0.62, {…})), ...diner.front()], t);
```
A place that changes inside the episode (lights out, destroyed, decorated) → an option in `o` (e.g. `o.dark`,
`o.broken`), not a second module.
