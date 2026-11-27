"""Narration in the narrator's voice (Chatterbox, local, free) + word timings + mouth movement.

  python scripts/vn.py voice <short-dir>           script.json → data/narration.wav, lines.json, words.json, mouth.json
  python scripts/vn.py voice <short-dir> --only 3,7  re-voice only these lines (others come from the cache)
  python scripts/vn.py voice --selftest <dir>      one test line → <dir>/selftest.wav

script.json:
  {"lines": [
     {"text": "That night, everything changed.", "emotion": 0.6, "gap": 0.35},
     {"text": "I can't believe her!", "emotion": 0.85, "mime": "mike", "gap": 0.5}
  ]}
  text     what the narrator says (English, written for the ear; numbers spelled out)
  emotion  0.3 calm … 0.6 dramatic (default) … 1.0 shouting — Chatterbox "exaggeration"
  mime     a character id: the narrator says this character's line and that character mouths it on screen
  gap      silence after the line in seconds (default 0.3)

Every line is checked with Whisper; a line that comes out wrong (missing or garbled words) is re-generated
with a new seed, up to 4 takes, and the closest take wins. Unchanged lines are cached in data/lines/.
"""
import argparse, hashlib, json, os, re, sys, warnings
os.environ.setdefault("TQDM_DISABLE", "1")
os.environ.setdefault("TRANSFORMERS_VERBOSITY", "error")
warnings.filterwarnings("ignore")
from difflib import SequenceMatcher
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import load_config  # noqa: E402

import numpy as np
import soundfile as sf

SR = 48000
FPS = 30
norm = lambda w: re.sub(r"[^a-z0-9']+", '', w.lower().replace('’', "'"))
_tts = _wh = None


def tts(cfg):
    global _tts
    if _tts is None:
        import torch
        from chatterbox.tts import ChatterboxTTS
        dev = cfg.get('device', 'cpu') if torch.cuda.is_available() else 'cpu'
        _tts = ChatterboxTTS.from_pretrained(device=dev)
    return _tts


def whisper():
    global _wh
    if _wh is None:
        from faster_whisper import WhisperModel
        _wh = WhisperModel('small.en', device='cpu', compute_type='int8')
    return _wh


