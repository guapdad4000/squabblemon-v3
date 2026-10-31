import { useMemo, useState, useRef, useEffect } from 'react';
import { Link, Redirect, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import {
  buildBreakthroughRoster,
  getBreakthroughLaunchReadiness,
} from '@workspace/squabblemon-engine/breakthroughCatalog';
import {
  CompactDeckPicker,
  type PickerDeck,
} from '../../components/CompactDeckPicker';
import { FighterPortrait } from '../../components/profile/FighterPortrait';
import BreakthroughArena from '../../components/breakthrough/BreakthroughArena';
import BreakthroughHowToPlay from '../../components/breakthrough/BreakthroughHowToPlay';
import { BREAKTHROUGH_TROPHY } from '../../components/breakthrough/progressionArt';
import {
  accountPracticeDecks,
  breakthroughDeckEditorPath,
  practiceDeckLegality,
  practiceLoaner,
  practiceOpponent,
} from '../../components/breakthrough/practiceDecks';
import { getCardImage } from '../../data';
import { usePersistentDeckSelection } from '../../lib/deckSelection';
import { getRankedLobby } from '../../lib/multiplayer';
import '../../components/breakthrough/production.css';

/** CPU practice is explicit; full public entry retains its release requirements. */
export function Breakthrough(props: { bootstrap: PlayerBootstrap }) {
  const [location] = useLocation();
  if (location !== '/game/kumite/breakthrough/practice' && !getBreakthroughLaunchReadiness().canLaunch)
    return <Redirect to="/game/kumite" />;
  return <BreakthroughPractice {...props} />;
}

/** Local CPU matches have no account rewards or online room admission. */
export function BreakthroughPractice({
  bootstrap,
}: {
  bootstrap: PlayerBootstrap;
}) {
  const { profile } = bootstrap;
  const [, navigate] = useLocation();
  const decks = useMemo(
    () => accountPracticeDecks(profile),
    [profile.savedDecks, profile.ownedCardIds],
  );
  const [selectedId, select] = usePersistentDeckSelection(
    profile.id,
    decks.map((deck) => deck.id),
  );
  const [loaner, setLoaner] = useState(false);
  const [session, setSession] = useState<{
    deck: PickerDeck;
    seed: number;
  } | null>(null);
  const startButton = useRef<HTMLButtonElement>(null);
  const wasPlaying = useRef(false);
  useEffect(() => {
    if (wasPlaying.current && !session)
      startButton.current?.focus({ preventScroll: true });
    wasPlaying.current = !!session;
  }, [session]);
  const roster = useMemo(
    () =>
      buildBreakthroughRoster((card) =>
        getCardImage(card.catalogId, profile.equippedVariants[card.catalogId]),
      ),
    [profile.equippedVariants],
  );
  const rank = useQuery({
    queryKey: ['fade-park', profile.id],
    queryFn: ({ signal }) => getRankedLobby(signal),
    staleTime: 30000,
    retry: false,
    enabled: !session,
  });
  const deck = loaner
    ? practiceLoaner()
    : decks.find((item) => item.id === selectedId);
  const legality = deck
    ? practiceDeckLegality(deck, loaner ? deck.cardIds : profile.ownedCardIds)
    : null;
  const identity = {
    name: profile.displayName,
    avatarKey: profile.avatarKey,
    heroCardId:
      session?.deck.heroCardId ?? deck?.heroCardId ?? profile.avatarKey,
    level: profile.level,
    rank: rank.data?.progress.tier,
  };
  function start() {
    if (!deck || !legality?.valid) return;
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    setSession({ deck: { ...deck, cardIds: [...deck.cardIds] }, seed });
  }
  if (session)
    return (
      <BreakthroughArena
        key={`${profile.id}:${session.seed}`}
        roster={roster}
        playerDeck={session.deck.cardIds}
        opponentDeck={practiceOpponent(session.seed)}
        identity={identity}
        initialSeed={session.seed}
        preferredReducedMotion={profile.settings.reducedMotion}
        onChangeDeck={() => setSession(null)}
        onExit={() => navigate('/game/kumite')}
      />
    );
  return (
    <main
      className="bt-lobby"
      data-testid="breakthrough-lobby"
      onDragStartCapture={(event) => event.preventDefault()}
    >
      <header className="bt-lobby-nav">
        <Link href="/game/kumite">← KUMITE</Link>
        <span>CPU PRACTICE · NO ACCOUNT REWARDS</span>
      </header>
      <section
        className="bt-lobby-stage"
        aria-label="Choose a Breakthrough deck"
      >
        <div className="bt-lobby-title">
          <small>KUMITE</small>
          <h1>
            BREAK
            <br />
            THROUGH.
          </h1>
          <img src={BREAKTHROUGH_TROPHY} alt="Breakthrough fist trophy" />
        </div>
        <div className="bt-lobby-crew">
          <div className="bt-lobby-identity">
            <FighterPortrait
              cardId={identity.heroCardId}
              avatarKey={identity.avatarKey}
              name={identity.name}
              decorative
            />
            <div>
              <strong>{identity.name}</strong>
              <small>
                LV {identity.level}
                {identity.rank ? ` · ${identity.rank}` : ''}
              </small>
            </div>
          </div>
          {deck && (
            <>
              <h2>{deck.name}</h2>
              {loaner && (
                <small className="bt-loaner-label">
                  TEMPORARY LOANER · YOUR SAVED DECKS STAY YOURS
                </small>
              )}
            </>
          )}
          <CompactDeckPicker
            decks={decks}
            selectedId={loaner ? '' : selectedId}
            onSelect={(id) => {
              select(id);
              setLoaner(false);
            }}
            label="Choose your Breakthrough deck"
          />
          {deck && !legality?.valid && (
            <div className="bt-compatibility" role="status">
              <strong>DECK NEEDS CHANGES</strong>
              <ul>
                {legality?.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
          {!deck && <p>Choose a saved deck, or step in with a loaner.</p>}
          <div className="bt-lobby-actions">
            <button
              ref={startButton}
              className="bt-primary"
              disabled={!legality?.valid}
              onClick={start}
            >
              PLAY CPU PRACTICE →
            </button>
            {deck && !loaner && (
              <Link href={breakthroughDeckEditorPath(deck.id)}>
                CLICK TO EDIT ↗
              </Link>
            )}
            <button
              className="bt-text-button"
              onClick={() => setLoaner((value) => !value)}
            >
              {loaner ? 'USE MY DECK' : 'TRY A REVIEWED LOANER'} ↗
            </button>
          </div>
          <details className="bt-mode-rules">
            <summary>HOW TO PLAY · THREE LANES, TWO BREACHES</summary>
            <BreakthroughHowToPlay />
          </details>
        </div>
      </section>
    </main>
  );
}
