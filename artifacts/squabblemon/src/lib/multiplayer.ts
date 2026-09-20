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
};
// A stalled mobile request must release the poll/mutation so reconnection can recover.
export const request = async <T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> => {
  const controller = new AbortController();
  const cancel = () => controller.abort(signal?.reason);
  if (signal?.aborted) cancel();
  signal?.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(
    () =>
      controller.abort(
        new DOMException(
          "Fade connection timed out. Reconnecting…",
          "TimeoutError",
        ),
      ),
    8000,
  );
  try {
    return await customFetch<T>(`/api/multiplayer${path}`, {
      method: body ? "POST" : "GET",
      body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
      responseType: "json",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
};
export const createFriendMatch = (deckId: string, requestId: string) =>
  request<OnlineRoomView>("", { deckId, requestId });
export const joinFriendMatch = (code: string, deckId: string) =>
  request<OnlineRoomView>(`/${code}/join`, { deckId });
export const listFriendMatches = () => request<{ rooms: RoomSummary[] }>("");
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
    retry: (attempt, error) =>
      !(
        error instanceof ApiError && [400, 401, 403, 404].includes(error.status)
      ) && attempt < 1,
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
    retry: (count, error) =>
      (!(error instanceof ApiError) || error.status >= 500) && count < 1,
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
    connected:
      online &&
      !query.isError &&
      !!query.data &&
      now - query.dataUpdatedAt < 10000,
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
export const searchRanked = (deckId: string, requestId: string) => request<RankedLobby>('/ranked/search', { deckId, requestId });
export const cancelRanked = (code: string) => request<OnlineRoomView>('/ranked/cancel', { code });
