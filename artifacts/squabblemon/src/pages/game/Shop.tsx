import { PlayerBootstrap } from '@workspace/api-client-react';

export function Shop({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  return (
    <div className="p-4 md:p-6 pb-24 h-full flex flex-col">
      <div className="mb-6">
        <h1 className="font-display font-black italic text-3xl uppercase leading-none mb-1">Street Shop</h1>
        <p className="font-mono text-[10px] text-white/50 uppercase tracking-widest">Packs & Cosmetics</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-white/10 bg-white/5" style={{ clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))' }}>
        <div className="w-16 h-16 border-2 border-primary rotate-12 mb-6 flex items-center justify-center">
          <span className="font-display font-black text-2xl text-primary -rotate-12">$</span>
        </div>
        <h2 className="font-display font-black italic text-xl uppercase mb-2">Shop Closed</h2>
        <p className="text-white/50 text-sm max-w-xs">Street Packs and fresh cosmetics are being stocked. Save your tickets and currency for the drop.</p>
      </div>
    </div>
  );
}