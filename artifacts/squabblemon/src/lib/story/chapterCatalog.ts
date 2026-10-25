import type { StoryChapter, StoryNode } from '@workspace/squabblemon-engine/story';
export type ChapterArtifact = { revision: string; chapterRevision: string; chapter: StoryChapter };
export type ChapterIndex = { revision: string; chapters: readonly { id: string; revision: string; nodes: readonly { id: string }[] }[] };
export function freezeStoryData<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freezeStoryData(child);
  }
  return value;
}
/** Authoring data only; player progress never enters this shared immutable cache. */
export function createChapterCatalog(index: ChapterIndex, importer: (id: string) => Promise<ChapterArtifact>) {
  const loaded = new Map<string, StoryChapter>();
  const pending = new Map<string, Promise<StoryChapter>>();
  const nodeChapter = new Map(index.chapters.flatMap(chapter => chapter.nodes.map(node => [node.id, chapter.id] as const)));
  const getStoryChapter = (id: string) => loaded.get(id);
  const getStoryNode = (id: string): StoryNode | undefined => loaded.get(nodeChapter.get(id) ?? '')?.nodes.find(node => node.id === id);
  function loadStoryChapter(id: string): Promise<StoryChapter> {
    const cached = loaded.get(id);
    if (cached) return Promise.resolve(cached);
    const request = pending.get(id);
    if (request) return request;
    const metadata = index.chapters.find(chapter => chapter.id === id);
    if (!metadata) return Promise.reject(new Error(`Unknown Story chapter: ${id}`));
    const promise = Promise.resolve().then(() => importer(id)).then(artifact => {
      if (artifact.revision !== index.revision || artifact.chapterRevision !== metadata.revision || artifact.chapter.id !== id)
        throw new Error('Story content changed. Reload to get the current chapter.');
      freezeStoryData(artifact.chapter);
      loaded.set(id, artifact.chapter);
      return artifact.chapter;
    }).finally(() => pending.delete(id));
    pending.set(id, promise);
    return promise;
  }
  const loadStoryChapterForNode = (nodeId: string): Promise<StoryChapter> => {
    const chapterId = nodeChapter.get(nodeId);
    return chapterId ? loadStoryChapter(chapterId) : Promise.reject(new Error(`Unknown Story node: ${nodeId}`));
  };
  return { getStoryChapter, getStoryNode, loadStoryChapter, loadStoryChapterForNode };
}
