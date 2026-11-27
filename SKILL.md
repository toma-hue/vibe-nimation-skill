---
name: vibe-nimation
description: Turn a TV-series episode (a 20–40 min video file) into a set of narrated, animated 9:16 shorts for TikTok and YouTube Shorts, in one fixed 2D vector comic style with cutout/puppet-rigged characters and 2.5D parallax camera moves, all drawn in code on the user's computer for $0 (local Chatterbox narrator, local Whisper, no APIs). Analyses the episode (scenes, transcript, strengths/weaknesses, viral potential), detects the series, episode, characters and locations, builds vector character sheets and re-creates every place of the episode faithfully as a vector set, plans shorts that cover the episode's story in order, stops for the user's approval, then voices, animates, scores, mixes, renders and delivers each short with a .txt of title, description, hashtags and a 1–10 viral score. Use whenever the user gives an episode / video file to turn into animated shorts, recap shorts, "vibe-nimation", or asks to continue, fix or re-render one of these shorts or character sheets.
---

# Vibe-nimation — episode → animated narrated shorts

`SKILL` = the folder this file is in. Run every tool through the launcher: `python SKILL/scripts/vn.py <tool> …`
(on macOS/Linux `python3`). Paths with spaces go in double quotes. **Talk to the user in Romanian**; everything that
goes into the videos and post texts is in **English**.

