(() => {
  const C = (id,name,type,cost,basePower,speed,archetype,keywords,effectId,abilityName,effectText,extra={}) => ({id,name,type,cost,basePower,speed,archetype,keywords,effectId,abilityName,effectText,...extra});

  const CARDS = {
    rastamon:C('rastamon','Rastamon','Plant',2,2,130,'Sustain',['Cleanse'],'naturalCure','Natural Cure','On Reveal: Cleanse another friendly card here. If anything was removed, give that card +2 Power.'),
    fitness:C('fitness','Fitness Bro','Fire',3,4,120,'Comeback',[],'guts','Guts','Ongoing: If Fitness Bro is Poisoned, Frozen, or has a negative Power modifier, it has +3 Power.'),
    techy:C('techy','Techy','Electric',3,3,190,'Hybrid / Anti-Scaling',['Copy'],'download','Download','On Reveal: Copy the largest positive Power modifier on an enemy card here and apply it to Techy, up to +3 Power.'),
    vibe:C('vibe','Cool Vibe YN','Water',2,2,150,'Movement',['Move'],'waveCheck','Wave Check','On Reveal: Move your lowest-Power friendly card from another district here. If a card moves, give it and Cool Vibe YN +1 Power.'),
    nine5:C('nine5','9-5 Homie','Rock',3,4,180,'Turf Control',['Protect'],'clockIn','Clock In','Ongoing: Once each round, when an enemy card effect would reduce the Power of one or more friendly cards here, prevent that entire Power reduction at this district.'),
    roaster:C('roaster','All Jokes Roaster','Air',2,3,180,'Disruption',[],'ratio',"Ratio'd Receipts",'On Reveal: Give the highest-Power enemy card here -2 Power. If your opponent played a card here this round, give it -3 Power instead.',{hasDebuff:true}),
    nerd:C('nerd','Closet Nerd','Dark',3,4,170,'Disruption',['Silence'],'unaware','Unaware',"Ongoing: The highest-Power enemy card here is Silenced. If the highest-Power enemy changes, the Silence moves to the new target.",{hasDebuff:true}),
    dysfunctional:C('dysfunctional','Dysfunctional YN','Fire',4,5,140,'Comeback',[],'tantrum','Trainwreck Tantrum','On Reveal: If you are losing this district, gain +4 Power. If you are winning this district, lose 2 Power. If tied, no change.'),
    functional:C('functional','Functional Addict','Water',2,2,130,'Sustain',['Cleanse'],'soberUp','Sober Up Sis','End of Round: Cleanse the lowest-Power friendly card here that has a negative effect. If anything was removed, Functional Addict gains +1 Power. Maximum 3 triggers per match.'),
    gamerUnemployed:C('gamerUnemployed','Gamer Unemployed','Dark',3,6,150,'Growth / Risk',[],'truant','Truant','Ongoing: During any round in which you play another card, Gamer Unemployed has -3 Power until that round ends.'),
    gamer:C('gamer','Gamer','Dark',3,3,180,'Combo',[],'tryhard','Tryhard Trigger','The first 3 times this match you play a 1- or 2-Cost card at this district, give that card and Gamer +1 Power.'),
    homeless:C('homeless','Homeless YN','Rock',2,2,120,'Hybrid / Combo',[],'hustle','Hustle Hard','On Reveal: Add a Scrap to your hand.'),
    serial:C('serial','Serial Shooter','Dark',4,5,180,'Disruption',['Silence'],'killerInstinct','Killer Instinct','On Reveal: Silence the highest-Power enemy card here, then give that card -2 Power.',{hasDebuff:true}),
    earthy:C('earthy','Earthy Dude','Plant',3,3,100,'Growth',[],'rooted','Rooted','End of Round: Give your lowest-Power other friendly card here +1 Power. If another Plant-type friendly card is here, give +2 instead. Maximum 3 triggers per match.'),
    techbro:C('techbro','Techbro Rich','Electric',4,4,190,'Combo / Hype Economy',[],'vcFlex','VC Funded Flex','On Reveal: You may spend 1 unspent Hype. If you do, Techbro Rich gains +2 Power.'),
    plug:C('plug','Plug','Electric',2,2,170,'Combo',[],'connections','Connections','On Reveal: The next card you play in a different district costs 1 less Hype, minimum 1. This effect expires after it is used.'),
    scammer:C('scammer','Scammer','Dark',3,3,190,'Disruption / Copy',['Copy'],'imposter','Imposter','On Reveal: Copy the base Power and printed ability of the highest-Power enemy card here. Copied base Power cannot exceed 7. Copied On Reveal abilities do not trigger.'),
    smoker:C('smoker','Smoker Jr','Air',3,3,150,'Turf Control',[],'cloudNine','Cloud Nine',"Ongoing: This district's location effect is disabled for both players."),
    suburban:C('suburban','Suburban Kid','Normal',2,2,200,'Growth',[],'simple','Simple','Whenever another friendly card effect gives Suburban Kid positive Power, gain that amount again. Maximum +4 additional Power from this ability.'),
    gangerBlue:C('gangerBlue','Ganger Blue','Dark',4,5,150,'Turf Control',['Lock'],'cornerCheck','Corner Check','On Reveal: Give all enemy cards here -1 Power. If this leaves you winning the district, enemy cards cannot Move into this district until the end of the next round.',{hasDebuff:true}),
    gangerRed:C('gangerRed','Ganger Red','Fire',3,4,165,'Hybrid / Combo',[],'tagTeam','Tag Team','On Reveal: If Ganger Blue is anywhere on your board, give Ganger Red and Ganger Blue +2 Power. Otherwise, if your opponent played a card here this round, Ganger Red gains +2 Power.'),
    coone:C('coone','Coone','Dark',3,2,195,'Disruption',[],'sideSwitcher','Side Switcher','End of Round: If you are losing this district and an enemy card here has 4 or less base Power, swap control of Coone with the lowest-Power eligible enemy card. Once per match.'),
    rapper:C('rapper','Rapper','Normal',4,4,140,'Combo',['Copy'],'remix','Remix','On Reveal: Repeat the On Reveal ability of the last friendly card you revealed this match. Rapper cannot repeat an ability that copies or repeats another ability.'),
    bikelife:C('bikelife','Bikelife YN','Electric',2,2,190,'Movement',['Move'],'rideOut','Ride Out','Once per round before Lock In, you may Move Bikelife YN to another district with space. After it moves, gain +1 Power. Maximum +3 Power from this ability.'),
    hooper:C('hooper','Hooper','Fire',4,5,135,'Comeback',[],'ankleBreaker','Ankle Breaker','On Reveal: If you are losing this district, give the highest-Power enemy card here -2 Power and give Hooper +2 Power.',{hasDebuff:true}),
    streamer:C('streamer','Live Streamer','Electric',2,1,185,'Combo',[],'followerFrenzy','Follower Frenzy','The first 2 times this match you play a 1- or 2-Cost card anywhere, Live Streamer gains +1 Power. After your third such play, add a Stan to your hand.'),
    oink:C('oink','Officer Oink','Normal',5,6,90,'Turf Control',['Lock'],'civicPressure','Civic Pressure','On Reveal: Give all enemy cards here -1 Power. Next round, your opponent may play at most 1 card here and cannot Move cards into this district.',{hasDebuff:true}),
    snitch:C('snitch','Snitch','Dark',2,3,175,'Disruption / Information',[],'tattle','Tattle Tale',"Ongoing: Once per round, when your opponent queues their first card at this district, that card's identity is immediately revealed to you."),
    cornball:C('cornball','Cornball','Normal',1,1,110,'Movement / Disruption',['Move'],'scare','Scare the Hoes','On Reveal: If your opponent has at least 3 cards here, Move their lowest-Power card to another district of your choice with space.'),
    cracked:C('cracked','Cracked Head','Poison',2,2,195,'Disruption / Movement',['Poison','Move'],'scrapScramble','Scrap Scramble','On Reveal: Poison the lowest-Power enemy card here. Whenever Cracked Head Moves, Poison the lowest-Power enemy card at its new district.',{hasDebuff:true}),
    wifey:C('wifey','Wifey','Normal',3,4,130,'Sustain',['Protect'],'sideEye','Side Eye','Ongoing: The first enemy card effect each round that specifically targets another friendly card here is blocked.'),
    bossBabe:C('bossBabe','Boss Babe','Electric',3,3,190,'Combo',[],'networkBoost','Network Boost',"The first 2 times each match you play a card in a district other than Boss Babe's district, Boss Babe gains +1 Power. After the second trigger, your next card that costs 4 or more costs 1 less Hype, minimum 1."),
    snowBunny:C('snowBunny','Snow Bunny','Water',2,2,170,'Turf Control',['Freeze'],'coldShoulder','Cold Shoulder','On Reveal: Freeze the highest-Power enemy card here until the end of the next round.',{hasDebuff:true}),
    nine5Homegirl:C('nine5Homegirl','9-5 Homegirl','Normal',2,2,120,'Comeback / Sustain',['Cleanse'],'coffeeBreak','Coffee Break','On Reveal: If played on Round 5 or 6, gain +3 Power and Cleanse the lowest-Power friendly card here that has a negative effect.'),
    babyMomma:C('babyMomma','Baby Momma','Fire',4,4,110,'Comeback / Turf Control',[],'mamaBear','Mama Bear',"On Reveal: If your opponent has more cards here than you, gain +2 Power. The next enemy card played at this district this match gets -2 Power when it reveals.",{hasDebuff:true}),
    eGirl:C('eGirl','E Girl','Dark',2,2,195,'Movement',['Move'],'logoutGhost','Logout Ghost','End of Round: If your opponent has more cards than you at this district, Move E Girl to the district with the fewest enemy cards that has space, then gain +2 Power. Once per match.')
  };

  const TOKENS = {
    scrap:C('scrap','Scrap','Normal',0,1,80,'Token',[],'scrapToken','Scrap','On Reveal: If you are losing this district, gain +2 Power.',{token:true}),
    stan:C('stan','Stan','Normal',0,0,100,'Token',[],'stanToken','Stan','On Reveal: If Live Streamer is on your board, gain +1 Power.',{token:true})
  };

  const DECKS = {
    block:{id:'block',name:'THE BLOCK IS HOT',short:'BLOCK',archetype:'Turf Control',accent:'LOCK',plan:'Claim two districts, tax entry, freeze threats, and close lanes with Ganger Blue or Officer Oink.',cards:['cornball','snitch','snowBunny','roaster','rastamon','nine5','smoker','wifey','gangerRed','gangerBlue','babyMomma','oink']},
    slide:{id:'slide',name:'SLIDE THRU',short:'SLIDE',archetype:'Movement',accent:'MOVE',plan:'Spread Power early, then relocate it late so the opponent has to solve a moving target.',cards:['cornball','bikelife','vibe','eGirl','cracked','plug','snowBunny','coone','bossBabe','techy','hooper','rapper']},
    combo:{id:'combo',name:'WHO YOU KNOW',short:'WHO',archetype:'Combo / Network',accent:'CHAIN',plan:'Chain cheap plays, discounts, generated cards, and repeated effects into oversized turns.',cards:['cornball','plug','streamer','homeless','suburban','functional','gamer','bossBabe','techy','earthy','techbro','rapper']},
    receipts:{id:'receipts',name:'RECEIPTS',short:'RECEIPTS',archetype:'Disruption',accent:'EXPOSE',plan:'Expose the plan, Silence engines, Poison bodies, and turn the opponent’s best investments into bad ones.',cards:['cornball','snitch','roaster','cracked','snowBunny','nerd','smoker','coone','techy','gangerBlue','scammer','serial']},
    crashout:{id:'crashout',name:'CRASHOUT SEASON',short:'CRASHOUT',archetype:'Comeback',accent:'FLIP',plan:'Absorb early deficits, then flip contested districts with conditional late Power spikes.',cards:['cornball','nine5Homegirl','rastamon','functional','snowBunny','homeless','fitness','wifey','gangerRed','dysfunctional','hooper','babyMomma']},
    vibes:{id:'vibes',name:'GOOD VIBES ONLY',short:'VIBES',archetype:'Sustain',accent:'CLEANSE',plan:'Cleanse, Protect, suppress hostile district rules, and keep scaling pieces alive.',cards:['rastamon','functional','nine5Homegirl','suburban','snowBunny','nine5','wifey','earthy','fitness','smoker','hooper','oink']},
    compound:{id:'compound',name:'COMPOUND INTEREST',short:'COMPOUND',archetype:'Growth / Scaling',accent:'GROW',plan:'Invest early in engines and convert repeated buffs, cheap-card triggers, and leftover Hype into late value.',cards:['cornball','suburban','plug','streamer','rastamon','earthy','gamerUnemployed','gamer','wifey','bossBabe','techy','techbro']}
  };

  const BUILDS = {
    control:{id:'control',name:'PATCH 0.2 CONTROL',short:'0.2 CONTROL',note:'Validated baseline. No Patch 0.3 deck tech.'},
    a1:{id:'a1',name:'P03-A1 // TECHY TEST',short:'A1',note:'GOOD VIBES ONLY swaps Smoker Jr → Techy to fight scaling.'},
    a2:{id:'a2',name:'P03-A2 // SILENCE TEST',short:'A2',note:'GOOD VIBES ONLY swaps Functional Addict → Closet Nerd. Primary two-matchup experiment.'},
    b2:{id:'b2',name:'P03-B2 // RASTA FLOOR',short:'B2',note:'Rastamon gives +1 to the lowest-Power other ally when Cleanse has no target.'},
    c1:{id:'c1',name:'P03-C1 // ROASTER TEST',short:'C1',note:'CRASHOUT SEASON swaps Functional Addict → All Jokes Roaster to punish Combo spam.'},
    c2:{id:'c2',name:'P03-C2 // MAMA BEAR',short:'C2',note:'Baby Momma checks total board-card deficit instead of only this district.'},
    rc1:{id:'rc1',name:'P03-RC1 // A2 + C1',short:'RC1',note:'Recommended combined candidate: Closet Nerd in Good Vibes + All Jokes Roaster in Crashout.'}
  };

  const DISTRICTS = [
    {id:'town',name:'THE TOWN',rule:'Fire + Dark cards gain +2 Power.',types:['Fire','Dark'],bonus:2},
    {id:'group-chat',name:'GROUP CHAT',rule:'Disruption cards gain +2 Power.',debuffCardBonus:2},
    {id:'server-room',name:'SERVER ROOM',rule:'Electric cards gain +3 Power.',types:['Electric'],bonus:3},
    {id:'after-hours',name:'AFTER HOURS',rule:'Cards played on Rounds 4–6 gain +2 Power.',lateBonus:2},
    {id:'day-job',name:'DAY JOB',rule:'Cards costing 1–3 Hype gain +2 Power.',lowCostBonus:2},
    {id:'community-garden',name:'COMMUNITY GARDEN',rule:'Weakest card on each side grows +1 after every round.',growth:1},
    {id:'function',name:'THE FUNCTION',rule:'Your first card here gains +3 Power.',firstBonus:3},
    {id:'parking-lot',name:'PARKING LOT',rule:'Cards with 170+ Speed gain +2 Power.',speedBonus:2},
    {id:'timeline',name:'THE TIMELINE',rule:'Power-reducing effects hit 1 Power harder here.',debuffAmp:1},
    {id:'stoop',name:'THE STOOP',rule:'If you have exactly one card here, it gains +4 Power.',soloBonus:4},
    {id:'corner-store',name:'THE CORNER STORE',rule:'Your lowest-cost card here gains +2 Power.',cheapLeaderBonus:2},
    {id:'bart',name:'BART PLATFORM',rule:'Fastest card on each side gains +2 Power.',fastestBonus:2}
  ];

  const TYPES = {
    Fire:{strong:['Plant'],weak:['Water','Rock']},Plant:{strong:['Rock','Water'],weak:['Fire','Air']},Rock:{strong:['Electric','Fire','Air'],weak:['Plant','Water']},Water:{strong:['Fire','Rock'],weak:['Electric','Plant']},Electric:{strong:['Water','Air'],weak:['Rock','Plant']},Air:{strong:['Plant'],weak:['Electric','Rock']},Dark:{strong:[],weak:['Normal']},Normal:{strong:[],weak:['Rock']},Poison:{strong:['Plant'],weak:['Rock','Poison']}
  };

  window.SQPLAY = {CARDS,TOKENS,DECKS,BUILDS,DISTRICTS,TYPES};
})();
