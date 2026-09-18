import { MusicControls } from './MusicControls';
import { motion } from 'framer-motion';
import { CardPressTarget } from './CardInspection';
import { getCrewScenery } from '../lib/cardFinish';
import { cards, catalogCardByEngineId, decks, getCardImage, CARD_RARITY_DEFINITIONS } from '../data';
import { CardVariantTreatment, getEquippedVariant, getVariantKind } from './CardVariantTreatment';
import { CardRarityTreatment, getRarityClass } from './CardRarityTreatment';
import { selectTrainingRival, trainingDifficulty, TRAINING_REWARD_RULES } from '@workspace/squabblemon-engine/training';

export function Lobby({ onStart, deckId, setDeckId, rival, setRival, onShowRules, onInspect, isLoading, onExit, availableDeckIds, equippedVariants, cardProgression = {} }: any) {
  const selectedDeck = decks.find(d => d.id === deckId)!;
  const availableDecks = availableDeckIds
    ? decks.filter((deck) => availableDeckIds.includes(deck.id))
    : decks;
  const recommendedRival = selectTrainingRival(selectedDeck.id, selectedDeck.cards, cardProgression);
  const rivalDeck = decks.find((deck) => deck.id === recommendedRival)!;
  const difficulty = trainingDifficulty(selectedDeck.id, recommendedRival, selectedDeck.cards, cardProgression);
  
  return (
    <div className="flex-1 min-h-0 min-w-0 grid grid-cols-[minmax(0,1fr)] grid-rows-[minmax(210px,1fr)_auto_auto] md:grid-cols-[minmax(0,1.12fr)_minmax(420px,0.88fr)] md:grid-rows-[1fr_auto] w-full max-w-full overflow-hidden relative bg-[#070707]">
      <div className="absolute top-4 left-4 right-4 z-50 flex items-center justify-between">
        <button aria-label="Leave practice" onClick={onExit} className="w-10 h-10 bg-black/50 border border-white/20 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 backdrop-blur-md rounded-full">
           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <MusicControls className="music-lobby" />
      </div>

      <div className="relative min-h-0 overflow-hidden md:row-span-2">
        <img key={`scene-${selectedDeck.id}`} src={getCrewScenery(selectedDeck.id)} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_35%,rgba(250,204,21,0.12),transparent_48%)]" />
        <motion.img
          key={selectedDeck.id}
          initial={{ opacity: 0, x: 30, scale: 1.06 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          src={getCardImage(selectedDeck.hero)}
          alt=""
          aria-hidden="true"
          className={`absolute right-[-3%] bottom-[-9%] w-[74%] h-[112%] md:right-[-1%] md:bottom-[-5%] md:w-[82%] md:h-[96%] object-contain object-bottom drop-shadow-[0_22px_28px_rgba(0,0,0,0.9)] variant-portrait-${getVariantKind(getEquippedVariant(equippedVariants, selectedDeck.hero)) ?? 'base'}`}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/15 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/45" />

        <div className="relative z-10 h-full flex flex-col p-4 md:p-10 pointer-events-none">
          <div className="ml-12 md:ml-0">
            <div className="font-display font-black italic text-3xl md:text-7xl leading-[0.82] tracking-tighter uppercase">
              XP <span className="text-primary">Training</span>
            </div>
            <div className="mt-1.5 font-mono text-[8px] md:text-xs tracking-[0.26em] text-primary uppercase">Low pressure // Level owned cards</div>
          </div>

          <motion.div
            key={`crew-${selectedDeck.id}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-auto max-w-[78%] md:max-w-xl"
          >
            <div className="font-mono text-[8px] md:text-xs text-primary tracking-[0.2em] uppercase">[{selectedDeck.accent}] // {selectedDeck.archetype}</div>
            <h1 className="mt-1 font-display font-black italic text-3xl md:text-6xl leading-none uppercase drop-shadow-[0_4px_0_#000]">{selectedDeck.name}</h1>
            <p className="hidden md:block mt-3 text-sm text-white/55 max-w-md">{selectedDeck.plan}</p>
          </motion.div>
        </div>
      </div>

      <div className="relative z-20 min-h-0 min-w-0 w-full overflow-hidden bg-black/88 border-y md:border-y-0 md:border-l border-white/10 p-3 md:p-6 md:pb-3 flex flex-col">
        <div className="flex items-center justify-between mb-2.5">
          <span className="font-mono text-[9px] md:text-xs tracking-[0.18em] text-white/55 uppercase">Select crew</span>
          <span className="font-mono text-[8px] md:text-[10px] text-primary uppercase">Swipe roster</span>
        </div>

        <div className="flex min-w-0 w-full md:grid md:grid-cols-2 gap-2 overflow-x-auto md:overflow-y-auto hide-scrollbar snap-x snap-mandatory pb-1 md:pb-2">
          {availableDecks.map(d => {
            const isSelected = d.id === deckId;
            const heroRarity = catalogCardByEngineId[d.cards.find(id => cards[id].id === d.hero) ?? d.cards[0]].rarity;
            return (
              <button
                key={d.id}
                data-testid={`deck-${d.id}`}
                aria-pressed={isSelected}
                onClick={() => {
                  setDeckId(d.id);
                  if (rival === d.id) {
                    setRival(decks.find(candidate => candidate.id !== d.id)!.id);
                  }
                }}
                className={`relative shrink-0 snap-start w-[92px] h-[102px] md:w-auto md:h-[92px] overflow-hidden border text-left transition-all active:scale-95 ${getRarityClass(heroRarity)} ${getVariantKind(getEquippedVariant(equippedVariants, d.hero)) ? `card-variant card-variant-${getVariantKind(getEquippedVariant(equippedVariants, d.hero))}` : ''} ${
                  isSelected
                    ? 'border-primary bg-primary/15 shadow-[0_0_20px_rgba(250,204,21,0.2)]'
                    : 'border-white/15 bg-white/5 hover:border-white/35'
                }`}
                style={{ clipPath: 'polygon(0 0, calc(100% - 11px) 0, 100% 11px, 100% 100%, 11px 100%, 0 calc(100% - 11px))' }}
              >
                <img src={getCrewScenery(d.id)} alt="" aria-hidden="true" loading="lazy" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                <img src={getCardImage(d.hero)} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-contain object-top opacity-90" />
                <CardRarityTreatment rarity={heroRarity} compact />
                <CardVariantTreatment variantId={getEquippedVariant(equippedVariants, d.hero)} />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-2">
                  <div className={`font-mono text-[6px] md:text-[7px] tracking-wider uppercase ${isSelected ? 'text-primary' : 'text-white/50'}`}>{d.accent}</div>
                  <div className="font-display font-black text-[10px] md:text-sm leading-[0.95] uppercase line-clamp-2">{d.name}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-2.5 border-t border-white/10 pt-2.5 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[8px] md:text-[10px] tracking-[0.18em] text-white/55 uppercase">Crew lineup // 10 members</span>
            <span className="font-mono text-[7px] md:text-[9px] text-primary/80 uppercase">Tap to inspect</span>
          </div>
          <motion.div
            key={`lineup-${selectedDeck.id}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-5 gap-1 md:gap-1.5"
            data-testid={`lineup-${selectedDeck.id}`}
          >
            {selectedDeck.cards.map((cardId, index) => {
              const card = cards[cardId];
              const rarity = catalogCardByEngineId[cardId].rarity;
              return (
                <CardPressTarget
                  card={card}
                  key={`${selectedDeck.id}-${cardId}`}
                  data-testid={`button-inspect-lineup-${cardId}`}
                  onClick={() => onInspect(card)} onInspect={() => onInspect(card)}
                  aria-label={`Inspect ${card.name}. ${CARD_RARITY_DEFINITIONS[rarity].label} rarity`}
                  className={`group relative min-w-0 h-[78px] md:h-[106px] overflow-hidden border border-white/15 bg-zinc-950 text-left hover:border-primary focus-visible:border-primary focus-visible:outline-none active:scale-95 transition ${getRarityClass(rarity)} ${getVariantKind(getEquippedVariant(equippedVariants, card.id)) ? `card-variant card-variant-${getVariantKind(getEquippedVariant(equippedVariants, card.id))}` : ''}`}
                  style={{ clipPath: 'polygon(0 0, calc(100% - 7px) 0, 100% 7px, 100% 100%, 7px 100%, 0 calc(100% - 7px))' }}
                >
                  <img
                    src={getCardImage(card.id)}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full object-cover object-top opacity-85 transition-transform duration-200 group-hover:scale-105"
                  />
                  <CardRarityTreatment rarity={rarity} compact />
                  <CardVariantTreatment variantId={getEquippedVariant(equippedVariants, card.id)} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
                  <span className="absolute left-1 top-1 font-mono text-[6px] text-primary/70">0{index + 1}</span>
                  <span className="absolute inset-x-0 bottom-0 p-1 font-display font-black text-[7px] md:text-[9px] leading-[0.9] uppercase text-white drop-shadow-[0_1px_2px_#000] break-words">
                    {card.name}
                  </span>
                </CardPressTarget>
              );
            })}
          </motion.div>
        </div>
      </div>

      <div className="relative z-30 shrink-0 min-w-0 w-full overflow-hidden bg-[#0c0c0c] md:border-l border-white/10 p-3 md:p-6 md:pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mb-2.5 border border-white/15 bg-black p-3 text-left">
          <div className="flex items-center justify-between gap-2">
            <span className="font-display font-black uppercase">VS // {rivalDeck.name}</span>
            <span className="font-mono text-[8px] uppercase text-primary">{difficulty}</span>
          </div>
          <div className="mt-2 font-mono text-[8px] uppercase leading-relaxed text-white/55">
            <span className="block text-white/75">{rivalDeck.cards.map((cardId) => cards[cardId]?.name).join(' · ')}</span>
            <span className="my-1 block text-accent">Rival tell: {rivalDeck.plan}</span>
            Played owned cards earn +{TRAINING_REWARD_RULES.winCardXp} XP on a win, +{TRAINING_REWARD_RULES.drawCardXp} on a draw, or +{TRAINING_REWARD_RULES.lossCardXp} on a loss.
            No daily or replay limit. No currency, tickets, Street Rep, or profile XP.
          </div>
        </div>
        <div className="grid grid-cols-[1fr_76px] gap-2 mb-2.5">
          <div className="h-12 border border-white/10 bg-white/5 px-3 flex items-center font-mono text-[8px] uppercase text-white/45">Training picks a fair progression band</div>
          <button
            data-testid="button-rules-lobby"
            onClick={onShowRules}
            className="h-12 border border-white/20 bg-white/5 font-mono text-[9px] tracking-widest uppercase hover:border-primary hover:text-primary active:scale-95"
          >
            Rules
          </button>
        </div>

        <button
          data-testid="button-start"
          onClick={onStart}
          disabled={isLoading}
          className="relative z-10 w-full min-h-14 md:min-h-16 bg-primary hover:bg-yellow-300 text-black font-display font-black text-xl md:text-3xl italic uppercase shadow-[0_5px_0_#854d0e] active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
          style={{ clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))' }}
        >
          {isLoading ? 'Loading...' : 'Start Training'}
        </button>
      </div>
    </div>
  );
}
