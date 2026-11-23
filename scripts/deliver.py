"""Copy a finished short and its post text into the episode folder.

  python scripts/vn.py deliver <short>      → Vibe-nimation episodes/<Series> - S01E01/S01E01 - Short 03 - <Title>.mp4 + .txt

Reads <short>/post.json: {"number", "title", "description", "hashtags": [...], "score": 1-10, "score_reason"}.
"""
import argparse, json, shutil, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import duration, ep_label, episode_meta, episode_out_dir, load_config, safe_name  # noqa: E402


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('short'); a = ap.parse_args()
    cfg = load_config(); P = Path(a.short).resolve(); W = P.parent.parent; meta = episode_meta(W)
    post = json.loads((P / 'post.json').read_text(encoding='utf-8'))
    missing = [k for k in ('title', 'description', 'hashtags', 'score') if not post.get(k)]
    if missing: sys.exit(f'post.json is missing: {", ".join(missing)}')
    src = P / 'renders' / 'short_share.mp4'
    if not src.exists(): sys.exit('no renders/short_share.mp4: run vn.py build first')
    out = episode_out_dir(meta, cfg); out.mkdir(parents=True, exist_ok=True)
    n = int(post.get('number') or P.name); lab = ep_label(meta)
    base = safe_name(f'{lab} - Short {n:02d} - {post["title"]}', 120)
    for old in out.glob(f'{lab} - Short {n:02d} - *'): old.unlink()        # a re-delivery replaces the old files
    shutil.copy2(src, out / f'{base}.mp4')
    d = duration(src); total = len(list((W / 'shorts').glob('[0-9][0-9]')))
    tags = ' '.join(h if h.startswith('#') else '#' + h for h in post['hashtags'])
    txt = (f'TITLU\n{post["title"]}\n\nDESCRIERE\n{post["description"]}\n\nHASHTAG-URI\n{tags}\n\n'
           f'NOTĂ VIRALĂ: {post["score"]}/10\n{post.get("score_reason", "")}\n\n'
           f'---\nDurată: {int(d // 60)}:{int(d % 60):02d} · {meta.get("series", "")} · {lab}'
           f'{" · " + meta["episode_title"] if meta.get("episode_title") else ""} · Short {n:02d} din {total}\n'
           f'Acoperă: {post.get("covers", "")}\n')
    (out / f'{base}.txt').write_text(txt, encoding='utf-8')
    print(out / f'{base}.mp4'); print(out / f'{base}.txt')


if __name__ == '__main__':
    main()
