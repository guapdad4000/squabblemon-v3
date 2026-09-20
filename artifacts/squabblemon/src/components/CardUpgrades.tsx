import React from 'react';
import './card-upgrades.css';
import { LockKeyhole, Sparkles, Zap } from 'lucide-react';
import { unlockedAbilityUpgrades } from '@workspace/squabblemon-engine/abilityUpgrades';
import { catalogCardById } from '@workspace/squabblemon-engine/data';

type AuthoredUpgrade = {
  id?: string;
  name: string;
  description: string;
  unlockLevel?: number;
  level?: number;
  unlocked?: boolean;
  active?: boolean;
};

type UpgradeCarrier = {
  id?: string;
  cardId?: string;
  engineId?: string;
  upgrades?: readonly AuthoredUpgrade[];
  abilityUpgrades?: readonly AuthoredUpgrade[];
};

type UpgradeProgress = {
  moveTier?: number;
  level?: number;
  unlockedUpgradeIds?: string[];
  activeUpgradeIds?: string[];
};

export function getAuthoredCardUpgrades(card: UpgradeCarrier | null | undefined) {
  return card?.abilityUpgrades ?? card?.upgrades ?? [];
}

function engineCardId(card: UpgradeCarrier): string | undefined {
  return card.engineId ?? card.cardId ?? (card.id ? catalogCardById[card.id]?.engineId ?? card.id : undefined);
}

function upgradeState(card: UpgradeCarrier, upgrade: AuthoredUpgrade, progress?: UpgradeProgress, activeUpgradeIds?: string[]) {
  const cardId = engineCardId(card);
  const ids = activeUpgradeIds
    ?? progress?.activeUpgradeIds
    ?? progress?.unlockedUpgradeIds
    ?? (cardId && progress?.level !== undefined ? unlockedAbilityUpgrades(cardId, progress.level).slice(0, progress.moveTier).map((item: { id: string }) => item.id) : []);
  const identified = upgrade.id ? ids.includes(upgrade.id) : false;
  return { active: identified, newlyUnlocked: false };
}

export function CardUpgradeCue({
  card,
  progress,
  activeUpgradeIds,
  className = '',
}: {
  card: UpgradeCarrier | null | undefined;
  progress?: UpgradeProgress;
  activeUpgradeIds?: string[];
  className?: string;
}) {
  const upgrades = getAuthoredCardUpgrades(card);
  if (!upgrades.length) return null;
  const active = upgrades.filter(upgrade => upgradeState(card ?? {}, upgrade, progress, activeUpgradeIds).active);
  const next = upgrades.find(upgrade => !upgradeState(card ?? {}, upgrade, progress, activeUpgradeIds).active);
  return (
    <div data-testid="card-upgrade-cue" className={`card-upgrade-cue font-mono uppercase ${className}`}>
      <span className="card-upgrade-pips" aria-hidden="true">{upgrades.map((upgrade, index) => <i key={upgrade.id ?? index} data-active={upgradeState(card ?? {}, upgrade, progress, activeUpgradeIds).active} />)}</span>
      <span className="text-primary">{active.length ? `${active.length}/3 active` : '3 upgrades'}</span>
      {next && <span className="ml-1 text-white/55">· {(progress?.level ?? 0) >= (next.unlockLevel ?? next.level ?? 2) ? 'ready to train' : `next LV ${next.unlockLevel ?? next.level}`}</span>}
    </div>
  );
}

export function CardUpgrades({
  card,
  progress,
  activeUpgradeIds,
  newlyUnlockedIds = [],
  compact = false,
}: {
  card: UpgradeCarrier | null | undefined;
  progress?: UpgradeProgress;
  activeUpgradeIds?: string[];
  newlyUnlockedIds?: string[];
  compact?: boolean;
}) {
  const upgrades = getAuthoredCardUpgrades(card);
  if (!upgrades.length) return null;
  return (
    <section data-testid="card-upgrades" className={compact ? 'space-y-1' : 'space-y-2'}>
      {!compact && <div className="font-mono text-[9px] text-white/40 tracking-widest uppercase">Ability upgrades</div>}
      {upgrades.map((upgrade, index) => {
        const state = upgradeState(card ?? {}, upgrade, progress, activeUpgradeIds);
        const isNew = !!upgrade.id && newlyUnlockedIds.includes(upgrade.id);
        const level = upgrade.unlockLevel ?? upgrade.level;
        return (
          <div key={upgrade.id ?? `${upgrade.name}-${index}`} data-testid={`card-upgrade-${upgrade.id ?? index}`} data-active={state.active} data-new={isNew} className={`card-upgrade-plaque border px-2 py-1.5 ${state.active ? 'border-primary/50 bg-primary/10' : isNew || state.newlyUnlocked ? 'border-yellow-300/60 bg-yellow-300/10' : 'border-white/10 bg-black/30 opacity-70'}`}>
            <div className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-wider">
              {state.active ? <Zap size={11} className="text-primary" /> : isNew || state.newlyUnlocked ? <Sparkles size={11} className="text-yellow-200" /> : <LockKeyhole size={10} className="text-white/45" />}
              <b className="text-white">{upgrade.name}</b>
              <span className={`ml-auto ${state.active ? 'text-primary' : isNew || state.newlyUnlocked ? 'text-yellow-200' : 'text-white/45'}`}>{state.active ? 'Active' : isNew || state.newlyUnlocked ? 'New' : (progress?.level ?? 0) >= (level ?? 2) ? 'Train in shop' : `LV ${level}`}</span>
            </div>
            {!compact && <p className="mt-1 text-[11px] leading-snug text-white/65">{upgrade.description}</p>}
          </div>
        );
      })}
    </section>
  );
}
