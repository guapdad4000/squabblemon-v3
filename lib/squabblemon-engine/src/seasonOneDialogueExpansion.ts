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
  scammer: 'assets/characters/scammer.webp',
  alley: 'assets/characters/ganger-blue.webp',
} as const;

const line = (speaker: string, portraitAssetId: string, text: string): StoryDialogueLine => ({
  speaker,
  portraitAssetId,
  text,
});

// These additions deliberately target the end of existing arrays. Array-position
// dialogue tokens for the shipped screenplay therefore remain stable.
const additions: readonly Addition[] = [
  {
    chapterId: 'blue-side-blues', nodeId: 'wifeys-push', section: 'pre', lines: [
      line('Cornball', portraits.cornball, 'For the record, the folding-chair throne has cup holders and no constitutional authority.'),
      line('Ganger Blue', portraits.blue, 'It has lumbar support. Leadership needs infrastructure.'),
      line('Wifey', portraits.wifey, 'Leadership is carrying your own chair to your father’s door.'),
      line('Cornball', portraits.cornball, 'I have removed the two chairs he called the executive balcony.'),
      line('Ganger Blue', portraits.blue, 'Everybody touching my government furniture is getting noted.'),
    ],
  },
  {
    chapterId: 'blue-side-blues', nodeId: 'og-uncles-visit', section: 'main', lines: [
      line('Cornball', portraits.cornball, 'I left the event clipboard outside. It kept trying to make this meeting official.'),
      line('OG Uncle', portraits.uncle, 'Leave the empty chair where it is. A missing person shaped this room for four years.'),
      line('Ganger Blue', portraits.blue, 'Then do not ask me to fill it before you answer me.'),
      line('Wifey', portraits.wifey, 'Nobody asked you to replace him. Sit in your own chair and stay.'),
      line('Ganger Blue', portraits.blue, 'I am sitting. That is all I can promise tonight.'),
    ],
  },
  {
    chapterId: 'side-show', nodeId: 'the-scammers-pitch', section: 'post', lines: [
      line('Scammer', portraits.scammer, 'The WARTERMARK edition is now a collector’s mistake. Price just went up.'),
      line('Ganger Red', portraits.red, 'Put the original timestamp on the screen. Large enough to survive your sales pitch.'),
      line('Cornball', portraits.cornball, 'I brought a label maker. It has printed LIAR in three tasteful fonts.'),
      line('Scammer', portraits.scammer, 'Use the narrow one. The wide font feels personal.'),
    ],
  },
  {
    chapterId: 'side-show', nodeId: 'the-real-receipts', section: 'main', lines: [
      line('Snitch', portraits.snitch, 'I turned twelve seconds into a whole economy. Here is the file before my logo learned to walk.'),
      line('Ganger Red', portraits.red, 'Keep your logo on your apology. Keep it off the source.'),
      line('Ganger Blue', portraits.blue, 'The missing beginning was me handing over the address. Do not crop that sentence.'),
      line('Wifey', portraits.wifey, 'And do not crop me saying I knew he handed it over.'),
      line('Church Auntie', portraits.auntie, 'Good. The screen is finally wide enough for everybody’s responsibility. Turn it off and go speak to his father.'),
    ],
  },
  {
    chapterId: 'old-heads-know', nodeId: 'the-old-heads-convene', section: 'post', lines: [
      line('Cornball', portraits.cornball, 'I labeled the evidence plate EVIDENCE and the dinner plate NOT EVIDENCE.'),
      line('Church Auntie', portraits.auntie, 'You labeled my good platter.'),
      line('Cornball', portraits.cornball, 'The platter was dangerously persuasive.'),
      line('Baby Momma', portraits.babyMomma, 'Move every plate. I want a clear table when the rescue story starts.'),
      line('OG Uncle', portraits.uncle, 'Clear it. Nobody needs props for what I am about to own.'),
    ],
  },
  {
    chapterId: 'old-heads-know', nodeId: 'og-uncles-verdict', section: 'post', lines: [
      line('Ganger Blue', portraits.blue, 'I wanted him out of my way. You kept him alive and made the whole block grieve him.'),
      line('OG Uncle', portraits.uncle, 'Yes. My rescue does not erase my lie, and your confession does not borrow my excuse.'),
      line('Cracked Head', portraits.cracked, 'And surviving does not turn four years of my silence into a sacrifice.'),
      line('Baby Momma', portraits.babyMomma, 'Now the harms have names. Do not stack them into one family-size apology.'),
      line('Church Auntie', portraits.auntie, 'Leave the empty chair here. Tomorrow, each of you comes back with your own work.'),
    ],
  },
  {
    chapterId: 'the-function', nodeId: 'function-opening', section: 'pre', lines: [
      line('Bottle Girl', portraits.bottleGirl, 'Volunteer plates are left, contender bands are right, and Blue’s reserved section has become six regular chairs.'),
      line('Ganger Blue', portraits.blue, 'Those chairs were a hospitality concept.'),
      line('Wifey', portraits.wifey, 'Your concept had velvet rope from a bathrobe.'),
      line('Cornball', portraits.cornball, 'I cut it into six napkin rings. The people have reclaimed luxury.'),
      line('Bottle Girl', portraits.bottleGirl, 'Beautiful. Now reclaim the entrance before this line reaches traffic.'),
    ],
  },
  {
    chapterId: 'the-function', nodeId: 'function-after-hours', section: 'main', lines: [
      line('Promoter', portraits.promoter, 'Shared access terms: one published list, witnessed changes, no private color test.'),
      line('Ganger Blue', portraits.blue, 'I signed it. Do not frame the pen.'),
      line('Wifey', portraits.wifey, 'I am framing the copy, because tomorrow you may develop selective handwriting.'),
      line('Snitch', portraits.snitch, 'My camera caught the signature and Cornball stealing a napkin ring.'),
      line('Cornball', portraits.cornball, 'Reclaiming. We established the legal theory at the door.'),
    ],
  },
  {
    chapterId: 'return-of-the-block', nodeId: 'snitchs-roll-call', section: 'pre', lines: [
      line('Snitch', portraits.snitch, 'One list says Cracked Head. The newer one says CRACKED CHAIR in correction fluid.'),
      line('Promoter', portraits.promoter, 'That is not a typo. The chair is not seeded.'),
      line('Cornball', portraits.cornball, 'It has a strong record, but no government name.'),
      line('Wifey', portraits.wifey, 'Hold both pages to the light. Somebody erased a contender and forgot paper can testify.'),
      line('Snitch', portraits.snitch, 'Paper testimony is terrible for watch time and excellent for consequences.'),
    ],
  },
  {
    chapterId: 'return-of-the-block', nodeId: 'blue-restores-the-list', section: 'post', lines: [
      line('Ganger Blue', portraits.blue, 'His name is back. Mine is struck from the title match, and the penalty stays.'),
      line('Promoter', portraits.promoter, 'I stamped both changes before the ink could become a speech.'),
      line('Cracked Head', portraits.cracked, 'You did not hand me your place. You returned mine.'),
      line('Wifey', portraits.wifey, 'There. A correction with a cost and no folding-chair podium.'),
      line('Cornball', portraits.cornball, 'I had the podium ready, but accountability has ruined another rental opportunity.'),
    ],
  },
  {
    chapterId: 'the-crown', nodeId: 'crown-cornballs-table', section: 'post', lines: [
      line('Cornball', portraits.cornball, 'Four years, three appeals, and the vending machine has refunded one sparkling water.'),
      line('Alley Runner', portraits.alley, 'You spent more on certified mail than the drink.'),
      line('Cornball', portraits.cornball, 'Justice has overhead.'),
      line('Ganger Blue', portraits.blue, 'Put the bottle on the open table. First round is for whoever needs a seat.'),
      line('Cornball', portraits.cornball, 'Shared access and shared bubbles. The Crown is already abusing my settlement.'),
    ],
  },
  {
    chapterId: 'the-crown', nodeId: 'crown-community-meal', section: 'main', lines: [
      line('Cracked Head', portraits.cracked, 'The small plate is set. I got here early enough to ask where it belongs.'),
      line('Baby Momma', portraits.babyMomma, 'Tomorrow, early means breakfast before school. Tonight, it means listen and pass the rice.'),
      line('Ganger Blue', portraits.blue, 'Take your time. I’ll show you where Church Auntie hides the extra forks.'),
      line('Church Auntie', portraits.auntie, 'I do not hide forks. I hide them from Cornball specifically.'),
      line('Cornball', portraits.cornball, 'The rooftop gets sold and suddenly everybody audits the silverware.'),
      line('Promoter', portraits.promoter, 'The sale is real. So is the schedule we built. Tomorrow we defend the gathering place without pretending the Crown owns it.'),
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

/** Appends authored dialogue without mutating chapters or changing any gameplay fields. */
export function expandSeasonOneDialogue(chapters: readonly StoryChapter[]): readonly StoryChapter[] {
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