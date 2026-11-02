import { ArrowLeft, ArrowUpRight, HandFist, LockKeyhole } from 'lucide-react';
import { GameGlyph } from '../venue/GameGlyph';
import { useEffect, useRef, useState } from 'react';
import type { DojoSpritePhase } from './DojoMotionSprite';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { customFetch, getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import { type AnunakiRaid, type AnunakiRaidAction, type AnunakiRaidDifficulty } from '@workspace/squabblemon-engine/anunakiRaid';
import { BossRaidView } from './BossRaidView';
import { makeAnunakiRaidViewAdapter } from './anunakiRaidPresentation';
import { CompactDeckPicker } from '../CompactDeckPicker';
import { getAssetUrl } from '../../lib/assets';
import type { Deck } from '../../data';
import '../../styles/anunaki-raid.css';

type Status = { eligibility: Record<AnunakiRaidDifficulty, boolean>; run: AnunakiRaid | null };
const endpoint = '/api/player/anunaki-raid';
export function AnunakiRaidGame({ bootstrap, crews, onBack, onExit }: { bootstrap: PlayerBootstrap; crews: Deck[]; onBack: () => void; onExit: () => void }) {
  const client = useQueryClient(), key = ['anunaki-raid', bootstrap.profile.id];
  const query = useQuery({ queryKey: key, queryFn: () => customFetch<Status>(endpoint), refetchOnWindowFocus: false });
  const [difficulty, setDifficulty] = useState<AnunakiRaidDifficulty>('training'), [deck, setDeck] = useState(''), [loaner, setLoaner] = useState(true);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [cue, setCue] = useState<DojoSpritePhase>('idle');
  const cueTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cueMounted = useRef(true);
  const clearCue = () => { cueTimers.current.forEach(clearTimeout); cueTimers.current = []; };
  useEffect(() => {
    cueMounted.current = true;
    return () => { cueMounted.current = false; cueTimers.current.forEach(clearTimeout); };
  }, []);
  const [pending, setPending] = useState<{ path: string; body: unknown } | null>(null);
  const send = async (path: string, body: unknown) => { if (busy) return;
    const blasting = !!body && typeof body === 'object' && 'action' in body && (body.action as AnunakiRaidAction)?.type === 'blast';
    clearCue(); setCue(blasting ? 'windup' : 'idle');
    setBusy(true); setError(''); setPending({ path, body }); try {
    const next = await customFetch<Status>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    client.setQueryData(key, next); setPending(null);
    if (blasting && cueMounted.current) {
      setCue('strike');
      const landed = !!next.run?.lastBlast?.damage;
      cueTimers.current = [
        setTimeout(() => setCue(landed ? 'recoil' : 'idle'), 720),
        setTimeout(() => setCue('idle'), 1770),
      ];
    }
    void client.invalidateQueries({ queryKey: getGetPlayerBootstrapQueryKey() });
  } catch (e) { clearCue(); setCue('idle'); setError(e instanceof Error ? e.message : 'Connection lost. Retry safely.'); } finally { setBusy(false); } };
  const run = query.data?.run, crew = crews.find(c => c.id === deck) ?? crews[0];
  const act = (action: AnunakiRaidAction) => { if (run) void send(`${endpoint}/${run.id}/action`, { revision: run.revision, actionId: crypto.randomUUID(), action }); };
  if (query.isPending || query.isError || !query.data) return <main className="anu-raid anu-raid-loading"><button onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Other raids</button><h1>{query.isError ? 'CONNECTION LOST' : 'OPENING THE GATE'}</h1>{query.isError && <button className="anu-raid-primary" onClick={() => void query.refetch()}>RETRY</button>}</main>;
  if (!run || run.status !== 'active') return <main className="anu-raid anu-raid-entry" style={{ backgroundImage: `linear-gradient(90deg,#031b1ce8,#031b1c80),url('${getAssetUrl('assets/anunaki-future/concepts/boss-raid-key-art.webp')}')` }}>
    <nav><button onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Other raids</button><button onClick={onExit}>Fadecade <ArrowUpRight size={16} aria-hidden="true" /></button></nav>
    <div className="anu-raid-intro">
      <header className="anu-entry-heading">
        <div><small>THE ANUNAKI ARRIVAL · SOLO RAID</small><h1>ANU<span>FIRST<br/>ARRIVAL</span></h1><p>Break the gate. Interrupt the charge.</p></div>
        <img src={getAssetUrl('assets/anunaki-event/anu.webp')} alt="Anu guards the arrival gate" width={375} height={666} />
      </header>
      <section className="anu-entry-loadout" aria-label="Prepare your raid">
        {bootstrap.profile.unlockedCosmeticIds?.includes('anunaki-raid:title') && <p className="anu-champion-mark"><HandFist size={18} aria-hidden="true" /> FIRST ARRIVAL CHAMPION</p>}
        {run && <section className="anu-raid-receipt" aria-label="Saved raid result" role="status">
          <strong>{run.status === 'won' ? 'ANU DEFEATED' : `RAID ${run.status.toUpperCase()}`}</strong>
          <p>{run.maxHp - run.hp} DAMAGE · {run.difficulty.toUpperCase()}</p>
          {run.reward && <><div className="anu-reward-tokens" aria-label="Saved rewards"><span><GameGlyph name="ticket" />{run.reward.packTickets} tickets</span><span><GameGlyph name="clout" />{run.reward.softCurrency} Clout</span><span><GameGlyph name="shards" />{run.reward.styleShards} shards</span></div>{!run.reward.weekly && <p>Weekly reward already claimed.</p>}{run.reward.firstClear && <p>{run.difficulty === 'standard' ? 'First Arrival cover + champion title unlocked.' : 'Heaven Comes Down mat + Anu Raid Respect reaction unlocked.'}</p>}</>}
        </section>}
        <div className="anu-raid-difficulties" role="group" aria-label="Raid difficulty">{(['training','standard','ascended'] as const).map(item => <button key={item} aria-pressed={difficulty === item} onClick={() => { setDifficulty(item); setLoaner(item === 'training'); }}>{!query.data!.eligibility[item] && <LockKeyhole size={14} aria-hidden="true" />}{item.toUpperCase()}</button>)}</div>
        {!query.data.eligibility[difficulty] && <p className="anu-unlock-note"><LockKeyhole size={14} aria-hidden="true" />{difficulty === 'training' ? 'Finish chapter 7 to unlock.' : difficulty === 'standard' ? 'Finish chapter 8 to unlock.' : 'Defeat Standard to unlock.'}</p>}
        {difficulty === 'training' && <div className="anu-crew-toggle" role="group" aria-label="Training crew"><button aria-pressed={loaner} onClick={()=>setLoaner(true)}>LOANER CREW</button><button aria-pressed={!loaner} onClick={()=>setLoaner(false)}>MY CREW</button><small>PRACTICE · NO REWARDS</small></div>}
        {!loaner && <CompactDeckPicker decks={crews.map(c => ({id:c.id,name:c.name,heroCardId:c.hero,cardIds:c.cards}))} selectedId={crew?.id ?? ''} onSelect={setDeck} label="Raid crew"/>}
        {!loaner && !crew && <p className="anu-unlock-note">Save a ten-card crew to enter.</p>}
        <button className="anu-raid-primary" disabled={busy || !query.data.eligibility[difficulty] || (!loaner && !crew)} onClick={() => void send(`${endpoint}/start`, { requestId: crypto.randomUUID(), difficulty, cardIds: loaner && difficulty === 'training' ? [] : crew.cards })}>{busy ? 'ENTERING…' : 'ENTER THE RAID →'}</button>
        <details className="anu-entry-rules"><summary>RAID RULES &amp; REWARDS</summary><p>Six rounds. Your surviving Hands strike Anu at ×2; protection halves the damage. Interrupt his final charge before its third round.</p><p>{difficulty === 'training' ? 'Training uses your crew or a loaner. No rewards.' : difficulty === 'standard' ? 'First win: First Arrival cover, champion title and 2 tickets. Weekly win: 1 ticket, 300 Clout and 30 shards.' : 'First win: Heaven Comes Down mat, Anu Raid Respect reaction and 2 tickets. Weekly win: 1 ticket, 300 Clout and 30 shards.'}</p></details>
        {error && <div className="anu-entry-error" role="alert"><p>{error}</p><button onClick={() => pending && void send(pending.path,pending.body)}>RETRY</button><button onClick={() => { setPending(null);setError('');void query.refetch(); }}>SYNC</button></div>}
      </section>
    </div></main>;
  return <BossRaidView adapter={makeAnunakiRaidViewAdapter(run, { phase: cue })} busy={busy} onAction={act}
    onExit={onBack} exitLabel="← Other raids" error={error}
    onRetry={() => pending && void send(pending.path, pending.body)}
    onSync={() => { setPending(null); setError(''); void query.refetch(); }}
    reducedMotion={bootstrap.profile.settings.reducedMotion}/>;
}
