import React, { useEffect, useMemo, useState } from "react";
import "./_group.css";

type Phase = { key: string; label: string; note: string; color: string };
const phases: Phase[] = [
  { key: "lock", label: "LOCK IN", note: "commit is explicit", color: "#983d35" },
  { key: "reveal", label: "PLAYER REVEAL", note: "source becomes legible", color: "#a9782f" },
  { key: "travel", label: "TRAVEL", note: "card crosses to district", color: "#52635a" },
  { key: "impact", label: "IMPACT", note: "cause meets target", color: "#983d35" },
  { key: "ability", label: "ABILITIES", note: "effects stay readable", color: "#a9782f" },
  { key: "rival", label: "RIVAL", note: "opponent answers", color: "#52635a" },
  { key: "resolve", label: "RESOLVE", note: "district Power flips", color: "#983d35" },
];

function Arrow() { return <span className="mx-2 text-[var(--red)]" aria-hidden="true">→</span>; }

function Section({ id, index, title, lead, children, priority }: { id: string; index: string; title: string; lead: string; children: React.ReactNode; priority: string }) {
  return <section id={id} className="border-t border-[var(--line)] py-12 md:py-16">
    <div className="grid gap-7 lg:grid-cols-[190px_1fr]">
      <div><div className="eyebrow">{index} / {priority}</div><div className="mt-3 h-px w-12 bg-[var(--red)]" /></div>
      <div><h2 className="display text-3xl font-extrabold tracking-[-.04em] md:text-5xl">{title}</h2><p className="mt-3 max-w-2xl text-[15px] leading-7 text-[var(--muted)]">{lead}</p>{children}</div>
    </div>
  </section>;
}

function Callout({ label, children, tone = "gold" }: { label: string; children: React.ReactNode; tone?: "gold" | "red" | "sage" }) {
  const color = tone === "red" ? "var(--red)" : tone === "sage" ? "var(--sage)" : "var(--gold)";
  return <div className="border-l-2 pl-4 text-sm leading-6" style={{ borderColor: color }}><div className="mono mb-1 text-[9px] font-bold uppercase tracking-[.16em]" style={{ color }}>{label}</div>{children}</div>;
}

