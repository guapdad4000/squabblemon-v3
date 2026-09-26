import type { StoryChapter, StoryDialogueLine, StoryNode } from './story';

type Section = 'pre' | 'post' | 'main';
type Addition = {
  readonly chapterId: string;
  readonly nodeId: string;
  readonly section: Section;
  readonly lines: readonly StoryDialogueLine[];
};

const portraits = {
  blue: 'assets/characters/ganger-blue.webp',
  red: 'assets/characters/ganger-red.webp',
  cracked: 'assets/characters/cracked-head.webp',
  babyMomma: 'assets/characters/baby-momma.webp',
  wifey: 'assets/characters/wifey.webp',
  snitch: 'assets/characters/snitch.webp',
  cornball: 'assets/characters/cornball.webp',
  uncle: 'assets/characters/og-uncle.webp',
  auntie: 'assets/characters/church-auntie.webp',
  promoter: 'assets/characters/promoter.webp',
  bottleGirl: 'assets/characters/bottle-girl.webp',
  techbro: 'assets/characters/techbro-rich.webp',
  alley: 'assets/characters/ganger-blue.webp',
  streamer: 'assets/characters/live-streamer.webp',
  delivery: 'assets/characters/delivery-demon.webp',
  roaster: 'assets/characters/all-jokes-roaster.webp',
  lebron: 'assets/characters/lebron-james.webp',
  crafty: 'assets/characters/inmate-crafty.webp',
  informant: 'assets/characters/inmate-informant.webp',
} as const;

const line = (speaker: string, portraitAssetId: string, text: string): StoryDialogueLine => ({
  speaker,
  portraitAssetId,
  text,
});

