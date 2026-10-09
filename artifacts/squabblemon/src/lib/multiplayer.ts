import { useEffect, useState } from "react";
import { ApiError, customFetch } from "@workspace/api-client-react";
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
  const [online, setOnline] = useState(() => navigator.onLine);
  const [now, setNow] = useState(Date.now);
  const newer = (incoming: OnlineRoomView): OnlineRoomView => {
    const current = client.getQueryData<OnlineRoomView>(key);
    return current && current.revision > incoming.revision ? current : incoming;
  };
  const query = useQuery({
    queryKey: key,
    enabled: !!code,
    queryFn: async ({ signal }) =>
      newer(await request<OnlineRoomView>(`/${code}`, undefined, signal)),
    retry: (attempt, error) => isTransientOnlineError(error) && attempt < 1,
    retryDelay: 250,
    refetchInterval: (state) => {
      const error = state.state.error;
      if (
        error instanceof ApiError &&
        [400, 401, 403, 404].includes(error.status)
      )
        return false;
      if (state.state.data?.status === "closed") return false;
      return state.state.data?.status === "active" ? 800 : 2000;
    },
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    refetchIntervalInBackground: true,
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
      void query.refetch();
    },
  });
  useEffect(() => {
    const recover = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine && code)
        void client.invalidateQueries({
          queryKey: ["friend-match", accountId, code],
        });
    };
    const offline = () => setOnline(false);
    const visible = () => {
      if (!document.hidden) recover();
    };
    window.addEventListener("online", recover);
    window.addEventListener("offline", offline);
    window.addEventListener("pageshow", recover);
    document.addEventListener("visibilitychange", visible);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(tick);
      window.removeEventListener("online", recover);
      window.removeEventListener("offline", offline);
      window.removeEventListener("pageshow", recover);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [accountId, code, client]);
  return {
    connected: isOnlineConnectionFresh({
      online, hasData: !!query.data, dataUpdatedAt: query.dataUpdatedAt, now,
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
