---
name: vibe-nimation
description: Turn a TV-series episode (a 20–40 min video file) into a set of narrated, animated 9:16 shorts for TikTok and YouTube Shorts, in one fixed 2D vector comic style with cutout/puppet-rigged characters and 2.5D parallax camera moves, all drawn in code on the user's computer for $0 (local Chatterbox narrator, local Whisper, no APIs). Analyses the episode (scenes, transcript, strengths/weaknesses, viral potential), detects the series, episode, characters and locations, builds vector character sheets and re-creates every place of the episode faithfully as a vector set, plans shorts that cover the episode's story in order, stops for the user's approval, then voices, animates, scores, mixes, renders and delivers each short with a .txt of title, description, hashtags and a 1–10 viral score. Use whenever the user gives an episode / video file to turn into animated shorts, recap shorts, "vibe-nimation", or asks to continue, fix or re-render one of these shorts or character sheets.
---

# Vibe-nimation — episode → animated narrated shorts

`SKILL` = the folder this file is in. Run every tool through the launcher: `python SKILL/scripts/vn.py <tool> …`
(on macOS/Linux `python3`). Paths with spaces go in double quotes. **Talk to the user in Romanian**; everything that
goes into the videos and post texts is in **English**. The user gives you only the episode file. You do everything
else, with ONE stop for approval (step 5).

## Credits first — how this skill spends them (read once, obey always)
The only thing that costs credits is the conversation with Claude (tokens). Voice, render, music, mix cost nothing. The
big spends are: **(1)** a long session re-reading itself on every step (cache reads), **(2)** every image opened stays in
the context for the rest of the session, **(3)** code/text Claude writes (output is the most expensive token), **(4)** fix
loops "build → look → repair → look". So:
- **Model:** run the main session on **Sonnet**. Use **Opus only** for (a) the narrative analysis + plan (step 1.4–2) and
  (b) engine/rig repairs, and (c) a step that failed twice on Sonnet — each as a **sub-agent with `model: "opus"`** given
  the files it needs and returning a short report; never keep Opus running while scripts and shots are written. If the
  user is on Opus, tell them once (Romanian): "treceți pe Sonnet cu `/model sonnet`, restul îl fac eu".
- **Sessions:** analysis+plan → one session (end it with `vn.py bible`); cast + locations → one; then **each 2–3 shorts in
  a fresh session or sub-agent that reads only `<work>/bible.md` + its `plan.json` entry + `reference/SHOTS.md`** — never
  the analysis, the stills or the cast sheets again. Tell the user when a fresh session is the cheaper way to continue.
- **Context budget (hard rule):** a 240-turn single session reached 700 K tokens of context and 80 % of the cost was just
  re-reading it. The context grows with every turn, so STOP and hand over at these points: after the analysis + plan
  (step 2), after cast + locations + approval (step 5), and **after every 2–3 delivered shorts** (or sooner, whenever
  the conversation is clearly long — e.g. ~150 K tokens, `/context` shows it). At each point: run
  `vn.py bible "<work>"`, then tell the user in Romanian, in one short message: "Contextul e mare. Scrieți `/clear` și
  lipiți textul de mai jos" and print the **Next** prompt from `bible.md`. Do not continue in the long session; do not
  summarise instead (a summary still carries the history). A fresh session starts at ~15 K tokens.
- **Images:** open an image only when no automated check can answer the question. Prefer the text checks
  (`rigtest`, `check`: framing, scale, tiny figures, hands); review images are small and one per change (below). After
  you have judged an image, do not open it again — write the verdict in a line of text.
- **Read the references lazily:** this file is enough to start. Open `CHARACTERS.md` only at step 3, `LOCATIONS.md` at
  3b, `SHOTS.md` at step 6, `STYLE.md` once at step 6, `ANALYSIS.md` at steps 1.4–2, `POSTING.md` at 6.7.
- **Measure:** `python SKILL/scripts/usage_report.py` prints where the credits of the last sessions went, per phase and
  model (reads local transcripts only). Offer it when the user says a run was expensive.

