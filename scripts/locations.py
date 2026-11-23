"""Location sheets for a series: every place re-created as a vector set, compared with the episode's stills.

  python scripts/vn.py locations <work-dir>              every location module → sheets
  python scripts/vn.py locations <work-dir> --ids diner  only these
  python scripts/vn.py locations <work-dir> --new diner  start a module from reference/location-example.js
  python scripts/vn.py locations <work-dir> --props      start the series' props.js from the engine's default props

Folder: Vibe-nimation episodes/_Locatii/<Series>/
  <id>.js            the location module (reference/LOCATIONS.md) — reused by every episode of the series
  refs/<id>_1.jpg …  the episode stills it re-creates (copy them from analysis/frames/)
  <Name>.png         the sheet: still vs vector over the same 16:9 window + three 9:16 short frames
"""
import argparse, json, re, shutil, subprocess, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import SKILL, cast_dir, copy_engine, episode_meta, episodes_root, load_config, node_env, safe_name  # noqa: E402


def loc_dir(meta, cfg=None):
    return episodes_root(cfg) / '_Locatii' / safe_name(meta.get('series', 'Unknown series'))


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('work'); ap.add_argument('--ids'); ap.add_argument('--new'); ap.add_argument('--props', action='store_true')
    a = ap.parse_args(); cfg = load_config(); W = Path(a.work); meta = episode_meta(W)
    if not meta.get('series'): sys.exit('episode.json has no "series" yet: write series/season/episode into it first')
    D = loc_dir(meta, cfg); (D / 'refs').mkdir(parents=True, exist_ok=True)
    if a.props:
        f = D / 'props.js'
        if f.exists(): sys.exit(f'{f} exists')
        shutil.copy2(SKILL / 'engine' / 'src' / 'props.js', f); return print(f, '← add the series\' own props (reference/SHOTS.md → Props)')
    if a.new:
        f = D / f'{a.new}.js'
        if f.exists(): sys.exit(f'{f} exists')
        src = (SKILL / 'reference' / 'location-example.js').read_text(encoding='utf-8')
        f.write_text(src.replace("id: 'diner'", f"id: '{a.new}'").replace("series: 'Example'", f"series: {json.dumps(meta['series'])}"), encoding='utf-8')
        return print(f, '← rewrite it for this place (reference/LOCATIONS.md)')
    mods = sorted(m for m in D.glob('*.js') if m.name != 'props.js')
    if not mods: sys.exit(f'no location modules in {D} yet: vn.py locations <work> --new <id>')
    R = copy_engine(W / 'locations_render'); (R / 'src' / 'sets').mkdir(exist_ok=True)
    for m in mods: shutil.copy2(m, R / 'src' / 'sets' / m.name)
    if (R / 'refs').exists(): shutil.rmtree(R / 'refs')
    shutil.copytree(D / 'refs', R / 'refs')
    cf = cast_dir(meta, cfg) / 'characters.json'
    if cf.exists(): shutil.copy2(cf, R / 'data' / 'characters.json')
    ids = set(a.ids.split(',')) if a.ids else {m.stem for m in mods}
    node, env = shutil.which('node'), node_env(cfg)
    for m in mods:
        if m.stem not in ids: continue
        name = re.search(r"name:\s*(['\"])(.*?)(?<!\\)\1", m.read_text(encoding='utf-8'))
        out = D / f'{safe_name(name.group(2).replace(chr(92), "") if name else m.stem)}.png'
        r = subprocess.run([node, 'tools/page.mjs', f'location.html?id={m.stem}', str(out)], cwd=R, env=env, capture_output=True, text=True)
        print(out if r.returncode == 0 else f'FAILED {m.stem}: {(r.stderr or r.stdout)[-600:]}')
    meta['locations_dir'] = str(D); (W / 'episode.json').write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding='utf-8')


if __name__ == '__main__':
    main()
