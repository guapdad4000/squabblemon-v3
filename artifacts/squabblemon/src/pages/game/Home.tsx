import { Link } from 'wouter';
import { PlayerBootstrap } from '@workspace/api-client-react';
import { getCardImage } from '../../data';

export function Home({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const { profile, missions, nextAction } = bootstrap;

  return (
    <div className="p-4 md:p-6 pb-24 space-y-5 h-full overflow-y-auto hide-scrollbar">
      <header className="flex justify-between items-end">
        <div>
          <div className="font-mono text-[10px] text-white/50 uppercase tracking-widest mb-1">Level {profile.level}</div>
          <h1 className="font-display font-black italic text-3xl uppercase leading-none">{profile.displayName}</h1>
        </div>
        <div className="text-right">
          <div className="font-mono text-[9px] text-primary uppercase tracking-widest mb-1">Street Rep</div>
          <div className="font-display font-black text-2xl leading-none">{profile.streetRep}</div>
        </div>
      </header>

      <div className="flex gap-2 font-mono text-[10px] tracking-wider">
        <div className="bg-white/5 border border-white/10 px-3 py-2 flex-1 flex justify-between uppercase">
          <span className="text-white/50">Soft</span>
          <span className="text-white">{profile.softCurrency}</span>
        </div>
        <div className="bg-white/5 border border-white/10 px-3 py-2 flex-1 flex justify-between uppercase">
          <span className="text-white/50">Tickets</span>
          <span className="text-white">{profile.packTickets}</span>
        </div>
      </div>

      <section className="relative min-h-52 md:min-h-64 border border-white/10 overflow-hidden bg-[radial-gradient(circle_at_78%_30%,rgba(250,204,21,.2),transparent_45%),linear-gradient(135deg,#211b06,#090909_58%)]">
        <img
          src={getCardImage(profile.avatarKey)}
          alt=""
          aria-hidden="true"
          className="absolute right-[-8%] md:right-[4%] bottom-[-12%] h-[118%] w-[62%] object-contain object-bottom drop-shadow-[0_20px_25px_rgba(0,0,0,.8)]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/35 to-transparent" />
        <div className="relative z-10 p-5 flex flex-col items-start justify-end min-h-52 md:min-h-64 max-w-sm">
          <div className="font-mono text-[9px] text-primary uppercase tracking-[.2em] mb-2">Rookie Road</div>
          <h2 className="font-display font-black italic text-3xl md:text-5xl uppercase leading-none mb-3">Street Story</h2>
          <p className="text-xs md:text-sm text-white/65 mb-5">Move through the neighborhood conflicts and make a name for yourself.</p>
          <div className="flex gap-3 w-full">
            <Link href="/game/story" className="flex-1 text-center bg-primary text-black px-4 py-3 font-display font-black italic uppercase shadow-[0_4px_0_#854d0e] active:translate-y-1 active:shadow-none">
              Enter Story
            </Link>
            <Link href="/game/play" className="flex-1 text-center bg-black/50 border border-white/20 text-white px-4 py-3 font-display font-black italic uppercase hover:bg-white/10 active:translate-y-1">
              Practice
            </Link>
          </div>
        </div>
      </section>

      <section>
        <div className="font-mono text-[10px] text-white/40 uppercase tracking-widest mb-3">Up Next</div>
        <Link href={`/game/${nextAction.destination === 'play' ? 'play' : nextAction.destination}`} className="block relative bg-primary/10 border border-primary p-5 hover:bg-primary/20 transition-all active:scale-[0.98]" style={{ clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))' }}>
          <div className="absolute top-0 right-0 p-3 opacity-20 pointer-events-none">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </div>
          <div className="font-mono text-[9px] text-primary uppercase tracking-widest mb-1">{nextAction.eyebrow}</div>
          <h2 className="font-display font-black italic text-2xl uppercase mb-2">{nextAction.title}</h2>
          <p className="text-sm text-white/70">{nextAction.description}</p>
          {nextAction.rewardLabel && (
            <div className="mt-4 inline-block px-2 py-1 bg-primary text-black font-mono text-[9px] uppercase font-bold">
              Reward: {nextAction.rewardLabel}
            </div>
          )}
        </Link>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          ['/game/story', 'Story', `Chapter ${profile.storyChapter || 1}`],
          ['/game/collection', 'Collection', `${profile.ownedCardIds.length} cards`],
          ['/game/missions', 'Missions', `${missions.filter((mission) => mission.status === 'claimable').length} ready`],
          ['/game/shop', 'Street Shop', `${profile.packTickets} tickets`],
        ].map(([href, title, detail]) => (
          <Link key={href} href={href} className="min-h-24 bg-white/5 border border-white/10 p-3 flex flex-col justify-end hover:border-primary/60 hover:bg-primary/5 transition-colors">
            <div className="font-display font-black italic uppercase text-lg leading-none">{title}</div>
            <div className="font-mono text-[8px] text-primary uppercase tracking-widest mt-2">{detail}</div>
          </Link>
        ))}
      </section>

      <section>
         <div className="flex justify-between items-end mb-3">
           <div className="font-mono text-[10px] text-white/40 uppercase tracking-widest">Active Missions</div>
           <Link href="/game/missions" className="font-mono text-[9px] text-primary uppercase tracking-widest hover:underline">View All</Link>
         </div>
         <div className="space-y-2">
           {missions.slice(0, 3).map(m => (
             <div key={m.id} className="bg-black border border-white/10 p-3 flex justify-between items-center">
                <div>
                  <div className="font-display font-bold uppercase text-sm">{m.title}</div>
                  <div className="font-mono text-[9px] text-white/40 uppercase mt-0.5">{m.progress} / {m.goal}</div>
                </div>
                {m.status === 'claimable' && (
                  <Link href="/game/missions" className="px-3 py-1.5 bg-accent text-white font-mono text-[9px] uppercase tracking-widest">Claim</Link>
                )}
             </div>
           ))}
         </div>
      </section>
    </div>
  );
}