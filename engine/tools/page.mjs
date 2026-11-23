// Render one page of the project to a PNG/JPG with headless Chrome or Edge (no npm deps; Node 20+).
//   node tools/page.mjs "sheet.html?id=mike" out.png        waits for window.DONE, saves canvas#c
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CHROME = process.env.CHROME || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/opt/pw-browsers/chromium',
].find((p) => fs.existsSync(p));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const [url, out] = process.argv.slice(2);
if (!url || !out) { console.log('usage: node tools/page.mjs "<page.html?args>" <out.png|jpg>'); process.exit(1); }
if (!CHROME) { console.error('Chrome/Edge not found — set CHROME=<path>'); process.exit(1); }
const srv = http.createServer((req, r) => {
  const u = decodeURIComponent(req.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(r);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const port = srv.address().port, prof = fs.mkdtempSync(path.join(os.tmpdir(), 'vn-page-'));
const chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-background-networking', '--disable-component-update', '--remote-debugging-port=0', `--user-data-dir=${prof}`, '--no-first-run', '--hide-scrollbars', '--window-size=1920,1200', 'about:blank'], { stdio: 'ignore' });
let dbg; for (let i = 0; i < 150 && !dbg; i++) { try { dbg = fs.readFileSync(path.join(prof, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(); } catch { await sleep(100); } }
let target; for (let i = 0; i < 100 && !target; i++) { try { target = await (await fetch(`http://127.0.0.1:${dbg}/json/new?http://127.0.0.1:${port}/${url}`, { method: 'PUT' })).json(); } catch { await sleep(150); } }
const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(); const logs = [];
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method === 'Runtime.exceptionThrown') logs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send('Runtime.enable');
let done; for (let i = 0; i < 300; i++) { done = await ev('window.DONE'); if (done) break; await sleep(100); }
let code = 0;
if (done !== true) { console.error('page did not finish:', done, logs.join('\n')); code = 1; }
else {
  const type = out.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
  const d = await ev(`document.getElementById('c').toDataURL('${type}', 0.9)`);
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, Buffer.from(d.slice(d.indexOf(',') + 1), 'base64')); console.log(out);
}
ws.close(); chrome.kill('SIGKILL'); srv.close(); setTimeout(() => { try { fs.rmSync(prof, { recursive: true, force: true }); } catch {} process.exit(code); }, 300);
