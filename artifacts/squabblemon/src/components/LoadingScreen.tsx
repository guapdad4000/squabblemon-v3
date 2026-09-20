import { getAssetUrl } from '../lib/assets';

/** One stable composition across startup, route, and account loading. */
export function LoadingScreen() {
  return <div className="brand-loader" data-testid="loading-screen" aria-busy="true">
    <img className="brand-loader__poster" src={getAssetUrl('brand/loading-scenes.webp')} alt="" aria-hidden="true" />
    <div className="brand-loader__shade" aria-hidden="true" />
    <div className="brand-loader__halo" aria-hidden="true" />
    <img src={getAssetUrl('brand/squabblemon-crest.webp')} alt="" width="374" height="384" className="brand-loader__crest" />
    <div className="brand-loader__meter" aria-hidden="true"><span /></div>
    <span className="brand-loader__label" role="status">Loading the block</span>
  </div>;
}
