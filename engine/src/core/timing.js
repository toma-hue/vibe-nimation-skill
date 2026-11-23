// Narration timing (from scripts/voice.py): lines, words, mouth track, and the cast (data/characters.json).
//   T.L(i) / T.E(i)      start / end of script line i (0-based), seconds
//   T.w('word', t0)      start of the first word matching at or after t0 (case/punctuation-insensitive)
//   T.mouthAt(t)         0..1 how open the narrator's mouth is (use for a character miming a line)
//   T.talk(id, t)        mouth value only while a line with "mime": id is playing, else 0
//   T.CH.mike            a character spec by id
export const T = { lines: [], words: [], mouth: [], dur: 0, CH: {}, cast: [] };
const norm = (x) => String(x).toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9%'-]/g, '');

export async function loadTiming() {
  const get = async (f, d) => { try { const r = await fetch(f); if (!r.ok) throw 0; return await r.json(); } catch { return d; } };
  const ln = await get('data/lines.json', { duration: 0, lines: [] });
  T.lines = ln.lines; T.dur = ln.duration;
  T.words = await get('data/words.json', []);
  T.mouth = await get('data/mouth.json', []);
  const cast = await get('data/characters.json', { characters: [] });
  T.cast = cast.characters || cast; T.CH = Object.fromEntries(T.cast.map((c) => [c.id, c]));
  T.style = await get('data/style.json', {});
  return T;
}
T.L = (i) => (T.lines[i] ? T.lines[i].start : 0);
T.E = (i) => (T.lines[i] ? T.lines[i].end : 0);
T.w = (word, t0 = 0, fallback = null) => {
  const target = norm(word);
  for (const x of T.words) if (x.s >= t0 - 0.05 && norm(x.w) === target) return x.s;
  console.warn('word not found:', word, 'after', t0); return fallback ?? t0;
};
T.mouthAt = (t) => { const f = t * 30, i = Math.floor(f), u = f - i; return (T.mouth[i] || 0) * (1 - u) + (T.mouth[i + 1] || 0) * u; };
T.talk = (id, t) => (T.lines.some((l) => l.mime === id && t >= l.start - 0.02 && t <= l.end + 0.02) ? T.mouthAt(t) : 0);