function Timeline({ active, onSelect }: { active: number; onSelect: (n: number) => void }) {
  const [replayStep, setReplayStep] = useState<number | null>(null);
  const [replaying, setReplaying] = useState(false);
  const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    if (!replaying || reducedMotion) return;
    const id = window.setInterval(() => setReplayStep(v => v === null || v >= phases.length - 1 ? 0 : v + 1), 620);
    return () => window.clearInterval(id);
  }, [replaying, reducedMotion]);
  const shown = replayStep ?? active;
  const cancelReplay = () => { setReplaying(false); setReplayStep(null); onSelect(0); };
  return <div className="blueprint overflow-hidden p-4 md:p-5">
    <div className="mb-4 flex items-center justify-between"><div className="eyebrow">Storyboard / actual PlayLoop phases</div><div className="mono text-[10px] text-[var(--muted)]">STEP {active + 1} / {phases.length}</div></div>
    <div className="flex flex-wrap items-center gap-y-3">
      {phases.map((p, i) => <React.Fragment key={p.key}><button onClick={() => { setReplaying(false); setReplayStep(null); onSelect(i); }} aria-pressed={shown === i} className={`min-w-[96px] flex-1 border px-2 py-3 text-left transition-opacity ${shown === i ? "bg-[#2c2925] text-[#f2e7d2]" : "bg-transparent hover:opacity-70"}`} style={{ borderColor: p.color }}>
        <div className="mono text-[9px]" style={{ color: shown === i ? "#d7ad61" : p.color }}>{String(i + 1).padStart(2, "0")}</div><div className="mt-1 text-[10px] font-bold leading-3">{p.label}</div><div className={`mt-2 text-[9px] ${shown === i ? "text-[#c9c0b3]" : "text-[var(--muted)]"}`}>{p.note}</div>
      </button>{i < phases.length - 1 && <span className="hidden px-1 text-[var(--line)] md:inline">›</span>}</React.Fragment>)}
    </div>
    <div className="mt-4 border-t border-[var(--line)] pt-4"><div className="grid gap-5 md:grid-cols-[1fr_250px]"><div><div className="display text-xl font-bold" style={{ color: phases[shown].color }}>{phases[shown].label}</div><p className="mt-1 text-sm text-[var(--muted)]">{shown === 3 ? "Illustrative only: show the source, target, and resulting district Power change in one causal beat." : "Suggested presentation beat — not a claim about current engine timing."}</p></div><svg viewBox="0 0 520 116" className="h-28 w-full" role="img" aria-label={`Illustrative attack storyboard at ${phases[shown].label}`}><path d="M30 77H490" stroke="#968975" strokeDasharray="4 5"/><rect x={shown === 2 ? 238 : 30} y="48" width="100" height="36" fill="#2c2925" stroke="#983d35"/><text x={shown === 2 ? 288 : 80} y="70" textAnchor="middle" fill="#f2e7d2" fontSize="10">CARD SOURCE</text><path d="M145 66 C205 20 295 20 355 66" fill="none" stroke={shown >= 2 ? "#a9782f" : "#968975"} strokeWidth={shown >= 2 ? 3 : 1} opacity={shown >= 1 ? 1 : .35}/><circle cx="390" cy="66" r={shown === 3 ? 22 : 16} fill={shown === 3 ? "#983d35" : "#d3c6b2"} stroke="#983d35" strokeWidth="2"/><text x="390" y="70" textAnchor="middle" fill={shown === 3 ? "#f2e7d2" : "#292622"} fontSize="9">TARGET</text><text x="390" y="108" textAnchor="middle" fill="#983d35" fontSize="10" fontWeight="bold" opacity={shown >= 3 ? 1 : .35}>Power 6 → 8</text></svg></div><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => onSelect(Math.max(0, shown - 1))} className="tag text-[var(--ink)]">← Prev</button><button onClick={() => onSelect(Math.min(phases.length - 1, shown + 1))} className="tag text-[var(--ink)]">Next →</button><button onClick={() => { setReplaying(true); setReplayStep(0); }} className="tag bg-[var(--ink)] text-[var(--paper)]" disabled={replaying}>Replay demo</button><button onClick={cancelReplay} className="tag">Cancel replay</button><span className="mono self-center text-[9px] text-[var(--muted)]">{reducedMotion ? "reduced motion" : replaying ? "local replay running" : "local only"}</span></div></div>
  </div>;
}

function TimerSpec() {
  const [seconds, setSeconds] = useState(20); const [playing, setPlaying] = useState(false); const [enabled, setEnabled] = useState(true);
  useEffect(() => { if (seconds === 0) setPlaying(false); }, [seconds]);
  useEffect(() => { if (!playing || !enabled || seconds <= 0) return; const id = window.setInterval(() => setSeconds(v => Math.max(0, v - 1)), 1000); return () => window.clearInterval(id); }, [playing, enabled, seconds]);
  const state = !enabled ? "DISABLED" : seconds === 0 ? "EXPIRED" : !playing ? "PAUSED" : seconds <= 5 ? "URGENT" : seconds <= 10 ? "WARNING" : "CALM";
  const pct = enabled ? seconds / 20 : 0;
  return <div className="blueprint p-5">
    <div className="flex items-start justify-between"><div><div className="eyebrow">Timer specimen / live UI</div><div className="mt-2 display text-5xl font-extrabold tabular-nums">{enabled ? seconds : "—"}<span className="ml-2 text-lg font-normal text-[var(--muted)]">sec</span></div></div><div className={`tag ${state === "URGENT" || state === "EXPIRED" ? "text-[var(--red)]" : "text-[var(--sage)]"}`}>{state}</div></div>
    <div className="mt-5 h-3 border border-[var(--ink)] p-[2px]" role="progressbar" aria-valuenow={enabled ? seconds : undefined} aria-valuemin={0} aria-valuemax={20} aria-label="Decision time remaining"><div className={`h-full ${state === "URGENT" ? "bg-[var(--red)]" : "bg-[var(--gold)]"} ${playing ? "pulse" : ""}`} style={{ transformOrigin: "left", transform: `scaleX(${pct})` }} /></div>
    <div className="mt-4 flex flex-wrap gap-2"><button className="tag bg-[var(--ink)] text-[var(--paper)]" onClick={() => setPlaying(v => !v)} disabled={!enabled || seconds === 0}>{playing ? "Pause" : "Play demo"}</button><button className="tag" onClick={() => { setPlaying(false); setSeconds(20); }}>{seconds === 0 ? "Restart demo" : "Cancel / reset"}</button><button className="tag" onClick={() => { setEnabled(v => !v); setPlaying(false); }}>{enabled ? "Disable" : "Enable"}</button></div>
    <div className="mt-5 grid grid-cols-3 gap-2 text-center mono text-[9px]"><div className="border border-[var(--line)] p-2">20 / calm</div><div className="border border-[var(--line)] p-2">10 / warning</div><div className="border border-[var(--line)] p-2">5 / urgent</div></div>
    <p className="mt-4 text-xs leading-5 text-[var(--muted)]">Suggested demo only. In battle, preserve the current 20-second countdown and its pause/visibility semantics; never add an automatic UI-only clock.</p>
  </div>;
}

