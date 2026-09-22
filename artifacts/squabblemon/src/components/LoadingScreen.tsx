import '../styles/ui-polish.css';
import { getAssetUrl } from '../lib/assets';

/** One stable composition across startup, route, and account loading. */
export function LoadingScreen() {
  return <div className="brand-loader" data-testid="loading-screen" aria-busy="true">
    <img className="brand-loader__poster" src={getAssetUrl('brand/loading-scenes.webp')} alt="" aria-hidden="true" />
    <div className="brand-loader__shade" aria-hidden="true" />
    <div className="brand-loader__halo" aria-hidden="true" />
    <img src={getAssetUrl('brand/squabblemon-crest.webp')} alt="" width="374" height="384" className="brand-loader__crest" />
    <span className="brand-loader__billing">SQUABBLEMON · THE CITY IS WATCHING</span>
    <div className="brand-loader__meter" aria-hidden="true"><span /></div>
    <span className="brand-loader__label" role="status">Loading the block</span>
    <p className="brand-loader__tip">Build your gang. Read the room. Own two districts.</p>
  </div>;
}