## 0 · First use on a machine
`python SKILL/scripts/setup.py` until it prints **All set** (`--root "D:\Vibe-nimation"` or any folder the user names;
default `~/Vibe-nimation` = `C:\Users\<name>\Vibe-nimation`). It checks Node 20+, ffmpeg, Chrome/Edge, builds the private
env (~4 GB models, once), tests the NVIDIA GPU (PyTorch CUDA 12.8 for RTX 50-series) and voices a test line.
Missing tools: offer the free official install (Windows: `winget install OpenJS.NodeJS.LTS`, `winget install Gyan.FFmpeg`,
then a NEW terminal) and ask before installing anything. Config: `~/.vibe-nimation/config.json`.

Output root (from the config):
```
<root>\Vibe-nimation episodes\_Personaje\<Series>\characters.json + <Name>.png + _Distributie.png + _verificare\   (shared by all episodes)
<root>\Vibe-nimation episodes\_Locatii\<Series>\<id>.js + refs\ + <Name>.png                                       (shared by all episodes)
<root>\Vibe-nimation episodes\<Series> - S01E01\S01E01 - Short 01 - <Title>.mp4 + .txt              (the deliverables)
<root>\_lucru\<episode-id>\  analysis\, plan.md, plan.json, bible.md, cast_render\, shorts\01\, shorts\02\ …   (work files)
```

## 1 · Analyse the episode
`python SKILL/scripts/vn.py analyze "<episode file>"` (≈5–15 min for 40 min on a CPU). It prints the work folder.
Then, in this order, and do not skip any of it:
1. Read `analysis/overview.md` (every scene: time, length, loudness ★, its dialogue, its pack/sheet; credit and logo
   scenes are already detected and marked, not in the packs) and `transcript.txt`.
2. **Open every pack** in `analysis/packs/` — this is how you "watch" the episode: who is on screen, where, what happens, how it looks. While you watch,
   fill the **place** and **who** columns of `analysis/scene_index.md` — from here on read that text instead of
   reopening images. Only for a moment you need in detail: `vn.py analyze "<file>" --clip 612 640` (1 frame/second) or
   `--frames 612.5,618` (full-resolution stills).
3. Identify the **series, season, episode, episode title** (file name hints, on-screen titles, dialogue, your own
   knowledge of the show — say how sure you are) and the **characters**: names from the dialogue, matched to faces by when
   they speak and who is on screen; their look from the stills. Write `series`, `season`, `episode`, `episode_title` into
   `<work>/episode.json` (keep the keys analyze.py wrote). Also identify the **places** — `reference/LOCATIONS.md` step 1–2.
4. Write `<work>/analysis.md` following `reference/ANALYSIS.md` (story beats, lore vs filler, strengths, weaknesses,
   viral moments). **This step and step 2 (the plan) are Opus-worthy: run them as ONE Opus sub-agent** that gets
   `overview.md`, `transcript.txt`, `scene_index.md`, the episode.json and ANALYSIS.md, and writes `analysis.md`,
   `plan.json`, `plan.md`.

## 2 · Plan the shorts
Follow `reference/ANALYSIS.md` → "Planning". Cover the **whole episode's relevant story, in order**; cut filler, keep
everything that matters for the lore. Target **60–90 s** per short; longer only when the content needs it, never over
**3:00** — split into two parts instead. Every short: a hook in the first 2 s, one clear arc, an ending that pulls to
the next short. `<work>/plan.json` + `plan.md`: number, working title, episode time range(s), beats, characters, mood,
estimated length (+ why if > 90 s), viral score 1–10 with the reason.

