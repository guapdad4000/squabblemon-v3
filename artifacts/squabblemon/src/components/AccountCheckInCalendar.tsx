import { LOGIN_REWARDS } from '@workspace/squabblemon-engine/accountRewards';
import { GameGlyph } from './venue/GameGlyph';
import '../styles/account-check-in-calendar.css';

/** The server supplies the streak; this view never claims or advances a day. */
export function AccountCheckInCalendar({ streak, claimedToday }: { streak: number; claimedToday: boolean }) {
  const currentDay = (Math.max(1, streak) - 1) % LOGIN_REWARDS.length;
  return <section className="account-check-in-calendar" aria-label="Seven-day check-in rewards">
    <header><h3>Daily check-in</h3><span>Day {streak} · {claimedToday ? 'Collected' : 'Ready'}</span></header>
    <ol aria-label="Weekly reward trail">{LOGIN_REWARDS.map((reward, index) => {
      const current = index === currentDay;
      const collected = index < currentDay || (current && claimedToday);
      const next = index === currentDay + 1;
      const jackpot = index === LOGIN_REWARDS.length - 1;
      const state = collected ? 'saved' : current ? 'ready' : next ? 'next' : 'locked';
      const values = [
        { amount: reward.softCurrency, name: 'Clout', glyph: 'clout' as const },
        { amount: reward.packTickets, name: 'Pack Tickets', glyph: 'ticket' as const },
        { amount: reward.styleShards, name: 'Style Shards', glyph: 'shards' as const },
      ].filter(value => value.amount > 0);
      return <li key={index} data-current={current} data-collected={collected} data-state={state} data-jackpot={jackpot}
        aria-current={current ? 'date' : undefined}
        aria-label={`Day ${index + 1}: ${values.map(value => `${value.amount} ${value.name}`).join(', ')}${collected ? ', collected' : current ? ', ready today' : next ? ', next check-in' : ', upcoming'}`}>
        <span className="account-check-in-calendar__day" aria-hidden="true">{index + 1}
          {collected && <i className="account-check-in-calendar__stamp">✓</i>}
        </span>
        <div className="account-check-in-calendar__parcel" aria-hidden="true">
          <GameGlyph name={jackpot ? 'cloutBag' : reward.softCurrency >= 150 ? 'cloutStack' : 'clout'} className="account-check-in-calendar__art" />
          <b className="account-check-in-calendar__amount">{reward.softCurrency}</b>
          <span className="account-check-in-calendar__bonus">{values.filter(value => value.name !== 'Clout').map(value =>
            <span className="account-check-in-calendar__reward" key={value.name}><GameGlyph name={value.glyph} /><b>{value.amount}</b></span>
          )}</span>
        </div>
        <span className="account-check-in-calendar__marker" aria-hidden="true">{current && !claimedToday ? 'TODAY' : next ? 'NEXT' : jackpot ? 'JACKPOT' : collected ? 'SAVED' : '·'}</span>
      </li>;
    })}</ol>
  </section>;
}