The user gives you only the episode file. You do everything else, with ONE stop for approval (step 5).

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
<root>\_lucru\<episode-id>\  analysis\, plan.md, plan.json, cast_render\, shorts\01\, shorts\02\ …   (work files)
```

## 1 · Analyse the episode
`python SKILL/scripts/vn.py analyze "<episode file>"` (≈5–15 min for 40 min on a CPU). It prints the work folder.
Then, in this order, and do not skip any of it:
1. Read `analysis/overview.md` (every scene: time, length, loudness ★, its dialogue, its pack/sheet; credit and logo
   scenes are already detected and marked, not in the packs) and `transcript.txt`.
2. **Open every pack** in `analysis/packs/` (4 contact sheets = 80 frames per image, time + scene number under each
   frame). This is how you "watch" the episode: who is on screen, where, what happens, how it looks. While you watch,
   fill the **place** and **who** columns of `analysis/scene_index.md` — from here on read that text instead of
   reopening images. Only for a moment you need in detail: `vn.py analyze "<file>" --clip 612 640` (1 frame/second) or
   `--frames 612.5,618` (full-resolution stills); a single sheet from `analysis/sheets/` to look closer at one part.
3. Identify the **series, season, episode, episode title** (file name hints, on-screen titles, dialogue, your own
   knowledge of the show — say how sure you are) and the **characters**: names from the dialogue (people addressing each
   other), matched to faces by when they speak and who is on screen; their look from the stills (hair style and colour,
   skin, clothes and colours, build, age, glasses, accessories). Write `series`, `season`, `episode`, `episode_title`
   into `<work>/episode.json` (keep the keys analyze.py wrote).
   Also identify the **places** (locations): group the scenes by place and note what each contains in detail —
   `reference/LOCATIONS.md` step 1–2.
4. Write `<work>/analysis.md` (internal, for you; the user does not need it): follow `reference/ANALYSIS.md` — story
   beats in order, lore-critical vs filler, strengths and weaknesses (pacing, dialogue, emotion, humour, filler,
   visuals, cliffhangers), and the moments with viral potential (hook, conflict, punchline, emotion, controversy, twist).

## 2 · Plan the shorts
Follow `reference/ANALYSIS.md` → "Planning". Cover the **whole episode's relevant story, in order**, as a continuous
series of shorts; cut filler, keep everything that matters for the lore. Target **60–90 s** per short; longer only when
the content needs it, never over **3:00** (YouTube's Shorts limit) — split into two parts instead. Every short: a hook in
the first 2 s, one clear arc, an ending that pulls to the next short. Write `<work>/plan.json` + `plan.md`: number,
working title, episode time range(s) covered, beats, characters, mood, estimated length (+ why if > 90 s),
viral score 1–10 with the reason.
**Every short scored below 7 gets the drama boost** (`reference/ANALYSIS.md` → "Drama boost"): open on the strongest
moment of its part (in media res, then back to the start), name the stakes, stronger lines, emotion, shots, FX, music
and a harder cliffhanger — same events, same meaning, nothing invented. Then re-score it honestly; the target is ≥ 7.
Note in plan.json `boost` what changed (score before → after).

## 3 · Characters (vector sheets, reused across episodes)
Cast file: `<root>/Vibe-nimation episodes/_Personaje/<Series>/characters.json` — format and every option in
`reference/CHARACTERS.md`. If it exists (an earlier episode), reuse it and only add new characters or a changed look
(new outfit → a second spec, e.g. `mike_winter`). Main and recurring characters get specs; one-scene extras can reuse a
generic spec with different colours. Every character gets **custom hair parameters and a face read + face parameters from close stills of that person**
(`reference/CHARACTERS.md` → Hair, Face) — never a shared preset, never one spec reused for two people.
Then `python SKILL/scripts/vn.py cast "<work>"` → per character: the sheet (`<Name>.png`: turnaround front / 3/4 /
back / profile, expressions in every view, poses, palette), the two QA matrices (`_verificare/<Name>_capete.png` =
6 views × 8 expressions, `_verificare/<Name>_corp.png` = 10 poses × 5 views), `_Distributie.png`, the face lineup
`_verificare/_Fete.png` (every head front + 3/4 with the hair as a flat silhouette) and the review pack
`_verificare/_review.png` (the line-up + one row of heads per character rendered this time).
**Iterate cheaply:** after a fix re-render only what changed (`vn.py cast "<work>" --ids mike,will`) and open the one
image `_verificare/_review.png` (+ `_Fete.png` when a face changed).
**Mandatory review, once before the stop — open every sheet, both matrices of every character and `_Fete.png`, cell
by cell** (checklist in `reference/CHARACTERS.md` → "Check"; no two main characters with the same hair silhouette or
face read; no outline inside the hair): recognisable vs the stills; in EVERY view the hair covers the head (no bald
sides or temples, sideburns/hairline right), caps/hats/glasses sit on the head; every expression reads as its name in
every view; every pose has attached limbs and both feet on the floor line. A problem in one character's spec → fix
the spec; a problem every character would share → fix the rig (`SKILL/engine/src/core/rig.js`, `hair.js`, `face.js`)
and re-run `cast` for everyone. Never show the user a sheet you have not checked.

## 3b · Locations (vector sets, reused across episodes)
Follow `reference/LOCATIONS.md`: for every place the shorts use, pull stills (`--frames`) and colours (`--palette`),
copy the stills to `_Locatii/<Series>/refs/`, write the module (`vn.py locations "<work>" --new <id>`, then rewrite it),
and render `vn.py locations "<work>"` (after a fix: `--ids <id>`, only that sheet). Objects the series keeps using (a
bike, a phone, a walkie, a creature) go in the shared `_Locatii/<Series>/props.js` (`vn.py locations "<work>" --props`
starts it from the engine's default props); every short gets a copy. Then render **`vn.py locations "<work>" --objects <id>`**
→ `_Obiecte.png` (riding a bike, the bike, held props and every series prop × all 8 views) and check that each object
reads right from every side — front wheel in front of the legs when riding toward the camera, held things hidden by the
hand from behind; a vehicle or anything ridden uses `rideBike` / a 3D prop (reference/SHOTS.md → Props). **Open every location sheet** and compare the vector plate with the still side
by side (layout, big shapes, colours, light, signature details, scale, no black in the 9:16 frames); fix until it is
recognisably the same place. Reuse existing modules from earlier episodes.

## 4 · Style
Read `reference/STYLE.md` once per session (the user's style sheet is `reference/style-sheet.webp`): 2D vector, comic,
clean lines, cel shading, cinematic lighting (warm rim, cool shadows), 2.5D camera, same look in every episode.
Scenes are re-created, not copied, and made **more dramatic** than the original: stronger angles, camera moves,
expression changes on the beat, impact FX on the peaks.

## 5 · STOP — the user approves (one message, in Romanian)
Show: the detected series / season / episode / title (and how sure you are), the cast with the path of
`_Distributie.png` and each sheet, the locations with each location sheet, and the plan as a numbered list — for each short: title, what it covers (episode
times), estimated length (and why if > 90 s), mood, viral score /10 with one line of reason (for a boosted short: the score before → after and, in one line, what
the boost changed). Ask them to approve or
change it. **Do not voice or animate anything until they say yes.** Apply their changes (plan, characters or locations) and confirm.

## 6 · Make each short (in order: 01, 02, …)
1. `python SKILL/scripts/vn.py new_short "<work>" <n>` → `<work>/shorts/NN/` (engine copy + cast + skeletons).
2. **Script** — `script.json`, rules in `reference/SHOTS.md` → "Script": the narrator retells this part in his own
   words, present tense, punchy, dramatic, ~150–160 words per minute; hook first; characters' key lines are said by
   the narrator with `"mime": "<id>"` so the character mouths them (short, only the lines that matter, a few per short);
   `emotion` 0.4 calm → 1.0 shouting. **Cold open:** line 0 is the hook and is heard from the very first frame — no
   intro, no lead-in, no "In this episode…". A boosted short (score < 7) follows its boost plan from the plan.
3. `python SKILL/scripts/vn.py voice "<short>"` → narration + word timings. Lines that don't match the script after 4
   takes are flagged: rephrase them and re-voice with `--only 3,7`. Read `data/words.txt` for timings.
4. **Shots** — rewrite `src/shots.js` (the copied file is a complete working example: study it). One shot per beat
   (~2–5 s), cut on the narration (`T.L(i) - 0.15`), camera always moving, mix wide / medium / close-up / extreme
   close-up / over-the-shoulder, expression changes and FX land on words (`T.w('word', T.L(i))`), mimed lines use
   `talk: T.talk(id, t)`. Every scene uses its **location module** from `src/sets/` (step 3b), not a generic set, and
   the series' props from `src/props.js`. **Frame with the shot helpers** (`wide`, `medium`, `closeUp`,
   `extremeCloseUp`, `twoShot` — kids and adults frame the same) and aim at anything on another parallax layer with
   `focus(x, y, f)`; deliberate exits go in the shot's `allowOff`. Sets, poses, expressions, views, FX, sound cues and
   music mood: `reference/SHOTS.md`.
5. `python SKILL/scripts/vn.py build "<short>" --preview` → music (if missing), mix, error + **framing check** (text:
   any character, face or marked prop off the 9:16 frame or under the captions, per shot), `review/all.jpg`.
   Fix every framing warning first (it costs no image). An `OPENING` warning (frame 0 dark, first word late) you fix
   yourself and re-check — never mention it to the user. Then **open `review/all.jpg` once** and check every shot
   against `reference/STYLE.md` → "Check". For fixes, don't rebuild and reopen the whole sheet: re-capture only the
   2–3 changed moments, `node tools/capture.mjs frames review/f "12.3,40.1"` (or `sheet review/fix.jpg "12.3,40.1"`)
   inside the short folder, and run `node tools/capture.mjs check S04,S05` for the changed shots.
6. `python SKILL/scripts/vn.py build "<short>"` → `renders/short_share.mp4` (~1.5–3 min per minute of video with 4 workers).
   Look at 3–4 frames of the final file (ffmpeg `-ss`), especially the hook and the climax.
7. Fill `post.json` (`reference/POSTING.md`: title, description, hashtags, score, reason, covers), then
   `python SKILL/scripts/vn.py deliver "<short>"` → the .mp4 and .txt land in the episode folder.
After each short, tell the user in one line what was delivered. Continue with the next without asking.

**Work in parallel:** voicing (`voice`) and rendering (`build`) run for minutes — start them in the background and
meanwhile write the next short's `script.json` and `shots.js` (its `new_short` folder can exist already). Never run two
builds of the same short at once; on a 16 GB machine run one voice and one render at a time.

## 7 · Finish
Summarise in Romanian: the folder, every short with its title, length and score, anything you could not do well and why.
Offer precise changes ("short 3 slower", "Maya's jacket is green") and re-render only what changed.

## Rules
- **Every short opens cold:** frame 0 is the full picture of S01 and the first line starts at once. Never a fade from
  black, a black frame, bars coming in or a silent lead-in at the start (voice.py forces no lead-in, the music starts at
  full level, the engine ignores `fade()` in the first second). The fade to black at the **end** stays.
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
- Re-voicing shifts timings: re-check `T.w(...)` beats; re-run `build` (meta → mix) after any change to shots or script.
- Don't run `mix` while a render is muxing (`build` does them in order — just don't run two builds of one short at once).
- `build --draft` is a fast half-size render for timing checks only.
- If Chrome/Edge is not found, set `CHROME=<path to chrome.exe or msedge.exe>`.
