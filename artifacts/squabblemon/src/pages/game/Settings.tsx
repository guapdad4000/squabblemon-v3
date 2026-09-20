import { revealProfileRewards } from '../../lib/rewardReceipts';
import { MusicControls } from '../../components/MusicControls';
import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { e2eAuthEnabled, useAppClerk } from '../../lib/auth';
import { PlayerBootstrap, useUpdatePlayerProfile, getGetPlayerBootstrapQueryKey, useResetPlayerStoryDevelopment, getGetPlayerStoryQueryKey, useRedeemPlayerPromoCode, ApiError } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { storyContent } from '@workspace/squabblemon-engine/story';
import { catalogCardById } from '@workspace/squabblemon-engine/data';
import { basePath } from '../../lib/routing';
import { PageHeading } from '../../components/venue/PageHeading';
import { PageDecor } from '../../components/venue/PageDecor';

export function Settings({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const { signOut } = useAppClerk();
  const updateProfile = useUpdatePlayerProfile();
  const queryClient = useQueryClient();
  
  const [name, setName] = useState(bootstrap.profile.displayName);
  const [reducedMotion, setReducedMotion] = useState(bootstrap.profile.settings.reducedMotion);
  const [turnTimerEnabled, setTurnTimerEnabled] = useState(bootstrap.profile.settings.turnTimerEnabled);
  const [status, setStatus] = useState<string | null>(null);
  const redeemPromo = useRedeemPlayerPromoCode();
  const redeemInFlight = useRef(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoStatus, setPromoStatus] = useState<{ text: string; error: boolean; showPacks?: boolean } | null>(null);
  const preview = e2eAuthEnabled && bootstrap.profile.id === 'e2e-player';

  const handleRedeem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (preview || redeemInFlight.current || !promoCode.trim()) return;
    redeemInFlight.current = true;
    setPromoStatus(null);
    try {
      const result = await redeemPromo.mutateAsync({ data: { code: promoCode.trim() } });
      // Stop an older bootstrap request from overwriting the credited balances.
      await queryClient.cancelQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
      queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), result.bootstrap);
      const { receipt } = result;
      if (!result.alreadyRedeemed) revealProfileRewards(bootstrap, result.bootstrap, `promo:${receipt.code}`, 'Promo rewards');
      const cardNames = receipt.cardIds?.map(id => catalogCardById[id]?.name ?? id).join(' and ');
      const cardSummary = receipt.cardIds?.length && receipt.cardIds.length > 2
        ? `${receipt.cardIds.length} characters` : cardNames;
      const credited = [
        cardSummary ? `${cardSummary} added to your collection` : null,
        receipt.packTickets ? `+${receipt.packTickets.toLocaleString()} pack tickets` : null,
        receipt.softCurrency ? `+${receipt.softCurrency.toLocaleString()} Clout` : null,
        receipt.styleShards ? `+${receipt.styleShards.toLocaleString()} Style Shards` : null,
      ].filter(Boolean).join(' · ');
      setPromoStatus({
        error: false,
        showPacks: receipt.packTickets > 0,
        text: result.alreadyRedeemed
          ? `${receipt.code} was already redeemed on this account. Your cards and balances are up to date.`
          : `${receipt.code} redeemed! ${credited}.`,
      });
      setPromoCode('');
    } catch (error) {
      const message = error instanceof ApiError && error.data && typeof error.data === 'object' && 'error' in error.data && typeof error.data.error === 'string'
        ? error.data.error
        : 'Could not confirm redemption. Try the same code again; rewards can only be claimed once.';
      setPromoStatus({ text: message, error: true });
    } finally {
      redeemInFlight.current = false;
    }
  };

  const resetStory = useResetPlayerStoryDevelopment();
  const [resetNode, setResetNode] = useState('');
  const [resetStatus, setResetStatus] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      if (!name.trim()) { setStatus('Enter a display name before saving.'); return; }
      if (e2eAuthEnabled && bootstrap.profile.id === 'e2e-player') {
        queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), {
          ...bootstrap, profile: { ...bootstrap.profile, displayName: name.trim(), settings: { reducedMotion, turnTimerEnabled } },
        });
        setStatus('Preview settings applied for this session.');
        return;
      }
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

  const handleReset = async () => {
    try {
      const res = await resetStory.mutateAsync({ data: { selectNodeId: resetNode.trim() || null } });
      queryClient.setQueryData(getGetPlayerStoryQueryKey(), res);
      await queryClient.invalidateQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
      setResetStatus('Story progression reset.');
      setResetNode('');
    } catch (e) {
      setResetStatus('Failed to reset story progression.');
    }
  };

  return (
    <div className="profile-stage world-decor-host p-4 md:p-6 pb-24 h-full overflow-y-auto">
      <PageDecor theme="profile" />
      <PageHeading art="championship-chain" eyebrow="YOUR NAME / YOUR RULES" title="Your profile.">Set your identity. Find your rhythm.</PageHeading>
      <Link href="/how-to-play" className="block mb-6 border border-primary/30 bg-primary/5 p-4 text-primary text-sm font-bold hover:bg-primary/10">
        How to play · Characters, Street Packs & card upgrades →
      </Link>

      <section id="promo-code" aria-labelledby="promo-code-title" className="mb-6 border-y border-primary/30 py-5">
        <h2 id="promo-code-title" className="font-display text-xl font-black italic uppercase text-primary">Got a code?</h2>
        <p id="promo-code-help" className="mt-1 mb-4 text-sm text-white/60">
          {preview ? 'Promo codes need a connected account. This local preview does not save rewards.' : 'Enter a promo code to add rewards to your account. Each code can be claimed once.'}
        </p>
        <form onSubmit={handleRedeem} className="flex flex-col sm:flex-row gap-3" aria-busy={redeemPromo.isPending}>
          <label className="min-w-0 flex-1">
            <span className="sr-only">Promo code</span>
            <input
              type="text"
              value={promoCode}
              onChange={event => { setPromoCode(event.target.value); setPromoStatus(null); }}
              placeholder="Enter promo code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={64}
              aria-describedby="promo-code-help"
              disabled={preview || redeemPromo.isPending}
              className="w-full bg-zinc-900 border border-white/20 p-3 font-mono uppercase text-white outline-none focus:border-primary disabled:opacity-50"
            />
          </label>
          <button type="submit" disabled={preview || redeemPromo.isPending || !promoCode.trim()} className="px-6 py-3 bg-primary text-black font-display font-black uppercase hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed">
            {redeemPromo.isPending ? 'Redeeming…' : 'Redeem code'}
          </button>
        </form>
        {promoStatus && <p role={promoStatus.error ? 'alert' : 'status'} className={`mt-3 text-sm ${promoStatus.error ? 'text-accent' : 'text-primary'}`}>{promoStatus.text}</p>}
        {promoStatus && !promoStatus.error && (
          <div className="mt-3 flex flex-wrap gap-5 text-sm font-bold text-primary">
            {promoStatus.showPacks && <Link href="/game/shop?view=packs" className="underline underline-offset-4">Open packs →</Link>}
            <Link href="/game/decks" className="underline underline-offset-4">Build your gang →</Link>
          </div>
        )}
      </section>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-white/10 bg-black/30 p-4">
        <div><h2 className="text-sm font-bold">Your soundtrack</h2><p className="text-xs text-white/60">Oakland Chrome and Curls · Original music by Treblo</p></div>
        <MusicControls />
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

        {import.meta.env.DEV && (
          <div className="pt-6 border-t border-white/10">
            <div className="font-display font-bold uppercase text-sm mb-2 text-accent">Developer Controls</div>
            <div className="text-[10px] text-white/50 font-sans mb-4">Reset story campaign progression. Production builds will not see this.</div>
            <div className="flex gap-2 mb-2">
              <select
                value={resetNode}
                onChange={e => setResetNode(e.target.value)}
                aria-label="Story node to make available after reset"
                className="bg-zinc-900 border border-white/20 text-white p-2 text-xs focus:border-primary outline-none flex-1"
              >
                <option value="">Start of Chapter One</option>
                {storyContent.chapters.flatMap((chapter) =>
                  chapter.nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.title}{node.optional ? ' (Mastery)' : ''}
                    </option>
                  )),
                )}
              </select>
              <button
                onClick={handleReset}
                disabled={resetStory.isPending}
                className="px-4 py-2 bg-accent/20 border border-accent/40 text-accent font-bold uppercase text-xs hover:bg-accent/40 disabled:opacity-50 transition-colors"
              >
                {resetStory.isPending ? 'Resetting...' : 'Reset Story'}
              </button>
            </div>
            {resetStatus && <div className="text-[9px] uppercase tracking-wider text-accent">{resetStatus}</div>}
          </div>
        )}

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
