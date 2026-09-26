import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'wouter';
import { ArrowDown, ArrowRight, BookOpen, Check, ChevronRight, Layers3, Sparkles, Swords, Ticket, Zap } from 'lucide-react';
import { CARD_RARITIES, CARD_RARITY_DEFINITIONS, cardCatalog, catalogCardById, ROOKIE_MENTOR_CORE_IDS } from '../data';
import { CARD_LEVEL_CAP, totalXpForCardLevel } from '@workspace/squabblemon-engine/cardProgression';
import { MAX_DECK_SLOTS, MOVE_TRAINING_COSTS, SHOP_OFFERS, STORY_DUPLICATE_STYLE_SHARDS, WELCOME_REWARD, battleEarnings } from '@workspace/squabblemon-engine/economy';
import { STREET_PACK_DISCLOSURES, STREET_PACK_RULES } from '@workspace/squabblemon-engine/packRules';
import { getAssetUrl, getCardImage } from '../lib/assets';
import { CARD_FINISH, getCardWallpaper } from '../lib/cardFinish';
import { DISTRICT_CATALOG } from '../gameEngine';
import '../styles/how-to-play.css';

const chapters = [
  ['the-loop', 'The loop'], ['your-crew', 'Characters'], ['the-battle', 'Battle'],
  ['street-packs', 'Gacha'], ['card-upgrades', 'Upgrades'], ['your-wallet', 'Rewards'], ['around-the-block', 'Modes'], ['first-session', 'Start here'],
] as const;
const featured = [
  { id: 'young-bull', role: 'Pressure', tip: 'Play into an occupied enemy district to turn a cheap card into a threat.' },
  { id: 'snow-bunny', role: 'Control', tip: 'Target a district with a big enemy. Freeze can remove its scoring Hands until it is cleansed.' },
  { id: 'tin-man', role: 'Protection', tip: 'The first other ally entering his district each round gains Protection, by playing or moving.' },
  { id: 'alice', role: 'Return', tip: 'Before the final round, Alice returns to your hand once. Her next deployment costs less and gains Hands.' },
  { id: 'scarecrow', role: 'Movement', tip: 'Swap with your weakest ally in another open district. When both can move, both gain a Hand.' },
  { id: 'plug', role: 'Tempo', tip: 'Set up in one district, then spend the discount in another.' },
  { id: 'hooper', role: 'Comeback', tip: 'Check the score before dropping Hooper. His ability wants you to be losing here.' },
  { id: 'og-uncle', role: 'Finisher', tip: 'Watch the entire board. His bonus depends on the opponent having more cards in play.' },
];
// Published street-pack-v5 full-pool card-roll odds. Collection protection and distinct-pull eligibility
// affect card odds; the separate bonus slot has its own style guarantee.
const rarityOdds = [40, 20, 25, 12, 2, 0.8, 0.2];
const rarityExamples = ['shiesty-yn', 'young-bull', 'rastamon', 'all-jokes-roaster', 'officer-oink', 'techbro-rich', 'og-uncle'];
const offerPrice = (id: string) => SHOP_OFFERS.find(offer => offer.id === id)!.price;

function SectionTitle({ number, label, children }: { number: string; label: string; children: ReactNode }) {
  return <div className="guide-section-title"><span className="guide-eyebrow">{number} / {label}</span><h2>{children}</h2></div>;
}

