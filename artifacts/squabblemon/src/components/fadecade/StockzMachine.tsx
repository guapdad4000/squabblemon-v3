import { ArcadeCabinet } from './MachineScreen';
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  customFetch,
  ApiError,
  getGetPlayerBootstrapQueryKey,
  type PlayerBootstrap,
} from "@workspace/api-client-react";
import {
  STOCKZ_DAILY_LIMIT,
  STOCKZ_STAKES,
  STOCKZ_TICKERS,
  type StockzState,
} from "@workspace/squabblemon-engine/accountRewards";
import { FadecadeDialog } from "./FadecadeDialog";
import "../../styles/stockz.css";

export function StockzMachine({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const [open, setOpen] = useState(false),
    [ticker, setTicker] = useState<string>("DURG"),
    [direction, setDirection] = useState<"up" | "down">("up"),
    [stake, setStake] = useState(25);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [clock, setClock] = useState(Date.now());
  const requestId = useRef<string | null>(null);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["stockz", bootstrap.profile.id],
    queryFn: () => customFetch<StockzState>("/api/player/stockz"),
    enabled: open,
    retry: 1,
  });
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setClock(Date.now()), 250);
    return () => clearInterval(timer);
  }, [open]);
  const active = query.data?.active;
  const seconds = active
    ? Math.max(0, Math.ceil((Date.parse(active.closesAt) - clock) / 1000))
    : 0;
  async function trade(action: "start" | "settle") {
    if (busy) return;
    setBusy(true);
    setError("");
    requestId.current ??= crypto.randomUUID();
    try {
      const result = await customFetch<StockzState>(
        `/api/player/stockz/${action}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            action === "start"
              ? { id: requestId.current, ticker, direction, stake }
              : { id: active?.id },
          ),
        },
      );
      client.setQueryData(["stockz", bootstrap.profile.id], result);
      requestId.current = null;
      void client.invalidateQueries({
        queryKey: getGetPlayerBootstrapQueryKey(),
      });
    } catch (err) {
      const detail =
        err instanceof ApiError ? (err.data as { error?: string }) : null;
      setError(
        detail?.error ??
          "Could not confirm the trade. Retry with the same choices, or refresh the market.",
      );
      void query.refetch();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fadecade-machine-group stockz-machine">
      <ArcadeCabinet artUrl="assets/fadecade/stockz-screen.webp" aspectRatio={1458 / 1079}
        aperture={{ left: '17%', top: '30%', width: '66%', height: '50%' }}
        testId="fadecade-stockz" className="machine-small stockz-screen">
        <div className="stockz-attract">
          <div className="stockz-attract-heading"><span>MARKET PREVIEW</span><strong>UP OR DOWN?</strong></div>
          <svg className="stockz-attract-chart" viewBox="0 0 300 85" preserveAspectRatio="none" aria-hidden="true">
            <path className="stockz-chart-grid" d="M0 20H300M0 42H300M0 64H300M40 0V85M95 0V85M150 0V85M205 0V85M260 0V85" />
            <path className="stockz-chart-area" d="M0 72L25 60 49 66 75 36 99 46 125 24 153 40 177 29 202 44 229 17 253 26 277 9 300 18V85H0Z" />
            <g className="stockz-chart-candles">
              <path d="M25 47V76M75 23V58M125 11V43M177 17V53M229 6V34M277 0V28" />
              <path className="stockz-chart-down" d="M49 50V77M99 31V58M153 27V55M202 28V59M253 13V40" />
            </g>
            <path className="stockz-chart-line" d="M0 72L25 60 49 66 75 36 99 46 125 24 153 40 177 29 202 44 229 17 253 26 277 9 300 18" />
            <circle className="stockz-chart-dot" cx="277" cy="9" r="4" />
          </svg>
          <button className="cabinet-btn" aria-expanded={open} aria-controls="stockz-setup" onClick={() => setOpen(true)}>
            Play Stockz <span aria-hidden="true">↗</span>
          </button>
        </div>
      </ArcadeCabinet>
      <FadecadeDialog
        open={open}
        onOpenChange={setOpen}
        title="Stockz · Clout Exchange"
        kind="events"
      >
        <div className="stockz-panel" id="stockz-setup">
          <p>
            Pick a fictional stock. Call up or down at the closing bell. A
            correct call returns 2× your stake, including the stake; a miss
            loses it.
          </p>
          <small>
            In-game Clout only · no cash value · 50/50 direction ·{" "}
            {STOCKZ_DAILY_LIMIT} trades a day
          </small>
          {query.isPending && <p role="status">Opening the market…</p>}
          {query.isError && (
            <button
              className="cabinet-btn"
              onClick={() => void query.refetch()}
            >
              Retry market connection
            </button>
          )}
          {query.data && (
            <>
              <div className="stockz-balance">
                {bootstrap.profile.softCurrency.toLocaleString()} Clout{" "}
                <span>
                  {query.data.roundsToday}/{STOCKZ_DAILY_LIMIT} trades today
                </span>
              </div>
              {active ? (
                <div className="stockz-active" role="status">
                  <span>TRADE LOCKED</span>
                  <h3>
                    {active.ticker} · {active.direction.toUpperCase()}
                  </h3>
                  <p>
                    {active.stake} Clout at {active.openPrice}
                  </p>
                  <strong>{seconds ? `${seconds}s` : "Closing bell!"}</strong>
                  <button
                    className="cabinet-btn"
                    disabled={seconds > 0 || busy}
                    onClick={() => void trade("settle")}
                  >
                    {busy ? "Settling…" : "Reveal closing price"}
                  </button>
                  <small>Your trade stays saved if you leave.</small>
                </div>
              ) : (
                <>
                  <fieldset disabled={busy}>
                    <legend>Choose your company</legend>
                    <div className="stockz-companies">
                      {STOCKZ_TICKERS.map((stock) => (
                        <button
                          key={stock.id}
                          aria-pressed={ticker === stock.id}
                          onClick={() => {
                            setTicker(stock.id);
                            requestId.current = null;
                          }}
                        >
                          <strong>{stock.id}</strong>
                          <span>{stock.name}</span>
                          <b>{stock.price}</b>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset disabled={busy}>
                    <legend>Your call</legend>
                    <div className="stockz-choices">
                      {(["up", "down"] as const).map((value) => (
                        <button
                          key={value}
                          aria-pressed={direction === value}
                          onClick={() => {
                            setDirection(value);
                            requestId.current = null;
                          }}
                        >
                          {value === "up" ? "↗ Up" : "↘ Down"}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <label>
                    Stake
                    <select
                      className="cabinet-select"
                      disabled={busy}
                      value={stake}
                      onChange={(e) => {
                        setStake(Number(e.target.value));
                        requestId.current = null;
                      }}
                    >
                      {STOCKZ_STAKES.map((amount) => (
                        <option key={amount} value={amount}>
                          {amount} Clout
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="cabinet-btn"
                    disabled={
                      busy ||
                      query.data.roundsToday >= STOCKZ_DAILY_LIMIT ||
                      bootstrap.profile.softCurrency < stake
                    }
                    onClick={() => void trade("start")}
                  >
                    {busy
                      ? "Saving trade…"
                      : query.data.roundsToday >= STOCKZ_DAILY_LIMIT
                        ? "Back tomorrow · 00:00 UTC"
                        : `Bet ${stake} Clout`}
                  </button>
                </>
              )}
              {query.data.recent.length > 0 && (
                <div className="stockz-history">
                  <h4>Trade receipts</h4>
                  {query.data.recent.map((round) => (
                    <p key={round.id}>
                      <b>
                        {round.ticker} {round.direction} · {round.openPrice} →{" "}
                        {round.closePrice}
                      </b>
                      <span>
                        {round.payout
                          ? `+${round.payout - round.stake}`
                          : `−${round.stake}`}{" "}
                        Clout net
                      </span>
                    </p>
                  ))}
                </div>
              )}
            </>
          )}
          {error && <p role="alert">{error}</p>}
        </div>
      </FadecadeDialog>
    </div>
  );
}
