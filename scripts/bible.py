"""The episode bible: ONE small text file (<work>/bible.md) with everything a fresh session needs to make the next short —
so no session has to re-read the analysis, the cast file, the location modules or look at any image again.

  python scripts/vn.py bible <work-dir>        (re)write <work>/bible.md from episode.json, plan.json, the cast file and the
                                                location modules; keep it up to date by running it again after any change

It holds: series/episode, the cast (id, name, true height in metres, one-line look, colours), the locations (id, name, scale,
what is in them), the scale table, the plan (short number, title, covers, mood, hook, ending) and which shorts are delivered.
A new session (or a sub-agent) starts a short with:  bible.md + plan.json entry + script rules — about 2–4 K tokens instead of
the 25 K of docs and the hundred of images the first session needed.
"""
import argparse, json, re, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import cast_dir, episode_meta, episodes_root, load_config, safe_name  # noqa: E402


def js_meta(path):
    t = path.read_text(encoding='utf-8', errors='ignore')
    g = lambda k, rx=r"['\"]?([^,'\"}\n]+)": (re.search(rf"\b{k}\s*:\s*" + rx, t) or [None, ''])[1].strip()
    notes = re.search(r"notes\s*:\s*(['\"`])(.*?)\1\s*[,}]", t, re.S)
    return dict(id=path.stem, name=g('name'), floor=g('floor'), scale=g('scale'), horizon=g('horizon'), times=g('times', r"\[([^\]]*)\]"),
                notes=(notes.group(2) if notes else '').replace('\n', ' ')[:240])


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('work'); a = ap.parse_args()
    W = Path(a.work); cfg = load_config(); meta = episode_meta(W)
    L = [f'# Bible — {meta.get("series", "?")} S{int(meta.get("season", 0) or 0):02d}E{int(meta.get("episode", 0) or 0):02d} "{meta.get("episode_title", "")}"',
         f'work: {W}', '']
    cf = Path(meta['cast_file']) if meta.get('cast_file') else cast_dir(meta, cfg) / 'characters.json'
    if cf.exists():
        d = json.loads(cf.read_text(encoding='utf-8')); chars = d.get('characters', d)
        L += ['## Cast (use these ids; true height = 1.75 m × height)', '| id | name | height m | look |', '|---|---|---|---|']
        for c in chars:
            b = c.get('build') or {}; L.append(f'| {c["id"]} | {c.get("name", "")} | {1.75 * (b.get("height") or 1):.2f} | {(c.get("look") or c.get("faceRead") or "")[:110]} |')
        L.append('')
    LD = Path(meta['locations_dir']) if meta.get('locations_dir') else episodes_root(cfg) / '_Locatii' / safe_name(meta.get('series', 'Unknown series'))
    mods = [p for p in sorted(LD.glob('*.js')) if p.name != 'props.js'] if LD.exists() else []
    if mods:
        L += ['## Locations (import * as <id> from "./sets/<id>.js"; place actors with placeIn(<id>.meta, S, {x}))', '| id | name | scale | horizon | times | in it |', '|---|---|---|---|---|---|']
        for p in mods:
            m = js_meta(p); L.append(f'| {m["id"]} | {m["name"]} | {m["scale"] or "MISSING"} | {m["horizon"] or "MISSING"} | {m["times"]} | {m["notes"]} |')
        L.append('')
    L += ['## Scale rule', 'People: adult 1.75 m, kids 0.76–0.86 × that (1.33–1.5 m) — never drawn smaller than their build says next to furniture.',
          'Door 2.05 m · dresser/counter 0.9 m · table 0.75 m · chair seat 0.45 m · ceiling 2.5 m. Draw with units(meta).h(metres, baseY); place with placeIn().',
          'Wide shots: kids ≥ 28 % of the frame height (frame tighter, never shrink people). `check` warns on every break.', '']
    pj = W / 'plan.json'
    if pj.exists():
        plan = json.loads(pj.read_text(encoding='utf-8')); L += ['## Plan', '| n | title | covers | mood | hook → ending | done |', '|---|---|---|---|---|---|']
        out = episodes_root(cfg)
        for s in plan.get('shorts', []):
            done = any(out.glob(f'*/*Short {s["n"]:02d} -*.mp4')) if out.exists() else False
            L.append(f'| {s["n"]:02d} | {s.get("title", "")} | {", ".join(s.get("covers", []))} | {s.get("mood", "")} | {s.get("hook", "")} → {s.get("ending", "")} | {"yes" if done else ""} |')
        L.append('')
    if pj.exists():
        todo = [x for x in plan.get('shorts', []) if not any(out.glob(f'*/*Short {x["n"]:02d} -*.mp4'))] if out.exists() else plan.get('shorts', [])
        if todo:
            ns = [f'{x["n"]:02d}' for x in todo[:3]]
            L += ['## Next (paste this into a FRESH session after /clear)',
                  f'> Folosește vibe-nimation și continuă episodul din {W}. Citește doar bible.md și plan.json. Fă short-urile {", ".join(ns)} (câte unul, în ordine), fără să redeschizi analiza sau fișele personajelor.', '']
        else: L += ['## Next', 'All shorts delivered.', '']
    (W / 'bible.md').write_text('\n'.join(L), encoding='utf-8'); print(W / 'bible.md', f'({len(chr(10).join(L))} chars)')


if __name__ == '__main__':
    main()
