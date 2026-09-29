import type { ReactNode } from 'react';
import type { SocialPlayer } from './_social';
import { FighterPortrait } from './_FighterPortrait';

export function SocialPlayerRow({ player, meta, children, testId, tone }: { player: SocialPlayer; meta?: ReactNode; children?: ReactNode; testId?: string; tone?: 'gold' | 'rust' | 'leaf' }) {
  return <li className="sq-row" data-tone={tone} data-testid={testId}>
    <div className="sq-row__who">
      <span className="sq-row__portrait"><FighterPortrait avatarKey={player.avatarKey} name={player.displayName} decorative /></span>
      <span className="sq-row__text">
        <strong className="sq-row__name">{player.displayName}</strong>
        <small className="sq-row__meta">{meta ?? <span className="sq-code">{player.friendCode}</span>}</small>
      </span>
    </div>
    {children && <div className="sq-row__actions">{children}</div>}
  </li>;
}

export function SectionHead({ title, count, note }: { title: string; count?: number; note?: string }) {
  return <header className="sq-section__head">
    <h2>{title}{count ? <span className="sq-count" aria-label={`${count} total`}>{count}</span> : null}</h2>
    {note && <p>{note}</p>}
  </header>;
}
