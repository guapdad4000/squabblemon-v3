import { useEffect, useRef, useState } from "react";
import { ApiError, customFetch, getGetPlayerBootstrapQueryKey } from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  OnlineCommand,
  OnlineRoomView,
} from "@workspace/squabblemon-engine/multiplayer";

export type RoomSummary = {
  code: string;
  status: OnlineRoomView["status"];
  rival: string;
  gameNumber: number;
  /** Stored server timestamps, in epoch milliseconds. */
  expiresAt: number;
  lastActivityAt: number;
  /** Null for unplayed rooms and legacy rooms without a gameplay timestamp. */
  lastPlayedAt: number | null;
  /** Seat-relative series record for the games played in this room. */
  series: { you: number; rival: number; draws: number };
};
// Database connection acquisition can take up to 10s on a cold server. Give a
// write enough time to return its acknowledgement, without leaving polls hung.
export const ONLINE_READ_TIMEOUT_MS = 12_000;
export const ONLINE_WRITE_TIMEOUT_MS = 15_000;
const ONLINE_FRESH_MS = 10_000;

export function isTransientOnlineError(error: unknown): boolean {
  if (error instanceof ApiError) return error.status >= 500;
  return error instanceof TypeError ||
    (error instanceof Error && error.name === "TimeoutError");
}

export function isOnlineConnectionFresh({ online, hasData, dataUpdatedAt, now, error }: {
  online: boolean;
  hasData: boolean;
  dataUpdatedAt: number;
  now: number;
  error?: unknown;
}): boolean {
  // One missed poll must not block play on an otherwise current board. Auth,
  // access and missing-room errors still invalidate the connection immediately.
  return online && hasData && (!error || isTransientOnlineError(error)) &&
    now - dataUpdatedAt < ONLINE_FRESH_MS;
}

type ConfirmedOnlineRead = { scope: string; generation: number; revision: number };
export function isOnlineSnapshotSynchronized(read: ConfirmedOnlineRead | null, scope: string, generation: number, revision?: number): boolean {
  return !!read && read.scope === scope && read.generation === generation && revision !== undefined && revision >= read.revision;
}

export function friendMatchPollInterval(status: OnlineRoomView["status"] | undefined, error: unknown): number | false {
  if (error instanceof ApiError && [400, 401, 403, 404].includes(error.status)) return false;
  if (status === "closed") return false;
  // Do not slow active turns, waiting-room pairing, or rematch recovery.
  return status === "active" ? 800 : 2000;
}

