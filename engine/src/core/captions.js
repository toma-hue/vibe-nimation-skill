// Burned-in captions, word by word, from data/words.json. Style: data/style.json → "captions" (see reference/CAPTIONS.md).
import { W, clamp, ease } from './lib.js';

export const CAPTION = {
  font: 'Montserrat', weight: 900, size: 84, upper: true,
  color: '#FFFFFF', active: '#FFD400', stroke: '#000000', strokeWidth: 14,
  shadow: 'rgba(0,0,0,0.55)', shadowBlur: 0, shadowY: 6,
  y: 1420,                 // baseline of the caption block (TikTok / Shorts UI covers the bottom ~380 px and the right edge)
  maxWords: 3, maxChars: 18, lineGap: 1.08, maxWidth: 900,
  pop: 0.12,               // seconds of the pop-in scale on each new word group
  activeScale: 1.08,       // the word being said grows a little
  box: null,               // e.g. 'rgba(0,0,0,0.45)' for a box behind the words
};

let groups = null, cfg = CAPTION;
export function setupCaptions(words, style = {}) {
  cfg = { ...CAPTION, ...(style.captions || {}) };
  groups = [];
  let cur = [];
  const flush = () => { if (cur.length) groups.push(cur); cur = []; };
  for (let i = 0; i < words.length; i++) {
    const w = words[i], prev = cur[cur.length - 1];
    const chars = cur.reduce((n, x) => n + x.w.length + 1, 0) + w.w.length;
    if (cur.length && (cur.length >= cfg.maxWords || chars > cfg.maxChars || w.line !== prev.line || w.s - prev.e > 0.6)) flush();
    cur.push(w);
    if (/[.!?…,;:]$/.test(w.w)) flush();
  }
  flush();
  groups.forEach((g, i) => { g.start = g[0].s; g.end = groups[i + 1] ? Math.min(groups[i + 1][0].s, g[g.length - 1].e + 0.6) : g[g.length - 1].e + 0.6; });
}

export function drawCaptions(ctx, t, o = {}) {
  if (!groups) return;
  const g = groups.find((x) => t >= x.start && t < x.end); if (!g) return;
  const c = { ...cfg, ...o };
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over';
  const font = (s) => `${c.weight} ${s}px "${c.font}", Montserrat, Arial Black, sans-serif`;
  const txt = (w) => (c.upper ? w.w.toUpperCase() : w.w).replace(/[,;:]$/, '');
  ctx.font = font(c.size);
  // wrap into lines that fit maxWidth
  const space = ctx.measureText(' ').width + c.size * 0.18, lines = [[]]; let lw = 0;
  for (const w of g) { const ww = ctx.measureText(txt(w)).width; if (lines[lines.length - 1].length && lw + space + ww > c.maxWidth) { lines.push([]); lw = 0; } lines[lines.length - 1].push(w); lw += (lw ? space : 0) + ww; }
  const pop = c.pop ? ease.outBack(clamp((t - g.start) / c.pop)) : 1;
  const lh = c.size * c.lineGap, y0 = c.y - (lines.length - 1) * lh;
  ctx.translate(W / 2, c.y - lh * (lines.length - 1) / 2); ctx.scale(0.85 + 0.15 * pop, 0.85 + 0.15 * pop); ctx.translate(-W / 2, -(c.y - lh * (lines.length - 1) / 2));
  ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  lines.forEach((ln, li) => {
    const widths = ln.map((w) => ctx.measureText(txt(w)).width), total = widths.reduce((a, b) => a + b, 0) + space * (ln.length - 1);
    let x = W / 2 - total / 2; const y = y0 + li * lh;
    if (c.box) { ctx.fillStyle = c.box; ctx.beginPath(); ctx.roundRect(x - 24, y - c.size * 0.9, total + 48, c.size * 1.15, 16); ctx.fill(); }
    ln.forEach((w, k) => {
      const active = t >= w.s && t < (ln[k + 1] ? ln[k + 1].s : w.e + 0.25), s = active ? c.activeScale : 1, cx = x + widths[k] / 2;
      ctx.save(); ctx.translate(cx, y); ctx.scale(s, s); ctx.font = font(c.size); ctx.textAlign = 'center';
      if (c.shadow) { ctx.fillStyle = c.shadow; ctx.fillText(txt(w), 0, c.shadowY); if (c.strokeWidth) { ctx.strokeStyle = c.shadow; ctx.lineWidth = c.strokeWidth; ctx.strokeText(txt(w), 0, c.shadowY); } }
      if (c.strokeWidth) { ctx.strokeStyle = c.stroke; ctx.lineWidth = c.strokeWidth; ctx.strokeText(txt(w), 0, 0); }
      ctx.fillStyle = active ? c.active : c.color; ctx.fillText(txt(w), 0, 0);
      ctx.restore(); x += widths[k] + space;
    });
  });
  ctx.restore();
}
