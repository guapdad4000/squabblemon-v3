import { useMemo, useState, type CSSProperties } from 'react';
import type { StoryCampaign } from '@workspace/api-client-react';
import { BookOpen, ChevronLeft, ChevronRight, LockKeyhole, MapPin, X } from 'lucide-react';
import { getAssetUrl } from '../../lib/assets';
import { FADEWOOD_ARCS, WORLD_PLACES, getActiveCharacterId, getHostName, resolveContinue } from '../../lib/fadewood/registry';
import { FadewoodPanelSign } from './FadewoodPanelPrimitives';
import { getFadewoodArcPoster } from './fadewoodPanelArt';

export interface FadewoodExpressMenuProps {
  titleId: string;
  campaign: StoryCampaign;
  accountId: string;
  disabled?: boolean;
  onTravel: (destinationId: string, label: string) => void;
  onContinue: (arcId: string) => void;
  onArchive: (arcId?: string) => void;
  onClose: () => void;
}
const mainLine = ['safehouse', 'fade-market', 'fade-park', 'underground-arena', 'squabble-house', 'dojo', 'fade-park-bulletin'];

/** Content only: the world owns the one native dialog and its focus lifecycle. */
export function FadewoodExpressMenu({ titleId, campaign, accountId, disabled = false, onTravel, onContinue, onArchive, onClose }: FadewoodExpressMenuProps) {
  const [tab, setTab] = useState<'neighborhood' | 'story'>('neighborhood');
  const [page, setPage] = useState(0);
  const initial = resolveContinue(campaign, accountId)?.arc.id ?? FADEWOOD_ARCS[0].id;
  const [selectedId, setSelectedId] = useState(initial);
  const places = useMemo(() => [...WORLD_PLACES], []);
  const main = mainLine.flatMap(id => places.filter(place => place.id === id));
  const back = places.filter(place => !mainLine.includes(place.id));
  const backPages = Math.max(1, Math.ceil(back.length / 6));
  const currentStops = page === 0 ? main : back.slice((page - 1) * 6, page * 6);
  const selected = FADEWOOD_ARCS.find(arc => arc.id === selectedId) ?? FADEWOOD_ARCS[0];
  const next = resolveContinue(campaign, accountId, selected.id);
  const chapters = campaign.chapters.filter(chapter => selected.chapterIds.includes(chapter.id));
  const cleared = chapters.length > 0 && chapters.every(chapter => chapter.status === 'cleared');
  const selectedIndex = FADEWOOD_ARCS.indexOf(selected);
  const choosePoster = (index: number) => {
    const arc = FADEWOOD_ARCS[Math.max(0, Math.min(FADEWOOD_ARCS.length - 1, index))];
    setSelectedId(arc.id);
    document.getElementById(`fadewood-express-poster-${arc.id}`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'auto' });
  };
  return <div className={`fadewood-express fadewood-panel${tab === 'story' ? ' fadewood-express--story' : ''}`} style={{ '--fadewood-brick': `url("${getAssetUrl('assets/progression/brick-ui-v1.webp')}")` } as CSSProperties}>
    <h2 id={titleId} className="sr-only">Squabble Express · Fast travel</h2>
    <button type="button" className="express-close" aria-label="Close world menu" onClick={onClose} data-world-initial-focus><X size={22} /></button>
    <nav className="fadewood-express__tabs" aria-label="Express destinations"><button type="button" className="fadewood-panel__ticket" aria-pressed={tab === 'neighborhood'} onClick={() => setTab('neighborhood')}><MapPin size={16} /> Neighborhood</button><button type="button" className="fadewood-panel__ticket" aria-pressed={tab === 'story'} onClick={() => setTab('story')}><BookOpen size={16} /> Story hosts</button></nav>
    {tab === 'neighborhood' ? <div className="express-board fadewood-express__board">
      <img className="express-board__art" src={getAssetUrl('brand/navigation/squabble-express-map.webp')} width={1122} height={1402} alt="" draggable={false} />
      <nav className="express-map" aria-label={page === 0 ? 'Neighborhood fast travel stops' : 'Back streets fast travel stops'}><p className="express-map__heading">{page === 0 ? 'The neighborhood line' : `Back streets · ${page} / ${backPages}`}</p>
        <svg className="express-map__streets" viewBox="0 0 400 440" preserveAspectRatio="none" aria-hidden="true"><g fill="#7c8b7040" stroke="#67775c55"><path d="M8 8h105v66H8z M291 8h96v66h-96z M8 117h69v73H8z M315 117h72v73h-72z M9 240h75v78H9z M301 240h87v78h-87z M9 365h90v61H9z M299 365h90v61h-90z" /></g><path d="M-10 97H410 M-10 219H410 M-10 341H410 M126-10V460 M276-10V460" fill="none" stroke="#86734d30" strokeWidth="18" /><path d="M82 53H306V164H95V281H303V398H94" fill="none" stroke="#99642e80" strokeWidth="3" strokeDasharray="3 7" strokeLinecap="round" /></svg>
        <div className="express-map__stops">{currentStops.map((place, index) => <FadewoodPanelSign key={place.id} right={index % 2 === 1} disabled={disabled} aria-label={`Fast travel to ${place.name}`} title={place.note} onClick={() => onTravel(place.id, place.name)}>{place.id === 'underground-arena' ? 'Kumite' : place.id === 'fade-park-bulletin' ? 'Events & bounties' : place.name}</FadewoodPanelSign>)}
          {page === 0 ? <FadewoodPanelSign right onClick={() => setPage(1)}>Back streets</FadewoodPanelSign> : <><FadewoodPanelSign right={false} onClick={() => setPage(page === 1 ? 0 : page - 1)}>{page === 1 ? 'Main line' : 'Previous stops'}</FadewoodPanelSign><FadewoodPanelSign right onClick={() => setPage(page === backPages ? 0 : page + 1)}>{page === backPages ? 'Main line' : 'More stops'}</FadewoodPanelSign></>}
        </div>
      </nav>
    </div> : <section className="fadewood-express__stories" aria-label="Story arc hosts">
      <header><img src={getAssetUrl('brand/navigation/squabble-express.webp')} alt="" draggable={false} /><div><span>THE STORY LINE</span><h3>Meet your host.</h3><p>Every arc has a place on the block.</p></div></header>
      <div className="fadewood-express__poster-rail" aria-label="Choose a story arc">{FADEWOOD_ARCS.map((arc, index) => {
        const playable = resolveContinue(campaign, accountId, arc.id);
        return <button type="button" key={arc.id} id={`fadewood-express-poster-${arc.id}`} className={`fadewood-express__poster${selected.id === arc.id ? ' is-selected' : ''}`} onClick={() => setSelectedId(arc.id)} aria-pressed={selected.id === arc.id} aria-label={`View ${arc.title} with ${getHostName(arc.hostId)}`}>
          <img src={getAssetUrl(getFadewoodArcPoster(arc.id))} alt="" draggable={false} loading={index < 3 || selected.id === arc.id ? 'eager' : 'lazy'} /><span>{getHostName(arc.hostId)}</span>{!playable && <i aria-label={arc.available ? 'Story archive available' : 'Coming later'}><LockKeyhole size={12} /></i>}
        </button>;
      })}</div>
      <div className="fadewood-express__story-paging"><button type="button" onClick={() => choosePoster(selectedIndex - 1)} disabled={selectedIndex === 0} aria-label="Previous story host"><ChevronLeft size={20} /></button><span>{String(selectedIndex + 1).padStart(2, '0')} / {String(FADEWOOD_ARCS.length).padStart(2, '0')}</span><button type="button" onClick={() => choosePoster(selectedIndex + 1)} disabled={selectedIndex === FADEWOOD_ARCS.length - 1} aria-label="Next story host"><ChevronRight size={20} /></button></div>
      <div className="fadewood-express__story-ticket"><span>HOSTED BY {getHostName(selected.hostId)}</span><h3>{selected.title}</h3><p>{next ? `${next.node.title} · with ${getHostName(getActiveCharacterId(selected, next.node.nodeId))}` : cleared ? 'Your story is saved. Revisit the chapters any time.' : selected.available ? 'Keep playing to unlock this arc.' : 'The UFO is here. Its story is coming later.'}</p>
        {next ? <FadewoodPanelSign disabled={disabled} onClick={() => onContinue(selected.id)} aria-label={`Continue ${selected.title}`}>Continue Story</FadewoodPanelSign> : selected.available ? <FadewoodPanelSign disabled={disabled} onClick={() => onArchive(selected.id)}>View chapters</FadewoodPanelSign> : <FadewoodPanelSign disabled={disabled} onClick={() => onTravel(selected.arrivalId, getHostName(selected.hostId))}>Visit the UFO</FadewoodPanelSign>}
        {next && <button type="button" className="fadewood-panel__ticket" onClick={() => onArchive(selected.id)}>Chapters & rewards</button>}
      </div>
    </section>}
    <footer className="fadewood-express__footer"><button type="button" className="fadewood-panel__ticket" onClick={onClose}>Back to the block</button><button type="button" className="fadewood-panel__ticket" onClick={() => onArchive()}>Story archive</button></footer>
  </div>;
}
