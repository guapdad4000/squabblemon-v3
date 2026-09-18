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

type Phase = 'idle' | 'requesting' | 'punching' | 'knockout' | 'reveal' | 'summary';
type Payment = 'softCurrency' | 'ticket';

const resourceName = (reward: PackReward) =>
  reward.kind === 'styleShards' ? 'Style shards' : reward.kind === 'softCurrency' ? 'Clout' : (reward.name ?? 'Card');

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
    if (phase !== 'punching') {
      if (rushTimer.current) clearInterval(rushTimer.current);
      rushTimer.current = null;
      setRush(false);
    }
  }, [phase]);
  useEffect(() => {
    if (reduced && phase === 'punching') setPhase('summary');
  }, [reduced, phase]);
  useEffect(() => {
    if (phase !== 'knockout') return;
    const timeout = window.setTimeout(() => setPhase(reduced ? 'summary' : 'reveal'), reduced ? 0 : 650);
    return () => clearTimeout(timeout);
  }, [phase, reduced]);

  const reveal = () => {
    sendScene(frame, { type: 'reset' });
    setPhase(reduced ? 'summary' : 'reveal');
  };
  const handleOpen = async (method: Payment) => {
    if (busy.current || phase !== 'idle') return;
    const payment = pending?.paymentMethod ?? method;
    const cost = payment === 'ticket' ? bootstrap.packConfig.ticketCost : bootstrap.packConfig.softCurrencyCost;
    if (!pending && (payment === 'ticket' ? bootstrap.profile.packTickets : bootstrap.profile.softCurrency) < cost)
      return;
    busy.current = true;
    setPhase('requesting');
    setError(null);
    setHits(0);
    setRevealIndex(0);
    try {
      const request = reservePackRequest(sessionStorage, bootstrap.profile.id, payment, () => crypto.randomUUID());
      setPending(request);
      let result: PackOpening;
      if (preview) {
        // Curated visual fixtures, never a substitute for the server's reward RNG or odds.
        const cards = ['bodega-cat', 'leroy', 'og-dominican', 'big-zoey', 'crossing-guard']
          .map(id => catalogCardById[id]);
        result = {
          id: request.idempotencyKey,
          oddsVersion: 'preview',
          paymentMethod: payment,
          cost,
          pityBefore: 0,
          pityAfter: 0,
          createdAt: new Date().toISOString(),
          rewards: [
            ...cards.map((card) => ({
              kind: 'card' as const,
              cardId: card.catalogId,
              variantId: null,
              name: card.name,
              rarity: card.rarity,
              isNew: true,
              amount: 1,
            })),
            {
              kind: 'styleShards',
              cardId: null,
              variantId: null,
              name: 'Style shards',
              rarity: null,
              isNew: false,
              amount: 25,
            },
          ],
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
        const response = await openPack.mutateAsync({ data: request });
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
        setPhase('punching');
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
    sendScene(frame, { type: 'punch' });
    rushTimer.current = setInterval(() => sendScene(frame, { type: 'punch' }), 260);
  }
  const showInfo = (tab: 'odds' | 'history') => {
    setInfo(tab);
    infoDialog.current?.showModal();
  };

  return (
    <div className="gym venue-page studio-page gacha-stage" data-phase={phase} data-reduced-motion={reduced}>
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
            if (message.type === 'complete' && phase === 'punching') setPhase('knockout');
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
          Your next
          <br />
          <em>heavy hitter.</em>
        </h1>
        <p>
          Step up. Break the bag.
          <br />
          Meet your next crew member.
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
            <span className="studio-eyebrow">The drop</span>
            <h2>{preview ? 'Street pack' : bootstrap.packConfig.name}</h2>
            <p>{bootstrap.packConfig.rewardsPerPack === 6 ? "5 card pulls + 1 bonus. Same street price." : `${bootstrap.packConfig.rewardsPerPack} rewards. One knockout.`}</p>
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
              <strong>Guarantee tracker</strong>
              <span>
                {bootstrap.profile.packPity} of {bootstrap.packConfig.pityLimit} ·{' '}
                <button onClick={() => showInfo('odds')}>View drop rates</button>
              </span>
            </div>
          </div>
        )}
        <p className="gacha-stage__duplicates">
          <GameGlyph name="shards" /> Duplicates become Style Shards.
        </p>
        <div className="gym__actions">
          {phase === 'punching' ? (
            <div className="gacha-stage__secured">
              <Check size={16} />
              <span>
                {preview ? 'Preview loaded.' : 'Your rewards are secured.'}
                <small>Head to the bag to reveal them.</small>
              </span>
            </div>
          ) : (
            <>
              <span className="studio-eyebrow">{pending ? 'Recover your opening' : 'Choose your opening'}</span>
              {(['ticket', 'softCurrency'] as const).map((method) => {
                const ticket = method === 'ticket';
                const cost = ticket ? bootstrap.packConfig.ticketCost : bootstrap.packConfig.softCurrencyCost;
                const balance = ticket ? bootstrap.profile.packTickets : bootstrap.profile.softCurrency;
                const affordable = balance >= cost;
                if (pending && pending.paymentMethod !== method) return null;
                return (
                  <div className="gacha-stage__payment" key={method}>
                    <button
                      className={`studio-action ${ticket ? 'studio-action--gold' : ''}`}
                      disabled={phase !== 'idle' || (!affordable && !pending)}
                      onClick={() => void handleOpen(method)}
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
              <small className="gym__payment-note">
                {preview
                  ? 'Uses preview balances only.'
                  : 'Each button opens one pack. Punching never changes the odds.'}
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
        {phase === 'punching' ? (
          <>
            <div className="gacha-stage__combo" aria-live="polite">
              <ProgressRing value={hits} max={12} label="Hits to reveal">
                <strong>{String(hits).padStart(2, '0')}</strong>
              </ProgressRing>
              <div>
                <strong>{hits >= 9 ? 'Finish it.' : hits >= 5 ? 'Keep that energy.' : 'Make some noise.'}</strong>
                <span>{hits} of 12 hits · The drop is yours</span>
              </div>
            </div>
            <div className="gacha-stage__punch-actions">
              <button
                className="studio-action studio-action--gold"
                disabled={!sceneReady}
                onClick={() => sendScene(frame, { type: 'punch' })}
              >
                <GameGlyph name="fight" />
                Punch the bag
              </button>
              <button className="studio-action" disabled={!sceneReady} aria-pressed={rush} onClick={toggleRush}>
                {rush ? 'Pause rush' : 'Auto rush'}
              </button>
            </div>
            <button className="studio-text-action" onClick={reveal}>
              Skip animation & reveal <ArrowRight size={14} />
            </button>
          </>
        ) : (
          phase === 'idle' && (
            <div className="gacha-stage__ready">
              <GameGlyph name="fight" />
              <span>
                One pack. Twelve hits.<small>Open a pack to step into the ring.</small>
              </span>
            </div>
          )
        )}
      </div>
      {phase === 'knockout' && (
        <div className="gacha-stage__knockout" role="status">
          <CombatSprite asset="fight-start-burst" />
          <span>Pack unleashed</span>
          <strong>K.O.</strong>
          <small>The block felt that.</small>
        </div>
      )}
      <dialog
        ref={rewardDialog}
        className="gym-results studio-results gacha-results"
        aria-labelledby="gym-results-title"
        onCancel={(e) => {
          e.preventDefault();
          finish();
        }}
      >
        <div className="gym-results__header">
          <span className="studio-eyebrow">{preview ? 'Preview drop · Not saved' : 'The bag delivered'}</span>
          <button className="studio-icon" aria-label="Close rewards" onClick={finish}>
            <X size={20} />
          </button>
        </div>
        <GameGlyph name="pack" className="gacha-results__emblem" />
        <h2 id="gym-results-title">{phase === 'reveal' ? 'Look who showed up.' : 'Meet the haul.'}</h2>
        <p>
          {phase === 'reveal'
            ? `Reward ${revealIndex + 1} of ${rewards.length}`
            : preview
              ? 'A taste of the drop. Your real collection is unchanged.'
              : 'Added to your collection. Now put them to work.'}
        </p>
        {phase === 'reveal' && rewards[revealIndex] ? (
          <div className="gym-results__single">
            <RewardCard key={revealIndex} reward={rewards[revealIndex]} large />
            <h3>{rewards[revealIndex].name ?? resourceName(rewards[revealIndex])}</h3>
            <span className="studio-eyebrow">{CARD_RARITY_DEFINITIONS[rewards[revealIndex].rarity as CardRarity]?.label ?? 'Currency'}</span>
          </div>
        ) : (
          <div className="gym-results__grid">
            {rewards.map((reward, i) => (
              <button
                key={i}
                className="gym-results__item"
                aria-label={`Inspect ${reward.name ?? resourceName(reward)}`}
                onClick={() => {
                  setRevealIndex(i);
                  setPhase('reveal');
                }}
              >
                <RewardCard reward={reward} />
                <strong>{reward.name ?? resourceName(reward)}</strong>
                <small>{CARD_RARITY_DEFINITIONS[reward.rarity as CardRarity]?.label ?? `+${reward.amount}`}</small>
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
              Back to gacha
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
