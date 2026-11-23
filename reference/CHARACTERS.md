# Character specs (the cast file)

`<root>/Vibe-nimation episodes/_Personaje/<Series>/characters.json` — one file per series, reused by every episode.
The rig (`engine/src/core/rig.js` + `hair.js` + `face.js`) draws any character from its spec; `vn.py cast` renders the
sheets. A complete worked cast of 14: `reference/examples/stranger-things-cast.json` (read it before writing a cast).

**The default way to write a character: `hair.style = "custom"` with its own parameters + a `faceRead` + face
parameters taken from close stills of THAT person.** Never reuse one hair or face spec for two different people —
two kids with "a bowl cut" still differ in volume, length, fringe, colour, face shape, eyes, nose and mouth.

```json
{"id": "dustin", "name": "Dustin Henderson", "gender": "m", "role": "main",
 "faceRead": "Round face, chubby cheeks, round eyes, upturned button nose, wide grin with a gap in the teeth; signature: gap teeth + round cheeks.",
 "build": {"height": 0.76, "headSize": 1.14, "shoulders": 0.95, "hips": 1.05},
 "skin": "#F1CBAA",
 "hair": {"style": "custom", "color": "#7A4E2C", "top": 18, "width": 22, "length": -786, "fringe": "none", "hairline": -880, "texture": "curly", "amp": 7},
 "face": {"shape": "round", "width": 1.08, "length": 0.94, "cheeks": {"chubby": 0.9}, "marks": {"freckles": 0.2}},
 "eyes": {"color": "#4A6A8A", "size": 1.02, "shape": "round"}, "brows": {"thick": 6, "arch": 0.6, "tilt": -0.2},
 "nose": {"shape": "upturned", "size": 0.95}, "mouth": {"width": 1.15, "lips": 0.3, "curve": 0.5, "gap": true},
 "top": {"type": "sweater", "color": "#3E6A8C", "detail": "stripe", "detailColor": "#E8DCCB"}, "bottom": {"type": "pants", "color": "#8A7B5A"},
 "shoes": {"color": "#E8E2D8", "sole": "#9A928A"}, "accessories": [{"type": "cap", "color": "#2D4A8A"}],
 "look": "Short round kid, brown curls under a blue trucker cap, blue striped sweater, khakis."}
```

## Body and clothes
| field | values |
|---|---|
| `id` | short lowercase, unique; used in shots.js (`T.CH.mike`) and in script `"mime"` |
| `gender` | `m` / `f` (f: default lashes 1 and lip tint) · `role`: `main` / `support` (face lineup puts main first) |
| `build.height` | adult 1.0 · teen 0.88–0.98 · kid 0.75–0.85 · tall adult 1.05–1.1 — the whole figure scales uniformly |
| `build.headSize` | 1.0 adult · 1.08–1.15 kids · `shoulders` / `hips` 0.85–1.3 |
| `skin` | any hex — pick from a well-lit still (`analyze --palette`), then simplify to one flat tone |
| `top.type` | `hoodie` (open → zip shows `inner`; `open: false` closed) `tshirt` `tank` `shirt` `sweater` `jacket` (open, lapels, `inner`) `dress` |
| `top.sleeves` | `long` / `short` · `detail: "stripe"` + `detailColor` |
| `bottom.type` | `pants` `cargo` `jeans` `shorts` `skirt` (a dress needs no bottom) |
| `accessories` | `cap` `beanie` `headband` `hat` (wide brim + pinched crown + band: `{"type":"hat","color","band"}`), `earrings`, `necklace`, `scarf`, `backpack` |

## Hair — every person's own haircut (`hair.style: "custom"`)
The same numbers drive every view (front, 3/4 both sides, profile both sides, back). Head units: the skull is ±80 wide
at the temples (the face is ±64), the crown at −930, ears at y −831…−793.

