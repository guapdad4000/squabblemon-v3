import { StreetSelect } from '../ui/street-select';
import { useViewMemory } from '../../lib/navigationMemory';
import { useEffect, useRef, useState } from 'react';
import { useStartChallengeRun, useAbandonChallengeRun, type ChallengeRun, type PlayerBootstrap } from '@workspace/api-client-react';
import { catalogCardByEngineId, decks, type Deck } from '../../data';
import type { BattleConfig } from '../../pages/game/ChallengesHub';
import { ArcadeCabinet } from './MachineScreen';
import { FadecadeRoad } from './FadecadeRoad';
import { ChromeFlag, ChromeBanner } from './FadecadeChrome';
import { FadecadeDialog } from './FadecadeDialog';
import '../../styles/fadecade-road.css';

export type RoadReturn = { runId: string; outcome: 'win' | 'loss' | 'draw' | 'resume'; key: number };
type RunsQuery = {
  data?: ChallengeRun[];
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
};

function issuedCrew(run: ChallengeRun, crews: Deck[]): Deck {
  const snapshot = run.crew as { deckId?: string; cards?: Array<{ cardId?: string }> };
  const ids = snapshot.cards?.map(card => card.cardId).filter((id): id is string => Boolean(id)) ?? [];
  if (ids.length !== 10 || !snapshot.deckId) throw new Error('The saved crew could not be restored. Reload your road to try again.');
  const cardIds = ids.map(id => catalogCardByEngineId[id]?.catalogId ?? id);
  return {
    id: snapshot.deckId,
    name: crews.find(crew => crew.id === snapshot.deckId)?.name ?? 'Issued road crew',
    cards: cardIds, hero: cardIds[0], archetype: 'Locked challenge crew',
    accent: 'ROAD', plan: 'Your crew and upgrades are fixed for this run.',
  };
}

