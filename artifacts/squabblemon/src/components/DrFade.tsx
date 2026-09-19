import { getCardImage } from '../lib/assets';

export function DrFadePortrait({ className = '' }: { className?: string }) {
  return <img src={getCardImage('dr-fade')} alt="Dr. Fade, your tutorial coach" className={`dr-fade-portrait ${className}`} width={768} height={1024} decoding="async" draggable={false} />;
}

export const DR_FADE_LESSONS = [
  { title: 'Take two districts.', text: 'I’m Dr. Fade. Three districts decide the match. When the last round ends, lead in at least two and the block is yours.' },
  { title: 'Spend with purpose.', text: 'Cards cost Motion and add Hands. I’ll stay with you in the fight while you choose a card, read the district, play it, and decide when to end your turn.' },
  { title: 'Learn it on the street.', text: 'You’ll practice carrying Motion and using your once-per-match SQUABBLE. When a new status or movement effect appears, I’ll pause the action and explain exactly what changed.' },
] as const;
