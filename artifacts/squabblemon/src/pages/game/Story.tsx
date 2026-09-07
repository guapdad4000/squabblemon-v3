import { getAssetUrl } from '../../data';

export function Story() {
  return (
    <div className="p-4 md:p-6 pb-24 h-full flex flex-col">
      <div className="mb-6">
        <h1 className="font-display font-black italic text-3xl uppercase leading-none mb-1">Story Mode</h1>
        <p className="font-mono text-[10px] text-white/50 uppercase tracking-widest">Chapter 1</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-white/10 bg-white/5 relative overflow-hidden" style={{ clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))' }}>
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20 grayscale mix-blend-overlay"
          style={{ backgroundImage: `url("${getAssetUrl('assets/e71f5189-861e-418d-8237-fa20713b9122.png')}")` }}
        />
        <div className="relative z-10">
          <h2 className="font-display font-black italic text-4xl text-primary uppercase mb-2">Block Party</h2>
          <p className="text-white/70 text-sm max-w-xs mx-auto mb-6">The first chapter is currently in development. Build your crew and street rep in practice matches while we finish laying the asphalt.</p>
          <div className="inline-block border border-white/20 bg-black/50 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-white/40">
            Coming Soon
          </div>
        </div>
      </div>
    </div>
  );
}