| param | meaning | range / values |
|---|---|---|
| `color` | one flat colour | hex |
| `top` | crown volume above the skull (px) | 2 buzz · 8–16 normal · 20–28 mop · 36–60 quiff / afro |
| `width` | side volume past the skull (px) | −6 hugging (buzz) · 0–6 neat · 10–18 full · 20–46 big / afro |
| `length` | y where the hair ends | −850 buzz · −830 above the ears · −790 ear bottom (covers the ears) · −740 jaw · −650 neck · −560 shoulders. Below −700 = long: drawn behind the body |
| `fringe` | how the front hangs | `none` (bare hairline) · `full` (straight-cut) · `messy` (uneven tips) · `side` (swept to one side from the part) · `curtain` (parted, falling to both sides) · `part` (flat parted) · `swept` (up/back, no hang) |
| `fringeLen` | y of the fringe tips | −870 short · −846 brows · −826 into the eyes |
| `hairline` | y of a bare hairline | −872 low · −886 normal · −896 receding |
| `texture` + `amp` | the outline | `straight` · `wavy` (amp 4–8) · `curly` (amp 3 tight … 12 big) · `shaggy` (amp 4–10) · `spiky` (amp 18–26, anime) |
| `part` | x of the parting | 0 centre · −20…−34 left · +20…+34 right |
| `taper` | width of the ends (long hair) | 1 straight down · 0.8 narrower · 1.1 fuller |
| `flip` | ends kicking out (px) | 0 · 6 feathered · 12 big 80s flick |
| `quiff` | upward volume at the front | 0 … 1 |
| `buzz` | true = a thin cap that hugs the skull in every view | with `top` 2–6, `width` −6…−2 |

Worked examples (all in the example cast):
- **Mop over the eyes and ears** (Mike): `{"top": 24, "width": 16, "length": -788, "fringe": "messy", "fringeLen": -826, "texture": "shaggy", "amp": 6, "part": 0}`
- **Bowl cut** (Will): `{"top": 14, "width": 12, "length": -820, "fringe": "full", "fringeLen": -842, "texture": "straight", "part": 0}` — ends ABOVE the jaw; a jaw-length `bob` reads as a girl's cut.
- **Buzzed head** (Eleven): `{"top": 2, "width": -6, "length": -852, "fringe": "none", "hairline": -892, "buzz": true}`
- **Huge swept-up quiff** (Steve): `{"top": 38, "width": 14, "length": -818, "fringe": "swept", "quiff": 1, "texture": "wavy", "amp": 4, "part": -20}`
- **Feathered 80s mom hair** (Karen): `{"top": 24, "width": 24, "length": -690, "fringe": "curtain", "fringeLen": -846, "texture": "wavy", "amp": 7, "flip": 12}`
- **Curls, not an afro** (Dustin): `{"top": 18, "width": 22, "length": -786, "fringe": "none", "texture": "curly", "amp": 7}`

Legacy presets (old cast files keep rendering): `short` `messy` `spiky` `swept` `buzz` `bowl` `curly` `afro` `long`
`wavy` `bob` `ponytail` `bun` `bald` — each is just a parameter set (`HAIR_PRESETS` in hair.js) and any parameter can
override it. Use them only as a starting point.

## Face — recognisable by the face alone
All optional; the defaults are the old shared face. They apply in front, 3/4 and profile and stack with every expression.

| field | meaning | range / values |
|---|---|---|
| `face.shape` | outline | `oval` (default) `round` `long` `heart` (wide brow, small chin) `square` |
| `face.width` / `face.length` | multipliers | 0.9–1.16 / 0.94–1.12 |
| `eyes.size` / `spacing` | eye size, extra distance apart (px) | 0.85 small … 1.3 huge / −4…+6 |
| `eyes.shape` | | `almond` (default) `round` `narrow` `hooded` (lid covers the top: tired, brooding) `droopy` (outer corners down) |
| `eyes.tilt` / `lashes` | outer corners up (+) or down (−) / lash weight | −0.4…0.4 / 0…1 |
| `brows.thick` / `arch` / `length` / `tilt` | thickness px / arch 0–1 / length / + stern, − worried | 4–13 / 0.1–0.7 / 0.8–1.2 / −0.6…0.6 |
| `nose.shape` / `size` / `length` / `bridge` | | `straight` `button` `wide` `hooked` `upturned` / 0.78–1.2 / 0.9–1.2 / 0–1 (bridge lines) |
| `mouth.width` / `lips` / `curve` / `gap` | | 0.82–1.3 / 0–1 fullness / −0.5 frown … +0.5 smile at rest / true = gap in the teeth |
| `ears.size` / `out` | | 0.85–1.25 / 0–1 sticking out |
| `face.cheeks` | `{bones: 0–1, chubby: 0–1}` | cheekbone lines / round fuller cheeks |
| `face.chin` | `{size: 0.85–1.15, cleft: true}` | |
| `face.age` | `{bags, forehead, smile}` 0–1 each | under-eye bags, forehead lines, nasolabial lines (adults) |
| `face.marks` | `{freckles: 0–1, mole: [x, y], bruise: {x, y, r}, scar: {x, y, len, angle}}` | front-face coordinates, e.g. a mole at [−30, −770] |
| `face.glasses` / `beard` / `mustache` | `{shape: round/square, color}` / `stubble` `full` / true | |

