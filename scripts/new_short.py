"""Start a short: a self-contained render project with the engine, the cast and a script skeleton.

  python scripts/vn.py new_short <work-dir> 3          → <work>/shorts/03/
  python scripts/vn.py new_short <work-dir> 3 --refresh  re-copy the engine + cast, keep script.json, shots.js, data, audio

Then: write script.json → vn.py voice → write src/shots.js → vn.py build --preview → look → vn.py build → vn.py deliver.
"""
import argparse, json, shutil, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import cast_dir, copy_engine, episode_meta, load_config  # noqa: E402

SKELETON = {
    "lead_in": 0.4, "tail": 1.2,
    "lines": [
        {"text": "Hook: the most gripping sentence of this part, first.", "emotion": 0.7, "gap": 0.35},
        {"text": "A character's own line, said by the narrator and mimed on screen.", "emotion": 0.85, "mime": "<character id>", "gap": 0.4},
    ],
}


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('work'); ap.add_argument('n', type=int); ap.add_argument('--refresh', action='store_true')
    a = ap.parse_args(); cfg = load_config(); W = Path(a.work); meta = episode_meta(W)
    P = W / 'shorts' / f'{a.n:02d}'
    fresh = not P.exists()
    if not fresh and not a.refresh: sys.exit(f'{P} exists (use --refresh to update its engine and cast)')
    copy_engine(P)
    cf = Path(meta['cast_file']) if meta.get('cast_file') else cast_dir(meta, cfg) / 'characters.json'
    if cf.exists(): shutil.copy2(cf, P / 'data' / 'characters.json')
    else: print('! no cast file yet — run vn.py cast first; characters will be missing')
    if not (P / 'script.json').exists(): (P / 'script.json').write_text(json.dumps(SKELETON, indent=1), encoding='utf-8')
    if not (P / 'post.json').exists():
        (P / 'post.json').write_text(json.dumps({"number": a.n, "title": "", "description": "", "hashtags": [], "score": 0, "score_reason": "", "covers": ""}, indent=1), encoding='utf-8')
    print(P)


if __name__ == '__main__':
    main()
