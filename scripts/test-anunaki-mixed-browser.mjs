import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Exercise the pre-Anunaki client source against the current API; all DB and
// browser state is local and disposable. Public art and dependencies are linked
// from the current checkout; the client and engine source come from the commit.
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const oldRevision = '77f44c8b';
const scratch = await mkdtemp(join(tmpdir(), 'squabblemon-old-client-'));
const pnpm = process.env.npm_execpath;
if (!pnpm) throw new Error('Run through pnpm.');
function completion(child) {
  return new Promise((resolvePromise, reject) => {
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolvePromise() : reject(new Error(`Process exited ${code}`)));
  });
}
try {
  const archive = spawn('git', ['archive', oldRevision, 'artifacts/squabblemon/src', 'artifacts/squabblemon/vite.config.ts', 'artifacts/squabblemon/index.html', 'artifacts/squabblemon/package.json', 'lib/squabblemon-engine', 'lib/api-client-react', 'tsconfig.base.json'], {cwd: root, stdio: ['ignore', 'pipe', 'inherit']});
  const extract = spawn('tar', ['-x', '-C', scratch], {stdio: ['pipe', 'inherit', 'inherit']});
  archive.stdout.pipe(extract.stdin);
  await Promise.all([completion(archive), completion(extract)]);
  for (const path of ['node_modules', 'artifacts/squabblemon/node_modules', 'artifacts/squabblemon/public', 'lib/squabblemon-engine/node_modules', 'lib/api-client-react/node_modules'])
    await symlink(join(root, path), join(scratch, path), 'dir');
  const test = spawn(process.execPath, [pnpm, 'run', 'test:online-compat:db'], {cwd: root, stdio: 'inherit', env: {
    ...process.env, ANUNAKI_MIXED_BROWSER: '1', ANUNAKI_OLD_CLIENT_ROOT: join(scratch, 'artifacts/squabblemon'),
  }});
  await completion(test);
} finally {
  await rm(scratch, {recursive: true, force: true});
}
