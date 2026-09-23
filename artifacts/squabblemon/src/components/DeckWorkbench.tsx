import { crewInsights } from '@workspace/squabblemon-engine/insights';
import { useEffect, useRef, useState } from 'react';
import { CoachSpotlight } from './CoachSpotlight';
import { DrFadePortrait } from './DrFade';
import { ArrowLeft, ArrowRight, ChartNoAxesColumn, Check, ChevronDown, Crown, Pencil, Plus, Save, Search, Trash2, Undo2, X, Zap } from 'lucide-react';
import { DECK_SIZE, catalogCardById, getCardImage, validateSavedDeck } from '../data';
import { CardView } from './CardView';
import { CardPressTarget } from './CardInspection';
import { ArsenalScreen } from './venue/ArsenalScreen';
import { replaceDeckCard, workshopSuggestions, type DeckDraft } from '../lib/deckWorkshop';
import '../styles/deck-workshop.css';
import { trackEvent } from '../lib/analytics';
import { GangBackdrop } from './GangBackdrop';
import '../styles/gang-backdrop.css';
import { GameGlyph } from './venue/GameGlyph';

export function DeckWorkbench({ initial, ownedCardIds, equippedVariants, onSave, onTest, onDraftChange, onDirtyChange, lesson = false, onDelete, deleting = false, externalError = '', showBackdrop = true, subtitle }: {
  initial: DeckDraft; ownedCardIds: string[]; equippedVariants: Record<string, string>;
  onSave: (draft: DeckDraft) => Promise<void>; onTest: (draft: DeckDraft, focusCardId: string) => Promise<void>;
  onDraftChange?: (draft: DeckDraft) => void; onDirtyChange?: (dirty: boolean) => void; lesson?: boolean;
  onDelete?: () => Promise<void>; deleting?: boolean; externalError?: string; showBackdrop?: boolean; subtitle?: string;
}) {
  const [draft, setDraft] = useState<DeckDraft>(() => ({ ...initial, cardIds: [...initial.cardIds] }));
  const [savedDraft, setSavedDraft] = useState<DeckDraft>(() => ({ ...initial, cardIds: [...initial.cardIds] }));
  const [undo, setUndo] = useState<DeckDraft | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [guideStep, setGuideStep] = useState(0);
  const recruit = workshopSuggestions.find(idea => ownedCardIds.includes(idea.cardId) && !draft.cardIds.includes(idea.cardId))?.cardId ?? ownedCardIds.find(id => !draft.cardIds.includes(id));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [focusCard, setFocusCard] = useState(lesson ? initial.cardIds.find(id => workshopSuggestions.some(idea => idea.cardId === id)) ?? initial.heroCardId : initial.heroCardId);
  const searchInput = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLFieldSetElement>(null);
  const cardScrollRef = useRef<HTMLDivElement>(null);
  const browseRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLElement>(null);
  const insights = crewInsights(draft.cardIds);
  const legality = validateSavedDeck(draft.cardIds, ownedCardIds, draft.heroCardId);
  const owned = ownedCardIds.map(id => catalogCardById[id]).filter(Boolean);
  const visible = owned.filter(card => `${card.name} ${card.effect} ${card.type}`.toLowerCase().includes(search.toLowerCase())).sort((a,b) => a.cost - b.cost || a.name.localeCompare(b.name));
  const selected = slot === null ? null : catalogCardById[draft.cardIds[slot]];
  const dirty = draft.name !== savedDraft.name
    || draft.heroCardId !== savedDraft.heroCardId
    || draft.recipeId !== savedDraft.recipeId
    || draft.cardIds.length !== savedDraft.cardIds.length
    || draft.cardIds.some((id, index) => id !== savedDraft.cardIds[index]);

  useEffect(() => { onDraftChange?.(draft); }, [draft, onDraftChange]);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    const footer = actionsRef.current;
    const stage = footer?.closest<HTMLElement>('.deck-workbench');
    if (!footer || !stage) return;
    // Notices, errors, and narrow screens can all change the floating footer's height.
    const measure = () => stage.style.setProperty('--deck-actions-clearance', `calc(${Math.ceil(footer.getBoundingClientRect().height)}px + var(--deck-actions-gap, 20px))`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const body = bodyRef.current, scroller = cardScrollRef.current, browse = browseRef.current;
    if (!body || !scroller || !browse) return;
    let frame = 0;
    // Short landscape screens scroll the lineup too. Clip cards at the bottom
    // of the sticky controls rather than showing fragments behind the paper.
    const measure = () => {
      const clipped = getComputedStyle(scroller).overflowY === 'visible'
        ? Math.max(0, browse.getBoundingClientRect().bottom - scroller.getBoundingClientRect().top) : 0;
      scroller.style.setProperty('--deck-grid-clip-top', `${clipped}px`);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(body); observer.observe(scroller); observer.observe(browse);
    body.addEventListener('scroll', schedule, { passive: true });
    measure();
    return () => { observer.disconnect(); body.removeEventListener('scroll', schedule); cancelAnimationFrame(frame); };
  }, []);

  function choose(cardId: string) {
    if (draft.cardIds.includes(cardId)) { setSlot(draft.cardIds.indexOf(cardId)); return; }
    if (slot !== null && slot < draft.cardIds.length) {
      const old = catalogCardById[draft.cardIds[slot]];
      setUndo(draft); setDraft(replaceDeckCard(draft, slot, cardId));
      trackEvent('deck_card_replaced', { lesson, slot: slot + 1 });
      setNotice(`${catalogCardById[cardId].name} replaces ${old.name}.`);
    } else if (draft.cardIds.length < DECK_SIZE) {
      setUndo(draft); setDraft({ ...draft, cardIds: [...draft.cardIds, cardId], heroCardId: draft.heroCardId || cardId });
      setNotice(`${catalogCardById[cardId].name} added to your gang.`);
    } else { setNotice('Choose a crew card to replace first.'); return; }
    setFocusCard(cardId); setSlot(null); if (lesson) setGuideStep(2);
  }
  function moveSlot(direction: -1 | 1) {
    if (slot === null || slot + direction < 0 || slot + direction >= draft.cardIds.length) return;
    const next = [...draft.cardIds];
    [next[slot], next[slot + direction]] = [next[slot + direction], next[slot]];
    setUndo(draft); setDraft({ ...draft, cardIds: next }); setSlot(slot + direction);
    setNotice('Draw order updated.');
  }
  async function persist(test: boolean) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const next = { ...draft, name: draft.name.trim() || 'My Gang' };
      if (test) await onTest(next, next.cardIds.includes(focusCard) ? focusCard : next.heroCardId);
      else { await onSave(next); setDraft(next); setSavedDraft({ ...next, cardIds: [...next.cardIds] }); setNotice('Deck saved. Your lineup is ready.'); }
      trackEvent(test ? 'deck_test_started' : 'deck_saved', { lesson, cards: next.cardIds.length });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your deck. Please retry.'); }
    finally { setBusy(false); }
  }
  return <ArsenalScreen className="deck-workbench" label={lesson ? 'Build your first gang' : 'Deck builder'}>
    {showBackdrop && <GangBackdrop />}
    <header className="deck-workbench__header">
      {lesson && <DrFadePortrait pose="right" className="deck-workbench__coach-art" />}
      <div className="deck-workbench__title">
        <h1 className="sr-only">{lesson ? 'Your cards. Your call.' : 'Build your gang.'}</h1>
        <span className="venue-kicker">{lesson ? 'ROOKIE ROAD / MAKE IT YOURS' : 'THE LINEUP / DECK BUILDER'}</span>
        <label className="deck-workbench__name"><span className="sr-only">Deck name</span>
          <input aria-label="Deck name" maxLength={40} disabled={busy} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
          <Pencil size={14} aria-hidden="true" />
        </label>
        {(lesson || subtitle) && <p>{lesson ? 'Change one card. See what happens on the street.' : subtitle}</p>}
      </div>
      <div className="deck-workbench__header-tools"><span className="deck-workbench__count"><strong>{draft.cardIds.length}</strong>/ {DECK_SIZE}</span>
        {onDelete && <button type="button" className="arsenal-icon arsenal-danger" title="Delete deck" aria-label="Delete deck" disabled={busy || deleting} onClick={() => void onDelete()}><Trash2 size={16} aria-hidden="true" /></button>}
      </div>
    </header>
    <fieldset ref={bodyRef} disabled={busy} className="deck-workbench__body">
      <legend className="sr-only">Gang lineup and collection</legend>
      <div className="deck-workbench__lineup">
        <div className="deck-workbench__roster" data-testid="deck-roster-grid" aria-label="Your ten card lineup">
          {Array.from({ length: DECK_SIZE }, (_, index) => {
            const id = draft.cardIds[index];
            const card = catalogCardById[id];
            return <div key={id ?? `empty-${index}`} className={`deck-slot ${slot === index ? 'is-selected' : ''} ${card ? '' : 'deck-slot--empty'}`}>
              <span className="deck-slot__draw"><b>{String(index + 1).padStart(2, '0')}</b>{index < 5 ? 'Opening' : `Round ${index - 3}`}</span>
              {card ? <>
                <CardPressTarget onInspect={lesson ? () => {} : undefined} data-guide-slot={index} card={card} variantId={equippedVariants[id]} aria-label={`Replace ${card.name}`} aria-pressed={slot === index} onClick={() => { setSlot(slot === index ? null : index); if (lesson) setGuideStep(1); }}>
                  <CardView card={card} variantId={equippedVariants[id]} isBoard fillContainer presentationOnly disableLayout />
                </CardPressTarget>
                <button type="button" className="deck-slot__cover" title={draft.heroCardId === id ? 'Gang cover' : `Set ${card.name} as cover`}
                  aria-label={`Set ${card.name} as cover`} aria-pressed={draft.heroCardId === id}
                  onClick={() => { setUndo(draft); setDraft({ ...draft, heroCardId: id }); setNotice(`${card.name} is your gang cover.`); }}>
                  <Crown size={15} fill={draft.heroCardId === id ? 'currentColor' : 'none'} aria-hidden="true" />
                </button>
              </> : <button type="button" aria-label={`Add card to slot ${index + 1}`} onClick={() => { setSlot(null); searchInput.current?.focus(); searchInput.current?.scrollIntoView({ block: 'nearest' }); }}><Plus size={22} aria-hidden="true" /><span>Recruit</span></button>}
            </div>;
          })}
        </div>
        <details className="deck-workbench__tactics">
          <summary className="deck-workbench__readout"><span><Zap size={14} aria-hidden="true" />{insights.opening} opening plays at 2 Motion</span><span><ChartNoAxesColumn size={14} aria-hidden="true" />Tactics<ChevronDown className="deck-workbench__chevron" size={13} aria-hidden="true" /></span></summary>
          <div className="deck-workbench__tactics-content">
            <div className="deck-workbench__curve" aria-label="Motion cost curve">{insights.curve.map((count, i) => <span key={i} aria-label={`${i} Motion: ${count} cards`}><i aria-hidden="true"><b style={{ height: `${count / DECK_SIZE * 100}%` }} /></i><b>{i}</b></span>)}</div>
            <div><p>First five: your opening hand. Last five: draws in rounds 2 through 6.</p><ul>{insights.tips.map(tip => <li key={tip}>{tip}</li>)}</ul></div>
          </div>
        </details>
        {selected && slot !== null && <div className="deck-workbench__selection">
          <div><strong>Replacing {selected.name}</strong><p>{selected.effect}</p></div>
          <div className="deck-workbench__selection-tools">
            <button className="arsenal-icon" type="button" title="Move earlier" aria-label="Move earlier" disabled={slot === 0} onClick={() => moveSlot(-1)}><ArrowLeft size={16} /></button>
            <button className="arsenal-icon" type="button" title="Move later" aria-label="Move later" disabled={slot === draft.cardIds.length - 1} onClick={() => moveSlot(1)}><ArrowRight size={16} /></button>
            <button className="arsenal-icon arsenal-danger" type="button" title="Remove card" aria-label="Remove card" onClick={() => {
              setUndo(draft); const next = draft.cardIds.filter((_, i) => i !== slot);
              setDraft({ ...draft, cardIds: next, heroCardId: draft.heroCardId === selected.catalogId ? next[0] ?? '' : draft.heroCardId });
              setSlot(null); setNotice(`${selected.name} removed. Choose a new recruit.`);
            }}><Trash2 size={16} /></button>
            <button className="arsenal-icon" type="button" title="Cancel replacement" aria-label="Cancel replacement" onClick={() => setSlot(null)}><X size={16} /></button>
          </div>
        </div>}
      </div>
      <div className="deck-workbench__library">
        {lesson && <details className="deck-workbench__ideas"><summary>Dr. Fade’s suggestions</summary><div>
          {workshopSuggestions.filter(idea => ownedCardIds.includes(idea.cardId)).map(idea => <button type="button" key={idea.cardId} onClick={() => choose(idea.cardId)} aria-label={`Try ${catalogCardById[idea.cardId].name}`}>
            <img src={getCardImage(idea.cardId)} alt="" /><div><strong>{idea.title}</strong><span>{catalogCardById[idea.cardId].name}</span><p>{idea.detail}</p></div>
          </button>)}
        </div></details>}
        <div ref={browseRef} className="deck-workbench__browse"><h2>Recruit from collection <small>{visible.length} / {owned.length}</small></h2>
          <label className="arsenal-search"><Search aria-hidden="true" /><span className="sr-only">Browse your collection</span><input ref={searchInput} aria-label="Browse your collection" type="search" placeholder="Name, ability, or type…" value={search} onChange={e => setSearch(e.target.value)} /></label>
        </div>
        <div ref={cardScrollRef} className="deck-workbench__card-scroll">
        <div className="deck-workbench__collection" data-testid="deck-collection-grid">{visible.map(card => <CardPressTarget onInspect={lesson ? () => {} : undefined} data-guide-recruit={card.catalogId} card={card} variantId={equippedVariants[card.catalogId]} key={card.catalogId} onClick={() => choose(card.catalogId)} aria-label={`${draft.cardIds.includes(card.catalogId) ? 'Select' : 'Add'} ${card.name}`}>
          <CardView card={card} variantId={equippedVariants[card.catalogId]} isBoard fillContainer presentationOnly disableLayout />
          {draft.cardIds.includes(card.catalogId) && <span className="deck-workbench__in-crew" title="In your gang"><Check size={14} aria-hidden="true" /><span className="sr-only">In your gang</span></span>}
        </CardPressTarget>)}</div>
        {!visible.length && <div className="arsenal-empty"><Search size={24} /><p>No matching cards. Try another name or ability.</p><button className="arsenal-link" onClick={() => setSearch('')}>Clear search</button></div>}
        {!legality.valid && <ul className="deck-workbench__issues">{legality.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
        </div>
      </div>
    </fieldset>
    <footer ref={actionsRef} className="deck-workbench__actions">
      <div className="deck-workbench__notice"><span role="status">{notice || (selected ? 'Choose a recruit to replace this card.' : 'Tap to edit your lineup. Hold any card for details.')}</span>
        {undo && <button type="button" className="arsenal-link" disabled={busy} onClick={() => { setDraft(undo); setUndo(null); setSlot(null); setNotice('Last change undone.'); }}><Undo2 size={13} />Undo last change</button>}
        {(error || externalError) && <p role="alert">{error || externalError}</p>}
      </div>
      <div className="deck-workbench__action-buttons">
        {lesson ? <>
          <button className="arsenal-link deck-workbench__test" disabled={busy} onClick={() => void persist(false)}><Save size={16} aria-hidden="true" />Save deck</button>
          <button data-guide-save="true" className="arsenal-action deck-workbench__save" disabled={busy || !legality.valid} onClick={() => void persist(true)}><GameGlyph name="fight" />{busy ? 'Saving…' : 'Save & start lesson'}</button>
        </> : <>
          <button className="arsenal-link deck-workbench__test" disabled={busy || !legality.valid} title="Save changes and test this deck" onClick={() => void persist(true)}><GameGlyph name="fight" />Test deck</button>
          <button data-guide-save="true" className="arsenal-action deck-workbench__save" disabled={busy} onClick={() => void persist(false)}><Save size={19} aria-hidden="true" />{busy ? 'Saving…' : 'Save deck'}</button>
        </>}
      </div>
    </footer>
    {lesson && !busy && <CoachSpotlight target={guideStep === 0 ? '[data-guide-slot="5"]' : guideStep === 1 ? '[data-guide-recruit="' + recruit + '"]' : '[data-guide-save="true"]'} step={'YOUR GANG ' + (guideStep + 1) + ' / 3'} title={guideStep === 0 ? 'Ten cards make a deck.' : guideStep === 1 ? 'Choose a new recruit.' : 'Your gang is ready.'}>{error && <strong>{error} Tap the highlighted save button to try again. </strong>}{guideStep === 0 ? 'These ten cards are your battle lineup. The first five are your opening hand. Tap the highlighted sixth slot to change a later draw.' : guideStep === 1 ? 'Tap ' + catalogCardById[recruit ?? '']?.name + '. The number at the top is its Motion cost; Hands is the strength it adds to a district. This card replaces your selected slot.' : 'You made your first swap. Save your gang and take it into a guided match. I’ll point to every move.'}</CoachSpotlight>}
  </ArsenalScreen>;
}