def resample(a, sr_in, sr_out=SR):
    from scipy.signal import resample_poly
    from math import gcd
    g = gcd(sr_in, sr_out)
    return resample_poly(a, sr_out // g, sr_in // g).astype(np.float32)


def heard_words(wav, sr):
    a16 = resample(wav, sr, 16000)
    segs, _ = whisper().transcribe(a16, language='en', word_timestamps=True, beam_size=5)
    return [(w.word.strip(), float(w.start), float(w.end)) for s in segs for w in (s.words or [])]


# ---- comparing what was said with the script: numbers, symbols and sound-alike names are not mismatches ----
ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split()
TENS = 'zero ten twenty thirty forty fifty sixty seventy eighty ninety'.split()
ORD = {'1st': 'first', '2nd': 'second', '3rd': 'third', '4th': 'fourth', '5th': 'fifth', '6th': 'sixth', '7th': 'seventh', '8th': 'eighth', '9th': 'ninth', '10th': 'tenth'}


def _words(n):
    if n < 20: return [ONES[n]]
    if n < 100: return [TENS[n // 10]] + ([ONES[n % 10]] if n % 10 else [])
    if n < 1000: return [ONES[n // 100], 'hundred'] + (_words(n % 100) if n % 100 else [])
    if n < 1000000: return _words(n // 1000) + ['thousand'] + (_words(n % 1000) if n % 1000 else [])
    return list(str(n))


def spoken(tok):
    """one script/transcript token → the words a narrator says for it"""
    if tok in ORD: return [ORD[tok]]
    if re.fullmatch(r'0\d+', tok): return [ONES[int(d)] for d in tok]              # 011 → zero one one
    if re.fullmatch(r'\d+', tok):
        n = int(tok)
        if len(tok) == 4 and (1100 <= n <= 1999 or 2010 <= n <= 2099):              # years: 1983 → nineteen eighty three
            hi, lo = divmod(n, 100)
            return _words(hi) + (['hundred'] if lo == 0 else (['oh'] + _words(lo) if lo < 10 else _words(lo)))
        return _words(n)
    return [tok]


def canon(text):
    """normalised word list: lower case, & → and, % → percent, hyphens split, digits spelled out, punctuation gone"""
    t = text.lower().replace('’', "'").replace('&', ' and ').replace('%', ' percent ').replace('+', ' plus ').replace('-', ' ').replace('/', ' ')
    out = []
    for raw in t.split():
        w = re.sub(r"[^a-z0-9']+", '', raw).strip("'")
        if not w: continue
        out += [x for x in spoken(w) if x != 'and' or not re.fullmatch(r'\d+', w)]
    return out


def sound(w):
    """a sound-alike key (Soundex): Byers / Buyers, Sinclair / Sinclaire count as the same word"""
    w = re.sub(r'[^a-z]', '', w)
    if not w: return w
    codes = {**dict.fromkeys('bfpv', '1'), **dict.fromkeys('cgjkqsxz', '2'), **dict.fromkeys('dt', '3'), 'l': '4', **dict.fromkeys('mn', '5'), 'r': '6'}
    key, last = w[0], codes.get(w[0], '')
    for ch in w[1:]:
        c = codes.get(ch, '')
        if c and c != last: key += c
        if ch not in 'hw': last = c
    return (key + '000')[:4]


def score(text, heard):
    a = canon(text); b = canon(' '.join(w for w, _, _ in heard))
    exact = SequenceMatcher(None, a, b, autojunk=False).ratio()
    alike = SequenceMatcher(None, [sound(x) for x in a], [sound(x) for x in b], autojunk=False).ratio()
    return max(exact, alike - 0.02)


def trim(a, sr, thr=0.012, pad=0.04):
    idx = np.where(np.abs(a) > thr)[0]
    if not len(idx): return a
    s = max(0, idx[0] - int(pad * sr)); e = min(len(a), idx[-1] + int(pad * 2 * sr))
    return a[s:e]


def voice_line(line, cfg, cache_dir, force=False):
    import torch
    ref = cfg['narrator_voice']
    emo = float(line.get('emotion', 0.6))
    key = hashlib.sha1(f'{line["text"]}|{emo}|{Path(ref).name}|v1'.encode()).hexdigest()[:16]
    wav_p, meta_p = cache_dir / f'{key}.wav', cache_dir / f'{key}.json'
    if wav_p.exists() and meta_p.exists() and not force:
        a, _ = sf.read(wav_p, dtype='float32')
        return a, json.loads(meta_p.read_text())
    m = tts(cfg)
    m.prepare_conditionals(ref, exaggeration=emo)
    best = None
    for take in range(4):
        torch.manual_seed(1000 + take * 17 + len(line['text']))
        w = m.generate(line['text'], exaggeration=emo, cfg_weight=0.3 if emo >= 0.5 else 0.45, temperature=0.75)
        a = trim(w.squeeze(0).cpu().numpy().astype(np.float32), m.sr)
        heard = heard_words(a, m.sr)
        sc = score(line['text'], heard)
        if best is None or sc > best[0]: best = (sc, a, heard)
        if sc >= 0.93: break
        print(f'    take {take + 1}: {sc:.2f} heard "{" ".join(w for w, _, _ in heard)}" — retrying', flush=True)
    sc, a, heard = best
    a = resample(a, m.sr)
    meta = {'score': round(sc, 3), 'heard': heard}
    sf.write(wav_p, a, SR); meta_p.write_text(json.dumps(meta))
    if sc < 0.85: print(f'  ! line still differs from the script (score {sc:.2f}); listen to it or rephrase', flush=True)
    return a, meta


def align(text, heard, t0):
    """Script words with the times Whisper heard (keeps the script's spelling for captions)."""
    sw = text.split(); hw = heard
    a = [norm(w) for w in sw]; b = [norm(w) for w, _, _ in hw]
    out = [None] * len(sw)
    for tag, i1, i2, j1, j2 in SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if tag == 'equal':
            for k in range(i2 - i1): out[i1 + k] = (hw[j1 + k][1], hw[j1 + k][2])
        elif tag == 'replace' and j2 > j1:   # share the heard span by length
            s, e = hw[j1][1], hw[j2 - 1][2]; L = sum(len(w) for w in sw[i1:i2]) or 1; c = s
            for k in range(i1, i2):
                d = (e - s) * len(sw[k]) / L; out[k] = (c, c + d); c += d
    # words Whisper missed: share the gap between neighbours
    for k in range(len(sw)):
        if out[k] is None:
            prev = next((out[j][1] for j in range(k - 1, -1, -1) if out[j]), 0.0)
            nxt_i = next((j for j in range(k + 1, len(sw)) if out[j]), None)
            nxt = out[nxt_i][0] if nxt_i is not None else prev + 0.3 * (len(sw) - k)
            n = (nxt_i if nxt_i is not None else len(sw)) - k
            d = max(0.08, (nxt - prev) / max(1, n)); out[k] = (prev, prev + d)
    return [{'w': w, 's': round(t0 + s + 0.04, 3), 'e': round(t0 + e, 3)} for w, (s, e) in zip(sw, out)]


def mouth_env(a, n_frames, t0, fps=FPS):
    """0..1 mouth-open value per video frame from the voice loudness."""
    env = np.zeros(n_frames, dtype=np.float32); hop = SR // fps
    for f in range(n_frames):
        s = int((f / fps - t0) * SR)
        if 0 <= s < len(a): env[f] = np.sqrt(np.mean(a[s:s + hop] ** 2))
    if env.max() > 0: env = np.clip(env / np.percentile(env[env > 0], 90), 0, 1)
    return env


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('short', nargs='?')
    ap.add_argument('--only', help='comma list of line numbers (0-based) to re-voice')
    ap.add_argument('--selftest')
    a = ap.parse_args()
    cfg = load_config()
    if a.selftest:
        d = Path(a.selftest); d.mkdir(parents=True, exist_ok=True)
        w, meta = voice_line({'text': 'That night, everything changed.', 'emotion': 0.6}, cfg, d, force=True)
        sf.write(d / 'selftest.wav', w, SR); print('selftest score', meta['score']); sys.exit(0 if meta['score'] >= 0.8 else 1)

    P = Path(a.short); D = P / 'data'; C = D / 'lines'; C.mkdir(parents=True, exist_ok=True)
    script = json.loads((P / 'script.json').read_text(encoding='utf-8'))
    only = {int(x) for x in a.only.split(',')} if a.only else None
    lead = 0.0   # cold open: the first line starts at frame 0, whatever script.json says (no lead-in)
    parts, lines, words, t = [np.zeros(int(lead * SR), np.float32)], [], [], lead
    for i, ln in enumerate(script['lines']):
        print(f'  line {i}: {ln["text"][:70]}', flush=True)
        w, meta = voice_line(ln, cfg, C, force=bool(only and i in only))
        dur = len(w) / SR
        lines.append({'i': i, 'text': ln['text'], 'start': round(t, 3), 'end': round(t + dur, 3), 'mime': ln.get('mime'),
                      'emotion': ln.get('emotion', 0.6), 'score': meta['score']})
        for x in align(ln['text'], meta['heard'], t): words.append({**x, 'line': i})
        gap = float(ln.get('gap', 0.3))
        parts += [w, np.zeros(int(gap * SR), np.float32)]; t += dur + gap
    tail = float(script.get('tail', 1.2)); parts.append(np.zeros(int(tail * SR), np.float32)); t += tail
    nar = np.concatenate(parts)
    sf.write(D / 'narration.wav', nar, SR)
    (D / 'lines.json').write_text(json.dumps({'duration': round(t, 3), 'lines': lines}, indent=1, ensure_ascii=False), encoding='utf-8')
    (D / 'words.json').write_text(json.dumps(words, ensure_ascii=False), encoding='utf-8')
    (D / 'words.txt').write_text('\n'.join(f'{x["s"]:7.2f} {x["e"]:7.2f}  L{x["line"]:<3} {x["w"]}' for x in words), encoding='utf-8')
    env = mouth_env(nar, int(t * FPS) + 1, 0)
    (D / 'mouth.json').write_text(json.dumps([round(float(v), 3) for v in env]), encoding='utf-8')
    low = [l['i'] for l in lines if l['score'] < 0.85]
    print(f'narration {t:.1f}s, {len(lines)} lines, {len(words)} words' + (f'  ! check lines {low}' if low else ''))


if __name__ == '__main__':
    main()
