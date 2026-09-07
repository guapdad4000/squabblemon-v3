import { PlayerBootstrap, useClaimPlayerMission, getGetPlayerBootstrapQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

export function Missions({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const claimMission = useClaimPlayerMission();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const handleClaim = async (missionId: string) => {
    try {
      setError(null);
      const res = await claimMission.mutateAsync({ missionId });
      queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), res);
    } catch (e) {
      console.error('Failed to claim mission', e);
      setError('Reward claim failed. Nothing was spent; try again.');
    }
  };

  return (
    <div className="p-4 md:p-6 pb-24 h-full overflow-y-auto">
      <div className="mb-6">
        <h1 className="font-display font-black italic text-3xl uppercase leading-none mb-1">Missions</h1>
        <p className="font-mono text-[10px] text-white/50 uppercase tracking-widest">Complete goals for rewards</p>
      </div>

      <div className="space-y-3">
        {error && (
          <div role="alert" className="border border-accent bg-accent/10 p-3 font-mono text-[9px] uppercase tracking-wider text-rose-200">
            {error}
          </div>
        )}
        {bootstrap.missions.map(m => (
          <div key={m.id} className={`p-4 border ${m.status === 'claimable' ? 'border-accent bg-accent/10' : 'border-white/10 bg-black'}`} style={{ clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))' }}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="font-mono text-[8px] uppercase tracking-widest text-primary mb-1">{m.cadence}</div>
                <div className="font-display font-bold uppercase text-lg leading-tight">{m.title}</div>
                <div className="text-white/60 text-xs mt-1">{m.description}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-[9px] uppercase tracking-widest text-white/40 mb-1">Reward</div>
                <div className="font-display font-black text-primary">{m.rewardAmount} {m.rewardCurrency === 'softCurrency' ? 'SC' : 'Tix'}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-white/10 overflow-hidden relative">
                <div 
                  className={`absolute inset-y-0 left-0 ${m.status === 'claimable' ? 'bg-accent' : m.status === 'claimed' ? 'bg-white/30' : 'bg-primary'}`} 
                  style={{ width: `${Math.min(100, (m.progress / m.goal) * 100)}%` }} 
                />
              </div>
              <div className="font-mono text-[10px] text-white/50">{m.progress}/{m.goal}</div>
            </div>

            {m.status === 'claimable' && (
              <button 
                onClick={() => handleClaim(m.id)}
                disabled={claimMission.isPending}
                className="mt-4 w-full py-2 bg-accent text-white font-display font-black italic uppercase text-sm hover:bg-rose-500 active:translate-y-1 transition-all"
              >
                {claimMission.isPending ? 'Claiming...' : 'Claim Reward'}
              </button>
            )}
            
            {m.status === 'claimed' && (
              <div className="mt-4 w-full py-2 border border-white/10 text-white/30 font-display font-black italic uppercase text-sm text-center">
                Claimed
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}