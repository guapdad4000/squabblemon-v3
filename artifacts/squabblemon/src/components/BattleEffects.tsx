import { CombatSprite } from './BattleArt';
import React, { useEffect, useRef, useState } from 'react';
import './battle-effects.css';

const fragments = Array.from({ length: 12 }, (_, index) => index);

/** Small, deterministic bursts: no animation loop or random render-time geometry. */
export function BattleBurst({ kind }: { kind: 'burn' | 'charge' | 'freeze' | 'snap' }) {
  return <span className={`battle-fx-burst fx-${kind}`} data-battle-fx={kind} aria-hidden="true">
    <span className="fx-shockwave" />
    {fragments.map(index => <i key={index} style={{ '--fx-angle': `${index * 30}deg`, '--fx-distance': `${42 + index % 3 * 18}px`, '--fx-delay': `${index % 4 * 24}ms` } as React.CSSProperties} />)}
    {kind === 'burn' && <><b className="fx-slash" /><b className="fx-slash fx-slash-second" /><span className="fx-scorch" /></>}
    {kind === 'charge' && <span className="fx-lightning">ϟ</span>}
  </span>;
}

export function BattleStatus({ frozen, silenced, protected: shielded }: { frozen?: boolean; silenced?: boolean; protected?: boolean }) {
  if (!frozen && !silenced && !shielded) return null;
  return <span className="battle-status-material" aria-hidden="true">
    {shielded && <span className="fx-guard-shell" />}
    {frozen && <span className="fx-ice-shell" data-battle-fx="ice-shell"><CombatSprite asset="freeze-rim" /><BattleBurst kind="freeze" /></span>}
    {(frozen || silenced) && <span className={`fx-restraints ${frozen ? 'is-iced' : ''}`} data-battle-fx="chains">{[0, 1].map(row => <span className="fx-chain" key={row}><CombatSprite asset="lock-chain-strand" /></span>)}<span className="fx-padlock"><CombatSprite asset="lock-padlock" /></span></span>}
  </span>;
}

export function DistrictEffects({ winner, locked, replaying }: { winner: 'player' | 'cpu' | 'draw'; locked: boolean; replaying: boolean }) {
  const previous = useRef(winner);
  const [snap, setSnap] = useState(0);
  useEffect(() => {
    const changed = previous.current !== winner;
    previous.current = winner;
    if (!changed || winner === 'draw' || replaying) { setSnap(0); return; }
    setSnap(value => value + 1);
    const timer = window.setTimeout(() => setSnap(0), 1100);
    return () => window.clearTimeout(timer);
  }, [winner, replaying]);
  return <>
    {locked && <div className="district-lock-material" aria-hidden="true"><BattleStatus frozen /></div>}
    {!!snap && <div key={snap} className={`district-snap fx-owner-${winner}`} data-battle-fx="district-snap" aria-hidden="true"><span className="district-snap-half" /><span className="district-snap-half" /><BattleBurst kind="snap" /><strong>{winner === 'player' ? 'TAKEN OVER' : 'RIVAL TERRITORY'}</strong></div>}
  </>;
}

export function MotionEnergy({ value, testId, replaying = false }: { value: number; testId: string; replaying?: boolean }) {
  const previous = useRef(value);
  const [gain, setGain] = useState<{ amount: number; key: number } | null>(null);
  useEffect(() => {
    const delta = value - previous.current;
    previous.current = value;
    if (delta <= 0 || replaying) { setGain(null); return; }
    setGain(old => ({ amount: delta, key: (old?.key ?? 0) + 1 }));
    const timer = window.setTimeout(() => setGain(null), 1000);
    return () => window.clearTimeout(timer);
  }, [value, replaying]);
  return <strong className="motion-energy" data-testid={testId}>{value}{gain && <span key={gain.key} className="motion-energy-gain"><BattleBurst kind="charge" /><b>+{gain.amount}</b></span>}</strong>;
}