export function FlagshipMachine({ bootstrap, legalCrews, runsQuery, onBattle, roadReturn }: {
  bootstrap: PlayerBootstrap; legalCrews: Deck[]; runsQuery: RunsQuery;
  onBattle: (config: BattleConfig) => void; roadReturn?: RoadReturn | null;
}) {
  const [crewId, setCrewId] = useState(legalCrews[0]?.id ?? '');
  const [open, setOpen] = useViewMemory(`road-open:${bootstrap.profile.id}`, Boolean(roadReturn));
  const [error, setError] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [now, setNow] = useState(Date.now);
  const start = useStartChallengeRun();
  const abandon = useAbandonChallengeRun();
  const commandLock = useRef(false);
  const openButton = useRef<HTMLButtonElement>(null);
  const runs = runsQuery.data ?? [];
  const active = runs.find(run => run.status === 'active');
  const returned = roadReturn && runs.find(run => run.id === roadReturn.runId);
  const latest = returned || runs[0];
  const best = Math.max(0, ...runs.map(run => run.wins));
  const used = runs.filter(run => run.entryDate === new Date(now).toISOString().slice(0, 10)).length;
  const entries = Math.max(0, 2 - used);
  const reset = new Date(now);
  reset.setUTCHours(24, 0, 0, 0);
  const remainingMinutes = Math.max(0, Math.ceil((reset.getTime() - now) / 60_000));
  const countdown = `${String(Math.floor(remainingMinutes / 60)).padStart(2, '0')}:${String(remainingMinutes % 60).padStart(2, '0')}`;
  const loading = runsQuery.isPending;
  const busy = start.isPending || abandon.isPending;
  const selected = legalCrews.find(crew => crew.id === crewId) ?? legalCrews[0];
  const rival = decks.find(deck => deck.id === active?.encounter.rivalDeckId);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (roadReturn) setOpen(true);
  }, [roadReturn]);
  function openRoad() {
    setOpen(true);
  }
  async function launch() {
    if (commandLock.current || runsQuery.isError || loading || (!active && (!selected || !entries))) return;
    commandLock.current = true;
    setError(null);
    try {
      const run = active ?? await start.mutateAsync({ data: { deckId: selected!.id } });
      const crew = issuedCrew(run, legalCrews);
      void runsQuery.refetch();
      onBattle({ mode: 'practice', challengeRunId: run.id, customPlayerDeck: crew, initialDeckId: crew.id });
    } catch {
      setError('Could not confirm your run. Reload the road before retrying; a saved run can always be continued.');
      void runsQuery.refetch();
    } finally {
      commandLock.current = false;
    }
  }
  async function endRun() {
    if (!active || !confirmEnd || commandLock.current) return;
    commandLock.current = true;
    setError(null);
    try {
      await abandon.mutateAsync({ runId: active.id });
      setConfirmEnd(false);
      await runsQuery.refetch();
    } catch {
      setError('Could not confirm the end of your run. Reload the road to check its saved state.');
    } finally {
      commandLock.current = false;
    }
  }
  return <section className="fadecade-feature fadecade-feature--expanded" aria-label="Straight to the Back">
    <div className="fadecade-hero-stage">
      <ChromeFlag side="left" reducedMotion={bootstrap.profile.settings.reducedMotion}>
        <h3>The Road</h3>
        <p>1 loss = out</p>
        <p>Boss every 5</p>
        <p>2 runs a day</p>
      </ChromeFlag>

      <div className="fadecade-hero-center">
        <ArcadeCabinet artUrl="assets/fadecade/flagship.webp"
          aperture={{ left: '12.82%', top: '39.53%', width: '74.91%', height: '37.92%' }}
          testId="fadecade-flagship" className="machine-flagship">
          <div className="fadecade-attract">
            <FadecadeRoad compact index={active?.encounterIndex ?? 0} active={Boolean(active)}
              fighting={Boolean(active?.recovery)} reducedMotion={bootstrap.profile.settings.reducedMotion} />
            <div className="fadecade-attract__hud">
              <span>ENDLESS SOLO <b>{active ? `STOP ${active.encounterIndex + 1}` : 'ONE LOSS. RUN OVER.'}</b></span>
              <button ref={openButton} type="button" className="cabinet-btn" onClick={openRoad}
                aria-expanded={open} aria-haspopup="dialog" aria-label={active ? 'Continue road' : 'Open Straight to the Back road'}>
                {active ? 'Continue road' : 'Open road'}
              </button>
            </div>
          </div>
        </ArcadeCabinet>
      </div>

      <ChromeFlag side="right" reducedMotion={bootstrap.profile.settings.reducedMotion}>
        <h3>Your Run</h3>
        <p>{active ? `Stop ${active.encounterIndex + 1}` : 'Ready to go'}</p>
        <p>{active ? (active.encounter.boss ? 'Boss Alert' : 'Rival Ready') : `Best: ${loading ? '—' : best}`}</p>
      </ChromeFlag>
    </div>

    <ChromeBanner variant="stats" ariaLive="polite" reducedMotion={bootstrap.profile.settings.reducedMotion}>
      <div className="fadecade-chrome-stat" aria-label={`Remaining entries: ${loading || runsQuery.isError ? 'loading' : `${entries} of 2`}`}><span>RUNS</span> <b>{loading || runsQuery.isError ? '—' : `${entries}/2`}</b></div>
      <div className="fadecade-chrome-stat" aria-label={`Daily reset in ${countdown}; resets at midnight UTC`}><span>RESET</span> <b>{countdown}</b></div>
      <div className="fadecade-chrome-stat" aria-label={`Personal best: ${loading ? 'loading' : `${best} stops`}`}><span>BEST</span> <b>{loading ? '—' : best}</b></div>
    </ChromeBanner>

    <FadecadeDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirmEnd(false); }} title="Straight to the Back" kind="road">
      {loading ? <p role="status">Loading your saved road…</p> : runsQuery.isError ? <div role="alert">
        <p>Your road could not be loaded. Nothing will start until your saved progress is confirmed.</p>
        <button type="button" className="cabinet-btn" onClick={() => void runsQuery.refetch()}>Reload road</button>
      </div> : <>
        <div style={{marginTop: '22px'}}>
          <FadecadeRoad index={active?.encounterIndex ?? latest?.encounterIndex ?? 0}
            active={Boolean(active)} fighting={Boolean(active?.recovery)}
            defeated={!active && latest?.status === 'settled'} returnState={roadReturn}
            reducedMotion={bootstrap.profile.settings.reducedMotion} />
        </div>
        <div className="fadecade-road-status" aria-live="polite">
          <strong>{active ? `Stop ${active.encounterIndex + 1} · ${active.wins} cleared` : latest ? `Run ${latest.status === 'settled' ? 'over' : 'ended'} · ${latest.wins} stops cleared` : 'Your first stop is waiting.'}</strong>
          <span>{active ? `${active.encounter.boss ? 'Boss milestone · ' : 'Next rival · '}${rival?.name ?? 'Server-issued rival'}` : 'Two fresh entries each UTC day. No carryover.'}</span>
          {roadReturn?.outcome === 'draw' && <p>Draw. Same stop, same opponent. No repeat rewards.</p>}
          {active?.recovery && <p>Your committed moves are saved. Continue this exact fight.</p>}
        </div>
        {!active && <label className="fadecade-crew-label">Choose your ten-card crew
          <StreetSelect aria-label="Choose legal crew" className="cabinet-select" value={selected?.id ?? ''} onValueChange={event => setCrewId(event)} disabled={busy || !entries}>
            {!selected && <option value="">No legal owned crew available</option>}
            {legalCrews.map(crew => <option key={crew.id} value={crew.id}>{crew.name}</option>)}
          </StreetSelect>
        </label>}
        <p className="fadecade-road-rules">One loss ends the run. Boss every fifth stop. Each stop is a fresh, player-controlled battle. Your ten cards and upgrades stay locked for the run.</p>
        <div className="fadecade-road-actions">
          <button type="button" className="cabinet-btn" disabled={busy || runsQuery.isFetching || (!active && (!selected || !entries))} onClick={() => void launch()}>
            {busy ? 'Saving…' : active ? 'Continue fight' : entries ? 'Start run · 1 entry' : 'Entries reset at 00:00 UTC'}
          </button>
          {active && !confirmEnd && <button type="button" className="cabinet-btn cabinet-btn--outline" disabled={busy} onClick={() => setConfirmEnd(true)}>End run</button>}
        </div>
        {active && confirmEnd && <section className="fadecade-confirm" role="alert" aria-label="Confirm end run">
          <h3>Call it a run?</h3>
          <p>This ends your road permanently. Your entry is not refunded; rewards already earned stay yours.</p>
          <div className="fadecade-road-actions">
            <button type="button" className="cabinet-btn cabinet-btn--outline" disabled={busy} onClick={() => setConfirmEnd(false)}>Keep run</button>
            <button type="button" className="cabinet-btn" disabled={busy} onClick={() => void endRun()}>End run now</button>
          </div>
        </section>}
        {error && <div role="alert" className="fadecade-error">{error}<button type="button" onClick={() => void runsQuery.refetch()}>Reload road</button></div>}
        <small className="fadecade-road-policy">Verified battle rewards are saved after each fight. Draws do not advance or pay rewards. Leaving saves your run; ending it does not refund an entry.</small>
      </>}
    </FadecadeDialog>
  </section>;
}