import { navigate } from 'wouter/use-browser-location';
import { ResultArtwork } from './ResultArtwork';
import { coachBattle } from '@workspace/squabblemon-engine/insights';
import { ArrowRight, RotateCcw, Star } from 'lucide-react';
import { BattleVictory } from './BattleVictory';
import { getEquippedVariant, getVariantKind } from './CardVariantTreatment';
import { decks, getCardImage } from '../data';
import { type Match, evaluateStoryStarObjectives, getDistrictResults, getMatchWinner } from '../gameEngine';
import { BattleEarnings } from './BattleEarnings';
import '../styles/studio.css';
import '../styles/result-stage.css';

export function ResultScreen({
  tutorial,
  onRestart,
  onChangeDeck,
  onGoHome,
  onTutorialComplete,
  onRetryReward,
  match,
  districts,
  reward,
  rewardError,
  rewardPending,
  isGuest,
  customPlayerDeck,
  storyMetadata,
  equippedVariants,
}: any) {
  const rebuild = () => isGuest ? onChangeDeck?.() : navigate('/game/decks');
  const m = match as Match;
  const results = getDistrictResults(m);
  const winner = getMatchWinner(m);
  const isVictory = winner === 'player',
    isDraw = winner === 'draw';
  const isStory = !tutorial && !!m.storyEncounter && !m.storyEncounter.activity;
  const isTutorial = Boolean(tutorial);
  const playerDeck = customPlayerDeck || decks.find((deck) => deck.id === m.playerDeck) || decks[0];
  const objectiveResults = evaluateStoryStarObjectives(m);
  const earnedStars = objectiveResults.filter((objective) => objective.achieved).length;
  const objectiveHits = new Map(objectiveResults.map((objective) => [objective.id, objective.achieved]));
  const retry = (
    <div className="result-stage__save" role="alert">
      <p>
        {isTutorial
          ? 'Tutorial completion could not be verified. Restart the guided fade and complete each highlighted lesson.'
          : isStory
            ? 'Failed to save outcome.'
            : 'Your rewards were not saved. Your battle result remains available on this screen.'}
      </p>
      {!isTutorial && (
        <button className="studio-text-action" onClick={onRetryReward} disabled={rewardPending}>
          <RotateCcw size={14} />
          {rewardPending ? 'Retrying' : 'Retry Save'}
        </button>
      )}
    </div>
  );

  const actions = (
        <nav className="result-stage__actions" aria-label="After the battle">
          {isStory ? (
            <>
              {storyMetadata?.outcome !== 'win' && (
                <button
                  className="studio-action studio-action--gold"
                  data-testid="button-restart-match"
                  onClick={onRestart}
                >
                  Retry Encounter
                  <RotateCcw size={15} />
                </button>
              )}
              <button
                className={`studio-action ${storyMetadata?.outcome === 'win' ? 'studio-action--gold' : ''}`}
                onClick={onGoHome}
              >
                Continue Chapter
                <ArrowRight size={15} />
              </button>
            </>
          ) : isTutorial ? (
            rewardError ? (
              <button
                className="studio-action studio-action--gold"
                data-testid="button-restart-tutorial"
                onClick={onRestart}
              >
                Restart Guided Fade
                <RotateCcw size={15} />
              </button>
            ) : (
              <button
                className="studio-action studio-action--gold"
                data-testid="button-complete-tutorial"
                onClick={onTutorialComplete}
                disabled={rewardPending || !reward || !onTutorialComplete}
              >
                {rewardPending || !reward ? 'Saving Tutorial' : 'Tutorial Complete · Continue'}
                <ArrowRight size={15} />
              </button>
            )
          ) : (
            <>
              <button
                className="studio-action studio-action--gold"
                data-testid="button-restart-match"
                onClick={onRestart}
              >
                Continue the fade
                <ArrowRight size={15} />
              </button>
              <button className="studio-action" data-testid="button-change-deck" onClick={rebuild}>
                Rebuild the deck
              </button>
              <button className="studio-text-action" onClick={onGoHome}>
                Home
              </button>
            </>
          )}
        </nav>
  );
  return (
    <div
      className={`battle-result-screen studio-results result-stage result-stage--art world-decor-host ${isVictory ? 'is-victory' : isDraw ? 'is-draw' : 'is-defeat'}`}
    >
      <div className="result-stage__content">
        <header className="result-stage__heading">
          <span className="studio-eyebrow">
            {isTutorial ? 'Rookie Road' : isStory ? 'Chapter battle' : m.storyEncounter?.activity ? 'The block circuit' : 'Fade complete'}
            <span>•</span>
            {isVictory ? 'Victory' : isDraw ? 'Draw' : 'Defeat'}
          </span>
          <h2 data-testid="status-match-result">
            {isVictory ? 'You Won The Room' : isDraw ? 'Nobody Owns The Room' : 'You Got Cleared'}
          </h2>
        </header>
        <ResultArtwork victory={isVictory} draw={isDraw} results={results} districts={districts}
          reward={reward} isGuest={isGuest} rewardError={rewardError} rewardPending={rewardPending}
          actions={actions} onRegroup={onGoHome} onTrain={onRestart} onRebuild={rebuild} />
        <div className="result-stage__receipt">

        {isStory && (
          <section className="result-stage__story" aria-label="Story outcome">
            {storyMetadata ? (
              <>
                <div className="result-stage__stars" aria-label={`${earnedStars} of 3 stars this run`}>
                  {[1, 2, 3].map((n) => (
                    <Star
                      key={n}
                      size={25}
                      fill={n <= earnedStars ? 'currentColor' : 'none'}
                      style={{ opacity: n <= earnedStars ? 1 : 0.25 }}
                    />
                  ))}
                </div>
                <p>
                  {storyMetadata.outcome === 'win'
                    ? storyMetadata.firstClear
                      ? `Encounter cleared · ${earnedStars} / 3 stars`
                      : `This run ${earnedStars} / 3 · Best ${storyMetadata.stars} / 3`
                    : 'Adjust your gang and claim the runback.'}
                </p>
                <details className="result-stage__details">
                  <summary>Star objectives</summary>
                  <ul>
                    {m.storyEncounter?.starObjectives?.map((objective) => (
                      <li key={objective.id}>
                        <Star size={13} fill={objectiveHits.get(objective.id) ? 'currentColor' : 'none'} />
                        {objective.description}
                        <span>{objectiveHits.get(objective.id) ? 'Earned' : 'Missed'}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </>
            ) : rewardError ? (
              retry
            ) : (
              <p className="studio-notice" role="status">
                Saving chapter outcome…
              </p>
            )}
            {reward?.storyRewards?.length > 0 && (
              <div className="result-stage__first-rewards">
                <span className="studio-eyebrow">First-clear rewards</span>
                {reward.storyRewards.map((r: any) => (
                  <p key={r.rewardKey}>{r.description}</p>
                ))}
              </div>
            )}
          </section>
        )}
        {isGuest ? (
          <p className="studio-notice result-stage__offline">
            Offline Training result — rewards are unsaved.
            <br />
            {customPlayerDeck ? 'Deck tests do not grant rewards.' : 'Sign in to save Card XP from your next run.'}
          </p>
        ) : !isStory && rewardError ? (
          retry
        ) : reward ? (
          <BattleEarnings reward={reward} showTotals={false} />
        ) : !isStory ? (
          <p className="studio-notice" role="status">
            Saving battle earnings…
          </p>
        ) : null}

        <details className="result-stage__details result-stage__crew-details">
          <summary>Battle breakdown · Your gang</summary>
          <figure className="result-stage__captain">
            <img className={`variant-portrait-${getVariantKind(getEquippedVariant(equippedVariants, playerDeck.hero)) ?? 'base'}`} src={getCardImage(playerDeck.hero)} alt="Your gang captain" />
            <figcaption>Your captain</figcaption>
          </figure>
          {isDraw ? <div className="result-stage__draw"><img src={getCardImage(playerDeck.hero)} alt="" /><span>Settle it in the next round.</span></div> : <BattleVictory match={m} winner={winner} equippedVariants={equippedVariants} />}
        </details>
        <aside className="result-stage__coach" aria-label="Dr. Fade advice">
          <img src={getCardImage('dr-fade')} alt="Dr. Fade" />
          <div>
            <span className="studio-eyebrow">Dr. Fade · Next time</span>
            <p>{coachBattle(m)}</p>
          </div>
        </aside>
        </div>
      </div>
    </div>
  );
}
