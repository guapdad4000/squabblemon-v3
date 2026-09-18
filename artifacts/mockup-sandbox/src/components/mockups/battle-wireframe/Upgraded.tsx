import { useState, type ReactNode } from 'react';
import './_group.css';

const A = '/__mockup/images/battle-wireframe/';
const regions = [
  ['01','Rival / round HUD','Live text + SVG rule marks. Keep round 4/6, rival Motion and claims in one calm strip.'],
  ['02','20s decision timer','Live text + CSS progress. Paused during reveal, broadcast, replay and any non-decision phase.'],
  ['03','Three district planes','Live score totals, leader badges and rule markers. Cards stay upright and readable.'],
  ['04','Impact / VFX layer','Animation canvas above the ground only. Names power, status and effect; never invent HP.'],
  ['05','Hand + Motion deck','Live card components; horizontal touch rail on portrait. Cost preview updates before Lock In.'],
  ['06','Lock In / Pass / SQUABBLE','Protected command deck. Buttons own input; no cinematic overlay may intercept them.'],
  ['07','Round / boss broadcast','Reserved safe region for title art and announcements. Pointer-events: none while resolving.'],
  ['08','Inspector / replay layer','Side sheet or inline drawer for history. Read-only, never blocks a decision target.'],
];
const lanes = ['Market Row','Harbor Cut','Rooftop Court'];

function Section({ eyebrow, title, children, compact = false }: { eyebrow:string; title?:string; children:ReactNode; compact?:boolean }) {
  return <section className={compact ? 'mb-7' : 'mb-16'}><div className="bw-mono mb-1 text-[11px] uppercase tracking-[.16em] text-[#a94032]">{eyebrow}</div>{title && <h2 className={`${compact ? 'mb-3 text-3xl md:text-4xl' : 'mb-6 text-3xl md:text-5xl'} font-bold tracking-[-.04em]`}>{title}</h2>}{children}</section>;
}