/** Season Two expansions — longer, more reactive, natural block energy. */
const additions: readonly Addition[] = [
  // ── Chapter 9: The Morning After ───────────────────────────────────────
  {
    chapterId: 's2-the-morning-after', nodeId: 's2-the-morning-after-opening', section: 'main', lines: [
      line('Cornball', portraits.cornball, 'Three trophies, one left shoe, and a crockpot still on WARM. The Crown got consequences and leftovers.'),
      line('Ganger Blue', portraits.blue, 'Put my folding throne by the stairs. I’m retiring it with dignity.'),
      line('Wifey', portraits.wifey, 'It’s six chairs zip-tied together. Carry your dignity one chair at a time.'),
      line('Cracked Head', portraits.cracked, 'Got here early. Little one’s place set before anybody ask.'),
      line('Baby Momma', portraits.babyMomma, 'Good. Saturday at ten, library steps. Snacks you can identify without a logo.'),
      line('Cracked Head', portraits.cracked, 'Ten sharp. Apples, crackers, no entrance music.'),
      line('OG Uncle', portraits.uncle, 'Look at that. Ten o’clock. Setting an alarm for you and a second one for your excuses.'),
      line('Snitch', portraits.snitch, 'Hold the tenderness. Man in white sneakers measuring the roof with his phone.'),
      line('Techbro Rich', portraits.techbro, 'Great energy up here. Authentic wear patterns. You cannot manufacture this distress.'),
      line('Alley Runner', portraits.alley, 'You standing in spilled peach soda.'),
      line('Techbro Rich', portraits.techbro, 'Exactly. Organic patina.'),
      line('Cornball', portraits.cornball, 'Organic patina is what we call it when somebody spill and don’t clean. You not special.'),
      line('Ganger Red', portraits.red, 'State your business before Cornball catalog you as abandoned property.'),
      line('Techbro Rich', portraits.techbro, 'Sale closes soon. Converting this into RichRoof, members-only culture platform.'),
      line('Cornball', portraits.cornball, 'We already got a culture platform. That milk crate. Sometimes it wobble. Still free.'),
      line('Techbro Rich', portraits.techbro, 'Founding memberships ninety-nine dollars. Neighbors get a commemorative discount.'),
      line('Wifey', portraits.wifey, 'A discount to enter the place we cleaned for free? Blue, unfold one chair. I need to sit before I cuss professionally.'),
      line('Baby Momma', portraits.babyMomma, 'Who signed, what exactly transfer, and when you think we leave? Three questions. No pitch deck.'),
      line('Techbro Rich', portraits.techbro, 'Owner’s broker signed the term sheet. Final access after inspection.'),
      line('Ganger Blue', portraits.blue, 'Crown schedule say open play next Friday.'),
      line('Ganger Red', portraits.red, 'A schedule is not a deed. We protect Friday while we learn what was actually promised.'),
      line('Cracked Head', portraits.cracked, 'Then make him put tonight’s setup on the table. We need time to check the paperwork.'),
      line('Techbro Rich', portraits.techbro, 'Fine. Three promotional tables. Win and my launch crew leave tonight’s setup untouched.'),
      line('Wifey', portraits.wifey, 'Say that on Snitch camera, including the word tonight.'),
      line('Snitch', portraits.snitch, 'Already wide, already live, and for once nobody paid me to crop it.'),
      line('Cornball', portraits.cornball, 'Historic. Free content and accountability in the same frame. I’m framing this.'),
    ],
  },
  {
    chapterId: 's2-the-morning-after', nodeId: 's2-rooftop-demo-table', section: 'pre', lines: [
      line('Techbro Rich', portraits.techbro, 'Center district become premium inventory in round three.'),
      line('Cornball', portraits.cornball, 'He put a velvet rope around a chalk square. The audacity got range.'),
      line('Ganger Red', portraits.red, 'Announced term simple: win and his demo rig come down tonight.'),
      line('Wifey', portraits.wifey, 'Don’t trip on his ring light. Actually, let him trip on it.'),
      line('Cornball', portraits.cornball, 'I’m taking odds on the backpack. Premium gravity incoming.'),
      line('Techbro Rich', portraits.techbro, 'The market will speak. Preferably in a dialect that likes me.'),
    ],
  },
  {
    chapterId: 's2-the-morning-after', nodeId: 's2-rooftop-demo-table', section: 'post', lines: [
      line('Techbro Rich', portraits.techbro, 'Demo rig goes. Market spoke in an inconvenient dialect.'),
      line('Cornball', portraits.cornball, 'Velvet rope caught his own backpack. Premium gravity confirmed.'),
      line('Baby Momma', portraits.babyMomma, 'Good. Photograph every label before anything move.'),
      line('Ganger Red', portraits.red, 'Labels first. Stories later. Order of operations.'),
      line('Wifey', portraits.wifey, 'And keep the ring light off. We already got enough drama without the glow.'),
    ],
  },
  {
    chapterId: 's2-the-morning-after', nodeId: 's2-launch-crew-scrimmage', section: 'pre', lines: [
      line('Live Streamer', portraits.streamer, 'Rich promised my channel exclusive rooftop access and a fog machine.'),
      line('Snitch', portraits.snitch, 'Exclusive hard when forty-seven people behind you. Optics is a myth.'),
      line('Baby Momma', portraits.babyMomma, 'Win the announced scrimmage; sponsor crates leave the family corner.'),
      line('Live Streamer', portraits.streamer, 'Fine, but the fog machine is emotionally essential.'),
      line('Cornball', portraits.cornball, 'Emotionally essential fog. File that under “things we never needed.”'),
      line('Snitch', portraits.snitch, 'I’m live either way. Fog or no fog, the ratio don’t care about your feelings.'),
    ],
  },
  {
    chapterId: 's2-the-morning-after', nodeId: 's2-launch-crew-scrimmage', section: 'post', lines: [
      line('Live Streamer', portraits.streamer, 'Crates moving. Fog machine stay off till it stop coughing.'),
      line('Snitch', portraits.snitch, 'It coughed glitter into Rich sparkling water. Content gold.'),
      line('Ganger Blue', portraits.blue, 'Family corner clear. Keep it clear.'),
      line('Baby Momma', portraits.babyMomma, 'Clear is the only setting that work around here.'),
      line('Cornball', portraits.cornball, 'Glitter water is now evidence. Don’t drink the exhibit.'),
    ],
  },
  {
    chapterId: 's2-the-morning-after', nodeId: 's2-first-night-watch', section: 'pre', lines: [
      line('Delivery Demon', portraits.delivery, 'Six work orders and three different addresses for this same roof.'),
      line('Alley Runner', portraits.alley, 'Then the contest decide whose inventory stage by the stairs, not who own anything.'),
      line('Delivery Demon', portraits.delivery, 'Winner pick the safe loading lane. Loser carry the inflatable R.'),
      line('Cornball', portraits.cornball, 'Why is there an inflatable R?'),
      line('Delivery Demon', portraits.delivery, 'RichRoof branding. Second R escaped on the expressway.'),
      line('Cornball', portraits.cornball, 'So we missing a letter and a plan. Classic.'),
      line('Alley Runner', portraits.alley, 'Safe lane first. Missing letters later.'),
    ],
  },
  {
    chapterId: 's2-the-morning-after', nodeId: 's2-first-night-watch', section: 'post', lines: [
      line('Delivery Demon', portraits.delivery, 'Safe lane yours. Logging the conflicting orders instead of dumping boxes.'),
      line('Alley Runner', portraits.alley, 'Give me copies. Routes tell the truth people forget to mention.'),
      line('Cornball', portraits.cornball, 'Inflatable R now wearing Blue crown. Nobody touch it. It’s art.'),
      line('Ganger Blue', portraits.blue, 'That crown was retired with dignity.'),
      line('Cornball', portraits.cornball, 'Dignity temporary. Inflatable R permanent. Deal with it.'),
    ],
  },
  {
    chapterId: 's2-the-morning-after', nodeId: 's2-the-morning-after-closing', section: 'main', lines: [
      line('Ganger Red', portraits.red, 'This don’t cancel a sale. It document a contradiction and buy us a clean inspection.'),
      line('Baby Momma', portraits.babyMomma, 'Copies go to the owner, every tenant contact, and nobody private family thread.'),
      line('Ganger Blue', portraits.blue, 'I wanted the Crown to fix this cause wearing it was easier than asking for help.'),
      line('Wifey', portraits.wifey, 'Growth is noticing that before you build another chair throne.'),
      line('Cracked Head', portraits.cracked, 'Night watch covered. I leave at nine-fifteen for Saturday snacks.'),
      line('OG Uncle', portraits.uncle, 'And I’m alive, awake, and taking the midnight shift with a thermos.'),
      line('Cornball', portraits.cornball, 'Assigned the inflatable R second watch. No eyelids. Ideal employee.'),
      line('Snitch', portraits.snitch, 'Rich gone for tonight. His paperwork is not.'),
      line('Alley Runner', portraits.alley, 'Tomorrow we raise money, fix what is ours to fix, and make leaving us harder than listening.'),
      line('Wifey', portraits.wifey, 'Everybody pick up something heavy. Including Blue expectations.'),
      line('Ganger Blue', portraits.blue, 'I heard that. I’m picking up chairs. One at a time. Like she said.'),
      line('Cornball', portraits.cornball, 'Progress. Slow, visible, and slightly embarrassing. My favorite kind.'),
    ],
  },

  // ── Chapter 10: The Rent Party ─────────────────────────────────────────
  {
    chapterId: 's2-the-rent-party', nodeId: 's2-the-rent-party-opening', section: 'main', lines: [
      line('Bottle Girl', portraits.bottleGirl, 'I booked a rent party, a fish fry, and a silent auction. Unfortunately they all in the same hour.'),
      line('Cornball', portraits.cornball, 'The auction not silent. Roaster heckling a lamp.'),
      line('All Jokes Roaster', portraits.roaster, 'That lamp know what it did.'),
      line('Wifey', portraits.wifey, 'Money got one purpose: inspection repairs and a community-use deposit if the owner agree.'),
      line('Ganger Blue', portraits.blue, 'I made wristbands.'),
      line('Baby Momma', portraits.babyMomma, 'You made colors again. Tear them in half and write RECEIPT on both sides.'),
      line('Ganger Blue', portraits.blue, 'That less majestic.'),
      line('Wifey', portraits.wifey, 'That’s why it might work.'),
      line('Cornball', portraits.cornball, 'Majestic never paid a bill out here. Receipts do.'),
      line('Bottle Girl', portraits.bottleGirl, 'Then let’s make some receipts before the fryer smoke become ambience.'),
    ],
  },
  {
    chapterId: 's2-the-rent-party', nodeId: 's2-fish-fry-fade', section: 'pre', lines: [
      line('Bottle Girl', portraits.bottleGirl, 'Winner run the serving lane; loser keep the fryer line moving.'),
      line('Church Auntie', portraits.auntie, 'And nobody call grease smoke ambience.'),
      line('All Jokes Roaster', portraits.roaster, 'I brought premium tartar sauce in a mustard bottle.'),
      line('Baby Momma', portraits.babyMomma, 'That sentence is why we inventory everything.'),
      line('Cornball', portraits.cornball, 'Mustard bottle of secrets. I’m labeling it EVIDENCE just in case.'),
      line('Bottle Girl', portraits.bottleGirl, 'Label it later. Serve now. Line getting long.'),
    ],
  },
  {
    chapterId: 's2-the-rent-party', nodeId: 's2-fish-fry-fade', section: 'post', lines: [
      line('Bottle Girl', portraits.bottleGirl, 'Serving lane yours. Cleared enough for the electrician deposit.'),
      line('Church Auntie', portraits.auntie, 'Count it twice, then wash your hands twice.'),
      line('All Jokes Roaster', portraits.roaster, 'The lamp sold. I accept partial credit.'),
      line('Cornball', portraits.cornball, 'Partial credit is still credit. I’m logging it under “lamp justice.”'),
      line('Baby Momma', portraits.babyMomma, 'Log the money first. Justice can wait till the hands clean.'),
    ],
  },
  {
    chapterId: 's2-the-rent-party', nodeId: 's2-auction-interruption', section: 'pre', lines: [
      line('Promoter', portraits.promoter, 'My VIP auction can double this money if I get naming rights.'),
      line('Wifey', portraits.wifey, 'You may name one folding table for one evening.'),
      line('Promoter', portraits.promoter, 'Winner choose the public event slot. Terms posted.'),
      line('Cornball', portraits.cornball, 'I nominate Table Formerly Known as Sticky.'),
      line('Ganger Blue', portraits.blue, 'That table got history. Respect the stickiness.'),
      line('Wifey', portraits.wifey, 'History or not, the slot stay public. No private colors tonight.'),
    ],
  },
  {
    chapterId: 's2-the-rent-party', nodeId: 's2-auction-interruption', section: 'post', lines: [
      line('Promoter', portraits.promoter, 'Open slot stay public. My logo get the underside of one table.'),
      line('Cornball', portraits.cornball, 'Prime gum-facing placement. Prestigious.'),
      line('Ganger Blue', portraits.blue, 'Receipts match the cash box. I checked without moving anybody name.'),
      line('Wifey', portraits.wifey, 'Look at you. Checking without editing. Growth.'),
      line('Cornball', portraits.cornball, 'Growth and gum. The two pillars of this operation.'),
    ],
  },
  {
    chapterId: 's2-the-rent-party', nodeId: 's2-pledge-drive-final', section: 'pre', lines: [
      line('Ganger Blue', portraits.blue, 'Last table decide whether my livestream marathon or Wifey repair list get top billing.'),
      line('Wifey', portraits.wifey, 'The money follow the published list either way. We playing for the microphone.'),
      line('Baby Momma', portraits.babyMomma, 'Say it again for the people trained by last season.'),
      line('Ganger Blue', portraits.blue, 'Cards decide the microphone. Receipts decide the money. Damn, I heard myself grow.'),
      line('Cornball', portraits.cornball, 'Growth with a live mic. Dangerous combination. I’m recording just in case.'),
      line('Wifey', portraits.wifey, 'Record the totals. Not the speech.'),
    ],
  },
  {
    chapterId: 's2-the-rent-party', nodeId: 's2-pledge-drive-final', section: 'post', lines: [
      line('Ganger Blue', portraits.blue, 'Take the microphone. I’ll read the totals instead.'),
      line('Wifey', portraits.wifey, 'Read every expense, including your twelve-dollar metallic marker.'),
      line('Cornball', portraits.cornball, 'That marker signed one receipt and my forehead. Mixed value.'),
      line('Ganger Blue', portraits.blue, 'The forehead was collateral. I accept the charge.'),
      line('Baby Momma', portraits.babyMomma, 'Collateral accepted. Now count the rest out loud so everybody hear the real number.'),
    ],
  },
  {
    chapterId: 's2-the-rent-party', nodeId: 's2-the-rent-party-closing', section: 'main', lines: [
      line('Bottle Girl', portraits.bottleGirl, 'After food costs, we got the electrician deposit and enough for safety rail materials.'),
      line('Baby Momma', portraits.babyMomma, 'Not enough for a purchase offer. Say the number without dressing it up.'),
      line('Ganger Blue', portraits.blue, 'Three thousand, two hundred, eighteen dollars and a Canadian quarter.'),
      line('Cornball', portraits.cornball, 'The quarter earmarked for international expansion.'),
      line('Wifey', portraits.wifey, 'It earmarked for the jar.'),
      line('Cracked Head', portraits.cracked, 'I missed teardown once. Not tonight. Point me at the tables.'),
      line('Baby Momma', portraits.babyMomma, 'Start with the one your child covered in removable stickers.'),
      line('Cracked Head', portraits.cracked, 'Removable by whom? These got structural confidence.'),
      line('OG Uncle', portraits.uncle, 'You showed up for teardown. Keep doing that when there isn’t a camera.'),
      line('Church Auntie', portraits.auntie, 'Tomorrow we repair the roof. Tonight take home the fish before Cornball auction it again.'),
      line('Cornball', portraits.cornball, 'I was only taking bids. The fish still got rights.'),
      line('Wifey', portraits.wifey, 'The fish got a ride home. You got mop duty. Fair trade.'),
    ],
  },

  // ── Later Season Two key beats (condensed expansion for remaining chapters) ──
  {
    chapterId: 's2-unlicensed-improvements', nodeId: 's2-unlicensed-improvements-opening', section: 'main', lines: [
      line('Ganger Blue', portraits.blue, 'I was just measuring. Measuring is not a crime.'),
      line('Wifey', portraits.wifey, 'Measuring with a livestream and a caption that say “vision board” is a different charge.'),
      line('Cornball', portraits.cornball, 'I printed STOP BLUE FROM LIVESTREAMING ONCE in three fonts. Narrow one still available.'),
      line('Cracked Head', portraits.cracked, 'We fixing the rail. Not the narrative. Tools first.'),
      line('OG Uncle', portraits.uncle, 'And no more “vision” until the inspector leave with a signed paper.'),
    ],
  },
  {
    chapterId: 's2-regular-guy-behavior', nodeId: 's2-regular-guy-open', section: 'pre', lines: [
      line('Regular guy named LeBron James', portraits.lebron, 'I fix appliances. That’s the whole bio. The name is a paperwork accident.'),
      line('Snitch', portraits.snitch, 'Paperwork accident currently trending. My mentions on fire.'),
      line('Cornball', portraits.cornball, 'Regular guy named LeBron James. I’m putting that on a name tag and a museum plaque.'),
      line('Wifey', portraits.wifey, 'He came to fix a fridge. Not to be content. Let the man work.'),
      line('Regular guy named LeBron James', portraits.lebron, 'Fridge first. Autographs never. I got a wrench and a boundary.'),
    ],
  },
  {
    chapterId: 's2-museum-of-the-block', nodeId: 's2-curators-table', section: 'pre', lines: [
      line('Cornball', portraits.cornball, 'This table is the archive. Everything got a date or it don’t get a shelf.'),
      line('Inmate Crafty', portraits.crafty, 'My tiny chairs need secure display. They survived worse than this roof.'),
      line('Inmate Informant', portraits.informant, 'And a corrected glue credit. I been erased before. Not again.'),
      line('Baby Momma', portraits.babyMomma, 'No child photos in the public case. Ever. That’s the only non-negotiable.'),
      line('Ganger Red', portraits.red, 'Agreed. History without the private parts. We can do both.'),
    ],
  },
  {
    chapterId: 's2-the-blockbuster', nodeId: 's2-blockbuster-final', section: 'pre', lines: [
      line('Techbro Rich', portraits.techbro, 'One farewell exhibition. Winner get premiere billing on the archive.'),
      line('Ganger Red', portraits.red, 'Billing only. Lease, history, and public access settled elsewhere.'),
      line('Techbro Rich', portraits.techbro, 'Yes, counsel. I understand the nouns.'),
      line('Snitch', portraits.snitch, 'Full feed, source credits visible, comments locked for public safety.'),
      line('Cornball', portraits.cornball, 'I made popcorn in the fog machine. Tastes like batteries and ambition.'),
      line('Wifey', portraits.wifey, 'Ambition can wait. This match is for the record, not the launch.'),
    ],
  },
  {
    chapterId: 's2-the-blockbuster', nodeId: 's2-blockbuster-final', section: 'post', lines: [
      line('Techbro Rich', portraits.techbro, 'Use the title. Your cooperative outperformed my launch.'),
      line('Baby Momma', portraits.babyMomma, 'We paid the deposit while you was rehearsing your entrance. Check your phone.'),
      line('Ganger Blue', portraits.blue, 'And cause your inflatable letters had weak governance.'),
      line('Wifey', portraits.wifey, 'Let me enjoy this before you say governance again.'),
      line('Cornball', portraits.cornball, 'Governance, popcorn, and a deflated R. Peak block cinema.'),
    ],
  },
  {
    chapterId: 's2-the-blockbuster', nodeId: 's2-the-blockbuster-closing', section: 'main', lines: [
      line('Ganger Red', portraits.red, 'Lease countersigned. Deposit received. Public-use schedule attached as an enforceable exhibit.'),
      line('Church Auntie', portraits.auntie, 'Keys go to three rotating stewards, not one loud pocket.'),
      line('Ganger Blue', portraits.blue, 'I get Tuesdays for setup, supervised by Wifey and anybody with eyes.'),
      line('Wifey', portraits.wifey, 'Correct.'),
      line('Cracked Head', portraits.cracked, 'I get maintenance Saturdays after parenting time, unless Baby Momma change the plan with me.'),
      line('Baby Momma', portraits.babyMomma, 'Ten means ten. Bring the little fork this time.'),
      line('OG Uncle', portraits.uncle, 'I get to sit here alive and watch both my sons carry tables without calling it a throne.'),
      line('Cornball', portraits.cornball, 'The museum milk crate get permanent residency. It contributed more than several adults.'),
      line('Inmate Crafty', portraits.crafty, 'My tiny chairs need a secure display.'),
      line('Inmate Informant', portraits.informant, 'And a corrected glue credit.'),
      line('Snitch', portraits.snitch, 'Archive title: THE BLOCKBUSTER. Sources listed before my channel.'),
      line('Alley Runner', portraits.alley, 'Partner venues keep their signed hours. Those three doors stay open. Not making the next kid cross town for one working court.'),
      line('Ganger Blue', portraits.blue, 'Player, you won the exhibition. The community won the boring paperwork.'),
      line('Wifey', portraits.wifey, 'We won a roof. You still on mop duty.'),
      line('Cornball', portraits.cornball, 'Speaking of stupid: the old theater downstairs just mailed us a film reel with no return address.'),
      line('Ganger Red', portraits.red, 'Label say MISSING MOTION.'),
      line('Snitch', portraits.snitch, 'That sound like a premiere.'),
      line('Baby Momma', portraits.babyMomma, 'It sound like you ask permission before filming.'),
      line('Snitch', portraits.snitch, 'It sound like a responsibly documented premiere.'),
      line('Church Auntie', portraits.auntie, 'Tomorrow. Tonight we eat under a roof the block can actually use.'),
      line('OG Uncle', portraits.uncle, 'Set my plate by the window. I plan to be here for the sequel.'),
      line('Cornball', portraits.cornball, 'Sequel already got a title. And a milk crate. We’re ready.'),
    ],
  },
];

function appendToNode(node: StoryNode, matching: readonly Addition[]): StoryNode {
  let expanded = node;
  for (const addition of matching) {
    if (expanded.kind === 'battle') {
      if (addition.section === 'pre') expanded = { ...expanded, preDialogue: [...expanded.preDialogue, ...addition.lines] };
      if (addition.section === 'post') expanded = { ...expanded, postDialogue: [...expanded.postDialogue, ...addition.lines] };
    } else if (addition.section === 'main') {
      expanded = { ...expanded, scenes: [...expanded.scenes, ...addition.lines] };
    }
  }
  return expanded;
}

/** Appends Season Two authored dialogue without mutating chapters or gameplay fields. */
export function expandSeasonTwoDialogue(chapters: readonly StoryChapter[]): readonly StoryChapter[] {
  return chapters.map((chapter) => {
    const chapterAdditions = additions.filter((addition) => addition.chapterId === chapter.id);
    if (!chapterAdditions.length) return chapter;
    return {
      ...chapter,
      nodes: chapter.nodes.map((node) =>
        appendToNode(node, chapterAdditions.filter((addition) => addition.nodeId === node.id))),
    };
  });
}
