import { getAssetUrl } from '../lib/assets';
import '../styles/rookie-guide.css';
export type FadePose = 'welcome' | 'up' | 'down' | 'left' | 'right';

export function DrFadePortrait({ className = '', pose = 'welcome' }: { className?: string; pose?: FadePose }) {
  return <img src={getAssetUrl('assets/tutorial/dr-fade-' + pose + '.png')} alt="Dr. Fade, your tutorial coach" className={`dr-fade-portrait ${className}`} width={768} height={1024} decoding="async" draggable={false} />;
}

export const DR_FADE_LESSONS = [
  { title: 'Take two districts.', text: 'I’m Dr. Fade. Three districts decide the fade. When the last round ends, lead in at least two and the block is yours.' },
  { title: 'Spend with purpose.', text: 'Cards cost Motion and add Hands. I’ll stay with you in the fight while you choose a card, read the district, play it, and decide when to end your turn.' },
  { title: 'Learn it on the street.', text: 'You’ll practice carrying Motion and using your once-per-fade SQUABBLE. When a new status or movement effect appears, I’ll pause the action and explain exactly what changed.' },
  { title: 'Make every fade count.', text: 'Story and regular fights earn Clout and XP, even on a loss. Spend Clout at my Trading Post to train characters. Reach levels 2, 5, and 8, then buy move coaching. Tickets pull new gang members; duplicates become Style Shards for fresh finishes.' },
] as const;
