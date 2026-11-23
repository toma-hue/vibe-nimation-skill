# Captions (burned in)

Word-by-word from the narration's word timings (`data/words.json`), 1–3 words at a time, the spoken word highlighted.
Defaults in `engine/src/core/captions.js` → `CAPTION`. Override per short in `data/style.json`, per shot with
`captions: {…}` (or `false`), or change the defaults for every future short in captions.js.

```json
{"captions": {"font": "Montserrat", "weight": 900, "size": 84, "upper": true,
  "color": "#FFFFFF", "active": "#FFD400", "stroke": "#000000", "strokeWidth": 14,
  "shadow": "rgba(0,0,0,0.55)", "shadowY": 6, "y": 1420, "maxWords": 3, "maxChars": 18,
  "pop": 0.12, "activeScale": 1.08, "box": null}}
```
- Fonts bundled: Montserrat (100–900), Anton, Bangers (comic), Inter. Others: add the .ttf to `engine/fonts/` and to
  `FONTS` in `src/main.js`.
- Keep captions inside y ≈ 1250–1500: the TikTok / Shorts UI covers the bottom ~380 px and the right edge.
- The reference look is the user's chosen short (only its caption LOOK — font, colours, outline, size, highlight, motion —
  never its humour, arrows or graphics). When the user sends a screenshot, match those values here and keep them.
