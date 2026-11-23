"""Sound + checks + render for one short (after voice.py and writing src/shots.js).

  python scripts/vn.py build <short> --preview   meta → music (if missing) → mix → error check → contact sheets (no video)
  python scripts/vn.py build <short> --draft     + a fast half-size video for timing (renders/draft.mp4)
  python scripts/vn.py build <short>             + the final video: renders/short.mp4 (master) and renders/short_share.mp4
  options: --music (re-make the score) · --mood sad · --workers 4

Contact sheets: review/all.jpg (2 frames per shot) — LOOK at it before rendering the final video.
"""
import argparse, json, shutil, subprocess, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import load_config, node_env, venv_python  # noqa: E402

HERE = Path(__file__).resolve().parent


def step(name, cmd, cwd, env=None):
    print(f'· {name}', flush=True)
    r = subprocess.run(cmd, cwd=cwd, env=env)
    if r.returncode not in (0,): sys.exit(f'{name} failed (exit {r.returncode})')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('short'); ap.add_argument('--preview', action='store_true'); ap.add_argument('--draft', action='store_true')
    ap.add_argument('--music', action='store_true'); ap.add_argument('--mood'); ap.add_argument('--workers', default='4')
    a = ap.parse_args(); cfg = load_config(); P = Path(a.short).resolve(); env = node_env(cfg)
    node, py = shutil.which('node'), str(venv_python())
    if not (P / 'data' / 'narration.wav').exists(): sys.exit('no narration yet: run vn.py voice first')
    step('shots → data/meta.json', [node, 'tools/capture.mjs', 'meta'], P, env)
    if a.music or a.mood or not (P / 'audio' / 'music.wav').exists():
        step('music', [py, '-I', str(HERE / 'music.py'), str(P)] + (['--mood', a.mood] if a.mood else []), P)
    step('mix', [py, '-I', str(HERE / 'mix.py'), str(P)], P)
    step('check every shot', [node, 'tools/capture.mjs', 'check'], P, env)
    step('contact sheet → review/all.jpg', [node, 'tools/capture.mjs', 'scenes', 'review/all.jpg', 'all', '2', '0.2'], P, env)
    if a.preview: return print('preview ready: review/all.jpg (+ open index.html via a local server to scrub with sound)')
    if a.draft:
        step('draft video', [node, 'tools/capture.mjs', 'video', 'renders/draft.mp4', '0', '-1', a.workers, '--audio', '--draft'], P, env)
        return print(P / 'renders' / 'draft.mp4')
    step('master video', [node, 'tools/capture.mjs', 'video', 'renders/short.mp4', '0', '-1', a.workers, '--audio'], P, env)
    step('share copy', ['ffmpeg', '-y', '-loglevel', 'error', '-i', 'renders/short.mp4', '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-maxrate', '7M', '-bufsize', '14M',
                        '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', 'renders/short_share.mp4'], P)
    print(P / 'renders' / 'short_share.mp4')


if __name__ == '__main__':
    main()
