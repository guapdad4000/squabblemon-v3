import screenplay from './storyChapters/seasonOneRewrite.json';
import type { StoryChapter, StoryDialogueLine, StoryNode } from './story';

type Section = 'pre' | 'post' | 'main';
type Script = Partial<Record<Section, readonly (readonly [string, string])[]>>;
type ScreenplayDocument = {
  readonly revisions: Readonly<Record<string, string>>;
  readonly scenes: Readonly<Record<string, Script>>;
};
const document = screenplay as unknown as ScreenplayDocument;
const scripts = document.scenes;
export const hasSeasonOneRewrite = (nodeId: string): boolean => Object.hasOwn(scripts, nodeId);
export const seasonOneRewriteRevision = (nodeId: string): string | undefined => document.revisions[nodeId];

/** FNV-1a 64 over the stable JSON tuple shape emitted by the screenplay compiler. */
export function seasonOneRevisionForScript(script: Script): string {
  let hash = 14695981039346656037n;
  for (const character of JSON.stringify(script)) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(character.charCodeAt(0))) * 1099511628211n);
  }
  return hash.toString(16).padStart(16, '0');
}

/** New speakers in the rewrite must not be smuggled into base chapters just to acquire portraits. */
export const REWRITE_PORTRAITS: Readonly<Record<string, string>> = Object.freeze({
  Player: 'assets/characters/player.webp',
  Rae: 'assets/characters/rae.webp',
});

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
      const portraitAssetId = REWRITE_PORTRAITS[speaker] ?? portraits.get(speaker);
      if (!portraitAssetId) throw new Error(`Season One screenplay has no existing portrait for ${speaker}`);
      return { speaker, portraitAssetId, text };
    });
  };
  return chapters.map(chapter => ({ ...chapter, nodes: chapter.nodes.map((node): StoryNode => node.kind === 'battle'
    ? { ...node, preDialogue: lines(node.id, 'pre'), postDialogue: lines(node.id, 'post') }
    : { ...node, scenes: lines(node.id, 'main') }) }));
}
