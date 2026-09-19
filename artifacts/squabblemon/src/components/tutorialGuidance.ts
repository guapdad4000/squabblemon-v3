import type { EffectLogEntry, Match, Statuses } from '../gameEngine';

export const TUTORIAL_STEP_IDS = [
  'r1_choose_card',
  'r1_choose_district',
  'r1_play_card',
  'r1_end_turn',
  'r2_choose_card',
  'r2_choose_district',
  'r2_play_card',
  'r2_end_turn',
  'r3_bank_motion',
  'r4_choose_card',
  'r4_arm_squabble',
  'r4_choose_district',
  'r4_play_squabble',
  'r4_end_turn',
  'free_play',
] as const;

export type TutorialStepId = (typeof TUTORIAL_STEP_IDS)[number];
export type TutorialFocus = 'card' | 'district' | 'play' | 'end-turn' | 'squabble' | 'free';

export type TutorialGuidance = {
  id: TutorialStepId;
  round: number;
  focus: TutorialFocus;
  title: string;
  body: string;
};

type TutorialGuidanceInput = {
  match: Match;
  selectedInstanceId: string | null;
  selectedLane: number | null;
  squabble: boolean;
  playsThisRound: number;
};

const playSequence = (
  round: number,
  prefix: 'r1' | 'r2',
  selectedInstanceId: string | null,
  selectedLane: number | null,
  playsThisRound: number,
): TutorialGuidance => {
  if (playsThisRound > 0) {
    return {
      id: `${prefix}_end_turn`, round, focus: 'end-turn', title: 'Let the rival answer',
      body: 'You can keep playing while you have Motion. For this lesson, end your turn and watch the rival respond.',
    };
  }
  if (!selectedInstanceId) {
    return {
      id: `${prefix}_choose_card`, round, focus: 'card', title: round === 1 ? 'Choose your first fighter' : 'Read the room',
      body: round === 1
        ? 'Cards cost Motion and add Hands to a district. Choose any lit card you can afford.'
        : 'Every district changes the fight. Choose an affordable card, then check each district rule before placing it.',
    };
  }
  if (selectedLane === null) {
    return {
      id: `${prefix}_choose_district`, round, focus: 'district', title: round === 1 ? 'Pick a district' : 'Use the location rule',
      body: round === 1
        ? 'Choose a lit district. You need to lead in two of the three districts when the match ends.'
        : 'Choose the district whose rule and current score give this card the best job.',
    };
  }
  return {
    id: `${prefix}_play_card`, round, focus: 'play', title: 'Commit the play',
    body: 'The preview shows the known score after your card lands. Play the card to resolve it now.',
  };
};

export function getTutorialGuidance({
  match, selectedInstanceId, selectedLane, squabble, playsThisRound,
}: TutorialGuidanceInput): TutorialGuidance {
  if (match.round === 1) return playSequence(1, 'r1', selectedInstanceId, selectedLane, playsThisRound);
  if (match.round === 2) return playSequence(2, 'r2', selectedInstanceId, selectedLane, playsThisRound);
  if (match.round === 3) {
    return {
      id: 'r3_bank_motion', round: 3, focus: selectedInstanceId ? 'card' : 'end-turn', title: 'Bank one Motion',
      body: selectedInstanceId
        ? 'Tap the selected card again to clear it. Then end your turn without playing.'
        : 'End your turn now. Up to 1 unspent Motion carries into the next round, so patience can fund a bigger play.',
    };
  }
  if (match.round === 4) {
    if (match.squabbleUsed) {
      return playsThisRound > 0
        ? {
          id: 'r4_end_turn', round: 4, focus: 'end-turn', title: 'Pressure applied',
          body: 'Your SQUABBLE is spent for this match. End the turn and see if the rival can answer the doubled Base Hands.',
        }
        : {
          id: 'free_play', round: 4, focus: 'free', title: 'SQUABBLE already spent',
          body: 'You used your once-per-match SQUABBLE earlier. Read the scores and play this round your way.',
        };
    }
    if (!selectedInstanceId) {
      return {
        id: 'r4_choose_card', round: 4, focus: 'card', title: 'Set up your SQUABBLE',
        body: 'Choose an affordable card. SQUABBLE can double one card’s Base Hands once per match.',
      };
    }
    if (!squabble) {
      return {
        id: 'r4_arm_squabble', round: 4, focus: 'squabble', title: 'Arm SQUABBLE',
        body: 'Press SQUABBLE now. It doubles printed Base Hands before other bonuses and costs no extra Motion.',
      };
    }
    if (selectedLane === null) {
      return {
        id: 'r4_choose_district', round: 4, focus: 'district', title: 'Choose the swing district',
        body: 'Put the doubled card where it can take or protect a district. You only get one SQUABBLE each match.',
      };
    }
    return {
      id: 'r4_play_squabble', round: 4, focus: 'play', title: 'Send it',
      body: 'Play the armed card. The preview includes its doubled Base Hands and known location effects.',
    };
  }
  return {
    id: 'free_play', round: match.round, focus: 'free', title: 'Run the room',
    body: 'Use what you learned: spend Motion with purpose, read each district, and finish ahead in at least two.',
  };
}

export const MECHANIC_LESSON_IDS = [
  'burn', 'freeze', 'cleanse', 'protect', 'blocked', 'weaken', 'silence', 'movement', 'lock', 'boost',
] as const;

export type MechanicLessonId = (typeof MECHANIC_LESSON_IDS)[number];
export type MechanicLesson = {
  id: MechanicLessonId;
  name: string;
  summary: string;
  tacticalTip: string;
};

