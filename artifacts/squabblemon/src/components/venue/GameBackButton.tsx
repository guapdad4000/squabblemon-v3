import type { Ref } from 'react';
import { useLocation, useSearch } from 'wouter';
import { getAssetUrl } from '../../lib/assets';
import { previousGameLocation, routeFallback } from '../../lib/navigationMemory';
import './game-back-button.css';

export function useGameBack() {
  const [path, navigate] = useLocation();
  const search = useSearch();
  return () => {
    if (previousGameLocation()) history.back();
    else navigate(routeFallback(path + (search ? '?' + search : '')), { replace: true });
  };
}

export function GameBackButton({ onClick, label = 'Back', className = '', buttonRef }: { buttonRef?: Ref<HTMLButtonElement>; onClick?: () => void; label?: string; className?: string }) {
  const back = useGameBack();
  return <button ref={buttonRef} type="button" className={`game-back-button ${className}`} aria-label={label} title={label}
    onClick={onClick ?? back}>
    <img src={getAssetUrl('brand/navigation/back-arrow.png')} alt="" draggable={false} />
    <span>{label}</span>
  </button>;
}
