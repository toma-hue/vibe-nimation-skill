# post.json → the .txt next to each short

```json
{"number": 3, "title": "He Saw Something In The Woods",
 "description": "Will takes the shortcut home… and something is waiting in the dark. Part 3 of Stranger Things S1E1, animated.",
 "hashtags": ["strangerthings", "animation", "2danimation", "recap", "netflix", "fyp", "shorts", "horror"],
 "score": 8, "score_reason": "Cold-open chase with a monster reveal: strong hook and a cliffhanger.",
 "covers": "07:40–10:15 Will's ride home, the shed"}
```
- **title** (≤ 60 characters, English): curiosity or stakes, no spoilers of the twist, no clickbait lies.
  Patterns: "He Shouldn't Have Opened That Door", "The Moment Everything Changed", "She Knew All Along".
  A boosted short gets the punchiest title of the set: lead with the stakes or the peak it opens on ("Nobody Knows
  She Heard That", "One Lie Away From Losing Everything") — still true to what happens.
- **description** (1–2 sentences + where it sits: "Part 3 of <Series> S1E1, animated."). Name the series (search).
- **hashtags** (6–10): the series name (no spaces), 1–2 characters if famous, the genre, `animation` `2danimation`,
  `recap`, the platform/broad ones (`fyp`, `shorts`). One set works for both TikTok and YouTube.
- **score** 1–10 + **score_reason**: the rubric in ANALYSIS.md, honest.
- **covers**: episode time range(s) and what happens — so the user knows where it comes from.

`vn.py deliver` writes `<Series> - S01E01/S01E01 - Short 03 - <Title>.mp4` and the `.txt` (Romanian labels).
