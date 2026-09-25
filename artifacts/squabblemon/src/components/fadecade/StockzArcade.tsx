import type { StockzState } from '@workspace/squabblemon-engine/accountRewards';
import { STOCKZ_DAILY_LIMIT, STOCKZ_STAKES, STOCKZ_TICKERS } from '@workspace/squabblemon-engine/accountRewards';
import { getAssetUrl, getCardImage } from '../../lib/assets';
import { signedClout, stockzClock, stockzReceipts, stockzTrace, type SettledStockzRound } from './stockzArcadeModel';

export function StockzIcon({ name, className = '' }: { name: string; className?: string }) {
  return <svg viewBox="0 0 128 128" className={`sx-icon ${className}`} aria-hidden="true" focusable="false">
    <use href={`${getAssetUrl('assets/fadecade/stockz/arcade-icons.svg')}#${name}`} />
  </svg>;
}

export interface StockzArcadeProps {
  balance: number;
  state?: StockzState;
  ticker: string;
  direction: 'up' | 'down';
  stake: number;
  now: number;
  busy: boolean;
  loading: boolean;
  unavailable: boolean;
  retryPending: boolean;
  error: string;
  result: SettledStockzRound | null;
  celebrate: boolean;
  onTicker: (value: string) => void;
  onDirection: (value: 'up' | 'down') => void;
  onStake: (value: number) => void;
  onStart: () => void;
  onSettle: () => void;
  onRefresh: () => void;
  onDismissResult: () => void;
  onReview: (receipt: SettledStockzRound) => void;
}

