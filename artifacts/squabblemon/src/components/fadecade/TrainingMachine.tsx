import { CrewPreview } from './CrewPreview';
import { StreetSelect } from '../ui/street-select';
import { useState } from 'react';
import { ArcadeCabinet } from './MachineScreen';
import { FadecadeDialog } from './FadecadeDialog';
import { activities, type ActivityId } from '@workspace/squabblemon-engine/activities';
import type { BattleConfig } from '../../pages/game/ChallengesHub';
import type { Deck } from '../../data';

const TRAINING_MODE_IDS: ActivityId[] = ['auto', 'fair', 'pressure', 'control', 'movement', 'support', 'freeze', 'cheap'];

export function TrainingMachine({ legalCrews, onBattle, initiallyOpen = false }: { initiallyOpen?: boolean; legalCrews: Deck[]; onBattle: (c: BattleConfig) => void }) {
  const [mode, setMode] = useState<ActivityId>('auto');
  const [crewId, setCrewId] = useState(legalCrews[0]?.id);
  const [isOpen, setIsOpen] = useState(initiallyOpen);

  const selectedActivity = activities.find(a => a.id === mode)!;
  const availableActivities = activities.filter(a => TRAINING_MODE_IDS.includes(a.id));

  return (
    <div className="fadecade-machine-group">
      <ArcadeCabinet
        artUrl="assets/fadecade/girl-fade.webp"
        aspectRatio={1.413}
        aperture={{ left: '17.51%', top: '27.2%', width: '66.43%', height: '52.15%' }}
        testId="fadecade-training"
        className="machine-small"
      >
        <div className="cabinet-ui">
          <h3 className="cabinet-title">Training Circuit</h3>
          <button
            className="cabinet-btn"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={`${isOpen ? 'Close' : 'Open'} training circuit`}
            aria-expanded={isOpen}
            aria-controls="training-setup"
          >
            {isOpen ? 'CLOSE' : 'OPEN'}
          </button>
        </div>
      </ArcadeCabinet>

      <FadecadeDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Training Circuit"
        kind="training"
      >
        <div className="fadecade-panel" id="training-setup" data-testid="panel-training">
          {!legalCrews.length && <p role="status">Create a legal owned ten-card crew before starting practice.</p>}
          <span className="challenge-field-label">01 / Choose your drill</span>
          <StreetSelect
            className="cabinet-select"
            value={mode}
            onValueChange={e => setMode(e as ActivityId)}
            aria-label="Select Training Mode"
          >
            {availableActivities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </StreetSelect>

          <p className="cabinet-notice" style={{ textTransform: 'none', margin: '0.5rem 0' }}>
            {selectedActivity.description}
          </p>

          <span className="challenge-field-label">02 / Bring your crew</span>
          <StreetSelect
            className="cabinet-select"
            value={crewId}
            onValueChange={e => setCrewId(e)}
            aria-label="Select Crew"
          >
            {legalCrews.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </StreetSelect>

          <CrewPreview crew={legalCrews.find(crew => crew.id === crewId)} />
          <button
            className="cabinet-btn"
            style={{ marginTop: '0.5rem' }}
            aria-label={`Practice ${selectedActivity.name}`}
            disabled={!legalCrews.some(crew => crew.id === crewId)}
            onClick={() => {
              const crew = legalCrews.find(c => c.id === crewId);
              if (crew) {
                onBattle({ mode: 'practice', activity: mode, customPlayerDeck: crew, initialDeckId: crew.id });
              }
            }}
          >
            PRACTICE
          </button>
        </div>
      </FadecadeDialog>
    </div>
  );
}
