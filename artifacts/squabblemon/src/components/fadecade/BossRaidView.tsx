import * as Dialog from "@radix-ui/react-dialog";
import {
  useState,
  useEffect,
  useRef,
  useMemo,
  type CSSProperties,
} from "react";
import {
  applyBossAction,
  BOSS_NPCS,
  BOSS_FORMS,
  bossForm,
  BOSS_ROUNDS,
  bossBlastPreview,
  bossCardCost,
  type BossAction,
  type BossStatus,
  type BossBlast,
  type BossNpcId,
  type BossTier,
} from "@workspace/squabblemon-engine/bossRaid";
import {
  getEffectiveCardPower,
  getMatchWinner,
  type Lane,
  type CardInstance,
} from "../../gameEngine";
import { CardView } from "../CardView";
import { CardInspector } from "../CardInspector";
import { getAssetUrl } from "../../lib/assets";
import {
  POLICE_ENTRANCE_MS,
  policeRevealDuration,
} from "./bossRaidPresentation";
import { BossRaidRoundBlast } from "./BossRaidRoundBlast";
import { BossRaidTargetLine } from "./BossRaidTargetLine";
import { BossIdleSprite } from "./BossIdleSprite";
import "../../styles/boss-raid.css";
import "../../styles/boss-raid-design.css";
export const bossArt = (name: string) =>
  getAssetUrl(`assets/boss-raid/${name}.webp`);
