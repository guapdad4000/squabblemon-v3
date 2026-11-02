import { useEffect, useRef, type ReactNode } from 'react';

/** Native modal semantics keep the map/scene inert and restore the opener's focus. */
export function StoryDialog({ children, className, label, onClose }: {
  children: ReactNode; className: string; label: string; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => { dialog.close(); if (opener?.isConnected) opener.focus(); };
  }, []);
  return <dialog ref={ref} className={className} aria-label={label}
    onCancel={event => { event.preventDefault(); onClose(); }}>{children}</dialog>;
}
