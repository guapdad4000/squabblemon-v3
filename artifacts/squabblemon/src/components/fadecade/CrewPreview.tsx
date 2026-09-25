import { getCardImage, type Deck } from '../../data';

export function CrewPreview({ crew }: { crew?: Deck }) {
  if (!crew) return null;
  return <div className="challenge-crew-preview" aria-label={`${crew.name}: ${crew.cards.length} cards`}>
    <div><span>YOUR LINEUP</span><strong>{crew.name}</strong><small>{crew.cards.length} cards</small></div>
    <div className="challenge-crew-cards" aria-hidden="true">
      {crew.cards.map((id, index) => <img key={`${id}-${index}`} src={getCardImage(id)} alt="" loading="lazy" />)}
    </div>
  </div>;
}
