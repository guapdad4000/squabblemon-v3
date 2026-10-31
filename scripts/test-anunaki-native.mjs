// Exercise enabled event/banner behavior in a disposable source copy and a fresh
// owned native PostgreSQL cluster. Never consumes a caller-provided database.
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

if ('DATABASE_URL' in process.env) throw new Error('Unset DATABASE_URL; this harness requires its own disposable cluster.');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const copy = mkdtempSync(join(tmpdir(), 'anunaki-native-source-'));
function run(command, args, cwd = root, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error(`${command} failed${result.status == null ? '' : ` (${result.status})`}`);
}
function update(path, oldText, newText) {
  const full = join(copy, path), text = readFileSync(full, 'utf8');
  if (!text.includes(oldText)) {
    if (text.includes(newText)) return;
    throw new Error(`Fixture setup failed: expected marker missing in ${path}`);
  }
  writeFileSync(full, text.replace(oldText, newText));
}
async function runNativeHarness(command, args, cwd, env) {
  const child = spawn(command, args, { cwd, env, stdio: 'inherit' });
  const interrupt = signal => child.kill(signal);
  const onInt = () => interrupt('SIGINT'), onTerm = () => interrupt('SIGTERM');
  process.on('SIGINT', onInt); process.on('SIGTERM', onTerm);
  try {
    await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`Native harness failed (${signal ?? code})`)));
    });
  } finally {
    process.off('SIGINT', onInt); process.off('SIGTERM', onTerm);
  }
}
try {
  run('rsync', ['-a', '--exclude=.git/', '--exclude=node_modules/', '--exclude=public/', '--exclude=dist/', '--exclude=test-results/', '--exclude=playwright-report/', '--exclude=output/', '--exclude=/artifacts/deliverables/', '--exclude=/scripts/results/', '--exclude=/design/', '--exclude=/docs/', './', `${copy}/`]);
  mkdirSync(join(copy, 'node_modules'), { recursive: true });
  run('rsync', ['-a', '--exclude=/.pnpm/', `${join(root, 'node_modules')}/`, `${join(copy, 'node_modules')}/`]);
  symlinkSync(join(root, 'node_modules/.pnpm'), join(copy, 'node_modules/.pnpm'), 'dir');
  // Use the same read-only shipped art while validating the copied release catalog.
  symlinkSync(join(root, 'artifacts/squabblemon/public'), join(copy, 'artifacts/squabblemon/public'), 'dir');
  // Media provenance tests read retained sheets and manifests, not just public exports.
  symlinkSync(join(root, 'docs'), join(copy, 'docs'), 'dir');
  // Copy only symlink-based package dependency directories. Relative workspace
  // links then resolve inside this copy, while immutable packages are shared.
  for (const group of ['artifacts', 'lib']) for (const packageName of readdirSync(join(root, group))) {
    const dependencyDir = join(root, group, packageName, 'node_modules');
    try { readdirSync(dependencyDir); } catch { continue; }
    const target = join(copy, group, packageName, 'node_modules');
    mkdirSync(target, { recursive: true });
    run('rsync', ['-a', `${dependencyDir}/`, `${target}/`]);
  }
  update('lib/squabblemon-engine/src/anunakiEvent.ts', 'ANUNAKI_EVENT_GAMEPLAY_READY = false', 'ANUNAKI_EVENT_GAMEPLAY_READY = true');
  update('lib/squabblemon-engine/src/anunakiBanner.ts', 'ANUNAKI_BANNER_GAMEPLAY_READY = false', 'ANUNAKI_BANNER_GAMEPLAY_READY = true');
  const bannerPath = join(copy, 'lib/squabblemon-engine/src/anunakiBanner.ts');
  const bannerText = readFileSync(bannerPath, 'utf8');
  const windowMarker = /ANUNAKI_BANNER_WINDOWS: readonly AnunakiBannerWindow\[\] = \[[\s\S]*?\];/;
  if (!windowMarker.test(bannerText)) throw new Error('Banner window declaration changed; review fixture setup.');
  writeFileSync(bannerPath, bannerText.replace(windowMarker, "ANUNAKI_BANNER_WINDOWS: readonly AnunakiBannerWindow[] = [{ startsAt: '2026-10-29T00:00:00.000Z', endsAt: '2026-11-05T00:00:00.000Z' }];"));
  const nativeRunner = 'scripts/test-payments-database.mjs';
  const runner = readFileSync(join(copy, nativeRunner), 'utf8');
  const start = runner.indexOf('  if (socialOnly || rankedCloutOnly) environment.SOCIAL_TEST_OWNED');
  const end = runner.indexOf('\n} catch (error) {', start);
  if (start < 0 || end < 0) throw new Error('Native safety harness changed; review fixture setup before running.');
  const testRunner = `  environment.ANUNAKI_NATIVE_TEST_OWNED = '1';\n  await run(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', '--experimental-test-isolation=none', 'src/lib/anunakiNativeConcurrency.test.ts', 'src/lib/anunakiRaid.native.test.ts', 'src/lib/anunakiEvent.test.ts', 'src/lib/anunakiEventEnabled.test.ts', 'src/lib/anunakiStory.native.test.ts', 'src/lib/anunakiBannerEnabled.test.ts', 'src/lib/anunakiDeckCompatibility.test.ts', 'src/lib/anunakiSocialKumiteCompatibility.test.ts', 'src/lib/cosmetics.test.ts'], 'Native Anunaki tests', true, join(root, 'artifacts/api-server'));\n`;
  writeFileSync(join(copy, nativeRunner), runner.slice(0, start) + testRunner + runner.slice(end));
  await runNativeHarness(process.execPath, [nativeRunner], copy, { ...process.env, PATH: `/usr/lib/postgresql/17/bin:${process.env.PATH ?? ''}` });
  run(process.execPath, ['--import', '../../scripts/battle-test-css.mjs', '--import', 'tsx', '--test', '--test-concurrency=1', '--experimental-test-isolation=none', 'src/anunakiCosmetics.test.ts', 'src/characterSignatures.test.ts', 'src/cosmeticAssets.test.ts'], join(copy, 'artifacts/squabblemon'));
} finally {
  rmSync(copy, { recursive: true, force: true });
}