function BattleBoard({ scoreMode }: { scoreMode: boolean }) {
  const [locked, setLocked] = useState(false); const [squabble, setSquabble] = useState(false);
  return <div className="blueprint relative overflow-hidden p-4">
    <div className="absolute right-3 top-3 tag text-[var(--red)]">WIREFRAME · NOT FINAL ART</div>
    <div className="mb-5 flex items-center justify-between border-b border-[var(--line)] pb-3"><div className="display text-lg font-bold">RIVAL // STREET KING</div><div className="mono text-[10px]">ROUND 03 / 06</div></div>
    <div className="grid gap-3 md:grid-cols-3">{["NORTH BLOCK","MARKET CUT","UNDERPASS"].map((name, i) => <div key={name} className={`relative min-h-[142px] border-2 p-3 ${i === 1 ? "border-[var(--gold)]" : "border-[var(--line)]"}`}><div className="mono text-[9px] text-[var(--muted)]">DISTRICT 0{i + 1}</div><div className="mt-2 font-bold">{name}</div><div className="absolute bottom-3 left-3 right-3 flex justify-between text-xs"><span className="text-[var(--red)]">RIVAL {scoreMode ? [7,4,5][i] : "—"}</span><span className="font-bold">{scoreMode ? [5,8,5][i] : "POWER —"}</span></div><svg className="absolute right-3 top-8 h-16 w-16 opacity-30" viewBox="0 0 80 80" aria-hidden="true"><path d="M4 64L22 12l18 32 15-24 21 44Z" fill="none" stroke="currentColor" strokeWidth="1"/><path d="M4 71h72" stroke="currentColor"/></svg></div>)}</div>
    <div className="mt-4 grid gap-4 border-t border-[var(--line)] pt-4 md:grid-cols-[1fr_auto]"><div><div className="mono text-[9px] uppercase text-[var(--muted)]">Cause → target → consequence</div><div className="mt-1 text-sm"><b>Card source</b><Arrow/><b>Market Cut</b><Arrow/><span className="text-[var(--red)]">{scoreMode ? "Power 6 → 8 (final: 8)" : "district Power resolves here"}</span></div><p className="mt-2 text-[11px] text-[var(--muted)]">Illustrative attack example — not an actual engine result. Do not invent HP or damage.</p><div className="mt-3 flex flex-wrap items-center gap-2 border border-[var(--line)] p-3"><span className="mono text-[9px] text-[var(--muted)]">PLAYER MOTION</span><b className="text-lg">4</b><Arrow/><span className="mono text-[9px] text-[var(--muted)]">CARD COST</span><b className="text-lg text-[var(--red)]">2</b><Arrow/><span className="mono text-[9px] text-[var(--muted)]">REMAINING</span><b className="text-lg text-[var(--sage)]">2</b></div></div><div className="flex flex-wrap gap-2 self-end"><button className={`tag ${squabble ? "bg-[var(--red)] text-[var(--paper)]" : ""}`} onClick={() => setSquabble(v => !v)} disabled={locked}>SQUABBLE {squabble ? "ARMED" : ""}</button><button className={`tag ${locked ? "bg-[var(--sage)] text-[var(--paper)]" : "bg-[var(--ink)] text-[var(--paper)]"}`} onClick={() => setLocked(v => !v)}>{locked ? "LOCKED IN" : "LOCK IN"}</button></div></div>
  </div>;
}

