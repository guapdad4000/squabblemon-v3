import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import {
  ApiError, blockSocialPlayer, getFadeInvitation, getSocialState, lookupSocialPlayer,
  removeHomie, respondFadeInvitation, respondHomieRequest, sendFadeInvitation,
  sendHomieRequest, unblockSocialPlayer, searchSocialPlayers, updateSocialUsername, getSocialMatchOpponent,
  type SocialInvitation, type SocialLookup, type SocialState, type SocialSearchResult, type SocialMatchOpponent,
} from '@workspace/api-client-react';
import { useAppAuth } from './auth';
import { isBattleActive, subscribeBattleActive } from './imageWarmup';

type RequestAction = 'accept' | 'decline' | 'cancel';
type SocialContextValue = {
  query: UseQueryResult<SocialState, Error>;
  pendingCount: number;
  connected: boolean;
  busy: boolean;
  paused: boolean;
  lookup: (code: string, signal?: AbortSignal) => Promise<SocialLookup>;
  search: (query: string, signal?: AbortSignal) => Promise<SocialSearchResult>;
  updateUsername: (username: string) => Promise<SocialState>;
  matchOpponent: (code: string, signal?: AbortSignal) => Promise<SocialMatchOpponent>;
  sendRequest: (code: string) => Promise<SocialState>;
  respondRequest: (id: string, action: RequestAction) => Promise<SocialState>;
  remove: (code: string) => Promise<SocialState>;
  block: (code: string) => Promise<SocialState>;
  unblock: (code: string) => Promise<SocialState>;
  invite: (friendCode: string, deckId: string, requestId: string) => Promise<SocialInvitation>;
  respondInvitation: (id: string, action: RequestAction, deckId?: string) => Promise<SocialInvitation>;
  getInvitation: (id: string, signal?: AbortSignal) => Promise<SocialInvitation>;
};
const SocialContext = createContext<SocialContextValue | null>(null);
export const socialQueryKey = (accountId: string) => ['social', accountId] as const;

function useMenuConnectivity() {
  const [state, setState] = useState(() => ({ visible: !document.hidden, online: navigator.onLine }));
  useEffect(() => {
    const update = () => setState({ visible: !document.hidden, online: navigator.onLine });
    document.addEventListener('visibilitychange', update);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    window.addEventListener('pageshow', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
      window.removeEventListener('pageshow', update);
    };
  }, []);
  return state;
}

/** All calls have a deadline, including a lost mobile mutation acknowledgement. */
async function socialRequest<T>(run: (options: RequestInit) => Promise<T>, parent?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort(parent?.reason);
  if (parent?.aborted) abort();
  parent?.addEventListener('abort', abort, { once: true });
  const timer = window.setTimeout(() => controller.abort(new DOMException('Homies connection timed out. Please retry.', 'TimeoutError')), 10_000);
  try {
    return await run({ signal: controller.signal, credentials: 'same-origin', cache: 'no-store' });
  } finally {
    window.clearTimeout(timer);
    parent?.removeEventListener('abort', abort);
  }
}

async function loadSocialState(options: RequestInit) {
  const data = await getSocialState(options);
  if (!data || typeof data !== 'object' || !data.self || !data.counts ||
    !Array.isArray(data.homies) || !Array.isArray(data.incomingRequests) ||
    !Array.isArray(data.outgoingRequests) || !Array.isArray(data.blocked) || !Array.isArray(data.invitations)) {
    throw new Error('Homies could not be loaded. Please retry the connection.');
  }
  return data;
}

