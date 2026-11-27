"""Original, royalty-free score for a short, made in code (numpy) — or with ACE-Step if it is installed.

  python scripts/vn.py music <short-dir>                 mood/bpm/key from data/meta.json (shots.js → S.music)
  python scripts/vn.py music <short-dir> --mood sad      override the mood
  python scripts/vn.py music <short-dir> --ai            ACE-Step takes (optional install: scripts/music_ai_setup.py)
  python scripts/vn.py music --list                      the moods

Writes <short>/audio/music.wav (48 kHz stereo, −1 dBFS). Every short gets its own variation (seeded by its folder name).
Moods: tension, sad, epic, mystery, action, hopeful, horror, calm, romantic, comedy.
"""
import argparse, json, math, subprocess, sys, zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import load_config  # noqa: E402

import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}
MIN, MAJ, SUS, DIM = (0, 3, 7), (0, 4, 7), (0, 5, 7), (0, 3, 6)
# chords: (root semitones from the key, quality)
MOODS = {
    'tension':  dict(bpm=78, key='D', prog=[(0, MIN), (8, MAJ), (5, MIN), (7, MAJ)], layers=['drone', 'pad', 'ostinato', 'heartbeat', 'bass'], bright=1800),
    'sad':      dict(bpm=64, key='A', prog=[(0, MIN), (8, MAJ), (3, MAJ), (10, MAJ)], layers=['pad', 'piano', 'cello'], bright=2400),
    'epic':     dict(bpm=88, key='C', prog=[(0, MIN), (8, MAJ), (3, MAJ), (10, MAJ)], layers=['drone', 'pad', 'ostinato', 'taiko', 'bass', 'brass'], bright=3000),
    'mystery':  dict(bpm=70, key='E', prog=[(0, MIN), (1, MAJ), (0, MIN), (7, MAJ)], layers=['drone', 'pad', 'musicbox'], bright=2200),
    'action':   dict(bpm=124, key='E', prog=[(0, MIN), (10, MAJ), (8, MAJ), (10, MAJ)], layers=['pad', 'ostinato16', 'kick', 'taiko', 'bass'], bright=3200),
    'hopeful':  dict(bpm=84, key='G', prog=[(0, MAJ), (7, MAJ), (9, MIN), (5, MAJ)], layers=['pad', 'piano', 'bass', 'softkick'], bright=3400),
    'horror':   dict(bpm=58, key='C#', prog=[(0, MIN), (1, MIN), (0, DIM), (6, MAJ)], layers=['drone', 'cluster', 'heartbeat', 'musicbox'], bright=1400),
    'calm':     dict(bpm=70, key='F', prog=[(0, MAJ), (5, MAJ), (9, MIN), (7, SUS)], layers=['pad', 'piano'], bright=2600),
    'romantic': dict(bpm=72, key='Eb', prog=[(0, MAJ), (9, MIN), (5, MAJ), (7, MAJ)], layers=['pad', 'piano', 'cello'], bright=2800),
    'comedy':   dict(bpm=112, key='F', prog=[(0, MAJ), (5, MAJ), (7, MAJ), (0, MAJ)], layers=['pizz', 'bass', 'softkick'], bright=3600),
}
f_of = lambda midi: 440.0 * 2 ** ((midi - 69) / 12)


def env(n, a=0.01, r=0.3, sustain=1.0):
    e = np.ones(n) * sustain; na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    if na: e[:na] = np.linspace(0, sustain, na)
    if nr: e[-nr:] *= np.linspace(1, 0, nr)
    return e


def saw(f, n, harm=10, detune=(0.0,), phase_seed=0):
    t = np.arange(n) / SR; out = np.zeros(n)
    for d in detune:
        ff = f * (1 + d)
        for k in range(1, harm + 1):
            if ff * k > SR / 2.2: break
            out += np.sin(2 * np.pi * ff * k * t + phase_seed * k) / k
    return out / len(detune)


def pluck(f, n, decay=1.2, bright=6):
    t = np.arange(n) / SR; out = np.zeros(n)
    for k in range(1, bright + 1):
        out += np.sin(2 * np.pi * f * k * (1 + 0.0004 * k * k) * t) * np.exp(-t * decay * (0.6 + k * 0.5)) / k ** 1.3
    return out * env(n, 0.004, 0.08)


