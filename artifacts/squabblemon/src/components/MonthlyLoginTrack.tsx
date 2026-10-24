import type { MonthlyLoginStatus } from '@workspace/squabblemon-engine/accountRewards';
import { getAssetUrl, getCardImage } from '../lib/assets';
import '../styles/monthly-login-track.css';

/** A roadmap of server receipts. Claiming still uses the existing check-in action. */
export function MonthlyLoginTrack({ status }: { status: MonthlyLoginStatus }) {
  const month = new Date(`${status.month}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
  const reset = new Date(status.nextResetAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const next = status.milestones.find(milestone => !milestone.reward);
  const remaining = next ? Math.max(0, next.day - status.claimedDays) : 0;
  return <section className="monthly-login-track" aria-label={`${month} free card rewards`}>
    <header><div><span className="monthly-login-track__eyebrow">{month} · seven free cards</span><h3>Road to Mythical</h3></div><span className="monthly-login-track__count">{status.claimedDays} / {status.requiredDays} check-ins</span></header>
    <div className="monthly-login-track__days" aria-hidden="true">{Array.from({ length: status.requiredDays }, (_, index) => <i key={index} data-collected={index < status.claimedDays} data-next={!status.claimedToday && index === status.claimedDays}/>)}</div>
    <p className="monthly-login-track__next">{next ? <><b>{next.ready ? 'Ready' : 'Up next'}: {next.label}</b><span>{next.ready ? status.claimedToday ? 'Collect your card' : 'With today’s check-in' : `${remaining} more check-in${remaining === 1 ? '' : 's'}`}</span></> : <><b>Road complete.</b><span>All seven tiers saved</span></>}</p>
    <ol className="monthly-login-track__route">{status.milestones.map((milestone) => {
      const reward = milestone.reward;
      const isNext = next?.key === milestone.key;
      const result = reward ? reward.isNewCard === false ? `${reward.cardName ?? 'Duplicate'} converted to ${reward.styleShards} ${reward.shardRarity === 'Epic' ? 'Super Rare' : reward.shardRarity ?? 'Universal'} Style Shards` : `${reward.cardName ?? milestone.label + ' card'} saved` : milestone.ready ? status.claimedToday ? 'ready to collect' : 'ready with check-in' : 'not yet earned';
      return <li key={milestone.key} data-rarity={milestone.rarity} data-collected={Boolean(reward)} data-ready={milestone.ready} data-next={isNext} title={result}
        aria-current={isNext ? 'step' : undefined} aria-label={`Check-in ${milestone.day}: one ${milestone.label} gameplay card, ${result}`}>
        <span className="monthly-login-track__day">DAY <b>{String(milestone.day).padStart(2, '0')}</b></span>
        <span className="monthly-login-track__card" aria-hidden="true">
          <img src={reward?.cardId ? getCardImage(reward.cardId) : getAssetUrl('brand/prismatic/marks/impact-standard-gold.webp')} alt="" width="48" height="60" decoding="async" data-portrait={Boolean(reward?.cardId)} />
          {reward && <span className="monthly-login-track__stamp">✓</span>}
        </span>
        <span className="monthly-login-track__caption"><b>{milestone.label}</b><span>{reward ? '✓ Saved' : milestone.ready ? 'Ready' : isNext ? 'Up next' : 'Locked'}</span></span>
      </li>;
    })}</ol>
    <footer><span>One card per tier</span><span>Resets {reset} · UTC</span></footer>
    {status.requiredDays < 30 && <p className="monthly-login-track__short-month">Short month: Mythical arrives on check-in {status.requiredDays}.</p>}
  </section>;
}