// A stalled mobile request must release the poll/mutation so reconnection can recover.
export const request = async <T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> => {
  signal?.throwIfAborted();
  const hasBody = body !== undefined;
  const controller = new AbortController();
  const cancel = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(
    () =>
      controller.abort(
        new DOMException(
          "Fade connection timed out. Reconnecting…",
          "TimeoutError",
        ),
      ),
    hasBody ? ONLINE_WRITE_TIMEOUT_MS : ONLINE_READ_TIMEOUT_MS,
  );
  try {
    return await customFetch<T>(`/api/multiplayer${path}`, {
      method: hasBody ? "POST" : "GET",
      body: hasBody ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
      responseType: "json",
      signal: controller.signal,
    });
  } catch (error) {
    // Some fetch runtimes throw AbortError even when the controller timed out.
    // Keep the timeout/caller distinction so only safe timeouts are retried.
    if (controller.signal.aborted) throw controller.signal.reason;
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
};
/** A new client accepts full responses from old APIs. An unchanged response
 * can only reuse the exact account-scoped snapshot whose token was submitted. */
export async function readFriendMatch(code: string, cached?: OnlineRoomView, signal?: AbortSignal): Promise<OnlineRoomView> {
  const token = cached?.syncToken;
  const response = await request<OnlineRoomView | { unchanged: true; syncToken: string; serverTime: number }>(
    `/${code}${token ? `?since=${encodeURIComponent(token)}` : ''}`, undefined, signal);
  return 'unchanged' in response
    ? cached && cached.syncToken === response.syncToken
      ? { ...cached, serverTime: response.serverTime }
      : request<OnlineRoomView>(`/${code}`, undefined, signal)
    : response;
}

export const createFriendMatch = (deckId: string, requestId: string) =>
  request<OnlineRoomView>("", { deckId, requestId });
export const joinFriendMatch = (code: string, deckId: string) =>
  request<OnlineRoomView>(`/${code}/join`, { deckId });
export const listFriendMatches = () => request<{ rooms: RoomSummary[]; serverNow: number }>("");
export function onlineErrorMessage(error: unknown) {
  if (
    error instanceof ApiError &&
    error.data &&
    typeof error.data === "object" &&
    "error" in error.data
  )
    return String(error.data.error);
  return error instanceof Error
    ? error.message
    : "Connection interrupted. Please retry.";
}
export function useFriendMatch(accountId: string, code?: string) {
  const client = useQueryClient();
  const key = ["friend-match", accountId, code];
  const scope = JSON.stringify([accountId, code]);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const [connectivity, setConnectivity] = useState(() => ({
    online: navigator.onLine, visible: !document.hidden,
  }));
  const { online, visible } = connectivity;
  const readGeneration = useRef(0);
  const confirmedRead = useRef<ConfirmedOnlineRead | null>(null);
  const [now, setNow] = useState(Date.now);
  const newer = (incoming: OnlineRoomView): OnlineRoomView => {
    const current = client.getQueryData<OnlineRoomView>(key);
    return current && current.revision > incoming.revision ? current : incoming;
  };
  const query = useQuery({
    queryKey: key,
    enabled: !!code && online && visible,
    queryFn: async ({ signal }) => {
      const generation = readGeneration.current;
      const incoming = await readFriendMatch(code!, client.getQueryData<OnlineRoomView>(key), signal);
      // Cache timestamps also change on mutation acknowledgements. Only a GET
      // started in this foreground generation can unlock resumed turn controls.
      if (scope === currentScope.current && generation === readGeneration.current && !document.hidden && navigator.onLine)
        confirmedRead.current = { scope, generation, revision: incoming.revision };
      return newer(incoming);
    },
    retry: (attempt, error) => isTransientOnlineError(error) && attempt < 1,
    retryDelay: 250,
    refetchInterval: (state) => friendMatchPollInterval(state.state.data?.status, state.state.error),
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchIntervalInBackground: false,
  });
  const mutation = useMutation({
    mutationFn: (input: {
      requestId: string;
      expectedRevision: number;
      command: OnlineCommand;
    }) => request<OnlineRoomView>(`/${code}/actions`, input),
    // Retry the identical request ID if an acknowledgement is lost; never double-play.
    networkMode: "always",
    retry: (count, error) => isTransientOnlineError(error) && count < 1,
    retryDelay: 250,
    onSuccess: (data) => {
      client.setQueryData(key, newer(data));
    },
    onError: () => {
      // A failed write may still have committed. Reconcile now if visible,
      // otherwise on return, without restarting hidden polling.
      void client.invalidateQueries({ queryKey: key });
    },
  });
  useEffect(() => {
    const recover = () => {
      const generation = ++readGeneration.current;
      setNow(Date.now());
      // Stay disabled until cancellation settles. Otherwise an old request's
      // cancellation handler can overwrite the next request's fetch state.
      setConnectivity({ online: navigator.onLine, visible: false });
      void (async () => {
        // Supersede only reads, never an in-flight move. Do not roll back a newer
        // acknowledged mutation to the snapshot from when an old GET began.
        await client.cancelQueries({
          queryKey: ["friend-match", accountId, code], exact: true,
        }, { revert: false });
        if (scope !== currentScope.current || generation !== readGeneration.current) return;
        const online = navigator.onLine, visible = !document.hidden;
        setConnectivity({ online, visible });
        if (online && visible && code)
          void client.invalidateQueries({
            queryKey: ["friend-match", accountId, code],
          }, { cancelRefetch: false });
      })();
    };
    window.addEventListener("online", recover);
    window.addEventListener("offline", recover);
    window.addEventListener("pageshow", recover);
    document.addEventListener("visibilitychange", recover);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      readGeneration.current++;
      clearInterval(tick);
      window.removeEventListener("online", recover);
      window.removeEventListener("offline", recover);
      window.removeEventListener("pageshow", recover);
      document.removeEventListener("visibilitychange", recover);
    };
  }, [accountId, code, client]);
  const settledReceipt = useRef('');
  useEffect(() => {
    const room = query.data;
    if (room?.status !== 'complete') return;
    const receipt = `${accountId}:${room.code}:${room.gameNumber}`;
    if (settledReceipt.current === receipt) return;
    settledReceipt.current = receipt;
    void client.invalidateQueries({ queryKey: ['social-records'] });
    void client.invalidateQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
    void client.invalidateQueries({ queryKey: ['park-standings', accountId] });
    void client.invalidateQueries({ queryKey: ['fade-park', accountId] });
  }, [query.data?.status, query.data?.gameNumber, query.data?.ranked?.result, accountId, code, client]);
  return {
    connected: isOnlineSnapshotSynchronized(confirmedRead.current, scope, readGeneration.current, query.data?.revision) && isOnlineConnectionFresh({
      online: online && visible, hasData: !!query.data, dataUpdatedAt: query.dataUpdatedAt, now,
      error: query.error,
    }),
    query,
    mutation,
    accept: (view: OnlineRoomView) =>
      client.setQueryData(["friend-match", accountId, view.code], view),
  };
}

export type RankedLobby = {
  stats: import('@workspace/squabblemon-engine/multiplayer').RankedStats;
  progress: ReturnType<typeof import('@workspace/squabblemon-engine/multiplayer').rankProgress>;
  room: OnlineRoomView | null;
};
export const getRankedLobby = (signal?: AbortSignal) => request<RankedLobby>('/ranked', undefined, signal);
export async function searchRanked(deckId: string, requestId: string): Promise<RankedLobby> {
  const input = { deckId, requestId };
  try {
    return await request<RankedLobby>("/ranked/search", input);
  } catch (error) {
    if (!isTransientOnlineError(error)) throw error;
    // The server deduplicates this search ID, including when the first attempt
    // matched successfully but its response was lost. Never mint a new ID here.
    return request<RankedLobby>("/ranked/search", input);
  }
}
export const cancelRanked = (code: string) => request<OnlineRoomView>('/ranked/cancel', { code });
