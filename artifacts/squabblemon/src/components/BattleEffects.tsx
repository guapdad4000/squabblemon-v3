import { CombatSprite } from './BattleArt';
import React, { useEffect, useRef, useState } from 'react';
import './battle-effects.css';

const fragments = Array.from({ length: 12 }, (_, index) => ({ '--fx-angle': `${index * 30}deg`, '--fx-distance': `${42 + index % 3 * 18}px`, '--fx-delay': `${index % 4 * 24}ms` } as React.CSSProperties));

/** Small, deterministic bursts: no animation loop or random render-time geometry. */
export function BattleBurst({ kind }: { kind: 'burn' | 'charge' | 'freeze' | 'snap' }) {
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    setFinished(false);
    // The last fragment ends at 872ms. Keep a margin, then release invisible
    // particles without disturbing persistent frozen/locked status artwork.
    const timer = window.setTimeout(() => setFinished(true), 950);
    return () => window.clearTimeout(timer);
  }, [kind]);
  if (finished) return null;
  return <span className={`battle-fx-burst fx-${kind}`} data-battle-fx={kind} aria-hidden="true">
    <span className="fx-shockwave" />
    {fragments.map((style, index) => <i key={index} style={style} />)}
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
  // Derived during render so a district flip does not cost an extra battle commit.
  const [state, setState] = useState({ winner, replaying, snap: 0 });
  if (state.winner !== winner || state.replaying !== replaying) {
    const changed = state.winner !== winner;
    setState({ winner, replaying, snap: !changed || winner === 'draw' || replaying ? 0 : state.snap + 1 });
  }
  const snap = state.winner === winner && state.replaying === replaying ? state.snap : 0;
  const snapNode = useRef<HTMLDivElement>(null);
  // Expire the burst in the DOM; clearing state here re-rendered the whole battle.
  useEffect(() => {
    if (!snap) return;
    const timer = window.setTimeout(() => { if (snapNode.current) snapNode.current.style.display = 'none'; }, 1100);
    return () => window.clearTimeout(timer);
  }, [snap]);
  return <>
    {locked && <div className="district-lock-material" aria-hidden="true"><BattleStatus frozen /></div>}
    {!!snap && <div ref={snapNode} key={snap} className={`district-snap fx-owner-${winner}`} data-battle-fx="district-snap" aria-hidden="true"><span className="district-snap-half" /><span className="district-snap-half" /><BattleBurst kind="snap" /><strong>{winner === 'player' ? 'TAKEN OVER' : 'RIVAL TERRITORY'}</strong></div>}
  </>;
}

export function MotionEnergy({ value, testId, replaying = false }: { value: number; testId: string; replaying?: boolean }) {
  // Derived during render so a Motion gain does not cost an extra battle commit.
  const [state, setState] = useState<{ value: number; replaying: boolean; key: number; gain: { amount: number; key: number } | null }>({ value, replaying, key: 0, gain: null });
  if (state.value !== value || state.replaying !== replaying) {
    const delta = value - state.value;
    const key = delta > 0 && !replaying ? state.key + 1 : state.key;
    setState({ value, replaying, key, gain: delta > 0 && !replaying ? { amount: delta, key } : null });
  }
  const gain = state.value === value && state.replaying === replaying ? state.gain : null;
  const gainKey = gain?.key;
  const gainNode = useRef<HTMLSpanElement>(null);
  // Expire the gain in the DOM; clearing state here re-rendered the whole battle.
  useEffect(() => {
    if (gainKey === undefined) return;
    const timer = window.setTimeout(() => { if (gainNode.current) gainNode.current.style.display = 'none'; }, 1000);
    return () => window.clearTimeout(timer);
  }, [gainKey]);
  return <strong className="motion-energy" data-testid={testId}>{value}{gain && <span ref={gainNode} key={gain.key} className="motion-energy-gain"><BattleBurst kind="charge" /><b>+{gain.amount}</b></span>}</strong>;
}
