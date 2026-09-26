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
  // ── Chapter 3: Blue Side Blues ──────────────────────────────────────────
  {
    chapterId: 'blue-side-blues', nodeId: 'blue-in-denial', section: 'pre', lines: [
      line('Ganger Blue', portraits.blue, 'These chairs got lumbar support. Y’all not seeing the vision.'),
      line('Cornball', portraits.cornball, 'Party City clearance and a dream. Stickers still on there, Blue.'),
      line('Ganger Blue', portraits.blue, 'I kept these lights on four years straight.'),
      line('Wifey', portraits.wifey, 'We kept them on. You brought a speaker and asked if the cord was free.'),
      line('Ganger Blue', portraits.blue, 'I’m running something out here.'),
      line('Wifey', portraits.wifey, 'You running it off Nail Tech bathroom outlet. Hair dryer dead two weeks now.'),
      line('Cornball', portraits.cornball, 'Sticky note still say “Blue did it again.” I left it up for the archives.'),
      line('Ganger Blue', portraits.blue, 'This match decide if the center table stay open. That’s power.'),
      line('Wifey', portraits.wifey, 'Power would be answering your daddy phone. He called three times.'),
      line('Ganger Blue', portraits.blue, 'I’m busy.'),
      line('Cornball', portraits.cornball, 'Busy building a throne out of folding chairs. Noted and time-stamped.'),
      line('Wifey', portraits.wifey, 'You can keep the throne. Just don’t sit on it while your father waiting.'),
    ],
  },
  {
    chapterId: 'blue-side-blues', nodeId: 'blue-in-denial', section: 'post', lines: [
      line('Ganger Blue', portraits.blue, 'Aight. Slot stay open. Don’t look at me like that.'),
      line('Cornball', portraits.cornball, 'Chairs still standing. You finally got somewhere to be that ain’t a press conference.'),
      line('Wifey', portraits.wifey, 'Take the win and keep walking. Next stop is his door. No speech.'),
      line('Ganger Blue', portraits.blue, 'I said I’m going.'),
      line('Wifey', portraits.wifey, 'Say it when the car moving. I got the keys and the side-eye.'),
      line('Cornball', portraits.cornball, 'I’ll hold the empire. Try not to need a receipt for basic human decency.'),
    ],
  },
  {
    chapterId: 'blue-side-blues', nodeId: 'wifeys-push', section: 'pre', lines: [
      line('Wifey', portraits.wifey, 'You keep saying you kept the lights on. Your daddy sitting in the dark calling you.'),
      line('Ganger Blue', portraits.blue, 'I got people depending on this schedule.'),
      line('Wifey', portraits.wifey, 'I been depending on you to stop performing and go sit down.'),
      line('Cornball', portraits.cornball, 'Player holding the door. Clock loud as hell.'),
      line('Ganger Blue', portraits.blue, 'This still my table.'),
      line('Wifey', portraits.wifey, 'Then leave it and walk to his. I’m not carrying the chair and the pride at the same time.'),
      line('Ganger Blue', portraits.blue, 'You acting like I don’t care.'),
      line('Wifey', portraits.wifey, 'You care about looking like the boss more than being a son. It’s loud.'),
      line('Cornball', portraits.cornball, 'I’m logging this. “Blue chose the folding chair over the hospital chair.” Archive material.'),
      line('Wifey', portraits.wifey, 'He can keep the notes. I just need the car moving.'),
    ],
  },
  {
    chapterId: 'blue-side-blues', nodeId: 'wifeys-push', section: 'post', lines: [
      line('Wifey', portraits.wifey, 'You won the argument about the slot. Congrats. Now go lose the one about being a son.'),
      line('Ganger Blue', portraits.blue, 'I said I’ll go. Damn.'),
      line('Wifey', portraits.wifey, 'Say it again when the car actually leave the lot.'),
      line('Cornball', portraits.cornball, 'I’ll watch the empire. Don’t come back needing a receipt for basic respect.'),
      line('Ganger Blue', portraits.blue, 'Y’all really not gon’ let me have one quiet exit.'),
      line('Wifey', portraits.wifey, 'Quiet exits for people who answer the phone the first time.'),
    ],
  },
  {
    chapterId: 'blue-side-blues', nodeId: 'open-slots', section: 'pre', lines: [
      line('Ganger Blue', portraits.blue, 'If that center table open, somebody gon’ ask why I closed it. That’s a whole investigation.'),
      line('Cornball', portraits.cornball, 'Somebody already asked. It was me. Clipboard, three witnesses, voice memo. You not slick.'),
      line('Ganger Blue', portraits.blue, 'I was protecting the integrity of the Open.'),
      line('Cornball', portraits.cornball, 'You was protecting your feelings with a barricade and a color code. Integrity my ass.'),
      line('Ganger Blue', portraits.blue, 'Win this and the slot stay public. Lose and the jacket go right back on the sign.'),
      line('Cornball', portraits.cornball, 'Jacket already got a permanent crease from the last time. Sign still say OPEN underneath. Optics crazy.'),
      line('Ganger Blue', portraits.blue, 'You really enjoying this, huh?'),
      line('Cornball', portraits.cornball, 'Immensely. Free quality control for the neighborhood.'),
    ],
  },
  {
    chapterId: 'blue-side-blues', nodeId: 'open-slots', section: 'post', lines: [
      line('Ganger Blue', portraits.blue, 'The open slot is an accusation I can see from the sidewalk. Happy now?'),
      line('Cornball', portraits.cornball, 'Fulfilled. Accusations should be visible. That’s how we do quality control out here.'),
      line('Ganger Blue', portraits.blue, 'Just take the win and keep the commentary short.'),
      line('Cornball', portraits.cornball, 'Commentary is the service. You’re welcome. Tip jar by the vending machine.'),
      line('Ganger Blue', portraits.blue, 'I’m not tipping you for roasting me in public.'),
      line('Cornball', portraits.cornball, 'Then the service remains free and loud. Fair trade.'),
    ],
  },
  {
    chapterId: 'blue-side-blues', nodeId: 'og-uncles-visit', section: 'main', lines: [
      line('Cornball', portraits.cornball, 'Left the clipboard outside. It was trying too hard to make this official.'),
      line('OG Uncle', portraits.uncle, 'Leave that empty chair. Somebody missing shaped this room for four years.'),
      line('Ganger Blue', portraits.blue, 'You let the whole block think he was dead. I argued with the printer about his hairline.'),
      line('OG Uncle', portraits.uncle, 'I did. Chose the lie that stopped the questions.'),
      line('Ganger Blue', portraits.blue, 'And never told me?'),
      line('OG Uncle', portraits.uncle, 'I called. You sent me to voicemail and posted another flyer.'),
      line('Ganger Blue', portraits.blue, 'I’m sitting. That’s all I got tonight.'),
      line('Wifey', portraits.wifey, 'Nobody asked you to replace him. Just sit and stay.'),
      line('OG Uncle', portraits.uncle, 'I’m not well, Blue. That story bought me time I don’t have no more.'),
      line('Ganger Blue', portraits.blue, 'Then don’t ask me to fill the chair before you talk.'),
      line('OG Uncle', portraits.uncle, 'I’ll talk. Just not while you looking for the door.'),
      line('Wifey', portraits.wifey, 'He not leaving. I got the keys. You got the truth. Start when you ready.'),
      line('Cornball', portraits.cornball, 'I’ll be outside with the clipboard. Somebody gotta keep the empire from collapsing while y’all do this.'),
    ],
  },

  // ── Chapter 4: Side Show ────────────────────────────────────────────────
  {
    chapterId: 'side-show', nodeId: 'the-receipts-market', section: 'pre', lines: [
      line('Ganger Red', portraits.red, 'You cut the beginning off. That’s not editing, that’s surgery.'),
      line('Snitch', portraits.snitch, 'My version got sponsors. Facts need lighting or they don’t eat.'),
      line('Ganger Red', portraits.red, 'Your lighting removed the part that mattered.'),
      line('Cornball', portraits.cornball, 'I got the label maker. Printed LIAR in three fonts. Pick one.'),
      line('Snitch', portraits.snitch, 'Narrow one. Wide font feel personal.'),
      line('Ganger Red', portraits.red, 'Put the real timestamp up. Big enough to survive the caption.'),
      line('Snitch', portraits.snitch, 'Y’all acting like I invented the edit. Algorithm ate the beginning. I just packaged the leftovers.'),
      line('Cornball', portraits.cornball, 'Leftovers still got your logo on them. That’s the problem.'),
    ],
  },
  {
    chapterId: 'side-show', nodeId: 'the-receipts-market', section: 'post', lines: [
      line('Snitch', portraits.snitch, 'Missing seconds now got a destination. Destinations make people nervous. Good content though.'),
      line('Ganger Red', portraits.red, 'Nervous is the correct temperature for a confession. Keep the camera rolling when it get uncomfortable.'),
      line('Cornball', portraits.cornball, 'Filed both versions. Edited one and the one with receipts. Court of public opinion open for business.'),
      line('Snitch', portraits.snitch, 'Y’all really not gon’ let me have the soft launch, huh?'),
      line('Ganger Red', portraits.red, 'Soft launches for soft lies. This one hard. Live with it.'),
    ],
  },
  {
    chapterId: 'side-show', nodeId: 'snitchs-price', section: 'pre', lines: [
      line('Snitch', portraits.snitch, 'Public interview mean public snacks. Entering that demand into evidence. Ring light don’t run on air.'),
      line('Cornball', portraits.cornball, 'You charged me to correct my own birthday post. Now you want catering? The audacity got range.'),
      line('Snitch', portraits.snitch, 'Content got overhead. Ring light alone is a second rent.'),
      line('Ganger Red', portraits.red, 'Turn the camera on and leave it on. No twelve-second economy today.'),
      line('Snitch', portraits.snitch, 'Full cut mean full accountability. Y’all sure you ready for that tier?'),
      line('Cornball', portraits.cornball, 'We been ready. You the one still charging for the preview.'),
      line('Ganger Red', portraits.red, 'Preview over. Feature presentation starting now.'),
    ],
  },
  {
    chapterId: 'side-show', nodeId: 'the-scammers-pitch', section: 'pre', lines: [
      line('Scammer', portraits.scammer, 'This the director’s cut. Watermarked. Limited edition. Emotional demographic only.'),
      line('Ganger Red', portraits.red, 'A watermark is not a chain of custody, no matter how shiny it look.'),
      line('Scammer', portraits.scammer, 'WARTERMARK edition just became a collector’s mistake. Price went up.'),
      line('Cornball', portraits.cornball, 'Font survived. Story did not. Filing both under “attempted fraud with extra steps.”'),
      line('Ganger Red', portraits.red, 'Put the original timestamp on the screen. Large enough to survive your next drop.'),
      line('Scammer', portraits.scammer, 'Y’all killing the vibe. This was supposed to be a soft launch.'),
      line('Cornball', portraits.cornball, 'Soft launch for a hard lie. We not buying. Receipts only.'),
      line('Scammer', portraits.scammer, 'Fine. But the narrow font still look better on the apology.'),
    ],
  },
  {
    chapterId: 'side-show', nodeId: 'the-scammers-pitch', section: 'post', lines: [
      line('Scammer', portraits.scammer, 'Use the narrow font next time. Wide one feel personal.'),
      line('Cornball', portraits.cornball, 'Everything about you feel personal. That’s the whole problem.'),
      line('Ganger Red', portraits.red, 'Original file stays up. Your watermark can go live somewhere else.'),
      line('Scammer', portraits.scammer, 'Y’all really know how to ruin a limited drop.'),
      line('Cornball', portraits.cornball, 'Ruining limited drops is community service. You’re welcome.'),
    ],
  },
  {
    chapterId: 'side-show', nodeId: 'the-real-receipts', section: 'main', lines: [
      line('Snitch', portraits.snitch, 'Here’s the file before my logo started charging rent.'),
      line('Ganger Red', portraits.red, 'Keep the logo on the apology. Off the source.'),
      line('Ganger Blue', portraits.blue, 'The missing beginning was me giving the address. Don’t crop that.'),
      line('Wifey', portraits.wifey, 'And don’t crop me saying I knew. I stayed quiet too.'),
      line('Snitch', portraits.snitch, 'Blue gave me the location. I sold it. That’s the whole thing.'),
      line('Church Auntie', portraits.auntie, 'Screen finally big enough for everybody. Turn it off. Go see his father.'),
      line('Ganger Blue', portraits.blue, 'I’m going. No deck. No chair. Just me.'),
      line('Snitch', portraits.snitch, 'Somebody get this. Character development in 4K.'),
      line('Cornball', portraits.cornball, 'You not charging for this one. Sit down.'),
      line('Wifey', portraits.wifey, 'He already sitting. Now the rest of us got work to do.'),
    ],
  },

  // ── Chapter 5: Old Heads Know ───────────────────────────────────────────
  {
    chapterId: 'old-heads-know', nodeId: 'the-old-heads-convene', section: 'pre', lines: [
      line('Baby Momma', portraits.babyMomma, 'This table for truth. Not who suffered the most. Leave that at the door.'),
      line('Cornball', portraits.cornball, 'Labeled the plates. Evidence and not-evidence. Color coded for the visual learners.'),
      line('Church Auntie', portraits.auntie, 'That’s my good platter.'),
      line('Cornball', portraits.cornball, 'It was being too persuasive. Had to protect the testimony.'),
      line('Baby Momma', portraits.babyMomma, 'Move every plate. Clear table when the story start.'),
      line('OG Uncle', portraits.uncle, 'Clear it. Nobody need props for this.'),
      line('Cracked Head', portraits.cracked, 'I’m here. No hoodie. No entrance music. Just the man y’all already got opinions about.'),
      line('Cornball', portraits.cornball, 'Opinions archived. Testimony starting now.'),
    ],
  },
  {
    chapterId: 'old-heads-know', nodeId: 'the-old-heads-convene', section: 'post', lines: [
      line('Cornball', portraits.cornball, 'I labeled the evidence plate EVIDENCE and the dinner plate NOT EVIDENCE.'),
      line('Church Auntie', portraits.auntie, 'You labeled my good platter.'),
      line('Cornball', portraits.cornball, 'The platter was dangerously persuasive. Had to intervene.'),
      line('Baby Momma', portraits.babyMomma, 'Move every plate. I want a clear table when the rescue story start.'),
      line('OG Uncle', portraits.uncle, 'Clear it. Nobody need props for what I’m about to own.'),
      line('Cracked Head', portraits.cracked, 'Then own it. We all listening.'),
    ],
  },
  {
    chapterId: 'old-heads-know', nodeId: 'og-uncles-verdict', section: 'post', lines: [
      line('OG Uncle', portraits.uncle, 'I warned them cause that handoff was gonna get my eldest killed. Then I let the block think he was already gone.'),
      line('Ganger Blue', portraits.blue, 'We buried a slideshow. I wore the shirt. For what?'),
      line('OG Uncle', portraits.uncle, 'For time. Lie bought me time I don’t have no more. Rescue don’t erase the lie.'),
      line('Ganger Blue', portraits.blue, 'I wanted him out the way. Gave Snitch the address so the block would turn on him. Didn’t want nobody dead. Still did the tip.'),
      line('Cracked Head', portraits.cracked, 'Surviving don’t make four years of silence a sacrifice. I knew about the baby. Sent one message through Red then used safety as the excuse to stay gone.'),
      line('Baby Momma', portraits.babyMomma, 'Harms got names now. Don’t stack them into one big apology and call it done.'),
      line('Wifey', portraits.wifey, 'I knew about the address. Stayed quiet cause I thought love meant protecting the man keeping the lights on. Just made everybody else pay.'),
      line('Baby Momma', portraits.babyMomma, 'I’m not ranking who hurt who worse. I’m deciding what my child get to know and when.'),
      line('Cracked Head', portraits.cracked, 'I want the public match with Blue. Not a private cry session. Table. In front of the people already talking.'),
      line('Ganger Blue', portraits.blue, 'You want the smoke after radio silence? Put it on the schedule.'),
      line('Church Auntie', portraits.auntie, 'Leave the empty chair. Tomorrow each of y’all come with your own work.'),
      line('OG Uncle', portraits.uncle, 'I’ll live with the names on my choices. Family decide the rest. Just needed y’all to hear it from me while I can still say it.'),
      line('Cornball', portraits.cornball, 'Archiving the whole thing. No edits. Full file. For the record.'),
    ],
  },
  {
    chapterId: 'old-heads-know', nodeId: 'baby-mommas-truth', section: 'post', lines: [
      line('Cracked Head', portraits.cracked, 'Not asking a game to forgive me. Asking to listen without a mic.'),
      line('Baby Momma', portraits.babyMomma, 'Listening ain’t the victory. It’s where the work start. And the work not a public match.'),
      line('Cracked Head', portraits.cracked, 'Match for the block. Listening for you. Separate tabs.'),
      line('Baby Momma', portraits.babyMomma, 'We’ll see. Talk cheap. Showing up on time with no camera cost more.'),
      line('Cracked Head', portraits.cracked, 'I’ll be there. Early. No phone.'),
      line('Baby Momma', portraits.babyMomma, 'Early is the bare minimum. We not celebrating the bare minimum yet.'),
    ],
  },
  {
    chapterId: 'old-heads-know', nodeId: 'wifeys-stand', section: 'post', lines: [
      line('Baby Momma', portraits.babyMomma, 'Love can stand nearby. It cannot stand between me and an answer. Move or get moved.'),
      line('Wifey', portraits.wifey, 'I can love him and still refuse to edit the record for him. I already did the quiet version. Cost everybody else.'),
      line('Ganger Blue', portraits.blue, 'You really choosing this moment to go public with the private?'),
      line('Wifey', portraits.wifey, 'The private already went public when the tip did. I’m just catching the credits up.'),
      line('Baby Momma', portraits.babyMomma, 'Good. Credits finally matching the damage.'),
    ],
  },

  // ── Chapter 6: The Function ─────────────────────────────────────────────
  {
    chapterId: 'the-function', nodeId: 'function-opening', section: 'pre', lines: [
      line('Bottle Girl', portraits.bottleGirl, 'Volunteer plates left. Contender bands right. Blue reserved section just became six regular chairs.'),
      line('Ganger Blue', portraits.blue, 'Those chairs was a hospitality concept.'),
      line('Wifey', portraits.wifey, 'Your concept had velvet rope from a bathrobe.'),
      line('Cornball', portraits.cornball, 'I cut it into napkin rings. The people reclaimed luxury.'),
      line('Bottle Girl', portraits.bottleGirl, 'Beautiful. Now reclaim the entrance before this line hit the street.'),
      line('Ganger Blue', portraits.blue, 'I’m still running something out here.'),
      line('Bottle Girl', portraits.bottleGirl, 'You running the part where everybody get the same door. That’s the whole job tonight.'),
      line('Cornball', portraits.cornball, 'And the napkin rings already got more integrity than the old rope.'),
    ],
  },
  {
    chapterId: 'the-function', nodeId: 'function-opening', section: 'post', lines: [
      line('Bottle Girl', portraits.bottleGirl, 'Feed the setup crew, post the terms, let the headliners wait their turn.'),
      line('Ganger Blue', portraits.blue, 'I can do that without a speech, right?'),
      line('Wifey', portraits.wifey, 'You can try. History say otherwise.'),
      line('Cornball', portraits.cornball, 'I’m taking bets on how long before the podium energy return.'),
      line('Bottle Girl', portraits.bottleGirl, 'No bets inside the venue. House rules.'),
    ],
  },
  {
    chapterId: 'the-function', nodeId: 'the-bar-fight', section: 'pre', lines: [
      line('Cornball', portraits.cornball, 'List under a napkin next to a lime. That’s how institutions start.'),
      line('Promoter', portraits.promoter, 'One published list. Witnessed changes. No private color test. Blue already signed it.'),
      line('Ganger Blue', portraits.blue, 'I signed it. Don’t frame the pen.'),
      line('Wifey', portraits.wifey, 'I’m framing the copy. Tomorrow you might develop selective handwriting.'),
      line('Snitch', portraits.snitch, 'Camera caught the signature and Cornball stealing a napkin ring.'),
      line('Cornball', portraits.cornball, 'Reclaiming. We established the legal theory at the door.'),
      line('Promoter', portraits.promoter, 'Theory or not, the list stay public. Hands off after closing.'),
    ],
  },
  {
    chapterId: 'the-function', nodeId: 'blue-takes-the-deal', section: 'post', lines: [
      line('Ganger Blue', portraits.blue, 'Terms signed. Open entry. Everybody happy.'),
      line('Wifey', portraits.wifey, 'You look like a man who just agreed to something he already planning to break.'),
      line('Ganger Blue', portraits.blue, 'I’m good.'),
      line('Wifey', portraits.wifey, 'You always good right before you do something messy. I see the list still in your hand.'),
      line('Ganger Blue', portraits.blue, 'I’m just holding it.'),
      line('Wifey', portraits.wifey, 'Hold it where everybody can see the ink. Not in your pocket.'),
      line('Cornball', portraits.cornball, 'Pocket energy never ends well. History books full of it.'),
    ],
  },
  {
    chapterId: 'the-function', nodeId: 'function-after-hours', section: 'main', lines: [
      line('Promoter', portraits.promoter, 'Shared access terms: one published list, witnessed changes, no private color test.'),
      line('Ganger Blue', portraits.blue, 'I signed it. Do not frame the pen.'),
      line('Wifey', portraits.wifey, 'I am framing the copy, because tomorrow you may develop selective handwriting.'),
      line('Snitch', portraits.snitch, 'My camera caught the signature and Cornball stealing a napkin ring.'),
      line('Cornball', portraits.cornball, 'Reclaiming. We established the legal theory at the door.'),
      line('Promoter', portraits.promoter, 'Legal theory or not, the terms stay boring and public. That’s the whole point.'),
      line('Ganger Blue', portraits.blue, 'Boring is fine. I can do boring.'),
      line('Wifey', portraits.wifey, 'We’ll see. History watching the pockets.'),
    ],
  },

  // ── Chapter 7: Return of the Block ──────────────────────────────────────
  {
    chapterId: 'return-of-the-block', nodeId: 'snitchs-roll-call', section: 'pre', lines: [
      line('Snitch', portraits.snitch, 'One list say Cracked Head. The new one say CRACKED CHAIR in white-out.'),
      line('Promoter', portraits.promoter, 'That’s not a typo. The chair not seeded.'),
      line('Cornball', portraits.cornball, 'Strong record. No government name though.'),
      line('Wifey', portraits.wifey, 'Hold both pages to the light. Somebody erased a contender and forgot paper can talk.'),
      line('Snitch', portraits.snitch, 'Paper testimony terrible for watch time. Excellent for consequences.'),
      line('Ganger Blue', portraits.blue, 'Y’all making a whole movie out a correction fluid.'),
      line('Wifey', portraits.wifey, 'You made the movie when you took the list after the room cleared.'),
      line('Cornball', portraits.cornball, 'Director’s cut already circulating. No sponsors this time.'),
    ],
  },
  {
    chapterId: 'return-of-the-block', nodeId: 'blues-guilt', section: 'pre', lines: [
      line('Ganger Blue', portraits.blue, 'I know what the list say because I’m the one who made it say less.'),
      line('Cracked Head', portraits.cracked, 'You crossed my name out like I was a suggestion.'),
      line('Ganger Blue', portraits.blue, 'I was protecting the integrity of the final.'),
      line('Cracked Head', portraits.cracked, 'You was protecting your feelings with white-out. Say it plain.'),
      line('Ganger Blue', portraits.blue, 'I didn’t want to lose to you in front of everybody after everything.'),
      line('Cracked Head', portraits.cracked, 'Then you should’ve played me. Not edited me out.'),
      line('Wifey', portraits.wifey, 'He know. He just still tasting the white-out.'),
      line('Cornball', portraits.cornball, 'White-out don’t hold up under light. We already proved that.'),
    ],
  },
  {
    chapterId: 'return-of-the-block', nodeId: 'blue-restores-the-list', section: 'post', lines: [
      line('Ganger Blue', portraits.blue, 'His name back. Mine struck from the title match. Penalty stay.'),
      line('Promoter', portraits.promoter, 'Stamped both changes before the ink could become a speech.'),
      line('Cracked Head', portraits.cracked, 'You didn’t hand me your place. You returned mine.'),
      line('Wifey', portraits.wifey, 'There it is. Correction with a cost and no folding-chair podium.'),
      line('Cornball', portraits.cornball, 'I had the podium ready. Accountability ruined another rental.'),
      line('Ganger Blue', portraits.blue, 'I know what I did. I’m living with it in public now.'),
      line('Cracked Head', portraits.cracked, 'Public is the only place it count. Private apologies cheap.'),
      line('Promoter', portraits.promoter, 'Both changes recorded. No more selective handwriting.'),
    ],
  },
  {
    chapterId: 'return-of-the-block', nodeId: 'the-lie-exposed', section: 'post', lines: [
      line('Cracked Head', portraits.cracked, 'This not revenge. It’s proof a fair route can survive us.'),
      line('Ganger Blue', portraits.blue, 'You got your place. I lost mine. We even on paper.'),
      line('Cracked Head', portraits.cracked, 'Paper never the whole story. But it’s a start.'),
      line('Baby Momma', portraits.babyMomma, 'Y’all can keep the public match. My terms still private.'),
      line('Wifey', portraits.wifey, 'Private terms got more power than any list anyway.'),
      line('Cornball', portraits.cornball, 'I’m still taking notes. For the archive. And the group chat.'),
    ],
  },

  // ── Chapter 8: The Crown ────────────────────────────────────────────────
  {
    chapterId: 'the-crown', nodeId: 'crown-open-entry', section: 'pre', lines: [
      line('Bottle Girl', portraits.bottleGirl, 'No velvet rope. No secret fee. No color test. Seat and a shuffle. That’s it.'),
      line('Cornball', portraits.cornball, 'Both signs true and I’m charging the vending machine for the lettering.'),
      line('Ganger Blue', portraits.blue, 'Board public. Terms boring. That’s beautiful actually.'),
      line('Promoter', portraits.promoter, 'Same bracket hit three venues without the price changing. Miracle.'),
      line('Cornball', portraits.cornball, 'Miracle or basic competence. Either way I’m documenting it.'),
      line('Bottle Girl', portraits.bottleGirl, 'Document later. Line moving now.'),
    ],
  },
  {
    chapterId: 'the-crown', nodeId: 'crown-blue-sets-the-table', section: 'pre', lines: [
      line('Ganger Blue', portraits.blue, 'I can serve a final without secretly picking who get to play it.'),
      line('Wifey', portraits.wifey, 'Look at you. Growth with no podium.'),
      line('Ganger Blue', portraits.blue, 'Don’t clap yet. I’m still me.'),
      line('Wifey', portraits.wifey, 'I know. That’s why I’m watching the list with both eyes.'),
      line('Cornball', portraits.cornball, 'Both eyes and a backup camera. Just in case the selective handwriting return.'),
      line('Ganger Blue', portraits.blue, 'Y’all really not gon’ let me have one clean moment.'),
      line('Wifey', portraits.wifey, 'Clean moments earned. You still on probation.'),
    ],
  },
  {
    chapterId: 'the-crown', nodeId: 'crown-final-rival', section: 'pre', lines: [
      line('Cracked Head', portraits.cracked, 'Let the result belong to the player. Not the story we dragged in here.'),
      line('Ganger Blue', portraits.blue, 'You really about to lose to a newcomer after all that.'),
      line('Cracked Head', portraits.cracked, 'I’m about to play fair. First time in a while that feel heavier than winning.'),
      line('Baby Momma', portraits.babyMomma, 'Win or lose, nobody get to call one good night a repaired family.'),
      line('Cracked Head', portraits.cracked, 'I hear you. Match is the match. The rest is separate.'),
      line('Cornball', portraits.cornball, 'Separate tabs. I like that. Filing it under “grown man behavior.”'),
      line('Ganger Blue', portraits.blue, 'Don’t start a whole folder yet. Let him lose first.'),
    ],
  },
  {
    chapterId: 'the-crown', nodeId: 'crown-final-rival', section: 'post', lines: [
      line('Cracked Head', portraits.cracked, 'You got me. Crown yours. Don’t make me regret saying it in front of all these phones.'),
      line('Ganger Blue', portraits.blue, 'Look at that. He can acknowledge a stranger. Put it on the church calendar.'),
      line('Cracked Head', portraits.cracked, 'Blue. Give me a minute later. Not for the cameras.'),
      line('Ganger Blue', portraits.blue, 'I ain’t going nowhere. For once.'),
      line('Baby Momma', portraits.babyMomma, 'Good. Keep that energy for tomorrow morning.'),
      line('Cornball', portraits.cornball, 'I’m already drafting the post-match report. Spoiler: the Open survived us.'),
    ],
  },
  {
    chapterId: 'the-crown', nodeId: 'crown-cornballs-table', section: 'post', lines: [
      line('Cornball', portraits.cornball, 'Four years, three appeals, and the vending machine refunded one sparkling water.'),
      line('Alley Runner', portraits.alley, 'You spent more on certified mail than the drink.'),
      line('Cornball', portraits.cornball, 'Justice got overhead. I budgeted for it.'),
      line('Ganger Blue', portraits.blue, 'Put the bottle on the open table. First round for whoever need a seat.'),
      line('Cornball', portraits.cornball, 'Shared access and shared bubbles. The Crown already abusing my settlement.'),
      line('Alley Runner', portraits.alley, 'Abuse it. At least somebody drinking the victory water.'),
    ],
  },
  {
    chapterId: 'the-crown', nodeId: 'crown-community-meal', section: 'main', lines: [
      line('Cracked Head', portraits.cracked, 'Small plate set. Got here early enough to ask where it belong.'),
      line('Baby Momma', portraits.babyMomma, 'Tomorrow early mean breakfast before school. Tonight mean listen and pass the rice.'),
      line('Ganger Blue', portraits.blue, 'Take your time. I’ll show you where Auntie hide the extra forks.'),
      line('Church Auntie', portraits.auntie, 'I don’t hide forks. I hide them from Cornball specifically.'),
      line('Cornball', portraits.cornball, 'Rooftop get sold and suddenly everybody auditing the silverware.'),
      line('Promoter', portraits.promoter, 'Sale real. Schedule we built real too. Tomorrow we defend the gathering place without pretending the Crown own the building.'),
      line('OG Uncle', portraits.uncle, 'Both my sons at the table. That’s enough for one night.'),
      line('Baby Momma', portraits.babyMomma, 'Tomorrow has a time and a task. That’s more real than any reunion speech.'),
      line('Cracked Head', portraits.cracked, 'I’ll be there. On time. No camera.'),
      line('Cornball', portraits.cornball, 'I’m taking attendance. And the forks. For science.'),
      line('Church Auntie', portraits.auntie, 'You taking nothing. Sit down and pass the rice.'),
    ],
  },
  {
    chapterId: 'the-crown', nodeId: 'crown-rooftop-sale', section: 'main', lines: [
      line('Techbro Rich', portraits.promoter, 'Paperwork signed. Building changing hands. The Open is… interesting content.'),
      line('Ganger Red', portraits.red, 'The Open is a schedule. Not content. And not yours to cancel.'),
      line('Promoter', portraits.promoter, 'Crown give scheduling rights. Not ownership. We already knew that.'),
      line('Cornball', portraits.cornball, 'So we keep the tables and lose the roof. Classic block ending.'),
      line('Church Auntie', portraits.auntie, 'Then we move the tables. Family still eat. That’s the part that don’t sell.'),
      line('Ganger Blue', portraits.blue, 'I’ll help move them. No podium required.'),
      line('Cracked Head', portraits.cracked, 'I’ll be there early. For the tables and the breakfast.'),
      line('Baby Momma', portraits.babyMomma, 'Early is the deal. Keep it.'),
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
