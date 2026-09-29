import { ArrowLeft, Bell, Music2 } from 'lucide-react';

const art = '/__mockup/images/fade-alley/hud/';

/** A sandbox-only extraction of the game's wide player HUD; no live navigation or balances. */
export function FadeGameHeader({ onPreviewAction }: { onPreviewAction: (action: string) => void }) {
  const preview = (action: string) => () => onPreviewAction(action);
  return (
    <header className="fa-hud" aria-label="Player and navigation">
      <div className="fa-hud__inner">
        <div className="fa-hud__return">
          <button type="button" className="fa-hud__back" aria-label="Back, preview only" onClick={preview('Back')}><ArrowLeft size={19} /><span>BACK</span></button>
          <button type="button" className="fa-hud__safehouse" aria-label="Safehouse, preview only" onClick={preview('Safehouse')}>
            <img src={`${art}safehouse-key.webp`} alt="" />
          </button>
        </div>
        <button type="button" className="fa-hud__identity" aria-label="Player one, level 12, 840 street rep. Player profile preview only" onClick={preview('Player profile')}>
          <span className="fa-hud__level">12</span><span className="fa-hud__identity-copy"><strong>PLAYER ONE</strong><small>LEVEL 12 · 840 REP</small></span>
        </button>
        <div className="fa-hud__wallet" aria-label="Preview balances">
          <button type="button" className="fa-hud__balance" aria-label="1,240 Clout, preview only" onClick={preview('Clout balance')}><img src={`${art}clout-token.webp`} alt="" /><b>1,240</b></button>
          <button type="button" className="fa-hud__balance fa-hud__shards" aria-label="85 style shards, preview only" onClick={preview('Style shards')}><img src={`${art}style-hanger.webp`} alt="" /><b>85</b></button>
        </div>
        <button type="button" className="fa-hud__icon fa-hud__inbox" aria-label="Notifications, preview only" onClick={preview('Notifications')}><Bell size={19} /><i aria-hidden="true">2</i></button>
        <button type="button" className="fa-hud__icon fa-hud__music" aria-label="Music controls, preview only" onClick={preview('Music controls')}><Music2 size={20} /><span>DJ</span></button>
        <button type="button" className="fa-hud__express" aria-label="Open game navigation, preview only" onClick={preview('Game navigation')}><img src={`${art}squabble-express.webp`} alt="" /><span>EXPRESS</span></button>
      </div>
    </header>
  );
}