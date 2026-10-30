import { useId, type CSSProperties } from 'react';
import { getAssetUrl } from '../../lib/assets';
import { RULES } from '@workspace/squabblemon-engine/breakthrough';
import './howToPlay.css';

/** Shared player rules. Availability and reward promises belong to the calling surface. */
export default function BreakthroughHowToPlay() {
  const titleId = useId();
  return (
    <section className="bt-howto" aria-labelledby={titleId}
      style={{ '--bt-guide-brick': `url("${getAssetUrl('assets/progression/brick-ui-v1.webp')}")` } as CSSProperties}>
      <header className="bt-howto-heading">
        <small>KUMITE · REAL-TIME CARD BATTLE</small>
        <h3 id={titleId}>BREAK THEIR BASE.</h3>
        <p>Both sides play at once. No turns. No waiting for an animation.</p>
        <div className="bt-howto-stakes" aria-label="Match rules">
          <span><b>3</b> LANES</span>
          <span><b>{RULES.durationMs / 60000}:00</b> CLOCK</span>
          <span><b>2</b> BREACHES TO WIN</span>
        </div>
      </header>
      <ol className="bt-howto-beats">
        <li>
          <span className="bt-howto-number" aria-hidden="true">01</span>
          <div><h4>DROP YOUR CREW</h4>
            <p>Drag a card into a lane, or tap the card then the lane. Pay its yellow Motion cost. Fighters enter from your base and march toward The Opps.</p>
            <strong>Start {RULES.startingMotion} Motion · +1 every {1 / RULES.motionPerSecond} seconds · cap {RULES.motionCap}</strong>
            <p className="bt-howto-tip">Have the Motion? Play again immediately, even in the same lane.</p>
          </div>
        </li>
        <li>
          <span className="bt-howto-number" aria-hidden="true">02</span>
          <div><h4>HANDS SETTLE IT</h4>
            <p>Opposing fighters collide in their lane. Each loses the other’s Hands at the same time. The survivor keeps marching with what’s left.</p>
            <div className="bt-howto-clash" aria-label="Without abilities or protection: 7 Hands against 5 Hands leaves the 7-Hands fighter alive with 2 Hands.">
              <b>7</b><span>vs</span><b>5</b><span>→</span><b className="bt-howto-survivor">2</b><small>LEFT STANDING*</small>
            </div>
            <p className="bt-howto-tip">*Abilities, Protection and other defenses can change the outcome. Tap a fighter for its Breakthrough rules.</p>
          </div>
        </li>
        <li>
          <span className="bt-howto-number" aria-hidden="true">03</span>
          <div><h4>BREAK THROUGH TWICE</h4>
            <p>A fighter reaching the enemy base scores one breach and leaves the field. Score two before The Opps do. Any lane can score again.</p>
            <strong>Any lane · one breach per scoring fighter</strong>
            <p className="bt-howto-tip">Support and Action cards resolve their effects; they do not march or breach. Some summoned pieces cannot breach either.</p>
          </div>
        </li>
        <li>
          <span className="bt-howto-number" aria-hidden="true">04</span>
          <div><h4>LAST STAND · {RULES.lastStandMs / 1000}s</h4>
            <p>Draws stop for the final {RULES.lastStandMs / 1000} seconds. Motion keeps refilling. Play what’s left and protect your lead.</p>
            <strong>At 0:00 → most breaches → most surviving Hands → draw</strong>
            <p className="bt-howto-tip">Only fighters on the field count toward Hands. Cards in your hand or returning to the deck do not.</p>
          </div>
        </li>
      </ol>
      <p className="bt-howto-availability" role="note"><strong>BETA IN PREPARATION</strong> Current preview is local CPU practice, with no account rewards. Online matchmaking and its rewards are not live.</p>
      <details className="bt-howto-detail">
        <summary>SQUABBLE · YOUR ONE BIG PUSH</summary>
        <p>Arm Squabble before deploying a fighter to double that fighter’s deployment base Hands. You get one successful Squabble per match; its Motion cost is unchanged. Bonus Hands from effects are separate. Action cards cannot Squabble.</p>
      </details>
      <details className="bt-howto-detail">
        <summary>DRAWS, DECKS &amp; RETURNING CARDS</summary>
        <p>Bring ten unique owned cards in a valid saved deck, with your captain. Base stats apply; collection upgrades do not. Begin with {RULES.handSize} cards. Draw one every {RULES.drawMs / 1000} seconds while there is room and a card is ready.</p>
        <p>A defeated or scoring deck fighter, or a played Action, normally waits {RULES.returnMs / 1000} seconds before joining the back of the draw queue. It is not an instant redraw. Card-specific return effects can change this. Last Stand locks draws permanently, even if an effect extends the clock.</p>
      </details>
      <details className="bt-howto-detail">
        <summary>ABILITIES, FREEZE &amp; CLOSE FINISHES</summary>
        <p>Use the in-battle explanation, because effects are adapted for this real-time mode. Effects based on rounds use timed beats, commonly 10 seconds; final-round effects use Last Stand. Cards requiring a choice ask you before spending Motion.</p>
        <p>Freeze stops only that fighter. Teammates can pass. A frozen fighter contributes 0 effective Hands in combat and at timeout, and loses to a positive-Hands contact unless a defense prevents it. Silence and Weaken disable active abilities without stopping movement; inspect the card for duration and exceptions.</p>
        <p>Two second breaches on the same simulation tick are a draw. Otherwise two breaches end the match immediately. At timeout a breach lead wins even against more Hands; tied breaches use all surviving effective Hands, then a draw.</p>
      </details>
    </section>
  );
}
