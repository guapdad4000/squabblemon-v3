import { getAssetUrl } from '../lib/assets';

/** Decorative gang-building artwork kept behind the live workshop controls. */
export function GangBackdrop() {
  return (
    <picture className="gang-backdrop" data-testid="gang-backdrop" aria-hidden="true">
      <source media="(max-width: 700px)" srcSet={getAssetUrl('assets/deck-workshop/gang-mobile.webp')} />
      <img
        src={getAssetUrl('assets/deck-workshop/gang-desktop.webp')}
        alt=""
        draggable={false}
        decoding="async"
      />
    </picture>
  );
}