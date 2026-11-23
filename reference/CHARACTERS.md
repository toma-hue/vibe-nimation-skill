# Character specs (the cast file)

`<root>/Vibe-nimation episodes/_Personaje/<Series>/characters.json` — one file per series, reused by every episode.
The rig (`engine/src/core/rig.js`) draws any character from its spec; `vn.py cast` renders the sheets.

```json
{"series": "Stranger Things", "characters": [
  {"id": "mike", "name": "Mike Wheeler", "gender": "m", "role": "main",
   "build": {"height": 0.86, "headSize": 1.08, "shoulders": 0.95, "hips": 1.0},
   "skin": "#EBC4A4",
   "hair": {"style": "messy", "color": "#1E1614", "bangs": "messy"},
   "eyes": {"color": "#4A3626"}, "brows": {"thick": 8},
   "face": {"jaw": "soft", "freckles": false, "glasses": null, "beard": null, "mustache": false},
   "top": {"type": "sweater", "color": "#3B5A8A", "inner": "#E8DCCB", "sleeves": "long", "open": false, "detail": "stripe", "detailColor": "#C8952F"},
   "bottom": {"type": "jeans", "color": "#41557A"},
   "shoes": {"color": "#D8D2C8", "sole": "#9A928A"},
   "accessories": [{"type": "backpack", "color": "#5A3A2A"}],
   "look": "One line in plain words: the look you saw in the episode (shown on the sheet)."}
]}
```

| field | values |
|---|---|
| `id` | short lowercase, unique; used in shots.js (`T.CH.mike`) and in script `"mime"` |
| `gender` | `m` / `f` (f: lashes, softer jaw, lip tint) |
| `build.height` | adult 1.0 · teen 0.88–0.95 · kid 0.75–0.85 · tall adult 1.05–1.1 (keep the cast's relative heights true) |
| `build.headSize` | 1.0 adult · 1.08–1.15 kids · `shoulders` / `hips` 0.85–1.2 |
| `skin` | any hex — pick from a well-lit still, then simplify (one flat tone) |
| `hair.style` | `messy` `spiky` `short` `swept` `buzz` `bald` `curly` `afro` `long` `wavy` `bob` `ponytail` `bun` |
| `hair.bangs` | optional override: `full` (straight fringe) `side` `part` (middle part) `messy` |
| `face.jaw` | `soft` `square` `narrow` · `beard`: `stubble` / `full` · `mustache` true · `freckles` true |
| `face.glasses` | `{"shape": "round" or "square", "color": "#hex"}` |
| `top.type` | `hoodie` (open → zip shows `inner`; `open: false` closed) `tshirt` `tank` `shirt` (collar, buttons) `sweater` `jacket` (open, lapels, `inner`) `dress` |
| `top.sleeves` | `long` / `short` (tshirt and dress default short) · `detail: "stripe"` + `detailColor` |
| `bottom.type` | `pants` `cargo` (baggy, pockets) `jeans` (seams) `shorts` `skirt` (a dress needs no bottom) |
| `accessories` | `cap` `beanie` `headband` (with `color`), `earrings`, `necklace`, `scarf`, `backpack` |

## From the episode to a spec
1. Pull 2–3 full stills of the character in good light (`vn.py analyze <file> --frames t1,t2`) — front if possible.
2. Hair: shape first (style), then one colour. Clothes: the signature outfit of THIS episode (what they wear most),
   simplified to 2–3 flat colours. Skin: one flat tone. Height relative to the others.
3. Exaggerate what makes them recognisable (a colour, glasses, a hat, curly hair, a moustache); drop small detail.
4. Outfit changes inside an episode → a second spec with a suffix id (`will_upside`) and the same face/hair.
5. Render with `vn.py cast`, open the sheet, compare with a still, fix, re-render. Show `_Distributie.png` at the stop.

Extras (a cop, a shopkeeper) can reuse a generic spec: copy one, change id, name, colours, hair.
