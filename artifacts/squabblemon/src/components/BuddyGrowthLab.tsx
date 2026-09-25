import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'wouter';
import { Check, ArrowUpRight, Droplets, Leaf, Gift } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { customFetch, getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import { GROWTH_GARDEN_REWARD, GROWTH_GARDEN_SIZE, GROWTH_TASKS, LOGIN_REWARDS, type AccountRewardGrant, type AccountRewardStatus } from '@workspace/squabblemon-engine/accountRewards';
import { getAssetUrl } from '../lib/assets';
import '../styles/account-rewards.css';

const art = (name: string) => getAssetUrl(`assets/buddy-growth/${name}.webp`);
const plants = [
  [0, 0, 374, 445], [375, 0, 222, 445], [613, 0, 247, 559],
  [1084, 0, 364, 448], [0, 447, 220, 216], [236, 676, 274, 245], [0, 665, 235, 259],
];
export function BuddyPlant({ index, fresh = false }: { index: number; fresh?: boolean }) {
  const clip = useId();
  const [x, y, width, height] = plants[index % plants.length];
  return <span className={`growth-plant growth-plant--${index}${fresh ? ' is-new' : ''}`} aria-hidden="true" style={{ '--plant-ratio': `${width} / ${height}` } as CSSProperties}>
    <svg viewBox={`${x} ${y} ${width} ${height}`} focusable="false">
      <defs><clipPath id={clip}>
        {index % plants.length === 1 ? <polygon points="375,0 565,0 597,90 560,260 558,445 387,445 375,350" />
          : index % plants.length === 2 ? <polygon points="613,0 860,0 860,405 785,470 735,559 665,559 673,478 660,430 613,390" />
          : <rect x={x} y={y} width={width} height={height} />}
      </clipPath></defs>
      <image href={art('plants')} width="1448" height="1086" clipPath={`url(#${clip})`} />
    </svg>
  </span>;
}
function WateringCan({ fill, pouring }: { fill: number; pouring: boolean }) {
  return <div className="growth-can" data-pouring={pouring} style={{ '--water-fill': `${Math.round(fill * 100)}%` } as CSSProperties}>
    <div className="growth-can__vessel">
      <div className="growth-can__window"><div className="growth-can__water"><i /><i /><i /></div></div>
      <img src={art('watering-can')} width="800" height="800" alt="" draggable={false} />
    </div>
    <div className="growth-can__meter" role="progressbar" aria-label="Watering can" aria-valuenow={Math.round(fill * 100)} aria-valuemin={0} aria-valuemax={100}>
      <b>{Math.round(fill * 100)}<small>%</small></b><span>{pouring ? 'MAKE IT RAIN' : 'GROWTH WATER'}</span>
    </div>
  </div>;
}
type ClaimResult = { rewards: AccountRewardGrant[]; status: AccountRewardStatus; bootstrap: PlayerBootstrap };
type GrowthAnimation = { phase: 'filling' | 'watering' | 'growing'; before: number; after: number } | null;

export function BuddyGrowthLab({ bootstrap, open, onOpenChange }: { bootstrap: PlayerBootstrap; open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const queryKey = ['account-rewards', bootstrap.profile.id];
  const dialog = useRef<HTMLDialogElement>(null), opener = useRef<HTMLElement | null>(null);
  const lock = useRef(false), mounted = useRef(false), timers = useRef<number[]>([]);
  const attempted = useRef('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [animation, setAnimation] = useState<GrowthAnimation>(null);
  const [gardenBonus, setGardenBonus] = useState<AccountRewardGrant | null>(null);
  const [clock, setClock] = useState(Date.now());
  const reduced = bootstrap.profile.settings.reducedMotion || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const query = useQuery({ queryKey, queryFn: async () => {
    const value = await customFetch<AccountRewardStatus>('/api/player/rewards/account');
    if (!value?.growth || !Array.isArray(value.pending)) throw new Error('Growth Lab is not available yet.');
    return value;
  }, enabled: open, staleTime: 0, refetchInterval: open ? 30000 : false, retry: 1 });
  const status = query.data, growth = status?.growth;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; timers.current.forEach(clearTimeout); }; }, []);
  useEffect(() => {
    if (open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (!dialog.current?.open) dialog.current?.showModal();
      setClock(Date.now());
    } else {
      dialog.current?.close();
      opener.current?.focus({ preventScroll: true });
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => setClock(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [open]);
  useEffect(() => {
    if (open && status && clock >= Date.parse(status.nextResetAt)) void query.refetch();
  }, [clock, open, status?.nextResetAt]);
  useEffect(() => {
    if (open) void query.refetch();
  }, [open, bootstrap.missions, bootstrap.profile.level]);
  // A full can waters automatically. The server rechecks every task under the profile lock.
  useEffect(() => {
    if (open && growth?.ready && !animation && !lock.current && attempted.current !== status?.date) {
      attempted.current = status!.date;
      void water();
    }
  }, [open, growth?.ready, status?.date, animation, busy]);

  function save(result: ClaimResult) {
    queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), result.bootstrap);
    queryClient.setQueryData(queryKey, result.status);
  }
  function later(delay: number, action: () => void) {
    timers.current.push(window.setTimeout(() => { if (mounted.current) action(); }, delay));
  }
  async function claim() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const result = await customFetch<ClaimResult>('/api/player/rewards/account/claim', { method: 'POST' });
      save(result);
      if (mounted.current) {
        const clout = result.rewards.reduce((n, r) => n + r.softCurrency, 0);
        const tickets = result.rewards.reduce((n, r) => n + r.packTickets, 0);
        const shards = result.rewards.reduce((n, r) => n + r.styleShards, 0);
        setNotice(result.rewards.length ? `Collected ${clout} Clout${tickets ? ` · ${tickets} tickets` : ''}${shards ? ` · ${shards} Style Shards` : ''}. Looking good!` : 'Your check-in is already saved.');
      }
    } catch { if (mounted.current) setError('Your check-in could not be confirmed. Try again; saved rewards are never paid twice.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  async function water() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const result = await customFetch<ClaimResult>('/api/player/rewards/account/growth/water', { method: 'POST' });
      save(result);
      if (!mounted.current) return;
      const plant = result.rewards.some(r => r.key.startsWith('growth:water:'));
      const bonus = result.rewards.find(r => r.key.startsWith('growth:garden:')) ?? null;
      if (plant) {
        setGardenBonus(null);
        const after = result.status.growth.plantsInGarden;
        const before = after === 1 ? 0 : after - 1;
        setAnimation({ phase: 'filling', before, after });
        setNotice('Can full. A little water goes a long way.');
        const finish = () => { setAnimation(null); setGardenBonus(bonus); setNotice(bonus ? 'Garden complete! Your harvest reward is in your bag.' : 'One more plant, one better day. Your garden is saved.'); };
        if (reduced) finish();
        else {
          later(650, () => setAnimation({ phase: 'watering', before, after }));
          later(2950, () => { setAnimation({ phase: 'growing', before, after }); setNotice('Look at you grow. A new plant for your garden!'); });
          later(4400, finish);
        }
      } else setNotice(result.status.growth.wateredToday ? 'Your garden is already watered today.' : 'Finish all three daily tasks to fill your can.');
    } catch { if (mounted.current) setError('We could not confirm your watering. Your saved garden is safe. Tap Retry watering.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  const visiblePlants = animation ? animation.phase === 'growing' ? animation.after : animation.before : growth?.plantsInGarden ?? 0;
  const fill = animation ? animation.phase === 'filling' ? 1 : 0 : growth?.water ?? 0;
  const resetMinutes = status ? Math.max(0, Math.ceil((Date.parse(status.nextResetAt) - clock) / 60000)) : 0;
  return <dialog ref={dialog} className="growth-dialog" aria-labelledby="growth-title" onCancel={() => onOpenChange(false)} onClose={() => onOpenChange(false)} data-reduced-motion={reduced}>
    <div className="growth-lab-shell" data-phase={animation?.phase ?? 'idle'}>
        <div className="growth-garden" aria-hidden="true">{Array.from({ length: visiblePlants }, (_, index) => <BuddyPlant key={index} index={index} fresh={animation?.phase === 'growing' && index === animation.after - 1} />)}</div>
        <article className="growth-clipboard">
        <div className="growth-clipboard__clip" aria-hidden="true"><Leaf size={16} /></div>

        <button autoFocus type="button" className="growth-close" aria-label="Close Growth Lab" onClick={() => onOpenChange(false)}>
          <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
            <path d="M9 8 17 12 40 36 38 41 32 39 7 14Z" fill="currentColor" />
            <path d="M35 6 42 10 35 19 15 41 8 38 10 31 25 16Z" fill="currentColor" opacity=".9" />
            <path d="m11 11 26 27M38 10 12 36" fill="none" stroke="#ff8270" strokeWidth="1.3" opacity=".4" />
          </svg>
        </button>
        <header className="growth-heading"><span className="growth-eyebrow">THE SAFEHOUSE / DAILY RITUALS</span><h2 id="growth-title">Buddy’s <span className="growth-heading__lab"><em className="buddy-growth-word">Growth</em> Lab.</span></h2><p>Helping you get them hands holistically.</p></header>
        <div className="growth-hero">
          <img className="growth-buddy" src={art('buddy-clipboard')} alt="Buddy tending his plants with his clipboard" width="720" height="960" />
          <div className="growth-hero__note"><span className="growth-eyebrow">A LITTLE EVERY DAY</span><p>Show up.<br />Catch a fade.<br /><em>Watch it grow.</em></p><span>3 tasks → 1 plant</span></div>
          <WateringCan fill={fill} pouring={animation?.phase === 'watering'} />
        </div>
        <div className="growth-task-heading"><h3>Today’s care list</h3><span>{growth?.wateredToday ? 'WATERED WITH LOVE' : `${growth?.tasks.filter(t => t.complete).length ?? 0} / 3 DONE`}</span></div>
        {query.isPending && <p className="growth-message" role="status">Buddy’s checking on your garden…</p>}
        {query.isError && <div className="growth-message" role="alert"><p>Couldn’t load your saved garden.</p><button type="button" onClick={() => void query.refetch()}>Retry loading</button></div>}
        {status && growth && <>
          <ol className="growth-tasks">{GROWTH_TASKS.map((task, index) => {
            const current = growth.tasks.find(t => t.key === task.key);
            return <li key={task.key} data-complete={current?.complete} style={{ '--task-index': index } as CSSProperties}>
              <span className="growth-task-check" aria-hidden="true">{current?.complete ? <Check size={18} /> : `0${index + 1}`}</span>
              <div><h4>{task.title}</h4><p>{task.detail}</p></div>
              {current?.complete ? <span className="growth-task-done">Done</span> : task.key === 'login' ? <button type="button" disabled={busy || !!animation} onClick={() => void claim()}>{busy ? 'Saving…' : 'Check in'}<Droplets size={14} /></button> : <Link href="/game/play" onClick={() => onOpenChange(false)} aria-label={`${task.action}: ${task.detail}`}><span>Play</span><ArrowUpRight size={17} /></Link>}
            </li>;
          })}
          </ol>
          <section className="growth-harvest" aria-label="Clipboard garden progress">
            <div><span className="growth-eyebrow">GARDEN {growth.gardenNumber.toString().padStart(2, '0')}</span><strong>{visiblePlants} <small>/ {GROWTH_GARDEN_SIZE} plants</small></strong></div>
            <div className="growth-harvest__detail"><div className="growth-seeds" aria-label={`${visiblePlants} of ${GROWTH_GARDEN_SIZE} plants grown`}>{Array.from({ length: GROWTH_GARDEN_SIZE }, (_, i) => <Leaf key={i} size={20} data-grown={i < visiblePlants} />)}</div><p>Fill the garden. Collect the harvest.</p></div>
            <div className="growth-harvest__prize"><Gift size={19} /><span><b>{GROWTH_GARDEN_REWARD.softCurrency} Clout</b><small>+ 1 ticket · 25 Style Shards</small></span></div>
          </section>
          {!animation && (gardenBonus || (growth.plantsInGarden === GROWTH_GARDEN_SIZE && growth.completedGardens > 0)) && <div className="growth-bonus" role="status"><Leaf size={22} /><div><b>Garden complete. You earned this.</b><span>+350 Clout · +1 ticket · +25 Style Shards — saved to your bag.</span></div></div>}
          <details className="growth-checkins"><summary>Daily check-in rewards <span>Day {status.streak}<ArrowUpRight size={13} /></span></summary>
            <ol>{LOGIN_REWARDS.map((reward, i) => <li key={i} data-current={(status.streak - 1) % 7 === i}><span>Day {i + 1}</span><b>{reward.softCurrency}</b><small>Clout{reward.packTickets ? ' + 2 tickets' : ''}</small></li>)}</ol>
            {status.pending.filter(r => !r.key.startsWith('login:')).map(r => <p key={r.key}>{r.title}: {r.softCurrency} Clout{r.packTickets ? ` · ${r.packTickets} tickets` : ''}{r.styleShards ? ` · ${r.styleShards} Style Shards` : ''}</p>)}
            {status.claimedToday && status.pending.length > 0 && <button type="button" disabled={busy} onClick={() => void claim()}>Collect account bonuses</button>}
            <p>Every seventh consecutive check-in pays extra. Earned garden plants stay with you, even if you miss a day.</p>
          </details>
          <footer className="growth-footer"><span><Leaf size={12} /> {growth.wateredToday ? 'Your garden is watered. See you tomorrow.' : 'A full can waters every task and grows a plant.'}</span><span>Resets in {Math.floor(resetMinutes / 60)}h {resetMinutes % 60}m · UTC</span></footer>
        </>}
        <p className="growth-live" role="status" aria-live="polite">{notice}</p>
        {error && <div className="growth-error" role="alert"><p>{error}</p><button type="button" disabled={busy} onClick={() => growth?.ready ? void water() : void claim()}>{growth?.ready ? 'Retry watering' : 'Retry check-in'}</button></div>}
        <div className="growth-rain" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ '--drop': i } as CSSProperties} />)}</div>
      </article>
    </div>
  </dialog>;
}
