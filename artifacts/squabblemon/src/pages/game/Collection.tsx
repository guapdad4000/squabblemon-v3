import { PlayerBootstrap } from '@workspace/api-client-react';
import { cards, getCardImage } from '../../data';

export function Collection({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const ownedCount = bootstrap.profile.ownedCardIds.length;
  
  return (
    <div className="p-4 md:p-6 pb-24 h-full flex flex-col">
      <div className="mb-6">
        <h1 className="font-display font-black italic text-3xl uppercase leading-none mb-1">Collection</h1>
        <p className="font-mono text-[10px] text-white/50 uppercase tracking-widest">Cards Owned: {ownedCount}</p>
      </div>

      {ownedCount > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 overflow-y-auto hide-scrollbar pb-5">
            {bootstrap.profile.ownedCardIds.map((id) => {
              const card = Object.values(cards).find((candidate) => candidate.id === id);
              return (
                <article key={id} className="relative aspect-[3/4] overflow-hidden border border-white/10 bg-black">
                  <img src={getCardImage(id)} alt="" className="absolute inset-0 w-full h-full object-cover object-top" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <div className="font-display font-black italic uppercase text-sm leading-none">{card?.name ?? id.replaceAll('-', ' ')}</div>
                    <div className="font-mono text-[7px] text-primary uppercase tracking-widest mt-1">{card?.type ?? 'Crew card'}</div>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="border border-primary/30 bg-primary/5 p-4 text-center">
            <h2 className="font-display font-black italic text-lg uppercase mb-1">Deck lab arriving next</h2>
            <p className="text-white/50 text-xs">Your starter cards are safe. Full deck editing will open in the collection update.</p>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-white/10 bg-white/5">
          <h2 className="font-display font-black italic text-xl uppercase mb-2">No crew claimed yet</h2>
          <p className="text-white/50 text-sm max-w-xs">Finish Rookie Road to secure your first seven cards.</p>
        </div>
      )}
    </div>
  );
}