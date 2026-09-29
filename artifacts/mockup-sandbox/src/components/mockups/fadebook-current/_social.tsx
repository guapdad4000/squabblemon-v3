import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type SocialPlayer = { friendCode: string; displayName: string; avatarKey: string };
export type SocialRequest = { id: string; player: SocialPlayer; createdAt: string };
export type SocialInvitation = { id: string; roomCode: string; direction: 'incoming' | 'outgoing'; player: SocialPlayer; status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired' | 'unavailable' | 'closed'; expiresAt: string };
export type SocialState = { self: SocialPlayer; homies: SocialPlayer[]; incomingRequests: SocialRequest[]; outgoingRequests: SocialRequest[]; blocked: SocialPlayer[]; invitations: SocialInvitation[]; counts: { requests: number; invitations: number } };
export type SocialLookup = { player: SocialPlayer; relationship: 'none' | 'incoming' | 'outgoing' | 'homie' | 'blocked' | 'self' };

const me: SocialPlayer = { friendCode: 'A7C19E4B2D08', displayName: 'You', avatarKey: 'cornball' };
const jules: SocialPlayer = { friendCode: '3F28B4C5D6E7', displayName: 'JulesTheGreat', avatarKey: 'ashlee' };
const marcus: SocialPlayer = { friendCode: '0A5B7C9D2E4F', displayName: 'MARCUS', avatarKey: 'guap' };
const devon: SocialPlayer = { friendCode: '91D3E5A7B2C4', displayName: 'Devon', avatarKey: 'shiesty-yn' };
const rio: SocialPlayer = { friendCode: 'E4F6A8B0C2D3', displayName: 'Rio', avatarKey: 'smile-bomb' };
const knownPlayers = [me, jules, marcus, devon, rio];
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const later = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
const initialState: SocialState = {
  self: me,
  homies: [jules, marcus],
  incomingRequests: [{ id: 'request-devon', player: devon, createdAt: ago(27) }],
  outgoingRequests: [{ id: 'request-rio', player: rio, createdAt: ago(92) }],
  blocked: [],
  invitations: [
    { id: 'invite-jules', roomCode: 'FADE42', direction: 'incoming', player: jules, status: 'pending', expiresAt: later(38) },
    { id: 'invite-marcus', roomCode: 'ROOM79', direction: 'outgoing', player: marcus, status: 'pending', expiresAt: later(53) },
  ],
  counts: { requests: 1, invitations: 1 },
};
const withCounts = (state: SocialState): SocialState => ({
  ...state,
  counts: { requests: state.incomingRequests.length, invitations: state.invitations.filter(invitation => invitation.direction === 'incoming' && invitation.status === 'pending').length },
});

function useLocalSocial() {
  const [data, setData] = useState<SocialState>(initialState);
  const [busy] = useState(false);
  return useMemo(() => ({
    query: { data, isPending: false, isError: false, error: null, refetch: async () => ({ data }) },
    connected: true,
    busy,
    lookup: async (code: string): Promise<SocialLookup> => {
      const player = knownPlayers.find(item => item.friendCode === code);
      if (!player) throw new Error('No fighter answers to that code.');
      return { player, relationship: player === data.self ? 'self' : data.blocked.some(item => item.friendCode === code) ? 'blocked'
        : data.homies.some(item => item.friendCode === code) ? 'homie'
        : data.incomingRequests.some(item => item.player.friendCode === code) ? 'incoming'
        : data.outgoingRequests.some(item => item.player.friendCode === code) ? 'outgoing' : 'none' };
    },
    sendRequest: async (code: string) => setData(state => withCounts({ ...state, outgoingRequests: [...state.outgoingRequests, { id: `request-${code}`, player: knownPlayers.find(item => item.friendCode === code)!, createdAt: new Date().toISOString() }] })),
    respondRequest: async (id: string, action: 'accept' | 'decline' | 'cancel') => setData(state => {
      const found = state.incomingRequests.find(item => item.id === id);
      return withCounts({ ...state,
        incomingRequests: state.incomingRequests.filter(item => item.id !== id),
        outgoingRequests: state.outgoingRequests.filter(item => item.id !== id),
        homies: action === 'accept' && found ? [...state.homies, found.player] : state.homies,
      });
    }),
    remove: async (code: string) => setData(state => withCounts({ ...state, homies: state.homies.filter(item => item.friendCode !== code) })),
    block: async (code: string) => setData(state => withCounts({ ...state, homies: state.homies.filter(item => item.friendCode !== code), incomingRequests: state.incomingRequests.filter(item => item.player.friendCode !== code), outgoingRequests: state.outgoingRequests.filter(item => item.player.friendCode !== code), blocked: [...state.blocked, knownPlayers.find(item => item.friendCode === code)!] })),
    unblock: async (code: string) => setData(state => withCounts({ ...state, blocked: state.blocked.filter(item => item.friendCode !== code) })),
    respondInvitation: async (id: string, action: 'decline' | 'cancel') => {
      const current = data.invitations.find(item => item.id === id);
      if (!current) throw new Error('Invitation unavailable.');
      const next: SocialInvitation = { ...current, status: action === 'decline' ? 'declined' : 'cancelled' };
      setData(state => withCounts({ ...state, invitations: state.invitations.map(item => item.id === id ? next : item) }));
      return next;
    },
  }), [data, busy]);
}
type SocialContextValue = ReturnType<typeof useLocalSocial>;
const SocialContext = createContext<SocialContextValue | null>(null);
export function SocialProvider({ children }: { children: ReactNode }) {
  const social = useLocalSocial();
  return <SocialContext.Provider value={social}>{children}</SocialContext.Provider>;
}
export function useSocial() {
  const social = useContext(SocialContext);
  if (!social) throw new Error('SocialProvider is required.');
  return social;
}