## 3 · Characters (vector sheets, reused across episodes)
Cast file: `<root>/Vibe-nimation episodes/_Personaje/<Series>/characters.json` — format and every option in
`reference/CHARACTERS.md`. If it exists (an earlier episode), reuse it and only add new characters or a changed look
(new outfit → a second spec, e.g. `mike_winter`). Every character gets **custom hair parameters and a face read + face
parameters from close stills of that person** — never a shared preset, never one spec reused for two people. Heights are
real: adult 1.0, kids 0.76–0.86 (they stay that small next to furniture, see Scale).
Then `python SKILL/scripts/vn.py cast "<work>"`: sheets, the QA matrices, `_Distributie.png`, `_verificare/_Fete.png`,
`_verificare/_review.png`. **Check in this order (cheapest first):**
1. the **automated rig test** that `cast` runs (hair coverage in all 8 views, back-of-head/neck axis, hands, arm roots) —
   read its text; a spec problem → fix the spec; a failure every character would share → fix the rig (Opus sub-agent),
   re-run for everyone;
2. **one image: `_verificare/_review.png`** (+ `_Fete.png` only when a face changed) — compare with the stills;
3. once before the stop, the sheets `<Name>.png` of the characters of the planned shorts — not every matrix cell of
   every character. Open a `_capete` / `_corp` matrix only for a character whose test or review looked wrong.
Iterate cheaply: `vn.py cast "<work>" --ids mike,will`. Never show the user a sheet you have not checked.

## 3b · Locations (vector sets, reused across episodes)
Follow `reference/LOCATIONS.md`: pull stills (`--frames`) and colours (`--palette`), copy the stills to
`_Locatii/<Series>/refs/`, write the module (`vn.py locations "<work>" --new <id>`, then rewrite it) and render
`vn.py locations "<work>"` (after a fix: `--ids <id>`). **Every module declares `meta.scale` and `meta.horizon` and
draws all its objects in METRES with `units(meta)`** (door 2.05 m, dresser 0.9 m …) — see **Scale** below; the sheet
shows a ruler and flags a missing scale. Series props (bike, phone, walkie, creature) go in `_Locatii/<Series>/props.js`
(`vn.py locations "<work>" --props`); `vn.py locations "<work>" --objects <id>` → `_Obiecte.png`: check every object from
every side. Open each location sheet once, compare the plate with the still side by side, fix until recognisable.
Then run `vn.py bible "<work>"` → `bible.md` (the only file later sessions need).

