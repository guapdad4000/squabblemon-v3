import { useEffect, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  customFetch,
  getGetPlayerBootstrapQueryKey,
  type PlayerBootstrap,
} from "@workspace/api-client-react";
import {
  JOHN_HENRY_MYTHIC,
  type JohnHenryMythicStatus,
} from "@workspace/squabblemon-engine/johnHenryMythic";
import { getAssetUrl } from "../lib/assets";
import { GameGlyph } from "./venue/GameGlyph";
import "../styles/john-henry-mythic.css";
const chapterNames = [
  "The Block",
  "Red Side",
  "Blue Side",
  "Side Show",
  "Old Heads",
  "The Function",
  "Return",
  "The Crown",
];
export function JohnHenryMythic({
  bootstrap,
  placement,
}: {
  bootstrap: PlayerBootstrap;
  placement: "shortcut" | "banner";
}) {
  const client = useQueryClient(),
    profileId = bootstrap.profile.id,
    key = ["john-henry-mythic", profileId];
  const query = useQuery({
    queryKey: key,
    queryFn: () =>
      customFetch<JohnHenryMythicStatus>("/api/player/rewards/john-henry"),
    staleTime: 30000,
    retry: 1,
  });
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [receipt, setReceipt] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    lock = useRef(false),
    activePlayer = useRef(profileId),
    opener = useRef<HTMLElement | null>(null);
  activePlayer.current = profileId;
  useEffect(() => {
    setOpen(false);
    setError("");
    setReceipt("");
    return () => {
      activePlayer.current = "";
    };
  }, [profileId]);
  const search = useSearch();
  useEffect(() => {
    if (
      placement === "banner" &&
      new URLSearchParams(search).get("mythic") === "john-henry"
    )
      setOpen(true);
  }, [placement, search]);
  useEffect(() => {
    if (open) {
      opener.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      if (!dialog.current?.open) dialog.current?.showModal();
    } else {
      dialog.current?.close();
      if (opener.current?.isConnected)
        opener.current.focus({ preventScroll: true });
    }
  }, [open]);
  const status = query.data,
    claimed = status?.state === "claimed",
    ready = status?.state === "ready",
    completed = status?.chapters.filter((c) => c.completed).length ?? 0;
  async function claim() {
    if (lock.current || !ready) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await customFetch<{
        claimed: boolean;
        duplicateShards: number;
        status: JohnHenryMythicStatus;
        bootstrap: PlayerBootstrap;
      }>("/api/player/rewards/john-henry/claim", { method: "POST" });
      if (activePlayer.current !== profileId) return;
      client.setQueryData(key, result.status);
      client.setQueryData(getGetPlayerBootstrapQueryKey(), result.bootstrap);
      setReceipt(
        result.claimed
          ? result.duplicateShards
            ? "Collected: 1,500 Clout, 5 tickets and 50 Style Shards for your duplicate."
            : "John Henry joined your crew. 1,500 Clout and 5 tickets are in your bag."
          : "Already collected. Your saved reward is safe.",
      );
    } catch (reason) {
      if (activePlayer.current === profileId)
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not confirm your reward. Retry.",
        );
    } finally {
      lock.current = false;
      if (activePlayer.current === profileId) setBusy(false);
    }
  }
  const art = getAssetUrl("assets/john-henry-mythic/roadmap.webp");
  return (
    <>
      {placement === "shortcut" ? (
        !claimed && (
          <button
            className="john-henry-shortcut"
            onClick={() => setOpen(true)}
            aria-label={`Steel Driver · ${ready ? "Claim John Henry" : "John Henry roadmap"}`}
          >
            <img
              src={getAssetUrl("assets/characters/john-henry.webp")}
              alt=""
            />
            <span>{ready ? "CLAIM MYTHIC" : "STEEL DRIVER"}</span>
          </button>
        )
      ) : (
        <button
          className="john-henry-banner"
          onClick={() => setOpen(true)}
          style={{ backgroundImage: `url("${art}")` }}
        >
          <span>YOUR NEXT FREE MYTHICAL</span>
          <strong>Steel Driver</strong>
          <small>
            {claimed
              ? "Collected · Yours for good"
              : ready
                ? "John Henry is ready to join your crew"
                : `Complete Season 1 · ${completed}/8 chapters cleared`}
          </small>
        </button>
      )}
      <dialog
        ref={dialog}
        className="john-henry-roadmap"
        aria-labelledby={`john-henry-title-${placement}`}
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
      >
        <img
          className="john-henry-roadmap__art"
          src={art}
          alt="John Henry drives steel through the last stretch of an illuminated railroad"
        />
        <button
          className="john-henry-roadmap__close"
          aria-label="Close Steel Driver"
          onClick={() => setOpen(false)}
        >
          ×
        </button>
        <div className="john-henry-roadmap__copy">
          <span className="john-henry-roadmap__label">ROAD TO MYTHIC / 02</span>
          <span className="john-henry-roadmap__tag">
            EARTH · JOHN HENRY · MYTHICAL
          </span>
          <h2 id={`john-henry-title-${placement}`}>
            Steel
            <br />
            <em>Driver.</em>
          </h2>
          <p>
            Every block. Every battle.
            <br />
            Legends finish what they start.
          </p>
          <span className="john-henry-roadmap__rule">
            Clear all eight Season 1 chapters.
            <br />
            No timer. No login streak.
          </span>
        </div>
        <div className="john-henry-roadmap__ticket">
          <header>
            <strong>THE LAST STRETCH</strong>
            <span>{completed} / 8 CLEARED</span>
          </header>
          {query.isPending ? (
            <p role="status">Checking your campaign…</p>
          ) : query.isError ? (
            <p role="alert">
              Could not load your roadmap.{" "}
              <button onClick={() => void query.refetch()}>Retry</button>
            </p>
          ) : (
            <>
              <ol
                className="john-henry-roadmap__track"
                aria-label="Season 1 chapter roadmap"
              >
                {status?.chapters.map((c, i) => (
                  <li
                    key={c.id}
                    data-complete={c.completed}
                    data-reached={c.reached}
                    aria-label={`Chapter ${i + 1}: ${c.completed ? "cleared" : c.reached ? "available" : "locked"}`}
                  >
                    <b>{c.completed ? "✓" : String(i + 1).padStart(2, "0")}</b>
                    <small>{chapterNames[i]}</small>
                  </li>
                ))}
              </ol>
              <div className="john-henry-roadmap__rewards">
                <div>
                  <img
                    src={getAssetUrl("assets/characters/john-henry.webp")}
                    alt=""
                  />
                  <span>
                    <strong>
                      {status?.ownsCard && !claimed
                        ? "50 Style Shards"
                        : "John Henry"}
                    </strong>
                    <small>
                      {status?.ownsCard && !claimed
                        ? "Duplicate protection"
                        : "Mythical fighter"}
                    </small>
                  </span>
                </div>
                <div>
                  <GameGlyph name="cloutStack" />
                  <span>
                    <strong>1,500</strong>
                    <small>Clout</small>
                  </span>
                </div>
                <div>
                  <GameGlyph name="ticket" />
                  <span>
                    <strong>5</strong>
                    <small>Tickets</small>
                  </span>
                </div>
              </div>
              {receipt && (
                <p role="status" className="john-henry-roadmap__success">
                  {receipt}
                </p>
              )}
              {error && <p role="alert">{error}</p>}
              {claimed ? (
                <Link
                  className="john-henry-roadmap__cta"
                  href="/game/collection?card=john-henry"
                  onClick={() => setOpen(false)}
                >
                  Meet John Henry →
                </Link>
              ) : ready ? (
                <button
                  className="john-henry-roadmap__cta"
                  disabled={busy}
                  onClick={() => void claim()}
                >
                  {busy ? "Saving your Mythical…" : "Claim John Henry →"}
                </button>
              ) : (
                <Link
                  className="john-henry-roadmap__cta"
                  href="/game/story"
                  onClick={() => setOpen(false)}
                >
                  Keep building your legend →
                </Link>
              )}
              <small className="john-henry-roadmap__footnote">
                Permanent. Free once per account. Rewards are saved together.
              </small>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
