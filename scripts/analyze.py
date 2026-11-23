"""Episode → everything Claude needs to watch it: transcript, scenes, contact sheets, loudness.

  python scripts/vn.py analyze <episode.mp4|mkv>              full analysis (≈5–15 min for 40 min on a CPU)
  python scripts/vn.py analyze <episode> --frames 612.5,1430  full-resolution stills (character looks, details)
  python scripts/vn.py analyze <episode> --clip 600 660       one sheet for a time range, 1 frame/second
  python scripts/vn.py analyze <episode> --palette 612.5,1430 the 8 main colours of each still (hex), for location/character specs

Writes <output_root>/_lucru/<episode-id>/analysis/:
  overview.md        READ FIRST: file hints (series, SxxExx), duration, every scene with its time, length,
                     loudness and the lines spoken in it, and which contact sheet shows it
  transcript.txt     "[12:03.4] line" one per Whisper segment;  transcript.json  [{s, e, text}]
  scenes.json        [{i, start, end, loud, words, sheet}]
  packs/pack_NN.jpg  4 contact sheets per image (80 frames), still readable — OPEN THESE to watch the episode
  scene_index.md     one line per scene (time, length, pack, dialogue) with "place / who" to fill in while watching;
                     later steps read this text instead of reopening images
  sheets/sheet_NN_<from>-<to>.jpg   the single 5×4 sheets the packs are made of (open one only to look closer)
  credit / logo scenes (black frames with text) are detected, left out of the packs and marked in overview.md
  energy.json        loudness per second (dB) — action and music peaks
  thumbs/            2 frames per second, 384 px (internal)
"""
import argparse, json, re, subprocess, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import duration, ffmpeg, hms, load_config, run, slug, work_root  # noqa: E402

import numpy as np
from PIL import Image, ImageDraw, ImageFont

FPS_T = 2          # thumbnails per second
TW, TH = 384, 216  # thumbnail size


def font(size):
    for f in ('arialbd.ttf', 'Arial Bold.ttf', 'DejaVuSans-Bold.ttf', 'LiberationSans-Bold.ttf'):
        try: return ImageFont.truetype(f, size)
        except OSError: pass
    skill_font = Path(__file__).resolve().parent.parent / 'engine' / 'fonts' / 'Inter.ttf'
    try: return ImageFont.truetype(str(skill_font), size)
    except OSError: return ImageFont.load_default()


def hints_from_name(p: Path):
    stem = p.stem
    h = {'file': p.name}
    m = re.search(r'[Ss](\d{1,2})[ ._-]?[Ee](\d{1,3})', stem) or re.search(r'(\d{1,2})x(\d{2})', stem)
    if m:
        h['season'], h['episode'] = int(m.group(1)), int(m.group(2))
        h['series_guess'] = re.sub(r'[._]+', ' ', stem[:m.start()]).strip(' -')
        h['title_guess'] = re.sub(r'[._]+', ' ', stem[m.end():]).split('  ')[0].strip(' -')
        h['title_guess'] = re.split(r'\s(?:2160p|1080p|720p|576p|480p|4k|uhd|web[- ]?dl|webrip|web|bluray|brrip|hdtv|x26[45]|h\.?26[45]|hevc|aac|ddp?5?|proper|repack|internal|nf|amzn|dsnp|hmax|atvp)\b', h['title_guess'], flags=re.I)[0].strip(' -')
    try:
        tags = json.loads(run(['ffprobe', '-v', 'error', '-show_entries', 'format_tags', '-of', 'json', str(p)])).get('format', {}).get('tags', {})
        h['tags'] = {k: v for k, v in tags.items() if k.lower() in ('title', 'show', 'season_number', 'episode_id', 'episode_sort', 'description', 'comment', 'artist')}
    except Exception:
        pass
    return h


def extract(ep, A):
    thumbs = A / 'thumbs'; thumbs.mkdir(parents=True, exist_ok=True)
    wav = A / 'audio16k.wav'
    if not wav.exists():
        print('· audio…', flush=True)
        run([ffmpeg(), '-y', '-loglevel', 'error', '-i', str(ep), '-vn', '-ac', '1', '-ar', '16000', str(wav)])
    if not any(thumbs.iterdir()):
        print('· frames (2 per second)…', flush=True)
        run([ffmpeg(), '-y', '-loglevel', 'error', '-i', str(ep), '-vf', f'fps={FPS_T},scale={TW}:{TH}:force_original_aspect_ratio=decrease',
             '-q:v', '5', str(thumbs / 't%05d.jpg')])
    return wav, sorted(thumbs.glob('t*.jpg'))


