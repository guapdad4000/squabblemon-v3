const STORAGE_PREFIX = 'squabblemon:collection-card-discovery:v1:';
const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type DiscoveryOpening = {
  createdAt: string;
  rewards: readonly {
    kind: string;
    cardId?: string | null;
    isNew: boolean;
  }[];
};

export type CollectionDiscoveryState = {
  version: 1;
  knownCardIds: string[];
  pendingCardIds: string[];
};

export interface CollectionDiscoveryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function discoveryKey(playerId: string) {
  return `${STORAGE_PREFIX}${encodeURIComponent(playerId)}`;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length > 0);
}

function unique(ids: readonly string[]) {
  return [...new Set(ids.filter((id) => id.length > 0))];
}

export function readDiscovery(
  playerId: string,
  storage?: Pick<CollectionDiscoveryStorage, 'getItem'> | null,
): CollectionDiscoveryState | null {
  try {
    const serialized = storage?.getItem(discoveryKey(playerId));
    if (!serialized) return null;
    const value: unknown = JSON.parse(serialized);
    if (
      typeof value !== 'object'
      || value === null
      || (value as Partial<CollectionDiscoveryState>).version !== 1
      || !isStringArray((value as Partial<CollectionDiscoveryState>).knownCardIds)
      || !isStringArray((value as Partial<CollectionDiscoveryState>).pendingCardIds)
    ) return null;
    const state = value as CollectionDiscoveryState;
    return {
      version: 1,
      knownCardIds: unique(state.knownCardIds),
      pendingCardIds: unique(state.pendingCardIds),
    };
  } catch {
    return null;
  }
}

export function writeDiscovery(
  playerId: string,
  state: CollectionDiscoveryState,
  storage?: Pick<CollectionDiscoveryStorage, 'setItem'> | null,
) {
  try {
    storage?.setItem(discoveryKey(playerId), JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function orderedReceiptCardIds(
  packHistory: readonly DiscoveryOpening[],
  allowedIds: ReadonlySet<string>,
  minimumCreatedAt?: number,
  maximumCreatedAt?: number,
) {
  return packHistory
    .map((opening, index) => ({ opening, index, createdAt: Date.parse(opening.createdAt) }))
    .filter(({ createdAt }) => (
      Number.isFinite(createdAt)
      && (minimumCreatedAt === undefined || createdAt >= minimumCreatedAt)
      && (maximumCreatedAt === undefined || createdAt <= maximumCreatedAt)
    ))
    .sort((left, right) => right.createdAt - left.createdAt || left.index - right.index)
    .flatMap(({ opening }) => opening.rewards)
    .filter((reward) => (
      reward.kind === 'card'
      && reward.isNew
      && typeof reward.cardId === 'string'
      && allowedIds.has(reward.cardId)
    ))
    .map((reward) => reward.cardId as string);
}

export function reconcileDiscovery(
  ownedCardIds: readonly string[],
  packHistory: readonly DiscoveryOpening[],
  previous: CollectionDiscoveryState | null,
  now: number,
): CollectionDiscoveryState {
  const owned = unique(ownedCardIds);
  const ownedSet = new Set(owned);

  if (!previous) {
    return {
      version: 1,
      knownCardIds: owned,
      pendingCardIds: unique(orderedReceiptCardIds(
        packHistory,
        ownedSet,
        now - RECENT_WINDOW_MS,
        now,
      )),
    };
  }

  const priorKnown = new Set(previous.knownCardIds);
  const preservedPending = unique(previous.pendingCardIds).filter((id) => ownedSet.has(id));
  const discoveredByDiff = owned.filter((id) => !priorKnown.has(id));
  const pendingSet = new Set([...preservedPending, ...discoveredByDiff]);
  const receiptOrder = unique(orderedReceiptCardIds(packHistory, pendingSet));
  const receiptSet = new Set(receiptOrder);
  const fallbackPending = preservedPending.filter((id) => !receiptSet.has(id));
  const fallbackPendingSet = new Set(fallbackPending);
  const fallbackDiff = discoveredByDiff
    .filter((id) => !receiptSet.has(id) && !fallbackPendingSet.has(id))
    .sort((left, right) => left.localeCompare(right));

  return {
    version: 1,
    knownCardIds: unique([...previous.knownCardIds, ...owned]),
    pendingCardIds: [...receiptOrder, ...fallbackPending, ...fallbackDiff],
  };
}

export function acknowledgeDiscovery(
  state: CollectionDiscoveryState,
  cardIds: readonly string[],
): CollectionDiscoveryState {
  const acknowledged = new Set(cardIds);
  return {
    version: 1,
    knownCardIds: [...state.knownCardIds],
    pendingCardIds: state.pendingCardIds.filter((id) => !acknowledged.has(id)),
  };
}