import { Link } from 'wouter';
import { STARTER_MYTHIC, type StarterMythicStatus } from '@workspace/squabblemon-engine/starterMythic';
import { getAssetUrl } from '../lib/assets';
import { GameGlyph } from './venue/GameGlyph';

type Props = {
  placement: 'shortcut' | 'banner';
  status: StarterMythicStatus | undefined;
  isPending: boolean;
  isError: boolean;
  retry: () => void;
  receipt: { claimed: boolean; duplicateShards: number } | null;
  error: string;
  busy: boolean;
  claim: () => void;
  close: () => void;
};
const art = (name: string) => getAssetUrl(`assets/starter-mythic/${name}.webp`);
export function StarterMythicDialogContent({ placement, status, isPending, isError, retry, receipt, error, busy, claim, close }: Props) {
  const ready = status?.state === 'ready', claimed = status?.state === 'claimed';
  const progress = status?.chapters.filter(chapter => chapter.reached).length ?? 0;
  return <>
      <div className="starter-mythic-art"><img src={art('chibi')} alt="Homeless Guy seated on his milk-crate throne" /><span>MYTHICAL · HOMELESS GUY</span></div>
      <div className="starter-mythic-content">
        <div className="mythic-road-label">ROAD TO MYTHIC <span>{progress} / 5 CHAPTERS</span></div>
        <span className="starter-mythic-eyebrow">{claimed ? 'HE’S WITH YOU NOW' : 'A LEGEND HIDING IN PLAIN SIGHT'}</span>
        <h2 id={`mythic-title-${placement}`}>Nothing{' '}<br />to Lose<span>.</span></h2>
        <p>Everybody walked past him. You’re about to build a whole team around him.</p>
        <p className="starter-mythic-rule">Reach <b>Season 1, Chapter 5</b>. Homeless Guy joins your crew. No timer. No login streak.</p>
        {isPending ? <p role="status">Checking your story progress…</p> : isError ? <div role="alert"><p>Could not load your reward.</p><button type="button" onClick={retry}>Try again</button></div> : <>
          <div className="mythic-road-meter" role="progressbar" aria-label="Chapters reached" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={5}><i style={{ width: `${progress * 20}%` }} /></div>
          <ol className="starter-mythic-chapters" aria-label="Chapters reached">
            {status?.chapters.map((chapter, i) => <li key={chapter.id} data-reached={chapter.reached} aria-label={`Chapter ${i + 1}: ${chapter.completed ? 'completed' : chapter.reached ? 'reached' : 'locked'}`}><span>{chapter.completed ? '✓' : i + 1}</span><small>CH. {i + 1}</small></li>)}
          </ol>
          <div className="starter-mythic-rewards">
            <div><img src={art('chibi')} alt="" /><b>{status?.ownsCard && !claimed ? `${STARTER_MYTHIC.duplicateShards} Shards` : 'Homeless Guy'}</b><small>{status?.ownsCard && !claimed ? 'Already in your crew' : 'Mythical character'}</small></div>
            <div><GameGlyph name="cloutStack" /><b>1,000</b><small>Clout</small></div>
            <div><GameGlyph name="ticket" /><b>3</b><small>Pack tickets</small></div>
          </div>
          {receipt && <p role="status" className="starter-mythic-success">{receipt.claimed ? receipt.duplicateShards ? `Collected: 1,000 Clout, 3 tickets, and ${receipt.duplicateShards} Style Shards for your duplicate.` : 'Homeless Guy joined your crew. 1,000 Clout and 3 tickets are in your bag.' : 'Already collected. Your saved reward is safe.'}</p>}
          {error && <p role="alert">{error}</p>}
          {claimed ? <Link className="starter-mythic-cta" href="/game/collection" onClick={close}>Meet your crew →</Link> : ready ? <button type="button" className="starter-mythic-cta" disabled={busy} onClick={() => void claim()}>{busy ? 'Saving your reward…' : 'Claim your Mythic →'}</button> : <Link className="starter-mythic-cta" href="/game/story" onClick={close}>Continue story →</Link>}
          <small className="starter-mythic-footnote">{claimed ? 'Collected once. Yours for good.' : 'Free once per account. Unlock Chapter 5 by finishing Chapter 4.'}</small>
        </>}
      </div>
  </>;
}
