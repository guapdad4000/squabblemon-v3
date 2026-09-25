import useEmblaCarousel from 'embla-carousel-react';
import { Check, ChevronLeft, ChevronRight, Layers, Pencil } from 'lucide-react';
import { useCallback, useEffect, useId, useRef } from 'react';
import { catalogCardById, getCardImage } from '../data';
import { styleSetFor } from '@workspace/squabblemon-engine/cosmetics';
import { getAssetUrl } from '../lib/assets';
import '../styles/deck-carousel.css';

export interface DeckCarouselItem {
  id: string;
  name: string;
  heroCardId: string;
  cardIds: string[];
  subtitle?: string;
  valid?: boolean;
}

interface DeckCarouselProps {
  decks: DeckCarouselItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  disabled?: boolean;
  label?: string;
  openLabel?: string;
}

function reducedMotionRequested() {
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.dataset.reduceMotion === 'true' ||
    document.documentElement.dataset.reducedMotion === 'true'
  );
}

function DeckBox({
  name,
  heroCardId,
  active,
}: {
  name: string;
  heroCardId: string;
  active: boolean;
}) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const cover = styleSetFor(heroCardId)?.deckCover;
  const image = cover ? getAssetUrl(cover) : heroCardId ? getCardImage(heroCardId) : null;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !active) return;

    let disposed = false;
    let generation = 0;
    let visible = false;
    let lastReduced: boolean | undefined;
    let disposeScene: (() => void) | undefined;

    const update = () => {
      const reduced = reducedMotionRequested();
      if (reduced === lastReduced && host.dataset.visible === String(visible)) return;
      lastReduced = reduced;
      host.dataset.visible = String(visible);
      const nextGeneration = ++generation;
      disposeScene?.();
      disposeScene = undefined;
      delete host.dataset.rendered;
      if (reduced || !visible) return;

      import('./decks/deckBoxScene')
        .then(({ mountDeckBox }) => {
          if (!disposed && nextGeneration === generation) {
            disposeScene = mountDeckBox(host, {
              name,
              image,
              fullCover: !!cover,
            });
          }
        })
        .catch(() => {});
    };

    const intersection = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      update();
    });
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mutation = new MutationObserver(update);
    intersection.observe(host);
    motion.addEventListener('change', update);
    mutation.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-reduce-motion', 'data-reduced-motion'],
    });

    return () => {
      disposed = true;
      generation += 1;
      disposeScene?.();
      delete host.dataset.rendered;
      intersection.disconnect();
      mutation.disconnect();
      motion.removeEventListener('change', update);
    };
  }, [active, name, image, cover]);

  return (
    <span className="deck-box" ref={hostRef} aria-hidden="true">
      <span className="deck-box__shadow" />
      <span className="deck-box__print">
        <span className="deck-box__spine">SQUABBLEMON · THE LINEUP</span>
        <span className={'deck-box__face' + (cover ? ' deck-box__face--artwork' : '')}>
          {!cover && <span className="deck-box__brand">
            SM
            <span>SQUABBLEMON</span>
          </span>}
          {image && <img src={image} alt="" loading={active ? 'eager' : 'lazy'} draggable={false} />}
          {!cover && <span className="deck-box__title">
            {name}
            <small>COLLECT. BUILD. SQUABBLE.</small>
          </span>}
        </span>
      </span>
    </span>
  );
}

