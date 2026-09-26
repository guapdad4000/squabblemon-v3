import { revealProfileRewards } from '../../lib/rewardReceipts';
import { GameGlyph } from '../../components/venue/GameGlyph';
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { customFetch, getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import { availableCareerChoices, readCareer } from '@workspace/squabblemon-engine/career';
import { ArrowRight, Check, FlaskConical, Medal, Shield, Shuffle, Wind } from 'lucide-react';
import { cardCatalog, catalogCardById, catalogCardByEngineId, getCardImage } from '../../data';
import { ProgressRing } from '../../components/venue/ProgressRing';

export function CareerBoard({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const client = useQueryClient(),
    lock = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [selected, setSelected] = useState<string | null>(null);
  const progress = readCareer(bootstrap.profile.storyProgress.gameplay),
    choices = availableCareerChoices(progress);
  const available = cardCatalog.filter(
    (c) => c.rarity === 'Common' && !bootstrap.profile.ownedCardIds.includes(c.catalogId),
  );
  const chosen = available.find((c) => c.catalogId === selected) ?? available[0];
  async function choose(cardId: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await customFetch<PlayerBootstrap>('/api/player/experiments/card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId }),
      });
      client.setQueryData(getGetPlayerBootstrapQueryKey(), result);
      revealProfileRewards(bootstrap, result, cardId, 'New gang member');
      setSelected(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not claim this card. Try again.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const milestones = [
    {
      done: progress.cleansed,
      label: 'Cleanse a friendly card',
      hint: 'Turn their disruption into your comeback.',
      icon: Shield,
    },
    {
      done: progress.movementWin,
      label: 'Win with a moved ally in a district you hold',
      hint: 'Put your footwork to work.',
      icon: Wind,
    },
    {
      done: progress.changedCrew,
      label: 'Test a changed gang after a previous practice fade',
      hint: 'Try a fresh lineup. Drafts excluded.',
      icon: Shuffle,
    },
  ];
  const badges = bootstrap.profile.unlockedCosmeticIds.filter((id) => id.startsWith('badge:'));
  return (
    <section className="career-stage" aria-label="Experiments and mastery">
      <div className="hustle-stage__section">
        <div>
          <span className="studio-eyebrow">
            <FlaskConical size={14} />
            Try something new
          </span>
          <h2>Your experiments. Your rewards.</h2>
          <p>
            Each first-time milestone earns one Common of your choice. Complete these in verified practice or events.
          </p>
        </div>
        <span className="career-stage__milestone-count">
          {milestones.filter((m) => m.done).length}
          <small>/ 3</small>
        </span>
      </div>
      <ul className="career-stage__experiments">
        {milestones.map((m) => (
          <li key={m.label} data-complete={m.done}>
            <span className="career-stage__experiment-icon">
              <GameGlyph icon={m.done ? Check : m.icon} color={m.done ? '#bfe1a4' : undefined} />
            </span>
            <div>
              <strong>{m.label}</strong>
              <p>{m.hint}</p>
            </div>
            <span>{m.done ? 'Complete' : '1 Common'}</span>
          </li>
        ))}
      </ul>
      {choices > 0 && (
        <section className="career-stage__reward" aria-label="Choose your Common reward">
          <span className="studio-eyebrow">
            {choices} card choice{choices === 1 ? '' : 's'} available
          </span>
          {chosen ? (
            <>
              <div className="career-stage__choices">
                {available.map((card) => (
                  <button
                    key={card.catalogId}
                    aria-pressed={chosen.catalogId === card.catalogId}
                    disabled={busy}
                    onClick={() => setSelected(card.catalogId)}
                  >
                    <img src={getCardImage(card.catalogId)} alt="" />
                    <span>{card.name}</span>
                  </button>
                ))}
              </div>
              <div className="career-stage__claim">
                <p>
                  <strong>{chosen.name}</strong>
                  <span>Common · Yours to keep</span>
                </p>
                <button
                  className="studio-action studio-action--gold"
                  disabled={busy}
                  onClick={() => void choose(chosen.catalogId)}
                >
                  {busy ? 'Claiming…' : `Claim ${chosen.name}`}
                  <ArrowRight size={15} />
                </button>
              </div>
            </>
          ) : (
            <p>You own every available Common. Your choices remain saved.</p>
          )}
        </section>
      )}
      {error && (
        <p className="studio-notice" role="alert">
          {error}
        </p>
      )}
      <div className="hustle-stage__section">
        <div>
          <span className="studio-eyebrow">
            <Medal size={14} />
            Earned on the streets
          </span>
          <h2>The wall of fame</h2>
          <p>Five victories with a character earns their gold mastery badge. Pure recognition, no extra Hands.</p>
        </div>
      </div>
      <div className="career-stage__gallery">
        {Object.entries(progress.wins).map(([id, wins]) => {
          const card = catalogCardById[id] ?? catalogCardByEngineId[id];
          return (
            <div data-notification-id={wins >= 5 ? `style:mastery:${id}` : undefined} className="career-stage__mastery" key={id} data-mastered={wins >= 5}>
              <div className="career-stage__portrait">
                <img src={getCardImage(id)} alt="" />
                <ProgressRing value={wins} max={5} label={`${card?.name ?? id} mastery`}>
                  {wins >= 5 ? <GameGlyph name="mastery" /> : `${wins}/5`}
                </ProgressRing>
              </div>
              <strong>{card?.name ?? id}</strong>
              <span>{wins >= 5 ? 'Mastered' : `${wins} of 5 victories`}</span>
            </div>
          );
        })}
      </div>
      {!Object.keys(progress.wins).length && (
        <p className="studio-notice">Your first winning lineup starts the wall.</p>
      )}
      {!!badges.length && (
        <div className="career-stage__medals">
          {badges.map((id) => (
            <div key={id} data-notification-id={`style:${id}`}>
              <GameGlyph name="mastery" />
              <strong>
                {(
                  {
                    'badge:after-hours': 'After-hours champion',
                    'badge:street-draft': 'Street draft winner',
                    'badge:neighborhood': 'Neighborhood champion',
                  } as Record<string, string>
                )[id] ?? id}
              </strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
