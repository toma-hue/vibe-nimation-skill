# Episode analysis and planning

## Watching the episode
You "watch" through three sources together: the contact sheets (what is seen), the transcript (what is said), the
loudness ★ (where the action, music and shouting are). Read them scene by scene, in order. When a scene matters and the
sheet is not enough, pull a 1 fps clip sheet or full stills. Note for each scene: place, time of day, who is there,
what happens, what changes (the beat), and any line worth quoting.

## analysis.md (internal)
1. **Identity** — series, season, episode, title, and how you know (file name, title card, dialogue, knowledge).
2. **Characters** — name, how you identified them (who calls whom what), look (for the spec), role in this episode.
3. **Story beats** — numbered, in order, with episode times: `B07 [14:20–16:05] Mike finds the gate … (lore: yes)`.
   Mark each beat **lore** (needed to understand the series), **arc** (this episode's plot), or **filler** (small talk,
   repeated information, transitions, scenery).
4. **Strengths** — what works and must survive into the shorts: strongest scenes, best lines, reveals, emotional peaks,
   humour, visual moments.
5. **Weaknesses** — what the shorts should fix or skip: slow stretches, exposition dumps, repeated beats, confusing
   cuts, flat scenes that need dramatising.
6. **Viral potential** — rate each candidate moment 1–10 on: hook (would someone stop scrolling in 2 s?), conflict,
   emotion, surprise/twist, punchline/humour, controversy or debate (comments), relatability, cliffhanger (part 2 pull).

## Planning
- Cover the episode **in story order** as a series of shorts a viewer can follow from 01 to the last; every lore/arc
  beat appears in some short; filler is cut or reduced to a narrator half-sentence.
- **60–90 s** each (≈150–230 narrated words). Longer only to avoid cutting needed content, max 3:00 — otherwise split.
  A 40-minute episode usually gives ~8–15 shorts.
- Each short: **hook** (the most gripping line or image of that part, first — a question, a threat, a reveal, an
  in-media-res moment), **one arc**, an **ending that pulls** (unanswered question, cliffhanger, reaction shot).
- Short 01 also orients a new viewer in one sentence (who, where); later shorts can open with "Last time…" only if
  needed in a few words.
- The narrator may reorder within a short for the hook (flash-forward), but the shorts as a series stay in order.

plan.json:
```json
{"series": "…", "label": "S01E01", "shorts": [
  {"n": 1, "title": "working title", "covers": ["00:00–03:40", "05:10–06:00"], "beats": ["B01", "B02", "B04"],
   "characters": ["mike", "will"], "mood": "mystery", "est_seconds": 75, "why_long": "",
   "hook": "first line idea", "ending": "cliffhanger idea", "score": 8, "score_reason": "…"}]}
```

## Viral score (1–10, the same rubric for plan and .txt)
- 9–10: an unmissable hook + a twist or huge emotional/comedic payoff; people will comment and share.
- 7–8: strong hook and a clear conflict or payoff; good part-2 pull.
- 5–6: solid story beat, needed for the series, but no standout moment.
- 3–4: mostly setup or quiet; kept because the story needs it.
- 1–2: only kept for continuity.
Give one honest sentence of reason. Don't inflate: a series needs its 5s too.
