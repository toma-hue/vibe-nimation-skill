// Automated rig checks in headless Chrome / Edge (no npm deps; Node 20+): hair coverage in every view, the profile
// hair as one shape, the back of the head / neck / shoulder axis, hand gestures and reach targets, for every character
// in data/characters.json × the 8 views. Prints only the failures and a summary; exits 1 on any failure.
//   node tools/rigtest.mjs                          everything, the whole cast
//   node tools/rigtest.mjs --ids mike,joyce         some characters
//   node tools/rigtest.mjs --only hair,reach        some groups (hair · hands · reach)
//   node tools/rigtest.mjs --file data/other.json   another cast file
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/opt/pw-browsers/chromium',
].find((p) => fs.existsSync(p));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const MAX = Number(arg('--max') || 40);

if (!CHROME) { console.error('Chrome/Edge not found — set CHROME=<path>'); process.exit(2); }
const qs = new URLSearchParams(); for (const k of ['ids', 'only', 'file']) if (arg('--' + k)) qs.set(k, arg('--' + k));
const srv = http.createServer((req, r) => {
  const u = decodeURIComponent(req.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'rigtest.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(r);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port, prof = fs.mkdtempSync(path.join(os.tmpdir(), 'vn-rigtest-'));
const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-background-networking', '--disable-component-update', '--remote-debugging-port=0', `--user-data-dir=${prof}`, '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
let dbg; for (let i = 0; i < 150 && !dbg; i++) { try { dbg = fs.readFileSync(path.join(prof, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(); } catch { await sleep(100); } }
let target; for (let i = 0; i < 100 && !target; i++) { try { target = await (await fetch(`http://127.0.0.1:${dbg}/json/new?${encodeURIComponent(`http://127.0.0.1:${port}/rigtest.html?${qs}`)}`, { method: 'PUT' })).json(); } catch { await sleep(150); } }
const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(); const errs = [];
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send('Runtime.enable');
let R; for (let i = 0; i < 1800; i++) { if (await ev('window.DONE')) { R = await ev('window.RIGTEST'); break; } await sleep(100); }
let code = 0;
if (!R) { console.log('RIGTEST: page did not finish', errs.join('\n')); code = 2; }
else {
  R.lines.slice(0, MAX).forEach((l) => console.log(l));
  if (R.lines.length > MAX) console.log(`… ${R.lines.length - MAX} more (--max N)`);
  console.log(`RIGTEST: ${R.pass} pass, ${R.fail} fail`); code = R.fail ? 1 : 0;
}
ws.close(); chrome.kill('SIGKILL'); srv.close(); setTimeout(() => { try { fs.rmSync(prof, { recursive: true, force: true }); } catch {} process.exit(code); }, 300);
