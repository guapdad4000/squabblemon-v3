import { rankProgress, type RankedResult } from '@workspace/squabblemon-engine/ranked';

/** Milestone gifts can be catch-up grants; only this result's RP tier can promote. */
export function isRankTierPromotion(rank: Pick<RankedResult, 'before' | 'after'> | null | undefined): boolean {
  return Boolean(rank && Number.isFinite(rank.before) && Number.isFinite(rank.after)
    && rank.after > rank.before && rankProgress(rank.after).floor > rankProgress(rank.before).floor);
}
