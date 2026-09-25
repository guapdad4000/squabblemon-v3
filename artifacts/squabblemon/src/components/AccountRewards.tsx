import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  customFetch,
  getGetPlayerBootstrapQueryKey,
  type PlayerBootstrap,
} from "@workspace/api-client-react";
import {
  LOGIN_REWARDS,
  type AccountRewardStatus,
  type AccountRewardGrant,
} from "@workspace/squabblemon-engine/accountRewards";
import { rewardReceipts, revealProfileRewards } from "../lib/rewardReceipts";
import { DrFadeReferee } from "./DrFadeReferee";
import "../styles/account-rewards.css";

export function AccountRewards({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const queryClient = useQueryClient(),
    dialog = useRef<HTMLDialogElement>(null);
  const query = useQuery({
    queryKey: [
      "account-rewards",
      bootstrap.profile.id,
      bootstrap.profile.level,
    ],
    queryFn: () =>
      customFetch<AccountRewardStatus>("/api/player/rewards/account"),
    staleTime: 60000,
    retry: 1,
  });
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  const status = query.data;
  async function claim() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await customFetch<{
        rewards: AccountRewardGrant[];
        status: AccountRewardStatus;
        bootstrap: PlayerBootstrap;
      }>("/api/player/rewards/account/claim", { method: "POST" });
      queryClient.setQueryData(
        getGetPlayerBootstrapQueryKey(),
        result.bootstrap,
      );
      queryClient.setQueryData(
        ["account-rewards", bootstrap.profile.id, bootstrap.profile.level],
        result.status,
      );
      setOpen(false);
      revealProfileRewards(
        bootstrap,
        result.bootstrap,
        `check-in:${result.status.date}:${result.rewards.map((r) => r.key).join(",")}`,
        result.rewards.some((r) => r.key === "new-player")
          ? "Welcome to the block"
          : "You showed up. It pays.",
      );
    } catch {
      setError(
        "Could not confirm your rewards. Retry to check your saved claim.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button className="account-check-in" onClick={() => setOpen(true)}>
        <span>Daily check-in</span>
        <strong>{status ? `DAY ${status.streak}` : "CLOCK IN"}</strong>
        {!!status?.pending.length && <b>Rewards ready</b>}
      </button>
      <dialog
        ref={dialog}
        className="check-in-dialog referee-clipboard"
        aria-labelledby="check-in-title"
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
      >
        <DrFadeReferee />
        <button
          className="check-in-close"
          aria-label="Close check-in"
          onClick={() => setOpen(false)}
        >
          ×
        </button>
        <span className="studio-eyebrow">SHOW UP FOR YOURSELF</span>
        <h2 id="check-in-title">Keep the streak.</h2>
        <p>
          Check in each day. Every seventh consecutive day pays extra. Reset:
          00:00 UTC.
        </p>
        <ol className="login-streak-days">
          {LOGIN_REWARDS.map((reward, index) => (
            <li
              key={index}
              data-current={!!status && (status.streak - 1) % 7 === index}
            >
              <span>Day {index + 1}</span>
              <strong>{reward.softCurrency}</strong>
              <small>
                Clout
                {reward.packTickets ? ` + ${reward.packTickets} tickets` : ""}
              </small>
            </li>
          ))}
        </ol>
        {query.isPending && <p role="status">Checking your rewards…</p>}
        {query.isError && (
          <button onClick={() => void query.refetch()}>
            Retry reward check
          </button>
        )}
        {status && (
          <>
            <ul className="check-in-pending">
              {status.pending.map((reward) => (
                <li key={reward.key}>
                  <b>{reward.title}</b>
                  <span>
                    +{reward.softCurrency} Clout
                    {reward.packTickets
                      ? ` · ${reward.packTickets} tickets`
                      : ""}
                    {reward.styleShards
                      ? ` · ${reward.styleShards} shards`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
            <button
              className="studio-action"
              disabled={busy || !status.pending.length}
              onClick={() => void claim()}
            >
              {busy
                ? "Saving…"
                : status.pending.length
                  ? "Collect rewards"
                  : "Checked in. See you tomorrow."}
            </button>
          </>
        )}
        {error && <p role="alert">{error}</p>}
        <p className="check-in-footnote">
          Every 10 player levels: 250 Clout, 1 ticket, and 50 Style Shards.
        </p>
      </dialog>
    </>
  );
}

export function PlayerLevelCelebration({
  profile,
}: {
  profile: PlayerBootstrap["profile"];
}) {
  const previous = useRef<{ id: string; level: number } | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      let seen =
        previous.current?.id === profile.id
          ? previous.current.level
          : profile.level;
      if (!previous.current || previous.current.id !== profile.id) {
        try {
          const saved = Number(
            localStorage.getItem(`squabblemon:level-seen:${profile.id}`),
          );
          if (saved > 0) seen = saved;
        } catch {
          /* Cosmetic history is optional. */
        }
      }
      previous.current = { id: profile.id, level: profile.level };
      try {
        localStorage.setItem(
          `squabblemon:level-seen:${profile.id}`,
          String(profile.level),
        );
      } catch {
        /* Cosmetic history is optional. */
      }
      if (profile.level > seen)
        rewardReceipts.show({
          id: `${profile.id}:level:${profile.level}`,
          title: "A level above.",
          level: profile.level,
          items: [{ label: `Player level ${profile.level}`, glyph: "xp" }],
        });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [profile.id, profile.level]);
  return null;
}
