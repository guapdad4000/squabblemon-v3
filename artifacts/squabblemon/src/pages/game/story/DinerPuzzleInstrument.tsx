import type { StoryPuzzleDefinition } from '@workspace/squabblemon-engine/story';
import { getAssetUrl } from '../../../data';

/** A live, readable model of the player's arrangement; never compares against the hidden answer. */
export function DinerPuzzleInstrument({ puzzle, order }: { puzzle: StoryPuzzleDefinition; order: readonly string[] }) {
  const layout = puzzle.presentation?.layout;
  if (!layout) return null;
  if (layout === 'route') {
    const position = (id: string) => [id.charCodeAt(0) - 97, Number(id[1]) - 1];
    return <figure className="house-route" aria-label="Dry floor map, columns A to D, rows 1 to 3. Your current path is drawn in gold.">
      <figcaption>WINDOWS ↑ <span>Your delivery route</span> ↓ COUNTER</figcaption>
      <div className="house-route__grid">
        {Array.from({ length: 12 }, (_, i) => {
          const id = `${String.fromCharCode(97 + i % 4)}${Math.floor(i / 4) + 1}`;
          const dry = puzzle.pieces.some(p => p.id === id);
          return <div key={id} className={dry ? 'is-dry' : 'is-wet'}><strong>{id.toUpperCase()}</strong><small>{id === 'a1' ? 'DOOR' : id === 'd3' ? 'PASS' : dry ? 'DRY' : 'WET'}</small></div>;
        })}
        <svg viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">
          {order.slice(1).map((id, i) => { const [x1,y1] = position(order[i]); const [x2,y2] = position(id); const adjacent = Math.abs(x1-x2)+Math.abs(y1-y2) === 1;
            return <line key={id} x1={x1*100+50} y1={y1*100+50} x2={x2*100+50} y2={y2*100+50} stroke={adjacent ? '#f4c853' : '#ed725c'} strokeWidth="3" strokeDasharray={adjacent ? undefined : '6 6'}/>; })}
        </svg>
      </div><p>Solid gold = adjacent step. Dashed coral = a jump; rearrange the route.</p>
    </figure>;
  }
  if (layout === 'pass') {
    let elapsed = 0;
    return <figure className="house-pass"><figcaption>ONE GRILL · LIVE PICKUP CLOCK</figcaption><div className="house-pass__timeline">
      {order.map(id => { const piece = puzzle.pieces.find(p => p.id === id)!; const values = piece.detail.match(/\d+/g)?.map(Number) ?? [0,0]; const start = elapsed; elapsed += values[0];
        return <div key={id} className={elapsed > values[1] ? 'is-late' : 'on-time'} style={{ flexGrow: values[0] }}><strong>{piece.label}</strong><span>{start}–{elapsed} min</span><small>{elapsed > values[1] ? 'LATE' : 'ON TIME'}</small></div>; })}
    </div><p>Finish times update as you move the tickets. Every pickup needs to be on time.</p></figure>;
  }
  if (layout === 'booths') {
    const cast: Record<string,string> = { red:'C03_red', ken:'C12_tek_ken', manager:'C01_manager', cuff:'C08_cuff', blue:'C02_blue' };
    return <figure className="house-booths"><figcaption>LEFT END ← FIVE SEATS → RIGHT END</figcaption><div>{order.map((id,i)=><div className="house-booths__seat" key={id}><img src={getAssetUrl(`assets/story/squabble-house/cast/${cast[id]}.webp`)} alt=""/><span>{i+1} · {puzzle.pieces.find(p=>p.id===id)?.label}</span></div>)}</div></figure>;
  }
  const props: Record<string,string> = {tickets:'ticket',register:'receipt',evidence:'evidence'};
  const text: Record<string,[string,string]> = {
    tickets:['KITCHEN LOG','Cold iron. Empty plate. One perfect breakfast.'],
    register:['RED OG’S OPEN TAB','Food + extras − discount. Arrange the final charges.'],
    evidence:['SECURITY DESK · 02:00 AM','Correct the clocks. Reconstruct the theft.'],
  };
  return <div className={`house-puzzle-prop house-puzzle-prop--${layout}`}><img src={getAssetUrl(`assets/story/squabble-house/puzzles/props/${props[layout]}.webp`)} alt=""/><div><strong>{text[layout][0]}</strong><p>{text[layout][1]}</p></div></div>;
}
