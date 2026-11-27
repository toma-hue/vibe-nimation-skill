"""Start a short: a self-contained render project with the engine, the cast and a script skeleton.

  python scripts/vn.py new_short <work-dir> 3          → <work>/shorts/03/
  python scripts/vn.py new_short <work-dir> 3 --refresh  re-copy the engine + cast, keep script.json, shots.js, data, audio

Copies the current engine (rig.js, hair.js, face.js, scene.js …), the cast, the series' location modules (src/sets/) and its
props.js (src/props.js). --refresh re-copies them all into an existing short (never script.json, shots.js, data, audio).
Then: write script.json → vn.py voice → write src/shots.js → vn.py build --preview → look → vn.py build → vn.py deliver.
"""
import argparse, json, shutil, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import cast_dir, copy_engine, episode_meta, load_config  # noqa: E402

SKELETON = {
    "tail": 1.2,
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
    # the series' location modules → src/sets/ (import * as diner from './sets/diner.js')
    from common import episodes_root, safe_name
    LD = Path(meta['locations_dir']) if meta.get('locations_dir') else episodes_root(cfg) / '_Locatii' / safe_name(meta.get('series', 'Unknown series'))
    (P / 'src' / 'sets').mkdir(exist_ok=True)
    for m in sorted(LD.glob('*.js')) if LD.exists() else []:
        if m.name == 'props.js': shutil.copy2(m, P / 'src' / 'props.js')        # the series' shared props replace the default
        else: shutil.copy2(m, P / 'src' / 'sets' / m.name)
    if not (P / 'script.json').exists(): (P / 'script.json').write_text(json.dumps(SKELETON, indent=1), encoding='utf-8')
    if not (P / 'post.json').exists():
        (P / 'post.json').write_text(json.dumps({"number": a.n, "title": "", "description": "", "hashtags": [], "score": 0, "score_reason": "", "covers": ""}, indent=1), encoding='utf-8')
    print(P)


if __name__ == '__main__':
    main()