## 4 · Style
Read `reference/STYLE.md` once per session (the user's style sheet is `reference/style-sheet.webp`): 2D vector, comic,
clean lines, cel shading, cinematic lighting, 2.5D camera, same look in every episode. Scenes are re-created, not copied,
and made **more dramatic** than the original.

## 5 · STOP — the user approves (one message, in Romanian)
Show: the detected series / season / episode / title (and how sure you are), the cast with the path of
`_Distributie.png` and each sheet, the locations with each location sheet, and the plan as a numbered list — for each
short: title, what it covers (episode times), estimated length (and why if > 90 s), mood, viral score /10 with one line
of reason. Ask them to approve or change it. **Do not voice or animate anything until they say yes.** Apply their
changes and confirm; refresh `vn.py bible "<work>"`.

## 6 · Make each short (in order: 01, 02, …)
1. `python SKILL/scripts/vn.py new_short "<work>" <n>` → `<work>/shorts/NN/` (engine copy + cast + sets + skeletons).
2. **Script** — `script.json`, rules in `reference/SHOTS.md` → "Script": the narrator retells this part in his own
   words, present tense, punchy, ~150–160 words per minute; hook first; characters' key lines are said by the narrator
   with `"mime": "<id>"`; `emotion` 0.4 calm → 1.0 shouting.
3. `python SKILL/scripts/vn.py voice "<short>"` (background) → narration + word timings. Flagged lines: rephrase and
   re-voice with `--only 3,7`. `data/words.txt` has the timings.
4. **Shots — write a STORYBOARD, not code:** `src/shots.js` = `board(T, opts, [ one line per beat ])`
   (`reference/SHOTS.md` → Storyboard; the copied file is a working example). Each beat: line, shot type, set, who,
   expression changes on words, cam, fx, sound. Characters are placed at their true scale (`placeIn` in a location, shot
   helpers elsewhere). A shot the board cannot say → `custom:`. **Never draw a hand, arm or finger in `shots.js`:**
   every gesture and held object comes from the rig (`pose`, `hand`, `reach`, `hold`).
5. `python SKILL/scripts/vn.py build "<short>" --preview` → music (if missing), mix, error + **framing / scale / tiny /
   hand check** as text. **Fix every warning first (it costs no image).** Then open `review/all.jpg` **once**; for fixes
   re-capture only the changed moments (`node tools/capture.mjs frames review/f "12.3,40.1"` inside the short folder) and
   re-run `node tools/capture.mjs check S04,S05`.
6. `python SKILL/scripts/vn.py build "<short>"` (background, one wait) → `renders/short_share.mp4`. Look at 2–3 frames
   of the final file (ffmpeg `-ss`), the hook and the climax.
7. Fill `post.json` (`reference/POSTING.md`), then `python SKILL/scripts/vn.py deliver "<short>"`.
After each short, one line to the user. Continue with the next without asking (in a fresh session when the context is big).
**Work in parallel:** voicing and rendering run for minutes — start them in the background and write the next short's
script and storyboard meanwhile. Never run two builds of the same short at once; on a 16 GB machine one voice and one render at a time.

## 7 · Finish
Summarise in Romanian: the folder, every short with its title, length and score, anything you could not do well and why.
Offer precise changes ("short 3 slower", "Maya's jacket is green") and re-render only what changed.

## Rules
- **Scale (obligatory, constant):** people, doors, furniture keep real-world proportions in every shot of every short:
  adult 1.75 m, a child 1.33–1.5 m (never half the size next to the furniture), door 2.05 m, dresser/counter 0.9 m,
  table 0.75 m, ceiling 2.5 m. Ratios person↔person and person↔object never change inside a scene or between shorts of
  the same place. Write objects in metres (`units(meta)`), place people with `placeIn()`; a wide shot is made with the
  CAMERA (frame tighter, crop the room), never by shrinking the people. A far object is smaller only by perspective.
  `check` warns: pair scale mismatch, a marked object off its real size, a tiny figure (< 28 % of the frame).
- **Hands and held things belong to the rig:** a gesture (finger gun at the temple, pointing, a fist) = `pose` + `hand` +
  `reach` of `drawCharacter`; an object = `hold`. Never a hand/arm drawn separately; every character has exactly two arms
  rooted at its shoulders.
- Back views (`back: true`, with or without `turn`): the back of the head is a real skull and the neck follows the head's
  and shoulders' axis; check after any rig change with the rig test, not by eye.
- Captions: the current default style (white, black outline, the spoken word in yellow, pop-in) is the user's approved
  look — keep it unless they ask.
- Never put the episode's own audio, music, footage or frames into a short. Everything on screen is drawn in code;
  everything heard is the local narrator, the generated score and synthesized sound effects.
- The narration is an original retelling (commentary/recap), not a transcript; quote characters only briefly.
- No gore or explicit content on screen even if the show has it: cut away, use silhouettes, light flashes, reactions.
- Keep each series' characters identical across episodes: always reuse the cast file, never redraw from scratch.
- Never overwrite a delivered short or a cast file without saying so; `deliver` replaces only the same short number.
- Long jobs (voice on CPU, final renders): run them and report progress; never claim a render you did not run.

## Gotchas
- Windows: use `python` (not `python3`), quote paths with spaces, and open a NEW terminal after installing Node/ffmpeg.
- `T.w()` never fails: a misspelled word silently returns the line start — check `data/words.txt`.
- Re-voicing shifts timings: re-check `word@` beats; re-run `build` (meta → mix) after any change to shots or script.
- Don't run `mix` while a render is muxing (`build` does them in order).
- `build --draft` is a fast half-size render for timing checks only.
- If Chrome/Edge is not found, set `CHROME=<path to chrome.exe or msedge.exe>`.
- `usage_report.py` and `bible.py` need only the standard library: they also run with a plain `python`.