export function Upgraded() {
  const [active, setActive] = useState('03');
  const [tilt, setTilt] = useState(12);
  const [card, setCard] = useState(false);
  const [lane, setLane] = useState<number|null>(null);
  const [armed, setArmed] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [sampleNotice, setSampleNotice] = useState('');
  const selected = regions.find(r => r[0] === active);
  return <main className="bw-root bw-grid-paper min-h-screen">
    <div className="mx-auto max-w-[1280px] px-5 py-5 md:px-10 md:py-7">
      <header className="mb-8 grid gap-4 border-b-2 border-[#27221c] pb-5 md:grid-cols-[1fr_300px]">
        <div><div className="bw-mono mb-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[.18em]"><span className="bw-tag text-[#a94032]">PROPOSED</span><span>Battle camera / information architecture</span></div>
          <h1 className="max-w-4xl text-5xl font-bold leading-[.92] tracking-[-.07em] md:text-6xl">Arena stage. <span className="text-[#a94032]">Flat command deck.</span></h1>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-[#736957]">Proposed battle read: stage the ground, preserve every upright decision surface.</p>
        </div>
        <aside className="bw-note self-end py-3"><strong>PROPOSED, NOT CURRENT</strong><p className="mt-1 text-xs leading-relaxed">Gameplay untouched: three Power totals, separate Motion pools, 20s decisions, explicit Lock In.</p></aside>
      </header>

      <Section compact eyebrow="01 / the angle" title="Shallow ground. Upright information.">
        <div className="grid gap-6 md:grid-cols-[1.4fr_.8fr]">
          <div className="bw-note">
            <div className="mb-4 flex items-center justify-between"><span className="bw-mono text-xs uppercase">Camera study · illustrative</span><span className="bw-tag text-[#b28738]">tune, don't ship</span></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-[#9b8c73] bg-[#e3d6bb] p-2"><div className="bw-mono mb-1 text-[10px] uppercase">Baseline / current</div><div className="relative h-16 overflow-hidden border border-[#736957] bg-[#5e5b51]"><img src={A+'venue-1.webp'} className="h-full w-full object-cover opacity-70" alt="Corner store venue crop"/><div className="absolute bottom-1 left-3 right-3 h-5 border-2 border-[#f3d68c] bg-black/20"/></div><p className="mt-1 text-[11px] text-[#736957]">Flat lane grid; no rotation.</p></div>
              <div className="border border-[#a94032] bg-[#f8efd9] p-2"><div className="bw-mono mb-1 text-[10px] uppercase text-[#a94032]">Recommended / target</div><div className="relative h-16 overflow-hidden border border-[#736957] bg-[#5e5b51]" style={{ perspective: '500px' }}><img src={A+'venue-4.webp'} className="h-full w-full object-cover opacity-80" alt="Red fenced court venue crop"/><div className="absolute inset-x-5 bottom-2 h-7 origin-bottom border-2 border-[#f3d68c] bg-black/15" style={{ transform:`rotateX(${tilt}deg)` }}/><div className="absolute left-1/2 top-2 h-7 w-10 -translate-x-1/2 border border-[#fff0bb]"/></div><p className="mt-1 text-[11px] text-[#736957]">Ground depth; planes stay upright.</p></div>
            </div>
            <label className="mt-5 flex items-center gap-3 text-xs"><span className="bw-mono w-24 uppercase">Ground tilt</span><input className="w-full accent-[#a94032]" type="range" min="0" max="22" value={tilt} onChange={e=>setTilt(+e.target.value)}/><span className="bw-mono w-9">{tilt}°</span></label>
          </div>
          <div className="space-y-2"><div className="bw-note py-2"><strong>KEEP FLAT</strong><p className="mt-1 text-xs">Cards, score markers, targets and deck never tilt during decisions.</p></div><div className="bw-note py-2"><strong>REFRAME, DON'T DISTORT</strong><p className="mt-1 text-xs">Landscape crop with safe regions; no stretching or double rotation.</p></div><div className="bw-note py-2"><strong>IMAGE SAFE REGIONS</strong><p className="mt-1 text-xs">Center band remains legible across all five supplied venues.</p></div></div>
        </div>
      </Section>

      <Section compact eyebrow="02 / main annotated battlefield · click numbered regions below" >
        <div className="mb-2 flex flex-wrap items-end justify-end gap-4"><span className="bw-mono text-[11px] uppercase text-[#a94032]">Wireframe sample — not a live match</span></div>
        <div className="bw-venue"><img src={A+'venue-4.webp'} alt="Red fenced court artwork used as proposed ground"/><div className="bw-ui bw-ui-hud"><span className="bw-ui-chip">RIVALS / NIGHT HAWKS · Motion 6</span><span className="bw-ui-chip">ROUND 4 / 6 · CLAIMS 1–2</span><span className="bw-ui-chip">TIME 20</span></div><div className="bw-ui bw-ui-cards">{lanes.map((x,i)=><div className="bw-ui-card" key={x}><b>{['Brickjaw','Mist Kit','Vandal'][i]}</b>Rival card<br/>Power {['7','5','8'][i]}</div>)}</div><div className="bw-ui bw-ui-scores">{lanes.map((x,i)=><div className="bw-ui-score" key={x}><small>{x} · rule</small><b>{[8,11,6][i]} — {[7,6,9][i]}</b><small>You / rival Power</small></div>)}</div><div className="bw-ui bw-ui-hand">{['Runner','Corner Kid','Rook'].map((x,i)=><div className="bw-ui-card" key={x}><b>{x}</b>{[4,6,3][i]} Power<br/>Cost {[2,3,1][i]}</div>)}</div><div className="bw-ui bw-ui-actions"><span>YOUR MOTION <b>5</b> · Runner → Harbor Cut · cost 2</span><span className="bw-ui-lock">LOCK IN</span><span>PASS · SQUABBLE</span></div><div className="bw-wire hud"><span>01 / 02</span></div><div className="bw-wire rival"><span>01</span></div><div className="bw-wire lane one"><span>03A</span></div><div className="bw-wire lane two"><span>03B</span></div><div className="bw-wire lane three"><span>03C</span></div><div className="bw-wire score"><span>03 / score + rule</span></div><div className="bw-wire fx"><span>04 / source → impact → target</span></div><div className="bw-wire broadcast"><span>07 / safe title band</span></div><div className="bw-wire hand"><span>05 / readable hand + Motion</span></div><div className="bw-wire action"><span>06 / protected input</span></div><div className="bw-venue-label">PROPOSED GROUND VIEW · ARTWORK CROP / SAFE REGIONS SHOWN</div></div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_.7fr]"><div className="bw-region-list">{regions.map(r=><button key={r[0]} className={`bw-region ${active===r[0]?'active':''}`} onClick={()=>setActive(r[0])}><b>{r[0]}</b><strong>{r[1]}</strong><small>{r[2]}</small></button>)}</div><aside className="bw-note h-fit"><strong>IMPLEMENTATION NOTE</strong><div className="mt-3 text-sm leading-relaxed"><div className="bw-mono mb-2 text-xs uppercase text-[#a94032]">{selected?.[0]} / {selected?.[1]}</div>{selected?.[2]}</div><p className="mt-5 border-t border-[#c5b89d] pt-3 text-xs text-[#736957]">Input policy: VFX, broadcast art and atmospheric layers use pointer-events: none. Cards, districts and command actions retain focus and touch.</p></aside></div>
      </Section>

      <Section eyebrow="03 / the decision sequence" title="Choose either first. Then Lock In.">
        <div className="bw-note mb-5"><div className="bw-flow"><span className={`bw-flow-step ${card?'border-[#a94032]':''}`}>Choose card</span><span className="bw-arrow">↔</span><span className={`bw-flow-step ${lane!==null?'border-[#a94032]':''}`}>Choose district</span><span className="bw-arrow">→</span><span className={`bw-flow-step ${committed?'border-[#a94032]':''}`}>Lock In</span></div><p className="mt-4 text-center text-xs text-[#736957]">Static illustrative data: Runner costs 2 Motion · player has 5. Either tap order works. SQUABBLE is once per match and doubles base Power; it adds no Motion surcharge.</p></div>
        <div className="grid gap-4 md:grid-cols-[1fr_1.4fr_1fr]">
          <button className={`bw-demo-card text-left ${card?'selected':''}`} aria-pressed={card} disabled={committed} onClick={()=>{setCard(!card);setArmed(false);setSampleNotice('')}}><span className="bw-mono text-[10px] uppercase text-[#a94032]">Card / player hand</span><h3 className="mt-3 text-xl font-bold">Runner</h3><p className="mt-1 text-sm text-[#736957]">4 Power · cost 2 Motion</p><div className="mt-4 inline-block border border-[#b28738] px-2 py-1 text-xs">SELECT CARD</div></button>
          <div className="grid grid-cols-3 gap-2">{lanes.map((l,i)=><button key={l} className={`bw-lane-demo ${lane===i?'selected':''}`} aria-pressed={lane===i} disabled={committed} onClick={()=>{setLane(lane===i?null:i);setSampleNotice('')}}><span className="bw-mono text-[9px] uppercase">{String.fromCharCode(65+i)}</span><div className="mt-3 text-xs font-bold">{l}</div><div className="mt-2 text-lg font-bold">{[8,11,6][i]}</div><div className="text-[10px] text-[#736957]">Power</div></button>)}</div>
          <div className="bw-demo-card"><span className="bw-mono text-[10px] uppercase text-[#a94032]">Command deck</span><div className="mt-3 flex gap-2"><button className="bw-btn red flex-1" onClick={()=>{setCommitted(true);setSampleNotice(`Sample committed · Runner → ${lanes[lane!]} · 2 Motion${armed?' · SQUABBLE':''}`)}} disabled={!card||lane===null||committed}>{committed?'Locked In':'Lock In'}</button><button className="bw-btn alt" onClick={()=>{setCard(false);setLane(null);setArmed(false);setCommitted(false);setSampleNotice(committed?'Sample reset — choose again.':'Pass preview — no move committed.')}}>{committed?'Reset':'Pass'}</button></div><button className={`bw-btn mt-3 w-full ${armed?'red':''}`} aria-pressed={armed} onClick={()=>setArmed(!armed)} disabled={!card||committed}>SQUABBLE {armed?'ARMED':'READY'}</button><div className="mt-3 bw-mono text-[10px] text-[#736957]" role="status">{sampleNotice||(!card?lane===null?'Choose a card or district first':`${lanes[lane]} selected — choose a card`:lane===null?'Choose a district · cost 2 / 5 Motion':'Affordable · 5 Motion − 2 cost = 3 remaining')}</div></div>
        </div>
      </Section>

      <Section eyebrow="04 / compact portrait schematic" title="Portrait keeps the controls readable.">
        <div className="grid gap-6 md:grid-cols-[260px_1fr]"><div className="mx-auto w-[250px] border-[7px] border-[#27221c] bg-[#27221c] p-2 shadow-[8px_8px_0_rgba(39,34,28,.15)]"><div className="relative h-[440px] overflow-hidden bg-[#5e5b51]"><img src={A+'venue-2.webp'} className="h-full w-full object-cover opacity-60" alt="Harbor venue portrait crop"/><div className="absolute inset-x-2 top-2 h-10 border border-[#f3d68c] bg-black/30 p-2 text-[8px] text-white">ROUND 4/6 · RIVAL 6 · TIME 20</div><div className="absolute inset-x-3 top-16 grid grid-cols-3 gap-1"><div className="h-28 border border-[#f3d68c]"/><div className="h-28 border border-[#f3d68c]"/><div className="h-28 border border-[#f3d68c]"/></div><div className="absolute inset-x-3 bottom-16 h-16 border border-[#f3d68c] bg-black/25"/><div className="absolute inset-x-2 bottom-2 flex h-10 gap-1"><div className="flex-1 border border-[#f3d68c] bg-[#a94032] text-center text-[8px] text-white">LOCK IN</div><div className="w-12 border border-[#f3d68c] text-center text-[8px] text-white">PASS</div></div></div></div><div className="space-y-3"><div className="bw-note"><strong>PORTRAIT RULE</strong><p className="mt-2 text-sm">Districts may reflow to a compact horizontal strip or vertical stack, but no three narrow columns with tiny targets. Minimum touch target stays 44px.</p></div><div className="bw-note"><strong>SAFE ORDER</strong><p className="mt-2 text-sm">HUD → one readable district at a time → hand rail → action row. Timer remains visible while the user can still act; it explicitly reads PAUSED during sequences.</p></div><div className="bw-note"><strong>VENUE CROPS</strong><p className="mt-2 text-sm">Use landscape recommendation on wide screens; portrait uses center crop with the card-safe band preserved.</p></div></div></div>
      </Section>

      <Section eyebrow="05 / decision" title="What changes now — and what earns the upgrade.">
        <div className="grid gap-4 md:grid-cols-2"><div className="bw-note"><span className="bw-tag text-[#736957]">NOW / current extraction</span><ul className="mt-5 space-y-3 text-sm leading-relaxed"><li>• Flat rectangular three-lane grid over a background.</li><li>• Enemy cards above district score; player cards below.</li><li>• Timer, round and utilities share a dense header.</li><li>• Motion hand and Lock In live in the bottom command deck.</li></ul></div><div className="bw-note border-[#a94032]"><span className="bw-tag text-[#a94032]">UPGRADE / proposed hypothesis</span><ul className="mt-5 space-y-3 text-sm leading-relaxed"><li>• Angle the ground only: shallow venue depth, no card tilt.</li><li>• Protect one scoreboard band and one action deck.</li><li>• Make attack causality visible: source → target → Power/status/effect.</li><li>• Keep replay and broadcast layers inspectable and non-blocking.</li></ul></div></div>
        <div className="mt-6 border-t-2 border-[#27221c] pt-6"><div className="bw-mono mb-4 text-[11px] uppercase tracking-[.16em] text-[#a94032]">Priority stack</div><div className="grid gap-3 md:grid-cols-4">{['1 / Angle + readability','2 / HUD clarity','3 / Attack causality','4 / Atmosphere'].map((x,i)=><div key={x} className={`bw-note ${i===0?'border-[#a94032]':''}`}><b className="text-lg">{x}</b><p className="mt-2 text-xs text-[#736957]">{['Tune the ground view without hiding touch targets.','One calm home for round, Motion, claims and timer.','Actual component workshop handles full attack storyboards.','Chains, banners and wet concrete support the read—not cover it.'][i]}</p></div>)}</div></div>
      </Section>
      <footer className="bw-mono border-t border-[#9b8c73] py-8 text-[10px] uppercase tracking-[.12em] text-[#736957]">Squabblemon battle wireframe · Proposed exploration · Rules and SQUABBLE behavior unchanged</footer>
    </div>
  </main>;
}