"""The soundtrack: narration on top, music ducked under the voice, sound effects from data/cues.json, −14 LUFS.

  python scripts/vn.py mix <short-dir>                → data/mix.wav (48 kHz stereo)
  python scripts/vn.py mix <short-dir> --music-db -20 music level under the voice (default −19 dB)

Cue types (shots.js: q(t, 'type', {gain, end})) — all synthesized, soft on phone speakers, no clicks or hi-hats:
  whoosh (cut / fast move) · boom (dramatic sub drop) · hit (impact) · riser (needs end) · wind (needs end) ·
  rain (needs end) · thunder · heartbeat (needs end) · thump (door, body) · steps (needs end) · glass · swell (needs end) ·
  silence (needs end: music drops out between t and end, for a hard dramatic pause)
"""
import argparse, json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

SR = 48000
rng = np.random.default_rng(7)


def lp(x, hz): return sosfilt(butter(2, hz, 'low', fs=SR, output='sos'), x)
def hp(x, hz): return sosfilt(butter(2, hz, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], 'band', fs=SR, output='sos'), x)
def tt(n): return np.arange(n) / SR
def noise(n): return rng.standard_normal(n)


def sweep_noise(n, f0, f1):
    """noise through a band-pass whose centre glides f0 → f1 (block-wise)"""
    out = np.zeros(n); x = noise(n); B = 2048
    for i in range(0, n, B):
        f = f0 + (f1 - f0) * i / n; out[i:i + B] = bp(x[i:i + B + 512], max(40, f * 0.6), min(SR / 2.3, f * 1.6))[:len(out[i:i + B])]
    return out


def sfx(kind, dur=None):
    if kind == 'whoosh':
        n = int(SR * 0.55); e = np.sin(np.linspace(0, np.pi, n)) ** 2
        return sweep_noise(n, 300, 2400) * e * 0.5
    if kind == 'boom':
        n = int(SR * 2.2); t = tt(n); f = 30 + 35 * np.exp(-t * 4)
        return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6) + lp(noise(n), 180) * np.exp(-t * 3) * 0.6) * 0.9
    if kind == 'hit':
        n = int(SR * 0.9); t = tt(n); f = 45 + 90 * np.exp(-t * 25)
        return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5) + lp(noise(n), 1500) * np.exp(-t * 18) * 0.7) * 0.9
    if kind == 'thump':
        n = int(SR * 0.5); t = tt(n); return lp(np.sin(2 * np.pi * 60 * t) * np.exp(-t * 12) + noise(n) * np.exp(-t * 40) * 0.3, 400) * 0.8
    if kind == 'thunder':
        n = int(SR * 4); t = tt(n); return lp(noise(n), 220) * (np.exp(-t * 0.9) * (0.6 + 0.4 * np.sin(t * 7) ** 2)) * 0.9
    if kind == 'glass':
        n = int(SR * 1.2); t = tt(n); x = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * (6 + k)) for k, f in enumerate([2100, 3300, 4700, 6100]))
        return lp(x * 0.15 + hp(noise(n), 2500) * np.exp(-t * 14) * 0.25, 7000)
    n = int(SR * max(0.3, dur or 2.0)); t = tt(n); u = t / t[-1]
    if kind == 'riser':
        return sweep_noise(n, 200, 3000) * u ** 2 * 0.45 + np.sin(2 * np.pi * np.cumsum(80 + 220 * u ** 2) / SR) * u ** 2 * 0.12
    if kind == 'swell':
        return lp(noise(n), 800) * np.sin(np.pi * u) ** 2 * 0.25
    if kind == 'wind':
        x = lp(noise(n), 500) * (0.6 + 0.4 * np.sin(t * 0.7) * np.sin(t * 0.23 + 1)); return x * np.minimum(1, t / 1.0) * np.minimum(1, (t[-1] - t) / 1.0) * 0.35
    if kind == 'rain':
        return bp(noise(n), 1500, 6000) * 0.12 * np.minimum(1, t / 1.0) * np.minimum(1, (t[-1] - t) / 1.0)
    if kind == 'heartbeat':
        out = np.zeros(n)
        for k in np.arange(0, t[-1], 0.85):
            for off, g in ((0, 1.0), (0.24, 0.7)):
                i = int((k + off) * SR); m = min(n - i, int(SR * 0.3))
                if m > 0: out[i:i + m] += lp(np.sin(2 * np.pi * 55 * tt(m)) * np.exp(-tt(m) * 14), 200) * g
        return out * 0.9
    if kind == 'steps':
        out = np.zeros(n)
        for k in np.arange(0, t[-1], 0.48):
            i = int(k * SR); m = min(n - i, int(SR * 0.15))
            if m > 0: out[i:i + m] += lp(noise(m) * np.exp(-tt(m) * 45) + np.sin(2 * np.pi * 90 * tt(m)) * np.exp(-tt(m) * 30), 900) * 0.5
        return out
    return None


