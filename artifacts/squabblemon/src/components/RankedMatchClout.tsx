import type { RankedMatchClout as MatchGrant } from '@workspace/squabblemon-engine/ranked';
import { GameGlyph } from './venue/GameGlyph';
import '../styles/ranked-match-clout.css';

/** The server receipt is the only source of amounts and daily-cap state. */
export function RankedMatchClout({ grant }: { grant?: MatchGrant }) {
  if (!grant) return null;
  return <div className="ranked-match-clout" data-testid="ranked-match-clout" data-status={grant.status} data-receipt-id={grant.receiptId} role="status">
    {grant.status === 'saved' ? <><GameGlyph name="clout" /><div><strong>+{grant.softCurrency.toLocaleString()} Clout</strong><small>Saved · payout {grant.paidMatchesToday}/{grant.dailyLimit} · {grant.date} UTC</small></div></>
      : grant.status === 'daily-limit' ? <div><strong>Daily match Clout limit reached.</strong><small>{grant.dailyLimit}/{grant.dailyLimit} payouts on {grant.date} · resets {grant.resetsAt.slice(0, 10)} at 00:00 UTC</small></div>
        : <small>{grant.exclusion === 'bot' ? 'Match Clout comes from completed human ranked fades.' : 'Finish the full human ranked fade to earn match Clout.'}</small>}
  </div>;
}
