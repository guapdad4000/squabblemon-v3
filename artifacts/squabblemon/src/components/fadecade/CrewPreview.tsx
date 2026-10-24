import { cards, catalogCardById, getCardImage, type Deck } from '../../data';
import { CollectibleCard } from '../CollectibleCard';

export function CrewPreview({ crew }: { crew?: Deck }) {
  if (!crew) return null;
  return <div className="challenge-crew-preview" aria-label={`${crew.name}: ${crew.cards.length} cards`}>
    <div><span>YOUR LINEUP</span><strong>{crew.name}</strong><small>{crew.cards.length} cards</small></div>
    <div className="challenge-crew-cards">
      {crew.cards.map((id, index) => {
        const card = cards[id] ?? catalogCardById[id];
        return <div className="challenge-crew-card" key={`${id}-${index}`}>
          {card ? <CollectibleCard card={card} fillContainer isBoard presentationOnly disableLayout
            showRules={false} foil={false} testId={`training-lineup-${index}`} className="w-full h-full" />
            : <img src={getCardImage(id)} alt={id} loading="lazy" />}
        </div>;
      })}
    </div>
  </div>;
}
