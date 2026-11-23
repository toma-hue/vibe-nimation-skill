"""Shared paths and config for the Vibe-nimation skill (Windows, macOS, Linux).

Config lives in ~/.vibe-nimation/config.json (C:\\Users\\<name>\\.vibe-nimation\\config.json on Windows):
  output_root   where "Vibe-nimation episodes" and "_lucru" are created (default ~/Vibe-nimation)
  whisper_model faster-whisper model for episode transcription (default small.en)
  device        "cuda" or "cpu" for Chatterbox / Whisper (set by setup.py after a GPU test)
"""
import json, os, re, shutil, subprocess, sys, unicodedata
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent          # the vibe-nimation skill folder
HOME = Path(os.environ.get('VIBE_HOME', Path.home() / '.vibe-nimation'))
CONFIG_FILE = HOME / 'config.json'
IS_WIN = os.name == 'nt'

DEFAULTS = {
    'output_root': str(Path.home() / 'Vibe-nimation'),
    'whisper_model': 'small.en',
    'device': 'cpu',
    'narrator_voice': str(SKILL / 'voice' / 'narrator_C.wav'),
}


def load_config():
    cfg = dict(DEFAULTS)
    if CONFIG_FILE.exists():
        cfg.update(json.loads(CONFIG_FILE.read_text(encoding='utf-8')))
    if not Path(cfg['narrator_voice']).exists():
        cfg['narrator_voice'] = DEFAULTS['narrator_voice']
    return cfg


def save_config(cfg):
    HOME.mkdir(parents=True, exist_ok=True)
    keep = {k: v for k, v in cfg.items() if not (k == 'narrator_voice' and v == DEFAULTS['narrator_voice'])}
    CONFIG_FILE.write_text(json.dumps(keep, indent=2, ensure_ascii=False), encoding='utf-8')


def venv_python():
    v = HOME / 'venv'
    p = v / ('Scripts/python.exe' if IS_WIN else 'bin/python')
    return p


def episodes_root(cfg=None):
    cfg = cfg or load_config()
    return Path(cfg['output_root']) / 'Vibe-nimation episodes'


def work_root(cfg=None):
    cfg = cfg or load_config()
    return Path(cfg['output_root']) / '_lucru'


def safe_name(s, maxlen=80):
    """A file/folder name that is valid on Windows: no \\ / : * ? " < > |, no trailing dots/spaces."""
    s = unicodedata.normalize('NFC', str(s))
    s = re.sub(r'[\\/:*?"<>|\x00-\x1f]', '', s)
    s = re.sub(r'\s+', ' ', s).strip().rstrip('. ')
    return s[:maxlen].rstrip('. ') or 'untitled'


def slug(s):
    s = unicodedata.normalize('NFKD', str(s)).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-') or 'x'


def ffmpeg():
    exe = shutil.which('ffmpeg')
    if not exe:
        sys.exit('ffmpeg not found. Run: python scripts/setup.py')
    return exe


def run(cmd, **kw):
    """Run a command, raise with its stderr on failure."""
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        raise RuntimeError(f"{' '.join(map(str, cmd))}\n{r.stderr[-2000:]}")
    return r.stdout


def duration(path):
    out = run([shutil.which('ffprobe') or 'ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)])
    return float(out.strip())


ENGINE = SKILL / 'engine'


def episode_meta(work):
    """<work>/episode.json — written by analyze.py, completed by Claude after the analysis:
    series, season, episode, episode_title (optional), cast_file (set by cast.py)."""
    p = Path(work) / 'episode.json'
    return json.loads(p.read_text(encoding='utf-8')) if p.exists() else {}


def save_episode_meta(work, meta):
    (Path(work) / 'episode.json').write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding='utf-8')


def ep_label(meta):
    s, e = meta.get('season'), meta.get('episode')
    return f'S{int(s):02d}E{int(e):02d}' if s is not None and e is not None else 'EP'


def episode_out_dir(meta, cfg=None):
    """Vibe-nimation episodes/<Series> - S01E01"""
    return episodes_root(cfg) / safe_name(f'{meta.get("series", "Unknown series")} - {ep_label(meta)}')


def cast_dir(meta, cfg=None):
    """Vibe-nimation episodes/_Personaje/<Series> — character sheets reused by every episode"""
    return episodes_root(cfg) / '_Personaje' / safe_name(meta.get('series', 'Unknown series'))


def copy_engine(dest):
    """a fresh, self-contained render project (engine + fonts + tools); keeps data/, audio/, script.json, src/shots.js if present"""
    dest = Path(dest); dest.mkdir(parents=True, exist_ok=True)
    for item in ENGINE.iterdir():
        target = dest / item.name
        if item.name == 'src':
            for sub in item.rglob('*'):
                rel = sub.relative_to(ENGINE); t = dest / rel
                if sub.is_dir(): t.mkdir(parents=True, exist_ok=True); continue
                if rel.as_posix() == 'src/shots.js' and t.exists(): continue   # never overwrite a written short
                t.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(sub, t)
        elif item.is_dir():
            shutil.copytree(item, target, dirs_exist_ok=True)
        else:
            shutil.copy2(item, target)
    (dest / 'data').mkdir(exist_ok=True)
    return dest


def node_env(cfg=None):
    cfg = cfg or load_config(); env = dict(os.environ)
    if cfg.get('browser') and not env.get('CHROME'): env['CHROME'] = cfg['browser']
    return env


def hms(t):
    t = max(0, float(t)); m, s = divmod(t, 60); h, m = divmod(int(m), 60)
    return f'{h}:{m:02d}:{s:05.2f}' if h else f'{m:02d}:{s:05.2f}'
