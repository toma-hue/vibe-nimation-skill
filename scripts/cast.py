"""Character sheets for a series' cast (vector, drawn from the specs).

  python scripts/vn.py cast <work-dir>                 every character in the cast file → sheets + a cast line-up
  python scripts/vn.py cast <work-dir> --ids mike,el   only these

The cast file is Vibe-nimation episodes/_Personaje/<Series>/characters.json (reference/CHARACTERS.md). It is
shared by every episode of the series: add new characters to it, never start a second one.
Writes next to it: <Name>.png (sheet) and _Distributie.png (everyone side by side).
"""
import argparse, json, shutil, subprocess, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import cast_dir, copy_engine, episode_meta, load_config, node_env, safe_name, save_episode_meta  # noqa: E402


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('work'); ap.add_argument('--ids'); a = ap.parse_args()
    cfg = load_config(); W = Path(a.work); meta = episode_meta(W)
    if not meta.get('series'): sys.exit('episode.json has no "series" yet: write series/season/episode into it first')
    C = cast_dir(meta, cfg); C.mkdir(parents=True, exist_ok=True); cf = C / 'characters.json'
    if not cf.exists(): sys.exit(f'no cast file yet: write {cf} (see reference/CHARACTERS.md)')
    data = json.loads(cf.read_text(encoding='utf-8')); chars = data.get('characters', data)
    ids = set(a.ids.split(',')) if a.ids else {c['id'] for c in chars}
    R = copy_engine(W / 'cast_render'); shutil.copy2(cf, R / 'data' / 'characters.json')
    node, env, made = shutil.which('node'), node_env(cfg), []
    for c in chars:
        if c['id'] not in ids: continue
        out = C / f'{safe_name(c["name"])}.png'
        r = subprocess.run([node, 'tools/page.mjs', f'sheet.html?id={c["id"]}', str(out)], cwd=R, env=env, capture_output=True, text=True)
        print(out if r.returncode == 0 else f'FAILED {c["id"]}: {r.stderr[-400:]}'); made.append(out)
    r = subprocess.run([node, 'tools/page.mjs', 'sheet.html?cast=1', str(C / '_Distributie.png')], cwd=R, env=env, capture_output=True, text=True)
    print(C / '_Distributie.png' if r.returncode == 0 else f'FAILED cast: {r.stderr[-400:]}')
    meta['cast_file'] = str(cf); save_episode_meta(W, meta)


if __name__ == '__main__':
    main()
