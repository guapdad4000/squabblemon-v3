import { RankTrophy, RPToken, RankLadder } from '../../components/RankArtwork';
import { AnimatedNumber } from '../../components/AnimatedNumber';
import { GameGlyph } from '../../components/venue/GameGlyph';
import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpRight, Swords, Trophy, Users, Radio } from 'lucide-react';
import { type PlayerBootstrap } from '@workspace/api-client-react';
import { getAssetUrl, getCardImage, starterRecipes, validateSavedDeck, cardCatalog } from '../../data';
import { DeckCarousel } from '../../components/DeckCarousel';
import { rankedStats, rankProgress, type OnlineRoomView } from '@workspace/squabblemon-engine/multiplayer';
import { cancelRanked, getRankedLobby, onlineErrorMessage, searchRanked, type RankedLobby } from '../../lib/multiplayer';
import { MusicControls } from '../../components/MusicControls';
import '../../styles/fade-park.css';

export function FightTabs({ friends = false, searching = false }: { friends?: boolean; searching?: boolean }) {
  return <nav className="fight-tabs" aria-label="Fight modes">
    <Link to="/game/online" aria-current={!friends ? 'page' : undefined}><Swords size={15} />Fade Park<span>Ranked</span></Link>
    {searching ? <span className="fight-tabs-disabled" title="Cancel your search to open friend fades"><Users size={15} />Friend fades</span> : <Link to="/game/online?tab=friends" aria-current={friends ? 'page' : undefined}><Users size={15} />Friend fades<span>Private</span></Link>}
  </nav>;
}

