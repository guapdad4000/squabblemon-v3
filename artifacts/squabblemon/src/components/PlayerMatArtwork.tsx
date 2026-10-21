import { playerMatById, DEFAULT_PLAYER_MAT_ID, type PlayerMat } from '@workspace/squabblemon-engine/playerMats';
import { catalogCardById } from '../data';
import { getAssetUrl, getCardImage } from '../lib/assets';
import { PlayerMatImage } from './PlayerMatImage';
import './player-mats.css';

export function MatCharacter({ mat, side = 'player' }: { mat: PlayerMat; side?: 'player' | 'rival' }) {
  const card = mat.characterId ? catalogCardById[mat.characterId] : undefined;
  if (!card) return null;
  return <img className="player-mat-character" data-mat-character={mat.characterId} data-side={side} data-corner={mat.corner ?? (side === 'rival' ? 'left' : 'right')} src={mat.characterAssetId ? getAssetUrl(mat.characterAssetId) : getCardImage(card.artworkId)} alt="" aria-hidden="true" draggable={false} decoding="async"/>;
}
export function PlayerMatArtwork({ mat, side = 'player', eager = false, showCharacter = true, thumbnail = false }: { mat: PlayerMat; side?: 'player' | 'rival'; eager?: boolean; showCharacter?: boolean; thumbnail?: boolean }) {
  const scene = showCharacter && mat.posterAssetId ? mat.posterAssetId : mat.assetId;
  return <div className="player-mat-art" data-mat-id={mat.id} data-side={side} aria-hidden="true">
    <PlayerMatImage src={scene} portrait={mat.portraitAssetId} thumbnail={thumbnail} eager={eager} className="player-mat-art__scene" style={{ objectPosition: mat.position ?? (mat.posterAssetId ? '50% 100%' : '50% 55%') }}/>
    <div className="player-mat-art__shade"/>
    {showCharacter && !mat.posterAssetId && <MatCharacter mat={mat} side={side}/>}
  </div>;
}
export function MatPairArtwork({ playerId, rivalId, eager = false, full = false, showCharacter = true }: { playerId: string; rivalId: string; eager?: boolean; full?: boolean; showCharacter?: boolean }) {
  const player = playerMatById(playerId) ?? playerMatById(DEFAULT_PLAYER_MAT_ID)!;
  const rival = playerMatById(rivalId) ?? playerMatById(DEFAULT_PLAYER_MAT_ID)!;
  if (full || (player.id === rival.id && player.source === 'default')) return <PlayerMatArtwork mat={player} eager={eager} showCharacter={showCharacter}/>;
  return <><div className="player-mat-half player-mat-half--rival"><PlayerMatArtwork mat={rival} side="rival" eager={eager} showCharacter={showCharacter}/></div><div className="player-mat-half player-mat-half--player"><PlayerMatArtwork mat={player} eager={eager} showCharacter={showCharacter}/></div></>;
}