**faceRead** (one line, required for every main character), written from 2–3 close stills: face shape · eye size/shape ·
nose · mouth · ONE signature trait, then the parameters that draw it. Exaggerate the signature (caricature) without
breaking the style. Worked examples:
- Dustin: "round face, chubby cheeks, round eyes, upturned nose, wide grin with a gap in the teeth" → `shape round, cheeks.chubby 0.9, eyes.shape round, nose upturned, mouth {width 1.15, curve 0.5, gap true}`
- Eleven: "huge round eyes on a buzzed head, tiny nose, small mouth" → `eyes {size 1.32, shape round}, nose {button, 0.78}, mouth.width 0.82`
- Hopper: "big square face, heavy low brows, small hooded eyes with bags, broad nose" → `shape square, width 1.1, brows {thick 12, tilt 0.35}, eyes {hooded, 0.88}, age {bags 1, forehead 0.7}, nose wide 1.15`
- Joyce: "narrow long face, tired hooded eyes, worried brows" → `shape long, width 0.9, eyes hooded, brows.tilt −0.6, age {bags 0.6}, mouth.curve −0.4`
- Mike: "long face, big mouth" → `shape long, length 1.12, mouth.width 1.28` · Will: "small delicate features" → `eyes round 1.08, nose button 0.8, mouth 0.82` · Lucas: "strong stern brows" → `brows {thick 11, tilt 0.55}, nose wide, lips 0.7`

## From the episode to a spec
1. Pull 2–3 full stills of the character in good light (`vn.py analyze <file> --frames t1,t2`) — front and a turned
   view if possible — and their colours (`--palette t1`).
2. **Hair**: silhouette first (volume on top and at the sides, where it ends, what the front does), then texture, then
   one colour → custom parameters. **Face**: write the faceRead, then the parameters. **Clothes**: the signature outfit
   of THIS episode, 2–3 flat colours. Height relative to the others.
3. Exaggerate what makes them recognisable; drop small detail.
4. Outfit changes inside an episode → a second spec with a suffix id (`will_upside`) and the same face/hair.
5. `vn.py cast` and check (below). Iterate with `vn.py cast <work> --ids a,b` + `_verificare/_review.png`.

Extras (a cop, a nurse) still get their own hair and face numbers — vary them; never copy another character's.

## Check (every time `cast` runs)
Per iteration open `_verificare/_review.png` (the line-up + one row of heads per changed character, all views) and,
when faces changed, `_verificare/_Fete.png`. **Before the stop, once, open every `<Name>.png`, `_capete` and `_corp`**:
- **Hair in every view** (front, 3/4 both sides, profile both sides, back, 3/4 from behind both sides): covered as in the stills — no bald temples
  or sides, the hairline comes down the temple, sideburns in front of the ear (short styles), long hair behind the
  ear, curls don't cover the eyes or glasses, a buzz is a thin cap (no side volume or block at the back).
- **No outline inside the hair**: fringes and temple locks have ink only on their hanging lower edge — no line across
  the top of a fringe, no "hat band" inside the hair mass; a haircut must never read as a cap, helmet or ushanka.
- **Head accessories** sit ON the head in every view (dome over the hair; brim forward in profile, toward the face in
  3/4; a wide-brim hat level, its crown pinched); glasses on the eyes with the arm to the ear in profile.
- **Expressions**: each of the 8 reads as its name in all five face views; talking mouths open.
- **Poses × views**: limbs attached, hands at the ends of the arms, both feet on the floor line, walks/runs read in
  profile, folded arms hidden from behind, nothing floating or cut. **From behind** (SPATE, 3/4 SPATE): the back of
  the head is hair (no face showing through), the neck and the near ear/cheek show in 3/4, the arm that points or waves
  goes the right way, the near leg is drawn over the far one.
- **Distinct people**: no two main characters have the same hair silhouette (line-up) or the same face read
  (`_Fete.png`: hair flattened to a silhouette — every face must still be told apart; kids and adult women especially).
- **Identity**: each head side by side with a still of that person — hair shape and colour, face shape, eyes, nose,
  mouth, the signature trait, clothes, height relative to the others.
If a cell fails: spec problem → fix the spec; rig problem (would fail for anyone) → fix `engine/src/core/rig.js` /
`hair.js` / `face.js`, re-run `cast` for the whole cast and check again.
