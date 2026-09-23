import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  getGetPlayerBootstrapQueryKey,
  getGetPlayerStoryQueryKey,
  type PlayerBootstrap,
  useRedeemPlayerPromoCode,
  useResetPlayerStoryDevelopment,
  useUpdatePlayerProfile,
} from '@workspace/api-client-react';
import { storyContent } from '@workspace/squabblemon-engine/story';
import { catalogCardById } from '@workspace/squabblemon-engine/data';
import { e2eAuthEnabled, useAppClerk } from '../../lib/auth';
import { basePath } from '../../lib/routing';
import { revealProfileRewards } from '../../lib/rewardReceipts';
import { MusicControls } from '../MusicControls';

type Feedback = { text: string; error: boolean };
type PromoFeedback = Feedback & { success?: boolean };

function apiMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.data && typeof error.data === 'object') {
    const data = error.data as Record<string, unknown>;
    if (typeof data.error === 'string' && data.error.trim()) return data.error;
    if (typeof data.message === 'string' && data.message.trim()) return data.message;
  }
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export function ProfileSettings({
  bootstrap,
  onBusyChange,
}: {
  bootstrap: PlayerBootstrap;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { signOut } = useAppClerk();
  const queryClient = useQueryClient();
  const updateProfile = useUpdatePlayerProfile();
  const redeemPromo = useRedeemPlayerPromoCode();
  const resetStory = useResetPlayerStoryDevelopment();
  const { profile } = bootstrap;
  const preview = e2eAuthEnabled && profile.id === 'e2e-player';

  const [reducedMotion, setReducedMotion] = useState(profile.settings.reducedMotion);
  const [turnTimerEnabled, setTurnTimerEnabled] = useState(profile.settings.turnTimerEnabled);
  const [preferencesDirty, setPreferencesDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveInFlight = useRef(false);
  const [saveFeedback, setSaveFeedback] = useState<Feedback | null>(null);
  const confirmedPreferences = useRef({
    reducedMotion: profile.settings.reducedMotion,
    turnTimerEnabled: profile.settings.turnTimerEnabled,
  });

  const [promoCode, setPromoCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const redeemInFlight = useRef(false);
  const [promoFeedback, setPromoFeedback] = useState<PromoFeedback | null>(null);
  const [resetNode, setResetNode] = useState('');
  const [resetFeedback, setResetFeedback] = useState<Feedback | null>(null);
  const mutationBusy = isSaving || isRedeeming || resetStory.isPending;

  useEffect(() => {
    const next = {
      reducedMotion: profile.settings.reducedMotion,
      turnTimerEnabled: profile.settings.turnTimerEnabled,
    };
    const changed = next.reducedMotion !== confirmedPreferences.current.reducedMotion
      || next.turnTimerEnabled !== confirmedPreferences.current.turnTimerEnabled;
    confirmedPreferences.current = next;
    if (changed && !preferencesDirty) {
      setReducedMotion(next.reducedMotion);
      setTurnTimerEnabled(next.turnTimerEnabled);
    }
  }, [profile.settings.reducedMotion, profile.settings.turnTimerEnabled, preferencesDirty]);

  useEffect(() => onBusyChange?.(mutationBusy), [mutationBusy, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);

  const handleSaveSettings = async () => {
    if (saveInFlight.current || isRedeeming || resetStory.isPending) return;
    saveInFlight.current = true;
    setIsSaving(true);
    setSaveFeedback({ text: 'Saving settings…', error: false });
    try {
      if (preview) {
        await queryClient.cancelQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
        queryClient.setQueryData<PlayerBootstrap>(getGetPlayerBootstrapQueryKey(), current =>
          ({
            ...(current ?? bootstrap),
            profile: {
              ...(current ?? bootstrap).profile,
              settings: { ...(current ?? bootstrap).profile.settings, reducedMotion, turnTimerEnabled },
            },
          }));
        setPreferencesDirty(false);
        setSaveFeedback({ text: 'Saved for this preview session only.', error: false });
        return;
      }
      const response = await updateProfile.mutateAsync({
        data: { reducedMotion, turnTimerEnabled },
      });
      await queryClient.cancelQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
      queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), response);
      confirmedPreferences.current = {
        reducedMotion: response.profile.settings.reducedMotion,
        turnTimerEnabled: response.profile.settings.turnTimerEnabled,
      };
      setReducedMotion(response.profile.settings.reducedMotion);
      setTurnTimerEnabled(response.profile.settings.turnTimerEnabled);
      setPreferencesDirty(false);
      setSaveFeedback({ text: 'Settings saved.', error: false });
    } catch (error) {
      setSaveFeedback({
        text: apiMessage(error, 'Could not save settings. Check your connection and try again.'),
        error: true,
      });
    } finally {
      saveInFlight.current = false;
      setIsSaving(false);
    }
  };

  const handleRedeem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = promoCode.trim();
    if (preview || redeemInFlight.current || isSaving || resetStory.isPending || !code) return;
    redeemInFlight.current = true;
    setIsRedeeming(true);
    setPromoFeedback(null);
    const before = queryClient.getQueryData<PlayerBootstrap>(getGetPlayerBootstrapQueryKey()) ?? bootstrap;
    try {
      const result = await redeemPromo.mutateAsync({ data: { code } });
      await queryClient.cancelQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
      queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), result.bootstrap);
      if (!result.alreadyRedeemed) {
        revealProfileRewards(before, result.bootstrap, `promo:${result.receipt.code}`, 'Promo rewards');
      }
      const { receipt } = result;
      const names = receipt.cardIds?.map(id => catalogCardById[id]?.name ?? id).join(' and ');
      const cards = receipt.cardIds?.length && receipt.cardIds.length > 2
        ? `${receipt.cardIds.length} characters` : names;
      const credited = [
        cards ? `${cards} added to your collection` : null,
        receipt.packTickets ? `+${receipt.packTickets.toLocaleString()} pack tickets` : null,
        receipt.softCurrency ? `+${receipt.softCurrency.toLocaleString()} Clout` : null,
        receipt.styleShards ? `+${receipt.styleShards.toLocaleString()} Style Shards` : null,
      ].filter(Boolean).join(' · ');
      setPromoFeedback({
        error: false,
        success: true,
        text: result.alreadyRedeemed
          ? `${receipt.code} was already redeemed. Your cards and balances are up to date.`
          : `${receipt.code} redeemed!${credited ? ` ${credited}.` : ''}`,
      });
      setPromoCode('');
    } catch (error) {
      setPromoFeedback({
        error: true,
        text: apiMessage(error, 'Could not confirm redemption. Try the same code again; rewards can only be claimed once.'),
      });
    } finally {
      redeemInFlight.current = false;
      setIsRedeeming(false);
    }
  };

  const handleReset = async () => {
    if (mutationBusy) return;
    setResetFeedback(null);
    try {
      const response = await resetStory.mutateAsync({ data: { selectNodeId: resetNode.trim() || null } });
      queryClient.setQueryData(getGetPlayerStoryQueryKey(), response);
      await queryClient.invalidateQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
      setResetFeedback({ text: 'Story progression reset.', error: false });
      setResetNode('');
    } catch (error) {
      setResetFeedback({ text: apiMessage(error, 'Failed to reset story progression.'), error: true });
    }
  };

  return (
    <div className="profile-settings" aria-busy={mutationBusy}>
      <h1 className="panel-title">Settings</h1>
      <section className="panel-section settings-sound">
        <h2 className="panel-section-title">Sound</h2>
        <div className="bg-black p-4 text-white flex items-center justify-between border-2 border-white/20">
          <div><div className="font-bold text-sm">Your soundtrack</div><div className="text-xs opacity-60">Oakland Chrome and Curls · Original music by Treblo</div></div>
          <MusicControls />
        </div>
      </section>

      <section className="panel-section">
        <h2 className="panel-section-title">Gameplay &amp; Accessibility</h2>
        <label className="flex items-center justify-between bg-white/50 p-4 border border-black/10 mb-2 cursor-pointer hover:bg-white/70">
          <span><span className="block font-display font-bold uppercase">Reduced Motion</span><span className="block text-xs font-mono opacity-70">Disable cinematic screen shakes &amp; animations</span></span>
          <input type="checkbox" checked={reducedMotion} disabled={mutationBusy} onChange={event => { setReducedMotion(event.target.checked); setPreferencesDirty(true); setSaveFeedback(null); }} className="paper-checkbox" />
        </label>
        <label className="flex items-center justify-between bg-white/50 p-4 border border-black/10 mb-4 cursor-pointer hover:bg-white/70">
          <span><span className="block font-display font-bold uppercase">Turn Timer</span><span className="block text-xs font-mono opacity-70">Keep the 20-second move clock on screen</span></span>
          <input type="checkbox" checked={turnTimerEnabled} disabled={mutationBusy} onChange={event => { setTurnTimerEnabled(event.target.checked); setPreferencesDirty(true); setSaveFeedback(null); }} className="paper-checkbox" />
        </label>
        {preview && <p className="font-mono text-xs mb-3">Preview mode: preference changes are session-only and will not be saved to an account.</p>}
        <div className="fighter-id-actions flex items-center gap-4">
          <button type="button" onClick={handleSaveSettings} disabled={mutationBusy || !preferencesDirty} className="street-sign-btn">{isSaving ? 'Saving…' : saveFeedback?.error ? 'Retry Save' : 'Save Settings'}</button>
          {saveFeedback && <span role={saveFeedback.error ? 'alert' : 'status'} className={`font-mono text-sm font-bold ${saveFeedback.error ? 'text-red-600' : 'text-green-700'}`}>{saveFeedback.text}</span>}
        </div>
      </section>

      <section className="panel-section" id="promo-code">
        <h2 className="panel-section-title">Codes &amp; Help</h2>
        <div className="bg-black/5 p-4 border border-black/10">
          <h3 className="font-display font-black uppercase text-xl mb-1">Got a code?</h3>
          <p className="text-xs font-mono opacity-70 mb-4">{preview ? 'Promo codes need a connected account. This local preview does not save rewards.' : 'Enter a promo code to add rewards to your account.'}</p>
          <form onSubmit={handleRedeem} className="flex flex-col sm:flex-row gap-2" aria-busy={isRedeeming}>
            <label htmlFor="profile-promo-code" className="sr-only">Promo code</label>
            <input id="profile-promo-code" type="text" value={promoCode} maxLength={64} autoCapitalize="characters" autoComplete="off" onChange={event => { setPromoCode(event.target.value); setPromoFeedback(null); }} placeholder="ENTER PROMO CODE" className="paper-input uppercase min-w-0 flex-1" disabled={preview || mutationBusy} />
            <button type="submit" disabled={preview || mutationBusy || !promoCode.trim()} className="street-sign-btn sm:shrink-0">{isRedeeming ? 'Redeeming…' : 'Redeem'}</button>
          </form>
          {promoFeedback && <div role={promoFeedback.error ? 'alert' : 'status'} className={`mt-3 font-mono text-sm font-bold ${promoFeedback.error ? 'text-red-600' : 'text-green-700'}`}>{promoFeedback.text}{promoFeedback.success && <div className="mt-2 flex flex-wrap gap-4"><Link href="/game/shop?view=packs" className="underline">Open packs →</Link><Link href="/game/decks" className="underline">Build your gang →</Link></div>}</div>}
          <div className="mt-6 pt-4 border-t border-black/10"><Link href="/how-to-play" className="font-mono text-sm font-bold text-[var(--color-primary)] underline bg-black px-3 py-2 inline-block">How to play / Game Rules →</Link></div>
        </div>
      </section>

      {import.meta.env.DEV && <section className="panel-section">
        <h2 className="panel-section-title text-red-600">Developer Controls</h2>
        <div className="bg-red-50 p-4 border border-red-200">
          <p className="text-xs font-mono opacity-70 mb-4">Reset story campaign progression. Production builds will not see this.</p>
          <label htmlFor="profile-reset-node" className="block text-xs font-mono font-bold mb-1">Restart story at</label>
          <div className="flex gap-2"><select id="profile-reset-node" value={resetNode} onChange={event => setResetNode(event.target.value)} disabled={mutationBusy} className="paper-input text-sm p-2 flex-1 min-w-0"><option value="">Start of Chapter One</option>{storyContent.chapters.flatMap(chapter => chapter.nodes.map(node => <option key={node.id} value={node.id}>{node.title}{node.optional ? ' (Mastery)' : ''}</option>))}</select><button type="button" onClick={handleReset} disabled={mutationBusy} className="street-sign-btn street-sign-btn--danger sm:shrink-0">{resetStory.isPending ? 'Resetting…' : 'Reset'}</button></div>
          {resetFeedback && <div role={resetFeedback.error ? 'alert' : 'status'} className={`mt-2 font-mono text-xs ${resetFeedback.error ? 'text-red-600' : 'text-green-700'}`}>{resetFeedback.text}</div>}
        </div>
      </section>}

      <section className="panel-section pt-4 border-t-2 border-dashed border-black/10">
        <h2 className="panel-section-title">Account</h2>
        <button type="button" onClick={() => signOut({ redirectUrl: basePath || '/' })} disabled={mutationBusy} className="street-sign-btn street-sign-btn--secondary border-red-600 text-red-600 w-full min-h-11 justify-center">Sign Out</button>
      </section>
    </div>
  );
}