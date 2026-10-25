import { useEffect, useRef } from 'react';

export function BattleRulesUpdated({ challenge, onExit }: {
  challenge?: boolean; onExit: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const refresh = () => {
    if (challenge) {
      const url = new URL(window.location.href);
      url.searchParams.set('machine', 'road');
      window.history.replaceState(window.history.state, '', url);
    }
    // A deployment can invalidate the loaded engine as well as the saved match.
    // The Road resumes its existing server-owned run after the new bundle loads.
    window.location.reload();
  };
  return <main className="studio-results min-h-[100dvh] grid place-items-center bg-black p-6 text-white" aria-labelledby="battle-rules-updated">
    <section className="max-w-md text-center">
      <h1 id="battle-rules-updated" ref={heading} tabIndex={-1} className="font-display text-4xl">Rules updated</h1>
      <p className="my-5">Refresh the game to load the current rules. Your saved rewards are safe.{challenge ? ' Your run and entry are saved. Continue from The Road.' : ''}</p>
      <nav className="flex flex-wrap justify-center gap-3" aria-label="Recover updated battle">
        <button type="button" className="studio-action studio-action--gold min-h-11" onClick={refresh}>Refresh game</button>
        <button type="button" className="studio-action min-h-11" onClick={onExit}>Back</button>
      </nav>
    </section>
  </main>;
}