def transcribe(wav, A, cfg):
    js = A / 'transcript.json'
    if js.exists():
        return json.loads(js.read_text(encoding='utf-8'))
    from faster_whisper import WhisperModel
    print(f'· transcribing with Whisper {cfg["whisper_model"]}…', flush=True)
    model = None
    if cfg.get('device') == 'cuda':
        try: model = WhisperModel(cfg['whisper_model'], device='cuda', compute_type='float16')
        except Exception as e: print('  (GPU Whisper unavailable, using CPU:', str(e)[:80], ')')
    model = model or WhisperModel(cfg['whisper_model'], device='cpu', compute_type='int8')
    segs, _ = model.transcribe(str(wav), language='en', vad_filter=True, beam_size=5, condition_on_previous_text=False)
    out = []
    for s in segs:
        out.append({'s': round(s.start, 2), 'e': round(s.end, 2), 'text': s.text.strip()})
        if len(out) % 50 == 0: print(f'  {hms(s.end)}', flush=True)
    js.write_text(json.dumps(out, indent=0, ensure_ascii=False), encoding='utf-8')
    (A / 'transcript.txt').write_text('\n'.join(f'[{hms(x["s"])}] {x["text"]}' for x in out), encoding='utf-8')
    return out


def scenes_from_thumbs(thumbs, min_len=1.0):
    """Hard cuts = frame-to-frame jumps well above this episode's normal motion; returns [(start, end)] seconds."""
    hist = lambda x: np.histogram(x, bins=16, range=(0, 255))[0] / x.size
    prev, d, dh = None, [0.0], [0.0]
    for f in thumbs:
        a = np.asarray(Image.open(f).convert('RGB').resize((48, 27)), dtype=np.float32)
        if prev is not None:
            d.append(float(np.abs(a - prev).mean())); dh.append(float(np.abs(hist(a) - hist(prev)).sum() * 100))
        prev = a
    d, dh = np.array(d), np.array(dh)
    base, hbase = np.median(d[1:]) if len(d) > 1 else 1, np.median(dh[1:]) if len(dh) > 1 else 1
    times = [0.0]
    for k in range(1, len(d)):
        t = k / FPS_T
        is_cut = (d[k] > max(9.0, base * 3.5) and d[k] >= d[max(0, k - 1)] and d[k] >= d[min(len(d) - 1, k + 1)]) or dh[k] > max(30.0, hbase * 5)
        if is_cut and t - times[-1] >= min_len: times.append(t)
    end = len(thumbs) / FPS_T
    return [(times[i], times[i + 1] if i + 1 < len(times) else end) for i in range(len(times))]


def frame_kind(path):
    """'text' (dark frame with sparse bright low-colour pixels: credits, title cards, logos), 'black' or 'picture'"""
    a = np.asarray(Image.open(path).convert('RGB'), dtype=np.float32)
    lum = a.mean(axis=2); sat = a.max(axis=2) - a.min(axis=2); bright = lum > 150
    if lum.mean() < 40 and np.median(lum) < 25 and 0.0004 < bright.mean() < 0.2 and sat[bright].mean() < 70: return 'text'
    if lum.mean() < 10: return 'black'
    return 'picture'


