import { useState } from 'react';
import { useClerk } from '@clerk/react';
import { PlayerBootstrap, useUpdatePlayerProfile, getGetPlayerBootstrapQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { basePath } from '../../lib/routing';

export function Settings({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const { signOut } = useClerk();
  const updateProfile = useUpdatePlayerProfile();
  const queryClient = useQueryClient();
  
  const [name, setName] = useState(bootstrap.profile.displayName);
  const [reducedMotion, setReducedMotion] = useState(bootstrap.profile.settings.reducedMotion);
  const [turnTimerEnabled, setTurnTimerEnabled] = useState(bootstrap.profile.settings.turnTimerEnabled);
  const [status, setStatus] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      const res = await updateProfile.mutateAsync({
        data: { displayName: name.trim(), reducedMotion, turnTimerEnabled }
      });
      queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), res);
      setStatus('Profile saved.');
    } catch (e) {
      console.error(e);
      setStatus('Profile could not be saved. Try again.');
    }
  };

  return (
    <div className="p-4 md:p-6 pb-24 h-full overflow-y-auto">
      <div className="mb-6">
        <h1 className="font-display font-black italic text-3xl uppercase leading-none mb-1">Settings</h1>
        <p className="font-mono text-[10px] text-white/50 uppercase tracking-widest">Manage profile & account</p>
      </div>

      <div className="space-y-6">
        <div className="space-y-4">
          <label className="block">
            <span className="font-mono text-[9px] text-white/60 uppercase tracking-wider mb-2 block">Display Name</span>
            <input 
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-zinc-900 border border-white/20 text-white p-3 font-display font-bold uppercase focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              maxLength={24}
            />
          </label>

          <label className="flex items-center justify-between p-3 border border-white/10 bg-black cursor-pointer">
            <div>
              <div className="font-display font-bold uppercase text-sm">Reduced Motion</div>
              <div className="text-[10px] text-white/50 font-sans">Disable cinematic screen shakes & animations</div>
            </div>
            <input 
              type="checkbox" 
              checked={reducedMotion} 
              onChange={e => setReducedMotion(e.target.checked)} 
              className="w-5 h-5 accent-primary bg-zinc-900 border-white/20" 
            />
          </label>

          <label className="flex items-center justify-between p-3 border border-white/10 bg-black cursor-pointer">
            <div>
              <div className="font-display font-bold uppercase text-sm">Turn Timer</div>
              <div className="text-[10px] text-white/50 font-sans">Keep the 20-second move clock on screen</div>
            </div>
            <input
              type="checkbox"
              checked={turnTimerEnabled}
              onChange={e => setTurnTimerEnabled(e.target.checked)}
              className="w-5 h-5 accent-primary bg-zinc-900 border-white/20"
            />
          </label>

          {status && (
            <div role="status" className={`font-mono text-[9px] uppercase tracking-wider ${status.includes('not') ? 'text-accent' : 'text-primary'}`}>
              {status}
            </div>
          )}

          <button 
            onClick={handleSave}
            disabled={updateProfile.isPending}
            className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-display font-black italic uppercase transition-all"
          >
            {updateProfile.isPending ? 'Saving...' : 'Save Profile'}
          </button>
        </div>

        <div className="pt-6 border-t border-white/10">
          <button 
            onClick={() => signOut({ redirectUrl: basePath || '/' })}
            className="w-full py-3 border border-accent/50 text-accent font-display font-black italic uppercase hover:bg-accent hover:text-white transition-all"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}