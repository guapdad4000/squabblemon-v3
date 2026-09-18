import { cards, completeEngineCrew } from './data';
import type { StoryEncounterSnapshot } from './gameEngine';
import chapterTwoDraft from './storyChapters/chapterTwo.json';
import type { StoryChapter, StoryDialogueLine, StoryNode, StoryReward } from './story';

// Chapter One's playable continuity is the source of truth. The September 17
// screenplay supplies locations, opponents and comic situations for 3–7; its
// later survival reveal and second pregnancy are deliberately not repeated.
type Speech = readonly [speaker: string, text: string];
type Beat = {
  id: string;
  title: string;
  before: readonly Speech[];
  after?: readonly Speech[];
  opponent?: string;
  deck?: readonly string[];
  battleType?: 'guided' | 'standard' | 'rule-twist' | 'mini-boss' | 'boss';
  modifiers?: StoryEncounterSnapshot['modifiers'];
  phases?: StoryEncounterSnapshot['phases'];
  kind?: 'dialogue' | 'reward';
  optional?: boolean;
  afterNode?: string;
  rewards?: readonly StoryReward[];
  venue?: string;
};
type ChapterPlan = { id: string; order: number; title: string; subtitle: string; description: string; map: string; venue: string; beats: readonly Beat[] };

const portraitSlugs: Record<string, string> = {
  'Ganger Blue': 'ganger-blue', 'Ganger Red': 'ganger-red',
  'Cracked Head': 'cracked-head', 'Baby Momma': 'baby-momma',
  Wifey: 'wifey', Snitch: 'snitch', Cornball: 'cornball',
  'Alley Runner': 'ganger-blue', 'OG Uncle': 'og-uncle',
  'Church Auntie': 'church-auntie', 'All Jokes Roaster': 'all-jokes-roaster',
  Scammer: 'scammer', 'Nail Tech': 'nail-tech', Hooper: 'hooper',
  'Bottle Girl': 'bottle-girl', Promoter: 'promoter',
  'Live Streamer': 'live-streamer', 'Officer Oink': 'officer-oink',
  'Delivery Demon': 'delivery-demon',
};
const portrait = (speaker: string) => `assets/characters/${portraitSlugs[speaker] ?? 'cornball'}.webp`;
const dialogue = (lines: readonly Speech[]): StoryDialogueLine[] => lines.map(([speaker, text]) => ({ speaker, portraitAssetId: portrait(speaker), text }));
const deckBlue = ['cornball', 'snow', 'roaster', 'rastamon', 'wifey', 'oink', 'baby'];
const deckRed = ['cornball', 'bikelife', 'vibe', 'plug', 'snow', 'hooper', 'baby'];
const deckReceipts = ['cornball', 'roaster', 'nerd', 'snow', 'plug', 'baby', 'hooper'];
const deckFamily = ['baby', 'wifey', 'og', 'cornball', 'snow', 'hooper', 'rastamon'];
const deckMedia = ['streamer', 'gamer', 'techbro', 'plug', 'nerd', 'snow', 'roaster'];
const deckFinal = ['cornball', 'plug', 'streamer', 'gamer', 'techbro', 'vibe', 'wifey'];
const stars = [
  { id: 'win', description: 'Win the encounter.' },
  { id: 'districts', description: 'Finish holding all three districts.' },
  { id: 'squabble', description: 'Win without using SQUABBLE.' },
] as const;
const soundHooks = { intro: 'story.encounter.intro', play: 'story.card.play', phase: 'story.boss.phase', victory: 'story.victory', defeat: 'story.defeat' };
const cinematic = (venue: string) => ({
  videoAssetId: 'assets/story/chapter-one/media/standard-clash.mp4',
  posterAssetId: 'assets/story/chapter-one/media/standard-clash.webp',
  environmentAssetId: `assets/venues/${venue}.webp`,
});
const xp = (amount: number): StoryReward => ({ kind: 'currency', id: 'street-xp', amount });
const chapterNumberWords: Record<number, string> = { 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight' };
const key = (number: number): StoryReward => ({ kind: 'chapter-key', id: `story-key:chapter-${chapterNumberWords[number]}`, amount: 1 });
const phase = (id: string, round: number, amount: number): NonNullable<StoryEncounterSnapshot['phases']>[number] => ({
  id, name: id.replace(/-/g, ' '), description: `At round ${round}, the opponent gains ${amount} Motion once.`,
  trigger: { kind: 'round', atLeast: round }, onEnter: [{ kind: 'motion', owner: 'cpu', amount }],
});

function buildChapter(plan: ChapterPlan): StoryChapter {
  const required = plan.beats.filter((beat) => !beat.optional);
  let previousRequired: string | undefined;
  const nodes: StoryNode[] = plan.beats.map((beat) => {
    const index = required.indexOf(beat);
    const position = beat.optional
      ? { x: 53, y: 82 }
      : { x: Math.round(7 + 87 * index / Math.max(1, required.length - 1)), y: Math.round(79 - 69 * index / Math.max(1, required.length - 1)) };
    const prerequisites = beat.afterNode ? [beat.afterNode] : previousRequired ? [previousRequired] : [];
    if (!beat.optional) previousRequired = beat.id;
    const venue = beat.venue ?? plan.venue;
    const base = {
      id: beat.id, title: beat.title, mapPosition: position, prerequisites,
      optional: Boolean(beat.optional), rewards: beat.rewards ?? (beat.opponent ? [xp(beat.battleType === 'boss' ? 200 : 90)] : []),
      cinematic: cinematic(venue),
      teaching: { tips: [beat.opponent ? 'Win the match to advance this story.' : 'Continue the story at your own pace.'], focusMechanics: [beat.battleType === 'rule-twist' ? 'district rules' : 'story progression'], focusCards: ['cornball'] },
    };
    if (!beat.opponent) return { ...base, kind: beat.kind ?? 'dialogue', scenes: dialogue(beat.before) };
    const selected = beat.deck ?? deckBlue;
    const encounter: StoryEncounterSnapshot = {
      id: beat.id,
      enemy: { id: `${beat.id}:enemy`, name: beat.opponent, portraitAssetId: portrait(beat.opponent), deckId: `${beat.id}-deck`, cardIds: completeEngineCrew(selected), behaviorProfile: beat.battleType === 'boss' ? 'combo-boss' : 'balanced' },
      battlefieldAssetId: cinematic(venue).environmentAssetId,
      cinematic: cinematic(venue), soundHooks,
      modifiers: beat.modifiers ?? {}, phases: beat.phases ?? [], starObjectives: stars,
    };
    return { ...base, kind: 'battle', battleType: beat.battleType ?? 'standard', encounter,
      preDialogue: dialogue(beat.before), postDialogue: dialogue(beat.after ?? [[beat.opponent, 'Good game. The next table is waiting.']]),
      starObjectives: stars, recommendedCollection: ['cornball', 'snow', 'rastamon'] };
  });
  return { id: plan.id, order: plan.order, title: plan.title, subtitle: plan.subtitle, description: plan.description,
    mapAssetId: `assets/layered/${plan.map}.webp`, prerequisites: [plan.order === 3 ? 'red-side-tapes' : chapterIds[plan.order - 1]], nodes };
}
const chapterIds: Record<number, string> = { 2: 'red-side-tapes', 3: 'blue-side-blues', 4: 'side-show', 5: 'old-heads-know', 6: 'the-function', 7: 'return-of-the-block', 8: 'the-crown' };

// The authored Chapter Two JSON is complete dialogue and encounter data. Its
// seven-card draft decks are filled to the current ten-card engine rule, and
// all missing video/map paths resolve to approved existing 2D fallback art.
const chapterTwoBase = chapterTwoDraft as unknown as StoryChapter;
const chapterTwoNodes = chapterTwoBase.nodes.map((node): StoryNode => {
  const venue = node.id === 'red-tapes-let-her-grieve' || node.id === 'red-tapes-mama-has-the-floor' || node.id === 'red-tapes-open-the-envelope'
    ? 'crown-rooftop-court' : 'red-fence-night-court';
  const next = { ...node, cinematic: cinematic(venue) };
  if (next.kind !== 'battle') return next.kind === 'reward'
    ? { ...next, rewards: [...next.rewards, { kind: 'pack-ticket', id: 'street-pack-ticket', amount: 1 }] }
    : next;
  return { ...next, encounter: { ...next.encounter, enemy: { ...next.encounter.enemy, cardIds: completeEngineCrew(next.encounter.enemy.cardIds) }, battlefieldAssetId: cinematic(venue).environmentAssetId, cinematic: cinematic(venue) } };
});
const alleyInterlude: StoryNode = {
  id: 'red-tapes-courier-table', title: 'Courier Table', kind: 'battle', battleType: 'standard',
  mapPosition: { x: 36, y: 81 }, prerequisites: ['red-tapes-red-side-open'], optional: true, rewards: [xp(75)],
  cinematic: cinematic('corner-store-court'),
  teaching: { tips: ['This optional table does not block the Red Side Gauntlet.'], focusMechanics: ['movement'], focusCards: ['bikelife'] },
  encounter: { id: 'red-tapes-courier-table', enemy: { id: 'red-tapes-courier-table:enemy', name: 'Alley Runner', portraitAssetId: portrait('Alley Runner'), deckId: 'red-tapes-courier-table-deck', cardIds: completeEngineCrew(deckRed), behaviorProfile: 'movement' }, battlefieldAssetId: cinematic('corner-store-court').environmentAssetId, cinematic: cinematic('corner-store-court'), soundHooks, modifiers: {}, phases: [], starObjectives: stars },
  preDialogue: dialogue([['Alley Runner', 'Everybody is selling a version of that recording. I am delivering event flyers. Different job.'], ['Cornball', 'Does the flyer mention my cheese appeal?'], ['Alley Runner', 'Win this table and I will let you read the back.']]),
  postDialogue: dialogue([['Alley Runner', 'You earned the side route. The message still belongs to Baby Momma.'], ['Cornball', 'The back says volunteers needed. That is somehow worse.']]),
  starObjectives: stars, recommendedCollection: ['bikelife', 'vibe', 'cornball'],
};
export const chapterTwo: StoryChapter = { ...chapterTwoBase, mapAssetId: 'assets/layered/red-court.webp',
  nodes: [...chapterTwoNodes.slice(0, 2), alleyInterlude, ...chapterTwoNodes.slice(2)] };

const plans: ChapterPlan[] = [
  { id: 'blue-side-blues', order: 3, title: 'Chapter Three: Blue Side Blues', subtitle: 'Some doors are harder than districts.',
    description: 'Keep the Blue Side event open while Blue finally visits his father.', map: 'moon-rooftop', venue: 'harbor-skyline-court', beats: [
      { id: 'blue-in-denial', title: 'Blue in Denial', opponent: 'Ganger Blue', deck: deckBlue,
        before: [['Ganger Blue', "I carried Blue Side while everybody else called it a memorial. Now you want me to leave my own table?"], ['Wifey', "Your father is sick, Blue. He asked for you, not a scorekeeper."], ['Cornball', "I can cover check-in. I made a clipboard out of another clipboard."]],
        after: [['Ganger Blue', "Fine. The event stays open. I am not promising him a speech."], ['Wifey', "A visit will do. Let the player keep the tables running."]] },
      { id: 'wifeys-push', title: "Wifey's Push", opponent: 'Wifey', deck: deckFamily,
        before: [['Wifey', "Blue built a throne out of folding chairs. I need a player who can keep the seats open while I get him moving."], ['Ganger Blue', "You are making a match out of my marriage?"], ['Wifey', "No. Out of your event rules. Shuffle."]],
        after: [['Wifey', "Good. The tables belong to everyone on the list."], ['Ganger Blue', "I will see him. And then I want the whole truth."]] },
      { id: 'open-slots', title: 'Open Slots', opponent: 'Cornball', deck: deckReceipts, battleType: 'rule-twist', modifiers: { laneLocks: [{ round: 3, owner: 'both', lanes: [1] }] },
        before: [['Cornball', "Blue canceled the middle table for a dramatic pause. I uncanceled it, but the timer is still broken."], ['Wifey', "Win two districts. Keep the open slots posted where he can see them."]],
        after: [['Cornball', "The list is up. The machine gave me water I did not order. A historic day."], ['Wifey', "Blue is at his father's door. Come on."]] },
      { id: 'og-uncles-visit', title: "OG Uncle's Visit", kind: 'reward', rewards: [key(4)],
        before: [['OG Uncle', "Blue. Sit. I have been sick longer than I let you know."], ['Ganger Blue', "You let me hold a memorial for a brother who walked onto our roof."], ['OG Uncle', "I let you believe he died. That was my choice, and I was wrong."], ['Ganger Blue', "Why?"], ['OG Uncle', "I owe you the rest. First tell me why Snitch knew the warehouse address."], ['Wifey', "Blue, stay in the chair. We are not leaving this conversation halfway through."]] },
    ] },
  { id: 'side-show', order: 4, title: 'Chapter Four: Side Show', subtitle: 'A clip is shorter than the truth.',
    description: 'Trace an edited recording through Snitch, Scammer and the block.', map: 'civic-summit', venue: 'civic-hill-climb', beats: [
      { id: 'the-receipts-market', title: 'Receipts Market', opponent: 'Snitch', deck: deckMedia, battleType: 'guided',
        before: [['Snitch', "I have the clip everybody is forwarding. Twelve seconds long, six different stories attached."], ['Cornball', "Half these printouts have the same handwriting. Mine. I made copies."], ['Snitch', "Beat me and I will show you where the recording starts."]],
        after: [['Snitch', "The first four seconds are gone. Ask who wanted the beginning cut."], ['Cornball', "That is the least helpful full disclosure I have ever heard."]] },
      { id: 'snitchs-price', title: "Snitch's Price", opponent: 'Snitch', deck: deckReceipts,
        before: [['Snitch', "My price is a public interview. No edits from either of us."], ['Ganger Red', "A match gets you the microphone. It does not make your footage true."], ['Snitch', "Then win the microphone."]],
        after: [['Snitch', "Interview booked. Scammer is already selling an alternate cut."], ['Ganger Red', "Then we find the original dates before anyone presses publish."]] },
      { id: 'the-scammers-pitch', title: "Scammer's Pitch", opponent: 'Scammer', deck: deckRed, battleType: 'rule-twist', modifiers: { laneLocks: [{ round: 2, owner: 'both', lanes: [1] }] },
        before: [['Scammer', "My cut is longer, sharper and half price. Look at this professional watermark."], ['Cornball', "It says WARTERMARK."], ['Scammer', "Limited edition. Play the table."]],
        after: [['Scammer', "Okay. The date is wrong. I still stand by the font."], ['Ganger Red', "We need the continuous recording, not his sales page."]] },
      { id: 'church-aunties-setup', title: "Auntie's Setup", opponent: 'Church Auntie', deck: deckFamily,
        before: [['Church Auntie', "This is a community supper, not a funeral and not a screening party."], ['Snitch', "I already printed screening passes."], ['Church Auntie', "Then you can print refunds. Help me set the tables first."]],
        after: [['Church Auntie', "Good. People can eat while Red checks the source."], ['Ganger Red', "The original warehouse footage is still out there."]] },
      { id: 'nail-techs-counter', title: "Nail Tech's Counter", opponent: 'Nail Tech', deck: deckReceipts, optional: true, afterNode: 'the-scammers-pitch',
        before: [['Nail Tech', "You can spot a fake by the date on the sleeve. No magic watermark required."], ['Cornball', "I wrote the date on the wrong side."], ['Nail Tech', "Then beat me and I will label it for you."]],
        after: [['Nail Tech', "There. Source, time, owner. Now nobody gets to call the edit a mystery."], ['Cornball', "I respect a labeled envelope."]] },
      { id: 'the-fake-funeral', title: 'The Fake Premiere', opponent: 'Scammer', deck: deckMedia, battleType: 'mini-boss', phases: [phase('wrong-cut', 4, 1)],
        before: [['Scammer', "Welcome to my exclusive premiere. Same footage, louder speakers."], ['Church Auntie', "You cannot rent my dining room by renaming it a theater."], ['OG Uncle', "The date on that file is four years late. Turn it off."]],
        after: [['Scammer', "The room was full. That counts for something."], ['Church Auntie', "It counts as people who still need dinner."]] },
      { id: 'snitchs-verdict', title: "Snitch's Verdict", opponent: 'Snitch', deck: deckMedia, battleType: 'boss', phases: [phase('show', 1, 1), phase('read', 3, 1), phase('verdict', 5, 1)],
        before: [['Snitch', "Red asked for the whole cut. That includes what I did with the address."], ['Ganger Red', "The match decides who speaks first. The file decides what they say."], ['Snitch', "Fine. Camera stays on."]],
        after: [['Snitch', "Blue gave me the warehouse address. I passed it on. I kept the first part off the feed."], ['Ganger Red', "Publish the continuous file and credit where it came from."]] },
      { id: 'the-real-receipts', title: 'The Full Cut', kind: 'reward', rewards: [key(5)],
        before: [['Ganger Red', "Here is the full recording, including the part that makes me look bad."], ['Snitch', "Blue was the source. I sold his tip onward. That is on me."], ['Ganger Blue', "I wanted my brother embarrassed and out of my way. I did not know what would happen next."], ['Church Auntie', "You can finish that sentence to your father in person."], ['Wifey', "I am going with him. I have something to own too."]] },
    ] },
  { id: 'old-heads-know', order: 5, title: 'Chapter Five: Old Heads Know', subtitle: 'Every secret had a cost.',
    description: 'Bring the family to one table and hear the full rescue story.', map: 'old-town', venue: 'corner-store-court', beats: [
      { id: 'the-old-heads-convene', title: 'The Old Heads Convene', opponent: 'Ganger Blue', deck: deckBlue, battleType: 'guided',
        before: [['OG Uncle', "Everybody came. Some of you came to listen. Blue came ready to argue."], ['Ganger Blue', "I gave Snitch an address. You gave this block a funeral."], ['Baby Momma', "Both of you can wait until I have a chair."]],
        after: [['Ganger Blue', "Fine. I will listen."], ['OG Uncle', "Then let the next table speak."]] },
      { id: 'baby-mommas-truth', title: "Baby Momma's Truth", opponent: 'Baby Momma', deck: deckFamily,
        before: [['Baby Momma', "Our child is four. That has never been a tournament secret."], ['Cracked Head', "I sent money. I thought that helped."], ['Baby Momma', "You sent money through Red and called it showing up. Play me for the table, not for my decision."]],
        after: [['Baby Momma', "You won a match. You did not win an answer about us."], ['Cracked Head', "I heard you."]] },
      { id: 'wifeys-stand', title: "Wifey's Stand", opponent: 'Wifey', deck: deckFamily,
        before: [['Wifey', "I knew Blue gave Snitch the location. I kept quiet because I thought loyalty meant covering it."], ['Ganger Blue', "You do not have to take my blame."], ['Wifey', "I am naming my own. Now play."]],
        after: [['Wifey', "I will stand beside Blue while he makes it right. I will not stand in front of the facts."], ['Baby Momma', "That is one honest sentence today."]] },
      { id: 'church-aunties-blessing', title: "Auntie's Terms", opponent: 'Church Auntie', deck: deckFamily,
        before: [['Church Auntie', "No blessing covers a lie. Set the tables straight, then the people can talk."], ['Cornball', "I have labeled every chair by emotional load."], ['Church Auntie', "Take those labels off and shuffle."]],
        after: [['Church Auntie', "Food is ready. Confessions can wait until everybody has eaten."], ['Ganger Red', "Mine cannot wait much longer."]] },
      { id: 'alleys-confession', title: "Alley's Confession", opponent: 'Alley Runner', deck: deckRed, optional: true, afterNode: 'wifeys-stand',
        before: [['Alley Runner', "Everybody keeps asking me to carry messages they will not say themselves."], ['Cornball', "Could you carry my appeal to the vending company?"], ['Alley Runner', "Win a side match, then ask me again."]],
        after: [['Alley Runner', "You earned the route. Deliver your own difficult message."], ['Cornball', "That is an unreasonable courier policy."]] },
      { id: 'red-owns-the-silence', title: "Red's Silence", opponent: 'Ganger Red', deck: deckReceipts,
        before: [['Ganger Red', "I kept the message because OG told me to. I kept it longer because I was scared to admit I had."], ['Baby Momma', "That is an explanation, Red. It is not an excuse."], ['Ganger Red', "I know. One table. Then I give you the rest of the archive."]],
        after: [['Ganger Red', "The archive is yours. Snitch never had the original message."], ['Baby Momma', "Keep your phone off while I read it."]] },
      { id: 'hooper-closes', title: 'Last Open Table', opponent: 'Hooper', deck: deckBlue, battleType: 'mini-boss', phases: [phase('last-open-table', 4, 1)],
        before: [['Hooper', "This is the last open table before OG speaks. The crowd is trying to call it a verdict."], ['Church Auntie', "A game cannot pardon a father. Let them play anyway."], ['Hooper', "That I can run."]],
        after: [['Hooper', "Table closed. The rest belongs to the people who were there."], ['OG Uncle', "Then I will start."]] },
      { id: 'og-uncles-verdict', title: "OG Uncle's Account", opponent: 'OG Uncle', deck: deckFamily, battleType: 'boss', phases: [phase('old-history', 2, 1), phase('last-word', 5, 1)],
        before: [['OG Uncle', "I warned the authorities because the warehouse handoff put my son in danger. He survived. I let you believe he died."], ['Ganger Blue', "I gave Snitch the address because I wanted him gone from the block. I did not mean for him to die."], ['Cracked Head', "You both made a story without asking me. I am here for the whole account."], ['OG Uncle', "Play this table. Then we finish talking."]],
        after: [['OG Uncle', "I chose the false memorial. Blue chose the leak. Red chose silence. None of us gets to swap blame."], ['Ganger Blue', "I will tell my brother what I did, to his face."], ['Cracked Head', "Then do it where the block can hear."]] },
      { id: 'the-family-blessed', title: 'No Easy Blessing', kind: 'reward', rewards: [key(6)],
        before: [['Church Auntie', "Everyone got a plate. Nobody got absolution."], ['Baby Momma', "I will decide what parenting looks like for our child. No bracket decides it for me."], ['Cracked Head', "Blue, I want a public challenge. I also want you to hear me afterward."], ['Wifey', "The fundraiser is tomorrow. Help carry chairs before you carry a crown."], ['Cornball', "Finally. A job with measurable qualifications."]] },
    ] },
  { id: 'the-function', order: 6, title: 'Chapter Six: The Function', subtitle: 'The room is bigger than the rivalry.',
    description: 'Keep the fundraiser open while the brothers agree to fair entry.', map: 'festival-street', venue: 'crown-rooftop-court', beats: [
      { id: 'function-opening', title: 'The Function', opponent: 'Bottle Girl', deck: deckRed,
        before: [['Bottle Girl', "Welcome to the fundraiser. Setup crew gets fed before the headliners."], ['Cornball', "I brought a clipboard and an appetite. Which one checks in first?"], ['Bottle Girl', "Win the opening table and I will decide."]],
        after: [['Bottle Girl', "Good. Open entry stays on the sign."], ['Live Streamer', "Camera is rolling, and somehow the chairs are still being carried."]] },
      { id: 'the-bar-fight', title: 'The Bar Fight', opponent: 'Bottle Girl', deck: deckFamily, battleType: 'rule-twist', modifiers: { laneLocks: [{ round: 3, owner: 'both', lanes: [1] }] },
        before: [['Bottle Girl', "Somebody moved the check-in list behind the bar. This is a card table, not a bar fight."], ['Alley Runner', "I delivered the list. I did not hide it."], ['Bottle Girl', "Then help me get it back in view."]],
        after: [['Bottle Girl', "List is public again. Drinks after cleanup."], ['Alley Runner', "Best delivery policy I have heard all week."]] },
      { id: 'the-booking', title: 'The Booking', opponent: 'Promoter', deck: deckMedia, battleType: 'mini-boss', phases: [phase('booking-pressure', 4, 1)],
        before: [['Promoter', "I can book a Blue and Cracked Head exhibition. I cannot book an inherited title."], ['Ganger Blue', "Equal access. Put it in writing."], ['Promoter', "Win my table and I will print the terms."]],
        after: [['Promoter', "Terms signed. Every contender gets the same route."], ['Wifey', "I will keep a copy where the camera can see it."]] },
      { id: 'function-after-hours', title: 'After the Function', kind: 'reward', rewards: [key(7)],
        before: [['Live Streamer', "The fundraiser is over. The lights are finally ours."], ['Cracked Head', "I came for the challenge. I can help stack chairs too."], ['Baby Momma', "Try being that ordinary tomorrow morning."], ['Wifey', "The contender list changed after everyone left. Cracked Head's name is crossed out."], ['Ganger Blue', "Give me the paper. I did that."], ['Promoter', "Then tomorrow you explain it in public."]] },
    ] },
  { id: 'return-of-the-block', order: 7, title: 'Chapter Seven: Return of the Block', subtitle: 'The list belongs to everyone.',
    description: 'Restore the open bracket and make Blue answer for changing it.', map: 'crown-court', venue: 'crown-rooftop-court', beats: [
      { id: 'blue-takes-the-deal', title: 'The Altered List', opponent: 'Promoter', deck: deckMedia, battleType: 'guided',
        before: [['Promoter', "The published list has Cracked Head. The copy Blue left on my desk does not."], ['Ganger Blue', "I was trying to stop this from tearing us apart."], ['Wifey', "You cannot protect people by crossing their names out. Open the table."]],
        after: [['Promoter', "The published list is the rule. We will verify every entry."], ['Ganger Blue', "I will not hide behind a printer error."]] },
      { id: 'snitchs-roll-call', title: "Snitch's Roll Call", opponent: 'Snitch', deck: deckMedia,
        before: [['Snitch', "Two lists, one signature. For once the paperwork is louder than my stream."], ['Ganger Red', "Show the date on both copies. No edits this time."], ['Snitch', "Win the table and I will roll the full feed."]],
        after: [['Snitch', "Full feed is public. Blue made the change after the room emptied."], ['Ganger Red', "Now the rule applies to him too."]] },
      { id: 'blues-guilt', title: "Blue's Guilt", opponent: 'Ganger Blue', deck: deckBlue,
        before: [['Ganger Blue', "I kept telling myself one name was a small change."], ['Wifey', "You signed equal access yesterday."], ['Ganger Blue', "I know. Play me. I will hear the result without changing the rules."]],
        after: [['Ganger Blue', "I wanted control more than I wanted to admit I was afraid."], ['Wifey', "Then give the list back."]] },
      { id: 'cracked-head-at-the-corner', title: 'Cracked Head at the Corner', opponent: 'Cracked Head', deck: deckFinal, battleType: 'rule-twist', modifiers: { laneLocks: [{ round: 3, owner: 'both', lanes: [1] }] },
        before: [['Cracked Head', "I came back to compete. I am not asking my brother for permission to exist."], ['Ganger Blue', "The list was wrong. I will correct it."], ['Cracked Head', "Good. Now give me a real table."]],
        after: [['Cracked Head', "You held your place fairly. I will earn mine the same way."], ['Ganger Blue', "That is the first fair thing either of us has said today."]] },
      { id: 'baby-mommas-boundary', title: "Baby Momma's Boundary", opponent: 'Baby Momma', deck: deckFamily, optional: true, afterNode: 'blues-guilt',
        before: [['Baby Momma', "The whole block has opinions about our child. The child did not ask for a microphone."], ['Cornball', "I can make a quiet sign."], ['Baby Momma', "Make it after a side match. Then put the pen down."]],
        after: [['Baby Momma', "Good. This route stays optional, like everybody's advice about my family."], ['Cornball', "The sign says GIVE THEM ROOM. I spelled all of it correctly."]] },
      { id: 'wifey-checks-the-list', title: 'Check the List', opponent: 'Wifey', deck: deckFamily,
        before: [['Wifey', "I helped run check-in for years. I should have caught the altered copy sooner."], ['Ganger Blue', "You did catch it. I am the one who wrote it."], ['Wifey', "Then let us verify each line in public."]],
        after: [['Wifey', "Every name matches the posted list."], ['Promoter', "Only Blue's penalty is left to announce."]] },
      { id: 'blue-restores-the-list', title: 'Blue Restores the List', opponent: 'Ganger Blue', deck: deckBlue, battleType: 'mini-boss', phases: [phase('public-restoration', 4, 1)],
        before: [['Ganger Blue', "I crossed out my brother. I broke the equal-access terms. Put his name back."], ['Promoter', "That costs you your title shot, Blue."], ['Ganger Blue', "I know. Let me make the announcement after this table."]],
        after: [['Ganger Blue', "Cracked Head is on the list. I accept disqualification from the title bracket."], ['Cracked Head', "That does not make us square. It is a start."]] },
      { id: 'the-lie-exposed', title: 'Published Exhibition', opponent: 'Cracked Head', deck: deckFinal, battleType: 'boss', phases: [phase('opening-claim', 1, 1), phase('brothers-pressure', 3, 1), phase('last-call', 5, 1)],
        before: [['Promoter', "Published exhibition. It sets the order for the final Open; no contender is eliminated here."], ['Cracked Head', "I want to see what the player who won my old Crown can do again."], ['Ganger Blue', "I will keep score. Fairly, for once."], ['Cracked Head', "Then shuffle."]],
        after: [['Cracked Head', "You earned the final table. I will meet you there on equal terms."], ['Ganger Blue', "I can live with a score I did not write myself."]] },
      { id: 'the-block-changes-hands', title: 'The Rooftop Notice', kind: 'reward', rewards: [key(8)],
        before: [['Delivery Demon', "Package for the rooftop owner. Inspection notice, signed and dated."], ['Promoter', "The owner invited a buyer. That is not a change to tonight's bracket."], ['Cracked Head', "A Crown never bought the building. I should have said that years ago."], ['Ganger Blue', "The Open stays open. Whoever owns the roof will hear that from all of us."], ['Baby Momma', "Tomorrow you can argue about property. Tonight you can carry these chairs."]] },
    ] },
  { id: 'the-crown', order: 8, title: 'Chapter Eight: The Crown', subtitle: 'The Open belongs to the people who play it.',
    description: 'Cross the neighborhood, win the final and defend the Open as the rooftop changes owners.', map: 'sunset-block', venue: 'crown-rooftop-court', beats: [
      { id: 'crown-open-entry', title: 'Open Entry', opponent: 'Bottle Girl', deck: deckRed, venue: 'corner-store-court', battleType: 'guided',
        before: [['Bottle Girl', "Corner store table is open. No crew colors required, and nobody pays Snitch for a line pass."], ['Cornball', "I made signs. One says OPEN and one says STILL OPEN."], ['Bottle Girl', "First match sets the tone. Show them both signs are true."]],
        after: [['Bottle Girl', "First table cleared. Every name stays on the board."], ['Cornball', "I am putting the second sign up anyway."]] },
      { id: 'crown-published-rules', title: 'Published Rules', opponent: 'Promoter', deck: deckMedia, venue: 'corner-store-court',
        before: [['Promoter', "Three venues. Same bracket. The rules are printed where everyone can see them."], ['Ganger Blue', "I checked every name twice. No more private copies."], ['Promoter', "Good. Now check your deck."]],
        after: [['Promoter', "The bracket holds. Head to the Red Side court."], ['Ganger Blue', "I will carry the boards over."]] },
      { id: 'crown-cornballs-table', title: "Cornball's Table", opponent: 'Cornball', deck: deckReceipts, venue: 'corner-store-court',
        before: [['Cornball', "The vending machine finally refunded my three dollars. In store credit. For that machine."], ['Alley Runner', "You can buy water after the match."], ['Cornball', "I am buying justice first. Shuffle."]],
        after: [['Cornball', "You win. I am spending the credit on water for the setup crew."], ['Alley Runner', "That is the first sensible thing the machine has done."]] },
      { id: 'crown-reds-full-feed', title: "Red's Full Feed", opponent: 'Ganger Red', deck: deckReceipts, venue: 'red-fence-night-court', battleType: 'rule-twist', modifiers: { laneLocks: [{ round: 2, owner: 'both', lanes: [1] }] },
        before: [['Ganger Red', "The full recording is public. I left in the part where I kept quiet."], ['Baby Momma', "Good. Nobody gets to call an edit accountability."], ['Ganger Red', "Middle district closes early. The camera stays on."]],
        after: [['Ganger Red', "You handled the pressure. I will run the uncut feed for the rooftop final."], ['Baby Momma', "Then keep the lens off my child."]] },
      { id: 'crown-snitch-credits-source', title: 'Credit the Source', opponent: 'Snitch', deck: deckMedia, venue: 'red-fence-night-court',
        before: [['Snitch', "My stream needs a title. I was considering Snitch Saves the Open."], ['Wifey', "Try The People Who Built It."], ['Snitch', "That is less searchable. Beat my table and I will use it."]],
        after: [['Snitch', "Fine. Credit goes to Red for the full file, Wifey for the list, and the volunteers for everything I stepped around."], ['Wifey', "Keep that line in the replay."]] },
      { id: 'crown-hoopers-seed', title: "Hooper's Seed", opponent: 'Hooper', deck: deckBlue, venue: 'red-fence-night-court', battleType: 'mini-boss', phases: [phase('semifinal-push', 4, 1)],
        before: [['Hooper', "Last Red Side table. Win and you keep your rooftop seed."], ['Promoter', "Published seeding. No surprise eliminations."], ['Hooper', "Good. I want the best match, not the best paperwork."]],
        after: [['Hooper', "Seed held. Go meet the people waiting upstairs."], ['Promoter', "The rooftop is ready."]] },
      { id: 'crown-blue-sets-the-table', title: 'Blue Sets the Table', opponent: 'Ganger Blue', deck: deckBlue,
        before: [['Ganger Blue', "I set up the final table. I do not get a title shot, and that is fair."], ['Cracked Head', "You can still play a warm-up without changing the bracket."], ['Ganger Blue', "Then let this be a warm-up I can lose honestly."]],
        after: [['Ganger Blue', "Good game. I will be on chairs and scores when you face him."], ['Cracked Head', "I noticed."]] },
      { id: 'crown-baby-mommas-terms', title: "Baby Momma's Terms", opponent: 'Baby Momma', deck: deckFamily,
        before: [['Baby Momma', "Everybody is calling tonight a family reunion. It is a tournament."], ['Cracked Head', "I know I owe you more than an entrance."], ['Baby Momma', "Then play this table, and afterward we talk about tomorrow morning."]],
        after: [['Baby Momma', "The match is settled. Parenting is a separate conversation."], ['Cracked Head', "I am staying for that conversation."]] },
      { id: 'crown-final-rival', title: 'The Crown Final', opponent: 'Cracked Head', deck: deckFinal, battleType: 'boss', phases: [phase('old-claim', 1, 1), phase('family-pressure', 3, 1), phase('open-future', 5, 1)],
        before: [['Promoter', "Final table. The newcomer earned the Crown, and Cracked Head earned this challenge. Three phases. One published result."], ['Cracked Head', "I came back wanting the block to remember my name. You made it remember the rules."], ['Ganger Blue', "Scoreboard is clear. No edits."], ['Cracked Head', "Then let us play for the future, not the past."]],
        after: [['Cracked Head', "You won. I accept the result. Shared scheduling stays, and the Open stays open."], ['Ganger Blue', "I can help run it without owning it."], ['Promoter', "That is the final score."]] },
      { id: 'crown-community-meal', title: 'The Community Meal', kind: 'reward', rewards: [xp(300), { kind: 'pack-ticket', id: 'street-pack-ticket', amount: 1 }, { kind: 'character-unlock', id: 'cracked-head', amount: 1 }],
        before: [['Church Auntie', "Plates first. Speeches after. That is the only bracket in my house."], ['Baby Momma', "Tomorrow morning, you can bring breakfast and help with school drop-off. One morning. We build from there."], ['Cracked Head', "I will be there before the doors open."], ['OG Uncle', "Both my sons are here. That is enough for me tonight."], ['Delivery Demon', "Message from the rooftop owner. Sale agreement signed with Techbro Rich."], ['Promoter', "The Crown protects the Open's rules. It never owned the building."], ['Ganger Blue', "Then we defend the place together, by showing up."], ['Cornball', "I have two signs. OPEN and STILL OPEN. Turns out I was prepared."], ['Church Auntie', "Good. Now everybody eat while the food is hot."]] },
    ] },
];

export const sequelChapters: readonly StoryChapter[] = [chapterTwo, ...plans.map(buildChapter)];
export const sequelSpeakers = portraitSlugs;