export function FadePark({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const { profile } = bootstrap;
  const client = useQueryClient();
  const [, navigate] = useLocation();
  const key = ['fade-park', profile.id];
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => getRankedLobby(signal),
    refetchInterval: state => state.state.data?.room?.status === 'waiting' ? 1500 : false,
    staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: 'always', refetchOnReconnect: 'always', retry: 1 });
  const saved = profile.savedDecks.filter(d => validateSavedDeck(d.cardIds, profile.ownedCardIds, d.heroCardId).valid);
  const crews = [...saved.map(d => ({ id: d.id, name: d.name, hero: d.heroCardId!, cards: d.cardIds })),
    ...starterRecipes.filter(d => !saved.some(s => s.id === d.id) && validateSavedDeck(d.catalogCardIds, profile.ownedCardIds, d.hero).valid)
      .map(d => ({ id: d.id, name: d.name, hero: d.hero, cards: d.catalogCardIds }))];
  const [deckId, setDeckId] = useState(crews[0]?.id ?? '');
  const chosen = crews.find(d => d.id === deckId) ?? crews[0];
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(Date.now());
  const operation = useRef(false), retry = useRef<{ deckId: string; id: string } | null>(null);

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'touch') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--mx', String((event.clientX - bounds.left) / bounds.width));
    event.currentTarget.style.setProperty('--my', String((event.clientY - bounds.top) / bounds.height));
  };

  const room = query.data?.room;
  const searching = room?.status === 'waiting';
  const stats = query.data?.stats ?? rankedStats(null), progress = query.data?.progress ?? rankProgress(stats.points);
  const elapsed = Math.max(0, Math.floor((clock - (room?.ranked?.queuedAt ?? clock)) / 1000));
  const connected = !query.isError && navigator.onLine;
  function enter(view: OnlineRoomView) {
    client.setQueryData(['friend-match', profile.id, view.code], view);
    client.setQueryData<RankedLobby>(key, data => data ? { ...data, room: null } : data);
    navigate(`/game/online/${view.code}`);
  }
  useEffect(() => { if (query.isFetchedAfterMount && !query.isFetching && !query.isError && (room?.status === 'active' || room?.status === 'complete')) enter(room); }, [room?.code, room?.status, query.isFetchedAfterMount, query.isFetching, query.isError]);
  useEffect(() => { if (!searching) return; const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, [searching]);
  async function search() {
    if (!chosen || operation.current) return;
    operation.current = true; setBusy(true); setError(null);
    try {
      // Stop an older lobby read overwriting the search acknowledgement.
      await client.cancelQueries({ queryKey: key });
      if (!retry.current || retry.current.deckId !== chosen.id) retry.current = { deckId: chosen.id, id: crypto.randomUUID() };
      const data = await searchRanked(chosen.id, retry.current.id);
      client.setQueryData<RankedLobby>(key, data); retry.current = null;
      if (data.room?.status === 'active' || data.room?.status === 'complete') enter(data.room);
    } catch (e) { setError(onlineErrorMessage(e)); }
    finally { operation.current = false; setBusy(false); }
  }
  async function cancel() {
    if (!room || operation.current) return;
    operation.current = true; setBusy(true); setError(null);
    try {
      await client.cancelQueries({ queryKey: key });
      const view = await cancelRanked(room.code);
      if (view.status === 'active' || view.status === 'complete') enter(view);
      else { client.setQueryData<RankedLobby>(key, data => data ? { ...data, room: null } : data); retry.current = null; }
    } catch (e) { setError(onlineErrorMessage(e)); }
    finally { operation.current = false; setBusy(false); }
  }
  return <main className="fade-park" aria-label="Fade Park ranked lobby" data-testid="fade-park" onPointerMove={handlePointerMove}>
    <div className="park-layer park-layer--bg">
      <img className="fade-park-wallpaper" src={getAssetUrl('assets/fade-park/park.png')} alt="" fetchPriority="high" />
    </div>
    <div className="park-layer park-layer--shade fade-park-shade" />
    <div className="park-layer park-layer--dust" />
    <header className="park-topbar"><Link to="/game" className="park-back" aria-label="Back to home"><ArrowLeft size={19} /></Link><FightTabs searching={searching} /></header>
    <div className="park-content">
      <section className="park-intro"><span className="park-eyebrow"><Radio size={13} /> Oakland · Bay Area & beyond</span><h1>FADE<br /><em>PARK.</em></h1><p>Your gang. An open challenge.<br />Pull up and claim your rank.</p><div className="park-ground-rules"><span>3 districts</span><span>6 rounds</span><span>Your next rival</span></div></section>
      <div className="park-board-wrapper park-layer--board">
        <img className="park-board-art" src={getAssetUrl('assets/generated/fade-park-bulletin-board.png')} alt="" aria-hidden="true" />
        <section className="park-ticket" aria-label="Find a ranked match">
          <div className="park-rank"><RankTrophy tier={progress.tier} /><div><span className="park-eyebrow">Preseason · your rank</span><h2>{progress.tier}<strong><RPToken /><AnimatedNumber value={stats.points} /><small> RP</small></strong></h2></div></div>
          <div className="park-rank-track" role="progressbar" aria-label="Progress to next rank" aria-valuenow={Math.round(progress.progress)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${progress.progress}%` }} /></div>
          <div className="park-rank-caption"><span>{progress.nextAt ? `${progress.nextAt - stats.points} RP to ${progress.nextTier}` : 'Top tier. Keep your spot.'}</span><span>{stats.wins} W · {stats.losses} L · {stats.draws} D</span></div>
          {error || query.isError ? <div className="park-notice" role="alert"><p>{error ?? onlineErrorMessage(query.error)}</p><button onClick={() => { setError(null); void query.refetch(); }}>Reconnect</button></div> : null}
          {searching ? <div className="park-search" data-testid="ranked-search">
            <div className="park-search-art"><img className="park-search-poster" src={getAssetUrl('assets/fade-park/search-versus.png')} alt="" /><img className="park-search-fighters" src={getAssetUrl('assets/fade-park/search.gif')} alt="Dr. Fade and Guap warming up" /></div>
            <div className="park-search-status" role="status"><span className="park-pulse" /><h3>{connected ? 'Looking for a fade…' : 'Reconnecting…'}</h3><time>{String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}</time></div>
            <p>Searching for another player. A Park Bot steps in after a short wait, with reduced rank rewards.</p>
            <button className="park-cancel" disabled={busy} onClick={() => void cancel()}>{busy ? 'Checking search…' : 'Cancel search'}</button>
          </div> : <>
            {chosen ? <>
              <div className="park-crew-carousel" style={{ margin: '15px -25px 25px' }}>
                <DeckCarousel
                  decks={crews.map(c => ({
                    id: c.id,
                    name: c.name,
                    heroCardId: c.hero,
                    cardIds: c.cards,
                    subtitle: 'RANKED CREW',
                    valid: true
                  }))}
                  selectedId={chosen.id}
                  onSelect={setDeckId}
                  onOpen={(id) => navigate(`/game/decks/${id}`)}
                  disabled={busy}
                  label="Your gang"
                  openLabel="Edit gang"
                />
              </div>
              <button className="park-find" data-testid="find-ranked-fade" disabled={busy || query.isPending || query.isError} onClick={() => void search()}><span className="fade-finder-icon" aria-hidden="true"><GameGlyph name="fight" /><Search /></span><span>{busy ? 'Entering the park…' : query.isPending ? 'Connecting…' : 'Find a fade'}</span><ArrowUpRight size={22} /></button>
            </> : <div className="park-empty"><h3>Bring your first gang.</h3><p>Save ten different cards you own, then meet us here.</p><Link className="park-find" to="/game/decks">Build your gang <ArrowUpRight size={22} /></Link></div>}
            <p className="park-smallprint">Players first. Park Bots fill quiet hours. Both count toward rank; bot wins earn 12 RP, player wins earn 25 RP.</p>
          </>}
          <RankLadder />
          <details className="park-rules"><summary>How ranked fades work</summary><p>Same board, same rules. Win two of three districts after six rounds. Each turn lasts 75 seconds; running out of time forfeits the match.</p><p>Base card strength keeps the matchup fair. One SQUABBLE per player. Player wins +25 RP, losses −15; bot wins +12, losses −6. Draws earn +5 against players or +2 against bots. Rank points never fall below zero.</p><p>After ranked matches, search again for a new opponent. Private friend fades have rematches and do not affect rank.</p></details>
        </section>
      </div>
    </div>
    <MusicControls variant="dj" wrapperClassName="park-dj" />
  </main>;
}
