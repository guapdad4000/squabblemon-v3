import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderBalanceLabMarkdown,
  runBalanceLab,
  type BalanceLabMode,
} from '@workspace/squabblemon-engine/balanceLab';

type Arguments = {
  mode: BalanceLabMode;
  outputDirectory: string;
};

function parseArguments(argv: readonly string[]): Arguments {
  const wantsFull = argv.includes('--full');
  const wantsSmoke = argv.includes('--smoke');
  if (wantsFull && wantsSmoke) throw new Error('Choose either --smoke or --full');
  const outputIndex = argv.indexOf('--out-dir');
  if (outputIndex >= 0 && !argv[outputIndex + 1]) throw new Error('--out-dir requires a path');
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  return {
    mode: wantsFull ? 'full' : 'smoke',
    outputDirectory: outputIndex >= 0
      ? path.resolve(process.cwd(), argv[outputIndex + 1])
      : path.join(repositoryRoot, 'tmp/balance-lab'),
  };
}

export function balanceLabExitCode(report: { readonly flags: readonly { readonly severity: string }[] }): 0 | 2 {
  return report.flags.some((flag) => flag.severity === 'blocker') ? 2 : 0;
}

export async function runBalanceLabCli(argv: readonly string[] = process.argv.slice(2)): Promise<{
  jsonPath: string;
  markdownPath: string;
  blockerCount: number;
  exitCode: 0 | 2;
}> {
  const { mode, outputDirectory } = parseArguments(argv);
  let lastProgress = -1;
  const report = runBalanceLab(mode, (completed, total) => {
    const progress = Math.floor(completed / total * 10);
    if (progress !== lastProgress) {
      lastProgress = progress;
      process.stderr.write(`Balance matrix ${completed.toLocaleString('en-US')}/${total.toLocaleString('en-US')}\n`);
    }
  });
  const markdown = renderBalanceLabMarkdown(report);
  const jsonPath = path.join(outputDirectory, `${mode}.json`);
  const markdownPath = path.join(outputDirectory, `${mode}.md`);
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
    writeFile(markdownPath, markdown, 'utf8'),
  ]);
  const blockerCount = report.flags.filter((flag) => flag.severity === 'blocker').length;
  const exitCode = balanceLabExitCode(report);
  process.stdout.write(`${markdown}\nMachine report: ${jsonPath}\nHuman report: ${markdownPath}\n`);
  if (exitCode) process.stderr.write(`Balance gate failed with ${blockerCount} blocker flag${blockerCount === 1 ? '' : 's'}; reports were written.\n`);
  return { jsonPath, markdownPath, blockerCount, exitCode };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  runBalanceLabCli()
    .then(({ exitCode }) => { process.exitCode = exitCode; })
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
