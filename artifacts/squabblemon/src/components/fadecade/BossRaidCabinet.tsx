import { getAssetUrl } from "../../lib/assets";
import { ArcadeCabinet } from "./MachineScreen";
import "../../styles/boss-raid-cabinet.css";

export function BossRaidCabinet({ onOpen }: { onOpen: () => void }) {
  return (
    <section className="patrol-cabinet fadecade-machine-group" aria-label="Punch on Patrol arcade cabinet">
      <ArcadeCabinet
        artUrl="assets/boss-raid/punch-on-patrol-cabinet-v1.webp"
        aspectRatio={1459 / 1078}
        aperture={{ left: "16.74%", top: "29.5%", width: "66.6%", height: "50.5%" }}
        testId="fadecade-boss-raid"
        className="machine-small patrol-cabinet__machine"
      >
        <div className="patrol-cabinet__preview">
          <img
            className="patrol-cabinet__scene"
            src={getAssetUrl("assets/boss-raid/precinct-arena-v3.webp")}
            alt=""
            loading="lazy"
            draggable={false}
          />
          <img
            className="patrol-cabinet__officer"
            src={getAssetUrl("assets/boss-raid/oink-tier-1.webp")}
            alt=""
            loading="lazy"
            draggable={false}
          />
          <span className="patrol-cabinet__siren patrol-cabinet__siren--red" aria-hidden="true" />
          <span className="patrol-cabinet__siren patrol-cabinet__siren--blue" aria-hidden="true" />
          <small className="patrol-cabinet__tag">DAILY BOSS ATTACK</small>
          <h2 className="patrol-cabinet__title" aria-label="Punch on Patrol"><span>PUNCH ON</span><span>PATROL</span></h2>
          <span className="patrol-cabinet__rules">5 FORMS · DAMAGE STAYS</span>
          <button type="button" className="cabinet-btn" aria-label="Open Punch on Patrol" onClick={onOpen}>
            PLAY →
          </button>
        </div>
      </ArcadeCabinet>
    </section>
  );
}
