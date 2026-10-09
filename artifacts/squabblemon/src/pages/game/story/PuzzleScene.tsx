import type { StoryPuzzleDefinition } from '@workspace/squabblemon-engine/story';
import presentation from './puzzlePresentation.json';
import { getAssetUrl } from '../../../lib/assets';
export type PuzzleKind = 'timeline'|'route'|'signal'|'custody'|'seating'|'reverse'|'assembly'|'amount'|'flags'|'state';
export function puzzlePresentation(puzzle: StoryPuzzleDefinition) {
 return (presentation as Record<string,{kind:PuzzleKind;art:string;scene:string}>)[puzzle.id] ?? {kind:'assembly' as PuzzleKind, art:puzzle.imageAssetId, scene:''};
}
const destinations: Record<string,readonly string[]> = {
 'sherlock-voices':['Studio A','Studio B','Studio C','Studio D'],
 'oz-claims':['Window 1','Window 2','Window 3','Window 4'],
 'alice-cups':['Alice','Cheshire','Clockkeeper','Queen'],
 'cellblock-shelves':['Alias A','Alias B','Alias C','Alias D','Alias E'],
};
export function puzzleSlotLabel(puzzle:StoryPuzzleDefinition,index:number) {
 const layout = puzzle.presentation?.layout;
 // Only label destinations or meaningful anchors; the position marker already gives the order.
 if (layout === 'booths') return [0, 2, puzzle.pieces.length - 1].includes(index) ? puzzle.presentation?.slotLabels[index] : undefined;
 if (layout === 'route' || layout === 'register') return index === 0 || index === puzzle.pieces.length - 1 ? puzzle.presentation?.slotLabels[index] : undefined;
 return destinations[puzzle.id]?.[index];
}
export function PuzzleGlyph({puzzle,index,pieceId}:{puzzle:StoryPuzzleDefinition;index:number;pieceId:string}) {
 const cast:Record<string,string>={red:'C03_red',ken:'C12_tek_ken',manager:'C01_manager',cuff:'C08_cuff',blue:'C02_blue'};
 const portrait=puzzle.presentation?.layout==='booths' ? cast[pieceId] : undefined;
 return <div className={`puzzle-evidence-glyph ${portrait ? 'puzzle-evidence-glyph--portrait' : ''}`} aria-hidden="true">
  {portrait && <img src={getAssetUrl(`assets/story/squabble-house/cast/${portrait}.webp`)} alt=""/>}
  <span>{String(index+1).padStart(2,'0')}</span>
 </div>;
}
/** A single contextual illustration. The evidence list owns all clues and editing. */
export function PuzzleScene({puzzle}:{puzzle:StoryPuzzleDefinition}) {
 return <div className="puzzle-scene"><img src={getAssetUrl(puzzlePresentation(puzzle).art)} alt="" decoding="async"/></div>;
}
