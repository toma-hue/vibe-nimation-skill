"""Where did the Claude Code credits go? Reads the session transcripts Claude Code keeps on THIS computer and breaks the
token use down per phase of the pipeline, per model and per kind (fresh input, cache reads, cache writes, output, images).

  python scripts/vn.py usage_report                       the newest session of every project folder that mentions vibe-nimation
  python scripts/vn.py usage_report --session <file.jsonl> one transcript
  python scripts/vn.py usage_report --all                 every session found
  python scripts/vn.py usage_report --root <folder>       where the transcripts are (default ~/.claude/projects)

Nothing is sent anywhere: it only reads local .jsonl files and prints a table. The "cost units" are RELATIVE (fresh input = 1,
cache write 1.25, cache read 0.1, output 5 — the usual price ratios); the subscription limit is not published, so use them to
compare phases and models with each other, not to predict minutes. Opus counts ~5× Sonnet per unit (--opus-factor).
"""
import argparse, json, re, sys
from collections import defaultdict
from pathlib import Path

PHASES = [  # (phase, regex on a tool call: command text or file path) — first match wins; the phase STAYS until the next marker
    ('analysis', r'vn\.py\s+analyze|analysis[/\\]|analysis\.md|scene_index|plan\.(json|md)'),
    ('cast', r'vn\.py\s+cast|characters\.json|_Personaje|_verificare|CHARACTERS\.md'),
    ('locations', r'vn\.py\s+locations|_Locatii|LOCATIONS\.md|location-example|src[/\\]sets[/\\]'),
    ('new_short/script', r'new_short|script\.json'),
    ('voice', r'vn\.py\s+voice'),
    ('shots', r'shots\.js|SHOTS\.md|STYLE\.md|board\.js'),
    ('build/review', r'vn\.py\s+build|capture\.mjs|review[/\\]|all\.jpg'),
    ('deliver/post', r'vn\.py\s+deliver|post\.json|POSTING\.md'),
    ('engine/rig fixes', r'rig\.js|hair\.js|face\.js|props\.js|scene\.js'),
]
W_IN, W_CW, W_CR, W_OUT = 1.0, 1.25, 0.1, 5.0


def phase_of(call_text, cur):
    for name, rx in PHASES:
        if re.search(rx, call_text, re.I): return name
    return cur


def calls_of(msg):
    out = []
    for b in (msg.get('content') or []):
        if isinstance(b, dict) and b.get('type') == 'tool_use':
            i = b.get('input') or {}
            out.append(' '.join(str(i.get(k, '')) for k in ('command', 'file_path', 'path', 'pattern', 'description')))
    return out


def count_images(content):
    n = 0
    for b in (content if isinstance(content, list) else []):
        if isinstance(b, dict):
            if b.get('type') == 'image': n += 1
            elif b.get('type') == 'tool_result': n += count_images(b.get('content'))
    return n


def read_session(path, opus_factor):
    rows, phase, last_user_images = {}, 'start', 0
    order = []
    with open(path, encoding='utf-8', errors='ignore') as f:
        for line in f:
            try: e = json.loads(line)
            except Exception: continue
            m = e.get('message') or {}
            if e.get('type') == 'user':
                last_user_images = count_images(m.get('content')); continue
            if e.get('type') != 'assistant' or not m.get('usage'): continue
            mid = m.get('id') or e.get('uuid')
            for c in calls_of(m): phase = phase_of(c, phase)
            u = m['usage']; model = m.get('model', '?')
            r = dict(phase=phase, model=model, inp=u.get('input_tokens', 0), cw=u.get('cache_creation_input_tokens', 0), cr=u.get('cache_read_input_tokens', 0),
                     out=u.get('output_tokens', 0), images=last_user_images)
            last_user_images = 0
            if mid not in rows: order.append(mid)
            prev = rows.get(mid)
            if prev: r['images'] = max(r['images'], prev['images'])
            rows[mid] = r                                       # streaming repeats a message: keep the last (complete) usage
    return [rows[i] for i in order]


def cost(r, opus_factor):
    f = opus_factor if 'opus' in r['model'] else 1.0
    return f * (W_IN * r['inp'] + W_CW * r['cw'] + W_CR * r['cr'] + W_OUT * r['out'])


def report(rows, title, opus_factor):
    if not rows: print(f'{title}: no assistant turns'); return
    by = defaultdict(lambda: defaultdict(float)); tot = defaultdict(float); models = defaultdict(float)
    for r in rows:
        c = cost(r, opus_factor)
        for k in (by[r['phase']], tot):
            k['turns'] += 1; k['inp'] += r['inp']; k['cw'] += r['cw']; k['cr'] += r['cr']; k['out'] += r['out']; k['images'] += r['images']; k['cost'] += c
        models[r['model']] += c
    peak = max(r['inp'] + r['cw'] + r['cr'] for r in rows)
    print(f'\n=== {title} ===  {int(tot["turns"])} turns · biggest context {peak:,} tokens · {int(tot["images"])} images viewed')
    print(f'{"phase":18} {"turns":>6} {"%cost":>6} {"fresh in":>10} {"cache wr":>10} {"cache rd":>12} {"output":>9} {"images":>7}')
    for ph, d in sorted(by.items(), key=lambda x: -x[1]['cost']):
        print(f'{ph:18} {int(d["turns"]):>6} {100 * d["cost"] / tot["cost"]:>5.0f}% {int(d["inp"]):>10,} {int(d["cw"]):>10,} {int(d["cr"]):>12,} {int(d["out"]):>9,} {int(d["images"]):>7}')
    share = lambda k, w: 100 * w * tot[k] * (opus_factor if False else 1) / max(1, W_IN * tot['inp'] + W_CW * tot['cw'] + W_CR * tot['cr'] + W_OUT * tot['out'])
    print('what the units are made of (before the model factor): fresh input %.0f%% · cache writes %.0f%% · cache READS %.0f%% · output %.0f%%'
          % (share('inp', W_IN), share('cw', W_CW), share('cr', W_CR), share('out', W_OUT)))
    print('per model: ' + ' · '.join(f'{m} {100 * c / tot["cost"]:.0f}%' for m, c in sorted(models.items(), key=lambda x: -x[1])))
    print('reading it: a big "cache rd" share = the conversation is long and every step re-reads it (→ split into sessions);\n'
          '            a big "output" share = Claude writes a lot of code/text (→ storyboard beats, templates);\n'
          '            many "images" = screenshots kept in the context (→ automated checks, smaller review images).')


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--root', default=str(Path.home() / '.claude' / 'projects')); ap.add_argument('--session'); ap.add_argument('--all', action='store_true')
    ap.add_argument('--opus-factor', type=float, default=5.0); a = ap.parse_args()
    if a.session: files = [Path(a.session)]
    else:
        root = Path(a.root)
        if not root.exists(): sys.exit(f'no transcripts at {root} (use --root)')
        files = sorted(root.rglob('*.jsonl'), key=lambda p: p.stat().st_mtime, reverse=True)
        if not a.all:
            keep = []
            for p in files:
                try:
                    if 'vibe' in p.parent.name.lower() or 'vn.py' in p.read_text(encoding='utf-8', errors='ignore')[:400000]: keep.append(p)
                except Exception: pass
            files = keep[:3]
    if not files: sys.exit('no transcripts found')
    allrows = []
    for p in files:
        rows = read_session(p, a.opus_factor); allrows += rows; report(rows, p.name, a.opus_factor)
    if len(files) > 1: report(allrows, 'ALL SESSIONS TOGETHER', a.opus_factor)


if __name__ == '__main__':
    main()
