"""Character sheets for a series' cast (vector, drawn from the specs).

  python scripts/vn.py cast <work-dir>                 every character in the cast file → sheets + a cast line-up
  python scripts/vn.py cast <work-dir> --ids mike,el   only these

The cast file is Vibe-nimation episodes/_Personaje/<Series>/characters.json (reference/CHARACTERS.md). It is
shared by every episode of the series: add new characters to it, never start a second one.
Runs the automated rig test (tools/rigtest.mjs) first and prints only its failures. Writes next to it: <Name>.png (sheet), _Distributie.png (everyone side by side) and, for the mandatory review,
_verificare/<Name>_capete.png (6 views × 8 expressions) + _verificare/<Name>_corp.png (10 poses × 5 views) per rendered
character, _verificare/_Fete.png (face lineup: everyone front + 3/4, hair as a flat silhouette) and
_verificare/_review.png (review pack: the line-up + one row of heads per character rendered this time — the one image
to open per iteration; the full matrices are still made every time and get their full check once before the stop).
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
        V = C / '_verificare'; V.mkdir(exist_ok=True)
        for page, suffix in (('heads', 'capete'), ('bodies', 'corp')):
            o2 = V / f'{safe_name(c["name"])}_{suffix}.png'
            r = subprocess.run([node, 'tools/page.mjs', f'rigcheck.html?id={c["id"]}&page={page}', str(o2)], cwd=R, env=env, capture_output=True, text=True)
            print(o2 if r.returncode == 0 else f'FAILED {c["id"]} {page}: {r.stderr[-400:]}')
    # automated rig test (text only, no image): hair coverage in all 8 views, back-of-head/neck axis, hands, arm roots
    r = subprocess.run([node, 'tools/rigtest.mjs', '--ids', ','.join(sorted(ids)), '--file', 'data/characters.json'], cwd=R, env=env, capture_output=True, text=True)
    print((r.stdout or r.stderr).strip()[-1500:])
    if r.returncode != 0: print('RIGTEST FAILED: fix the spec (a single character) or the rig (several) BEFORE opening any image')
    V = C / '_verificare'; V.mkdir(exist_ok=True)
    for url, out in (('sheet.html?cast=1', C / '_Distributie.png'), ('rigcheck.html?page=faces', V / '_Fete.png'),
                     (f'rigcheck.html?page=review&ids={",".join(sorted(ids))}', V / '_review.png')):
        r = subprocess.run([node, 'tools/page.mjs', url, str(out)], cwd=R, env=env, capture_output=True, text=True)
        print(out if r.returncode == 0 else f'FAILED {url}: {r.stderr[-400:]}')
    print(f'review this iteration: {V / "_review.png"}  (+ {V / "_Fete.png"} when faces changed)')
    meta['cast_file'] = str(cf); save_episode_meta(W, meta)


if __name__ == '__main__':
    main()