function CharacterLab() {
  const [selected, setSelected] = useState(featured[0]);
  const card = catalogCardById[selected.id];
  const rarity = CARD_RARITY_DEFINITIONS[card.rarity];
  return <div className="guide-character-lab">
    <div className="guide-character-select" aria-label="Choose an example character">
      {featured.map(character => <button key={character.id} type="button" aria-pressed={selected.id === character.id} onClick={() => setSelected(character)}>
        <img src={getCardImage(character.id)} alt="" loading="lazy" />
        <span>{catalogCardById[character.id].name}<small>{character.role}</small></span><ChevronRight size={17} />
      </button>)}
    </div>
    <div className="guide-showcase" style={{ '--card-accent': rarity.color, backgroundImage: `url(${getCardWallpaper(card.type)})` } as CSSProperties}>
      <span className="guide-showcase-rarity">{rarity.label} · {CARD_FINISH[card.rarity]}</span>
      <img key={card.catalogId} className="guide-showcase-art" src={getCardImage(card.artworkId)} alt={card.name} loading="lazy" />
      <div className="guide-card-stats"><span><Zap size={16} /><b>{card.cost}</b> Motion</span><span><Swords size={16} /><b>{card.power}</b> Hands</span></div>
      <div className="guide-showcase-name"><small>{card.type} / {selected.role}</small><h3>{card.name}</h3></div>
    </div>
    <div className="guide-character-notes" aria-live="polite" aria-atomic="true">
      <span className="guide-eyebrow">Read the card</span><h3>{card.ability}</h3><p>{card.effect}</p>
      <div className="guide-coach-note"><span>THE PLAY</span><p>{selected.tip}</p></div>
      <dl><div><dt>Motion</dt><dd>What you spend to play it.</dd></div><div><dt>Hands</dt><dd>What it adds to its district, after effects.</dd></div><div><dt>Ability</dt><dd>The rule that makes this character matter.</dd></div></dl>
    </div>
  </div>;
}

function UpgradeLab() {
  const [level, setLevel] = useState(2);
  const example = catalogCardById['young-bull'];
  const eligible = example.abilityUpgrades.filter(upgrade => level >= upgrade.unlockLevel).length;
  return <div className="guide-upgrade-lab">
    <div className="guide-training-portrait"><img src={getCardImage(example.artworkId)} alt="Young Bull, our training example" loading="lazy" /><span>YOUNG BULL<small>Same character. More options.</small></span></div>
    <div className="guide-training-controls">
      <span className="guide-eyebrow">Explore the upgrade path</span>
      <div className="guide-level-readout"><strong>LV. {String(level).padStart(2, '0')}</strong><span>{totalXpForCardLevel(level).toLocaleString()}<small>total character XP</small></span></div>
      <label htmlFor="guide-level">Preview a character level</label>
      <input id="guide-level" type="range" min="1" max={CARD_LEVEL_CAP} value={level} onChange={event => setLevel(Number(event.target.value))} />
      <div className="guide-range-labels"><span>1 / Rookie</span><span>10 / Max level</span></div>
      <p className="guide-level-status" aria-live="polite">{eligible === 0 ? 'Build XP to reach your first coaching milestone.' : `${eligible} move ${eligible === 1 ? 'tier is' : 'tiers are'} eligible for coaching at this level.`} This preview doesn’t spend currency or change your collection.</p>
      <div className="guide-move-tiers">{example.abilityUpgrades.map((upgrade, index) => <div key={upgrade.id} data-eligible={level >= upgrade.unlockLevel}>
        <span className="guide-tier-number">0{index + 1}</span><div><b>{upgrade.name}</b><small>Level {upgrade.unlockLevel} · {MOVE_TRAINING_COSTS[index]} Clout</small><p>{upgrade.description}</p></div>
        <span className="guide-tier-state">{level >= upgrade.unlockLevel ? 'Eligible' : 'Locked'}</span>
      </div>)}</div>
    </div>
  </div>;
}

