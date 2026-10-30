import { presentCardForm } from '../lib/cardFormPresentation';
import React, { memo, useEffect, useMemo, useRef } from 'react';
import { CardView, type CollectibleCardLayers } from './CardView';
import { CardRarityStamp } from './CardRarityStamp';
import { getCardRarity } from './CardRarityTreatment';
import '../styles/collectible-card.css';
import '../styles/collectible-layers.css';
import '../styles/collectible-foil.css';
import { collectibleElementArtwork } from '../lib/collectiblePrintAssets';
import { anunakiCardScene } from '../lib/anunakiCardArt';

type Props = React.ComponentProps<typeof CardView> & { foil?: boolean; showRules?: boolean };
export function collectibleCardLayers(card: Props['card'], foil = true, showRules = true): CollectibleCardLayers {
  const images = collectibleElementArtwork(card);
  const { element } = images;
  const isBlockbuster = card.kind === 'blockbuster';
  const anunakiScene = !isBlockbuster ? anunakiCardScene(card) : undefined;
  return {
    foil,
    backdrop: <>
      {!isBlockbuster && <div className="layered-print" aria-hidden="true"><img src={images.plate} alt="" draggable={false} decoding="async" /></div>}
      {anunakiScene && <div className="layered-anunaki-scene" data-anunaki-scene="true" aria-hidden="true"><img src={anunakiScene} alt="" draggable={false} decoding="async" /><span /></div>}
      <div className="layered-material" data-element={isBlockbuster ? undefined : element} aria-hidden="true"><span className="layered-stock"/><span className="layered-reflection"/></div>
      <span className="layered-rarity-rim" aria-hidden="true"/>
    </>,
    name: <><span className="postal-foil" aria-hidden="true"/><CardRarityStamp rarity={getCardRarity('cardId' in card ? card.cardId : card.id, card.kind)} compact/></>,
    copy: <>
      <span className="layered-element" role="img" aria-label={element}><img src={images.fist} alt="" draggable={false} decoding="async" /></span>
      {showRules && <div className="layered-rules"><strong>{card.ability}</strong><p>{card.effect}</p></div>}
    </>,
  };
}
const labelWidths = new Map<string, number>();
let typeReady: Promise<FontFace[]> | undefined;
/** Approved print composition, explicitly chosen by collection/deck/detail callers.
 * CardView still rejects layers on battle hand and combat faces. */
export const CollectibleCard = memo(function CollectibleCard({ foil = true, showRules = true, ...props }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const layers = useMemo(() => collectibleCardLayers(presentCardForm(props.card), foil, showRules), [props.card, foil, showRules]);
  const name = props.card.name;
  useEffect(() => {
    let disposed = false;
    if (name.length > 10) return;
    typeReady ??= document.fonts.load('100px Blzee');
    void typeReady.then(() => {
      if (disposed || !host.current) return;
      const context = document.createElement('canvas').getContext('2d');
      if (!context) return;
      context.font = '100px Blzee';
      const ink = (value: string) => {
        const key = value.toUpperCase();
        if (!labelWidths.has(key)) {
          const m = context.measureText(key);
          labelWidths.set(key, m.actualBoundingBoxLeft + m.actualBoundingBoxRight);
        }
        return labelWidths.get(key)!;
      };
      const delta = (ink(name) - ink('FOLKS')) * .097;
      host.current.style.setProperty('--postal-label-min', `${(delta > -4 ? 52 : Math.max(39,52+delta)).toFixed(2)}cqw`);
    }).catch(() => {});
    return () => { disposed = true; host.current?.style.removeProperty('--postal-label-min'); };
  }, [name]);
  return <div ref={host} className="collectible-print" data-name-tag-short={name.length <= 10}><CardView {...props} collectibleLayers={layers}/></div>;
});
