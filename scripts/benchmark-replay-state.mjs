import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const engine = join(root, 'lib/squabblemon-engine/src/gameEngine.ts');
const directory = mkdtempSync(join(tmpdir(), 'squabble-replay-benchmark-'));
try {
  let source = readFileSync(engine, 'utf8');
  const start = source.indexOf('const replayState =');
  const end = source.indexOf('\nexport type ScoreState', start);
  const original = source.slice(start, end);
  const baseline = original.replace('shareReplaySnapshot({', 'JSON.parse(JSON.stringify({').replace('} as ReplayState, previous);', '})) as ReplayState;');
  if (baseline === original || start < 0 || end < 0) throw new Error('Replay baseline transform no longer matches; update the benchmark explicitly.');
  source = (source.slice(0, start) + baseline + source.slice(end)).replace(/from (['"])\.\//g, (_match, quote) => `from ${quote}${dirname(engine)}/`);
  const baselinePath = join(directory, 'baseline.ts');
  writeFileSync(baselinePath, source);
  const runner = join(directory, 'runner.mts');
  writeFileSync(runner, readFileSync(join(root, 'scripts/benchmarks/replay-state.mts')));
  const require = createRequire(join(root, 'artifacts/squabblemon/package.json'));
  const result = spawnSync(process.execPath, ['--expose-gc', '--import', require.resolve('tsx'), runner], {
    cwd: root, env: { ...process.env, REPLAY_ENGINE: engine, REPLAY_BASELINE: baselinePath }, stdio: 'inherit',
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally { rmSync(directory, { recursive: true, force: true }); }
