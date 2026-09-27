import { playInteractionSound, type InteractionSound } from './interactionAudio';

const paperTabs = '.arsenal-paper-tabs, .collection-tabs, .market-tabs, .fight-tabs, .guide-chapter-nav';
const safehouseHeaderIcon = '.city-header__safehouse';

/** Shared click routing includes keyboard activation and portalled arcade dialogs. */
export function interactionClickSound(target: EventTarget | null): InteractionSound | null {
  if (!(target instanceof Element)) return null;
  const control = target.closest('button, a[href], [role="button"], [role="tab"], input[type="button"], input[type="submit"]');
  if (!control || control.matches(':disabled') || control.closest('[aria-disabled="true"], [inert]')) return null;
  // A paper tab stays a paper tab even when it sits inside the arcade.
  if (control.closest(paperTabs) || control.matches('.venue-nav__item')) return 'page-turn';
  if (control.closest('.fadecade-hub, .fadecade-dialog-content')) return 'arcade-beep';
  if (control.closest(safehouseHeaderIcon)) return 'keys-jingle';
  return null;
}

export function installInteractionClickSounds() {
  const onClick = (event: MouseEvent) => {
    if (event.button !== 0) return;
    const sound = interactionClickSound(event.target);
    if (sound) playInteractionSound(sound);
  };
  // Capture before navigation removes a tab or closes a portalled dialog.
  document.addEventListener('click', onClick, true);
  return () => document.removeEventListener('click', onClick, true);
}
