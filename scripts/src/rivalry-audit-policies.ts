import { createHash } from 'node:crypto';
import {
  listLegalBalancePlays, type BalancePolicy, type BalancePlayOption,
} from '@workspace/squabblemon-engine/balanceLab';

const order = (a: BalancePlayOption, b: BalancePlayOption) => a.cost - b.cost
  || Number(a.squabble) - Number(b.squabble) || a.cardId.localeCompare(b.cardId) || a.lane - b.lane;

/** Common random priorities: excludes seat/global action index and keys by logical deck.
 * Paired seats retain the same card/lane priorities for a side's nth decision.
 * This is a low-information control, not a strength-aware bot.
 */
export function pairedSeededPolicy(seed: string): BalancePolicy {
  const decisions = new Map<string, number>();
  return ({ match, owner, legalPlays }) => {
    const deck = owner === 'player' ? match.playerDeck : match.cpuDeck;
    const decision = decisions.get(deck) ?? 0;
    decisions.set(deck, decision + 1);
    const priority = (option: BalancePlayOption) => createHash('sha256')
      .update(`${seed}:${deck}:${decision}:${option.cardId}:${option.lane}:${option.squabble}`).digest('hex');
    return [...legalPlays].sort((a, b) => priority(a).localeCompare(priority(b)) || order(a, b))[0] ?? null;
  };
}

/** Diagnostic two-play search within the current side's turn. Uses only its hand
 * and public board. No guessed future draws, opponent hand, or crew-specific weights.
 * Immediate top three plus up to three neutral/negative candidates prevent a zero-
 * power setup from being excluded solely because the first play scores poorly.
 */
export const chainBalancePolicy: BalancePolicy = ({ match, owner, legalPlays, evaluate }) => {
  if (!legalPlays.length) return null;
  const baseline = evaluate(match, owner);
  const ranked = legalPlays.map(option => ({ option, immediate: evaluate(option.preview, owner) }))
    .sort((a, b) => b.immediate - a.immediate || order(a.option, b.option));
  const candidates = [...ranked.slice(0, 3), ...ranked.filter(row => row.immediate <= baseline + 0.05).slice(0, 3)]
    .filter((row, i, all) => all.findIndex(other => other.option === row.option) === i);
  let best = ranked[0].option, bestScore = ranked[0].immediate;
  for (const candidate of candidates) {
    // Discard old replay logs in hypothetical branches, preserving gameplay state.
    const preview = { ...candidate.option.preview, effectLog: [] };
    const followups = listLegalBalancePlays(preview, owner, !!match.squabbleByOwner);
    const future = Math.max(candidate.immediate, ...followups.map(next => evaluate(next.preview, owner)));
    const score = candidate.immediate + 0.8 * (future - candidate.immediate);
    if (score > bestScore + 1e-9 || (Math.abs(score - bestScore) < 1e-9 && order(candidate.option, best) < 0)) {
      best = candidate.option; bestScore = score;
    }
  }
  return bestScore > baseline + 0.05 ? best : null;
};
