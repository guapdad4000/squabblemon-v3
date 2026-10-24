import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { storyContent } from '../../../lib/squabblemon-engine/src/story';

type MusicChapter = {
  order: number;
  nodes: readonly { id: string; kind: string; battleType?: string }[];
};

/** Only the soundtrack's two routing facts belong in the always-available player.
 * Keep the first node/chapter match, exactly like getStoryBattle and chapters.find.
 * Zero means an ordinary battle/odd chapter, so those entries can be omitted. */
export function buildStoryMusicRoutes(chapters: readonly MusicChapter[]) {
  const seen = new Set<string>();
  const routes: Record<string, number> = Object.create(null);
  for (const chapter of chapters) {
    for (const node of chapter.nodes) {
      if (seen.has(node.id)) continue;
      seen.add(node.id);
      const boss = node.kind === 'battle' && (node.battleType === 'boss' || node.battleType === 'mini-boss');
      const evenChapter = Boolean(chapter.order && chapter.order % 2 === 0);
      const flags = (boss ? 1 : 0) | (evenChapter ? 2 : 0);
      if (flags) routes[node.id] = flags;
    }
  }
  return Object.fromEntries(Object.entries(routes).sort(([left], [right]) => left.localeCompare(right, 'en')));
}

const destination = new URL('../src/storyMusicRoutes.json', import.meta.url);
export const serializeStoryMusicRoutes = () => JSON.stringify(buildStoryMusicRoutes(storyContent.chapters), null, 2) + '\n';

async function main() {
  const expected = serializeStoryMusicRoutes();
  if (process.argv.includes('--check')) {
    const actual = await readFile(destination, 'utf8').catch(() => '');
    if (actual !== expected) throw new Error('Story music routes are stale. Run pnpm run generate:story-music.');
    console.log(`Story music route metadata is current (${Buffer.byteLength(expected)} bytes).`);
  } else {
    await writeFile(destination, expected);
    console.log(`Wrote ${fileURLToPath(destination)} (${Buffer.byteLength(expected)} bytes).`);
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
