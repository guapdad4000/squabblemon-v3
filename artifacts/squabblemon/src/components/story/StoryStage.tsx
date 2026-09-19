import { useState } from 'react';
import {
  getStoryNode,
  storyContent,
  type StoryChapter,
  type StoryDialogueLine,
  type StoryNode,
} from '@workspace/squabblemon-engine/story';
import { getAssetUrl } from '../../lib/assets';
import './story-stage.css';

export type StoryStageDefinition = {
  backdropAssetId: string;
  place: string;
  caption: string;
};

export const CHAPTER_ONE_STAGES: Record<string, StoryStageDefinition> = {
  'welcome-to-the-block': { backdropAssetId: 'assets/layered/corner-store.webp', place: 'The corner store', caption: 'Everybody wants a seat.' },
  'blue-side-pressure': { backdropAssetId: 'assets/layered/moon-rooftop.webp', place: 'Blue’s rooftop', caption: 'An empire. One extension cord.' },
  'receipts-on-camera': { backdropAssetId: 'assets/layered/corner-store.webp', place: 'The corner store', caption: 'Somebody kept the receipts.' },
  'red-side-retaliation': { backdropAssetId: 'assets/layered/red-court.webp', place: 'Red’s territory', caption: 'The invitation was a warning.' },
  'side-alley-challenge': { backdropAssetId: 'assets/layered/gold-alley.webp', place: 'The side alley', caption: 'A little extra trouble. Optional.' },
  'snitch-at-the-corner': { backdropAssetId: 'assets/layered/civic-summit.webp', place: 'Snitch’s press conference', caption: 'Live. Unfortunately.' },
  'cracked-head-takes-the-block': { backdropAssetId: 'assets/layered/crown-court.webp', place: 'The crown court', caption: 'The dead have terrible timing.' },
  'block-crowned': { backdropAssetId: 'assets/layered/crown-court.webp', place: 'The ceremony', caption: 'Nobody said the night was over.' },
};

/**
 * Chapter Two has no dedicated scene plates yet. These shipped layered
 * backdrops preserve each authored time and place instead of presenting the
 * entire day on the chapter map or the nighttime combat plate.
 */
export const CHAPTER_TWO_STAGES: Record<string, StoryStageDefinition> = {
  'red-tapes-open-the-envelope': { backdropAssetId: 'assets/layered/crown-court.webp', place: 'The crown rooftop, after hours', caption: 'The recorder finally plays.' },
  'red-tapes-red-side-open': { backdropAssetId: 'assets/layered/morning-block.webp', place: 'Red Side, next morning', caption: 'The doors are open. The family is not.' },
  'red-tapes-courier-table': { backdropAssetId: 'assets/layered/corner-store.webp', place: 'The courier table', caption: 'Every message has a route.' },
  'red-tapes-cheese-has-terms': { backdropAssetId: 'assets/layered/corner-store.webp', place: 'The corner store', caption: 'Late morning. The cheese has paperwork.' },
  'red-tapes-pay-per-view': { backdropAssetId: 'assets/layered/civic-summit.webp', place: 'The media table', caption: 'Midday questions. Premium seating.' },
  'red-tapes-the-wrong-person': { backdropAssetId: 'assets/layered/sunlit-hall.webp', place: 'The private back room', caption: 'No audience. No easy answer.' },
  'red-tapes-roast-with-a-receipt': { backdropAssetId: 'assets/layered/red-court.webp', place: 'Red Side, early afternoon', caption: 'The jokes came with receipts.' },
  'red-tapes-side-eye-security': { backdropAssetId: 'assets/layered/tidal-street.webp', place: 'The harbor table', caption: 'Late light. Longer side-eye.' },
  'red-tapes-mama-has-the-floor': { backdropAssetId: 'assets/layered/sunset-block.webp', place: 'The final table at sunset', caption: 'Baby Momma takes the floor.' },
  'red-tapes-let-her-grieve': { backdropAssetId: 'assets/layered/old-town.webp', place: 'OG Uncle’s porch', caption: 'Evening. One chair stays empty.' },
};

const STORY_STAGES: Readonly<Record<string, StoryStageDefinition>> = {
  ...CHAPTER_ONE_STAGES,
  ...CHAPTER_TWO_STAGES,
};

export function resolveStoryStage(
  nodeId: string,
  node?: StoryNode,
  chapter?: StoryChapter,
): StoryStageDefinition {
  return STORY_STAGES[nodeId] ?? {
    backdropAssetId: node?.cinematic.environmentAssetId
      ?? chapter?.mapAssetId
      ?? 'assets/layered/corner-store.webp',
    place: node?.title ?? 'The block',
    caption: chapter?.subtitle ?? 'The story continues.',
  };
}

export type StoryStageProps = {
  nodeId: string; section: 'pre' | 'post' | 'main'; line: StoryDialogueLine;
  position: number; total: number; pending?: boolean; error?: string | null;
  onNext: () => void; onSkip: () => void; onClose: () => void;
  onHistory?: () => void; historyDisabled?: boolean;
};

