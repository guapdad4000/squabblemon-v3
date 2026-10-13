import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontend = fileURLToPath(new URL('../', import.meta.url));
const origin = process.env.KUMITE_ORIGIN ?? 'http://127.0.0.1:43217';
const url = new URL(origin);
if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)) {
  throw new Error('The isolated Kumite review must run on HTTP loopback');
}
const temporary = await mkdtemp('/tmp/kumite-preview-');
const env = { ...process.env, PORT: url.port || '80', BASE_PATH: '/', KUMITE_ORIGIN: origin,
  KUMITE_PREVIEW_DIST: `${temporary}/dist`, TMPDIR: temporary };
const output = process.env.KUMITE_OUTPUT ?? fileURLToPath(new URL('../../deliverables/kumite-review/browser/', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.gif': 'image/gif', '.json': 'application/json' };
let child;
let server;
const timeout = setTimeout(() => { child?.kill('SIGTERM'); server?.closeAllConnections(); server?.close(); }, 480000);
async function run(args, extra = {}) {
  child = spawn(process.execPath, args, { cwd: frontend, env: { ...env, ...extra }, stdio: 'inherit' });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  child = null;
  if (code !== 0) throw new Error(`Kumite review command exited ${code}`);
}
try {
  // Production plugins compile the actual components. No demo-data mode is
  // added to the application; API fixtures remain in the browser verifiers.
  await run(['node_modules/vite/bin/vite.js', 'build', '--config', 'e2e/vite.kumite-preview.config.ts']);
  server = createServer(async (request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, origin).pathname); }
    catch { response.writeHead(400).end(); return; }
    if (pathname.includes('..')) { response.writeHead(400).end(); return; }
    // The review battle has an empty reaction collection, independent of the
    // authenticated production reaction service and its server command checks.
    if (pathname.endsWith('/reactions')) {
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({
        serverTime: Date.now(), revision: 0, owned: [], tray: [], latest: {},
      })); return;
    }
    for (const directory of [env.KUMITE_PREVIEW_DIST, `${frontend}/public`]) {
      try {
        const content = await readFile(path.join(directory, pathname));
        response.writeHead(200, { 'Content-Type': types[path.extname(pathname)] ?? 'application/octet-stream' }).end(content);
        return;
      } catch { /* Try the production asset directory next. */ }
    }
    response.writeHead(404).end();
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(Number(env.PORT), url.hostname, resolve); });
  const scripts = process.env.KUMITE_BATTLE_ONLY === '1'
    ? [['verify-kumite-battle.mjs', 'gameplay']]
    : [['verify-kumite-battle.mjs', 'gameplay'], ['verify-kumite-waiting.mjs', 'waiting'],
      ['verify-kumite-result-fallback.mjs', 'fallback'], ['verify-kumite.mjs', 'lobby']];
  for (const [script, section] of scripts) {
    await run([`e2e/${script}`], { KUMITE_OUTPUT: `${output}/${section}` });
  }
} finally {
  clearTimeout(timeout);
  child?.kill('SIGTERM');
  if (server?.listening) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await rm(temporary, { recursive: true, force: true });
}
