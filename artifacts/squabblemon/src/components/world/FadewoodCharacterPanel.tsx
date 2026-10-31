import { useEffect, useState, type CSSProperties } from 'react';
import type { StoryCampaign } from '@workspace/api-client-react';
import { ArrowRight, BookOpen, MapPin } from 'lucide-react';
import { GamePopupClose, GamePopupCopy, GamePopupFrame, GamePopupLabel, GamePopupSecondary, GamePopupTitle, RewardFilePaper, RewardFileStamp } from '../ui/game-popup';
import { getAssetUrl } from '../../lib/assets';
import { FADEWOOD_ARCS, WORLD_PLACES, getActiveCharacterId, getHostName, getWorldActionsForCampaign, isMemorialSource, resolveContinue } from '../../lib/fadewood/registry';
import { FadewoodPanelSign } from './FadewoodPanelPrimitives';
import { getFadewoodArcPoster, getFadewoodSourceArt } from './fadewoodPanelArt';

export interface FadewoodCharacterPanelProps {
  titleId: string;
  sourceId: string;
  preferredArcId?: string;
  campaign: StoryCampaign;
  accountId: string;
  disabled?: boolean;
  onContinue: (arcId: string) => void;
  onNavigate: (route: string) => void;
  onMail: () => void;
  onMap: () => void;
  onArchive: (arcId?: string) => void;
  onClose: () => void;
}