export function StoryStage({ nodeId, section, line, position, total, pending, error, onNext, onSkip, onClose, onHistory, historyDisabled }: StoryStageProps) {
  const [still, setStill] = useState(false);
  const node = getStoryNode(nodeId);
  const chapter = storyContent.chapters.find((item) => item.nodes.some((entry) => entry.id === nodeId));
  const scene = resolveStoryStage(nodeId, node, chapter);
  const lines = node?.kind === 'battle' ? (section === 'post' ? node.postDialogue : node.preDialogue) : node?.scenes ?? [];
  // Only show people who have entered; the ceremony reveal stays a surprise.
  const previous = lines.slice(0, position - 1).findLast((item) => item.speaker !== line.speaker);
  const interruption = nodeId === 'block-crowned' && line.speaker === 'Baby Momma';
  const dramatic = (node?.kind === 'battle' && node.battleType === 'boss') || interruption;
  const shouting = /[A-Z]{4,}|!/.test(line.text);
  const prop = nodeId === 'welcome-to-the-block' ? 'vip' : nodeId === 'blue-side-pressure' ? 'power' : nodeId === 'receipts-on-camera' ? 'receipt' : nodeId === 'snitch-at-the-corner' ? 'live' : nodeId === 'cracked-head-takes-the-block' && section === 'pre' && position <= 2 ? 'battery' : null;
  return (
    <section className={`story-stage ${still ? 'story-stage--still' : ''} ${dramatic ? 'story-stage--dramatic' : ''}`} aria-label={`${scene.place} — ${section === 'post' ? 'After the fight' : chapter?.title ?? 'Story'}`}>
      <div className="story-stage__world" style={{ backgroundImage: `url("${getAssetUrl(scene.backdropAssetId)}")` }} />
      <img className="story-stage__beam" src={getAssetUrl('brand/story-cinematic/projector-beam.jpg')} alt="" aria-hidden="true" />
      <div className="story-stage__light" />
      <div className="story-stage__dust" aria-hidden="true" />
      <header className="story-stage__header">
        <button onClick={onClose} type="button">← Back</button>
        <span>Squabblemon <i> / </i> Chapter {String(chapter?.order ?? 1).padStart(2, '0')}</span>
        <button onClick={() => setStill(!still)} aria-pressed={still} type="button">{still ? 'Motion off' : 'Motion on'}</button>
      </header>
      <div className="story-stage__location"><span>{chapter?.title ?? 'BLOCK PARTY OPEN'}</span><h2>{scene.place}</h2><p>{scene.caption}</p></div>
      {prop && <div className={`story-stage__prop story-stage__prop--${prop}`} aria-hidden="true">
        {prop === 'vip' ? <><small>VERY IMPORTANT</small><strong>VENDING<br />MACHINE</strong><span>VIP · $3 DISPUTE PENDING</span></> :
          prop === 'power' ? <><small>THE ENTIRE EMPIRE</small><strong>⚡</strong><span>DO NOT UNPLUG</span></> :
          prop === 'receipt' ? <><small>THE RECEIPTS</small><strong>ON RECORD.</strong><span>NO REFUNDS ON WHAT YOU SAID.</span></> :
          prop === 'live' ? <><small>● LIVE</small><strong>SNITCH<br />NEWS</strong><span>PROFESSIONAL AIR FRYER DESK</span></> :
          <><small>ENTRANCE MUSIC</small><strong>BATTERY LOW</strong><span>PLEASE CHARGE YOUR DEVICE</span></>}
      </div>}
      <div className="story-stage__cast" aria-hidden="true">
        {previous && <div key={previous.speaker} className="story-stage__actor story-stage__actor--listener"><img src={getAssetUrl(previous.portraitAssetId)} alt="" /></div>}
        <div key={`${line.speaker}:${shouting}`} className={`story-stage__actor story-stage__actor--speaker ${shouting ? 'story-stage__actor--emphatic' : ''}`}><img src={getAssetUrl(line.portraitAssetId)} alt="" /></div>
      </div>
      <div className="story-stage__vignette" />
      <div className="story-stage__script">
        <div className="story-stage__speaker"><span>{line.speaker}</span><small>{section === 'post' ? 'AFTERMATH' : 'ON THE BLOCK'} · {position.toString().padStart(2, '0')} / {total.toString().padStart(2, '0')}</small></div>
        <p key={`${nodeId}:${section}:${position}`} className="story-stage__line" aria-live="polite">{line.text}</p>
        {error && <p className="story-stage__error" role="alert">{error}</p>}
        <footer>
          <div><button type="button" onClick={onHistory} disabled={!onHistory || historyDisabled}>Transcript</button><button type="button" onClick={onSkip} disabled={pending}>Skip scene</button></div>
          <button className="story-stage__next" type="button" onClick={onNext} disabled={pending}>{pending ? 'Saving…' : position === total ? 'Continue →' : 'Next →'}</button>
        </footer>
      </div>
    </section>
  );
}
