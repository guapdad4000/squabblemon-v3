import { useEffect, useRef, useState } from "react";
import { useSearch } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  customFetch,
  getGetPlayerBootstrapQueryKey,
  type PlayerBootstrap,
} from "@workspace/api-client-react";
import type {
  JohnHenryMythicStatus,
} from "@workspace/squabblemon-engine/johnHenryMythic";
import { getAssetUrl } from "../lib/assets";
import { createDeferredComponent } from '../lib/deferredComponent';
import { useDeferredPopup } from './useDeferredPopup';
import "../styles/john-henry-mythic.css";
const johnHenryDialog = createDeferredComponent('JohnHenryDialogContent', 'JohnHenryDialogContent', () => import('./JohnHenryDialogContent'));
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
  const { Component: DialogContent, failed: dialogFailed, preload: preloadDialog } = useDeferredPopup(johnHenryDialog, open);
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
            onPointerEnter={preloadDialog}
            onFocus={preloadDialog}
            onPointerDown={preloadDialog}
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
          onPointerEnter={preloadDialog}
          onFocus={preloadDialog}
          onPointerDown={preloadDialog}
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
        <button
          className="john-henry-roadmap__close"
          aria-label="Close Steel Driver"
          onClick={() => setOpen(false)}
        >
          ×
        </button>
        {DialogContent ? <DialogContent placement={placement} status={status} isPending={query.isPending} isError={query.isError} retry={() => { void query.refetch(); }} receipt={receipt} error={error} busy={busy} claim={claim} close={() => setOpen(false)} /> : <div className="john-henry-roadmap__copy">
          <h2 id={`john-henry-title-${placement}`}>Steel Driver</h2>
          <p role={dialogFailed ? 'alert' : 'status'}>{dialogFailed ? 'Couldn’t open the roadmap. Try again.' : 'Opening your roadmap…'}</p>
          {dialogFailed && <button type="button" onClick={preloadDialog}>Retry</button>}
        </div>}
      </dialog>
    </>
  );
}
