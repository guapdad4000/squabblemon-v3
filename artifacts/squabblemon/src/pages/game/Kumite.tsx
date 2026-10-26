import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, HandFist, LoaderCircle, RefreshCw } from 'lucide-react';
import { getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import { getAssetUrl, getCardImage, starterRecipes, validateSavedDeck } from '../../data';
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

const DOJO_RAID_BOSSES = [
  { id: 'bushedo-brown', name: 'Bushedo Brown', tier: 'T1' },
  { id: 'p-tang', name: 'P. Tang', tier: 'T2' },
  { id: 'dragonfly-jones', name: 'Dragonfly Jones', tier: 'T3' },
  { id: 'chonk-lee', name: 'Chonk Lee', tier: 'T4' },
  { id: 'sho-nuff', name: "Sho'Nuff", tier: 'T5' },
] as const;

const BREAK_BRACKET_EPISODES = [
  '01 · The Invitation',
  '02 · Belt Check',
  '03 · Find the Glo',
  '04 · Professional Courtesy',
  '05 · Break the Bracket',
  '06 · The Arena Is Ours',
  '07 · I Got the Glo',
  '08 · Legends Remain',
] as const;

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
    refetchInterval: state => inside && (tab === 'signup' || tab === 'bracket') && state.state.data?.tournament.status === 'active' ? 2500 : 15000,
    refetchIntervalInBackground: false,
    refetchOnMount: 'always', refetchOnWindowFocus: 'always', refetchOnReconnect: 'always', staleTime: 5000 });
  const archive = useQuery({ queryKey: ['kumite-winners'], queryFn: ({ signal }) => getKumiteWinners(signal), enabled: inside, retry: 1, staleTime: 30000 });
  const current = query.data;
  const tournament = current?.tournament;
  const nextRegistration = tournament ? kumiteDate(tournament.registrationOpensAt + 7 * 86400000) : '';
  const rulesUpdated = tournament?.status === 'cancelled' && tournament.cancellationReason === 'rules-updated';
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

  useEffect(() => {
    const tick = window.setInterval(() => { if (!document.hidden) setClock(Date.now()); }, 10000);
    return () => clearInterval(tick);
  }, []);
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
        } else if (result.current.tournament.status === 'active') setNotice('Checked in. Waiting for opponent.');
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
      <header className="kumite-topbar"><Link href="/game/online" className="kumite-back" aria-label="Back to fight modes"><ArrowLeft size={18} aria-hidden="true" /><span>Fight modes</span></Link><Link href="/game" className="kumite-home" aria-label="Squabblemon Safehouse"><KumiteLogo decorative /></Link>{inside && <button type="button" className="kumite-mode-back" onClick={() => { setInside(false); window.history.replaceState(window.history.state, '', window.location.pathname); }}><span>All Kumite Modes</span></button>}{inside && <Link href="/game/challenges?game=punch-on-patrol&raid=kumite" className="kumite-raid-cta"><HandFist size={14} aria-hidden="true" /><span>Dojo Boss Raid</span></Link>}<span className="kumite-topbar__stamp">KUMITE · ARENA</span></header>
      {!inside ? <section className="kumite-entry kumite-hub" aria-label="Kumite mode select">
        <header className="kumite-hub__hero">
          <div className="kumite-hub__title-block">
            <span className="kumite-hub__kicker"><i /> SELECT YOUR ARENA MODE</span>
            <h1><span className="kumite-hub__title-lead">THE</span><span className="kumite-hub__title-main">KUMITE<span className="kumite-hub__title-dot">.</span></span></h1>
          </div>
          <div className="kumite-hub__stats" aria-label="Your Kumite record">
            <div><small>FULL FIGHTS</small><strong>{current?.progression?.completedMatches ?? 0}</strong></div>
            <div><small>KUMITE WINS</small><strong>{current?.progression?.matchWins ?? 0}</strong></div>
            <div><small>TITLES</small><strong>{current?.progression?.championships ?? 0}</strong></div>
            <div><small>UNLOCKED</small><strong>{current?.progression?.rewards.filter(r => r.claimed || r.owned).length ?? 0} / 9</strong></div>
          </div>
        </header>

        <div className="kumite-mode-grid">
          <article className="kumite-mode-card kumite-mode-card--tournament" data-mode="tournament">
            <div className="kumite-mode-card__media">
              <img src={getAssetUrl('assets/kumite/layers/backdrop.webp')} alt="" draggable={false} />
              <img className="kumite-mode-card__chibi" src={getAssetUrl('assets/kumite/dragonfly-vs-chonk-chibi-v1.webp')} alt="" draggable={false} />
              <span className="kumite-mode-card__badge" data-live={tournament?.status === 'active'}>
                <i /> {tournament?.status === 'active' ? 'FIGHTS LIVE NOW' : tournament ? `${tournament.entrants.length} / ${tournament.capacity} ENTRANTS` : 'WEEKLY PVP BRACKET'}
              </span>
              <span className="kumite-mode-card__number">01</span>
            </div>
            <div className="kumite-mode-card__body">
              <span className="kumite-mode-card__eyebrow">TOURNAMENT NIGHT · LIVE PVP</span>
              <h2>WEEKLY <em>BRACKET</em></h2>
              <p>Lock your 10-card gang and battle through Quarterfinals, Semifinals, and the Grand Final to claim permanent Kumite fighters.</p>
              <div className="kumite-mode-card__pills">
                <span>8 PLAYERS</span>
                <span>3 ROUNDS</span>
                <span>{tournament?.weekLabel ?? 'WEEKLY DRAW'}</span>
              </div>
              <div className="kumite-entry__actions">
                <button type="button" className="kumite-button" onClick={enterArena}>
                  <HandFist size={22} aria-hidden="true" />Enter Kumite<ArrowRight size={20} aria-hidden="true" />
                </button>
              </div>
            </div>
          </article>

          <article className="kumite-mode-card kumite-mode-card--raid" data-mode="boss-raid">
            <div className="kumite-mode-card__media">
              <img src={getAssetUrl('assets/kumite/films/v1/unlock-shonuff-landscape.webp')} alt="" draggable={false} />
              <span className="kumite-mode-card__badge kumite-mode-card__badge--gold">
                <i /> 5 GRANDMASTERS · 6 ROUNDS
              </span>
              <span className="kumite-mode-card__number">02</span>
            </div>
            <div className="kumite-mode-card__body">
              <span className="kumite-mode-card__eyebrow">PUNCH ON PATROL · DOJO FLIP</span>
              <h2>DOJO <em>BOSS RAID</em></h2>
              <p>Run the 5-tier Grandmaster gauntlet with 3-tier Hands Overdrive, Elemental Perks, and 10+ Hands Awakened card auras. Advances your Kumite unlock road.</p>
              <div className="kumite-mode-card__boss-strip" aria-label="Dojo Boss Lineup">
                {DOJO_RAID_BOSSES.map(boss => (
                  <div key={boss.id} className="kumite-mode-card__boss" title={boss.name}>
                    <span className="kumite-portrait"><img src={getCardImage(boss.id)} alt="" decoding="async" /></span>
                    <small>{boss.tier}</small>
                  </div>
                ))}
              </div>
              <div className="kumite-entry__actions">
                <Link href="/game/challenges?game=punch-on-patrol&raid=kumite" className="kumite-button kumite-button--gold">
                  <HandFist size={22} aria-hidden="true" />Play Dojo Boss Raid<ArrowRight size={20} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </article>

          <article className="kumite-mode-card kumite-mode-card--arc" data-mode="break-the-bracket">
            <div className="kumite-mode-card__media">
              <img src={getAssetUrl('assets/kumite/films/v1/unlock-glo-landscape.webp')} alt="" draggable={false} />
              <span className="kumite-mode-card__badge kumite-mode-card__badge--crimson">
                <i /> 8-EPISODE SPECIAL ARC
              </span>
              <span className="kumite-mode-card__number">03</span>
            </div>
            <div className="kumite-mode-card__body">
              <span className="kumite-mode-card__eyebrow">FEATURED STORY EXPANSION</span>
              <h2>BREAK THE <em>BRACKET</em></h2>
              <p>When Sho'Nuff and two-on-one ambushes shatter the bracket order, find the Glo across 8 authored anime episodes and signature impact cels.</p>
              <div className="kumite-mode-card__episodes">
                {BREAK_BRACKET_EPISODES.slice(0, 4).map(ep => <span key={ep}>{ep}</span>)}
                <span>+4 FINALE EPISODES</span>
              </div>
              <div className="kumite-entry__actions kumite-entry__actions--row">
                <Link href="/game/story" className="kumite-text-button kumite-mode-card__cta">
                  <span>Open Story Theater</span><ArrowRight size={15} aria-hidden="true" />
                </Link>
                <button type="button" className="kumite-text-button kumite-mode-card__cta" onClick={() => { enterArena(); window.setTimeout(() => document.querySelector('.kumite-roadmap')?.scrollIntoView({ behavior: 'smooth' }), 80); }}>
                  <span>Fighter Film Vault</span><ArrowRight size={15} aria-hidden="true" />
                </button>
              </div>
            </div>
          </article>

          <article className="kumite-mode-card kumite-mode-card--camp" data-mode="dojo-camp">
            <div className="kumite-mode-card__media">
              <img src={getAssetUrl('assets/kumite/films/v1/unlock-ptang-landscape.webp')} alt="" draggable={false} />
              <span className="kumite-mode-card__badge">
                <i /> 9 FIGHTERS · 18 FILM CUTS
              </span>
              <span className="kumite-mode-card__number">04</span>
            </div>
            <div className="kumite-mode-card__body">
              <span className="kumite-mode-card__eyebrow">DOJO CAMP · REWARDS & ARCHIVE</span>
              <h2>FIGHTER <em>ROAD & FILMS</em></h2>
              <p>Inspect all 9 Kumite unlock milestones (Bushedo Brown, P. Tang, Chonk Lee, Leroy & more), replay 16:9 / 9:16 fighter films, and review the 52-week Hall of Champions.</p>
              <div className="kumite-mode-card__pills">
                <span>9 UNLOCK DOSSIERS</span>
                <span>HALL OF CHAMPIONS</span>
                <span>FASTEST FIGHTS</span>
              </div>
              <div className="kumite-entry__actions kumite-entry__actions--row">
                <button type="button" className="kumite-text-button kumite-mode-card__cta" onClick={() => { enterArena(); switchTab('history'); }}>
                  <span>Hall of Champions</span><ArrowRight size={15} aria-hidden="true" />
                </button>
                <button type="button" className="kumite-text-button kumite-mode-card__cta" onClick={() => { enterArena(); window.setTimeout(() => document.querySelector('.kumite-roadmap')?.scrollIntoView({ behavior: 'smooth' }), 80); }}>
                  <span>Open Unlock Road</span><ArrowRight size={15} aria-hidden="true" />
                </button>
              </div>
            </div>
          </article>
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
                    {tournament!.status === 'registration' ? <button type="button" className="kumite-text-button" disabled={busy} onClick={() => operation.mutate('withdraw')}>{busy ? 'Updating registration…' : 'Withdraw registration'}</button> : tournament!.status === 'active' && match ? <div className="kumite-next-match"><span className="kumite-eyebrow">{['QUARTERFINAL', 'SEMIFINAL', 'FINAL'][match.round] ?? 'NEXT MATCH'}</span><h3>{match.entrants.filter(Boolean).map(e => e!.name).join(' vs ') || 'Waiting for the next draw'}</h3><p>Round deadline: <time dateTime={new Date(match.deadline).toISOString()}>{kumiteDate(match.deadline)}</time></p><button type="button" className="kumite-button" disabled={busy || !['ready', 'playing'].includes(match.status)} onClick={() => operation.mutate('match')}><HandFist size={21} />{busy ? 'Entering…' : match.status === 'playing' ? 'Return to your fight' : 'Check in & fight'}<ArrowRight size={19} /></button></div> : <p className="kumite-signup__status">{tournament!.status === 'active' ? 'Check the bracket for your result.' : tournament!.status === 'cancelled' ? `${rulesUpdated ? 'Rules updated. This bracket ended without a new champion; earned rewards are saved.' : 'Cancelled.'} Next registration: ${nextRegistration}.` : tournament!.champion ? `Champion: ${tournament!.champion.name}. Next registration: ${nextRegistration}.` : `Next registration: ${nextRegistration}.`}</p>}
                  </> : registrationOpen ? <>

                    {deck ? <><div className="kumite-chosen-deck"><KumitePortrait hero={deck.heroCardId} /><div><h3>{deck.name}</h3><span>10 cards</span></div></div><CompactDeckPicker decks={decks} selectedId={deck.id} onSelect={setDeckId} disabled={busy || full} label="Choose tournament deck" /><p className="kumite-signup__fine">Deck locks when you register.</p><button type="button" className="kumite-button" disabled={busy || full || query.isError} onClick={() => operation.mutate('register')}><HandFist size={21} aria-hidden="true" />{busy ? 'Registering…' : full ? 'This week is full' : 'Sign up'}<ArrowRight size={20} aria-hidden="true" /></button></> : <div className="kumite-empty"><KumiteLogo decorative /><h3>Deck required</h3><p>10 owned cards to enter.</p><Link className="kumite-button" href="/game/decks">Build your deck<ArrowRight size={19} /></Link></div>}
                  </> : <div className="kumite-empty"><span className="kumite-fist-seal"><HandFist /></span><h3>{rulesUpdated ? 'Rules updated' : tournament!.status === 'active' ? 'Fights live' : tournament!.status === 'cancelled' ? 'Tournament cancelled' : tournament!.status === 'complete' ? 'Tournament complete' : 'Registration pending'}</h3><p>{rulesUpdated ? `This bracket ended without a new champion. Earned rewards are saved. Next registration: ${nextRegistration}.` : tournament!.status === 'active' ? `Next registration: ${nextRegistration}.` : tournament!.status === 'registration' ? `Registration opens ${kumiteDate(tournament!.registrationOpensAt)}.` : `Next registration opens ${nextRegistration}.`}</p><button type="button" className="kumite-text-button" onClick={() => switchTab('bracket')}>View bracket<ArrowRight size={15} /></button></div>}
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