def envelope(x, attack=0.03, release=0.35):
    """voice activity envelope (0..1) for ducking"""
    hop = 480; r = np.sqrt(np.convolve(x ** 2, np.ones(hop) / hop, 'same'))
    on = (r > 0.01).astype(float)
    a, rl = np.exp(-1 / (attack * SR)), np.exp(-1 / (release * SR)); out = np.zeros_like(on); v = 0.0
    step = 64
    for i in range(0, len(on), step):
        tgt = on[i]; c = a if tgt > v else rl; v = tgt + (v - tgt) * c ** step; out[i:i + step] = v
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('short'); ap.add_argument('--music-db', type=float, default=-19.0); ap.add_argument('--lufs', type=float, default=-14.0)
    a = ap.parse_args()
    P = Path(a.short); D = P / 'data'
    meta = json.loads((D / 'meta.json').read_text()) if (D / 'meta.json').exists() else {}
    nar, sr = sf.read(D / 'narration.wav', dtype='float64')
    if nar.ndim > 1: nar = nar.mean(1)
    dur = float(meta.get('duration') or len(nar) / SR)
    N = int(dur * SR)
    voice = np.zeros(N); voice[:min(N, len(nar))] = nar[:N]
    voice = hp(voice, 70); voice = voice / (np.sqrt(np.mean(voice[np.abs(voice) > 0.01] ** 2)) + 1e-9) * 10 ** (-18 / 20)
    mixL, mixR = voice.copy(), voice.copy()
    # music, ducked under the voice
    mus_p = next((p for p in (P / 'audio' / 'music.wav', P / 'audio' / 'music.mp3') if p.exists()), None)
    cues = json.loads((D / 'cues.json').read_text()) if (D / 'cues.json').exists() else []
    if mus_p:
        m, msr = sf.read(mus_p, dtype='float64', always_2d=True)
        if msr != SR:
            from scipy.signal import resample_poly; m = resample_poly(m, SR, msr, axis=0)
        if len(m) < N: m = np.concatenate([m] * (N // len(m) + 1))
        m = m[:N]; m = m / (np.sqrt(np.mean(m ** 2)) + 1e-9) * 10 ** ((-18 + a.music_db) / 20)
        duck = 1 - envelope(voice) * (1 - float((meta.get('music') or {}).get('duck', 0.45)))
        for c in cues:
            if c['type'] == 'silence':
                i0, i1 = int(c['t'] * SR), int(c.get('end', c['t'] + 1) * SR); ramp = int(0.12 * SR)
                g = np.ones(N); g[i0:i1] = 0
                g[max(0, i0 - ramp):i0] = np.linspace(1, 0, len(g[max(0, i0 - ramp):i0])); g[i1:i1 + ramp] = np.linspace(0, 1, len(g[i1:i1 + ramp])); duck *= g
        fo = int(1.5 * SR); duck[-fo:] *= np.linspace(1, 0, fo)
        mixL += m[:, 0] * duck; mixR += m[:, 1 if m.shape[1] > 1 else 0] * duck
    for c in cues:
        if c['type'] == 'silence': continue
        x = sfx(c['type'], (c.get('end', c['t'] + 2) - c['t']))
        if x is None: print('skip unknown cue', c['type']); continue
        i = int(c['t'] * SR); j = min(N, i + len(x))
        if i >= N: continue
        g = c.get('gain', 1.0) * 10 ** (-24 / 20) * 4; pan = c.get('pan', 0.0)
        mixL[i:j] += x[:j - i] * g * (1 - max(0, pan)); mixR[i:j] += x[:j - i] * g * (1 + min(0, pan))
    out = np.stack([mixL, mixR], 1)
    out = np.stack([lp(out[:, 0], 14000), lp(out[:, 1], 14000)], 1)
    try:
        import pyloudnorm as pyln
        loud = pyln.Meter(SR).integrated_loudness(out); out *= 10 ** ((a.lufs - loud) / 20)
    except Exception as e:
        print('(loudness meter unavailable, using RMS):', e); out *= 10 ** (-16 / 20) / (np.sqrt(np.mean(out ** 2)) + 1e-9)
    peak = 10 ** (-1.2 / 20); out = np.where(np.abs(out) > peak * 0.8, np.sign(out) * (peak * 0.8 + (peak * 0.2) * np.tanh((np.abs(out) - peak * 0.8) / (peak * 0.2))), out)
    sf.write(D / 'mix.wav', out.astype(np.float32), SR)
    print(f'data/mix.wav  {dur:.1f}s  cues {len(cues)}  music {"yes" if mus_p else "no"}')


if __name__ == '__main__':
    main()
