import { useMutation } from '@tanstack/react-query';
import { savePlayerDeck, deletePlayerDeck, type PlayerBootstrap, type SaveDeckInput } from '@workspace/api-client-react';
import { e2eAuthEnabled } from './auth';
import { updatePreviewDeck } from './previewDecks';

export function useDeckPersistence(bootstrap: PlayerBootstrap) {
  const preview = e2eAuthEnabled && bootstrap.profile.id === 'e2e-player';
  const save = useMutation({ mutationFn: async ({ deckId, data }: { deckId: string; data: SaveDeckInput }) =>
    preview ? updatePreviewDeck(bootstrap, deckId, data) : savePlayerDeck(deckId, data) });
  const remove = useMutation({ mutationFn: async ({ deckId }: { deckId: string }) =>
    preview ? updatePreviewDeck(bootstrap, deckId, null) : deletePlayerDeck(deckId) });
  return { save, remove, preview };
}
