import { getAssetUrl } from "../../lib/assets";
import "../../styles/boss-raid.css";
export function BossRaidCabinet({ onOpen }: { onOpen: () => void }) {
  return (
    <section className="raid-cabinet fadecade-machine-group">
      <div className="raid-cabinet-art">
        <img
          src={getAssetUrl("assets/boss-raid/oink-tier-1.webp")}
          alt="Officer Oink"
          loading="lazy"
        />
        <small>FIVE BOSSES / DAILY ATTACK</small>
        <h2>
          PRECINCT
          <br />
          PRESSURE
        </h2>
        <p>YOUR HANDS vs. THE WHOLE DEPARTMENT</p>
        <button className="cabinet-btn" onClick={onOpen}>
          FIGHT THE BOSS →
        </button>
      </div>
      <span>Persistent HP · five forms · tier bounties</span>
    </section>
  );
}
