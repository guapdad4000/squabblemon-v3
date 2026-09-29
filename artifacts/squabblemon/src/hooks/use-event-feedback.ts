import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useCallback } from 'react';
import { listEventFeedback, type EventFeedbackPage, type EventFeedbackPost, type EventFeedbackReceipt } from '@workspace/api-client-react';

export const FEEDBACK_PAGE_SIZE = 20;
const CATEGORIES = new Set(['bug', 'suggestion', 'general']);

export class MalformedFeedbackResponse extends Error {
  constructor() { super('The feedback board sent back something unexpected.'); }
}

export function isFeedbackPost(value: unknown): value is EventFeedbackPost {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return typeof p.id === 'string' && p.id.length > 0
    && typeof p.displayName === 'string'
    && typeof p.category === 'string' && CATEGORIES.has(p.category)
    && typeof p.message === 'string'
    && typeof p.createdAt === 'string' && !Number.isNaN(Date.parse(p.createdAt));
}

export function assertFeedbackPage(value: unknown): EventFeedbackPage {
  if (!value || typeof value !== 'object') throw new MalformedFeedbackResponse();
  const page = value as Record<string, unknown>;
  if (!Array.isArray(page.posts) || !page.posts.every(isFeedbackPost)) throw new MalformedFeedbackResponse();
  if (!(page.nextCursor === null || typeof page.nextCursor === 'string')) throw new MalformedFeedbackResponse();
  return { posts: page.posts, nextCursor: page.nextCursor };
}

export function isValidReceipt(value: unknown): value is EventFeedbackReceipt {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return isFeedbackPost(r.post) && r.receiptId === r.post.id && typeof r.replayed === 'boolean';
}

/** Cache key is scoped by player so a different session never sees stale state. The id is never sent. */
export const eventFeedbackKey = (playerId: string) => ['/api/events/feedback', 'infinite', playerId] as const;

export function useEventFeedbackFeed(playerId: string) {
  return useInfiniteQuery({
    queryKey: eventFeedbackKey(playerId),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => assertFeedbackPage(
      await listEventFeedback({ limit: FEEDBACK_PAGE_SIZE, ...(pageParam ? { cursor: pageParam } : {}) }, { signal }),
    ),
    getNextPageParam: last => last.nextCursor ?? undefined,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    retry: 1,
  });
}

export function dedupePosts(data: InfiniteData<EventFeedbackPage> | undefined) {
  const seen = new Set<string>();
  const out: EventFeedbackPost[] = [];
  for (const page of data?.pages ?? []) for (const post of page.posts) {
    if (seen.has(post.id)) continue;
    seen.add(post.id); out.push(post);
  }
  return out;
}

export function useAddSavedFeedback(playerId: string) {
  const client = useQueryClient();
  return useCallback((post: EventFeedbackPost) => {
    client.setQueryData<InfiniteData<EventFeedbackPage, string | undefined>>(eventFeedbackKey(playerId), old => {
      if (!old || old.pages.length === 0) return { pages: [{ posts: [post], nextCursor: null }], pageParams: [undefined] };
      if (old.pages.some(page => page.posts.some(p => p.id === post.id))) return old;
      const [first, ...rest] = old.pages;
      return { ...old, pages: [{ ...first, posts: [post, ...first.posts] }, ...rest] };
    });
  }, [client, playerId]);
}
