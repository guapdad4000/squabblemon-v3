import { PropArt } from '../../components/venue/PropArt';
import { GameGlyph } from '../../components/venue/GameGlyph';
import { ProgressRing } from '../../components/venue/ProgressRing';
import { CombatSprite } from '../../components/BattleArt';
import { useLocation, useSearch } from 'wouter';
import { Market } from './Market';
import '../../styles/market.css';
import '../../styles/gacha-stage.css';
import { useEffect, useRef, useState } from 'react';
import {
  getGetPlayerBootstrapQueryKey,
  useOpenPlayerPack,
  type PackOpening,
  type PackReward,
  type PlayerBootstrap,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, History, Info, Volume2, VolumeX, X } from 'lucide-react';
import { cardCatalog, catalogCardById, CARD_RARITY_DEFINITIONS, type CardRarity } from '../../data';
import { CardView } from '../../components/CardView';
import { SceneFrame, sendScene } from '../../components/venue/SceneFrame';
import { e2eAuthEnabled } from '../../lib/auth';
import {
  finishPackOpening,
  loadPackOpening,
  loadPackRequest,
  reservePackRequest,
  savePackOpening,
  type PendingPackRequest,
} from '../../lib/packJournal';

type Phase = 'idle' | 'requesting' | 'punching' | 'tenPunching' | 'knockout' | 'tenKnockout' | 'reveal' | 'summary';
type Payment = 'softCurrency' | 'ticket';
type PullSize = 1 | 10;

// Pacing knobs. Single-pack: 12 hits to break the bag. Ten-pull: 30 hits,
// three per click, so the puncher feels like they're dismantling the bag
// in waves. The bag scene messages `hit` with a numeric count; we map that
// to the combo progress in the ringside HUD.
const HITS_PER_PULL: Record<PullSize, number> = { 1: 12, 10: 30 };
const HITS_PER_CLICK: Record<PullSize, number> = { 1: 1, 10: 3 };
// Stage messaging to the bag scene for what kind of beat just landed. The
// scene file can choose its own response, but a strong ten-pull hit gets
// labelled so the visual upgrade is unambiguous.
type ScenePunchMessage = { type: 'punch'; intensity?: 'normal' | 'heavy' };

const resourceName = (reward: PackReward) =>
  reward.kind === 'styleShards' ? 'Style shards' : reward.kind === 'softCurrency' ? 'Clout' : (reward.name ?? 'Card');