export function SocialProvider({ accountId, enabled = true, children }: { accountId: string; enabled?: boolean; children: ReactNode }) {
  const auth = useAppAuth();
  const client = useQueryClient();
  const { visible, online } = useMenuConnectivity();
  const battleActive = useSyncExternalStore(subscribeBattleActive, isBattleActive, () => false);
  const active = enabled && auth.isLoaded && auth.isSignedIn && visible && online && !battleActive;
  const key = useMemo(() => socialQueryKey(accountId), [accountId]);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef<{ key: string; result: Promise<unknown> } | null>(null);
  const lifetime = useRef(new AbortController());
  const query = useQuery<SocialState, Error>({
    queryKey: key,
    queryFn: ({ signal }) => socialRequest(loadSocialState, signal),
    enabled: active && !busy,
    staleTime: 5_000,
    refetchInterval: active && !busy ? 10_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
    retry: (attempt, error) => !(error instanceof ApiError && error.status < 500) && attempt < 1,
  });
  useEffect(() => {
    if (!active) void client.cancelQueries({ queryKey: key });
    else void client.invalidateQueries({ queryKey: key });
  }, [active, client, key]);
  // Child confirmation effects may start a lookup immediately after mount.
  // Renew the lifetime before those passive effects, including StrictMode's replay.
  useLayoutEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => { controller.abort(); };
  }, [accountId]);

  const run = useCallback(<T,>(actionKey: string, action: (signal: AbortSignal) => Promise<T>, stateResponse = false): Promise<T> => {
    if (inFlight.current) {
      if (inFlight.current.key === actionKey) return inFlight.current.result as Promise<T>;
      return Promise.reject(new Error('Your last Homies action is still saving. Please try again in a moment.'));
    }
    if (!online) return Promise.reject(new Error('You are offline. Reconnect and try again.'));
    const signal = lifetime.current.signal;
    setBusy(true);
    const result = (async () => {
      await client.cancelQueries({ queryKey: key });
      const value = await action(signal);
      if (!signal.aborted) {
        if (stateResponse) client.setQueryData(key, value as SocialState);
        else await client.invalidateQueries({ queryKey: key });
        await client.invalidateQueries({ queryKey: ['friend-rooms', accountId] });
      }
      return value;
    })().catch(error => {
      // A failed acknowledgement may still have committed; refetch authoritative truth.
      if (!signal.aborted) void client.invalidateQueries({ queryKey: key });
      throw error;
    }).finally(() => {
      if (!signal.aborted) { inFlight.current = null; setBusy(false); }
    });
    inFlight.current = { key: actionKey, result };
    return result;
  }, [accountId, client, key, online]);

  const actions = useMemo((): Omit<SocialContextValue, 'query' | 'pendingCount' | 'connected' | 'paused' | 'busy'> => ({
    lookup: (code, signal) => socialRequest(options => lookupSocialPlayer(code, options), signal ?? lifetime.current.signal),
    search: (query, signal) => socialRequest(options => searchSocialPlayers({ query }, options), signal ?? lifetime.current.signal),
    updateUsername: username => run(`username:${username}`, signal => socialRequest(options => updateSocialUsername({ username }, options), signal), true),
    matchOpponent: (code, signal) => socialRequest(options => getSocialMatchOpponent(code, options), signal ?? lifetime.current.signal),
    sendRequest: code => run(`request:${code}`, signal => socialRequest(options => sendHomieRequest({ friendCode: code }, options), signal), true),
    respondRequest: (id, action) => run(`request:${id}:${action}`, signal => socialRequest(options => respondHomieRequest(id, { action }, options), signal), true),
    remove: code => run(`remove:${code}`, signal => socialRequest(options => removeHomie(code, options), signal), true),
    block: code => run(`block:${code}`, signal => socialRequest(options => blockSocialPlayer({ friendCode: code }, options), signal), true),
    unblock: code => run(`unblock:${code}`, signal => socialRequest(options => unblockSocialPlayer(code, options), signal), true),
    invite: (friendCode, deckId, requestId) => run(`invite:${requestId}`, signal => socialRequest(options => sendFadeInvitation({ friendCode, deckId, requestId }, options), signal)),
    respondInvitation: (id, action, deckId) => run(`invitation:${id}:${action}`, signal => socialRequest(options => respondFadeInvitation(id, { action, ...(deckId ? { deckId } : {}) }, options), signal)),
    getInvitation: (id, signal) => socialRequest(options => getFadeInvitation(id, options), signal ?? lifetime.current.signal),
  }), [run]);
  const value: SocialContextValue = {
    ...actions,
    query,
    pendingCount: (query.data?.counts.requests ?? 0) + (query.data?.counts.invitations ?? 0),
    connected: online && !query.isError,
    paused: !active,
    busy,
  };
  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial() {
  const value = useContext(SocialContext);
  if (!value) throw new Error('Homies must be rendered within the signed-in SocialProvider.');
  return value;
}

/** Headers also render in isolated existing fixtures without social menus. */
export function useOptionalSocial() {
  return useContext(SocialContext);
}