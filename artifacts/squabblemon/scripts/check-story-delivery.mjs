import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
export const STORY_INDEX_BUDGET = 80 * 1024;
export const STORY_CHAPTER_BUDGET = 128 * 1024;
export function checkStoryDelivery(report, index) {
  const chunks = new Map(report.chunks.map(chunk => [chunk.fileName, chunk]));
  const normalize = id => id.replaceAll('\\', '/').split('?')[0];
  const canonical = /\/lib\/squabblemon-engine\/src\/(?:story|chapterOneDialogue|seasonChapters|seasonTwo|seasonOneRewrite|seasonTwoDialogueExpansion|storyExpansions|storySpecials|storySquabbleHouse|storyKumite|storyAnunaki)(?:\.|\/)/;
  const chapter = /\/src\/lib\/story\/generated\/(?!index\.json$)[^/]+\.json$/;
  const closure = start => {
    const seen = new Set();
    const visit = chunk => {
      if (seen.has(chunk.fileName)) return;
      seen.add(chunk.fileName);
      for (const file of chunk.imports) {
        if (!chunks.has(file)) throw new Error(`Missing Story dependency ${file}`);
        visit(chunks.get(file));
      }
    };
    visit(start);
    return [...seen].map(file => chunks.get(file));
  };
  const routes = report.chunks.filter(chunk => chunk.modules.some(id => normalize(id).endsWith('/src/pages/game/Story.tsx')));
  if (routes.length !== 1) throw new Error(`Expected one Story route, found ${routes.length}`);
  const routeClosure = closure(routes[0]);
  for (const chunk of routeClosure) for (const original of chunk.modules) {
    const id = normalize(original);
    if (canonical.test(id) || (chapter.test(id) && !/[?&]url(?:&|$)/.test(original))) throw new Error(`Story route eagerly includes campaign content: ${id}`);
  }
  const indexChunks = report.chunks.filter(chunk => chunk.modules.some(id => normalize(id).endsWith('/src/lib/story/generated/index.json')));
  if (indexChunks.length !== 1) throw new Error('Story index must be delivered once');
  // Rollup may share the tiny index with presentation helpers; enforce a ceiling on that entire chunk.
  if (indexChunks[0].bytes > STORY_INDEX_BUDGET) throw new Error(`Story index chunk exceeds ${STORY_INDEX_BUDGET} bytes: ${indexChunks[0].bytes}`);
  const assets = report.storyAssets ?? [];
  if (!assets.length) throw new Error('No external Story chapter assets emitted');
  if (new Set(assets.map(asset => asset.chapterId)).size !== assets.length) throw new Error('Story chapter emitted more than once');
  for (const asset of assets) {
    if (asset.bytes > STORY_CHAPTER_BUDGET) throw new Error(`Chapter exceeds ${STORY_CHAPTER_BUDGET} bytes: ${asset.fileName} (${asset.bytes})`);
    if (index) {
      const metadata = index.chapters.find(chapter => chapter.id === asset.chapterId);
      if (!metadata || metadata.revision !== asset.chapterRevision || asset.revision !== index.revision)
        throw new Error(`Stale or unexpected emitted Story chapter: ${asset.fileName}`);
    }
  }
  if (index && assets.length !== index.chapters.length) throw new Error(`Expected ${index.chapters.length} chapters, got ${assets.length}`);
  return { routeStaticBytes: routeClosure.reduce((sum, chunk) => sum + chunk.bytes, 0), indexBytes: indexChunks[0].bytes, chapterCount: assets.length, largestChapterBytes: Math.max(...assets.map(asset => asset.bytes)) };

}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = JSON.parse(await readFile(new URL('../dist/public/bundle-budget-report.json', import.meta.url), 'utf8'));
  const index = JSON.parse(await readFile(new URL('../src/lib/story/generated/index.json', import.meta.url), 'utf8'));
  report.storyAssets = [];
  const assetDirectory = new URL('../dist/public/assets/', import.meta.url);
  for (const fileName of await readdir(assetDirectory)) {
    if (!fileName.endsWith('.json')) continue;
    const body = await readFile(new URL(fileName, assetDirectory), 'utf8');
    const artifact = JSON.parse(body);
    if (!artifact.chapter?.id) continue;
    // Serialized public payload must still exactly match its canonical generated input.
    const source = JSON.parse(await readFile(new URL(`../src/lib/story/generated/${artifact.chapter.id}.json`, import.meta.url), 'utf8'));
    if (JSON.stringify(source) !== JSON.stringify(artifact)) throw new Error(`Emitted Story chapter differs from canonical artifact: ${fileName}`);
    report.storyAssets.push({ fileName, bytes: Buffer.byteLength(body), chapterId: artifact.chapter.id, revision: artifact.revision, chapterRevision: artifact.chapterRevision });
  }
  console.log('Story delivery check passed:', checkStoryDelivery(report, index));
}
