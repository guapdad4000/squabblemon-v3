import { useGameBack } from '../../components/venue/GameBackButton';
import { DECK_SIZE } from '../../data';
import { GameGlyph, type GameGlyphName } from '../../components/venue/GameGlyph';
import { useState } from 'react';
import { useLocation } from 'wouter';
import {
  ArrowRight,
  Check,
  Crown,
  Flame,
  Layers,
  Shield,
  Snowflake,
  Sparkles,
  Swords,
  Wind,
  Zap,
} from 'lucide-react';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import {
  activities,
  draftOffers,
  eventWeek,
  makeActivityEncounter,
  type ActivityId,
} from '@workspace/squabblemon-engine/activities';
import { cards, getAssetUrl, getCardImage, starterRecipes, validateSavedDeck, type Deck } from '../../data';
import { DeckCarousel } from '../../components/DeckCarousel';
import { PlayLoop } from '../../components/PlayLoop';
import { CardView } from '../../components/CardView';
import { e2eAuthEnabled } from '../../lib/auth';
import { usePersistentDeckSelection } from '../../lib/deckSelection';
import '../../styles/studio.css';
import '../../styles/activity-stage.css';

const activityArt: Partial<Record<ActivityId, GameGlyphName>> = {
  auto: 'fight',
  fair: 'fight',
  cheap: 'motion',
  draft: 'crew',
  boss: 'mastery',
  neighborhood: 'story',
};

const presentations = {
  auto: {
    portrait: 'young-bull',
    icon: Swords,
    title: 'Make your\nnext move.',
    color: '#efc87c',
  },
  pressure: {
    portrait: 'ganger-red',
    icon: Flame,
    title: 'Hold your\nground.',
    color: '#ff9b7e',
  },
  control: {
    portrait: 'honest-thot',
    icon: Shield,
    title: 'Own the\nmoment.',
    color: '#c0b5ff',
  },
  movement: {
    portrait: 'delivery-demon',
    icon: Wind,
    title: 'Never stand\nstill.',
    color: '#9cd8ef',
  },
  support: {
    portrait: 'abuela',
    icon: Sparkles,
    title: 'Break their\nrhythm.',
    color: '#addc9e',
  },
  freeze: {
    portrait: 'snow-bunny',
    icon: Snowflake,
    title: 'Keep your\ncool.',
    color: '#a4def7',
  },
  cheap: {
    portrait: 'gamer',
    icon: Zap,
    title: 'Break the\nchain.',
    color: '#c8e68f',
  },
  fair: {
    portrait: 'edgar',
    icon: Swords,
    title: 'Your skill.\nEqual footing.',
    color: '#f2d392',
  },
  neighborhood: {
    portrait: 'ice-cream-truck',
    icon: Sparkles,
    title: 'Tonight, the\nblock is yours.',
    color: '#ffc09d',
  },
  draft: {
    portrait: 'plug',
    icon: Layers,
    title: 'Ten picks.\nOne gang.',
    color: '#cbb0ff',
  },
  boss: {
    portrait: 'hooper',
    icon: Crown,
    title: 'Earn your\nafter-hours.',
    color: '#ffaaa9',
  },
} as const;

