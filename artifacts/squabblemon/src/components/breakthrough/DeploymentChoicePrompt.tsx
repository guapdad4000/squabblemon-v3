import { useEffect, useRef, type CSSProperties } from 'react';
import {
  deploymentChoices,
  type FighterDefinition,
  type GameState,
  type Lane,
} from '@workspace/squabblemon-engine/breakthrough';
import { getAssetUrl } from '../../lib/assets';
import './deploymentChoice.css';
export default function DeploymentChoicePrompt({
  game,
  card,
  lane,
  onChoose,
  onCancel,
}: {
  game: GameState;
  card: FighterDefinition;
  lane: Lane;
  onChoose(value: string): void;
  onCancel(): void;
}) {
  const ref = useRef<HTMLElement>(null);
  const plan = deploymentChoices(game, 'player', card.id, lane);
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    ref.current
      ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
      ?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, [card.id, lane]);
  return (
    <div
      className="bt-choice-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bt-choice-title"
        aria-describedby="bt-choice-motion"
        className="bt-choice"
        style={
          {
            '--bt-choice-wall': `url("${getAssetUrl('assets/progression/brick-ui-v1.webp')}")`,
          } as CSSProperties
        }
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
          }
          if (event.key === 'Tab') {
            const buttons = Array.from(
              ref.current?.querySelectorAll<HTMLButtonElement>(
                'button:not(:disabled)',
              ) ?? [],
            );
            const first = buttons[0],
              last = buttons.at(-1);
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
          event.stopPropagation();
        }}
      >
        <img src={card.art} alt="" draggable={false} />
        <div className="bt-choice-body">
          <small>LANE {lane + 1}</small>
          <h2 id="bt-choice-title">{card.name}</h2>
          <p className="bt-choice-rule">{plan.prompt}</p>
          <div className="bt-choice-options">
            {plan.options.map((option) => (
              <button
                key={option.value}
                disabled={option.disabled}
                onClick={() => onChoose(option.value)}
              >
                {option.label}
                <span aria-hidden="true">→</span>
              </button>
            ))}
          </div>
          <small id="bt-choice-motion">
            {Math.floor(game.players.player.motion)} MOTION
            {plan.error ? ` · ${plan.error}` : ''}
          </small>
        </div>
        <button
          className="bt-choice-cancel"
          aria-label="Cancel card choice"
          onClick={onCancel}
        >
          ×
        </button>
      </section>
    </div>
  );
}
