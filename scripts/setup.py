"""One-time setup for Vibe-nimation. Safe to re-run; prints "All set" when everything works.

  python scripts/setup.py                          default output folder: ~/Vibe-nimation (C:\\Users\\<name>\\Vibe-nimation)
  python scripts/setup.py --root "D:\\Vibe-nimation"   choose where episodes and work files go
  python scripts/setup.py --check                  only report what is installed, change nothing

What it does (all free, local, no accounts or API keys):
  1. checks Node.js 20+, ffmpeg + ffprobe, and Chrome or Edge (used headless to draw the frames)
  2. builds a private Python 3.11 env in ~/.vibe-nimation/venv with uv
  3. installs Chatterbox (narrator voice), faster-whisper (transcription + word timings), numpy/scipy/soundfile/Pillow
  4. on an NVIDIA card: installs PyTorch for CUDA 12.8 (needed by RTX 50-series) and tests the GPU; else uses the CPU
  5. downloads the models once (~4 GB) and says a test line in the narrator's voice
"""
import argparse, json, os, platform, shutil, subprocess, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import HOME, IS_WIN, SKILL, load_config, save_config, venv_python  # noqa: E402

OK, BAD = 'ok', 'MISSING'
problems = []


def say(name, status, hint=''):
    print(f'{name:<12} {status}{"  — " + hint if hint else ""}', flush=True)
    if status.startswith(BAD) or status.startswith('FAILED'):
        problems.append(name)


def sh(cmd, check=True, env=None, quiet=True):
    r = subprocess.run(cmd, capture_output=quiet, text=True, env=env)
    if check and r.returncode != 0:
        raise RuntimeError((r.stderr or r.stdout or '')[-3000:])
    return r


