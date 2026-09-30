import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customFetch, type PublicPatch, type AdminPatch, type PatchInput, type PatchPreview } from '@workspace/api-client-react';
import { bulletinBoard, BULLETIN_SEEN_STORAGE_KEY } from '../content/bulletinBoard';

export function bulletinIdentity(patches: PublicPatch[]) {
  const latest = patches[0];
  return `${bulletinBoard.edition}|${latest ? `${latest.version}:${latest.publishedAt}` : 'no-patch'}`;
}
export function hasUnreadPatchBoard(patches: PublicPatch[] | undefined) {
  if (!patches) return true; // A failed or pending query cannot be acknowledged.
  try { return localStorage.getItem(BULLETIN_SEEN_STORAGE_KEY) !== bulletinIdentity(patches); }
  catch { return true; }
}
export function markPatchBoardRead(patches: PublicPatch[]) {
  try { localStorage.setItem(BULLETIN_SEEN_STORAGE_KEY, bulletinIdentity(patches)); }
  catch { /* Storage is optional. */ }
}

const playerKey = (playerId: string) => ['published-patches', playerId] as const;
const adminKey = ['admin-patches'] as const;
const assertList = <T,>(result: T[]) => {
  if (!Array.isArray(result)) throw new Error('Patch notes are unavailable.');
  return result;
};

export function usePublishedPatches(playerId: string) {
  return useQuery({
    queryKey: playerKey(playerId), enabled: !!playerId,
    queryFn: async ({ signal }) => assertList(await customFetch<PublicPatch[]>('/api/events/patches', { signal }))
      .slice().sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)),
    retry: 1, refetchOnWindowFocus: true, staleTime: 30_000,
  });
}
export function useAdminPatches() {
  return useQuery({
    queryKey: adminKey,
    queryFn: async ({ signal }) => assertList(await customFetch<AdminPatch[]>('/api/admin/patches', { signal })),
    retry: false, refetchOnWindowFocus: true, refetchInterval: 12_000,
  });
}
export function usePatchPreview(id: string | null, enabled: boolean, updatedAt?: string) {
  return useQuery({
    queryKey: ['admin-patch-preview', id, updatedAt],
    enabled: !!id && enabled,
    queryFn: async ({ signal }) => {
      const result = await customFetch<PatchPreview>(`/api/admin/patches/${encodeURIComponent(id!)}/preview`, { signal });
      if (!result || !result.letter || !result.patch || !Number.isFinite(result.audienceCount)) throw new Error('Preview unavailable.');
      return result;
    },
    retry: false,
  });
}
export function usePatchActions() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: adminKey });
  const save = useMutation({
    mutationFn: ({ id, input }: { id?: string; input: PatchInput }) => customFetch<AdminPatch>(
      id ? `/api/admin/patches/${encodeURIComponent(id)}` : '/api/admin/patches',
      { method: id ? 'PUT' : 'POST', body: JSON.stringify(input), headers: { 'Content-Type': 'application/json' } },
    ),
    onSuccess: patch => {
      client.setQueryData<AdminPatch[]>(adminKey, old => old ? [patch, ...old.filter(item => item.id !== patch.id)] : [patch]);
      client.removeQueries({ queryKey: ['admin-patch-preview', patch.id] });
      void refresh();
    },
  });
  const publish = useMutation({
    mutationFn: ({ id, updatedAt }: { id: string; updatedAt: string }) => customFetch<AdminPatch>(
      `/api/admin/patches/${encodeURIComponent(id)}/publish`,
      { method: 'POST', body: JSON.stringify({ confirmVersion: updatedAt }), headers: { 'Content-Type': 'application/json' } },
    ),
    onSuccess: patch => {
      client.setQueryData<AdminPatch[]>(adminKey, old => old?.map(item => item.id === patch.id ? patch : item));
      void refresh(); void client.invalidateQueries({ queryKey: ['published-patches'] });
    },
  });
  const deliver = useMutation({
    mutationFn: (id: string) => customFetch<unknown>(`/api/admin/patches/${encodeURIComponent(id)}/deliver`, { method: 'POST' }),
    onSuccess: () => { void refresh(); void client.invalidateQueries({ queryKey: ['published-patches'] }); },
  });
  return { save, publish, deliver };
}