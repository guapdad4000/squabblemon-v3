export type Card = { id:string; name:string; type:string; cost:number; power:number; ability:string; effect:string; roles?:string[]; deck?:string; owner?:'player'|'cpu' };
export type Deck = { id:string; name:string; archetype:string; accent:string; plan:string; cards:string[], hero: string };

export const cards:Record<string,Card> = {
 rastamon:{id:'rastamon',name:'Rastamon',type:'Plant',cost:2,power:2,ability:'Natural Cure',effect:'Cleanse another friendly card here. If removed, give it +2 Power.'},
 roaster:{id:'all-jokes-roaster',name:'All Jokes Roaster',type:'Air',cost:2,power:3,ability:"Ratio'd Receipts",effect:'Give the highest enemy card here -2 Power. -3 if they played here.',roles:['Disruption']},
 nerd:{id:'closet-nerd',name:'Closet Nerd',type:'Dark',cost:3,power:4,ability:'Unaware',effect:'Silence the highest-Power enemy card here.',roles:['Disruption']},
 cornball:{id:'cornball',name:'Cornball',type:'Normal',cost:1,power:1,ability:'Scare the Hoes',effect:'Move the lowest enemy card if they have at least 3 here.',roles:['Movement','Disruption']},
 plug:{id:'plug',name:'Plug',type:'Electric',cost:2,power:2,ability:'Connections',effect:'Your next card in another district costs 1 less Hype.'},
 streamer:{id:'live-streamer',name:'Live Streamer',type:'Electric',cost:2,power:1,ability:'Follower Frenzy',effect:'The first 2 cheap plays gain +1 Power.'},
 gamer:{id:'gamer',name:'Gamer',type:'Dark',cost:3,power:3,ability:'Tryhard Trigger',effect:'Cheap plays here give Gamer and that card +1 Power.'},
 techbro:{id:'techbro-rich',name:'Techbro Rich',type:'Electric',cost:4,power:4,ability:'VC Funded Flex',effect:'Spend 1 unspent Hype to gain +2 Power.'},
 bikelife:{id:'bikelife-yn',name:'Bikelife YN',type:'Electric',cost:2,power:2,ability:'Ride Out',effect:'May move before Lock In; gains +1 Power after moving.'},
 vibe:{id:'cool-vibe-yn',name:'Cool Vibe YN',type:'Water',cost:2,power:2,ability:'Wave Check',effect:'Move your lowest friendly card here and buff both.'},
 hooper:{id:'hooper',name:'Hooper',type:'Fire',cost:4,power:5,ability:'Ankle Breaker',effect:'If losing here, enemy highest gets -2 and Hooper gains +2.'},
 baby:{id:'baby-momma',name:'Baby Momma',type:'Fire',cost:4,power:4,ability:'Mama Bear',effect:'If opponent has more cards here, gain +2 Power.'},
 oink:{id:'officer-oink',name:'Officer Oink',type:'Normal',cost:5,power:6,ability:'Civic Pressure',effect:'Enemy cards here -1. Next round they may play only one.',roles:['Disruption']},
 snow:{id:'snow-bunny',name:'Snow Bunny',type:'Water',cost:2,power:2,ability:'Cold Shoulder',effect:'Freeze the highest enemy card here.',roles:['Disruption']},
 wifey:{id:'wifey',name:'Wifey',type:'Normal',cost:3,power:4,ability:'Side Eye',effect:'Block the first targeted enemy effect here each round.'},
};

export const decks:Deck[] = [
 {id:'block',name:'THE BLOCK IS HOT',archetype:'Turf Control',accent:'LOCK',plan:'Claim two districts, tax entry, freeze threats, and close lanes.',cards:['cornball','snow','roaster','rastamon','wifey','oink','baby'], hero: 'officer-oink'},
 {id:'slide',name:'SLIDE THRU',archetype:'Movement',accent:'MOVE',plan:'Spread Power early, then relocate it late into a moving target.',cards:['cornball','bikelife','vibe','plug','snow','hooper','baby'], hero: 'bikelife-yn'},
 {id:'combo',name:'WHO YOU KNOW',archetype:'Combo / Network',accent:'CHAIN',plan:'Chain cheap plays, discounts, generated cards, and oversized turns.',cards:['cornball','plug','streamer','gamer','techbro','vibe','wifey'], hero: 'techbro-rich'},
 {id:'receipts',name:'RECEIPTS',archetype:'Disruption',accent:'EXPOSE',plan:'Expose the plan, Silence engines, and turn investments into bad ones.',cards:['cornball','roaster','nerd','snow','plug','baby','hooper'], hero: 'all-jokes-roaster'},
 {id:'crashout',name:'CRASHOUT SEASON',archetype:'Comeback',accent:'FLIP',plan:'Absorb early deficits, then flip contested districts with late Power spikes.',cards:['cornball','rastamon','snow','wifey','baby','hooper','roaster'], hero: 'hooper'},
 {id:'vibes',name:'GOOD VIBES ONLY',archetype:'Sustain',accent:'CLEANSE',plan:'Cleanse, Protect, suppress hostile rules, and keep scaling pieces alive.',cards:['rastamon','wifey','snow','vibe','hooper','oink','plug'], hero: 'rastamon'},
 {id:'compound',name:'COMPOUND INTEREST',archetype:'Growth / Scaling',accent:'GROW',plan:'Invest early in engines and convert repeated buffs into late value.',cards:['cornball','plug','streamer','rastamon','gamer','techbro','wifey'], hero: 'gamer'},
];

export const districts = [
  { name: 'THE TOWN', rule: 'Fire + Dark cards gain +2 Power.' },
  { name: 'GROUP CHAT', rule: 'Disruption cards gain +2 Power.' },
  { name: 'SERVER ROOM', rule: 'Electric cards gain +3 Power.' }
];

const imageOverrides: Record<string, string> = {
  cornball: '/assets/guapdad4k_urbAN_FIGHTING_GAME_AVATAR_DESIGN_PLAIN_WHITE_BACKG_7b493ad5-5188-4a36-b03d-a05c89951112_3.png',
  'cool-vibe-yn': '/assets/0_0.png'
};

export const getCardImage = (id: string) => imageOverrides[id] ?? `/assets/characters/${id}.webp`;

export function getLaneScore(laneCards: Card[], laneIndex: number) {
  return laneCards.reduce((score, card) => {
    let bonus = 0;
    if (laneIndex === 0 && (card.type === 'Fire' || card.type === 'Dark')) bonus = 2;
    if (laneIndex === 1 && card.roles?.includes('Disruption')) bonus = 2;
    if (laneIndex === 2 && card.type === 'Electric') bonus = 3;
    return score + card.power + bonus;
  }, 0);
}