export function ComponentWorkshop() {
  const [active, setActive] = useState(0); const [scoreMode, setScoreMode] = useState(false);
  const build = useMemo(() => ["Angle / readability foundation", "HUD / timer", "Attack causality", "Environmental garnish"], []);
  return <main className="battle-workshop min-h-[100dvh] overflow-x-hidden">
    <div className="grain" />
    <div className="mx-auto max-w-[1180px] px-5 py-8 md:px-10 md:py-14">
      <header className="grid gap-8 border-b-2 border-[var(--ink)] pb-12 lg:grid-cols-[1fr_310px]">
        <div><div className="eyebrow">Squabblemon / battle components / workshop 01</div><h1 className="display mt-5 max-w-4xl text-5xl font-black leading-[.92] tracking-[-.065em] md:text-8xl">Make the fight<br/><span className="text-[var(--red)]">readable</span>, then loud.</h1><p className="mt-7 max-w-2xl text-lg leading-8 text-[var(--muted)]">An annotated blueprint for upgrading the six-round street-card fight without changing its gameplay. Wet concrete, chains, crown signage, and boxing stagecraft — a modular kit that makes actions cinematic without hiding the decision surface.</p></div>
        <aside className="blueprint self-end p-5"><div className="eyebrow">Protected contract</div><ul className="mt-4 space-y-3 text-sm leading-5"><li>• Six rounds / three districts</li><li>• Motion affordability + both tap orders</li><li>• Explicit commit / Lock In</li><li>• Status + effects semantics stay intact</li><li>• Current 20s countdown stays authoritative</li></ul><div className="mt-5 border-t border-[var(--line)] pt-4 mono text-[9px] uppercase text-[var(--red)]">No gameplay changes. No invented HP.</div></aside>
      </header>
      <section className="grid gap-8 py-12 md:grid-cols-[1fr_280px]"><div><div className="eyebrow">Thesis / hypothesis</div><p className="display mt-3 max-w-3xl text-3xl font-bold leading-tight">Stage <span className="text-[var(--red)]">cause → target → consequence</span> instead of competing full-screen stings.</p></div><Callout label="Medium stack">Raster skin + SVG geometry + live text + cancellable animation. The fight stays legible when motion is reduced, paused, or skipped.</Callout></section>
      <Section id="storyboard" index="01" title="The fight as a clean sequence" priority="P0" lead="A manual storyboard strip makes the causal chain inspectable. Scrub it to discuss beats; Replay is local-only and never talks to the battle API.">
        <Timeline active={active} onSelect={setActive}/><div className="mt-5 grid gap-5 md:grid-cols-3"><Callout label="Now" tone="sage">PlayLoop already has lock-in, reveal, travel, impact, abilities, rival, and district resolution phases.</Callout><Callout label="Upgrade" tone="red">Keep the decision surface present. Use one highlighted source, one target lane, and a compact consequence line.</Callout><Callout label="Priority">P0 readability foundation. Suggested timings belong in a later motion pass, not in the engine contract.</Callout></div>
      </Section>
      <Section id="timer" index="02" title="Timer that speaks clearly" priority="P0" lead="A timer is a decision aid, not a second spectacle. It needs live text, calm / warning / urgent states, and deterministic stop behavior.">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.08fr]"><TimerSpec/><div className="space-y-5"><Callout label="Now" tone="sage">20-second decision timer, paused outside the interactive player-ready phase and when visibility/replay/modals require it.</Callout><Callout label="Upgrade" tone="red">Make urgency semantic and spatial: numeric value, progress track, and a restrained state label. Keep 10s / 5s announcements accessible.</Callout><Callout label="Medium">Live UI for value and ARIA; CSS/SVG for track. Cancellable interval; reset clears it with no stray animation. Respect prefers-reduced-motion.</Callout></div></div>
      </Section>
      <Section id="surface" index="03" title="One protected decision surface" priority="P0" lead="The HUD specimen shows where the upgrade lands: district Power remains the outcome, while card source and target become the visual spine.">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="eyebrow">Specimen / toggle result visibility</div><button className="tag" onClick={() => setScoreMode(v => !v)}>{scoreMode ? "Hide score flip" : "Show score flip"}</button></div><BattleBoard scoreMode={scoreMode}/><div className="mt-5 grid gap-5 md:grid-cols-2"><Callout label="Current rendering note">This is a design-spec wireframe, not an exact reproduction of the current Battle.tsx rendering. It uses copied vocabulary: Rival, Round, District, Power, Motion, SQUABBLE, Lock In.</Callout><Callout label="Do not occlude" tone="red">Card hand, district ownership, Motion affordability, status semantics, and the commit action remain visible under any title art or effect overlay.</Callout></div>
      </Section>
      <Section id="layers" index="04" title="Build in layers, not one giant effect" priority="P1" lead="Separate the reusable fight-night kit into controllable layers so every beat can be cancelled, replayed, or reduced without corrupting authoritative state.">
        <div className="grid gap-3 md:grid-cols-4">{[["01","Raster skin","wet concrete, chain shadow, crown signage","Image"],["02","SVG geometry","lane brackets, travel path, impact marker","SVG"],["03","Live text","Power, Motion, status, phase, timer","Live UI"],["04","Motion","source → target → consequence beats","CSS-motion"]].map(([n,t,d,m]) => <div className="blueprint p-4" key={n}><div className="mono text-[var(--red)]">{n}</div><h3 className="mt-4 text-lg font-bold">{t}</h3><p className="mt-2 text-xs leading-5 text-[var(--muted)]">{d}</p><div className="mt-5 tag text-[var(--gold)]">{m}</div></div>)}</div><div className="mt-6 grid gap-5 md:grid-cols-3"><Callout label="Card inspector">Compact card treatment: name, cost, Power, ability/status copy. Open as a side inspector, never as an opaque full-screen sting.</Callout><Callout label="Round / boss sting">A framed broadcast plate may announce Round 03 or a boss phase, but it must yield to the board and be skippable.</Callout><Callout label="Environmental garnish">Chains, signage, and concrete texture are atmosphere only. They sit behind lanes, never above controls.</Callout></div>
      </Section>
      <Section id="order" index="05" title="Recommended build order" priority="SHIP" lead="Impact first. This order protects the useful part of the game — making a good decision — before adding stagecraft.">
        <div className="space-y-3">{build.map((item, i) => <div key={item} className={`flex items-center gap-4 border p-4 ${i === 0 ? "border-[var(--red)] bg-[#ead5c8]" : "border-[var(--line)]"}`}><div className="display text-2xl font-black text-[var(--red)]">0{i + 1}</div><div><div className="font-bold">{item}</div><div className="text-sm text-[var(--muted)]">{["Make cause, target, district Power, and available actions scan in one glance.","Clarify calm / warning / urgent, paused, disabled, and reduced-motion states.","Choreograph attack beats with cancellable source-target-consequence transitions.","Add raster skin, chains, crown signage, and restrained impact garnish last."][i]}</div></div></div>)}</div>
        <div className="mt-8 border-2 border-[var(--ink)] bg-[#2c2925] p-5 text-[#f0e4d0]"><div className="eyebrow text-[#d7ad61]">Final recommendation</div><p className="display mt-3 text-2xl font-bold leading-tight md:text-3xl">Ship the angle/readability foundation before the spectacle. If the player can’t tell what caused a district Power change, more animation only makes the fight louder.</p></div>
      </Section>
      <footer className="border-t border-[var(--line)] py-8 mono text-[9px] uppercase tracking-[.14em] text-[var(--muted)]">Workshop artifact · local interaction only · suggested timings are labeled · engine source remains read-only</footer>
    </div>
  </main>;
}