import {squabbledCardIds} from '../../lib/battleMediaEvents';
import { BOSS_ARCHIVE,DOJO_NPC_NAMES } from '@workspace/squabblemon-engine/bossArchive';
import * as Dialog from "@radix-ui/react-dialog";
import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useId,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import {
  applyBossAction,
  BOSS_NPCS,
  BOSS_FORMS,
  KUMITE_BOSS_FORMS,
  BOSS_TIERS,
  bossForm,
  bossFormForMode,
  BOSS_ROUNDS,
  bossBlastPreview,
  bossCardCost,
  type BossAction,
  type BossStatus,
  type BossBlast,
  type BossNpcId,
  type BossTier,
  type BossRaidMode,
} from "@workspace/squabblemon-engine/bossRaid";
import { KUMITE_LINEUP_REWARDS, getCardImage } from "../../data";
import {
  getEffectiveCardPower,
  getMatchWinner,
  type Lane,
  type CardInstance,
} from "../../gameEngine";
import { CardView } from "../CardView";
import { CardInspector } from "../CardInspector";
import { GameGlyph } from "../venue/GameGlyph";
import { getAssetUrl } from "../../lib/assets";
import {
  POLICE_ENTRANCE_MS,
  policeRevealDuration,
  raidIdentity,
  raidBankedRewards,
} from "./bossRaidPresentation";
import { BossRaidRoundBlast } from "./BossRaidRoundBlast";
import { BossRaidTargetLine } from "./BossRaidTargetLine";
import { BossIdleSprite } from "./BossIdleSprite";
import "../../styles/boss-raid.css";
import "../../styles/boss-raid-design.css";
import "../battle-board.css";
import "../../styles/reward-street-file.css";
import "../../styles/boss-raid-cinematic.css";
export const bossArt = (name: string) =>
  getAssetUrl(`assets/boss-raid/${name}.webp`);
