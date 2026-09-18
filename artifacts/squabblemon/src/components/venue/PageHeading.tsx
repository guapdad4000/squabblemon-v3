import type { ReactNode } from 'react';
import { PropArt, type PropArtId } from './PropArt';

export function PageHeading({ eyebrow, title, children, art }: { eyebrow: string; title: string; children: ReactNode; art?: PropArtId }) {
  const words = title.replace(/\.$/, '').split(' ');
  const accent = words.pop();
  return <header className={`venue-page-heading ${art ? 'venue-page-heading--illustrated' : ''}`}>
    <div><span className="venue-kicker">{eyebrow}</span><h1>{words.length > 0 && `${words.join(' ')} `}<em>{accent}</em></h1><p>{children}</p></div>
    {art && <PropArt id={art} className="venue-page-heading__art" />}
  </header>;
}
