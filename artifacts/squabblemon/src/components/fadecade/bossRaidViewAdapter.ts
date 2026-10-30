import type { CSSProperties, ReactNode } from 'react';
import type { BossRaid, BossStatus } from '@workspace/squabblemon-engine/bossRaid';
import type { CardInstance, Lane } from '../../gameEngine';
import type { bossBlastPreview } from '@workspace/squabblemon-engine/bossRaid';
import type { raidIdentity } from './bossRaidPresentation';

import type { RaidCinematicPresentation } from "./RaidCinematicHero";
export type { RaidCinematicPresentation } from "./RaidCinematicHero";

/** Present a different authoritative raid through the established raid field,
 * selection, inspection and hand controls. This view projection is never persisted
 * or submitted to the legacy boss rules. All intents use the caller's native API. */
export type BossRaidViewAdapter = {
  status: BossStatus;
  identity: ReturnType<typeof raidIdentity>;
  stageLabel: string;
  mode: string;
  background: string;
  cinematic: RaidCinematicPresentation;
  preview: ReturnType<typeof bossBlastPreview>;
  canPlay: (run: BossRaid, card: CardInstance, lane: Lane, squabble: boolean, investment: number) => boolean;
  cardCost: (run: BossRaid, card: CardInstance, lane: Lane, squabble: boolean, investment: number) => number;
  extraChoices?: (card: CardInstance) => { label: string; defaultValue: number; options: readonly { value: number; label: string }[] } | null;
  directive: ReactNode;
  persistenceNote: ReactNode;
  helpContent: ReactNode;
  retire: { title: string; description: string; action: string };
  districtRules: readonly { name: string; rule: string; objective: string }[];
  hit?: boolean;
  targetLane?: Lane;
  tabletLanes?: readonly Lane[];
  renderEnemy?: (card: CardInstance, options: { paused: boolean; reducedMotion: boolean }) => ReactNode;
  style?: CSSProperties;
};
