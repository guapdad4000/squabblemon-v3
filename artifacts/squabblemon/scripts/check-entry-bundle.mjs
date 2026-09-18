import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ENTRY_BUDGET_BYTES = 475 * 1024;

const GAME_MODULE_PATTERNS = [
  /\/src\/pages\/game\//,
  /\/src\/components\/(?:Battle|CardInspector|CardView|Lobby|PlayLoop|ResultScreen|RulesModal|StoryCinematic)\.[jt]sx?$/,
  /\/src\/(?:battleFeedback|data|gameEngine|matchTranscript|presentationTimeline)\.[jt]sx?$/,
  /\/lib\/squabblemon-engine\//,
];

function normalizeModuleId(moduleId) {
  return moduleId.replaceAll('\\', '/').split('?')[0];
}

export function checkEntryBundle(report) {
  const chunksByFile = new Map(
    report.chunks.map((chunk) => [chunk.fileName, chunk]),
  );
  const entryChunks = report.chunks.filter(
    (chunk) =>
      chunk.isEntry &&
      chunk.modules.some((moduleId) =>
        normalizeModuleId(moduleId).endsWith('/src/main.tsx'),
      ),
  );

  if (entryChunks.length !== 1) {
    throw new Error(
      `Expected exactly one public entry chunk for src/main.tsx, found ${entryChunks.length}.`,
    );
  }

  const staticChunks = [];
  const pending = [entryChunks[0]];
  const visited = new Set();

  while (pending.length > 0) {
    const chunk = pending.pop();
    if (visited.has(chunk.fileName)) continue;
    visited.add(chunk.fileName);
    staticChunks.push(chunk);

    for (const importedFile of chunk.imports) {
      const importedChunk = chunksByFile.get(importedFile);
      if (!importedChunk) {
        throw new Error(
          `Entry chunk ${chunk.fileName} imports missing chunk ${importedFile}.`,
        );
      }
      pending.push(importedChunk);
    }
  }

  const entryBytes = staticChunks.reduce((total, chunk) => total + chunk.bytes, 0);
  const eagerGameModules = staticChunks.flatMap((chunk) =>
    chunk.modules
      .map(normalizeModuleId)
      .filter((moduleId) =>
        GAME_MODULE_PATTERNS.some((pattern) => pattern.test(moduleId)),
      ),
  );

  const failures = [];
  if (entryBytes > ENTRY_BUDGET_BYTES) {
    failures.push(
      `public entry is ${(entryBytes / 1024).toFixed(1)} KiB; budget is ${(ENTRY_BUDGET_BYTES / 1024).toFixed(0)} KiB`,
    );
  }
  if (eagerGameModules.length > 0) {
    failures.push(
      `public entry eagerly includes game modules:\n${eagerGameModules
        .map((moduleId) => `  - ${moduleId}`)
        .join('\n')}`,
    );
  }

  if (failures.length > 0) {
    throw new Error(`Entry bundle budget failed: ${failures.join('\n')}`);
  }

  return {
    bytes: entryBytes,
    chunks: staticChunks.map((chunk) => chunk.fileName),
  };
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const reportPath = path.resolve(
    scriptDir,
    '../dist/public/bundle-budget-report.json',
  );
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  await unlink(reportPath);
  const result = checkEntryBundle(report);

  console.log(
    `Public entry bundle: ${(result.bytes / 1024).toFixed(1)} KiB / ${(ENTRY_BUDGET_BYTES / 1024).toFixed(0)} KiB across ${result.chunks.length} static chunk(s).`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}