/** Lightweight release policy: safe to import from the mode hub without loading the engine. */
export const BREAKTHROUGH_PUBLIC_LAUNCH_APPROVED: boolean = false;
/** Bound by required source tests; changing mechanics invalidates earlier release evidence. */
export const BREAKTHROUGH_RULE_INPUT_SHA256: Readonly<Record<string, string>> =
  {
    'breakthrough.ts':
      'b323bbd94015434923b83e6e07d15998a1e5bd978341ce2c533788a9c15d1ef4',
    'breakthroughBlockbusters.ts':
      '0b2911eac133733c493059b982f808c3545b8d32875c21ce27cab224418b3348',
    'breakthroughCatalog.ts':
      '5141b5b65deb5a9533525d25078140b446045c6ac4588bca10176aeac07ee3d3',
    'breakthroughCommunity.ts':
      '51be659c9874a50f784ec4c5810f30b686bb5fc9c7baa8d50e767ded710af40e',
    'breakthroughContracts.ts':
      '4935abcca898982679d99d48b92613fd8a1b06dcf7e12f05860dc7c3e1128060',
    'breakthroughControl.ts':
      'caf775709ba5a5d45d84db921bae97366f6cacb0dceb2c4ca5a0fc32126aec8e',
    'breakthroughFactions.ts':
      'c4371109632fc55e7b41ca967c6a578e7071b4750ab804a09e7b71eb9d3a1905',
    'breakthroughFitness.ts':
      '4d67d75e282b5e43d5fba23dbc9cae549bdd679029b0e094637158bc715a8061',
    'breakthroughHouse.ts':
      'bcb5af385e63a33d22783f665eccc83b46c1a3701a710107bb021affedd86efb',
    'breakthroughMusic.ts':
      'af6df77db16bc60680a47ecfe6dda8bf8561488cf448b46e5cf286dd83be4868',
    'breakthroughNeighborhood.ts':
      'cacf1b7daf98f1750a26ec3d2bb8a6672ba9ec8811c289cf1c3811b46264ab87',
    'breakthroughNetwork.ts':
      'eddead2d57ac3bdd0285e05c994c8b9a7b45e26a56d6cabdee4af73ba48ff67c',
    'breakthroughReactions.ts':
      '80c5773f06efa8a7e3c2b47c121ac0f857c6b97653cae91c32f295af96d57ebb',
    'breakthroughRoom.ts':
      'ed5c5d6ddac94a5e51d1f0a588cb6af274cb280910b23efd00fef270f487d489',
    'breakthroughSpecials.ts':
      '248accfe4350355cd36d103e7cb701b36902a5ab4bbe58e4c46e0d26c99f144c',
    'breakthroughSummons.ts':
      '7fd7395d8fcf310b2f689274e8dd681d475e956c6a5444f8ac22c5aaef76c7ef',
    'breakthroughSupports.ts':
      'deaed808467a34dfc6058b0c976f0ee0e3155fe968246ed0c9004e027b7238ce',
  };
export const BREAKTHROUGH_CARD_RELEASE_CHECKS = [
  'activation',
  'targeting',
  'rejected-input',
  'interaction',
  'lifecycle',
  'last-stand',
  'deterministic-replay',
  'presentation',
] as const;
export type BreakthroughCardReleaseCheck =
  (typeof BREAKTHROUGH_CARD_RELEASE_CHECKS)[number];
export interface BreakthroughCatalogCoverage {
  ruleset: string;
  /** Exact canonical input serialization, not a security hash or a client credential. */
  catalogSignature: string;
  cards: readonly { cardId: string; supported: boolean }[];
}
export interface BreakthroughFullCatalogEvidence {
  evidenceId: string;
  ruleset: string;
  catalogSignature: string;
  cards: readonly {
    cardId: string;
    checks: readonly BreakthroughCardReleaseCheck[];
  }[];
}
/** No full-catalog proof exists yet. Adapter presence must never substitute for this review. */
export const BREAKTHROUGH_FULL_CATALOG_EVIDENCE: BreakthroughFullCatalogEvidence | null =
  null;

/** Navigation hint only. Direct entry and server admission also inspect current canonical coverage. */
export function isBreakthroughPublicEntryEnabled(): boolean {
  return (
    BREAKTHROUGH_PUBLIC_LAUNCH_APPROVED &&
    BREAKTHROUGH_FULL_CATALOG_EVIDENCE !== null
  );
}

export function evaluateBreakthroughRelease(
  coverage: BreakthroughCatalogCoverage,
  evidence: BreakthroughFullCatalogEvidence | null = BREAKTHROUGH_FULL_CATALOG_EVIDENCE,
  approved: boolean = BREAKTHROUGH_PUBLIC_LAUNCH_APPROVED,
) {
  const ids = coverage.cards.map((card) => card.cardId);
  const uniqueCatalog = ids.length > 0 && new Set(ids).size === ids.length;
  const unsupportedCardIds = coverage.cards
    .filter((card) => !card.supported)
    .map((card) => card.cardId);
  const matchesInputs =
    !!evidence &&
    !!evidence.evidenceId.trim() &&
    evidence.ruleset === coverage.ruleset &&
    evidence.catalogSignature === coverage.catalogSignature;
  const proofs = new Map(
    evidence?.cards.map((card) => [card.cardId, card]) ?? [],
  );
  const uniqueEvidence = !!evidence && proofs.size === evidence.cards.length;
  const exactEvidence =
    uniqueEvidence &&
    proofs.size === ids.length &&
    [...proofs.keys()].every((id) => ids.includes(id));
  const verifiedCardIds =
    matchesInputs && exactEvidence
      ? ids.filter((id) =>
          BREAKTHROUGH_CARD_RELEASE_CHECKS.every((check) =>
            proofs.get(id)?.checks.includes(check),
          ),
        )
      : [];
  const unverifiedCardIds = ids.filter((id) => !verifiedCardIds.includes(id));
  const reasons: string[] = [];
  if (!uniqueCatalog)
    reasons.push('A complete, unique canonical catalog is required.');
  if (unsupportedCardIds.length)
    reasons.push(
      `${unsupportedCardIds.length} canonical cards still need concrete Breakthrough effects.`,
    );
  if (!matchesInputs || !exactEvidence)
    reasons.push(
      'Full-catalog evidence is missing or does not match the current rules and catalog.',
    );
  if (unverifiedCardIds.length)
    reasons.push(
      `${unverifiedCardIds.length} cards still need complete gameplay and presentation proof.`,
    );
  if (!approved) reasons.push('Public launch has not been approved.');
  return {
    canLaunch: reasons.length === 0,
    totalCards: ids.length,
    supportedCards: ids.length - unsupportedCardIds.length,
    verifiedCards: verifiedCardIds.length,
    unsupportedCardIds,
    unverifiedCardIds,
    reasons,
  };
}
