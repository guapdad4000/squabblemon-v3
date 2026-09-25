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
      <div className="stockz-cabinet">
        <span>THE CLOUT EXCHANGE</span>
        <h3>
          STOCKZ<span>↗</span>
        </h3>
        <svg viewBox="0 0 250 60" aria-hidden="true">
          <path d="M0 50L30 39 48 46 75 18 95 30 116 12 144 27 170 11 191 17 220 3 250 12" />
        </svg>
        <button className="cabinet-btn" onClick={() => setOpen(true)}>
          Play Stockz
        </button>
      </div>
      <FadecadeDialog
        open={open}
        onOpenChange={setOpen}
        title="Stockz · Clout Exchange"
        kind="events"
      >
        <div className="stockz-panel">
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
