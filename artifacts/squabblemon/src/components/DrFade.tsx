import { getCardImage } from '../lib/assets';

export function DrFadePortrait({ className = '' }: { className?: string }) {
  return <img src={getCardImage('dr-fade')} alt="Dr. Fade, your tutorial coach" className={`dr-fade-portrait ${className}`} width={768} height={1024} decoding="async" draggable={false} />;
}

export const DR_FADE_LESSONS = [
  { title: 'Win the neighborhood.', text: 'I’m Dr. Fade. Six rounds. Three districts. Finish with more Hands in at least two districts and the block is yours.' },
  { title: 'Make your Motion count.', text: 'Motion pays for your cards. Start with 2, then your budget grows each round. Pick a card you can afford, choose a district, and lock it in. Passing can carry 1 Motion forward.' },
  { title: 'Read before you commit.', text: 'A card’s ability and its district can change the fight. Check the highlighted district and the rival’s tell. Save your once-per-match Squabble for a moment that matters.' },
  { title: 'Make every match count.', text: 'Story and regular fights earn Clout and XP, even on a loss. Spend Clout at my Trading Post to train characters. Reach levels 2, 5, and 8, then buy move coaching. Tickets pull new crew members; duplicates become Style Shards for fresh finishes.' },
] as const;