export default function HowToPlay() {
  useEffect(() => {
    const title = document.title;
    document.title = 'How to Play — Squabblemon Field Guide';
    return () => { document.title = title; };
  }, []);
  return <div className="how-to-play">
    <a className="guide-skip" href="#the-loop">Skip to the guide</a>
    <header className="guide-header" id="guide-top">
      <Link href="/" aria-label="Squabblemon home"><img src={getAssetUrl('brand/prismatic/logos/squabblemon-wordmark-gold.webp')} alt="Squabblemon" /></Link>
      <span className="guide-header-label"><BookOpen size={14} /> THE FIELD GUIDE</span>
      <Link className="guide-header-play" href="/play/guest">Try a fade <ArrowRight size={16} /></Link>
    </header>
    <main>
      <section className="guide-hero" aria-labelledby="guide-title">
        <img className="guide-hero-scene" src={getAssetUrl('assets/venues/corner-store-court.webp')} alt="" fetchPriority="high" />
        <div className="guide-hero-copy"><span className="guide-eyebrow">THE RULES. THE ROSTER. THE COME UP.</span>
          <h1 id="guide-title">KNOW<br />THE <em>BLOCK.</em></h1>
          <p className="guide-hero-lede">A little strategy.<br />A whole lot of character.</p>
          <p>Build your gang. Pull someone unexpected. Turn your favorites into neighborhood legends. Here’s how to play Squabblemon.</p>
          <a href="#the-loop" className="guide-button guide-button--yellow">Learn the game <ArrowDown size={18} /></a>
          <span className="guide-reading-time">ONE COMPLETE GUIDE / SCROLL TO EXPLORE</span>
        </div>
        <div className="guide-hero-cast" aria-label="Squabblemon characters Rastamon, Hooper, and OG Uncle">
          <span className="guide-hero-orbit" /><span className="guide-hero-tag">YOUR GANG.<br />YOUR REPUTATION.</span>
          <img className="guide-hero-rastamon" src={getCardImage('rastamon')} alt="Rastamon" />
          <img className="guide-hero-og" src={getCardImage('og-uncle')} alt="OG Uncle" />
          <img className="guide-hero-hooper" src={getCardImage('hooper')} alt="Hooper" fetchPriority="high" />
          <span className="guide-hero-stamp"><b>7 CARDS</b><span>ONE GANG</span></span>
        </div>
        <div className="guide-hero-facts"><span><b>07</b> cards in your gang</span><span><b>03</b> districts to contest</span><span><b>06</b> rounds to make it count</span><span><b>02</b> districts to win</span></div>
      </section>
      <nav className="guide-chapter-nav" aria-label="Guide chapters">{chapters.map(([id, label], index) => <a href={`#${id}`} key={id}><span>0{index + 1}</span>{label}</a>)}</nav>

      <section className="guide-section guide-loop" id="the-loop" aria-labelledby="loop-heading">
        <div className="guide-section-intro"><SectionTitle number="01" label="The big picture"><span id="loop-heading">Every legend<br />starts on the block.</span></SectionTitle><p>Collect characters with different tricks, choose ten that work together, and take them into a six-round fight. Every saved battle helps fund your next move.</p></div>
        <div className="guide-loop-steps">{[
          ['deck-stack', 'Build your gang', 'Pick ten unique cards. Mix affordable openers, useful support, and a closer.'],
          ['neighborhood-map', 'Take the streets', 'Play story or practice. Outscore your opponent in two of three districts.'],
          ['championship-chain', 'Earn your name', 'Collect Clout, profile XP, Rep, and XP for owned characters you actually play.'],
          ['foil-pack', 'Make your next move', 'Open packs, recruit a Common, train a favorite, or craft a new finish.'],
        ].map(([art, title, text], index) => <article key={title}><span className="guide-step-number">0{index + 1}</span><img src={getAssetUrl(`assets/props/${art}.webp`)} alt="" loading="lazy" /><h3>{title}</h3><p>{text}</p>{index < 3 && <ArrowRight className="guide-loop-arrow" size={21} />}</article>)}</div>
        <div className="guide-inline-note"><Check size={19} /><p><strong>Start with a real gang.</strong> Rookie Road gives you a {ROOKIE_MENTOR_CORE_IDS.length}-card foundation. You can learn the game before chasing the rest of the collection.</p></div>
      </section>

      <section className="guide-section guide-paper" id="your-crew" aria-labelledby="crew-heading">
        <div className="guide-section-intro"><SectionTitle number="02" label="Characters & gang building"><span id="crew-heading">Pick personalities.<br /><em>Build a plan.</em></span></SectionTitle><p>{cardCatalog.length} characters. Different costs, different abilities, different ways to win. Choose an example below to see what a character brings to your gang.</p></div>
        <CharacterLab />
        <div className="guide-deck-lesson"><div><span className="guide-eyebrow">A first gang you can grow with</span><h3>Ten cards.<br />More than one way out.</h3><p>This Rookie Road lineup gives you cheap plays, a discount, freeze, protection, a cleanse, disruption, and a comeback card.</p><Link href="/game/decks" className="guide-text-link">Open your gang builder <ArrowRight size={17} /></Link></div>
          <div><div className="guide-rookie-lineup">{ROOKIE_MENTOR_CORE_IDS.map(id => <figure key={id}><img src={getCardImage(id)} alt="" loading="lazy" /><figcaption>{catalogCardById[id].name}<small>{catalogCardById[id].cost} Motion</small></figcaption></figure>)}</div><p className="guide-small-note">Gang rule: exactly ten different owned cards. Characters can mix across gangs and types. Keep some 1–2 Motion plays so you have options early.</p></div>
        </div>
      </section>

      <section className="guide-section guide-battle" id="the-battle" aria-labelledby="battle-heading">
        <div className="guide-section-intro"><SectionTitle number="03" label="Playing a fade"><span id="battle-heading">Win the districts.<br /><em>Win the argument.</em></span></SectionTitle><p>At the end of round six (seven after The After Party), you need more Hands in at least two districts. A giant stack in one district still wins only one district.</p></div>
        <div className="guide-board" aria-label="Example final board: you win districts one and three, taking the fade two to one">
          <div className="guide-board-header"><span>EXAMPLE / END OF ROUND 6</span><span>YOU <i /> <i className="opponent" /> OPPONENT</span></div>
          <div className="guide-districts">{[
            { title: 'BODEGA', you: 12, them: 8, win: true, art: 'corner-store-court' },
            { title: 'THE TRAP', you: 4, them: 19, win: false, art: 'red-fence-night-court' },
            { title: 'PENTHOUSE', you: 10, them: 7, win: true, art: 'harbor-skyline-court' },
          ].map(district => <div className="guide-district" key={district.title} data-win={district.win} style={{ backgroundImage: `url(${getAssetUrl(`assets/venues/${district.art}.webp`)})` }}><span>{district.title}</span><div><b>{district.you}</b><small>vs</small><b>{district.them}</b></div><strong>{district.win ? 'YOURS' : 'THEIRS'}</strong></div>)}</div>
          <div className="guide-board-verdict"><strong>2–1. YOUR BLOCK.</strong><p>You win with 26 total Hands against 34. District control decides the fade.</p></div>
        </div>
        <div className="guide-battle-rules"><article><span>01 / DRAW & READ</span><h3>Start with five.</h3><p>Your gang has ten cards. A normal fade opens with five in hand, then draws one each round until the deck is empty. Read the board before committing.</p></article><article><span>02 / SPEND MOTION</span><h3>Spend your turn wisely.</h3><p>Drag a card into a lane and release to play it. You can also tap to select a card and lane. Hold any card to read its details without playing it. On desktop, right-click or press Alt+Enter. Play while you can afford it, then end your turn. You start with 2 Motion. Later rounds give Motion equal to the round number, plus up to 1 unspent Motion carried over, capped at 9.</p></article><article><span>03 / WATCH THE REVEAL</span><h3>Abilities change things.</h3><p>Your card resolves, then the opponent responds. Follow the updated district scores. Freeze, protection, movement, and other effects can change the value of a play.</p></article></div>
        <div className="guide-squabble"><div className="guide-squabble-symbol">×2</div><div><span className="guide-eyebrow">Once per fade</span><h3>Make it a SQUABBLE.</h3><p>Use SQUABBLE when playing a card to double its <strong>base Hands</strong>. Its Motion cost still applies. Save it for a play that helps secure a second district.</p></div><span className="guide-squabble-example">Hooper’s base Hands<b>5 → 10</b><small>Ability effects resolve separately.</small></span></div>
        <div className="guide-status-notes"><p><strong>Frozen?</strong> The card contributes 0 Hands until cleansed.</p><p><strong>Silenced?</strong> Its ability is disabled; its Hands can still count.</p><p><strong>Tied?</strong> A tied district belongs to neither player. If neither owns two at the finish, the fade is a draw.</p></div>
        <div className="guide-battle-rules"><article><span>BLOCKBUSTERS / LANE EVENTS</span><h3>Change the whole block.</h3><p>Blockbusters join your ten-card deck. Tap an event, choose its lane and any options, then play it. It resolves and leaves the board without adding Hands or using SQUABBLE. Read carefully: many affect both crews.</p></article><article><span>DICE / CONCERT / SETUP</span><h3>Choose your risk.</h3><p>Concert boosts everyone in its lane by 1 Hand or takes 1 away. The Setup sacrifices your weakest ally there and transfers its Hands to your strongest other ally. Dice Game wagers 1–3 Motion per side: roll three D6, total the best two, and the winner takes the pot. Ties refund wagers; Motion still caps at 9.</p></article><article><span>AFTER PARTY / COOKOUT</span><h3>Plan for what stays.</h3><p>After Party extends the fight to seven rounds, once. Cookout drops two Soul Food cards and a persistent Burnt Plate in random friendly lanes. Every round, that plate burns a friendly character in its lane. Block Spin repeats earlier damage in its lane twice; it cannot repeat its own hits.</p></article></div>
        <p className="guide-small-note">Three locations are drawn from sixteen each fade. Bonuses, penalties, movement, and protection can change your plan. All rules are visible before you play; previews include their effects. Location penalties cannot push a card below 0 Hands. Story encounters can add modifiers.</p>
        <details className="guide-small-note"><summary>Meet all {DISTRICT_CATALOG.length} locations</summary><ul>{DISTRICT_CATALOG.map(district => <li key={district.id}><b>{district.name}</b> — {district.rule}</li>)}</ul></details>
      </section>

      <section className="guide-section guide-packs" id="street-packs" aria-labelledby="packs-heading">
        <div className="guide-pack-intro"><div><SectionTitle number="04" label="Gacha / Street Packs"><span id="packs-heading">New faces.<br /><em>Fresh possibilities.</em></span></SectionTitle><p>A Street Pack gives you five gameplay-card pulls plus a bonus reward. Spend a ticket or use your earned Clout, then reveal what joins your collection.</p><div className="guide-pack-price"><span><Ticket size={20} /><b>{STREET_PACK_RULES.single.ticketCost}</b> ticket</span><small>OR</small><span><b>{STREET_PACK_RULES.single.softCurrencyCost}</b> Clout</span></div><p className="guide-small-note">Every rarity rolls independently. New-card protection stays inside the rarity that was rolled.</p></div><div className="guide-pack-art"><span className="guide-pack-halo" /><img src={getAssetUrl('assets/props/foil-pack.webp')} alt="Squabblemon gold and black Street Pack" loading="lazy" /><span className="guide-pack-sticker">5 CARDS + BONUS<br />IN EVERY PACK</span></div></div>
        <div className="guide-pack-slots">{STREET_PACK_DISCLOSURES.map((disclosure, index) => <article key={disclosure.label}><span className="guide-slot-number">{String(index + 1).padStart(2, '0')}</span><span className="guide-eyebrow">{disclosure.chance}% nominal</span><h3>{disclosure.label}</h3><p>{disclosure.detail}</p><strong>AUTHORITATIVE PACK RULE</strong></article>)}</div>
        <div className="guide-pack-protection"><div><Layers3 size={24} /><h3>Already own that card?</h3><p>A pack or Collection Road duplicate converts to <strong>{STREET_PACK_RULES.duplicateStyleShards} Style Shards</strong>. Finite story card rewards keep their original <strong>{STORY_DUPLICATE_STYLE_SHARDS}-shard</strong> duplicate promise. You don’t need duplicate copies to train a character.</p></div><div><Sparkles size={24} /><h3>A style by pack ten.</h3><p>If nine openings pass without a style, the tenth awards an unowned style in the bonus slot. A style pull resets the counter. This guarantee covers cosmetics; Legendary and Mythical characters have no rarity guarantee.</p></div></div>
        <div className="guide-rarity-heading"><div><span className="guide-eyebrow">Know your rarities</span><h3>Seven tiers. Every one has a role.</h3></div><p>Base odds for a full-pool <strong>card roll</strong>, including characters and support items. These are conditional card odds, not the chance per entire pack.</p></div>
        <div className="guide-rarity-grid">{CARD_RARITIES.map((rarity, index) => <article key={rarity} style={{ '--rarity-color': CARD_RARITY_DEFINITIONS[rarity].color } as CSSProperties}><span>{String(index + 1).padStart(2, '0')} / {String(CARD_RARITIES.length).padStart(2, '0')}</span><img src={getCardImage(rarityExamples[index])} alt={catalogCardById[rarityExamples[index]].name} loading="lazy" /><h4>{CARD_RARITY_DEFINITIONS[rarity].label}</h4><p>{CARD_FINISH[rarity]}</p><strong>{rarityOdds[index]}<small>%</small></strong></article>)}</div>
        <div className="guide-inline-note"><Check size={19} /><p><strong>Rarity has no automatic Hands multiplier.</strong> Read the actual stats and ability. Some rare characters also come from progression rewards, including Techbro Rich on Collection Road.</p></div>
        <div className="guide-recruit-callout"><img src={getCardImage('abuela')} alt="" loading="lazy" /><div><span className="guide-eyebrow">Got someone specific in mind?</span><h3>Recruit a neighborhood Common.</h3><p>Spend <strong>{offerPrice('common-recruit')} Clout</strong> to choose an unowned Common directly in the Trading Post.</p></div><Link href="/game/shop?view=training" className="guide-text-link">Visit the Trading Post <ArrowRight size={18} /></Link></div>
      </section>

      <section className="guide-section guide-paper" id="card-upgrades" aria-labelledby="upgrades-heading">
        <div className="guide-section-intro"><SectionTitle number="05" label="Card levels, upgrades & finishes"><span id="upgrades-heading">Put in the reps.<br /><em>Keep your favorites.</em></span></SectionTitle><p>A character has a rarity, a level, learned move tiers, and a visual finish. Each does a different job. Here’s what actually grows.</p></div>
        <div className="guide-progress-types"><article><span>RARITY</span><h3>The collection tier.</h3><p>Super Common through Mythical. Fixed for each card. Leveling doesn’t turn a Common into a Legendary.</p></article><article><span>LEVEL + COACHING</span><h3>The gameplay path.</h3><p>XP raises your level. At levels 2, 5, and 8, pay Clout to learn the next move tier in order.</p></article><article><span>FINISH</span><h3>The personal touch.</h3><p>Tagged and Chrome are cosmetic styles. They change your card’s presentation without changing its combat stats.</p></article></div>
        <UpgradeLab />
        <div className="guide-training-rules"><article><h3>Earn it in a fight.</h3><p>Owned characters you actually play receive <strong>30 XP for a win, 25 for a draw, or 20 for a loss</strong> in a saved fade. Sitting in your hand doesn’t earn character XP.</p></article><article><h3>Give them extra practice.</h3><p>Spend <strong>{offerPrice('training')} Clout for 100 XP</strong>, or <strong>{offerPrice('training-intensive')} for 250 XP</strong>. Training near the cap is priced for the XP you can still receive.</p></article><article><h3>Coach the next move.</h3><p>Reaching the level makes a move eligible. Coaching activates it. All three tiers cost <strong>{MOVE_TRAINING_COSTS.reduce((a, b) => a + b, 0).toLocaleString()} Clout</strong> in total, with character level capped at {CARD_LEVEL_CAP}.</p></article></div>
        <div className="guide-coaching-note"><Zap size={21} /><p><strong>Timing still matters.</strong> These upgrades add small bonuses when the base ability succeeds. Training won’t make a missed ability condition succeed. Changes take effect in your next fade.</p></div>
        <div className="guide-finish-strip"><div><span className="guide-eyebrow">Style has its own currency</span><h3>Make your main look like your main.</h3></div><div><b>TAGGED</b><span>{offerPrice('tagged-style')} Style Shards</span></div><div><b>CHROME</b><span>{offerPrice('chrome-style')} Style Shards</span></div><p>Own the character, craft a finish in the Trading Post, then equip it in Collection.</p></div>
      </section>

      <section className="guide-section guide-wallet" id="your-wallet" aria-labelledby="wallet-heading">
        <div className="guide-section-intro"><SectionTitle number="06" label="Rewards & resources"><span id="wallet-heading">Every fight feeds<br /><em>the next one.</em></span></SectionTitle><p>There are three spendable resources to know. Your profile XP and Street Rep track account progress, while character XP grows individual cards.</p></div>
        <div className="guide-wallet-grid"><article><span className="guide-currency-icon">C</span><h3>Clout</h3><p>Earn it from saved battles, bounties, and progression rewards.</p><span>SPEND ON</span><p>Training, move coaching, packs, Common recruits, and extra saved gang slots.</p></article><article><Ticket size={36} /><h3>Pack tickets</h3><p>Find them in welcome rewards, selected bounties, story rewards, or the shop.</p><span>SPEND ON</span><p>Street Packs. One ticket opens one pack.</p></article><article><Sparkles size={36} /><h3>Style Shards</h3><p>Collect them from duplicates, pack bonuses, and selected milestones.</p><span>SPEND ON</span><p>Tagged and Chrome finishes for characters you own.</p></article></div>
        <div className="guide-earnings"><div><span className="guide-eyebrow">The standard payout</span><h3>A loss still<br />teaches you something.</h3><p>Saved story and practice fades reward all three outcomes. First-clear story bonuses and bounty claims can add more.</p><p className="guide-small-note">Guest and offline practice don’t save account rewards. Repeatable fade payouts don’t include pack tickets.</p></div><div className="guide-table-wrap"><table><caption>Rewards per saved fade</caption><thead><tr><th scope="col">Result</th><th scope="col">Clout</th><th scope="col">Profile XP</th><th scope="col">Rep</th><th scope="col">Card XP*</th></tr></thead><tbody>{(['win', 'draw', 'loss'] as const).map((result, index) => { const earnings = battleEarnings(result); return <tr key={result}><th scope="row">{result}</th><td>{earnings.softCurrency}</td><td>{earnings.xp}</td><td>{earnings.streetRep}</td><td>{[30, 25, 20][index]}</td></tr>; })}</tbody></table><p className="guide-small-note">*Per participating owned character, up to its XP cap.</p></div></div>
        <div className="guide-bounty-strip"><span>DON’T LEAVE REWARDS ON THE TABLE.</span><p>Check <Link href="/game/missions">Bounties</Link> and <Link href="/game/collection">Collection Road</Link> after playing. Ready rewards still need to be claimed.</p></div>
      </section>

      <section className="guide-section" id="around-the-block" aria-labelledby="modes-heading">
        <div className="guide-section-intro"><SectionTitle number="07" label="Your next destination"><span id="modes-heading">Find your<br /><em>kind of fade.</em></span></SectionTitle><p>Cards & gangs brings Collection and Decks together with paper tabs. Build a ten-card gang, choose its hero, and unlock up to {MAX_DECK_SLOTS} saved deck slots.</p></div>
        <div className="guide-wallet-grid">
          <article><h3>Training Circuit</h3><p>The heavy bag opens the current Training Circuit. Pick your gang and practice pressure, movement, control, support, freeze recovery, or equal footing.</p><Link href="/game/training">Get your reps →</Link></article>
          <article><h3>Friendly Fade’s & Fade Park</h3><p>Share a room code for a private fade, or find a ranked rival at Fade Park. Ranked matches use base move tiers; friendly fades do not change rank. The cigarette track burns toward your next rank.</p><Link href="/game/online">Find a fade →</Link></article>
          <article><h3>The Fadecade</h3><p>Straight to the Back saves each move in an endurance run, with a boss every fifth opponent. Two entries a day; one loss ends the run. Stockz lets you stake earned Clout on fictional stocks: five trades daily, a 50/50 up-or-down call, and a correct call returns twice the stake. No cash value.</p><Link href="/game/challenges">Enter the arcade →</Link></article>
          <article><h3>Stories & puzzles</h3><p>Play the original seasons, six Sherlock chapters, The Wizard of Oz, Alice in Wonderland, Yasuke, the Cellblock library, and Leon’s chapter. Arrange clues with drag, tap controls, or arrow keys. Hints and puzzle skips keep the story moving.</p><Link href="/game/story">Hit the streets →</Link></article>
        </div>
        <div className="guide-inline-note"><Sparkles size={22} /><p><strong>Showing up pays.</strong> Claim daily check-ins from the Safehouse. Seven consecutive days award increasing Clout, with 2 tickets and 25 Style Shards on day seven. Missing a day restarts the streak. New players have a first-week welcome bonus, and everyone has a first check-in bonus. Every ten player levels adds 250 Clout, 1 ticket, and 50 Style Shards to your check-in rewards.</p></div>
        <p className="guide-small-note">Bounties live behind the floating wanted-poster icon on the Safehouse. Your level at the top opens your profile. Daily resets use 00:00 UTC.</p>
      </section>
      <section className="guide-section guide-first-session" id="first-session" aria-labelledby="start-heading">
        <div className="guide-first-art"><img src={getCardImage('dr-fade')} alt="Dr. Fade, your guide to the block" loading="lazy" /><span>DR. FADE’S<br /><b>ROOKIE ROAD</b></span></div>
        <div className="guide-first-copy"><SectionTitle number="08" label="Your first session"><span id="start-heading">You’re up,<br /><em>rookie.</em></span></SectionTitle>
          <ol><li><b>Meet Dr. Fade.</b><p>Create an account and follow Rookie Road to receive your foundation.</p></li><li><b>Save your ten.</b><p>Build a legal gang. Keep cheap options and a plan for two districts.</p></li><li><b>Finish practice. Claim the welcome reward.</b><p>Your {WELCOME_REWARD.softCurrency} welcome Clout can cover a 100-XP Practice Session and the first {MOVE_TRAINING_COSTS[0]}-Clout move coaching for one new character.</p></li><li><b>Take it back to the streets.</b><p>Play story, claim ready bounties, and try your new move. Save for a pack or choose a Common when you know what your gang needs.</p></li></ol>
          <div className="guide-start-actions"><Link href="/game" className="guide-button guide-button--yellow">Build my gang <ArrowRight size={18} /></Link><Link href="/play/guest" className="guide-text-link">Try guest practice <ArrowRight size={16} /></Link></div>
        </div>
      </section>
      <section className="guide-section guide-faq" aria-labelledby="faq-heading"><div><span className="guide-eyebrow">One last thing</span><h2 id="faq-heading">The quick answers.</h2></div><div>
        {[
          ['Do I need a rare card to win?', 'No. A Common can be a useful opener, support, or finisher. Rarity does not multiply stats, and your placement and ability timing decide how much value you get.'],
          ['Does a duplicate upgrade my card?', `No. Pack and Collection Road duplicates become ${STREET_PACK_RULES.duplicateStyleShards} Style Shards; finite story reward duplicates retain their ${STORY_DUPLICATE_STYLE_SHARDS}-shard promise. Character upgrades use XP and Clout-funded coaching, so you can keep training the copy you already own.`],
          ['Are card levels and account levels the same?', 'No. Profile XP grows your account level. Character XP belongs to individual cards and sets their coaching eligibility. Street Rep is a separate account progress measure.'],
          ['Can I play without an account?', 'Yes. Guest practice lets you learn the battle rules. Sign in and complete Rookie Road for a saved collection, progression, and earned rewards.'],
          ['Does leveling make every stat bigger?', 'No. Level milestones make move upgrades available for coaching. Your card’s printed cost, base Hands, and rarity do not automatically increase with every level.'],
        ].map(([question, answer]) => <details className="guide-disclosure" key={question}><summary>{question}<ChevronRight size={18} /></summary><div><p>{answer}</p></div></details>)}
      </div></section>
    </main>
    <footer className="guide-footer"><img src={getAssetUrl('brand/prismatic/marks/impact-gold.webp')} alt="" loading="lazy" /><div><strong>KNOW THE BLOCK. MAKE YOUR MOVE.</strong><p>Squabblemon field guide · Current game rules · Balance values may evolve.</p></div><a href="#guide-top">Back to top ↑</a></footer>
  </div>;
}
