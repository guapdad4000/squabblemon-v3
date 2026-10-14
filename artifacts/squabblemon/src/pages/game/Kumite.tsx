import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, HandFist, LoaderCircle, RefreshCw } from 'lucide-react';
import { getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import { getAssetUrl, starterRecipes, validateSavedDeck } from '../../data';
import { usePersistentDeckSelection } from '../../lib/deckSelection';
import { onlineErrorMessage } from '../../lib/multiplayer';
import { enterKumiteMatch, getKumite, getKumiteWinners, kumiteCountdown, kumiteDate, registerKumite, withdrawKumite, type KumiteCurrent } from '../../lib/kumite';
import { CompactDeckPicker } from '../../components/CompactDeckPicker';
import { KumiteLogo } from '../../components/kumite/KumiteBanner';
import { KumiteBracket } from '../../components/kumite/KumiteBracket';
import { KumitePanel } from '../../components/kumite/KumitePanel';
import { KumitePortrait, KumiteWinnerCard } from '../../components/kumite/KumiteWinnerCard';
import { KumiteScoreboard } from '../../components/kumite/KumiteScoreboard';
import { KumiteRewards } from '../../components/kumite/KumiteRewards';
import { KumiteArena } from '../../components/kumite/KumiteArena';
import '../../styles/kumite.css';

const tabs = [{ id: 'signup', label: 'Sign up' }, { id: 'bracket', label: 'Bracket' }, { id: 'history', label: 'Past winners' }, { id: 'rules', label: 'Rules' }] as const;
type KumiteTab = typeof tabs[number]['id'];

function Environment({ entrance, reducedMotion }: { entrance: boolean; reducedMotion: boolean }) {
  if (!entrance) return <KumiteArena className="kumite-arena-scene--lobby" reducedMotion={reducedMotion} />;
  const prefix = 'hallway';
  return <div className={`kumite-environment ${entrance ? 'kumite-environment--hallway' : ''}`} aria-hidden="true">
    <picture><source media="(max-width: 700px)" srcSet={getAssetUrl(`assets/kumite/${prefix}-portrait.webp`)} /><img src={getAssetUrl(`assets/kumite/${prefix}-wide.webp`)} alt="" fetchPriority="high" draggable={false} /></picture>
    <div className="kumite-environment__shade" />
  </div>;
}

/** Production gets every entrant, match and winner from the authenticated tournament service.
 * Browser reviews can intercept that API with fixtures; this page has no demo-data switch. */
export function Kumite({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const { profile } = bootstrap;
  const [, navigate] = useLocation();
  const client = useQueryClient();
  const key = ['kumite', profile.id];
  const [inside, setInside] = useState(() => new URLSearchParams(window.location.search).get('view') === 'arena');
  const [tab, setTab] = useState<KumiteTab>('signup');
  const [clock, setClock] = useState(Date.now);
  const [notice, setNotice] = useState('');
  const panelId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const rewardReceipt = useRef('');
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => getKumite(signal), retry: 1,
    refetchInterval: state => state.state.data?.tournament.status === 'active' ? 2500 : 15000,
    refetchOnMount: 'always', refetchOnWindowFocus: 'always', refetchOnReconnect: 'always', staleTime: 5000 });
  const archive = useQuery({ queryKey: ['kumite-winners'], queryFn: ({ signal }) => getKumiteWinners(signal), enabled: inside, retry: 1, staleTime: 30000 });
  const current = query.data;
  const tournament = current?.tournament;
  const nextRegistration = tournament ? kumiteDate(tournament.registrationOpensAt + 7 * 86400000) : '';
  const registration = current?.registration;
  const match = current?.currentMatch;
  const now = clock + (current ? current.serverTime - query.dataUpdatedAt : 0);
  const earnedRewards = current?.progression?.rewards.filter(reward => reward.claimed).map(reward => reward.id).sort().join('|') ?? '';
  const decks = useMemo(() => {
    const saved = profile.savedDecks.filter(d => validateSavedDeck(d.cardIds, profile.ownedCardIds, d.heroCardId).valid);
    return [
      ...saved.map(d => ({ id: d.id, name: d.name, heroCardId: d.heroCardId!, cardIds: d.cardIds })),
      ...starterRecipes
        .filter(d => !saved.some(s => s.id === d.id) && validateSavedDeck(d.catalogCardIds, profile.ownedCardIds, d.hero).valid)
        .map(d => ({ id: d.id, name: d.name, heroCardId: d.hero, cardIds: d.catalogCardIds })),
    ];
  }, [profile.savedDecks, profile.ownedCardIds]);
  const [deckId, setDeckId] = usePersistentDeckSelection(profile.id, decks.map(d => d.id));
  const deck = decks.find(d => d.id === deckId) ?? decks[0];

  useEffect(() => { const tick = window.setInterval(() => setClock(Date.now()), 10000); return () => clearInterval(tick); }, []);
  useEffect(() => {
    const receipt = `${profile.id}:${earnedRewards}`;
    if (receipt === rewardReceipt.current) return;
    rewardReceipt.current = receipt;
    if (earnedRewards) void client.invalidateQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
  }, [client, profile.id, earnedRewards]);
  useEffect(() => {
    if (tournament?.status === 'complete') void client.invalidateQueries({ queryKey: ['kumite-winners'] });
  }, [client, tournament?.id, tournament?.status]);

  const operation = useMutation({
    mutationFn: async (action: 'register' | 'withdraw' | 'match') => {
      setNotice('');
      await client.cancelQueries({ queryKey: key });
      if (action === 'match') {
        const result = await enterKumiteMatch();
        client.setQueryData<KumiteCurrent>(key, result.current);
        if (result.room) {
          client.setQueryData(['friend-match', profile.id, result.room.code], result.room);
          navigate(`/game/online/${result.room.code}`);
        } else setNotice('Checked in. Waiting for opponent.');
      } else {
        if (action === 'register' && !deck) throw new Error('Choose a battle-ready deck first.');
        const result = action === 'register' ? await registerKumite(deck!.id) : await withdrawKumite();
        client.setQueryData<KumiteCurrent>(key, result);
        setNotice(action === 'register' ? 'Registered. Deck locked.' : 'Registration withdrawn.');
      }
    },
    onError: () => { void query.refetch(); },
  });
  const error = operation.error ? onlineErrorMessage(operation.error) : query.isError ? onlineErrorMessage(query.error) : '';
  const registrationOpen = tournament?.status === 'registration' && now >= tournament.registrationOpensAt && now < tournament.startsAt;
  const full = !!tournament && tournament.entrants.length >= tournament.capacity;
  const busy = operation.isPending;

  function enterArena() {
    setInside(true);
    // Keep a useful deep link when a player returns from building a deck or a match.
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?view=arena`);
    window.setTimeout(() => panelRef.current?.focus({ preventScroll: true }), 0);
  }
  function switchTab(next: KumiteTab) { setTab(next); operation.reset(); setNotice(''); }
  function tabKeys(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
    if (next === null) return;
    event.preventDefault(); switchTab(tabs[next].id);
    document.getElementById(`${panelId}-tab-${tabs[next].id}`)?.focus();
  }

  return <main className={`kumite ${inside ? 'kumite--arena' : 'kumite--entrance'}`} data-testid="kumite" data-reduced-motion={profile.settings.reducedMotion} style={{ '--kumite-panel-art': `url("${getAssetUrl('assets/kumite/panel-background.webp')}")` } as CSSProperties}>
    <Environment entrance={!inside} reducedMotion={profile.settings.reducedMotion} />
    <div className="kumite-shell">
      <header className="kumite-topbar"><Link href="/game/online" className="kumite-back" aria-label="Back to fight modes"><ArrowLeft size={18} aria-hidden="true" /><span>Fight modes</span></Link><Link href="/game" className="kumite-home" aria-label="Squabblemon Safehouse"><KumiteLogo decorative /></Link><Link href="/game/challenges?game=punch-on-patrol&raid=kumite" className="kumite-raid-cta"><HandFist size={14} aria-hidden="true" /><span>Dojo Boss Raid</span></Link><span className="kumite-topbar__stamp">WEEKLY · PVP</span></header>
      {!inside ? <section className="kumite-entry" aria-label="Kumite entrance">
        <div className="kumite-entry__invitation"><h1>KUMITE</h1><p>Weekly PvP · 8 players · 3 rounds</p>
          <div className="kumite-entry__actions">
            <button type="button" className="kumite-button" onClick={enterArena}><HandFist size={24} aria-hidden="true" />Enter Kumite<ArrowRight size={23} aria-hidden="true" /></button>
            <Link href="/game/challenges?game=punch-on-patrol&raid=kumite" className="kumite-text-button"><HandFist size={16} aria-hidden="true" />Play Dojo Boss Raid (Unlocks Kumite Fighters)<ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
        </div>
      </section> : <>
        <section className="kumite-arena-head" aria-label="Kumite weekly tournament">
          {tournament && <KumiteScoreboard tournament={tournament} currentMatch={match} lastWinner={archive.data?.winners[0]} records={current?.records} archiveStatus={archive.isError ? 'error' : archive.isPending ? 'pending' : 'ready'} now={now} />}
          <div className="kumite-arena-head__line"><span className="kumite-week">{tournament?.weekLabel ?? 'WEEKLY TOURNAMENT'}</span><h1 className="sr-only">Kumite weekly PvP tournament</h1><span className="kumite-live-mark" data-active={tournament?.status === 'active'}><i />{tournament?.status === 'active' ? 'FIGHTS LIVE' : tournament?.status === 'complete' ? 'TOURNAMENT COMPLETE' : tournament?.status === 'cancelled' ? 'TOURNAMENT CANCELLED' : 'REGISTRATION'}</span></div>
        </section>
        <div className="kumite-board">
          <div className="kumite-tabs" role="tablist" aria-label="Kumite tournament sections">{tabs.map((item, index) => <button key={item.id} id={`${panelId}-tab-${item.id}`} type="button" role="tab" aria-selected={tab === item.id} aria-controls={`${panelId}-panel`} tabIndex={tab === item.id ? 0 : -1} onClick={() => switchTab(item.id)} onKeyDown={event => tabKeys(event, index)}><img className="kumite-tabs__cloth" src={getAssetUrl('assets/kumite/nav-flag.webp')} alt="" draggable={false} /><span>{item.label}</span></button>)}</div>
          <section id={`${panelId}-panel`} ref={panelRef} tabIndex={-1} role="tabpanel" aria-labelledby={`${panelId}-tab-${tab}`} className="kumite-tabpanel">
            {error && <div className="kumite-notice kumite-notice--error" role="alert"><p>{error}</p><button type="button" onClick={() => { operation.reset(); void query.refetch(); }}><RefreshCw size={14} />Retry connection</button></div>}
            {notice && <p className="kumite-notice" role="status"><Check size={17} />{notice}</p>}
            {query.isPending ? <div className="kumite-loading" role="status"><LoaderCircle size={28} /><p>Loading tournament…</p></div> : !current ? <div className="kumite-empty"><KumiteLogo decorative /><h2>Connection unavailable</h2><p>Reconnect to load Kumite.</p></div> : tab === 'signup' ? <KumitePanel title={registration ? 'Registered' : 'Enter'} aside={`${tournament!.entrants.length} / ${tournament!.capacity} ENTRANTS`} className="kumite-registration">
              <div className="kumite-registration__grid">
                <div className="kumite-signup">
                  {registration ? <>
                    <div className="kumite-ticket"><span className="kumite-eyebrow"><Check size={15} /> YOU'RE REGISTERED</span><div><KumitePortrait hero={registration.hero} name={profile.displayName} /><h3>{profile.displayName}<small>{registration.deckName}</small></h3></div><p>Deck locked for this tournament.</p></div>
                    {tournament!.status === 'registration' ? <button type="button" className="kumite-text-button" disabled={busy} onClick={() => operation.mutate('withdraw')}>{busy ? 'Updating registration…' : 'Withdraw registration'}</button> : tournament!.status === 'active' && match ? <div className="kumite-next-match"><span className="kumite-eyebrow">{['QUARTERFINAL', 'SEMIFINAL', 'FINAL'][match.round] ?? 'NEXT MATCH'}</span><h3>{match.entrants.filter(Boolean).map(e => e!.name).join(' vs ') || 'Waiting for the next draw'}</h3><p>Round deadline: <time dateTime={new Date(match.deadline).toISOString()}>{kumiteDate(match.deadline)}</time></p><button type="button" className="kumite-button" disabled={busy || !['ready', 'playing'].includes(match.status)} onClick={() => operation.mutate('match')}><HandFist size={21} />{busy ? 'Entering…' : match.status === 'playing' ? 'Return to your fight' : 'Check in & fight'}<ArrowRight size={19} /></button></div> : <p className="kumite-signup__status">{tournament!.status === 'active' ? 'Check the bracket for your result.' : tournament!.status === 'cancelled' ? `Cancelled. Next registration: ${nextRegistration}.` : tournament!.champion ? `Champion: ${tournament!.champion.name}. Next registration: ${nextRegistration}.` : `Next registration: ${nextRegistration}.`}</p>}
                  </> : registrationOpen ? <>

                    {deck ? <><div className="kumite-chosen-deck"><KumitePortrait hero={deck.heroCardId} /><div><h3>{deck.name}</h3><span>10 cards</span></div></div><CompactDeckPicker decks={decks} selectedId={deck.id} onSelect={setDeckId} disabled={busy || full} label="Choose tournament deck" /><p className="kumite-signup__fine">Deck locks when you register.</p><button type="button" className="kumite-button" disabled={busy || full || query.isError} onClick={() => operation.mutate('register')}><HandFist size={21} aria-hidden="true" />{busy ? 'Registering…' : full ? 'This week is full' : 'Sign up'}<ArrowRight size={20} aria-hidden="true" /></button></> : <div className="kumite-empty"><KumiteLogo decorative /><h3>Deck required</h3><p>10 owned cards to enter.</p><Link className="kumite-button" href="/game/decks">Build your deck<ArrowRight size={19} /></Link></div>}
                  </> : <div className="kumite-empty"><span className="kumite-fist-seal"><HandFist /></span><h3>{tournament!.status === 'active' ? 'Fights live' : tournament!.status === 'cancelled' ? 'Tournament cancelled' : tournament!.status === 'complete' ? 'Tournament complete' : 'Registration pending'}</h3><p>{tournament!.status === 'active' ? `Next registration: ${nextRegistration}.` : tournament!.status === 'registration' ? `Registration opens ${kumiteDate(tournament!.registrationOpensAt)}.` : `Next registration opens ${nextRegistration}.`}</p><button type="button" className="kumite-text-button" onClick={() => switchTab('bracket')}>View bracket<ArrowRight size={15} /></button></div>}
                </div>
              </div>
              <div className="kumite-entrant-list"><h3>The list <span>{tournament!.entrants.length} / {tournament!.capacity}</span></h3>{tournament!.entrants.length ? <ul>{tournament!.entrants.map((entrant, index) => <li key={entrant.id}><span className="kumite-entrant-list__number">{String(index + 1).padStart(2, '0')}</span><KumitePortrait hero={entrant.hero} avatarKey={entrant.avatarKey} /><strong>{entrant.name}</strong><HandFist size={13} aria-hidden="true" /></li>)}</ul> : <p>No entrants yet.</p>}</div>
            </KumitePanel> : tab === 'bracket' ? <KumitePanel className="kumite-bracket-panel" title="Tournament bracket" aside="8 ENTRANTS · 3 ROUNDS"><KumiteBracket tournament={tournament!} /></KumitePanel> : tab === 'history' ? <KumitePanel title="Winners" aside="WEEKLY CHAMPIONS">
              {archive.isPending ? <div className="kumite-loading" role="status"><LoaderCircle /><p>Loading winners…</p></div> : archive.isError ? <div className="kumite-notice kumite-notice--error" role="alert"><p>{onlineErrorMessage(archive.error)}</p><button type="button" onClick={() => void archive.refetch()}>Retry winners</button></div> : archive.data?.winners.length ? <div className="kumite-winners">{archive.data.winners.map(winner => <KumiteWinnerCard key={winner.tournamentId} winner={winner} />)}</div> : <div className="kumite-empty kumite-empty--history"><KumiteLogo decorative /><h3>No champions yet.</h3></div>}
            </KumitePanel> : <KumitePanel title="Rules" aside="8 PLAYERS · 3 ROUNDS">
              <ol className="kumite-rules"><li><span>01</span><div><h3>8 spots</h3><p>Register before the first round. Eight spots; two entrants minimum. Smaller fields receive byes.</p></div></li><li><span>02</span><div><h3>10 owned cards</h3><p>Ten owned cards. Your deck locks at registration. Withdraw before the first round.</p></div></li><li><span>03</span><div><h3>Single elimination</h3><p>Quarterfinals → semifinals → final. Single elimination. Winners enter the archive.</p></div></li><li><span>04</span><div><h3>Check in</h3><p>{current.rules.roundHours} hours per round; {current.rules.turnSeconds} seconds per turn. Both players check in. Draws replay.</p></div></li><li><span>05</span><div><h3>Deadlines</h3><p>One checked-in player advances at the deadline. If both or neither arrived without finishing, both forfeit.</p></div></li></ol>
              <p className="kumite-rules__schedule">This week's first round: <time dateTime={new Date(tournament!.startsAt).toISOString()}>{kumiteDate(tournament!.startsAt)}</time>. Times are shown in your local time zone.</p>
            </KumitePanel>}
          </section>
        </div>
        <KumiteRewards progression={current?.progression} />
      </>}
    </div>
  </main>;
}
