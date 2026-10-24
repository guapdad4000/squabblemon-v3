import { presentCardForm } from '../lib/cardFormPresentation';
import React, { memo, useEffect, useMemo, useRef } from 'react';
import { CardView, type CollectibleCardLayers } from './CardView';
import { CardRarityStamp } from './CardRarityStamp';
import { getCardRarity } from './CardRarityTreatment';
import '../styles/collectible-card.css';
import '../styles/collectible-layers.css';
import '../styles/collectible-foil.css';
import normalPlate from '../assets/collector-v2/normal-plate.webp';
import normalFist from '../assets/collector-v2/normal-fist.webp';
import firePlate from '../assets/collector-v2/fire-plate.webp';
import fireFist from '../assets/collector-v2/fire-fist.webp';
import waterPlate from '../assets/collector-v2/water-plate.webp';
import waterFist from '../assets/collector-v2/water-fist.webp';
import plantPlate from '../assets/collector-v2/plant-plate.webp';
import plantFist from '../assets/collector-v2/plant-fist.webp';
import airPlate from '../assets/collector-v2/air-plate.webp';
import airFist from '../assets/collector-v2/air-fist.webp';
import electricPlate from '../assets/collector-v2/electric-plate.webp';
import electricFist from '../assets/collector-v2/electric-fist.webp';
import poisonPlate from '../assets/collector-v2/poison-plate.webp';
import poisonFist from '../assets/collector-v2/poison-fist.webp';
import lightPlate from '../assets/collector-v2/light-plate.webp';
import lightFist from '../assets/collector-v2/light-fist.webp';
import darkPlate from '../assets/collector-v2/dark-plate.webp';
import darkFist from '../assets/collector-v2/dark-fist.webp';
import earthPlate from '../assets/collector-v2/earth-plate.webp';
import earthFist from '../assets/collector-v2/earth-fist.webp';

type Props = React.ComponentProps<typeof CardView> & { foil?: boolean; showRules?: boolean };
const art: Record<string, { plate: string; fist: string }> = {
  Normal: { plate: normalPlate, fist: normalFist },
  Fire: { plate: firePlate, fist: fireFist },
  Water: { plate: waterPlate, fist: waterFist },
  Plant: { plate: plantPlate, fist: plantFist },
  Air: { plate: airPlate, fist: airFist },
  Electric: { plate: electricPlate, fist: electricFist },
  Poison: { plate: poisonPlate, fist: poisonFist },
  Light: { plate: lightPlate, fist: lightFist },
  Dark: { plate: darkPlate, fist: darkFist },
  Earth: { plate: earthPlate, fist: earthFist },
};
export function collectibleCardLayers(card: Props['card'], foil = true, showRules = true): CollectibleCardLayers {
  const element = card.type === 'Rock' ? 'Earth' : card.type;
  const images = art[element] ?? art.Normal;
  const isBlockbuster = card.kind === 'blockbuster';
  return {
    foil,
    backdrop: <>
      {!isBlockbuster && <div className="layered-print" aria-hidden="true"><img src={images.plate} alt="" draggable={false} decoding="async" /></div>}
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
