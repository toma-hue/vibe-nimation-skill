# Third-party components

Bundled:
- Fonts from Google Fonts, SIL Open Font License 1.1: Montserrat, Anton, Bangers, Inter (`engine/fonts/`).
- `engine/tools/capture.mjs` and `scripts/music_ai/*.py` are adapted from the *faceless-videos* skill, whose code is
  "free to use, remix and share".
- `voice/narrator_C.wav`: a reference clip made locally with Kokoro-82M (Apache-2.0), pitched down; Chatterbox clones
  its timbre for the narrator.
- `reference/style-sheet.webp`: the user's own style sheet.

Installed on first use (not bundled):
- Chatterbox TTS (MIT, Resemble AI) — narrator voice; it adds an inaudible PerTh watermark to generated speech.
- faster-whisper (MIT) + Whisper small.en (MIT) — transcription and word timings.
- PyTorch (BSD), numpy, scipy, soundfile, Pillow, pyloudnorm.
- Optional: ACE-Step 1.5 (MIT) — AI music.

Everything the skill draws (characters, sets, effects), its scores and sound effects are generated in code at render
time. The shorts never contain the source episode's audio or images.