export function BossRaidView({
  status,
  busy = false,
  blast = null,
  onAction,
  onExit,
  error = "",
  onRetry,
  onSync,
  reducedMotion = false,
}: {
  status: BossStatus;
  busy?: boolean;
  blast?: BossBlast | null;
  onAction: (action: BossAction) => void;
  onExit: () => void;
  error?: string;
  onRetry?: () => void;
  onSync?: () => void;
  reducedMotion?: boolean;
}) {
  const run = status.run!,
    form = bossForm(run.bossTier),
    campaign = status.campaign;
  const [resultsDismissed, setResultsDismissed] = useState(false);
  const arenaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const arena = arenaRef.current;
    const dock = arena?.querySelector<HTMLElement>(".raid-hand-dock");
    if (!arena || !dock) return;
    const measure = () =>
      arena.style.setProperty(
        "--raid-hand-height",
        `${dock.getBoundingClientRect().height}px`,
      );
    const observer = new ResizeObserver(measure);
    observer.observe(dock);
    measure();
    return () => observer.disconnect();
  }, []);
  const [selectedLane, setSelectedLane] = useState<Lane | null>(null);
  const [selected, setSelected] = useState<string | null>(null),
    [squabble, setSquabble] = useState(false),
    [investment, setInvestment] = useState(0),
    [intel, setIntel] = useState<CardInstance | null>(null),
    [help, setHelp] = useState(false),
    [retire, setRetire] = useState(false),
    [forms, setForms] = useState(false);
  const [revealStep, setRevealStep] = useState({
    round: 0,
    index: 0,
    done: false,
  });
  const policeRevealing =
    !!blast && !(revealStep.round === blast.round && revealStep.done);
  const step = blast && revealStep.round === blast.round ? revealStep.index : 0;
  const shownMatch = blast
    ? {
        ...run.match,
        round: blast.round,
        boards: policeRevealing
          ? step
            ? blast.policePlays[step - 1].boards
            : blast.boardsBeforePolice
          : blast.boards,
      }
    : run.match;
  useEffect(() => {
    if (!blast) return;
    const timers = blast.policePlays.map((_, i) =>
      setTimeout(
        () => setRevealStep({ round: blast.round, index: i + 1, done: false }),
        150 + i * POLICE_ENTRANCE_MS,
      ),
    );
    timers.push(
      setTimeout(
        () =>
          setRevealStep({
            round: blast.round,
            index: blast.policePlays.length,
            done: true,
          }),
        policeRevealDuration(blast.policePlays.length),
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [blast]);
  const entrance =
    policeRevealing && step > 0 ? blast?.policePlays[step - 1] : null;
  const entranceCard = entrance?.boards[entrance.lane].find(
    (c) => c.instanceId === entrance.instanceId,
  );
  const entranceNpc = entranceCard
    ? BOSS_NPCS[entranceCard.cardId as BossNpcId]
    : null;
  const displayedHp = blast && policeRevealing ? blast.hpBefore : run.hp;
  const displayedDamage =
    blast && policeRevealing ? run.score - blast.total : run.score;
  const trigger = useRef<HTMLElement | null>(null),
    card = run.match.playerHand.find((c) => c.instanceId === selected),
    locked = busy || !!blast || run.phase !== "active" || !!error,
    modal = !!intel || help || retire || forms;
  const resultsOpen =
    run.phase !== "active" && !blast && !resultsDismissed && !modal;
  const preview = useMemo(
    () => bossBlastPreview(shownMatch, run.bossTier),
    [run, blast, revealStep],
  );
  const targets = useMemo(
    () =>
      ([0, 1, 2] as const).map((lane) => {
        if (!card) return false;
        try {
          applyBossAction(run, {
            type: "play",
            instanceId: card.instanceId,
            lane,
            squabble,
            investment,
          });
          return true;
        } catch {
          return false;
        }
      }),
    [run, card, squabble, investment],
  );
  useEffect(() => {
    if (selected && !card) {
      setSelected(null);
      setSelectedLane(null);
      setSquabble(false);
      setInvestment(0);
    }
  }, [card, selected]);
  const open = (
    event: React.MouseEvent<HTMLButtonElement>,
    action: () => void,
  ) => {
    trigger.current = event.currentTarget;
    action();
  };
  const close = () => {
    setIntel(null);
    setHelp(false);
    setRetire(false);
    setForms(false);
  };
  return (
    <main
      className="boss-raid raid-v2 raid-v3"
      data-testid="boss-raid-stage"
      data-round={shownMatch.round}
      data-tier={run.bossTier}
      data-reduced-motion={reducedMotion}
      style={
        {
          "--raid-bg": `url("${getAssetUrl("assets/boss-raid/precinct-arena-v3.webp")}")`,
        } as CSSProperties
      }
    >
      <header className="raid-top">
        <button onClick={onExit}>← Fadecade</button>
        <div
          className="raid-round-pips"
          aria-label={`Round ${shownMatch.round} of ${BOSS_ROUNDS}`}
        >
          <span className="raid-round-number">
            ROUND <b>{String(shownMatch.round).padStart(2, "0")}</b>
            <small>/06</small>
          </span>
          {Array.from({ length: 6 }, (_, i) => (
            <i key={i} data-lit={i < shownMatch.round} />
          ))}
        </div>
        <button onClick={(e) => open(e, () => setHelp(true))}>
          How to fight ⓘ
        </button>
      </header>
      <div className="raid-arena" ref={arenaRef}>
        {card && selectedLane !== null && targets[selectedLane] && (
          <BossRaidTargetLine
            instanceId={card.instanceId}
            lane={selectedLane}
          />
        )}
        <section
          className="raid-boss"
          data-hit={!!blast?.total && !policeRevealing}
          data-defeated={run.hp === 0}
        >
          <span className="raid-tier-stamp" aria-hidden="true">
            0{run.bossTier}
          </span>
          <div className="raid-boss-title">
            <button onClick={(e) => open(e, () => setForms(true))}>
              TIER {run.bossTier} / 5 · {form.name}
            </button>
            <h1>OFFICER OINK</h1>
          </div>
          <div
            className="raid-boss-counter raid-damage-counter"
            aria-label={`Today's damage: ${displayedDamage}`}
          >
            <b>−{displayedDamage}</b>
            <small>DAMAGE</small>
          </div>
          <div
            className="raid-boss-counter raid-deck-counter"
            aria-label={`Police deck: ${Math.max(0, run.match.cpuCardIds.length - run.match.cpuDrawIndex)} cards remaining, ${run.match.cpuHand.length} in hand`}
          >
            <b>
              {Math.max(
                0,
                run.match.cpuCardIds.length - run.match.cpuDrawIndex,
              )}
            </b>
            <img
              src={getAssetUrl("assets/boss-raid/precinct-cardback.svg")}
              alt=""
            />
            <small>TO DRAW</small>
          </div>
          <div className="raid-boss-world">
            <span className="raid-siren left" />
            <span className="raid-siren right" />
            <button
              className="raid-boss-inspect"
              onClick={(e) => open(e, () => setForms(true))}
              aria-label="Inspect Officer Oink tiers"
            >
              <BossIdleSprite
                asset={form.art}
                name={`Officer Oink, ${form.name}`}
                paused={modal || resultsOpen || run.hp === 0}
                reduced={reducedMotion}
              />
            </button>
          </div>
          <div
            className="raid-hp-wrap"
            data-animated={!modal && !resultsOpen && !reducedMotion}
          >
            <div
              className="raid-hp"
              role="progressbar"
              aria-label="Persistent boss HP"
              aria-valuemin={0}
              aria-valuemax={run.maxHp}
              aria-valuenow={displayedHp}
            >
              <span
                className="raid-hp-trail"
                aria-hidden="true"
                style={{ width: `${(displayedHp / run.maxHp) * 100}%` }}
              />
              <span
                className="raid-hp-live"
                aria-hidden="true"
                style={{ width: `${(displayedHp / run.maxHp) * 100}%` }}
              >
                <i className="raid-hp-glint" />
                <i className="raid-hp-edge" />
              </span>
            </div>
            <div className="raid-scoreline">
              <b>
                {displayedHp}
                <small> / {run.maxHp} HP</small>
              </b>
            </div>
          </div>
        </section>
        <div className="raid-directive" aria-live="polite">
          {error ? (
            <div role="alert">
              {error} <button onClick={onRetry}>Retry save</button>
              <button onClick={onSync}>Sync</button>
            </div>
          ) : blast ? (
            <strong>
              {policeRevealing
                ? `POLICE TURN · ${step ? blast.policePlays[step - 1].name : blast.policePlays.length ? "DEPLOYING…" : "PASSED"}`
                : `ROUND ${blast.round} · ${blast.winners.filter((w) => w === "player").length} LANES WON · ${blast.total ? `−${blast.total} HP` : "BLOCKED"}`}
            </strong>
          ) : run.phase !== "active" ? (
            <strong>
              {run.hp === 0
                ? "TIER DOWN."
                : run.phase === "retired"
                  ? "ATTACK ENDED. DAMAGE SAVED."
                  : `${getMatchWinner(run.match) === "player" ? "MATCH WON" : getMatchWinner(run.match) === "cpu" ? "POLICE WON" : "MATCH DRAWN"}.`}
            </strong>
          ) : (
            <>
              <strong>{card ? `PLAY ${card.name}` : "YOUR TURN"}</strong>
              <span>
                {card
                  ? selectedLane === null
                    ? "Choose a highlighted lane below."
                    : `Deploy to ${["Checkpoint", "Barricade", "Lockup"][selectedLane]}.`
                  : "Beat the police lanes. Round results attack Oink."}
              </span>
            </>
          )}
        </div>
        {entrance && entranceCard && (
          <aside
            className="raid-entrance-banner"
            key={`${blast?.round}-${entrance.instanceId}`}
            aria-live="polite"
            data-testid="police-entrance-banner"
            data-instance={entrance.instanceId}
          >
            <div className="raid-entrance-art">
              {entranceNpc ? (
                <BossIdleSprite
                  asset={
                    entranceCard.cardId === "raid-oink"
                      ? form.art
                      : entranceNpc.art
                  }
                  name={entrance.name}
                  reduced={reducedMotion}
                  paused={modal}
                />
              ) : (
                <CardView
                  card={entranceCard}
                  presentationOnly
                  disableLayout
                  fillContainer
                />
              )}
            </div>
            <div className="raid-entrance-copy">
              <small>
                POLICE DEPLOY ·{" "}
                {["CHECKPOINT", "BARRICADE", "LOCKUP"][entrance.lane]}
              </small>
              <h2>{entrance.name}</h2>
              <p>{entranceCard.effect.split(".")[0]}.</p>
            </div>
          </aside>
        )}
        <div className="raid-field">
          {([0, 1, 2] as const).map((lane) => {
            const crew = shownMatch.boards[lane].filter(
                (c) => c.owner === "player",
              ),
              enemy = shownMatch.boards[lane].filter((c) => c.owner === "cpu");
            return (
              <section
                className="raid-lane"
                key={lane}
                data-lane={lane}
                data-target={!!card}
                data-playable={!!card && targets[lane]}
                data-selected={!!card && selectedLane === lane}
              >
                <div className="raid-police">
                  {enemy.map((c) => {
                    const npc = BOSS_NPCS[c.cardId as BossNpcId];
                    return npc ? (
                      <button
                        className="raid-npc"
                        data-arriving={
                          policeRevealing &&
                          step > 0 &&
                          blast?.policePlays[step - 1].instanceId ===
                            c.instanceId
                        }
                        key={c.instanceId}
                        onClick={(e) => open(e, () => setIntel(c))}
                        aria-label={`${c.name}: ${c.effect}`}
                      >
                        <BossIdleSprite
                          asset={c.cardId === "raid-oink" ? form.art : npc.art}
                          name={c.name}
                          paused={
                            modal ||
                            resultsOpen ||
                            c.statuses.silenced ||
                            c.statuses.frozen
                          }
                          reduced={reducedMotion}
                        />
                        <b>{getEffectiveCardPower(c)}</b>
                        <small className="raid-npc-cost">⚡{c.cost}</small>
                        <span>{c.name}</span>
                        {(c.statuses.silenced || c.statuses.frozen) && (
                          <small>
                            {c.statuses.silenced ? "SILENCED" : "FROZEN"}
                          </small>
                        )}
                      </button>
                    ) : (
                      <CardView
                        key={c.instanceId}
                        card={c}
                        isBoard
                        isEnemy
                        disableLayout
                        presentationOnly
                      />
                    );
                  })}
                </div>
                <div className="raid-lane-label">
                  <h3>{["CHECKPOINT", "BARRICADE", "LOCKUP"][lane]}</h3>
                  <div>
                    <b className="raid-police-score">
                      {preview.policeHands[lane]}
                    </b>
                    <span>POLICE</span>
                    <strong>{preview.hands[lane]}</strong>
                    <span>YOU</span>
                  </div>
                  <small
                    className="raid-lane-result"
                    data-winner={preview.winners[lane]}
                  >
                    {preview.winners[lane] === "player"
                      ? "YOU LEAD"
                      : preview.winners[lane] === "cpu"
                        ? "POLICE LEAD"
                        : "TIED"}
                    {blast && !policeRevealing
                      ? ` · ${blast.damage[lane]} DAMAGE`
                      : ""}
                  </small>
                </div>
                <div
                  className="raid-crew"
                  tabIndex={0}
                  aria-label={`Lane ${lane + 1} crew: ${crew.map((c) => `${c.name}, ${getEffectiveCardPower(c)} Hands`).join("; ")}`}
                >
                  {crew.length === 0 && (
                    <div className="raid-open-lane" aria-hidden="true">
                      <span>＋</span>
                      <small>OPEN LANE</small>
                    </div>
                  )}
                  {crew.map((c) => (
                    <CardView
                      key={c.instanceId}
                      card={c}
                      effectivePower={getEffectiveCardPower(c)}
                      currentRound={shownMatch.round}
                      isBoard
                      disableLayout
                      fillContainer
                      presentationOnly
                    />
                  ))}
                </div>
                {card && (
                  <button
                    className="raid-deploy"
                    disabled={locked || !targets[lane]}
                    aria-pressed={selectedLane === lane}
                    onClick={() => setSelectedLane(lane)}
                  >
                    {targets[lane]
                      ? selectedLane === lane
                        ? "✓ SELECTED"
                        : `SELECT · ${bossCardCost(run, card, lane, squabble, investment)} ⚡`
                      : "BLOCKED"}
                  </button>
                )}
              </section>
            );
          })}
        </div>
        {blast && !policeRevealing && (
          <BossRaidRoundBlast key={blast.round} blast={blast} />
        )}
        <section className="raid-hand-dock" aria-label="Card controls">
          <div className="raid-selection">
            {card && (
              <>
                <p>
                  <b>{card.ability}</b> · {card.effect}
                </p>
                <label>
                  <input
                    type="checkbox"
                    checked={squabble}
                    disabled={
                      locked ||
                      run.match.squabbleUsed ||
                      card.kind !== "character"
                    }
                    onChange={(e) => setSquabble(e.target.checked)}
                  />{" "}
                  Squabble ×2
                </label>
                {card.kind === "blockbuster" && (
                  <label>
                    Invest {investment}
                    <input
                      type="range"
                      min={0}
                      max={9}
                      value={investment}
                      disabled={locked}
                      onChange={(e) => setInvestment(Number(e.target.value))}
                    />
                  </label>
                )}
              </>
            )}
          </div>
          <div className="raid-hand" aria-label="Your hand">
            {run.match.playerHand.map((c) => (
              <button
                className="raid-hand-card"
                key={c.instanceId}
                data-selected={selected === c.instanceId}
                data-instance={c.instanceId}
                aria-label={`Select ${c.name}`}
                aria-pressed={selected === c.instanceId}
                disabled={locked}
                onClick={() => {
                  setSelected(selected === c.instanceId ? null : c.instanceId);
                  setSelectedLane(null);
                }}
              >
                <CardView
                  card={c}
                  disableLayout
                  fillContainer
                  presentationOnly
                  effectivePower={getEffectiveCardPower(c)}
                  cost={c.cost}
                  currentRound={shownMatch.round}
                />
              </button>
            ))}
          </div>
          <footer className="raid-controls">
            {card && (
              <button
                className="raid-cancel"
                onClick={() => {
                  setSelected(null);
                  setSelectedLane(null);
                }}
              >
                Cancel
              </button>
            )}
            <div className="raid-motion">
              <span>
                ⚡ <b>{run.match.playerMotion}</b>
              </span>
              <small>MOTION</small>
            </div>
            {run.phase === "active" ? (
              <button
                className="raid-fire"
                disabled={
                  locked ||
                  (!!card && (selectedLane === null || !targets[selectedLane]))
                }
                onClick={() =>
                  card && selectedLane !== null
                    ? onAction({
                        type: "play",
                        instanceId: card.instanceId,
                        lane: selectedLane,
                        squabble,
                        investment,
                      })
                    : onAction({ type: "blast" })
                }
              >
                {busy
                  ? "SAVING…"
                  : blast
                    ? "HANDS UP…"
                    : card
                      ? selectedLane === null
                        ? "CHOOSE A LANE"
                        : `PLAY CARD · ${bossCardCost(run, card, selectedLane, squabble, investment)} ⚡ →`
                      : "END TURN →"}
              </button>
            ) : (
              <button
                className="raid-results-reopen"
                onClick={() => setResultsDismissed(false)}
              >
                VIEW RESULTS
              </button>
            )}
            <button
              className="raid-more"
              disabled={locked}
              onClick={(e) => open(e, () => setRetire(true))}
              aria-label="End daily attack"
            >
              ⋯
            </button>
          </footer>
          <div className="raid-persistence-note">
            HP carries over daily · one attack per day ·{" "}
            {status.earned.packTickets} daily tickets banked
          </div>
        </section>
      </div>
      <Dialog.Root
        open={resultsOpen}
        onOpenChange={(open) => {
          if (!open) setResultsDismissed(true);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="raid-modal-backdrop raid-results-backdrop" />
          <Dialog.Content
            className="raid-modal raid-results-popup"
            style={{backgroundImage: `linear-gradient(180deg, #06132355, #061323cc), url("${getAssetUrl("assets/boss-raid/attack-complete-bg.webp")}")`}}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              arenaRef.current
                ?.querySelector<HTMLButtonElement>(".raid-results-reopen")
                ?.focus();
            }}
            aria-describedby="raid-results-description"
          >
            <img
              className="raid-results-emblem"
              src={getAssetUrl("assets/boss-raid/attack-complete-seal.svg")}
              alt=""
            />
            <small>DAILY ATTACK COMPLETE</small>
            <Dialog.Title>
              {run.hp === 0
                ? "PRECINCT DOWN"
                : run.phase === "retired"
                  ? "DAMAGE BANKED"
                  : getMatchWinner(run.match) === "player"
                    ? "THE BLOCK HIT BACK"
                    : "KEEP APPLYING PRESSURE"}
            </Dialog.Title>
            <strong className="raid-results-damage">
              −{run.score}
              <span>BOSS DAMAGE</span>
            </strong>
            <Dialog.Description id="raid-results-description">
              {run.hp === 0
                ? "You broke this tier. The next precinct is waiting."
                : `${run.hp} HP left. Your damage stays on Oink—bring the crew back tomorrow.`}
            </Dialog.Description>
            <div className="raid-results-reward">
              <b>+{status.earned.packTickets}</b> TICKETS BANKED
            </div>
            <button className="raid-fire" onClick={onExit}>
              BACK TO FADECADE →
            </button>
            <Dialog.Close className="raid-results-inspect">
              Review battlefield
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {intel && <CardInspector card={intel} match={run.match} onClose={close} />}
      <Dialog.Root
        open={help || retire || forms}
        onOpenChange={(v) => {
          if (!v) close();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="raid-modal-backdrop" />
          <Dialog.Content
            className="raid-modal"
            aria-describedby={undefined}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              trigger.current?.focus();
            }}
          >
            <Dialog.Title className="sr-only">
              {intel?.name ??
                (retire
                  ? "End daily attack"
                  : forms
                    ? "Officer Oink tiers"
                    : "How to fight")}
            </Dialog.Title>
            <button
              className="raid-modal-close"
              onClick={close}
              aria-label="Close"
            >
              ×
            </button>
            {retire ? (
              <>
                <h2>End today's attack?</h2>
                <p>
                  Your damage and earned rewards stay saved. The daily entry is
                  used.
                </p>
                <button
                  className="raid-fire"
                  onClick={() => {
                    close();
                    onAction({ type: "retire" });
                  }}
                >
                  BANK DAMAGE & LEAVE
                </button>
              </>
            ) : forms ? (
              <>
                <small>FIVE FORMS · ONE CAMPAIGN</small>
                <h2>THE WHOLE PRECINCT</h2>
                <div className="raid-form-cards">
                  {BOSS_FORMS.map((f) => (
                    <article
                      key={f.tier}
                      data-unlocked={f.tier <= campaign.tier}
                    >
                      <img
                        src={bossArt(f.art)}
                        alt={`Officer Oink tier ${f.tier}`}
                      />
                      <small>TIER {f.tier}</small>
                      <h3>{f.name}</h3>
                      <p>
                        {f.hp} HP · Hands ×{f.multiplier}
                      </p>
                      <p>{f.pressure}</p>
                      <b>{f.reward.packTickets} tickets on defeat</b>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2>MAKE IT HURT.</h2>
                <p>
                  Play a six-round match against a shuffled ten-card police
                  deck. The police draw cards, spend Motion and contest your
                  lanes. After both turns, native abilities resolve and lane
                  results fire at Oink at ×{form.multiplier} damage.
                </p>
                <p>
                  Each surviving character supplies 2 blast charge. Winning
                  lanes add full Hands, ties add half and lost lanes add a
                  quarter. Police armor absorbs the Hands bonus; charge still
                  gets through. All charge is multiplied by this tier's blast
                  strength.
                </p>
                <p>
                  His HP stays down between days. Expect roughly five daily
                  attacks per tier; the deck and your decisions change that
                  pace. Defeat all five forms.
                </p>
                <p>
                  Silence, freeze and protection beat police pressure. Tap
                  officers to read their counters.
                </p>
                <h3>THIS TIER'S BOUNTY</h3>
                <p>
                  {form.reward.softCurrency} Clout · {form.reward.packTickets}{" "}
                  tickets · {form.reward.styleShards} shards on defeat, plus
                  daily damage rewards.
                </p>
                <p>
                  Campaign damage: {campaign.totalDamage}. Personal best daily
                  attack: {status.bestScore}.
                </p>
                {status.history.length > 0 && (
                  <details className="raid-history">
                    <summary>DAILY ATTACK HISTORY</summary>
                    <ol>
                      {status.history.map((h) => (
                        <li key={h.day}>
                          <span>{h.day}</span>
                          <b>
                            {h.score} damage
                            {h.defeated ? " · TIER CLEARED" : ""}
                          </b>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
                <p>
                  Next entry:{" "}
                  {new Date(status.resetsAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  .
                </p>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}