export function PlayerDeckPlay({ bootstrap, storyNodeId }: { bootstrap: PlayerBootstrap; storyNodeId?: string }) {
  const goBack = useGameBack();
  const [, navigate] = useLocation();
  const [selected, setSelected] = useState<Deck | null>(null);
  const [activity, setActivity] = useState<ActivityId>('auto');
  const [showEvents, setShowEvents] = useState(false);
  const [picks, setPicks] = useState<string[]>([]);
  const [week] = useState(() => eventWeek());
  const saved = bootstrap.profile.savedDecks.filter(
    (deck) => validateSavedDeck(deck.cardIds, bootstrap.profile.ownedCardIds, deck.heroCardId).valid,
  );
  const fallback = starterRecipes.filter(
    (recipe) => validateSavedDeck(recipe.catalogCardIds, bootstrap.profile.ownedCardIds, recipe.hero).valid,
  );
  const storyStarter =
    storyNodeId && fallback.length === 0
      ? starterRecipes.find((recipe) => recipe.id === bootstrap.profile.starterDeckId) ?? starterRecipes[0]
      : null;
  const crews = [
    ...saved,
    ...(storyStarter ? [storyStarter] : fallback)
      .filter(recipe => !saved.some(deck => deck.id === recipe.id))
      .map(recipe => ({
        id: recipe.id,
        name: recipe.name,
        cardIds: recipe.catalogCardIds,
        heroCardId: recipe.hero,
        recipeId: recipe.id,
      })),
  ];
  const [crewId, setCrewId] = usePersistentDeckSelection(
    bootstrap.profile.id,
    crews.map(deck => deck.id),
  );
  const chosen = crews.find(deck => deck.id === crewId) ?? crews[0];
  const offers = draftOffers(week);
  const current = activities.find((item) => item.id === activity)!;
  const presentation = presentations[activity];
  const isDraft = !storyNodeId && activity === 'draft';
  const eventRule =
    !storyNodeId && (activity === 'neighborhood' || activity === 'boss')
      ? makeActivityEncounter(activity, 'preview', 'block', week).passive?.description
      : null;
  function chooseMode(id: ActivityId) {
    setActivity(id);
    setPicks([]);
  }
  function enterFight() {
    if (!chosen) return;
    setSelected({
      id: chosen.id,
      name: chosen.name,
      cards: chosen.cardIds,
      hero: chosen.heroCardId,
      archetype: 'Your gang',
      accent: 'PLAY',
      plan: 'Your cards. Your strategy.',
    });
  }
  if (selected)
    return (
      <PlayLoop
        key={`${selected.id}:${activity}`}
        mode={storyNodeId ? 'story' : e2eAuthEnabled && bootstrap.profile.id === 'e2e-player' ? 'guest' : 'practice'}
        storyNodeId={storyNodeId}
        hideLobby
        activity={storyNodeId ? undefined : activity}
        draftWeek={activity === 'draft' ? week : undefined}
        draftPicks={activity === 'draft' ? picks : undefined}
        initialDeckId={selected.id}
        customPlayerDeck={selected}
        turnTimerEnabled={bootstrap.profile.settings.turnTimerEnabled}
        equippedVariants={bootstrap.profile.equippedVariants}
        cardProgression={bootstrap.profile.cardProgression}
        onExit={() => (storyNodeId ? goBack() : setSelected(null))}
      />
    );
  const fightButton = (
    <button className="studio-action studio-action--gold" onClick={enterFight} style={{ width: '100%' }}>
      <GameGlyph name="fight" /> Enter fight <ArrowRight size={17} />
    </button>
  );
  const setup = (
    <>
      <header className="activity-stage__header">

        <span className="studio-eyebrow">{storyNodeId ? 'Chapter battle' : 'The block circuit'}</span>
        <button className="studio-text-action" onClick={() => navigate('/game/missions')}>
          <GameGlyph name="mastery" />
          <span>Mastery</span>
        </button>
      </header>
      {!storyNodeId && (
        <nav className="studio-tabs activity-stage__tabs" aria-label="Battle categories">
          <button onClick={() => navigate('/game/online')}>Online · Friend fade</button>
          <button
            aria-pressed={showEvents}
            onClick={() => {
              setShowEvents(true);
              chooseMode('fair');
            }}
          >
            Events & equal footing
          </button>
          <button
            aria-pressed={!showEvents}
            onClick={() => navigate('/game/challenges')}
          >
            Challenges
          </button>
        </nav>
      )}
      <div className="activity-stage__hero">
        <div className="activity-stage__copy">
          <span className="studio-eyebrow">
            <GameGlyph name={activityArt[activity]} icon={presentation.icon} color={presentation.color} />
            {storyNodeId ? 'Bring your best' : current.name}
          </span>
          <h1>{storyNodeId ? 'Who are you\nbringing?' : presentation.title}</h1>
          <p>{storyNodeId ? 'Choose your gang. The next chapter is waiting.' : current.description}</p>
          {current.normalized && !storyNodeId && (
            <span className="activity-stage__rule">
              <Shield size={13} /> Equal move tiers
            </span>
          )}
          {eventRule && (
            <details className="activity-stage__rules">
              <summary>
                Event rules <ArrowRight size={12} />
              </summary>
              <p>{eventRule}</p>
              {activity === 'neighborhood' && <small>Week of {week}</small>}
            </details>
          )}
        </div>
        <img
          key={activity}
          className="activity-stage__fighter"
          src={getCardImage(storyNodeId ? (chosen?.heroCardId ?? 'dr-fade') : presentation.portrait)}
          alt=""
          aria-hidden="true"
        />
        <div className="activity-stage__halo" aria-hidden="true" />
      </div>
      {!storyNodeId && (
        <nav className="activity-stage__modes" aria-label="Choose a battle activity">
          {activities
            .filter((item) => item.normalized === showEvents)
            .map((item) => {
              const Icon = presentations[item.id].icon;
              return (
                <button
                  type="button"
                  className="activity-choice"
                  key={item.id}
                  aria-pressed={activity === item.id}
                  onClick={() => chooseMode(item.id)}
                >
                  <GameGlyph name={activityArt[item.id]} icon={Icon} color={presentations[item.id].color} />
                  <strong>{item.name}</strong>
                  <span className="activity-choice__pip" />
                </button>
              );
            })}
        </nav>
      )}
      <section
        id="crew-picker"
        className="activity-stage__crew"
        aria-label={isDraft ? 'Street draft' : 'Choose your gang'}
      >
        {isDraft ? (
          <>
            <div className="activity-stage__section-title">
              <div>
                <span className="studio-eyebrow">Street draft · {week}</span>
                <h2>{picks.length < DECK_SIZE ? `Pick ${picks.length + 1} of ${DECK_SIZE}` : 'Your gang is ready.'}</h2>
              </div>
              {picks.length > 0 && (
                <button className="studio-text-action" onClick={() => setPicks(picks.slice(0, -1))}>
                  Undo last pick
                </button>
              )}
            </div>
            <p className="studio-notice">Borrowed for this event. Only cards you own earn Card XP.</p>
            {picks.length < DECK_SIZE && (
              <div className="activity-stage__draft">
                {offers[picks.length].map((id) => (
                  <div key={id}>
                    <CardView card={cards[id]} onClick={() => setPicks([...picks, id])} className="draft-choice" />
                    <button
                      className="studio-text-action"
                      onClick={() => setPicks([...picks, id])}
                      aria-label={`Draft ${cards[id].name}`}
                    >
                      Draft {cards[id].name}
                      <ArrowRight size={13} />
                    </button>
                    <p>{cards[id].effect}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="activity-stage__picks" aria-label={`${picks.length} of ${DECK_SIZE} cards drafted`}>
              {Array.from({ length: DECK_SIZE }, (_, i) => (
                <span key={i}>
                  {picks[i] ? (
                    <img src={getCardImage(cards[picks[i]].id)} alt={cards[picks[i]].name} />
                  ) : (
                    <b>{String(i + 1).padStart(2, '0')}</b>
                  )}
                </span>
              ))}
            </div>
            {picks.length === DECK_SIZE && (
              <button
                className="studio-action studio-action--gold"
                onClick={() =>
                  setSelected({
                    id: 'street-draft',
                    name: 'My Street Draft',
                    cards: picks.map((id) => cards[id].id),
                    hero: cards[picks[0]].id,
                    archetype: 'Your draft',
                    accent: 'DRAFT',
                    plan: 'Ten choices. Your gang.',
                  })
                }
              >
                Play this draft <ArrowRight size={16} />
              </button>
            )}
          </>
        ) : (
          <>
            <div className="activity-stage__section-title">
              <div>
                <span className="studio-eyebrow">Your corner</span>
                <h2>Bring your gang.</h2>
              </div>
              <button className="studio-text-action" onClick={() => navigate('/game/decks')}>
                Manage gangs <ArrowRight size={14} />
              </button>
            </div>
            {crews.length > 0 ? (
              <div className="activity-stage__crew-row">
                <DeckCarousel
                   decks={crews.map((deck) => ({
                    id: deck.id,
                    name: deck.name,
                    heroCardId: deck.heroCardId,
                    cardIds: deck.cardIds,
                     subtitle: saved.some(item => item.id === deck.id) ? 'YOUR GANG' : 'STARTER GANG',
                  }))}
                  selectedId={chosen.id}
                  onSelect={setCrewId}
                  onOpen={(id) => navigate(`/game/decks/${id}`)}
                  label="Choose your gang"
                  openLabel="Edit gang"
                />
                {!storyNodeId && (
                  <div style={{ padding: '0 20px 20px', marginTop: '-10px' }}>
                    {fightButton}
                  </div>
                )}
              </div>
            ) : (
              <div className="activity-stage__empty">
                <p>Build a ten-card gang to step into the circuit.</p>
                <button className="studio-action studio-action--gold" onClick={() => navigate('/game/decks')}>
                  Build your gang <ArrowRight size={17} />
                </button>
              </div>
            )}
            <details className="activity-stage__examples">
              <summary>Learning examples</summary>
              <div>
                {fallback.map((recipe) => (
                  <button
                    className="studio-text-action"
                    key={recipe.id}
                    onClick={() => navigate(`/game/decks/${recipe.id}`)}
                  >
                    {recipe.name}
                    <ArrowRight size={13} />
                  </button>
                ))}
              </div>
            </details>
          </>
        )}
      </section>
    </>
  );
  return (
    <section
      className={`studio-page activity-stage${storyNodeId ? ' activity-stage--story' : ''}`}
      style={
        {
          '--activity-color': presentation.color,
          '--activity-scene': `url("${getAssetUrl('assets/venues/red-fence-night-court.webp')}")`,
        } as React.CSSProperties
      }
    >
      {storyNodeId ? (
        <>
          <div className="activity-stage__story-content" role="region" aria-label="Choose your story gang" tabIndex={0}>
            {setup}
          </div>
          {crews.length > 0 && <footer className="activity-stage__story-start">{fightButton}</footer>}
        </>
      ) : setup}
    </section>
  );
}