/** Existing character cutouts and Story posters stay in the world's shared popup materials. */
export function FadewoodCharacterPanel({ titleId, sourceId, preferredArcId, campaign, accountId, disabled = false, onContinue, onNavigate, onMail, onMap, onArchive, onClose }: FadewoodCharacterPanelProps) {
  const actions = getWorldActionsForCampaign(sourceId, campaign, accountId, preferredArcId);
  const arcActions = actions.filter(action => action.intent.kind === 'arc');
  const initialArcId = arcActions.find(action => action.id === preferredArcId)?.id ?? arcActions.find(action => action.intent.kind === 'arc' && resolveContinue(campaign, accountId, action.intent.arcId))?.id ?? arcActions[0]?.id;
  const [selectedId, setSelectedId] = useState(initialArcId);
  useEffect(() => { setSelectedId(initialArcId); }, [sourceId, preferredArcId]);
  const selectedAction = arcActions.find(action => action.id === selectedId) ?? arcActions[0];
  const selectedArcId = selectedAction?.intent.kind === 'arc' ? selectedAction.intent.arcId : undefined;
  const selected = FADEWOOD_ARCS.find(arc => arc.id === selectedArcId);
  const next = selected ? resolveContinue(campaign, accountId, selected.id) : null;
  const chapters = selected ? campaign.chapters.filter(chapter => selected.chapterIds.includes(chapter.id)) : [];
  const cleared = chapters.length > 0 && chapters.every(chapter => chapter.status === 'cleared');
  const source = WORLD_PLACES.find(place => place.id === sourceId);
  const name = source?.name ?? getHostName(sourceId);
  const art = getFadewoodSourceArt(sourceId, selected?.id);
  const venueActions = actions.filter(action => action.intent.kind !== 'arc');
  const material = {
    '--fadewood-brick': `url("${getAssetUrl('assets/progression/brick-ui-v1.webp')}")`,
  } as CSSProperties;
  if (isMemorialSource(sourceId)) return <GamePopupFrame material="brick" className="fadewood-world__sheet fadewood-panel" style={{ ...material, maxWidth: 420, marginInline: 'auto' }}>
    <GamePopupClose onClick={onClose} aria-label="Close world menu" data-world-initial-focus />
    <RewardFilePaper><GamePopupTitle id={titleId} feature>Nova</GamePopupTitle><GamePopupCopy>Always part of the block.</GamePopupCopy><GamePopupSecondary onClick={onClose}>Keep exploring</GamePopupSecondary></RewardFilePaper>
  </GamePopupFrame>;
  if (sourceId === 'demario-luigion-booth') return <GamePopupFrame material="dossier" className="fadewood-character-panel fadewood-panel" style={material}>
    <GamePopupClose onClick={onClose} aria-label="Close world menu" data-world-initial-focus />
    <div className="fadewood-character-panel__portrait">
      <div className="fadewood-character-panel__photo" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}><img src={getAssetUrl('assets/characters/demario.webp')} alt="DeMario" draggable={false} decoding="async" /><img src={getAssetUrl('assets/characters/luigion.webp')} alt="Luigion" draggable={false} decoding="async" /></div>
      <span className="fadewood-character-panel__name-tag">DeMario &amp; Luigion</span>
    </div>
    <RewardFilePaper className="fadewood-character-panel__paper"><GamePopupLabel>SMOKE SHOP</GamePopupLabel><GamePopupTitle id={titleId} feature>DeMario &amp; Luigion</GamePopupTitle><GamePopupCopy>Their story is coming to this corner.</GamePopupCopy><RewardFileStamp>Chapter in development</RewardFileStamp>
      <footer className="fadewood-character-panel__footer"><button type="button" className="fadewood-panel__ticket" onClick={onMap}><MapPin size={15} /> Express map <ArrowRight size={14} /></button><button type="button" className="fadewood-panel__ticket" onClick={onClose}>Keep exploring</button></footer>
    </RewardFilePaper>
  </GamePopupFrame>;
  return <GamePopupFrame material="dossier" className="fadewood-character-panel fadewood-panel" style={material}>
    <GamePopupClose onClick={onClose} aria-label="Close world menu" data-world-initial-focus />
    <div className={`fadewood-character-panel__portrait fadewood-character-panel__portrait--${art.kind}`}>
      <div className="fadewood-character-panel__photo"><img key={art.assetId} src={getAssetUrl(art.assetId)} alt={art.kind === 'character' ? name : ''} draggable={false} decoding="async" /></div>
      <span className="fadewood-character-panel__name-tag">{name}</span><span className="fadewood-character-panel__location"><MapPin size={12} /> FADEWOOD</span>
    </div>
    <RewardFilePaper className="fadewood-character-panel__paper">
      <GamePopupLabel>{selected ? 'A FACE. A PLACE. A STORY.' : 'RIGHT AROUND THE CORNER'}</GamePopupLabel>
      <GamePopupTitle id={titleId} feature>{name}</GamePopupTitle>
      {selected ? <>
        {arcActions.length > 1 && <nav className="fadewood-character-panel__arc-tabs" aria-label={`Stories with ${name}`}>{arcActions.map(action => <button type="button" key={action.id} className="fadewood-panel__ticket" aria-pressed={selected?.id === action.id} onClick={() => setSelectedId(action.id)}>{action.label}</button>)}</nav>}
        <section className="fadewood-character-panel__story" aria-label={selected.title}>
          <img className="fadewood-character-panel__story-poster" src={getAssetUrl(getFadewoodArcPoster(selected.id))} alt="" draggable={false} loading="lazy" />
          <div><span className="fadewood-character-panel__arc-kicker">{selected.available ? 'THE NEXT PAGE' : 'A SIGNAL FROM ABOVE'}</span><h3>{selected.title}</h3><GamePopupCopy>{next ? next.node.title : cleared ? 'Every chapter is saved. Your block remembers.' : selected.available ? 'There is more to this story. Keep playing to reach it.' : 'The UFO is on the block. The Anunaki story is coming later.'}</GamePopupCopy>
            {next && <p className="fadewood-character-panel__next-person">With {getHostName(getActiveCharacterId(selected, next.node.nodeId))}<span>Hosted by {getHostName(selected.hostId)}</span></p>}
            <RewardFileStamp>{next ? 'Your place is saved' : cleared ? 'Arc complete' : selected.available ? 'Story archive' : 'Coming later'}</RewardFileStamp>
          </div>
        </section>
        {next ? <FadewoodPanelSign disabled={disabled} onClick={() => onContinue(selected.id)} aria-label={`Continue ${selected.title}`}>Continue Story</FadewoodPanelSign> : selected.available ? <FadewoodPanelSign disabled={disabled} onClick={() => onArchive(selected.id)}>View chapters</FadewoodPanelSign> : <GamePopupCopy>Take a look around. No new chapter has opened yet.</GamePopupCopy>}
        {next && <button type="button" className="fadewood-panel__ticket fadewood-character-panel__archive" onClick={() => onArchive(selected.id)}><BookOpen size={15} /> Chapters & rewards</button>}
      </> : <GamePopupCopy>{source?.note ?? (sourceId === 'mailman' ? 'Your people. Your letters. A little something for the road.' : 'Good to see you on the block. What brings you around?')}</GamePopupCopy>}
      {venueActions.length > 0 && <div className={`fadewood-character-panel__venues${selected ? ' fadewood-character-panel__venues--secondary' : ''}`} aria-label="Around here">{venueActions.map(action => <FadewoodPanelSign key={action.id} disabled={disabled} onClick={() => { if (action.intent.kind === 'mail') onMail(); else if (action.intent.kind === 'mode') onNavigate(action.intent.route); }}>{action.label}</FadewoodPanelSign>)}</div>}
      {!actions.length && <GamePopupCopy>Find your arc hosts and favorite spots on the Express map.</GamePopupCopy>}
      <footer className="fadewood-character-panel__footer"><button type="button" className="fadewood-panel__ticket" onClick={onMap}><MapPin size={15} /> Express map <ArrowRight size={14} /></button><button type="button" className="fadewood-panel__ticket" onClick={onClose}>Keep exploring</button></footer>
    </RewardFilePaper>
  </GamePopupFrame>;
}
