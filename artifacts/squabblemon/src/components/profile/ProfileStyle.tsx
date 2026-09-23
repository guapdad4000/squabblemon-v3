import { useState } from 'react';
import { Link } from 'wouter';
import { useReducedMotion } from 'framer-motion';
import type { PlayerBootstrap } from '@workspace/api-client-react';
import { stickerById, styleSetFor } from '@workspace/squabblemon-engine/cosmetics';
import { CharacterBanner } from '../CharacterBanner';
import { catalogPortrait, FighterPortrait, profilePortrait } from './FighterPortrait';

export function ProfileStyle({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const { profile } = bootstrap;
  const cosmetics = profile.settings.cosmetics;
  const bannerId = cosmetics?.bannerCardId;
  const set = styleSetFor(bannerId);
  const card = bannerId ? catalogPortrait(bannerId) : undefined;
  const hasBanner = !!(set && card && profile.ownedCardIds.includes(card.catalogId));
  const [failedBanner, setFailedBanner] = useState<string | null>(null);
  const systemReduced = useReducedMotion();
  const { card: portrait } = profilePortrait(profile);
  const stickers = (cosmetics?.stickers ?? []).filter(id => !!stickerById(id)).slice(0, 3);
  return <div className="profile-style">
    <h1 className="panel-title">Signature Style</h1>
    <p className="profile-progress-note">Your saved look. Cosmetics never change your combat stats.</p>
    {hasBanner && failedBanner !== bannerId ? <div className="profile-style-banner" onErrorCapture={() => setFailedBanner(bannerId!)}>
      <CharacterBanner cardId={bannerId!} finish={cosmetics?.bannerFinish} stickers={stickers} displayName={profile.displayName}
        animated={!systemReduced && !profile.settings.reducedMotion} />
    </div> : <div className="profile-style-default">
      <FighterPortrait cardId={portrait.catalogId} name={portrait.name} />
      <div><span className="id-card__label">Safehouse original</span><strong>{profile.displayName}</strong>
        <p>{hasBanner ? 'Banner artwork unavailable' : 'No banner equipped'}</p>
        <small>{hasBanner ? 'Your equipped selection is still saved. You can customize it below.' : 'Your Fighter ID is already yours. Choose a character banner from your signature collections.'}</small>
      </div>
    </div>}
    <section className="panel-section">
      <h2 className="panel-section-title">Equipped look</h2>
      <dl className="profile-style-details">
        <div><dt>Banner</dt><dd>{hasBanner ? card!.name : 'Safehouse original · default'}</dd></div>
        <div><dt>Finish</dt><dd>{hasBanner ? cosmetics?.bannerFinish === 'silver' ? 'Silver Lining' : 'Base' : 'Original'}</dd></div>
        <div><dt>Stickers</dt><dd>{hasBanner && stickers.length ? stickers.map(id => stickerById(id)!.sticker.name).join(' · ') : 'None equipped'}</dd></div>
      </dl>
    </section>
    <div className="fighter-id-actions">
      {hasBanner && <Link className="street-sign-btn" href={`/game/style/${bannerId}`}>Customize banner →</Link>}
      <Link className={`street-sign-btn${hasBanner ? ' street-sign-btn--secondary' : ''}`} href="/game/style">Browse styles →</Link>
    </div>
  </div>;
}