export function DeckCarousel({
  decks,
  selectedId,
  onSelect,
  onOpen,
  disabled = false,
  label = 'Choose your deck',
  openLabel = 'Edit deck',
}: DeckCarouselProps) {
  const selectedIndex = Math.max(0, decks.findIndex((deck) => deck.id === selectedId));
  const initialIndex = useRef(selectedIndex).current;
  const [viewportRef, api] = useEmblaCarousel({
    align: 'center',
    containScroll: 'trimSnaps',
    startIndex: initialIndex,
    watchDrag: !disabled,
    duration: 22,
  });
  const selectId = useId();
  const latest = useRef({ decks, onSelect, disabled, index: selectedIndex });
  latest.current = { decks, onSelect, disabled, index: selectedIndex };

  const syncSelection = useCallback(() => {
    if (!api || latest.current.disabled) return;
    const deck = latest.current.decks[api.selectedScrollSnap()];
    if (deck) latest.current.onSelect(deck.id);
  }, [api]);

  useEffect(() => {
    if (!api) return;
    const reset = () => api.scrollTo(latest.current.index, true);
    api.on('select', syncSelection).on('reInit', reset);
    return () => {
      api.off('select', syncSelection).off('reInit', reset);
    };
  }, [api, syncSelection]);

  useEffect(() => {
    if (api && api.selectedScrollSnap() !== selectedIndex) {
      api.scrollTo(selectedIndex, reducedMotionRequested());
    }
  }, [api, selectedIndex, decks.length]);

  const selectIndex = (index: number) => {
    if (!disabled && decks[index]) onSelect(decks[index].id);
  };

  if (!decks.length) return null;

  return (
    <section
      className="deck-carousel"
      aria-label={label}
      aria-roledescription="carousel"
      data-testid="deck-carousel"
      data-selected-deck={decks[selectedIndex].id}
    >
      <div className="deck-carousel__bar">
        <label htmlFor={selectId}>
          <Layers size={14} aria-hidden="true" /> {label}
        </label>
        <span className="deck-carousel__count" aria-live="polite" aria-atomic="true">
          {String(selectedIndex + 1).padStart(2, '0')} <span>/ {String(decks.length).padStart(2, '0')}</span>
        </span>
      </div>
      <div
        className="deck-carousel__viewport"
        ref={viewportRef}
        tabIndex={0}
        aria-label="Decks. Use left and right arrow keys to browse."
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          const next =
            event.key === 'ArrowRight'
              ? selectedIndex + 1
              : event.key === 'ArrowLeft'
                ? selectedIndex - 1
                : event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? decks.length - 1
                    : null;
          if (next !== null) {
            event.preventDefault();
            selectIndex(next);
          }
        }}
      >
        <div className="deck-carousel__track">
          {decks.map((deck, index) => {
            const active = index === selectedIndex;
            const hero = catalogCardById[deck.heroCardId];
            return (
              <div
                className="deck-carousel__slide"
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${decks.length}: ${deck.name}`}
                aria-hidden={!active}
                inert={!active}
                key={deck.id}
              >
                <button
                  type="button"
                  className="deck-carousel__cover"
                  data-testid="deck-cover"
                  tabIndex={active ? 0 : -1}
                  disabled={disabled}
                  aria-label={`${openLabel}: ${deck.name}`}
                  onClick={() => onOpen(deck.id)}
                >
                  <DeckBox name={deck.name} heroCardId={deck.heroCardId} active={active} />
                </button>
                <div className="deck-carousel__copy">
                  <span className="deck-carousel__eyebrow">{deck.subtitle ?? 'YOUR PERSONAL LINEUP'}</span>
                  <h3>{deck.name}</h3>
                  <p className="deck-carousel__hero">{hero ? `Led by ${hero.name}` : 'Choose your cover card'}</p>
                  <div className="deck-carousel__status">
                    <span>{deck.cardIds.length} / 10 cards</span>
                    <span className={deck.valid === false ? 'is-incomplete' : ''}>
                      {deck.valid === false ? (
                        'Needs attention'
                      ) : (
                        <>
                          <Check size={12} /> Battle ready
                        </>
                      )}
                    </span>
                  </div>
                  <div className="deck-carousel__lineup" aria-label="Cards in this deck">
                    {active &&
                      deck.cardIds.map((cardId, cardIndex) => (
                        <img
                          src={getCardImage(cardId)}
                          alt={catalogCardById[cardId]?.name ?? cardId}
                          title={catalogCardById[cardId]?.name ?? cardId}
                          loading="lazy"
                          draggable={false}
                          key={`${cardId}:${cardIndex}`}
                        />
                      ))}
                  </div>
                  <button
                    type="button"
                    className="deck-carousel__edit"
                    tabIndex={active ? 0 : -1}
                    disabled={disabled}
                    onClick={() => onOpen(deck.id)}
                  >
                    <Pencil size={13} aria-hidden="true" />
                    {openLabel}
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="deck-carousel__navigation">
        <button type="button" aria-label="Previous deck" disabled={disabled || selectedIndex === 0} onClick={() => selectIndex(selectedIndex - 1)}>
          <ChevronLeft size={18} />
        </button>
        <div className="deck-carousel__jump">
          <select id={selectId} aria-label="Jump to deck" value={decks[selectedIndex].id} disabled={disabled} onChange={(event) => onSelect(event.target.value)}>
            {decks.map((deck, index) => (
              <option value={deck.id} key={deck.id}>
                {index + 1}. {deck.name}
              </option>
            ))}
          </select>
          <span aria-hidden="true">{decks.length > 1 ? 'SWIPE TO CHANGE · TAP DECK TO OPEN' : 'TAP YOUR DECK TO OPEN'}</span>
        </div>
        <button type="button" aria-label="Next deck" disabled={disabled || selectedIndex === decks.length - 1} onClick={() => selectIndex(selectedIndex + 1)}>
          <ChevronRight size={18} />
        </button>
      </div>
    </section>
  );
}
