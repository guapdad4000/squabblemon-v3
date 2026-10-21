import { playerMatById, DEFAULT_PLAYER_MAT_ID, type PlayerMat } from '@workspace/squabblemon-engine/playerMats';
import { PlayerMatImage } from './PlayerMatImage';
import './player-mats.css';

export function PlayerMatArtwork({ mat, side = 'player', eager = false, thumbnail = false }: { mat: PlayerMat; side?: 'player' | 'rival'; eager?: boolean; thumbnail?: boolean }) {
  const scene = thumbnail && mat.posterAssetId ? mat.posterAssetId : mat.assetId;
  return <div className="player-mat-art" data-mat-id={mat.id} data-side={side} data-mat-format={mat.portraitAssetId ? 'responsive' : 'landscape'} aria-hidden="true">
    <PlayerMatImage src={scene} portrait={mat.portraitAssetId} thumbnail={thumbnail} eager={eager} className="player-mat-art__scene" style={{ objectPosition: '50% 50%' }}/>
    <div className="player-mat-art__shade"/>
  </div>;
}
export function MatPairArtwork({ playerId, rivalId, eager = false, full = false }: { playerId: string; rivalId: string; eager?: boolean; full?: boolean }) {
  const player = playerMatById(playerId) ?? playerMatById(DEFAULT_PLAYER_MAT_ID)!;
  const rival = playerMatById(rivalId) ?? playerMatById(DEFAULT_PLAYER_MAT_ID)!;
  if (full || player.id === rival.id) return <PlayerMatArtwork mat={player} eager={eager}/>;
  return <><div className="player-mat-half player-mat-half--rival"><PlayerMatArtwork mat={rival} side="rival" eager={eager}/></div><div className="player-mat-half player-mat-half--player"><PlayerMatArtwork mat={player} eager={eager}/></div></>;
}