def find_browser():
    cands = [os.environ.get('CHROME', ''),
             r'C:\Program Files\Google\Chrome\Application\chrome.exe', r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
             r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe', r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
             '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
             '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/opt/pw-browsers/chromium']
    for c in cands:
        if c and Path(c).exists():
            return c
    for name in ('google-chrome', 'chromium', 'chrome', 'msedge'):
        if shutil.which(name):
            return shutil.which(name)
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', help='output folder (episodes + work files)')
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--cpu', action='store_true', help='skip the GPU build of PyTorch')
    a = ap.parse_args()

    cfg = load_config()
    if a.root:
        cfg['output_root'] = str(Path(a.root).expanduser())
    root = Path(cfg['output_root'])
    if not a.check:
        for d in (root / 'Vibe-nimation episodes' / '_Personaje', root / '_lucru'):
            d.mkdir(parents=True, exist_ok=True)
    say('output', f'{OK} ({root})')

    # 1 · system tools
    node = shutil.which('node')
    nv = sh([node, '-v'], check=False).stdout.strip() if node else ''
    if nv and int(nv.lstrip('v').split('.')[0]) >= 20:
        say('node', f'{OK} ({nv})')
    else:
        say('node', BAD, 'Node.js 20+: winget install OpenJS.NodeJS.LTS  (Mac: brew install node)')
    if shutil.which('ffmpeg') and shutil.which('ffprobe'):
        say('ffmpeg', OK)
    else:
        say('ffmpeg', BAD, 'winget install Gyan.FFmpeg  (Mac: brew install ffmpeg), then open a new terminal')
    br = find_browser()
    if br:
        cfg['browser'] = br
        say('browser', f'{OK} ({Path(br).name})')
    else:
        say('browser', BAD, 'install Google Chrome or Microsoft Edge, or set CHROME=<path to the exe>')

    # 2 · uv + private Python env
    uv = shutil.which('uv')
    if not uv and not a.check:
        print('installing uv (free Python package manager)…', flush=True)
        sh([sys.executable, '-m', 'pip', 'install', '--user', '-q', 'uv'], check=False)
        uv = shutil.which('uv')
        if not uv:  # pip --user puts it next to the user site scripts
            import site
            base = Path(site.getuserbase()) / ('Scripts' if IS_WIN else 'bin')
            for p in [base / 'uv.exe', base / 'uv'] + list(Path(site.getuserbase()).glob('Python*/Scripts/uv.exe')):
                if p.exists():
                    uv = str(p); break
    if not uv:
        say('uv', BAD, 'pip install uv   (or see docs.astral.sh/uv)')
        return finish(cfg, a)
    say('uv', OK)

    py = venv_python()
    if not py.exists():
        if a.check:
            say('python-env', BAD, 'run setup.py without --check'); return finish(cfg, a)
        print(f'building the Python env in {HOME / "venv"} — a few minutes…', flush=True)
        HOME.mkdir(parents=True, exist_ok=True)
        sh([uv, 'venv', '--python', '3.11', str(HOME / 'venv')])
    pip = lambda *pk, extra=(): sh([uv, 'pip', 'install', '--python', str(py), '-q', *extra, *pk], quiet=True)
    base_check = 'import numpy, scipy, soundfile, PIL, faster_whisper, chatterbox, pkg_resources'
    if sh([str(py), '-c', base_check], check=False).returncode != 0:
        if a.check:
            say('python-env', BAD, 'run setup.py without --check'); return finish(cfg, a)
        print('installing Chatterbox, faster-whisper and audio tools (~3 GB)…', flush=True)
        pip('chatterbox-tts', 'faster-whisper', 'soundfile', 'scipy', 'pillow', 'setuptools<81')
    ok = sh([str(py), '-c', base_check], check=False).returncode == 0
    say('python-env', OK if ok else 'FAILED', '' if ok else f'{uv} pip install --python {py} chatterbox-tts faster-whisper soundfile scipy pillow "setuptools<81"')

    # 3 · GPU (NVIDIA): RTX 50-series needs a CUDA 12.8 build of PyTorch (2.7+); older cards work with it too
    cfg['device'] = 'cpu'
    if ok and shutil.which('nvidia-smi') and not a.cpu:
        gpu = sh(['nvidia-smi', '--query-gpu=name,memory.total', '--format=csv,noheader'], check=False).stdout.strip()
        test = 'import torch; assert torch.cuda.is_available(); x=torch.randn(512,512,device="cuda"); (x@x).sum().item(); print(torch.__version__)'
        if sh([str(py), '-c', test], check=False).returncode != 0 and not a.check:
            print(f'installing PyTorch for CUDA 12.8 ({gpu})…', flush=True)
            pip('torch==2.7.1', 'torchaudio==2.7.1', extra=('--index-url', 'https://download.pytorch.org/whl/cu128', '--reinstall-package', 'torch', '--reinstall-package', 'torchaudio'))
        r = sh([str(py), '-c', test], check=False)
        if r.returncode == 0:
            cfg['device'] = 'cuda'; say('gpu', f'{OK} ({gpu}, torch {r.stdout.strip()})')
        else:
            say('gpu', 'not used', f'{gpu} did not pass the CUDA test; the CPU works, just slower')
    else:
        say('gpu', 'not used', 'no NVIDIA card found (or --cpu); the CPU works, just slower')

    # 4 · models + a test line in the narrator's voice
    if ok and not a.check:
        print('downloading models (once) and voicing a test line…', flush=True)
        test_dir = HOME / 'selftest'; test_dir.mkdir(parents=True, exist_ok=True)
        r = sh([str(py), '-I', str(SKILL / 'scripts' / 'voice.py'), '--selftest', str(test_dir)], check=False, quiet=False)
        say('voice', OK if r.returncode == 0 else 'FAILED', f'test line: {test_dir / "selftest.wav"}' if r.returncode == 0 else 'see the error above')

    # 5 · optional music model
    ace = cfg.get('acestep_dir')
    say('music', f'{OK} (ACE-Step)' if ace and Path(ace).exists() else 'built-in',
        '' if ace else 'original scores from code; optional AI score: python scripts/music_ai_setup.py (~15 GB, NVIDIA)')
    return finish(cfg, a)


def finish(cfg, a):
    if not a.check:
        save_config(cfg)
    print()
    if problems:
        print('Fix the items above, then run setup.py again.  (' + ', '.join(problems) + ')')
        sys.exit(1)
    print('All set')


if __name__ == '__main__':
    main()