def lp(x, hz, order=2):
    return sosfilt(butter(order, min(hz, SR / 2.3), 'low', fs=SR, output='sos'), x)


def hp(x, hz, order=2):
    return sosfilt(butter(order, hz, 'high', fs=SR, output='sos'), x)


def kick(n, f0=110, f1=42, d=0.45, gain=1.0):
    t = np.arange(n) / SR; f = f1 + (f0 - f1) * np.exp(-t * 18)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / d * 3) * gain


def score(mood, dur, seed, key=None, bpm=None):
    M = MOODS[mood]; rng = np.random.default_rng(seed)
    bpm = bpm or M['bpm']; beat = 60 / bpm; bar = beat * 4
    root = 48 + NOTE[(key or M['key'])]           # C3-ish
    N = int(dur * SR) + SR * 4
    L, R = np.zeros(N), np.zeros(N)
    def add(sig, t0, pan=0.0, g=1.0):
        i = int(t0 * SR); j = min(N, i + len(sig))
        if i >= N or j <= i: return
        s = sig[:j - i] * g; L[i:j] += s * (1 - max(0, pan)); R[i:j] += s * (1 + min(0, pan))
    nbars = int(math.ceil(dur / bar)) + 1
    prog = M['prog']
    # intensity over time: intro 0.35 → build → full → outro
    def inten(t):
        u = t / max(1, dur)
        return 0.35 if u < 0.12 else 0.6 if u < 0.3 else 1.0 if u < 0.9 else 0.5
    for b in range(nbars):
        t0 = b * bar; ch_root, q = prog[b % len(prog)]; I = inten(t0)
        chord = [root + ch_root + iv for iv in q]
        nb = int(bar * SR)
        if 'pad' in M['layers']:
            for k, m in enumerate(chord + [chord[0] + 12]):
                add(lp(saw(f_of(m), nb + SR // 2, 8, (-0.004, 0.0, 0.005), rng.random()), M['bright'] * (0.6 + 0.4 * I)) * env(nb + SR // 2, 0.9, 0.9), t0, pan=(k - 1.5) * 0.3, g=0.05)
        if 'brass' in M['layers'] and I >= 1:
            for m in chord: add(lp(saw(f_of(m + 12), nb, 12, (0, 0.003)), 2600) * env(nb, 0.3, 0.5, 0.9), t0, g=0.035)
        if 'drone' in M['layers']:
            t = np.arange(nb + SR) / SR
            add(np.sin(2 * np.pi * f_of(root - 12) * t) * (0.8 + 0.2 * np.sin(t * 0.7)) * env(nb + SR, 1.2, 1.2), t0, g=0.09)
        if 'cluster' in M['layers'] and b % 2 == 0:
            for m in (root + 13, root + 14, root + 18): add(lp(saw(f_of(m), nb * 2, 6, (0, 0.006)), 1200) * env(nb * 2, 2.0, 1.5), t0, pan=rng.uniform(-0.6, 0.6), g=0.03)
        if 'bass' in M['layers'] and I >= 0.6:
            pat = [0, 2] if bpm < 100 else [0, 1, 2, 3]
            for p in pat:
                n = int(beat * SR * (2 if bpm < 100 else 1))
                t = np.arange(n) / SR; f = f_of(root + ch_root - 12)
                add((np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t)) * env(n, 0.01, 0.2) * np.exp(-t * 1.5), t0 + p * beat, g=0.16)
        if ('ostinato' in M['layers'] or 'ostinato16' in M['layers']) and I >= 0.6:
            sub = 4 if 'ostinato16' in M['layers'] else 2
            notes = [chord[0], chord[2], chord[1] + 12, chord[2]]
            for k in range(4 * sub):
                m = notes[k % len(notes)] + (12 if (k // 4) % 2 and sub == 2 else 0)
                n = int(beat / sub * SR * 1.6)
                add(lp(pluck(f_of(m), n, 5.5, 5), 2600), t0 + k * beat / sub, pan=0.35 if k % 2 else -0.35, g=0.075 * (0.8 + 0.4 * (k % sub == 0)))
        if 'piano' in M['layers']:
            arp = [chord[0], chord[1], chord[2], chord[1] + 12, chord[2] + 12, chord[1] + 12, chord[2], chord[1]]
            step = beat / 2
            for k, m in enumerate(arp):
                if I < 0.6 and k % 2: continue
                add(pluck(f_of(m + 12), int(SR * 2.2), 1.6, 7), t0 + k * step + rng.uniform(0, 0.012), pan=-0.2 + 0.4 * (k / 8), g=0.07)
            if I >= 1 and rng.random() < 0.7:  # simple top melody
                for k in range(2): add(pluck(f_of(chord[rng.integers(0, 3)] + 24), int(SR * 2.5), 1.2, 6), t0 + (k * 2 + rng.integers(0, 2)) * beat, g=0.06)
        if 'musicbox' in M['layers']:
            for k in range(4):
                if rng.random() < 0.55: add(pluck(f_of(chord[rng.integers(0, 3)] + 36), int(SR * 2.0), 2.2, 3), t0 + k * beat + rng.choice([0, beat / 2]), pan=rng.uniform(-0.5, 0.5), g=0.045)
        if 'pizz' in M['layers']:
            for k in range(8):
                if k % 2 == 0 or rng.random() < 0.4: add(pluck(f_of(chord[k % 3] + 12), int(SR * 0.5), 9, 4), t0 + k * beat / 2, pan=0.3 if k % 2 else -0.3, g=0.09)
        if 'cello' in M['layers'] and I >= 0.6:
            add(lp(saw(f_of(root + ch_root - 12), nb, 10, (0, 0.003)), 900) * env(nb, 0.5, 0.6, 0.9) * (1 + 0.04 * np.sin(np.arange(nb) / SR * 2 * np.pi * 5)), t0, g=0.06)
        if 'heartbeat' in M['layers'] and I >= 0.6:
            for p in (0, 2):
                add(lp(kick(int(SR * 0.4), 80, 40, 0.25), 300), t0 + p * beat, g=0.32); add(lp(kick(int(SR * 0.35), 70, 38, 0.2), 300), t0 + p * beat + 0.24, g=0.22)
        if 'kick' in M['layers'] and I >= 0.6:
            for p in range(4): add(kick(int(SR * 0.5)), t0 + p * beat, g=0.35)
        if 'softkick' in M['layers'] and I >= 0.6:
            for p in (0, 2): add(lp(kick(int(SR * 0.4), 90, 45, 0.3), 400), t0 + p * beat, g=0.22)
        if 'taiko' in M['layers'] and I >= 1:
            for p in ([0, 1.5, 2, 3] if bpm < 110 else [0, 0.75, 1.5, 2, 2.5, 3, 3.5]):
                n = int(SR * 0.6); t = np.arange(n) / SR
                drum = kick(n, 95, 55, 0.5) + lp(rng.standard_normal(n), 500) * np.exp(-t * 20) * 0.5
                add(drum, t0 + p * beat, pan=rng.uniform(-0.2, 0.2), g=0.28)
    # room reverb (synthetic impulse), gentle high cut
    ir_n = int(SR * 2.4); t = np.arange(ir_n) / SR
    irL = np.random.default_rng(seed + 1).standard_normal(ir_n) * np.exp(-t * 2.6); irR = np.random.default_rng(seed + 2).standard_normal(ir_n) * np.exp(-t * 2.6)
    irL /= np.sqrt((irL ** 2).sum()); irR /= np.sqrt((irR ** 2).sum())
    wetL, wetR = fftconvolve(L, irL)[:N], fftconvolve(R, irR)[:N]
    L, R = lp(L + wetL * 0.35, 9000), lp(R + wetR * 0.35, 9000)
    L, R = hp(L, 35), hp(R, 35)
    n = int(dur * SR); out = np.stack([L[:n], R[:n]], 1)
    fade = int(SR * 1.5); out[:int(SR * 0.015)] *= np.linspace(0, 1, int(SR * 0.015))[:, None]; out[-fade:] *= np.linspace(1, 0, fade)[:, None]
    return out / (np.abs(out).max() + 1e-9) * 0.89


AI_CAPTIONS = {
    'tension': 'Dark cinematic tension underscore, pulsing low strings ostinato, deep drones, distant heartbeat drum, minor key, suspenseful and restrained, sits under a narrator',
    'sad': 'Melancholic cinematic piano and soft strings, slow, emotional, minor key, intimate, sits under a narrator, no drums',
    'epic': 'Epic orchestral trailer music, big taiko drums, soaring brass and strings, heroic minor key, building to a powerful climax',
    'mystery': 'Mysterious ambient underscore, music box, airy pads, subtle drones, curious and eerie, no drums',
    'action': 'Fast driving action score, staccato strings, punchy percussion, intense and urgent, cinematic',
    'hopeful': 'Warm hopeful cinematic underscore, gentle piano, soft strings, uplifting major key, light percussion',
    'horror': 'Unsettling horror ambience, dissonant drones, creaking textures, sparse low hits, music box, dread',
    'calm': 'Calm gentle ambient piano and pads, peaceful, soft, sits under a narrator, no drums',
    'romantic': 'Tender romantic piano and strings, warm, gentle, heartfelt',
    'comedy': 'Light playful comedic underscore, pizzicato strings, bouncy bass, quirky woodwinds',
}


def ai_music(P, mood, dur, bpm, cfg):
    ace = cfg.get('acestep_dir')
    if not ace or not Path(ace, 'pyproject.toml').exists():
        sys.exit('ACE-Step is not installed: python scripts/music_ai_setup.py   (or run music without --ai)')
    A = P / 'audio'; (A / 'takes').mkdir(parents=True, exist_ok=True)
    song = {'mode': 'score', 'instrumental': True, 'caption': AI_CAPTIONS[mood] + f', {bpm} BPM', 'lyrics': '[Instrumental]', 'bpm': bpm,
            'timesignature': 4, 'duration': round(dur + 6), 'seeds': [11, 47], 'lm': 'acestep-5Hz-lm-0.6B'}
    (A / 'song.json').write_text(json.dumps(song, indent=1))
    here = Path(__file__).resolve().parent / 'music_ai'
    env = {**__import__('os').environ, 'TOKENIZERS_PARALLELISM': 'false', 'ACESTEP_SAVE_MEMORY': '1', 'PYTHONUNBUFFERED': '1'}
    for step in ('gen_song.py', 'decode_latents.py'):
        r = subprocess.run(['uv', 'run', 'python', str(here / step), str(P.resolve())], cwd=ace, env=env)
        if r.returncode: sys.exit(f'ACE-Step {step} failed (exit {r.returncode}); the built-in score still works: run music without --ai')
    takes = sorted((A / 'takes').glob('seed*.wav'))
    if not takes: sys.exit('no takes were produced')
    import soundfile as sf
    a, sr = sf.read(takes[0], dtype='float32'); sf.write(A / 'music.wav', a, sr)
    print('music.wav ←', takes[0].name, '(other takes in audio/takes/ — listen and copy the best one over music.wav)')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('short', nargs='?')
    ap.add_argument('--mood'); ap.add_argument('--bpm', type=int); ap.add_argument('--key')
    ap.add_argument('--ai', action='store_true'); ap.add_argument('--list', action='store_true')
    a = ap.parse_args()
    if a.list or not a.short:
        for k, v in MOODS.items(): print(f'{k:<9} {v["bpm"]} BPM  {", ".join(v["layers"])}')
        return
    P = Path(a.short)
    meta = json.loads((P / 'data' / 'meta.json').read_text()) if (P / 'data' / 'meta.json').exists() else {}
    m = meta.get('music') or {}
    mood = a.mood or m.get('mood') or 'tension'
    if mood not in MOODS: sys.exit(f'unknown mood {mood}; moods: {", ".join(MOODS)}')
    dur = float(meta.get('duration') or json.loads((P / 'data' / 'lines.json').read_text())['duration']) + 1.0
    bpm = a.bpm or m.get('bpm') or MOODS[mood]['bpm']
    if a.ai: return ai_music(P, mood, dur, bpm, load_config())
    import soundfile as sf
    seed = zlib.crc32(P.resolve().name.encode()) & 0xFFFF
    out = score(mood, dur, seed, a.key or m.get('key'), bpm)
    (P / 'audio').mkdir(exist_ok=True); sf.write(P / 'audio' / 'music.wav', out.astype(np.float32), SR)
    print(f'audio/music.wav  {mood} {bpm} BPM  {dur:.1f}s')


if __name__ == '__main__':
    main()
