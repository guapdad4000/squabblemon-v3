import { forwardRef, type CSSProperties, type HTMLAttributes, type ButtonHTMLAttributes } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getAssetUrl } from '../../lib/assets';
import '../../styles/game-popup.css';
import '../../styles/reward-street-file.css';

export type GamePopupFamily = 'reward' | 'announcement' | 'confirmation' | 'recruit';
export type GamePopupTone = 'neutral' | 'destructive';
export type GamePopupMaterial = 'plain' | 'dossier' | 'brick';

/** Presentation only. The caller keeps its native/Radix dialog, focus and dismissal lifecycle. */
export const GamePopupFrame = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & {
  family?: GamePopupFamily; tone?: GamePopupTone; material?: GamePopupMaterial;
}>(({ className, family = 'announcement', tone = 'neutral', material = 'plain', style, ...props }, ref) =>
  <div ref={ref} {...props} className={cn('game-popup', material !== 'plain' && 'reward-street-file', material === 'brick' && 'game-popup--brick', className)}
    style={{ '--popup-brick-wall': `url("${getAssetUrl('assets/progression/brick-ui-v1.webp')}")`,
      '--reward-file-scene': `url("${getAssetUrl('assets/selection/underpass.webp')}")`,
      '--reward-file-folder': `url("${getAssetUrl('assets/selection/dossier.webp')}")`, ...style } as CSSProperties}
    data-popup-family={family} data-popup-tone={tone} data-popup-material={material} />);
GamePopupFrame.displayName = 'GamePopupFrame';

export const GamePopupTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement> & { feature?: boolean }>(
  ({ className, feature = false, ...props }, ref) => <h2 ref={ref} {...props} className={cn('game-popup__title', feature && 'game-popup__title--feature', className)} data-lettering={feature ? 'feature' : undefined} />,
);
GamePopupTitle.displayName = 'GamePopupTitle';
export function GamePopupLabel({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span {...props} className={cn('game-popup__label', className)} />;
}
export function GamePopupCopy({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p {...props} className={cn('game-popup__copy', className)} />;
}
export function GamePopupAmount({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <strong {...props} className={cn('game-popup__amount', className)} />;
}
export const GamePopupClose = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, type = 'button', 'aria-label': label = 'Close', ...props }, ref) =>
    <button ref={ref} {...props} type={type} aria-label={label} className={cn('game-popup__close', className)}>{children ?? <X aria-hidden="true" size={22} />}</button>,
);
GamePopupClose.displayName = 'GamePopupClose';
export const GamePopupSecondary = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, type = 'button', ...props }, ref) => <button ref={ref} {...props} type={type} className={cn('game-popup__secondary', className)} />,
);
GamePopupSecondary.displayName = 'GamePopupSecondary';

export const RewardFilePaper = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} {...props} className={cn('reward-street-file__paper', className)} />,
);
RewardFilePaper.displayName = 'RewardFilePaper';
export function RewardFileStamp({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span {...props} className={cn('reward-street-file__stamp', 'game-popup__label', className)} />;
}
export function RewardFileLoot({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn('reward-street-file__loot', className)} />;
}
export const RewardFileAction = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, type = 'button', ...props }, ref) => <button ref={ref} {...props} type={type} className={cn('reward-street-file__action', className)} />,
);
RewardFileAction.displayName = 'RewardFileAction';
