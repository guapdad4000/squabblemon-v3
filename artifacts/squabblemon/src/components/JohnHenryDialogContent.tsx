import { Link } from 'wouter';
import type { JohnHenryMythicStatus } from '@workspace/squabblemon-engine/johnHenryMythic';
import { getAssetUrl } from '../lib/assets';
import { GameGlyph } from './venue/GameGlyph';

type Props = {
  placement: 'shortcut' | 'banner';
  status: JohnHenryMythicStatus | undefined;
  isPending: boolean;
  isError: boolean;
  retry: () => void;
  receipt: string;
  error: string;
  busy: boolean;
  claim: () => void;
  close: () => void;
};
const chapterNames = [
  "The Block",
  "Red Side",
  "Blue Side",
  "Side Show",
  "Old Heads",
  "The Function",
  "Return",
  "The Crown",
];
export function JohnHenryDialogContent({ placement, status, isPending, isError, retry, receipt, error, busy, claim, close }: Props) {
  const art = getAssetUrl('assets/john-henry-mythic/roadmap.webp');
  const claimed = status?.state === 'claimed', ready = status?.state === 'ready';
  const completed = status?.chapters.filter(chapter => chapter.completed).length ?? 0;
  return <>
        <img
          className="john-henry-roadmap__art"
          src={art}
          alt="John Henry drives steel through the last stretch of an illuminated railroad"
        />
        <div className="john-henry-roadmap__copy">
          <span className="john-henry-roadmap__label">ROAD TO MYTHIC / 02</span>
          <span className="john-henry-roadmap__tag">
            EARTH · JOHN HENRY · MYTHICAL
          </span>
          <h2 id={`john-henry-title-${placement}`}>
            Steel
            <br />
            <em>Driver.</em>
          </h2>
          <p>
            Every block. Every battle.
            <br />
            Legends finish what they start.
          </p>
          <span className="john-henry-roadmap__rule">
            Clear all eight Season 1 chapters.
            <br />
            No timer. No login streak.
          </span>
        </div>
        <div className="john-henry-roadmap__ticket">
          <header>
            <strong>THE LAST STRETCH</strong>
            <span>{completed} / 8 CLEARED</span>
          </header>
          {isPending ? (
            <p role="status">Checking your campaign…</p>
          ) : isError ? (
            <p role="alert">
              Could not load your roadmap.{" "}
              <button onClick={retry}>Retry</button>
            </p>
          ) : (
            <>
              <ol
                className="john-henry-roadmap__track"
                aria-label="Season 1 chapter roadmap"
              >
                {status?.chapters.map((c, i) => (
                  <li
                    key={c.id}
                    data-complete={c.completed}
                    data-reached={c.reached}
                    aria-label={`Chapter ${i + 1}: ${c.completed ? "cleared" : c.reached ? "available" : "locked"}`}
                  >
                    <b>{c.completed ? "✓" : String(i + 1).padStart(2, "0")}</b>
                    <small>{chapterNames[i]}</small>
                  </li>
                ))}
              </ol>
              <div className="john-henry-roadmap__rewards">
                <div>
                  <img
                    src={getAssetUrl("assets/characters/john-henry.webp")}
                    alt=""
                  />
                  <span>
                    <strong>
                      {status?.ownsCard && !claimed
                        ? "50 Style Shards"
                        : "John Henry"}
                    </strong>
                    <small>
                      {status?.ownsCard && !claimed
                        ? "Duplicate protection"
                        : "Mythical fighter"}
                    </small>
                  </span>
                </div>
                <div>
                  <GameGlyph name="cloutStack" />
                  <span>
                    <strong>1,500</strong>
                    <small>Clout</small>
                  </span>
                </div>
                <div>
                  <GameGlyph name="ticket" />
                  <span>
                    <strong>5</strong>
                    <small>Tickets</small>
                  </span>
                </div>
              </div>
              {receipt && (
                <p role="status" className="john-henry-roadmap__success">
                  {receipt}
                </p>
              )}
              {error && <p role="alert">{error}</p>}
              {claimed ? (
                <Link
                  className="john-henry-roadmap__cta"
                  href="/game/collection?card=john-henry"
                  onClick={close}
                >
                  Meet John Henry →
                </Link>
              ) : ready ? (
                <button
                  className="john-henry-roadmap__cta"
                  disabled={busy}
                  onClick={() => void claim()}
                >
                  {busy ? "Saving your Mythical…" : "Claim John Henry →"}
                </button>
              ) : (
                <Link
                  className="john-henry-roadmap__cta"
                  href="/game/story"
                  onClick={close}
                >
                  Keep building your legend →
                </Link>
              )}
              <small className="john-henry-roadmap__footnote">
                Permanent. Free once per account. Rewards are saved together.
              </small>
            </>
          )}
        </div>
  </>;
}