export function StockzArcade(props: StockzArcadeProps) {
  const { state, busy, ticker, direction, stake, now } = props;
  const active = state?.active ?? null;
  const result = active ? null : props.result;
  const clock = stockzClock(active, now);
  const summary = stockzReceipts(state?.recent ?? []);
  const shown = result ?? active;
  const company = STOCKZ_TICKERS.find(item => item.id === (shown?.ticker ?? ticker)) ?? STOCKZ_TICKERS[0];
  const net = result ? result.payout - result.stake : 0;
  const remaining = Math.max(0, STOCKZ_DAILY_LIMIT - (state?.roundsToday ?? 0));
  const trace = stockzTrace(shown?.id ?? ticker, active && !result ? Math.max(0.06, clock.progress) : 1, result ?? undefined);
  const locked = busy || props.retryPending || !!active || props.unavailable;
  const cannotAfford = props.balance < stake;
  const status = result ? 'RECEIPT VERIFIED' : active ? (clock.valid && clock.seconds === 0 ? 'CLOSING BELL' : 'TRADE LOCKED') : 'MAKE YOUR CALL';
  const primaryLabel = busy ? 'Confirming…' : props.retryPending ? 'Retry same trade' : !remaining ? 'Daily limit reached' : cannotAfford ? 'Not enough Clout' : `Lock in ${stake} Clout`;

  return <section className="sx-exchange" id="stockz-setup" aria-label="Stockz Clout Exchange">
    <header className="sx-marquee">
      <div className="sx-brand"><span className="sx-eyebrow">FADECADE ORIGINAL / 04</span><h2>STOCK<span>Z</span></h2><p>THE CLOUT EXCHANGE</p></div>
      <img className="sx-host" src={getCardImage('stockz')} alt="Stockz, your Clout Exchange host" draggable={false} />
      <div className="sx-bank"><span>YOUR CLOUT</span><strong>{props.balance.toLocaleString('en-US')}</strong><small>In-game currency only</small></div>
      <div className="sx-marquee-stripe" aria-hidden="true" />
    </header>

    <div className="sx-toolbar"><span><i className="sx-status-lamp" aria-hidden="true" /> {status}</span>
      <span className="sx-credits" aria-label={`${remaining} of ${STOCKZ_DAILY_LIMIT} trades remaining today`}>
        {Array.from({ length: STOCKZ_DAILY_LIMIT }, (_, i) => <i key={i} data-available={i < remaining} aria-hidden="true" />)}
        <b>{state ? remaining : '…'} / {STOCKZ_DAILY_LIMIT}</b><span> PLAYS LEFT</span>
      </span>
    </div>

    {props.loading && <div className="sx-notice" role="status">Connecting to the exchange…</div>}
    {props.unavailable && <div className="sx-notice" role="alert">Market connection interrupted. Your saved trades are safe.
      <button type="button" className="sx-text-button" disabled={busy} onClick={props.onRefresh}>Refresh market</button>
    </div>}

    {state && <>
      <div className="sx-game-grid">
        <div className="sx-monitor" data-result={result ? (net > 0 ? 'win' : 'loss') : 'none'}>
          <div className="sx-monitor-top"><div><StockzIcon name={company.id.toLowerCase()} /><span><b>{company.id}</b><small>{company.name}</small></span></div><span className="sx-label">{result ? 'OFFICIAL CLOSE' : 'CLOUT / SHARE'}</span></div>
          <div className="sx-stage">
            <svg className="sx-chart" viewBox="0 0 600 210" preserveAspectRatio="none" aria-hidden="true">
              <path className="sx-chart-grid" d="M20 28H580M20 68H580M20 108H580M20 148H580M20 188H580M20 18V190M100 18V190M180 18V190M260 18V190M340 18V190M420 18V190M500 18V190M580 18V190" />
              <path className="sx-chart-baseline" d="M20 108H580" />
              <path className="sx-chart-area" d={trace.area} /><path className="sx-chart-line" d={trace.line} />
              <circle className="sx-chart-dot" cx={trace.last.x} cy={trace.last.y} r="5" />
            </svg>
            <div className="sx-stage-message">
              {result ? <><span className="sx-label">{net > 0 ? 'CALL LANDED' : net === 0 ? 'TRADE CLOSED' : 'CALL MISSED'}</span><strong className="sx-net">{signedClout(net)}</strong><span className="sx-label">NET CLOUT</span></>
                : active ? <><span className="sx-label">{clock.valid ? (clock.seconds ? 'TIME TO CLOSING BELL' : 'YOUR RESULT IS READY') : 'SYNCING THE CLOCK'}</span><strong className="sx-countdown" aria-live="off">{clock.valid ? (clock.seconds ? `${clock.seconds}` : 'BELL!') : '…'}</strong><span className="sx-call-chip">{active.ticker} · {active.direction === 'up' ? '↗ UP' : '↘ DOWN'} · {active.stake} CLOUT</span></>
                  : <><span className="sx-label">YOUR CALL. YOUR CLOUT.</span><strong className="sx-ready">UP OR<br /><em>DOWN?</em></strong><span className="sx-call-chip">Pick a company. Call the close.</span></>}
            </div>
            {result && net > 0 && props.celebrate && <div className="sx-celebration" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={`${result.id}-${i}`} style={{ '--i': i } as import('react').CSSProperties}><StockzIcon name="clout" /></i>)}</div>}
          </div>
          <div className="sx-price-strip"><span>OPEN <b>{shown?.openPrice ?? company.price}</b></span><span>{result ? <>CLOSE <b>{result.closePrice}</b></> : active ? <>YOUR CALL <b>{active.direction.toUpperCase()}</b></> : <>ODDS <b>50 / 50</b></>}</span></div>
          {active && !result && <div className="sx-timer-track" role="progressbar" aria-label="Time to closing bell" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clock.progress * 100)}><span style={{ width: `${clock.progress * 100}%` }} /></div>}
          <p className="sx-chart-disclaimer">{result ? 'Open and close are verified. The chart path is illustrative.' : 'Arcade animation, not live prices. No prediction or trading advantage.'}</p>
        </div>

        <div className="sx-console">
          {result ? <section className="sx-receipt" aria-label="Verified trade receipt">
            <div className="sx-receipt-heading"><StockzIcon name={net > 0 ? 'clout' : 'bell'} /><span className="sx-eyebrow">CLOSING RECEIPT</span></div>
            <h3>{net > 0 ? 'CLOUT SECURED.' : 'BELL RANG.'}</h3>
            <p role="status">{net > 0 ? `Correct call. ${signedClout(net)} Clout net.` : net === 0 ? 'Trade closed with no net change.' : `This call missed. ${result.stake} Clout spent.`}</p>
            <dl><div><dt>Your call</dt><dd>{result.ticker} · {result.direction.toUpperCase()}</dd></div><div><dt>Stake</dt><dd>{result.stake}</dd></div><div><dt>Total returned</dt><dd>{result.payout}</dd></div><div className="sx-receipt-total"><dt>Net Clout</dt><dd>{signedClout(net)}</dd></div></dl>
            <small>Server-confirmed. Total returned includes the original stake. No extra claim is needed.</small>
            <button type="button" className="sx-action" onClick={props.onDismissResult}>Back to exchange <span aria-hidden="true">↗</span></button>
          </section> : active ? <section className="sx-locked">
            <StockzIcon name="bell" /><span className="sx-eyebrow">ORDER ACCEPTED</span><h3>LET IT<br />RING.</h3>
            <p>Your {active.stake} Clout call is saved. Leaving this screen will not cancel it.</p>
            <div className="sx-order-summary"><span>{active.ticker}</span><b>{active.direction === 'up' ? '↗ UP' : '↘ DOWN'}</b></div>
            {clock.valid ? <button type="button" className="sx-action" disabled={clock.seconds > 0 || busy || props.unavailable} onClick={props.onSettle}>{busy ? 'Confirming result…' : clock.seconds ? 'Waiting for the bell' : 'Reveal the close'} <span aria-hidden="true">↗</span></button>
              : <button type="button" className="sx-action" disabled={busy} onClick={props.onRefresh}>Refresh the clock</button>}
            <span className="sx-bell-status" role="status">{clock.valid && clock.seconds === 0 ? 'Closing bell. Your result can now be revealed.' : 'Results come from the server, never the animation.'}</span>
          </section> : <div className="sx-order">
            <fieldset disabled={locked}><legend><b>01</b> PICK YOUR COMPANY</legend><div className="sx-companies">{STOCKZ_TICKERS.map(item => <button type="button" key={item.id} aria-pressed={ticker === item.id} aria-label={`${item.name}, ${item.id}, opening price ${item.price}`} onClick={() => props.onTicker(item.id)}><StockzIcon name={item.id.toLowerCase()} /><strong>{item.id}</strong><small>{item.name}</small></button>)}</div></fieldset>
            <fieldset disabled={locked}><legend><b>02</b> CALL THE CLOSE</legend><div className="sx-directions">{(['up', 'down'] as const).map(value => <button type="button" key={value} data-direction={value} aria-pressed={direction === value} onClick={() => props.onDirection(value)}><span aria-hidden="true">{value === 'up' ? '↗' : '↘'}</span>{value.toUpperCase()}</button>)}</div></fieldset>
            <fieldset disabled={locked}><legend><b>03</b> SET YOUR CLOUT</legend><div className="sx-stakes">{STOCKZ_STAKES.map(amount => <button type="button" key={amount} aria-pressed={stake === amount} aria-label={`Stake ${amount} Clout`} disabled={props.balance < amount} onClick={() => props.onStake(amount)}>{amount}</button>)}</div></fieldset>
            <div className="sx-return"><span>Correct call returns</span><b>{stake * 2} <small>CLOUT</small></b><span>Includes stake · {signedClout(stake)} net</span></div>
            <button type="button" className="sx-action" disabled={busy || props.unavailable || (!props.retryPending && (!remaining || cannotAfford))} onClick={props.onStart}>{primaryLabel}<span aria-hidden="true">↗</span></button>
            {!remaining && <small className="sx-reset">The daily limit resets at 00:00 UTC.</small>}
            {props.retryPending && <p className="sx-retry-copy">Confirmation was interrupted. Choices are locked so retrying reuses the same order, not a second trade.</p>}
          </div>}
        </div>
      </div>
      {summary.receipts.length > 0 && <section className="sx-history" aria-label="Recent verified trade receipts"><header><h3>THE RECEIPTS</h3><span>{summary.wins}/{summary.receipts.length} calls landed · {signedClout(summary.net)} Clout net</span></header><div>{summary.receipts.map(round => <button type="button" key={round.id} disabled={busy || !!active || props.retryPending} onClick={() => props.onReview(round)} aria-label={`Review ${round.ticker} ${round.direction}, ${signedClout(round.payout - round.stake)} Clout net`}><span>{round.ticker} {round.direction === 'up' ? '↗' : '↘'}</span><b data-positive={round.payout > round.stake}>{signedClout(round.payout - round.stake)}</b><small>{round.openPrice} → {round.closePrice}</small></button>)}</div></section>}
    </>}
    {props.error && <div className="sx-notice sx-notice--error" role="alert">{props.error}<button type="button" className="sx-text-button" disabled={busy} onClick={props.onRefresh}>Refresh market</button></div>}
    <footer className="sx-rules"><strong>FICTIONAL STOCKS. REAL ARCADE ENERGY.</strong><p>In-game Clout only. No cash value. Each direction is 50/50; companies and animations do not change the odds. A correct call returns 2× the stake, including the stake. A miss loses the stake. Maximum {STOCKZ_DAILY_LIMIT} trades per day.</p></footer>
  </section>;
}
