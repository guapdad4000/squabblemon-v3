import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { equipPlayerCosmetics, getGetPlayerBootstrapQueryKey, type PlayerBootstrap } from '@workspace/api-client-react';
import { EARNED_DECK_COVERS, equippedDeckCover } from '@workspace/squabblemon-engine/cosmetics';
/** Existing server-validated cosmetic loadout; the profile is never granted by this control. */
export function EarnedDeckCoverSelector({profile}:{profile:PlayerBootstrap['profile']}) {
  const client=useQueryClient();
  const alive=useRef(true);
  const locked=useRef(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const covers=EARNED_DECK_COVERS.filter(cover=>profile.unlockedCosmeticIds.includes(cover.id));
  const cover=equippedDeckCover(profile);
  async function changeCover(id:string) {
    if(locked.current)return;
    locked.current=true;setBusy(true);setMessage('');
    try {
      const next=await equipPlayerCosmetics({...profile.settings.cosmetics,deckCoverId:id || null});
      if(!alive.current)return;
      const current=client.getQueryData<PlayerBootstrap>(getGetPlayerBootstrapQueryKey());
      if(current?.profile.id !== profile.id)return;
      client.setQueryData(getGetPlayerBootstrapQueryKey(),next);
      setMessage(id ? 'Earned cover equipped.' : 'Character covers restored.');
    } catch(cause) {if(alive.current)setMessage(cause instanceof Error ? cause.message : 'Could not save your cover. Try again.');}
    finally {locked.current=false;if(alive.current)setBusy(false);}
  }
  return <label className="deck-workbench__earned-cover"><span>Earned cover · all decks</span><select aria-label="Earned deck cover" value={cover?.id ?? ''} disabled={busy} onChange={event=>void changeCover(event.target.value)}><option value="">Character cover</option>{covers.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>{message && <span role="status">{message}</span>}</label>;
}
