"""Launcher: runs a skill script inside the private env, from any Python.

  python scripts/vn.py analyze <episode.mp4>
  python scripts/vn.py voice <short-dir>
  python scripts/vn.py --list
"""
import subprocess, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import venv_python  # noqa: E402

HERE = Path(__file__).resolve().parent
TOOLS = {p.stem: p for p in HERE.glob('*.py') if p.stem not in ('vn', 'common', 'setup')}

if len(sys.argv) < 2 or sys.argv[1] in ('-h', '--help', '--list'):
    print(__doc__); print('tools:', ', '.join(sorted(TOOLS))); sys.exit(0)
name = sys.argv[1]
if name not in TOOLS:
    sys.exit(f'unknown tool {name!r}; tools: {", ".join(sorted(TOOLS))}')
py = venv_python()
if not py.exists():
    sys.exit('The private env is missing. Run first:  python scripts/setup.py')
sys.exit(subprocess.call([str(py), '-I', str(TOOLS[name]), *sys.argv[2:]]))
