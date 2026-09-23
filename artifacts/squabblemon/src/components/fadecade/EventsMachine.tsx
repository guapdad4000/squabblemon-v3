import { useState } from 'react';
import { ArcadeCabinet } from './MachineScreen';
import { FadecadeDialog } from './FadecadeDialog';
import { activities, type ActivityId, draftOffers, eventWeek, makeActivityEncounter } from '@workspace/squabblemon-engine/activities';
import { getCardImage, type Deck, DECK_SIZE } from '../../data';
import type { BattleConfig } from '../../pages/game/ChallengesHub';

export function EventsMachine({ legalCrews, onBattle }: { legalCrews: Deck[]; onBattle: (c: BattleConfig) => void }) {
  const [tab, setTab] = useState<'draft' | 'events'>('draft');
  const [eventMode, setEventMode] = useState<ActivityId>('neighborhood');
  const [crewId, setCrewId] = useState(legalCrews[0]?.id);
  const [isOpen, setIsOpen] = useState(false);

  const [picks, setPicks] = useState<string[]>([]);
  const [week] = useState(eventWeek);
  const offers = draftOffers(week);

  const eventRule = makeActivityEncounter(eventMode, 'preview', 'block', week).passive?.description;

  return (
    <div className="fadecade-machine-group">
      <ArcadeCabinet
        artUrl="assets/fadecade/funk-punk.webp"
        aspectRatio={1.4}
        aperture={{ left: '17.28%', top: '28.48%', width: '66.76%', height: '51.64%' }}
        testId="fadecade-events"
        className="machine-small"
      >
        <div className="cabinet-ui">
          <h3 className="cabinet-title">Street Events</h3>
          <button
            className="cabinet-btn"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={`${isOpen ? 'Close' : 'Open'} street events`}
            aria-expanded={isOpen}
            aria-controls="events-setup"
          >
            {isOpen ? 'CLOSE' : 'OPEN'}
          </button>
        </div>
      </ArcadeCabinet>

      <FadecadeDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Street Events"
        kind="events"
      >
        <div className="fadecade-panel" id="events-setup" data-testid="panel-events">
          {!legalCrews.length && <p role="status">Create a legal owned ten-card crew before entering an event.</p>}
          <div style={{ display: 'flex', gap: '1rem', flex: 'none' }}>
            <button
              className={`cabinet-btn ${tab === 'draft' ? '' : 'cabinet-btn--outline'}`}
              style={{ flex: 1 }}
              onClick={() => setTab('draft')}
              aria-label="View Draft"
            >
              DRAFT
            </button>
            <button
              className={`cabinet-btn ${tab === 'events' ? '' : 'cabinet-btn--outline'}`}
              style={{ flex: 1 }}
              onClick={() => setTab('events')}
              aria-label="View Events"
            >
              EVENTS
            </button>
          </div>

          {tab === 'draft' ? (
            picks.length < DECK_SIZE ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <span className="cabinet-notice">Pick {picks.length + 1} of {DECK_SIZE}</span>
                <div className="draft-grid" style={{ marginBottom: 'auto' }}>
                  {offers[picks.length].map(id => (
                    <button key={id} className="draft-card-btn" onClick={() => setPicks([...picks, id])} aria-label={`Draft card ${id}`}>
                      <img src={getCardImage(id)} alt="" />
                    </button>
                  ))}
                </div>
                {picks.length > 0 && (
                  <button className="cabinet-btn cabinet-btn--outline" onClick={() => setPicks(picks.slice(0, -1))} aria-label="Undo last pick">
                    UNDO LAST PICK
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <span className="cabinet-notice">Crew Ready!</span>
                <button
                  className="cabinet-btn"
                  disabled={!legalCrews.length}
                  onClick={() => {
                    const crew = legalCrews.find(c => c.id === crewId) ?? legalCrews[0];
                    if (crew) {
                      onBattle({ mode: 'practice', activity: 'draft', draftWeek: String(week), draftPicks: picks, customPlayerDeck: crew, initialDeckId: crew.id });
                    }
                  }}
                  aria-label="Enter draft run"
                >
                  ENTER DRAFT RUN
                </button>
                <button className="cabinet-btn cabinet-btn--outline" onClick={() => setPicks([])} aria-label="Restart draft">
                  REDRAFT
                </button>
              </div>
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <select
                className="cabinet-select"
                value={eventMode}
                onChange={e => setEventMode(e.target.value as ActivityId)}
                aria-label="Select Event"
              >
                {activities.filter(activity => activity.id === 'neighborhood' || activity.id === 'boss').map(activity => <option key={activity.id} value={activity.id}>{activity.name}</option>)}
              </select>

              <p className="cabinet-notice" style={{ textTransform: 'none' }}>
                {eventMode === 'neighborhood' ? `Week ${week}: ${eventRule}` : eventRule || 'Defeat the boss.'}
              </p>

              <select
                className="cabinet-select"
                value={crewId}
                onChange={e => setCrewId(e.target.value)}
                aria-label="Select Crew"
              >
                {legalCrews.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              <button
                className="cabinet-btn"
                disabled={!legalCrews.some(crew => crew.id === crewId)}
                aria-label={`Play ${eventMode} event`}
                onClick={() => {
                  const crew = legalCrews.find(c => c.id === crewId);
                  if (crew) {
                    onBattle({ mode: 'practice', activity: eventMode, customPlayerDeck: crew, initialDeckId: crew.id });
                  }
                }}
              >
                PLAY EVENT
              </button>
            </div>
          )}
        </div>
      </FadecadeDialog>
    </div>
  );
}