export const MECHANIC_LESSONS: Record<MechanicLessonId, MechanicLesson> = {
  burn: {
    id: 'burn', name: 'Burn',
    summary: 'Burn stacks remove that many Hands at round end, then the stacks clear.',
    tacticalTip: 'Cleanse it before round end or plan around the coming score loss.',
  },
  freeze: {
    id: 'freeze', name: 'Frozen',
    summary: 'A Frozen card adds 0 Hands and its ability cannot fire until it is cleansed.',
    tacticalTip: 'A frozen card still occupies its district, so a cleanse can bring it back online.',
  },
  cleanse: {
    id: 'cleanse', name: 'Cleanse',
    summary: 'Cleanse removes Burn, Freeze, Silence, Weaken, and Lock from a card.',
    tacticalTip: 'Friendly buffs such as protection and Boost stay in place.',
  },
  protect: {
    id: 'protect', name: 'Protection',
    summary: 'Protection blocks a targeted hostile effect. Some shields last for the round; Cover lasts until spent.',
    tacticalTip: 'Use protection before the rival targets your most valuable fighter.',
  },
  blocked: {
    id: 'blocked', name: 'Blocked',
    summary: 'The incoming targeted effect was stopped, so its intended change did not land.',
    tacticalTip: 'The protection that stopped it may now be spent; check the card status before the next attack.',
  },
  weaken: {
    id: 'weaken', name: 'Weakened',
    summary: 'A Weakened card keeps its Hands but cannot fire its ability.',
    tacticalTip: 'Cleanse restores the ability. The card can still help hold its district meanwhile.',
  },
  silence: {
    id: 'silence', name: 'Silenced',
    summary: 'A Silenced card keeps its Hands but cannot fire its ability.',
    tacticalTip: 'Play for its raw Hands or cleanse it before you need the ability.',
  },
  movement: {
    id: 'movement', name: 'Movement',
    summary: 'An ability moved a card to another district after it was already in play.',
    tacticalTip: 'Recheck both district scores after movement; one move can swing two districts.',
  },
  lock: {
    id: 'lock', name: 'Locked',
    summary: 'A Locked card cannot be moved to another district until it is cleansed.',
    tacticalTip: 'Its Hands still count where it stands. Cleanse it if repositioning matters.',
  },
  boost: {
    id: 'boost', name: 'Boost',
    summary: 'A Boosted card gains +1 Hands at every round end while Boost remains active.',
    tacticalTip: 'Early Boosts compound over several rounds, so answer them before they grow.',
  },
};

export const MECHANIC_LESSON_STORAGE_KEY = 'squabblemon_mechanic_lessons_v1';

const isLessonId = (value: unknown): value is MechanicLessonId =>
  typeof value === 'string' && (MECHANIC_LESSON_IDS as readonly string[]).includes(value);

export function readSeenMechanicLessons(storage?: Pick<Storage, 'getItem'> | null): Set<MechanicLessonId> {
  if (!storage) return new Set();
  try {
    const parsed = JSON.parse(storage.getItem(MECHANIC_LESSON_STORAGE_KEY) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter(isLessonId) : []);
  } catch {
    return new Set();
  }
}

export function writeSeenMechanicLessons(
  seen: ReadonlySet<MechanicLessonId>,
  storage?: Pick<Storage, 'setItem'> | null,
): void {
  if (!storage) return;
  try {
    storage.setItem(MECHANIC_LESSON_STORAGE_KEY, JSON.stringify(
      MECHANIC_LESSON_IDS.filter(id => seen.has(id)),
    ));
  } catch {
    // Coaching persistence is optional and must never interrupt a match.
  }
}

const statusBecameTrue = (
  participants: EffectLogEntry['targets'],
  key: Exclude<keyof Statuses, 'burnStacks'>,
) => participants.some(({ before, after }) => Boolean(after?.statuses[key]) && !before?.statuses[key]);

const statusCleared = (before: Statuses, after: Statuses) =>
  (before.frozen && !after.frozen)
  || (before.silenced && !after.silenced)
  || (before.weakened && !after.weakened)
  || (before.locked && !after.locked)
  || (before.burnStacks > 0 && after.burnStacks === 0);

export function detectMechanicLessons(event: EffectLogEntry): MechanicLessonId[] {
  const participants = [event.source, ...event.targets].filter((item): item is NonNullable<typeof item> => Boolean(item));
  const detected = new Set<MechanicLessonId>();
  if (participants.some(({ before, after }) => (after?.statuses.burnStacks ?? 0) > (before?.statuses.burnStacks ?? 0))) detected.add('burn');
  if (statusBecameTrue(participants, 'frozen')) detected.add('freeze');
  if (/cleans/i.test(event.note) && participants.some(({ before, after }) => before && after && statusCleared(before.statuses, after.statuses))) detected.add('cleanse');
  if (statusBecameTrue(participants, 'protected')) detected.add('protect');
  if (statusBecameTrue(participants, 'blocked') || event.kind === 'blocked') detected.add('blocked');
  if (statusBecameTrue(participants, 'weakened')) detected.add('weaken');
  if (statusBecameTrue(participants, 'silenced')) detected.add('silence');
  if (event.kind === 'move' && participants.some(({ before, after }) => before?.lane !== null && after?.lane !== null && before?.lane !== after?.lane)) detected.add('movement');
  if (statusBecameTrue(participants, 'locked')) detected.add('lock');
  if (statusBecameTrue(participants, 'boosted')) detected.add('boost');
  return MECHANIC_LESSON_IDS.filter(id => detected.has(id));
}

export function findFirstUnseenMechanicLesson(
  event: EffectLogEntry,
  seen: ReadonlySet<MechanicLessonId>,
): MechanicLesson | null {
  const id = detectMechanicLessons(event).find(candidate => !seen.has(candidate));
  return id ? MECHANIC_LESSONS[id] : null;
}
