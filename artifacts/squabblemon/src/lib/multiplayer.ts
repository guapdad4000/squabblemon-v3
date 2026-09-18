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
const request = <T>(path: string, body?: unknown, signal?: AbortSignal) =>
  customFetch<T>(`/api/multiplayer${path}`, {
    method: body ? "POST" : "GET",
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
    responseType: "json",
    signal,
  });
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
export function useFriendMatch(code?: string) {
  const client = useQueryClient();
  const key = ["friend-match", code];
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
    refetchInterval: (state) =>
      state.state.data?.status === "active"
        ? 1200
        : state.state.data
          ? 2500
          : false,
    refetchOnWindowFocus: true,
  });
  const mutation = useMutation({
    mutationFn: (input: {
      requestId: string;
      expectedRevision: number;
      command: OnlineCommand;
    }) => request<OnlineRoomView>(`/${code}/actions`, input),
    retry: (count, error) => !(error instanceof ApiError) && count < 1,
    onSuccess: (data) => {
      client.setQueryData(key, newer(data));
    },
    onError: () => {
      void query.refetch();
    },
  });
  return {
    query,
    mutation,
    accept: (view: OnlineRoomView) =>
      client.setQueryData(["friend-match", view.code], view),
  };
}
