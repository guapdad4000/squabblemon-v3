import screenplay from './storyChapters/seasonOneRewrite.json';
import type { StoryChapter, StoryDialogueLine, StoryNode } from './story';

type Section = 'pre' | 'post' | 'main';
type Script = Partial<Record<Section, readonly (readonly [string, string])[]>>;
const scripts = screenplay as unknown as Readonly<Record<string, Script>>;
export const hasSeasonOneRewrite = (nodeId: string): boolean => Object.hasOwn(scripts, nodeId);

/** Replace dialogue only. Encounters, scene art, routing, rewards and save identities stay intact. */
export function rewriteSeasonOne(chapters: readonly StoryChapter[]): readonly StoryChapter[] {
  const portraits = new Map<string, string>();
  for (const chapter of chapters) for (const node of chapter.nodes) {
    for (const line of node.kind === 'battle' ? [...node.preDialogue, ...node.postDialogue] : node.scenes) {
      if (!portraits.has(line.speaker)) portraits.set(line.speaker, line.portraitAssetId);
    }
  }
  const lines = (nodeId: string, section: Section): readonly StoryDialogueLine[] => {
    const script = scripts[nodeId]?.[section];
    if (!script?.length) throw new Error(`Season One screenplay is missing ${nodeId}/${section}`);
    return script.map(([speaker, text]) => {
      const portraitAssetId = portraits.get(speaker);
      if (!portraitAssetId) throw new Error(`Season One screenplay has no existing portrait for ${speaker}`);
      return { speaker, portraitAssetId, text };
    });
  };
  return chapters.map(chapter => ({ ...chapter, nodes: chapter.nodes.map((node): StoryNode => node.kind === 'battle'
    ? { ...node, preDialogue: lines(node.id, 'pre'), postDialogue: lines(node.id, 'post') }
    : { ...node, scenes: lines(node.id, 'main') }) }));
}
