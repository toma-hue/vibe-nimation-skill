"""OPTIONAL: install ACE-Step 1.5 (MIT, local, free) for AI-generated scores (`vn.py music <short> --ai`).

  python scripts/music_ai_setup.py [--dir <path>]

Needs an NVIDIA GPU (6–8 GB+ VRAM; 8 GB works with memory saving, but is tight), git, uv, ~15 GB disk and ~10 GB
free while generating. Without it the built-in score (numpy) is used — it always works.
"""
import argparse, shutil, subprocess, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import HOME, load_config, save_config  # noqa: E402

COMMIT = 'ca1e85fe9430179831e6bc6be790c332190a3866'   # a revision known to work with music_ai/gen_song.py


def sh(cmd, cwd=None):
    print('·', ' '.join(map(str, cmd)), flush=True)
    if subprocess.run(cmd, cwd=cwd).returncode: sys.exit(f'failed: {" ".join(map(str, cmd))}')


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--dir'); a = ap.parse_args()
    cfg = load_config(); ace = Path(a.dir or cfg.get('acestep_dir') or HOME / 'ACE-Step-1.5')
    for tool in ('git', 'uv'):
        if not shutil.which(tool): sys.exit(f'{tool} is missing (Windows: winget install Git.Git / pip install uv)')
    free = shutil.disk_usage(ace.parent if ace.parent.exists() else HOME).free / 1e9
    if not (ace / 'pyproject.toml').exists():
        if free < 25: sys.exit(f'only {free:.0f} GB free: ACE-Step needs ~15 GB to install and ~10 GB free to run')
        sh(['git', 'clone', 'https://github.com/ACE-Step/ACE-Step-1.5.git', str(ace)])
        sh(['git', 'checkout', '-q', COMMIT], cwd=ace)
    print('installing ACE-Step\'s own Python env (a few GB)…'); sh(['uv', 'sync'], cwd=ace)
    print('downloading the models (~11 GB)…')
    sh(['uv', 'run', 'acestep-download'], cwd=ace)
    sh(['uv', 'run', 'acestep-download', '--model', 'acestep-5Hz-lm-0.6B', '--skip-main'], cwd=ace)
    cfg['acestep_dir'] = str(ace); save_config(cfg)
    print(f'ACE-Step ready: {ace}\nUse: python scripts/vn.py music <short> --ai   (then listen to audio/takes/ and keep the best)')


if __name__ == '__main__':
    main()
