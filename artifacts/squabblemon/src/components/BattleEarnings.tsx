import { rewardReceipts } from '../lib/rewardReceipts';
import { GameGlyph } from './venue/GameGlyph';
import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import type { MatchReward } from '@workspace/api-client-react';
import { catalogCardById, getCardImage } from '../data';
import { cardProgressDetails } from '@workspace/squabblemon-engine/cardProgression';

export function BattleEarnings({ reward, showTotals = true }: { reward: MatchReward; showTotals?: boolean }) {
  return (
    <section aria-label="Earned battle rewards" className="battle-earnings">
      {showTotals && <div className="battle-earnings__totals">
        <div>
          <GameGlyph name="clout" />
          <strong>+{reward.softCurrency}</strong>
          <span>Clout</span>
        </div>
        <div>
          <GameGlyph name="xp" />
          <strong>+{reward.xp}</strong>
          <span>Profile XP</span>
        </div>
        <div>
          <GameGlyph name="rep" />
          <strong>+{reward.streetRep}</strong>
          <span>Street Rep</span>
        </div>
      </div>}
      <button className="studio-text-action" onClick={() => rewardReceipts.show({ id: `battle:${reward.id}:${crypto.randomUUID()}`, title: 'Battle earnings', items: [{label: 'Clout', amount: reward.softCurrency, glyph: 'cloutStack'}, {label: 'Profile XP', amount: reward.xp, glyph: 'xp'}, {label: 'Street Rep', amount: reward.streetRep, glyph: 'rep'}, ...(reward.packTickets > 0 ? [{label: 'Tickets', amount: reward.packTickets, glyph: 'ticket' as const}] : [])] })}>View reward haul →</button>
      {!!reward.cardXp?.length && (
        <details className="result-stage__details">
          <summary>
            Your gang earned XP <span>{reward.cardXp.length} characters</span>
          </summary>
          <div className="battle-earnings__crew">
            {reward.cardXp.map((entry) => {
              const card = catalogCardById[entry.cardId],
                progress = cardProgressDetails(entry);
              const newlyEligible = [2, 5, 8].some((level) => entry.previousLevel < level && entry.level >= level);
              return (
                <div key={entry.cardId}>
                  <img src={getCardImage(entry.cardId)} alt="" />
                  <div>
                    <strong>{card?.name ?? entry.cardId}</strong>
                    <p>
                      +{entry.xpGained} XP · LV {entry.level}
                    </p>
                    <progress
                      max={100}
                      value={progress.progressPercent}
                      aria-label={`${card?.name ?? entry.cardId} level progress`}
                    />
                    <small>
                      {progress.isMaxLevel
                        ? 'Maximum level'
                        : `${progress.xpIntoLevel} / ${progress.xpForNextLevel} to next level`}
                    </small>
                    {newlyEligible && (
                      <Link href={`/game/shop?item=move-training&card=${entry.cardId}`}>New move ready to train →</Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="studio-notice">Spend Clout at Dr. Fade’s shop to activate moves at levels 2, 5, and 8.</p>
        </details>
      )}
      <Link href="/game/shop?view=training" className="studio-text-action">
        Spend Clout · Train, recruit, or pull <ArrowRight size={13} />
      </Link>
    </section>
  );
}
