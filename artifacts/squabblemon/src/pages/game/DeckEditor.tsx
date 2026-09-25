import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { PlayerBootstrap, getGetPlayerBootstrapQueryKey } from '@workspace/api-client-react';
import { useDeckPersistence } from '../../lib/useDeckPersistence';
import { useQueryClient } from '@tanstack/react-query';
import { starterRecipes } from '../../data';
import { DeckWorkbench } from '../../components/DeckWorkbench';
import type { DeckDraft } from '../../lib/deckWorkshop';
import { PageDecor } from '../../components/venue/PageDecor';
import { getDeckSelectionStorage, persistDeckSelection } from '../../lib/deckSelection';
import { deckEditorPath, decksPath, deckTestPath } from '../../lib/deckJourney';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { runWithoutDeckExitGuard, setDeckExitGuard } from '../../lib/deckExitGuard';
import { GangBackdrop } from '../../components/GangBackdrop';

export function DeckEditor({ bootstrap }: { bootstrap: PlayerBootstrap }) {
  const { deckId = '' } = useParams();
  const [, setLocation] = useLocation();
  const { save, remove } = useDeckPersistence(bootstrap);
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const draftRef = useRef<DeckDraft | null>(null);
  const pendingExit = useRef<null | { proceed: () => void; stay: () => void }>(null);
  const recipe = starterRecipes.find(item => item.id === deckId);
  const saved = bootstrap.profile.savedDecks.find(item => item.id === deckId);
  const initial = saved ?? (recipe ? { name: recipe.name, cardIds: recipe.catalogCardIds, heroCardId: recipe.hero, recipeId: recipe.id } : null);
  async function persist(draft: DeckDraft) {
    const id = recipe ? crypto.randomUUID() : deckId;
    const res = await save.mutateAsync({ deckId: id, data: draft });
    queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), res);
    persistDeckSelection(bootstrap.profile.id, id, res.profile.savedDecks.map(deck => deck.id), getDeckSelectionStorage());
    return id;
  }

  const requestExit = useCallback((proceed: () => void, stay = () => {}) => {
    if (!dirty) { proceed(); return; }
    pendingExit.current = {
      proceed: () => runWithoutDeckExitGuard(proceed),
      stay,
    };
    setLeaveOpen(true);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', beforeUnload);
    const clearFallbackGuard = setDeckExitGuard(requestExit);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      clearFallbackGuard();
    };
  }, [dirty, requestExit]);

  if (!initial) return <div className="p-6 text-white"><p>Deck not found.</p></div>;
  return <div className="deck-editor-screen world-decor-host">
    <GangBackdrop />
    <PageDecor theme="crew" />
    <DeckWorkbench key={`${bootstrap.profile.id}:${deckId}`} initial={initial} ownedCardIds={bootstrap.profile.ownedCardIds} equippedVariants={bootstrap.profile.equippedVariants}
      showBackdrop={false} externalError={error} deleting={remove.isPending}
      subtitle={recipe ? 'Learning example · save to make it yours' : undefined}
      onDelete={saved ? async () => {
        if (!window.confirm('Delete this saved deck? Your cards stay in your collection.')) return;
        try {
          const res = await remove.mutateAsync({ deckId });
          queryClient.setQueryData(getGetPlayerBootstrapQueryKey(), res);
          setDirty(false);
          runWithoutDeckExitGuard(() => setLocation(decksPath(), { replace: true }));
        }
        catch { setError('Could not delete your deck. Please retry.'); }
      } : undefined}
      onDraftChange={draft => { draftRef.current = draft; }}
      onDirtyChange={setDirty}
      onSave={async draft => {
        const id = await persist(draft);
        setDirty(false);
        if (recipe) runWithoutDeckExitGuard(() => setLocation(deckEditorPath(id), { replace: true }));
      }}
      onTest={async draft => {
        const id = await persist(draft);
        setDirty(false);
        if (recipe) {
          runWithoutDeckExitGuard(() => setLocation(deckEditorPath(id), { replace: true }));
          window.setTimeout(() => runWithoutDeckExitGuard(() => setLocation(deckTestPath(id))), 0);
        } else {
          runWithoutDeckExitGuard(() => setLocation(deckTestPath(id)));
        }
      }} />
    <AlertDialog open={leaveOpen} onOpenChange={open => { if (!open && !leaveBusy) { pendingExit.current?.stay(); pendingExit.current = null; setLeaveOpen(false); } }}>
      <AlertDialogContent className="border-[#9d8253] bg-[#101313] text-white">
        <AlertDialogHeader>
          <AlertDialogTitle>Save your deck changes?</AlertDialogTitle>
          <AlertDialogDescription className="text-white/70">Your lineup changed since the last save. Save it, discard the changes, or stay here.</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p role="alert" className="venue-error">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={leaveBusy} onClick={() => { pendingExit.current?.stay(); pendingExit.current = null; }}>Stay here</AlertDialogCancel>
          <AlertDialogAction disabled={leaveBusy} className="bg-rose-800 text-white hover:bg-rose-700" onClick={() => {
            const exit = pendingExit.current; pendingExit.current = null; setDirty(false); setLeaveOpen(false); exit?.proceed();
          }}>Discard changes</AlertDialogAction>
          <AlertDialogAction disabled={leaveBusy} className="bg-[#efce87] text-black hover:bg-[#ffe2a6]" onClick={async event => {
            event.preventDefault();
            if (!draftRef.current) return;
            setLeaveBusy(true); setError('');
            try {
              await persist(draftRef.current);
              setDirty(false); setLeaveOpen(false);
              const exit = pendingExit.current; pendingExit.current = null;
              exit?.proceed();
            } catch { setError('Could not save your deck. Please retry.'); }
            finally { setLeaveBusy(false); }
          }}>{leaveBusy ? 'Saving…' : 'Save and leave'}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