// Find the index of the rarest reward (≥ Rare) in a haul. Used to badge the
// "GUARANTEED RARE" reward on the ten-pull reveal. Returns -1 if none —
// callers should still render the haul but skip the highlight.
function indexOfRarestReward(rewards: readonly PackReward[]): number {
  const rarityRank: Record<string, number> = { Rare: 1, Epic: 2, Legendary: 3, Mythical: 4 };
  let bestIndex = -1;
  let bestRank = 0;
  for (let i = 0; i < rewards.length; i++) {
    const rarity = rewards[i].rarity ?? '';
    const rank = rarityRank[rarity] ?? 0;
    if (rank > bestRank) {
      bestRank = rank;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function RewardCard({ reward, large = false }: { reward: PackReward; large?: boolean }) {
  const card = reward.cardId ? catalogCardById[reward.cardId] : undefined;
  return (
    <div className={`gym-reward ${large ? 'gym-reward--large' : ''}`} data-rarity={reward.rarity?.toLowerCase()}>
      {card && (reward.kind === 'card' || reward.kind === 'variant') ? (
        <CardView
          card={card}
          variantId={reward.variantId ?? undefined}
          isInspector={large}
          fillContainer
          presentationOnly
          inspectable
          disableLayout
          className="w-full"
        />
      ) : (
        <div className="gym-reward__resource">
          <GameGlyph name={reward.kind === 'styleShards' ? 'shards' : 'clout'} />
          <strong>+{reward.amount}</strong>
          <span>{resourceName(reward)}</span>
          {card && <small>Duplicate: {card.name}</small>}
        </div>
      )}
      {reward.isNew && reward.kind !== 'variant' && <span className="gym-reward__new">NEW FIND</span>}
      {reward.kind === 'variant' && <span className="gym-reward__new">STYLE UNLOCKED</span>}
    </div>
  );
}

function PackGym({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const queryClient = useQueryClient();
  const openPack = useOpenPlayerPack();
  const frame = useRef<HTMLIFrameElement>(null);
  const arena = useRef<HTMLDivElement>(null);
  const rewardDialog = useRef<HTMLDialogElement>(null);
  const infoDialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const rushTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const preview = e2eAuthEnabled && bootstrap.profile.id === 'e2e-player';
  const [pending, setPending] = useState<PendingPackRequest | null>(() =>
    loadPackRequest(sessionStorage, bootstrap.profile.id),
  );
  const [opening, setOpening] = useState<PackOpening | null>(() =>
    loadPackOpening(sessionStorage, bootstrap.profile.id),
  );
  const [phase, setPhase] = useState<Phase>(() =>
    loadPackOpening(sessionStorage, bootstrap.profile.id)?.rewards?.length ? 'summary' : 'idle',
  );
  const [pullSize, setPullSize] = useState<PullSize>(1);
  const [hits, setHits] = useState(0);
  const [revealIndex, setRevealIndex] = useState(0);
  const [sound, setSound] = useState(false);
  const [rush, setRush] = useState(false);
  const [info, setInfo] = useState<'odds' | 'history'>('odds');
  const [error, setError] = useState<string | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [systemReduced, setSystemReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const reduced = bootstrap.profile.settings.reducedMotion || systemReduced;
  const rewards = Array.isArray(opening?.rewards) ? opening.rewards : [];
  const isTenPull = pullSize === 10;
  const isPunching = phase === 'punching' || phase === 'tenPunching';
  const hitCap = HITS_PER_PULL[pullSize];
  const hitsPerClick = HITS_PER_CLICK[pullSize];
  const rareHighlightIndex = isTenPull ? indexOfRarestReward(rewards) : -1;

  useEffect(() => {
    mounted.current = true;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemReduced(preference.matches);
    preference.addEventListener('change', update);
    return () => {
      mounted.current = false;
      preference.removeEventListener('change', update);
      if (rushTimer.current) clearInterval(rushTimer.current);
    };
  }, []);
  useEffect(() => {
    sendScene(frame, { type: 'settings', reducedMotion: reduced, sound });
  }, [reduced, sound]);
  useEffect(() => {
    if (phase === 'reveal' || phase === 'summary') {
      if (!rewardDialog.current?.open) rewardDialog.current?.showModal();
    } else rewardDialog.current?.close();
    if (!isPunching) {
      if (rushTimer.current) clearInterval(rushTimer.current);
      rushTimer.current = null;
      setRush(false);
    }
  }, [phase, isPunching]);
  useEffect(() => {
    if (reduced && isPunching) setPhase('summary');
  }, [reduced, isPunching]);
  useEffect(() => {
    if (phase !== 'knockout' && phase !== 'tenKnockout') return;
    const timeout = window.setTimeout(() => setPhase(reduced ? 'summary' : 'reveal'), reduced ? 0 : 850);
    return () => clearTimeout(timeout);
  }, [phase, reduced]);

  const reveal = () => {
    sendScene(frame, { type: 'reset' });
    setPhase(reduced ? 'summary' : 'reveal');
  };
  const handleOpen = async (method: Payment, size: PullSize = 1) => {
    if (busy.current || phase !== 'idle') return;
    const payment = pending?.paymentMethod ?? method;
    const tier = size === 10 ? bootstrap.tenPullConfig : bootstrap.packConfig;
    const cost = payment === 'ticket' ? tier.ticketCost : tier.softCurrencyCost;
    const balance = payment === 'ticket' ? bootstrap.profile.packTickets : bootstrap.profile.softCurrency;
    if (!pending && balance < cost) return;
    busy.current = true;
    setPullSize(size);
    setPhase('requesting');
    setError(null);
    setHits(0);
    setRevealIndex(0);
    try {
      const request = reservePackRequest(sessionStorage, bootstrap.profile.id, payment, () => crypto.randomUUID());
      const nextRequest: PendingPackRequest = { ...request, pullCount: size };
      setPending(nextRequest);
      let result: PackOpening;
      if (preview) {
        // Curated visual fixtures, never a substitute for the server's reward RNG or odds.
        const cards = ['bodega-cat', 'leroy', 'og-dominican', 'big-zoey', 'crossing-guard']
          .map(id => catalogCardById[id]);
        const repeat = size === 10 ? Array.from({ length: 10 }) : [null];
        const baseCards = repeat.flatMap(() =>
          cards.map((card) => ({
            kind: 'card' as const,
            cardId: card.catalogId,
            variantId: null,
            name: card.name,
            rarity: card.rarity,
            isNew: true,
            amount: 1,
          })),
        );
        const bonusRewards = repeat.map(() => ({
          kind: 'styleShards' as const,
          cardId: null,
          variantId: null,
          name: 'Style shards',
          rarity: null,
          isNew: false,
          amount: 25,
        }));
        result = {
          id: request.idempotencyKey,
          oddsVersion: size === 10 ? 'street-pack-ten-v1' : 'preview',
          paymentMethod: payment,
          cost,
          pullCount: size,
          pityBefore: 0,
          pityAfter: 0,
          createdAt: new Date().toISOString(),
          rewards: [...baseCards, ...bonusRewards],
        };
        queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), {
          ...bootstrap,
          profile: {
            ...bootstrap.profile,
            packTickets: bootstrap.profile.packTickets - (payment === 'ticket' ? cost : 0),
            softCurrency: bootstrap.profile.softCurrency - (payment === 'softCurrency' ? cost : 0),
            packHistory: [result, ...bootstrap.profile.packHistory],
          },
        });
      } else {
        const response = await openPack.mutateAsync({
          data: { ...nextRequest },
        });
        if (!response?.opening?.rewards?.length || !response.bootstrap?.profile)
          throw new Error('Invalid pack response');
        result = response.opening;
        queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), response.bootstrap);
      }
      // Keep the awarded reveal resumable across refreshes; retries use the same payment intent.
      savePackOpening(sessionStorage, bootstrap.profile.id, result);
      if (!mounted.current) return;
      setPending(null);
      setOpening(result);
      if (reduced || !sceneReady) setPhase('summary');
      else {
        sendScene(frame, { type: 'arm' });
        setPhase(size === 10 ? 'tenPunching' : 'punching');
        if (window.matchMedia('(max-width: 760px)').matches)
          arena.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    } catch {
      if (mounted.current) {
        setError(
          'The opening could not be confirmed. Retry this opening to recover the result; it will use the same request.',
        );
        setPhase('idle');
      }
    } finally {
      busy.current = false;
    }
  };
  function finish() {
    finishPackOpening(sessionStorage, bootstrap.profile.id);
    setOpening(null);
    setPhase('idle');
    setHits(0);
    setPullSize(1);
    sendScene(frame, { type: 'reset' });
  }
  function toggleRush() {
    if (rushTimer.current) {
      clearInterval(rushTimer.current);
      rushTimer.current = null;
      setRush(false);
      return;
    }
    setRush(true);
    sendScene(frame, { type: 'punch' } satisfies ScenePunchMessage);
    // The 10-pull's auto-rush tempo is faster than the single pack's. Three
    // hits per tick keeps the bag "dismantling" feel rather than a slow
    // metronome of single punches.
    rushTimer.current = setInterval(
      () => sendScene(frame, { type: 'punch' } satisfies ScenePunchMessage),
      isTenPull ? 180 : 260,
    );
  }
  const showInfo = (tab: 'odds' | 'history') => {
    setInfo(tab);
    infoDialog.current?.showModal();
  };

  return (
    <div
      className="gym venue-page studio-page gacha-stage"
      data-phase={phase}
      data-pull-size={pullSize}
      data-reduced-motion={reduced}
    >
      <div className="gym__arena" ref={arena}>
        <SceneFrame
          kind="gym"
          frameRef={frame}
          onReady={() => {
            setSceneReady(true);
            sendScene(frame, { type: 'settings', reducedMotion: reduced, sound });
          }}
          onMessage={(message) => {
            if (message.type === 'hit') setHits(message.hits ?? 0);
            if (message.type === 'complete' && isPunching)
              setPhase(pullSize === 10 ? 'tenKnockout' : 'knockout');
            if (message.type === 'error') setSceneReady(false);
          }}
        />
        <div className="gym__vignette" />
      </div>
      <header className="gacha-stage__heading">
        <span className="studio-eyebrow">
          <GameGlyph name="pack" /> The pack gym · Street edition
        </span>
        <h1>
          {isPunching && isTenPull ? (
            <>
              Ten on the
              <br />
              <em>bag.</em>
            </>
          ) : (
            <>
              Your next
              <br />
              <em>heavy hitter.</em>
            </>
          )}
        </h1>
        <p>
          {isPunching && isTenPull ? (
            <>
              Combo the bag.
              <br />
              Sixty cards in one KO.
            </>
          ) : (
            <>
              Step up. Break the bag.
              <br />
              Meet your next crew member.
            </>
          )}
        </p>
      </header>
      <button
        className="studio-icon gacha-stage__sound"
        aria-label={sound ? 'Mute gym sound' : 'Enable gym sound'}
        aria-pressed={sound}
        onClick={() => setSound(!sound)}
        title={sound ? 'Sound on' : 'Sound off'}
      >
        {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
      </button>
      <aside className="gym__offer" aria-label="Open a pack">
        <div className="gacha-stage__pack">
          <PropArt id="foil-pack" />
          <div>
            <span className="studio-eyebrow">{isTenPull ? 'The upgraded drop' : 'The drop'}</span>
            <h2>
              {preview
                ? isTenPull
                  ? 'Street pack · 10x'
                  : 'Street pack'
                : isTenPull
                  ? bootstrap.tenPullConfig.name
                  : bootstrap.packConfig.name}
            </h2>
            <p>
              {isTenPull
                ? `${bootstrap.tenPullConfig.rewardsPerPull} rewards. One KO. Rare+ guaranteed.`
                : bootstrap.packConfig.rewardsPerPack === 6
                  ? '5 card pulls + 1 bonus. Same street price.'
                  : `${bootstrap.packConfig.rewardsPerPack} rewards. One knockout.`}
            </p>
          </div>
        </div>
        {preview ? (
          <p className="gacha-stage__preview">Preview drop · Sample rewards. Nothing saved to an account.</p>
        ) : (
          <div className="gacha-stage__guarantee">
            <ProgressRing
              value={bootstrap.profile.packPity}
              max={bootstrap.packConfig.pityLimit}
              label="Pack guarantee progress"
            />
            <div>
              <strong>{isTenPull ? '10-Pull guarantee · Rare+' : 'Guarantee tracker'}</strong>
              <span>
                {isTenPull
                  ? 'At least one Rare+ in every ten-pull haul.'
                  : `${bootstrap.profile.packPity} of ${bootstrap.packConfig.pityLimit} · `}
                {!isTenPull && (
                  <button onClick={() => showInfo('odds')}>View drop rates</button>
                )}
              </span>
            </div>
          </div>
        )}
        <p className="gacha-stage__duplicates">
          <GameGlyph name="shards" /> Duplicates become Style Shards.
        </p>
        <div className="gym__actions">
          {isPunching ? (
            <div className="gacha-stage__secured">
              <Check size={16} />
              <span>
                {preview ? 'Preview loaded.' : 'Your rewards are secured.'}
                <small>{isTenPull ? 'Sixty cards. Head to the bag to reveal them.' : 'Head to the bag to reveal them.'}</small>
              </span>
            </div>
          ) : (
            <>
              <span className="studio-eyebrow">{pending ? 'Recover your opening' : 'Choose your opening'}</span>
              <div className="gacha-stage__payments">
                {/* Single-pack CTA. Costs 1 ticket (or 200 Clout). */}
                {(['ticket', 'softCurrency'] as const).map((method) => {
                  const ticket = method === 'ticket';
                  const cost = ticket ? bootstrap.packConfig.ticketCost : bootstrap.packConfig.softCurrencyCost;
                  const balance = ticket ? bootstrap.profile.packTickets : bootstrap.profile.softCurrency;
                  const affordable = balance >= cost;
                  if (pending && pending.paymentMethod !== method) return null;
                  return (
                    <div className="gacha-stage__payment" key={method} data-pull="single">
                      <button
                        className={`studio-action ${ticket ? 'studio-action--gold' : ''}`}
                        disabled={phase !== 'idle' || (!affordable && !pending)}
                        onClick={() => void handleOpen(method, 1)}
                      >
                        <GameGlyph name={ticket ? 'ticket' : 'clout'} />
                        <span>
                          {phase === 'requesting'
                            ? 'Securing your drop…'
                            : pending
                              ? 'Retry this opening'
                              : `Open · ${cost} ${ticket ? (cost === 1 ? 'ticket' : 'tickets') : 'Clout'}`}
                        </span>
                        <ArrowRight size={16} />
                      </button>
                      <small>
                        {balance.toLocaleString()} {ticket ? 'tickets' : 'Clout'} available
                      </small>
                    </div>
                  );
                })}
                {/* Ten-pull CTA. Costs 10 tickets (or 1,800 Clout) and unlocks the
                    upgraded punching-bag animation + the 6×10 reveal grid with the
                    guaranteed Rare+ highlight. */}
                {(['ticket', 'softCurrency'] as const).map((method) => {
                  const ticket = method === 'ticket';
                  const tier = bootstrap.tenPullConfig;
                  const cost = ticket ? tier.ticketCost : tier.softCurrencyCost;
                  const balance = ticket ? bootstrap.profile.packTickets : bootstrap.profile.softCurrency;
                  const affordable = balance >= cost;
                  if (pending && pending.paymentMethod !== method) return null;
                  return (
                    <div className="gacha-stage__payment gacha-stage__payment--ten" key={`ten-${method}`} data-pull="ten">
                      <button
                        className={`studio-action studio-action--ten ${ticket ? 'studio-action--gold' : ''}`}
                        disabled={phase !== 'idle' || (!affordable && !pending)}
                        onClick={() => void handleOpen(method, 10)}
                      >
                        <GameGlyph name={ticket ? 'ticket' : 'clout'} />
                        <span>
                          {phase === 'requesting'
                            ? 'Securing your 10…'
                              : pending
                                ? 'Retry this 10-pull'
                                : `Open 10× · ${cost} ${ticket ? 'tickets' : 'Clout'}`}
                        </span>
                        <ArrowRight size={16} />
                      </button>
                      <small>
                        <span className="gacha-stage__payment-tag">UPGRADED · RARE+ GUARANTEED</span>
                        {' · '}
                        {balance.toLocaleString()} {ticket ? 'tickets' : 'Clout'} available
                      </small>
                    </div>
                  );
                })}
              </div>
              <small className="gym__payment-note">
                {preview
                  ? 'Uses preview balances only.'
                  : 'Punching never changes the odds. Ten-pull guarantees at least one Rare+.'}
              </small>
            </>
          )}
        </div>
        {error && (
          <p className="studio-notice" role="alert">
            {error}
          </p>
        )}
        <div className="gym__links">
          <button className="studio-text-action" onClick={() => showInfo('odds')}>
            <Info size={15} /> Drop rates
          </button>
          <button className="studio-text-action" onClick={() => showInfo('history')}>
            <History size={15} /> Your openings
          </button>
        </div>
      </aside>
      <div className="gacha-stage__ringside">
        {isPunching ? (
          <>
            <div className="gacha-stage__combo" aria-live="polite">
              <ProgressRing value={hits} max={hitCap} label="Hits to reveal">
                <strong>{String(hits).padStart(2, '0')}</strong>
              </ProgressRing>
              <div>
                <strong>
                  {isTenPull
                    ? hits >= Math.floor(hitCap * 0.75)
                      ? 'Finish it.'
                      : hits >= Math.floor(hitCap * 0.4)
                        ? 'Keep that energy.'
                        : 'Triple combo, keep it rolling.'
                    : hits >= 9
                      ? 'Finish it.'
                      : hits >= 5
                        ? 'Keep that energy.'
                        : 'Make some noise.'}
                </strong>
                <span>
                  {hits} of {hitCap} hits ·{' '}
                  {isTenPull ? 'Triple combo lands three at once' : 'The drop is yours'}
                </span>
              </div>
            </div>
            <div className="gacha-stage__punch-actions">
              <button
                className="studio-action studio-action--gold"
                disabled={!sceneReady}
                onClick={() => sendScene(frame, { type: 'punch' } satisfies ScenePunchMessage)}
              >
                <GameGlyph name="fight" />
                {isTenPull ? 'Triple-combo punch' : 'Punch the bag'}
                <small>+{hitsPerClick}</small>
              </button>
              <button className="studio-action" disabled={!sceneReady} aria-pressed={rush} onClick={toggleRush}>
                {rush ? 'Pause rush' : 'Auto rush'}
              </button>
            </div>
            <button className="studio-text-action" onClick={reveal}>
              {isTenPull ? 'Skip to 10× reveal' : 'Skip animation & reveal'} <ArrowRight size={14} />
            </button>
          </>
        ) : (
          phase === 'idle' && (
            <div className="gacha-stage__ready">
              <GameGlyph name="fight" />
              <span>
                {isTenPull
                  ? `Ten packs. ${hitCap} hits. Triple-combo each click.`
                  : `One pack. ${hitCap} hits.`}
                <small>Open a pack to step into the ring.</small>
              </span>
            </div>
          )
        )}
      </div>
      {(phase === 'knockout' || phase === 'tenKnockout') && (
        <div className="gacha-stage__knockout" data-pull-size={pullSize} role="status">
          <CombatSprite asset="fight-start-burst" />
          <span>{isTenPull ? 'Ten-pack unleashed' : 'Pack unleashed'}</span>
          <strong>{isTenPull ? 'K.O. ×10' : 'K.O.'}</strong>
          <small>{isTenPull ? 'The whole block felt that.' : 'The block felt that.'}</small>
        </div>
      )}
      <dialog
        ref={rewardDialog}
        className="gym-results studio-results gacha-results"
        data-pull-size={pullSize}
        aria-labelledby="gym-results-title"
        onCancel={(e) => {
          e.preventDefault();
          finish();
        }}
      >
        <div className="gym-results__header">
          <span className="studio-eyebrow">
            {isTenPull
              ? preview
                ? 'Preview 10× · Not saved'
                : 'The 10-bag delivered'
              : preview
                ? 'Preview drop · Not saved'
                : 'The bag delivered'}
          </span>
          <button className="studio-icon" aria-label="Close rewards" onClick={finish}>
            <X size={20} />
          </button>
        </div>
        <GameGlyph name="pack" className="gacha-results__emblem" />
        <h2 id="gym-results-title">
          {phase === 'reveal' ? 'Look who showed up.' : isTenPull ? 'Meet the 10× haul.' : 'Meet the haul.'}
        </h2>
        <p>
          {phase === 'reveal'
            ? `Reward ${revealIndex + 1} of ${rewards.length}`
            : preview
              ? 'A taste of the drop. Your real collection is unchanged.'
              : isTenPull
                ? 'Ten packs. Sixty rewards. One guaranteed Rare+ — find it highlighted.'
                : 'Added to your collection. Now put them to work.'}
        </p>
        {phase === 'reveal' && rewards[revealIndex] ? (
          <div className="gym-results__single">
            <RewardCard
              key={revealIndex}
              reward={rewards[revealIndex]}
              large
            />
            <h3>{rewards[revealIndex].name ?? resourceName(rewards[revealIndex])}</h3>
            <span className="studio-eyebrow">
              {CARD_RARITY_DEFINITIONS[rewards[revealIndex].rarity as CardRarity]?.label ?? 'Currency'}
              {isTenPull && revealIndex === rareHighlightIndex && (
                <span className="gacha-results__badge"> · GUARANTEED RARE+</span>
              )}
            </span>
          </div>
        ) : (
          <div
            className={`gym-results__grid${isTenPull ? ' gym-results__grid--ten' : ''}`}
            data-pull-size={pullSize}
          >
            {rewards.map((reward, i) => (
              <button
                key={i}
                className={`gym-results__item${isTenPull && i === rareHighlightIndex ? ' gym-results__item--rare' : ''}`}
                aria-label={`Inspect ${reward.name ?? resourceName(reward)}`}
                onClick={() => {
                  setRevealIndex(i);
                  setPhase('reveal');
                }}
              >
                <RewardCard reward={reward} />
                <strong>{reward.name ?? resourceName(reward)}</strong>
                <small>
                  {CARD_RARITY_DEFINITIONS[reward.rarity as CardRarity]?.label ?? `+${reward.amount}`}
                  {isTenPull && i === rareHighlightIndex && (
                    <span className="gacha-results__badge"> · GUARANTEED</span>
                  )}
                </small>
              </button>
            ))}
          </div>
        )}
        <div className="gym-results__actions">
          {phase === 'reveal' ? (
            <>
              <button
                className="studio-action studio-action--gold"
                onClick={() => {
                  if (revealIndex + 1 < rewards.length) setRevealIndex(revealIndex + 1);
                  else setPhase('summary');
                }}
              >
                {revealIndex + 1 < rewards.length ? 'Next reward' : 'View the haul'}
                <ArrowRight size={18} />
              </button>
              <button className="studio-text-action" onClick={() => setPhase('summary')}>
                Reveal all
              </button>
            </>
          ) : (
            <button className="studio-action studio-action--gold" onClick={finish}>
              {isTenPull ? 'Back to gacha · 10× earned' : 'Back to gacha'}
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      </dialog>
      <dialog
        ref={infoDialog}
        className="venue-info studio-results gacha-info"
        aria-labelledby="gym-info-title"
        onClick={(e) => {
          if (e.target === infoDialog.current) infoDialog.current.close();
        }}
      >
        <header>
          <div>
            <span className="studio-eyebrow">Know your drop</span>
            <h2 id="gym-info-title">{info === 'odds' ? 'The odds.' : 'Your openings.'}</h2>
          </div>
          <button
            className="studio-icon"
            aria-label="Close pack information"
            onClick={() => infoDialog.current?.close()}
          >
            <X size={20} />
          </button>
        </header>
        {info === 'odds' ? (
          <>
            {preview ? (
              <p>
                Local preview uses curated sample rewards to test the reveal. Live drop rates and guarantees come from
                your connected account.
              </p>
            ) : (
              <>
                <p>Punches are for the presentation. Your rewards are decided by the pack system when you open.</p>
                <div className="gym-odds">
                  {bootstrap.packConfig.odds.map((odd, i) => (
                    <div key={i}>
                      <span>
                        <strong>{odd.label}</strong>
                        <small>{odd.detail}</small>
                      </span>
                      <b>{odd.chance}%</b>
                    </div>
                  ))}
                </div>
                <p className="gacha-info__version">
                  Odds version {bootstrap.packConfig.oddsVersion} · Guarantee limit {bootstrap.packConfig.pityLimit}
                </p>
              </>
            )}
          </>
        ) : bootstrap.profile.packHistory.length ? (
          <div className="gym-history">
            {bootstrap.profile.packHistory.map((item) => (
              <article key={item.id}>
                <span>{new Date(item.createdAt).toLocaleString()}</span>
                <strong>
                  {item.cost} {item.paymentMethod === 'ticket' ? 'ticket(s)' : 'Clout'}
                </strong>
                <p>{item.rewards.map((r) => r.name ?? resourceName(r)).join(' · ')}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="gacha-info__empty">
            <GameGlyph name="pack" />
            <h3>Your first drop is waiting.</h3>
            <p>Every opening will show up here.</p>
          </div>
        )}
      </dialog>
    </div>
  );
}

export function Shop({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const view = params.get('view');
  const tab =
    view === 'training' || view === 'market' || (view !== 'packs' && (params.has('item') || params.has('card')))
      ? 'market'
      : 'packs';
  function selectTab(next: 'market' | 'packs') {
    const query = new URLSearchParams(search);
    query.set('view', next === 'market' ? 'training' : 'packs');
    navigate(`/game/shop?${query}`);
  }
  return (
    <div className="trading-post">
      <nav className="market-tabs" aria-label="Shop departments">
        <button aria-pressed={tab === 'packs'} onClick={() => selectTab('packs')}>
          <GameGlyph name="pack" />
          Gacha
        </button>
        <button aria-pressed={tab === 'market'} onClick={() => selectTab('market')}>
          <GameGlyph name="motion" />
          Training
        </button>
      </nav>
      {tab === 'market' ? (
        <Market bootstrap={bootstrap} openPacks={() => selectTab('packs')} />
      ) : (
        <PackGym bootstrap={bootstrap} />
      )}
    </div>
  );
}
