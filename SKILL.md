---
name: vibe-nimation
description: Turn a TV-series episode (a 20–40 min video file) into a set of narrated, animated 9:16 shorts for TikTok and YouTube Shorts, in one fixed 2D vector comic style with cutout/puppet-rigged characters and 2.5D parallax camera moves, all drawn in code on the user's computer for $0 (local Chatterbox narrator, local Whisper, no APIs). Analyses the episode (scenes, transcript, strengths/weaknesses, viral potential), detects the series, episode and characters, builds vector character sheets, plans shorts that cover the episode's story in order, stops for the user's approval, then voices, animates, scores, mixes, renders and delivers each short with a .txt of title, description, hashtags and a 1–10 viral score. Use whenever the user gives an episode / video file to turn into animated shorts, recap shorts, "vibe-nimation", or asks to continue, fix or re-render one of these shorts or character sheets.
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
<root>\Vibe-nimation episodes\_Personaje\<Series>\characters.json + <Name>.png + _Distributie.png   (shared by all episodes)
<root>\Vibe-nimation episodes\<Series> - S01E01\S01E01 - Short 01 - <Title>.mp4 + .txt              (the deliverables)
<root>\_lucru\<episode-id>\  analysis\, plan.md, plan.json, cast_render\, shorts\01\, shorts\02\ …   (work files)
```

## 1 · Analyse the episode
`python SKILL/scripts/vn.py analyze "<episode file>"` (≈5–15 min for 40 min on a CPU). It prints the work folder.
Then, in this order, and do not skip any of it:
1. Read `analysis/overview.md` (every scene: time, length, loudness ★, its dialogue, its sheet) and `transcript.txt`.
2. **Open every contact sheet** in `analysis/sheets/` (20 frames each, time + scene number under each frame). This is
   how you "watch" the episode: who is on screen, where, what happens, how it looks. For a moment you need in detail:
   `vn.py analyze "<file>" --clip 612 640` (1 frame/second) or `--frames 612.5,618` (full-resolution stills).
3. Identify the **series, season, episode, episode title** (file name hints, on-screen titles, dialogue, your own
   knowledge of the show — say how sure you are) and the **characters**: names from the dialogue (people addressing each
   other), matched to faces by when they speak and who is on screen; their look from the stills (hair style and colour,
   skin, clothes and colours, build, age, glasses, accessories). Write `series`, `season`, `episode`, `episode_title`
   into `<work>/episode.json` (keep the keys analyze.py wrote).
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

## 3 · Characters (vector sheets, reused across episodes)
Cast file: `<root>/Vibe-nimation episodes/_Personaje/<Series>/characters.json` — format and every option in
`reference/CHARACTERS.md`. If it exists (an earlier episode), reuse it and only add new characters or a changed look
(new outfit → a second spec, e.g. `mike_winter`). Main and recurring characters get specs; one-scene extras can reuse a
generic spec with different colours. Then `python SKILL/scripts/vn.py cast "<work>"` → one sheet per character
(turnaround, expressions, poses, palette) + `_Distributie.png`. **Look at every sheet**; fix specs until each character
is recognisable (hair shape and colour, signature clothing colours, glasses, build) and re-run.

## 4 · Style
Read `reference/STYLE.md` once per session (the user's style sheet is `reference/style-sheet.webp`): 2D vector, comic,
clean lines, cel shading, cinematic lighting (warm rim, cool shadows), 2.5D camera, same look in every episode.
Scenes are re-created, not copied, and made **more dramatic** than the original: stronger angles, camera moves,
expression changes on the beat, impact FX on the peaks.

## 5 · STOP — the user approves (one message, in Romanian)
Show: the detected series / season / episode / title (and how sure you are), the cast with the path of
`_Distributie.png` and each sheet, and the plan as a numbered list — for each short: title, what it covers (episode
times), estimated length (and why if > 90 s), mood, viral score /10 with one line of reason. Ask them to approve or
change it. **Do not voice or animate anything until they say yes.** Apply their changes (plan or characters) and confirm.

## 6 · Make each short (in order: 01, 02, …)
1. `python SKILL/scripts/vn.py new_short "<work>" <n>` → `<work>/shorts/NN/` (engine copy + cast + skeletons).
2. **Script** — `script.json`, rules in `reference/SHOTS.md` → "Script": the narrator retells this part in his own
   words, present tense, punchy, dramatic, ~150–160 words per minute; hook first; characters' key lines are said by
   the narrator with `"mime": "<id>"` so the character mouths them (short, only the lines that matter, a few per short);
   `emotion` 0.4 calm → 1.0 shouting.
3. `python SKILL/scripts/vn.py voice "<short>"` → narration + word timings. Lines that don't match the script after 4
   takes are flagged: rephrase them and re-voice with `--only 3,7`. Read `data/words.txt` for timings.
4. **Shots** — rewrite `src/shots.js` (the copied file is a complete working example: study it). One shot per beat
   (~2–5 s), cut on the narration (`T.L(i) - 0.15`), camera always moving, mix wide / medium / close-up / extreme
   close-up / over-the-shoulder, expression changes and FX land on words (`T.w('word', T.L(i))`), mimed lines use
   `talk: T.talk(id, t)`. Sets, poses, expressions, FX, sound cues and music mood: `reference/SHOTS.md`.
5. `python SKILL/scripts/vn.py build "<short>" --preview` → music (if missing), mix, error check, `review/all.jpg`.
   **Open `review/all.jpg`** and check every shot against `reference/STYLE.md` → "Check". For details:
   `node tools/capture.mjs frames review/f "12.3,40.1"` inside the short folder. Fix and re-run until right.
6. `python SKILL/scripts/vn.py build "<short>"` → `renders/short_share.mp4` (~1.5–3 min per minute of video with 4 workers).
   Look at 3–4 frames of the final file (ffmpeg `-ss`), especially the hook and the climax.
7. Fill `post.json` (`reference/POSTING.md`: title, description, hashtags, score, reason, covers), then
   `python SKILL/scripts/vn.py deliver "<short>"` → the .mp4 and .txt land in the episode folder.
After each short, tell the user in one line what was delivered. Continue with the next without asking.

## 7 · Finish
Summarise in Romanian: the folder, every short with its title, length and score, anything you could not do well and why.
Offer precise changes ("short 3 slower", "Maya's jacket is green") and re-render only what changed.

## Rules
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