def pack(sheets, out, scale=0.66):
    """2×2 contact sheets in one image (the cheap way to watch: one image = 80 frames)"""
    ims = [Image.open(p) for p in sheets]
    w, h = int(ims[0].width * scale), int(ims[0].height * scale)
    P = Image.new('RGB', (w * 2 + 8, h * 2 + 8), (8, 6, 10))
    for i, im in enumerate(ims): P.paste(im.resize((w, int(im.height * scale))), ((i % 2) * (w + 8), (i // 2) * (h + 8)))
    P.save(out, quality=80)


def energy(wav):
    import soundfile as sf
    a, sr = sf.read(str(wav), dtype='float32')
    n = len(a) // sr
    rms = np.sqrt(np.mean(a[:n * sr].reshape(n, sr) ** 2, axis=1) + 1e-9)
    return (20 * np.log10(rms)).round(1).tolist()


def palette(img_path, k=8, iters=12):
    """dominant colours of a still (tiny k-means), biggest share first: [(hex, share)]"""
    a = np.asarray(Image.open(img_path).convert('RGB').resize((160, 90)), dtype=np.float32).reshape(-1, 3)
    rng = np.random.default_rng(0); cen = a[rng.choice(len(a), k, replace=False)]
    for _ in range(iters):
        lab = ((a[:, None, :] - cen[None]) ** 2).sum(-1).argmin(1)
        cen = np.array([a[lab == j].mean(0) if (lab == j).any() else cen[j] for j in range(k)])
    share = np.bincount(lab, minlength=k) / len(a); order = share.argsort()[::-1]
    return [('#%02X%02X%02X' % tuple(int(v) for v in cen[j]), float(share[j])) for j in order]


def sheet(frames, out, cols=5, rows=4):
    """frames: [(thumb_path, label)] → grid image with labels under each frame."""
    lab = 26; W, H = cols * TW, rows * (TH + lab)
    im = Image.new('RGB', (W, H), (18, 14, 20)); d = ImageDraw.Draw(im); f = font(17)
    for k, (p, text) in enumerate(frames):
        x, y = (k % cols) * TW, (k // cols) * (TH + lab)
        th = Image.open(p); im.paste(th, (x + (TW - th.width) // 2, y + (TH - th.height) // 2))
        d.text((x + 6, y + TH + 3), text, fill=(240, 230, 235), font=f)
    im.save(out, quality=82)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('episode')
    ap.add_argument('--frames', help='comma list of seconds → full-res stills')
    ap.add_argument('--clip', nargs=2, type=float, metavar=('FROM', 'TO'), help='1 frame/second sheet for a range')
    ap.add_argument('--palette', help='comma list of seconds → the main colours of each frame')
    ap.add_argument('--id', help='work folder name (default: from the file name)')
    a = ap.parse_args()
    cfg = load_config()
    ep = Path(a.episode).expanduser().resolve()
    if not ep.exists(): sys.exit(f'not found: {ep}')
    W = work_root(cfg) / (a.id or slug(ep.stem)[:60]); A = W / 'analysis'; A.mkdir(parents=True, exist_ok=True)

    if a.palette:
        out = A / 'frames'; out.mkdir(exist_ok=True)
        for t in [float(x) for x in a.palette.split(',')]:
            f = out / f'frame_{t:08.2f}.jpg'
            if not f.exists(): run([ffmpeg(), '-y', '-loglevel', 'error', '-ss', str(t), '-i', str(ep), '-frames:v', '1', '-q:v', '2', str(f)])
            print(f'{hms(t)}  {f.name}:  ' + '  '.join(f'{h} {p:.0%}' for h, p in palette(f)))
        return
    if a.frames:
        out = A / 'frames'; out.mkdir(exist_ok=True)
        for t in [float(x) for x in a.frames.split(',')]:
            f = out / f'frame_{t:08.2f}.jpg'
            run([ffmpeg(), '-y', '-loglevel', 'error', '-ss', str(t), '-i', str(ep), '-frames:v', '1', '-q:v', '2', str(f)])
            print(f)
        return
    if a.clip:
        thumbs = sorted((A / 'thumbs').glob('t*.jpg'))
        if not thumbs: sys.exit('run the full analysis first')
        t0, t1 = a.clip; picks = []
        t = t0
        while t < t1 and len(picks) < 60:
            k = min(len(thumbs) - 1, int(t * FPS_T)); picks.append((thumbs[k], hms(t))); t += 1
        out = A / f'clip_{int(t0)}-{int(t1)}.jpg'; sheet(picks, out, cols=6, rows=(len(picks) + 5) // 6); print(out); return

    dur = duration(ep)
    print(f'{ep.name}  {hms(dur)}  → {W}', flush=True)
    meta = {'episode_file': str(ep), 'duration': dur, 'hints': hints_from_name(ep), 'work': str(W)}
    (W / 'episode.json').write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding='utf-8')
    wav, thumbs = extract(ep, A)
    tr = transcribe(wav, A, cfg)
    print('· scenes + contact sheets…', flush=True)
    en = energy(wav); (A / 'energy.json').write_text(json.dumps(en), encoding='utf-8')
    sc = scenes_from_thumbs(thumbs)

    # pick frames: every scene's middle + one per 6 s inside long scenes
    picks, credit = [], set()
    for i, (s, e) in enumerate(sc):
        ts = [s + (e - s) / 2] if e - s < 6 else [s + 1 + k * 6 for k in range(int((e - s - 1) // 6) + 1)]
        frames = [(t, thumbs[min(len(thumbs) - 1, int(t * FPS_T))]) for t in ts]
        kinds = [frame_kind(p) for _, p in frames]
        if sum(k != 'picture' for k in kinds) >= max(1, 0.7 * len(kinds)) and any(k == 'text' for k in kinds): credit.add(i); continue
        for t, p in frames: picks.append((i, t, p))
    S = A / 'sheets'; S.mkdir(exist_ok=True)
    for old in S.glob('*.jpg'): old.unlink()
    per = 20; sheet_of = {}
    for n in range(0, len(picks), per):
        chunk = picks[n:n + per]
        mmss = lambda t: f'{int(t // 60):02d}m{int(t % 60):02d}s'
        name = f'sheet_{n // per + 1:02d}_{mmss(chunk[0][1])}-{mmss(chunk[-1][1])}.jpg'
        sheet([(p, f'{hms(t)[:8]}  sc{i + 1}') for i, t, p in chunk], S / name)
        for i, _, _ in chunk: sheet_of.setdefault(i, name)
    PK = A / 'packs'; PK.mkdir(exist_ok=True)
    for old in PK.glob('*.jpg'): old.unlink()
    names = sorted(S.glob('sheet_*.jpg')); pack_of_sheet = {}
    for n in range(0, len(names), 4):
        pname = f'pack_{n // 4 + 1:02d}.jpg'; pack(names[n:n + 4], PK / pname)
        for x in names[n:n + 4]: pack_of_sheet[x.name] = pname

    rows = []
    for i, (s, e) in enumerate(sc):
        lines = [x['text'] for x in tr if x['s'] < e and x['e'] > s]
        loud = float(np.mean(en[int(s):max(int(s) + 1, int(e))])) if en else 0
        rows.append({'i': i + 1, 'start': round(s, 1), 'end': round(e, 1), 'loud': round(loud, 1), 'credits': i in credit,
                     'words': sum(len(l.split()) for l in lines), 'sheet': sheet_of.get(i), 'pack': pack_of_sheet.get(sheet_of.get(i)), 'lines': lines})
    (A / 'scenes.json').write_text(json.dumps(rows, indent=1, ensure_ascii=False), encoding='utf-8')

    h = meta['hints']; peak = np.percentile(en, 90) if en else 0
    md = [f'# Analysis — {ep.name}', '',
          f'- duration {hms(dur)} · {len(sc)} scenes · {len(tr)} transcript segments · {len(list(S.glob("*.jpg")))} contact sheets',
          f'- file hints: series `{h.get("series_guess", "?")}` · S{h.get("season", "?")}E{h.get("episode", "?")} · title `{h.get("title_guess", "?")}` · tags {h.get("tags", {})}',
          f'- loudness: median {np.median(en):.1f} dB, loud ≥ {peak:.1f} dB (★ = loud scene: action, music, shouting)', '',
          '## Scenes', '']
    for r in rows:
        star = ' ★' if r['loud'] >= peak else ''
        if r['credits']:
            md.append(f'### sc{r["i"]}  {hms(r["start"])}–{hms(r["end"])}  ({r["end"] - r["start"]:.0f}s)  · [credits / logo — skipped from the packs]'); md.append(''); continue
        md.append(f'### sc{r["i"]}  {hms(r["start"])}–{hms(r["end"])}  ({r["end"] - r["start"]:.0f}s){star}  · {r["pack"]} / {r["sheet"]}')
        md += [f'> {l}' for l in r['lines']] or ['_(no dialogue)_']
        md.append('')
    (A / 'overview.md').write_text('\n'.join(md), encoding='utf-8')
    idx = ['# Scene index — fill "place" and "who" while watching the packs; later steps read this instead of images', '',
           '| sc | time | len | pack | place | who | dialogue |', '|---|---|---|---|---|---|---|']
    for r in rows:
        if r['credits']: idx.append(f'| {r["i"]} | {hms(r["start"])[:8]} | {r["end"] - r["start"]:.0f}s | — | credits/logo | — | |'); continue
        dl = (' / '.join(r['lines']))[:110].replace('|', '/') + ('…' if len(' / '.join(r['lines'])) > 110 else '')
        idx.append(f'| {r["i"]} | {hms(r["start"])[:8]} | {r["end"] - r["start"]:.0f}s{" ★" if r["loud"] >= peak else ""} | {(r["pack"] or "")[5:7]} |  |  | {dl} |')
    (A / 'scene_index.md').write_text('\n'.join(idx), encoding='utf-8')
    print(f'done → {A / "overview.md"}  ({len(sc)} scenes, {len(list(S.glob("*.jpg")))} sheets in {len(list(PK.glob("*.jpg")))} packs, {len(credit)} credit/logo scenes skipped)')


if __name__ == '__main__':
    main()
