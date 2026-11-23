# Style — 2D vector · comic · cutout rig · 2.5D camera

The user's style sheet: `style-sheet.webp` (open it once). Every frame of every short obeys it; the look never changes
between episodes.

## The look
- **2D vector, comic-book inspired, clean lines.** One ink colour (`OL #1C1418`) outlines every character shape, 4–6 px
  at character scale. Flat fills + **cel shading**: one shadow tone (`shade(c, -0.3)`, cool purple-black) on the side away
  from the light, one highlight where it helps. No gradients on characters, no textures, no photoreal anything.
- **Cinematic lighting**: a warm rim (`#FF9E5E`) on the light side of faces and bodies, cool shadows; skies carry the mood
  (sunset purple→orange, night navy, storm grey). Finish every frame with the vignette (`finish`, automatic); film grain only on purpose (`finish: {grain: 0.03}`).
- **Stylized & expressive** characters: big readable eyes, thick brows that act, clear mouth shapes. Expressions change
  on the beat, never randomly.
- **Palette** (the sheet): maroon `#6E1B2E`, cream `#E8DCCB`, ink black `#252027`, slate grey `#5A5560`, navy `#3B4A6B`,
  purple `#4B3A5E`, olive `#6A7A4A`. Characters keep their own colours from the cast file; sets lean on this palette.
- **2.5D camera**: background / midground / foreground layers move at different speeds (parallax); the camera zooms,
  pans, tilts, tracks, shakes. Depth of field: blur far layers in close-ups (`city(time, {blur: 6})`).

## Shots (dramatize)
| shot | use it for | how |
|---|---|---|
| wide / establishing | a new place, time, scale, a character alone | full body small (scale 0.5–0.7, feet ~1700), slow pan + push-in |
| medium | dialogue, actions | waist up: scale ~1.4–1.8, character origin below the frame |
| close-up | emotion, a key line | head + shoulders: scale ~2.6–2.9, origin y ≈ 3100–3200, blur behind |
| extreme close-up | the peak line, shock, threat | scale 3.4–4, origin y ≈ 3800–4000, voidBg / speed lines / pulse |
| over-the-shoulder | confrontation, reveals | one character from the back, big, low in a corner; the other small, sharp |
| low angle | power, threat, heroism | camera `rot` −0.03…−0.06, horizon lower (`cy` ↑), character bigger |
| two-shot | a conversation | both medium, turned toward each other (`turn` ±0.4–0.6) |
| insert | an object, a phone, a door, a map | draw it big on a simple background, quick |

- A shot every **2–5 s**; never hold a static frame: every shot has a camera move (push-in 1.0→1.08–1.15 at least).
- Cut on the narration (`T.L(i) - 0.15`); land expression changes, flashes, shakes and FX **on the word**.
- Peaks: `shakeAt`, `flash`, `speedLines`, `pulse`, a tint (`finish: {tint}`), cinema `bars`. Quiet moments: slow
  push-in, small movements (breathing and blinking are automatic; add a blink at a pause, a look away, a head tilt).
- Transitions: hard cuts by default; a `flash` for impact, `fade` to black for time jumps and the ending.
- Mood by colour: tension/danger → reds and deep purples; sadness → cold blue tint; hope → warm sunset; mystery → night + fog.

## Check (every shot, on `review/all.jpg` and full-size frames)
- Does the frame say what the narration says at that moment? Is the right character there, in their own colours?
- Is it readable on a phone: one clear subject, faces big enough in close-ups, nothing important under the captions
  (y 1300–1500) or in the bottom 380 px / right 140 px (TikTok and Shorts UI)?
- Camera moving? Parallax visible (layers at different f)? Expression right for the beat?
- No broken rig (limbs detached, hair over the face, a character floating above the ground: feet at the floor line).
- Captions correct and on time; no shot errors in the `check` output.