function RaidFormationDialog({ lane, laneName, opposition, owner, cards, round, squabbledIds, mode, onClose, onInspect }: {
  lane: Lane;
  laneName: string;
  opposition: string;
  owner: "player" | "cpu";
  cards: CardInstance[];
  squabbledIds: ReadonlySet<string>;
  mode: BossRaidMode;
  round: number;
  onClose: () => void;
  onInspect: (card: CardInstance) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const node = dialog.current;
    const opener = document.activeElement as HTMLElement | null;
    node?.showModal();
    return () => {
      node?.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  const side = owner === "cpu" ? opposition : "Your crew";
  return createPortal(
    <dialog ref={dialog} className="raid-formation-dialog"
      aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <header className="raid-formation-header">
        <div><small>{laneName}</small><h2 id={titleId}>{side} · {cards.length}</h2></div>
        <button type="button" onClick={onClose} aria-label="Close formation">×</button>
      </header>
      <div className="raid-formation-content">
        <p id={descriptionId}>Select a card for its full ability and live status.</p>
        <div className="raid-formation-cards">
          {cards.map((fighter) => (
            <div className="raid-formation-card" key={fighter.instanceId}>
              {BOSS_NPCS[fighter.cardId as BossNpcId] ? <button className="raid-formation-npc" onClick={()=>onInspect(fighter)}><BossIdleSprite asset={mode==='kumite'?`dojo:npc-${fighter.cardId.replace('raid-','')}`:BOSS_NPCS[fighter.cardId as BossNpcId].art} name={mode==='kumite'?DOJO_NPC_NAMES[fighter.cardId]??fighter.name:fighter.name} paused reduced/><strong>{mode==='kumite'?DOJO_NPC_NAMES[fighter.cardId]??fighter.name:fighter.name}</strong><small>{fighter.cost} MOTION · {getEffectiveCardPower(fighter)} HANDS</small></button> : <CardView card={fighter} squabblePlayed={squabbledIds.has(fighter.instanceId)} isBoard isEnemy={owner === "cpu"}
                fillContainer disableLayout effectivePower={getEffectiveCardPower(fighter)}
                currentRound={round} onClick={() => onInspect(fighter)}
                onInspect={() => onInspect(fighter)} />}
            </div>
          ))}
        </div>
      </div>
      <footer><button type="button" onClick={onClose}>← Back to board</button></footer>
    </dialog>, document.body,
  );
}

export function BossRaidView({
  status,
  mode,
  onModeChange,
  ownedCardIds = [],
  busy = false,
  blast = null,
  onAction,
  onExit,
  exitLabel="← Fadecade",
  error = "",
  onRetry,
  onSync,
  reducedMotion = false,
}: {
  status: BossStatus;
  mode?: BossRaidMode;
  onModeChange?: (mode: BossRaidMode) => void;
  ownedCardIds?: string[];
  busy?: boolean;
  blast?: BossBlast | null;
  onAction: (action: BossAction) => void;
  onExit: () => void;
  exitLabel?: string;
  error?: string;
  onRetry?: () => void;
  onSync?: () => void;
  reducedMotion?: boolean;
}) {
  const run = status.run!,
    activeMode: BossRaidMode = mode ?? run.mode ?? "precinct",
    form = bossFormForMode(run.bossTier, activeMode),
    kumiteForm = KUMITE_BOSS_FORMS[run.bossTier - 1],
    campaign = status.campaign,
    identity = raidIdentity(activeMode, run.bossTier),
    banked = raidBankedRewards(status, activeMode);
  const playedSquabbles=useMemo(()=>squabbledCardIds(run.match.effectLog),[run.match.effectLog]);
  const [resultsDismissed, setResultsDismissed] = useState(false);
  const [dojoIntro,setDojoIntro]=useState(activeMode==='kumite' && run.phase==='active');
  useEffect(()=>{if(activeMode!=="kumite"||run.phase!=="active"){setDojoIntro(false);return;}setDojoIntro(true);const timer=setTimeout(()=>setDojoIntro(false),1200);return()=>clearTimeout(timer);},[run.id,activeMode]);
  const [formation, setFormation] = useState<{ lane: Lane; owner: "player" | "cpu" } | null>(null);
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
    modal = !!intel || help || retire || forms || !!formation;
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
  const bossPhase =
    displayedHp <= 0
      ? "defeated"
      : displayedHp <= run.maxHp * 0.25
        ? "critical"
        : displayedHp <= run.maxHp * 0.5
          ? "bloodied"
          : "healthy";
  const projectedLoss =
    run.phase === "active" && !blast ? Math.min(displayedHp, preview.total) : 0;
  const isLethalProjection = projectedLoss >= displayedHp && displayedHp > 0;
  const totalBoardHands = preview.hands[0] + preview.hands[1] + preview.hands[2];
  return (
    <main
      className="boss-raid raid-v2 raid-v3 raid-combat-layout raid-cinematic"
      aria-label={activeMode === "kumite" ? "Kumite Dojo Raid battle" : "Punch on Patrol battle"}
      data-testid="boss-raid-stage"
      data-raid-mode={activeMode}
      data-round={shownMatch.round}
      data-tier={run.bossTier}
      data-reduced-motion={reducedMotion}
      style={
        {
          "--raid-bg": `url("${getAssetUrl(
            activeMode === "kumite"
              ? "assets/kumite/layers/backdrop.webp"
              : "assets/boss-raid/precinct-arena-v3.webp",
          )}")`,
        } as CSSProperties
      }
    >
      <header className="raid-top">
        <button onClick={onExit}>{exitLabel}</button>
        {onModeChange && (
          <div className="raid-mode-flip raid-mode-flip--compact" role="tablist" aria-label="Switch Raid Operation">
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === "precinct"}
              onClick={() => onModeChange("precinct")}
            >
              PRECINCT
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === "kumite"}
              onClick={() => onModeChange("kumite")}
            >
              KUMITE DOJO
            </button>
          </div>
        )}
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
        <div className="raid-boss-scene" aria-hidden="true" data-hit={!!blast?.total && !policeRevealing}
          data-defeated={run.hp === 0} data-boss-phase={bossPhase}>
          <div className="raid-boss-figure" data-testid="raid-boss-figure">
            {activeMode === "kumite" ? (
              <BossIdleSprite className="raid-scene-portrait" asset={`dojo:boss-tier-${run.bossTier}`} name={kumiteForm.bossTitle} paused={modal || resultsOpen} reduced={reducedMotion} phase={blast ? (policeRevealing ? (entrance ? "strike" : "windup") : "recoil") : "idle"} />
            ) : (
              <BossIdleSprite asset={form.art} name={identity.title}
                paused={modal || resultsOpen || run.hp === 0} reduced={reducedMotion} />
            )}
            <span className="raid-boss-impact-anchor" />
          </div>
          <span className="raid-scene-ground" />
        </div>
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
          data-boss-phase={bossPhase}
        >
          <span className="raid-tier-stamp" aria-hidden="true">
            0{run.bossTier}
          </span>
          <div className="raid-boss-title">
            <div className="raid-boss-title__eyebrow-row">
              <button className="raid-boss-inspect" onClick={(e) => open(e, () => setForms(true))}
                aria-label={activeMode === "kumite" ? "Inspect Kumite Grandmaster tiers" : "Inspect Officer Oink tiers"}>
                TIER {run.bossTier} / 5 · {form.name}
              </button>
              {(bossPhase === "bloodied" || bossPhase === "critical") && (
                <span className="raid-phase-badge" data-phase={bossPhase}>
                  {bossPhase === "critical" ? "CRITICAL · <25% HP" : "WOUNDED · <50% HP"}
                </span>
              )}
            </div>
            <h1>{identity.title}</h1>
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
              {projectedLoss > 0 && (
                <span
                  className="raid-hp-projected"
                  aria-hidden="true"
                  data-lethal={isLethalProjection}
                  style={
                    {
                      "--projected-left": `${Math.max(0, ((displayedHp - projectedLoss) / run.maxHp) * 100)}%`,
                      "--projected-width": `${(projectedLoss / run.maxHp) * 100}%`,
                    } as CSSProperties
                  }
                />
              )}
            </div>
            <div
              className="raid-boss-multibar"
              aria-label={`${6 - run.bossTier} boss health bars remaining`}
            >
              <b>×{6 - run.bossTier}</b>
              <small>×{form.multiplier} DMG</small>
            </div>
            <div className="raid-scoreline">
              <b>
                {displayedHp}
                <small> / {run.maxHp} HP</small>
              </b>
              {run.phase === "active" && !blast && (
                <span
                  className="raid-projected-strike"
                  data-lethal={isLethalProjection}
                >
                  {isLethalProjection
                    ? `★ TIER BREAK · −${preview.total} HP`
                    : `STRIKE −${preview.total} HP (×${form.multiplier})`}
                </span>
              )}
            </div>
            <div className="raid-crew-pressure" aria-label={`${totalBoardHands} crew Hands; ${displayedDamage} damage banked`}>
              <span><b>{totalBoardHands}</b> CREW HANDS</span>
              <span><b>−{displayedDamage}</b> BANKED</span>
              <span>{Math.max(0, run.match.cpuCardIds.length - run.match.cpuDrawIndex)} TO DRAW</span>
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
                ? `${identity.opposition.toUpperCase()} TURN · ${step ? blast.policePlays[step - 1].name : blast.policePlays.length ? "DEPLOYING…" : "PASSED"}`
                : `ROUND ${blast.round} · ${blast.winners.filter((w) => w === "player").length} LANES WON · ${blast.total ? `−${blast.total} HP` : "BLOCKED"}`}
            </strong>
          ) : run.phase !== "active" ? (
            <strong>
              {run.hp === 0
                ? "TIER DOWN."
                : run.phase === "retired"
                  ? "ATTACK ENDED. DAMAGE SAVED."
                  : `${getMatchWinner(run.match) === "player" ? "MATCH WON" : getMatchWinner(run.match) === "cpu" ? `${identity.opposition.toUpperCase()} WON` : "MATCH DRAWN"}.`}
            </strong>
          ) : (
            <>
              <strong>{card ? `PLAY ${card.name}` : "YOUR TURN"}</strong>
              <span>
                {card
                  ? selectedLane === null
                    ? "Choose a highlighted lane below."
                    : `Deploy to ${identity.lanes[selectedLane]}.`
                  : activeMode === "kumite"
                    ? `Conquer the Dojo lanes. Round results strike ${kumiteForm.bossTitle}.`
                    : "Beat the police lanes. Round results attack Oink."}
              </span>
            </>
          )}
        </div>
        {dojoIntro && <div className="dojo-intro-cutin" role="status"><span>WAY OF THE FIST</span><strong>VS {kumiteForm.bossTitle}</strong><small>TIER {run.bossTier} · {kumiteForm.name}</small></div>}
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
                    activeMode === "kumite" ? `dojo:npc-${entranceCard.cardId.replace("raid-", "")}` : entranceCard.cardId === "raid-oink" ? form.art : entranceNpc.art
                  }
                  name={activeMode==="kumite"?DOJO_NPC_NAMES[entranceCard.cardId]??entrance.name:entrance.name}
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
                {identity.opposition.toUpperCase()} DEPLOY · {identity.lanes[entrance.lane].toUpperCase()}
              </small>
              <h2>{activeMode==="kumite"?DOJO_NPC_NAMES[entranceCard.cardId]??entrance.name:entrance.name}</h2>
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
            const laneName = identity.lanes[lane];
            const laneResult = preview.winners[lane] === "player"
              ? "You lead" : preview.winners[lane] === "cpu" ? `${identity.opposition} leads` : "Tied";
            const laneDescription = [
              `${laneName}. ${identity.opposition} ${preview.policeHands[lane]} Hands. You ${preview.hands[lane]} Hands. ${laneResult}.`,
              blast && !policeRevealing ? `${blast.damage[lane]} damage to the boss.` : "",
              card ? targets[lane]
                ? `Select to deploy ${card.name} for ${bossCardCost(run, card, lane, squabble, investment)} Motion.${selectedLane === lane ? " Selected." : ""}`
                : `Cannot play ${card.name} here.`
                : "",
            ].filter(Boolean).join(" ");
            return (
              <section
                className="raid-lane"
                key={lane}
                data-lane={lane}
                data-target={!!card}
                data-playable={!!card && targets[lane]}
                data-selected={!!card && selectedLane === lane}
              >
                <div className="raid-formation">
                <div className="raid-police" role="group" data-count={enemy.length} data-overflow={enemy.length > 4}
                  tabIndex={enemy.length > 4 ? 0 : undefined}
                  aria-label={`${identity.opposition} in lane ${lane + 1}: ${enemy.length} cards`}>
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
                        aria-label={`${activeMode==="kumite"?(DOJO_NPC_NAMES[c.cardId]??c.name):c.name}. Motion ${c.cost}. Hands ${getEffectiveCardPower(c)}. ${c.effect}${c.statuses.silenced ? " Silenced." : c.statuses.frozen ? " Frozen." : ""}`}
                      >
                        <BossIdleSprite
                          asset={activeMode === "kumite" ? `dojo:npc-${c.cardId.replace("raid-","")}` : c.cardId === "raid-oink" ? form.art : npc.art}
                          phase={blast ? (policeRevealing ? (entrance?.instanceId===c.instanceId ? "strike" : "windup") : "recoil") : "idle"}
                          name={activeMode==="kumite"?(DOJO_NPC_NAMES[c.cardId]??c.name):c.name}
                          paused={
                            modal ||
                            resultsOpen ||
                            c.statuses.silenced ||
                            c.statuses.frozen
                          }
                          reduced={reducedMotion}
                        />
                        <b className="raid-npc-power" aria-label={`${getEffectiveCardPower(c)} Hands`}>{getEffectiveCardPower(c)}</b>
                        <small className="raid-npc-cost" aria-label={`${c.cost} Motion`}>⚡{c.cost}</small>
                        <span className="raid-npc-name">{activeMode==="kumite"?(DOJO_NPC_NAMES[c.cardId]??c.name):c.name}</span>
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
                        squabblePlayed={playedSquabbles.has(c.instanceId)}
                        isBoard
                        isEnemy
                        disableLayout
                        fillContainer
                        boardPresentation="combat"
                        effectivePower={getEffectiveCardPower(c)}
                        currentRound={shownMatch.round}
                        onClick={() => setIntel(c)}
                        onInspect={() => setIntel(c)}
                      />
                    );
                  })}
                </div>
                <div className="raid-formation-footer">
                  {enemy.length > 4 && <button type="button" className="raid-formation-expand"
                    aria-label={`View all ${enemy.length} ${identity.opposition.toLowerCase()} cards in ${laneName}`} aria-haspopup="dialog"
                    onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); setFormation({ lane, owner: "cpu" }); }}>
                    <span aria-hidden="true">↗</span> View {enemy.length}
                  </button>}
                </div>
                </div>
                <button
                  type="button"
                  className={`raid-lane-label${card ? " raid-deploy" : ""}`}
                  disabled={!card || locked || !targets[lane]}
                  aria-pressed={!!card && selectedLane === lane}
                  aria-label={laneDescription}
                  onClick={() => setSelectedLane(lane)}
                >
                  <h3>
                    {laneName.toUpperCase()}
                  </h3>
                  <div>
                    <b className="raid-police-score">
                      {preview.policeHands[lane]}
                    </b>
                    <span>{activeMode === "kumite" ? "OPPS" : "POLICE"}</span>
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
                        ? "BOSS LEADS"
                        : "TIED"}
                    {blast && !policeRevealing
                      ? ` · −${blast.damage[lane]} HP`
                      : preview.damage[lane] > 0
                        ? ` · −${preview.damage[lane]} HP`
                        : ""}
                  </small>
                  <span
                    className="raid-lane-clash-bar"
                    aria-hidden="true"
                    data-winner={preview.winners[lane]}
                    style={
                      {
                        "--player-share": `${
                          preview.policeHands[lane] + preview.hands[lane] === 0
                            ? 50
                            : Math.round(
                                (preview.hands[lane] /
                                  (preview.policeHands[lane] + preview.hands[lane])) *
                                  100,
                              )
                        }%`,
                      } as CSSProperties
                    }
                  >
                    <i />
                  </span>
                  {card && <span className="raid-lane-choice">{targets[lane]
                    ? selectedLane === lane ? "✓ SELECTED" : `SELECT · ${bossCardCost(run, card, lane, squabble, investment)} ⚡`
                    : "BLOCKED"}</span>}
                </button>
                <div className="raid-formation">
                <div
                  className="raid-crew"
                  role="group"
                  data-count={crew.length}
                  data-overflow={crew.length > 4}
                  tabIndex={crew.length > 4 ? 0 : undefined}
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
                      squabblePlayed={playedSquabbles.has(c.instanceId)}
                      effectivePower={getEffectiveCardPower(c)}
                      currentRound={shownMatch.round}
                      isBoard
                      disableLayout
                      fillContainer
                      boardPresentation="combat"
                      onClick={() => setIntel(c)}
                      onInspect={() => setIntel(c)}
                    />
                  ))}
                </div>
                <div className="raid-formation-footer">
                  {crew.length > 4 && <button type="button" className="raid-formation-expand"
                    aria-label={`View all ${crew.length} crew cards in ${laneName}`} aria-haspopup="dialog"
                    onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); setFormation({ lane, owner: "player" }); }}>
                    <span aria-hidden="true">↗</span> View {crew.length}
                  </button>}
                </div>
                </div>
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
            HP carries over daily · {activeMode==="kumite"?"two entries per day":"one entry per day"} ·{" "}
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
            className="raid-modal raid-results-popup reward-street-file"
            style={{
              "--reward-file-scene": `url("${getAssetUrl("assets/selection/underpass.webp")}")`,
              "--reward-file-folder": `url("${getAssetUrl("assets/selection/dossier.webp")}")`,
            } as CSSProperties}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              arenaRef.current
                ?.querySelector<HTMLButtonElement>(".raid-results-reopen")
                ?.focus();
            }}
            aria-describedby="raid-results-description"
          >
            <div className="reward-street-file__paper raid-results-paper">
            <div className="raid-results-record">
            <span className="reward-street-file__stamp">{run.hp === 0 ? "TIER CLEARED" : "DAMAGE SAVED"}</span>
            <small className="raid-results-case">{identity.operation} · ATTACK {campaign.attacks}</small>
            <Dialog.Title>
              {run.hp === 0
                ? activeMode === "kumite" ? "MASTER DEFEATED" : "PRECINCT DOWN"
                : run.phase === "retired"
                  ? "DAMAGE BANKED"
                  : getMatchWinner(run.match) === "player"
                    ? "THE BLOCK HIT BACK"
                    : "KEEP APPLYING PRESSURE"}
            </Dialog.Title>
            <div className="raid-results-takedown">
              <figure className="raid-results-evidence">
                <img src={activeMode === "kumite" ? getCardImage(kumiteForm.fighterId) : bossArt(form.art)} alt="" />
                <figcaption>{identity.title} · TIER {run.bossTier}</figcaption>
              </figure>
              <strong className="raid-results-damage">
                −{run.score}
                <span>BOSS DAMAGE</span>
              </strong>
            </div>
            </div>
            <div className="raid-results-details">
            <Dialog.Description id="raid-results-description">
              {run.hp === 0
                ? status.campaign.completed ? "All five tiers defeated. Your campaign rewards are saved."
                  : `Tier ${run.bossTier} cleared. Tier ${campaign.tier} opens with your next daily attack.`
                : `${run.hp} HP left. Your damage stays on ${identity.title}—bring the crew back tomorrow.`}
            </Dialog.Description>
            <div className="raid-results-reward reward-street-file__loot" aria-label="Rewards banked by this attack">
              <span><GameGlyph name="cloutStack" /><b>+{banked.softCurrency}</b><small>CLOUT</small></span>
              <span><GameGlyph name="ticket" /><b>+{banked.packTickets}</b><small>TICKETS</small></span>
              <span><GameGlyph name="shards" /><b>+{banked.styleShards}</b><small>STYLE SHARDS</small></span>
            </div>
            {banked.tierCleared && <p className="raid-results-tier-reward">Includes the confirmed tier-clear bonus.</p>}
            {!campaign.completed && <p className="raid-results-next">Next attack: {new Date(status.resetsAt).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}</p>}
            <button className="raid-fire reward-street-file__action" onClick={onExit}>
              BACK TO FADECADE →
            </button>
            <Dialog.Close className="raid-results-inspect">
              Review battlefield
            </Dialog.Close>
            </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {formation && <RaidFormationDialog lane={formation.lane} laneName={identity.lanes[formation.lane]} opposition={identity.opposition} owner={formation.owner}
        cards={shownMatch.boards[formation.lane].filter((fighter) => fighter.owner === formation.owner)}
        round={shownMatch.round} mode={activeMode} squabbledIds={playedSquabbles} onClose={() => setFormation(null)} onInspect={setIntel} />}
      {intel && <CardInspector card={BOSS_NPCS[intel.cardId as BossNpcId] ? BOSS_ARCHIVE.find(e=>e.id===`archive:${activeMode==="kumite"?"dojo":"precinct"}:${intel.cardId}`) ?? intel : intel} match={run.match} onClose={close} />}
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
                    ? `${identity.title} tiers`
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
                <small>{activeMode === "kumite" ? "KUMITE DOJO RAID · FIVE GRANDMASTERS" : "PUNCH ON PATROL · FIVE FORMS"}</small>
                <h2>{activeMode === "kumite" ? "THE DOJO GAUNTLET" : "THE WHOLE PRECINCT"}</h2>
                <div className="raid-form-cards">
                  {(activeMode === "kumite" ? KUMITE_BOSS_FORMS : BOSS_FORMS).map((f) => (
                    <article
                      key={f.tier}
                      data-unlocked={f.tier <= campaign.tier}
                    >
                      <img
                        src={"fighterId" in f ? getCardImage(f.fighterId) : bossArt(f.art)}
                        alt={"bossTitle" in f ? `${f.bossTitle} tier ${f.tier}` : `Officer Oink tier ${f.tier}`}
                      />
                      <small>TIER {f.tier}</small>
                      <h3>{"bossTitle" in f ? `${f.bossTitle} · ${f.name}` : f.name}</h3>
                      <p>
                        {f.hp} HP · Hands ×{f.multiplier}
                      </p>
                      <p>{activeMode === "kumite" ? "Contest lanes, break armor, and keep your crew standing." : f.pressure}</p>
                      <b>{f.reward.packTickets} tickets + Kumite Title Credit</b>
                    </article>
                  ))}
                </div>
                <div className="raid-kumite-unlock-strip" aria-label="Kumite fighter unlock status">
                  <span>KUMITE FIGHTER UNLOCKS ({KUMITE_LINEUP_REWARDS.filter((r) => ownedCardIds.includes(r.cardId)).length}/{KUMITE_LINEUP_REWARDS.length})</span>
                  <div className="raid-kumite-unlock-pills">
                    {KUMITE_LINEUP_REWARDS.map((item) => {
                      const isOwned = ownedCardIds.includes(item.cardId);
                      return (
                        <span key={item.id} className="raid-kumite-pill" data-owned={isOwned}>
                          {isOwned ? "✓ " : ""}{item.name} · {item.requirement}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2>{identity.operation}</h2>
                <p>
                  Play a six-round match against a shuffled ten-card opponent
                  deck. Opponents draw cards, spend Motion and contest your
                  lanes. After both turns, abilities resolve and lane
                  results strike {identity.title} at ×{form.multiplier} damage.
                </p>
                <p>
                  Each surviving character supplies 2 blast charge. Winning
                  lanes add full Hands, ties add half and lost lanes add a
                  quarter. Opponent armor absorbs the Hands bonus; charge still
                  gets through. All charge is multiplied by this tier's blast
                  strength.
                </p>
                <p>
                  His HP stays down between days. Expect roughly five daily
                  attacks per tier; the deck and your decisions change that
                  pace. Defeat all five forms.
                </p>
                <p>
                  Silence, freeze and protection counter opponent pressure. Tap
                  fighters to read their abilities.
                </p>
                <h3>DAILY DAMAGE REWARDS</h3>
            <div className="raid-score-tiers" aria-label="Daily damage reward milestones">
              {BOSS_TIERS.map((t) => {
                const earned = displayedDamage >= t.score;
                const projected = !earned && displayedDamage + preview.total >= t.score;
                return (
                  <span
                    key={t.score}
                    className="raid-score-tier-pip"
                    data-earned={earned}
                    data-projected={projected}
                  >
                    <b>{t.score} DMG</b>
                    <small>{t.score === 50 ? "★ KUMITE WIN" : `+${t.packTickets || t.softCurrency} ${t.packTickets ? "TIX" : "CLOUT"}`}</small>
                  </span>
                );
              })}
            </div>
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
