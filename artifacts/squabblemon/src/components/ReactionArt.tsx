import { reactionById, type ReactionId } from '@workspace/squabblemon-engine/reactions';
import { getAssetUrl } from '../lib/assets';

export function ReactionArt({ id, still = false }: { id: ReactionId; still?: boolean }) {
  const reaction = reactionById(id)!;
  return <img src={getAssetUrl(still ? reaction.poster : reaction.animatedWebp ?? reaction.gif)} alt={reaction.name} draggable={false} />;
}
