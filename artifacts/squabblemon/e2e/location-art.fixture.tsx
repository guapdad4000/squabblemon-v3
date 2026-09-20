import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DISTRICT_CATALOG } from '../src/gameEngine';
import { LOCATION_ARTWORK, getLocationArtwork } from '../src/locationArtwork';
import { LocationNode, LocationWallpaper } from '../src/components/LocationArtwork';
import '../src/index.css';
import './location-art.fixture.css';

function LocationArtGallery() {
  const [selected, setSelected] = useState('bodega');
  const [wallpaper, setWallpaper] = useState(false);
  const locations = Object.entries(LOCATION_ARTWORK);
  return <main className="location-art-gallery">
    <header><span>SQUABBLEMON / THE CITY COLLECTION</span><h1>Every block has a story.</h1>
      <p>Painted landmarks. Floating street fragments. Three places to make your move.</p>
      <nav><button onClick={() => setWallpaper(false)} aria-pressed={!wallpaper}>Floating nodes</button>
      <button onClick={() => setWallpaper(true)} aria-pressed={wallpaper}>Wallpaper system</button></nav>
    </header>
    {wallpaper ? <section className="wallpaper-preview">
      <img src={getLocationArtwork(selected).wallpaper} alt={`${getLocationArtwork(selected).name} wallpaper`} />
      <h2>{getLocationArtwork(selected).name}</h2>
      <select aria-label="Wallpaper location" value={selected} onChange={event => setSelected(event.target.value)}>
        {locations.map(([id, art]) => <option key={id} value={id}>{art.name}</option>)}
      </select>
    </section> : <>
      <section className="location-three-preview" aria-label="Three location example">
        <LocationWallpaper ids={['bodega', 'waff-l-house', 'vip-section']} />
        {['bodega', 'waff-l-house', 'vip-section'].map((id, i) => <div className="gallery-node" key={id}>
          <LocationNode id={id} index={i} /><h2>{getLocationArtwork(id).name}</h2><b>{[8, 12, 5][i]} <small>/</small> {[6, 9, 7][i]}</b>
          <p>{DISTRICT_CATALOG.find(d => d.id === id)?.rule}</p>
        </div>)}
      </section>
      <section className="location-art-grid" aria-label="All location designs">
        {locations.map(([id, art], index) => <article key={id}>
          <img src={getLocationArtwork(id).node} alt={`${art.name} painted location`} width="600" height="400" />
          <span>{String(index + 1).padStart(2, '0')} / {id.startsWith('legacy') ? 'CLASSIC' : 'THE CITY'}</span>
          <h2>{art.name}</h2><p>{DISTRICT_CATALOG.find(d => d.id === id)?.strategy ?? 'Artwork for classic saved fades.'}</p>
        </article>)}
      </section>
    </>}
  </main>;
}
const root = createRoot(document.getElementById('root')!);
root.render(<LocationArtGallery />);
import.meta.hot?.dispose(() => root.unmount());
