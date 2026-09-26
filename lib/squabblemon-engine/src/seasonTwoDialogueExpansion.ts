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
  oink: 'assets/characters/officer-oink.webp',
  landlord: 'assets/characters/landlord.webp',
  nail: 'assets/characters/nail-tech.webp',
} as const;

const line = (speaker: string, portraitAssetId: string, text: string): StoryDialogueLine => ({
  speaker,
  portraitAssetId,
  text,
});

/** Full Season Two expansion — every battle card lengthened with natural block energy. */
const additions: readonly Addition[] = [
  // ── Ch 9 Morning After (already expanded) ──
  { chapterId: 's2-the-morning-after', nodeId: 's2-rooftop-demo-table', section: 'pre', lines: [
    line('Techbro Rich', portraits.techbro, 'Center district become premium inventory in round three.'),
    line('Cornball', portraits.cornball, 'He put a velvet rope around a chalk square. The audacity got range.'),
    line('Ganger Red', portraits.red, 'Announced term simple: win and his demo rig come down tonight.'),
    line('Wifey', portraits.wifey, 'Don’t trip on his ring light. Actually, let him trip on it.'),
    line('Cornball', portraits.cornball, 'I’m taking odds on the backpack. Premium gravity incoming.'),
    line('Techbro Rich', portraits.techbro, 'The market will speak. Preferably in a dialect that likes me.'),
  ]},
  { chapterId: 's2-the-morning-after', nodeId: 's2-rooftop-demo-table', section: 'post', lines: [
    line('Techbro Rich', portraits.techbro, 'Demo rig goes. Market spoke in an inconvenient dialect.'),
    line('Cornball', portraits.cornball, 'Velvet rope caught his own backpack. Premium gravity confirmed.'),
    line('Baby Momma', portraits.babyMomma, 'Good. Photograph every label before anything move.'),
    line('Ganger Red', portraits.red, 'Labels first. Stories later. Order of operations.'),
    line('Wifey', portraits.wifey, 'And keep the ring light off. We already got enough drama without the glow.'),
  ]},
  { chapterId: 's2-the-morning-after', nodeId: 's2-launch-crew-scrimmage', section: 'pre', lines: [
    line('Live Streamer', portraits.streamer, 'Rich promised my channel exclusive rooftop access and a fog machine.'),
    line('Snitch', portraits.snitch, 'Exclusive hard when forty-seven people behind you. Optics is a myth.'),
    line('Baby Momma', portraits.babyMomma, 'Win the announced scrimmage; sponsor crates leave the family corner.'),
    line('Live Streamer', portraits.streamer, 'Fine, but the fog machine is emotionally essential.'),
    line('Cornball', portraits.cornball, 'Emotionally essential fog. File that under “things we never needed.”'),
    line('Snitch', portraits.snitch, 'I’m live either way. Fog or no fog, the ratio don’t care about your feelings.'),
  ]},
  { chapterId: 's2-the-morning-after', nodeId: 's2-launch-crew-scrimmage', section: 'post', lines: [
    line('Live Streamer', portraits.streamer, 'Crates moving. Fog machine stay off till it stop coughing.'),
    line('Snitch', portraits.snitch, 'It coughed glitter into Rich sparkling water. Content gold.'),
    line('Ganger Blue', portraits.blue, 'Family corner clear. Keep it clear.'),
    line('Baby Momma', portraits.babyMomma, 'Clear is the only setting that work around here.'),
    line('Cornball', portraits.cornball, 'Glitter water is now evidence. Don’t drink the exhibit.'),
  ]},
  { chapterId: 's2-the-morning-after', nodeId: 's2-first-night-watch', section: 'pre', lines: [
    line('Delivery Demon', portraits.delivery, 'Six work orders and three different addresses for this same roof.'),
    line('Alley Runner', portraits.alley, 'Then the contest decide whose inventory stage by the stairs, not who own anything.'),
    line('Delivery Demon', portraits.delivery, 'Winner pick the safe loading lane. Loser carry the inflatable R.'),
    line('Cornball', portraits.cornball, 'Why is there an inflatable R?'),
    line('Delivery Demon', portraits.delivery, 'RichRoof branding. Second R escaped on the expressway.'),
    line('Cornball', portraits.cornball, 'So we missing a letter and a plan. Classic.'),
    line('Alley Runner', portraits.alley, 'Safe lane first. Missing letters later.'),
  ]},
  { chapterId: 's2-the-morning-after', nodeId: 's2-first-night-watch', section: 'post', lines: [
    line('Delivery Demon', portraits.delivery, 'Safe lane yours. Logging the conflicting orders instead of dumping boxes.'),
    line('Alley Runner', portraits.alley, 'Give me copies. Routes tell the truth people forget to mention.'),
    line('Cornball', portraits.cornball, 'Inflatable R now wearing Blue crown. Nobody touch it. It’s art.'),
    line('Ganger Blue', portraits.blue, 'That crown was retired with dignity.'),
    line('Cornball', portraits.cornball, 'Dignity temporary. Inflatable R permanent. Deal with it.'),
  ]},

  // ── Ch 10 Rent Party ──
  { chapterId: 's2-the-rent-party', nodeId: 's2-fish-fry-fade', section: 'pre', lines: [
    line('Bottle Girl', portraits.bottleGirl, 'Winner run the serving lane; loser keep the fryer line moving.'),
    line('Church Auntie', portraits.auntie, 'And nobody call grease smoke ambience.'),
    line('All Jokes Roaster', portraits.roaster, 'I brought premium tartar sauce in a mustard bottle.'),
    line('Baby Momma', portraits.babyMomma, 'That sentence is why we inventory everything.'),
    line('Cornball', portraits.cornball, 'Mustard bottle of secrets. I’m labeling it EVIDENCE just in case.'),
    line('Bottle Girl', portraits.bottleGirl, 'Label it later. Serve now. Line getting long.'),
  ]},
  { chapterId: 's2-the-rent-party', nodeId: 's2-fish-fry-fade', section: 'post', lines: [
    line('Bottle Girl', portraits.bottleGirl, 'Serving lane yours. Cleared enough for the electrician deposit.'),
    line('Church Auntie', portraits.auntie, 'Count it twice, then wash your hands twice.'),
    line('All Jokes Roaster', portraits.roaster, 'The lamp sold. I accept partial credit.'),
    line('Cornball', portraits.cornball, 'Partial credit is still credit. Logging under “lamp justice.”'),
    line('Baby Momma', portraits.babyMomma, 'Log the money first. Justice can wait till the hands clean.'),
  ]},
  { chapterId: 's2-the-rent-party', nodeId: 's2-auction-interruption', section: 'pre', lines: [
    line('Promoter', portraits.promoter, 'My VIP auction can double this money if I get naming rights.'),
    line('Wifey', portraits.wifey, 'You may name one folding table for one evening.'),
    line('Promoter', portraits.promoter, 'Winner choose the public event slot. Terms posted.'),
    line('Cornball', portraits.cornball, 'I nominate Table Formerly Known as Sticky.'),
    line('Ganger Blue', portraits.blue, 'That table got history. Respect the stickiness.'),
    line('Wifey', portraits.wifey, 'History or not, the slot stay public. No private colors tonight.'),
  ]},
  { chapterId: 's2-the-rent-party', nodeId: 's2-auction-interruption', section: 'post', lines: [
    line('Promoter', portraits.promoter, 'Open slot stay public. My logo get the underside of one table.'),
    line('Cornball', portraits.cornball, 'Prime gum-facing placement. Prestigious.'),
    line('Ganger Blue', portraits.blue, 'Receipts match the cash box. Checked without moving anybody name.'),
    line('Wifey', portraits.wifey, 'Look at you. Checking without editing. Growth.'),
    line('Cornball', portraits.cornball, 'Growth and gum. The two pillars of this operation.'),
  ]},
  { chapterId: 's2-the-rent-party', nodeId: 's2-pledge-drive-final', section: 'pre', lines: [
    line('Ganger Blue', portraits.blue, 'Last table decide whether my livestream marathon or Wifey repair list get top billing.'),
    line('Wifey', portraits.wifey, 'The money follow the published list either way. We playing for the microphone.'),
    line('Baby Momma', portraits.babyMomma, 'Say it again for the people trained by last season.'),
    line('Ganger Blue', portraits.blue, 'Cards decide the microphone. Receipts decide the money. Damn, I heard myself grow.'),
    line('Cornball', portraits.cornball, 'Growth with a live mic. Dangerous combination. Recording just in case.'),
    line('Wifey', portraits.wifey, 'Record the totals. Not the speech.'),
  ]},
  { chapterId: 's2-the-rent-party', nodeId: 's2-pledge-drive-final', section: 'post', lines: [
    line('Ganger Blue', portraits.blue, 'Take the microphone. I’ll read the totals instead.'),
    line('Wifey', portraits.wifey, 'Read every expense, including your twelve-dollar metallic marker.'),
    line('Cornball', portraits.cornball, 'That marker signed one receipt and my forehead. Mixed value.'),
    line('Ganger Blue', portraits.blue, 'The forehead was collateral. I accept the charge.'),
    line('Baby Momma', portraits.babyMomma, 'Collateral accepted. Now count the rest out loud so everybody hear the real number.'),
  ]},

  // ── Ch 11 Unlicensed Improvements ──
  { chapterId: 's2-unlicensed-improvements', nodeId: 's2-tool-cage-rules', section: 'pre', lines: [
    line('Ganger Blue', portraits.blue, 'I labeled every tool. Color-coded. Vision-board adjacent.'),
    line('Wifey', portraits.wifey, 'You livestreamed the labeling. That’s how we got a noise complaint before the first screw.'),
    line('Cornball', portraits.cornball, 'I printed STOP BLUE FROM LIVESTREAMING ONCE. Three fonts. Narrow one still free.'),
    line('Cracked Head', portraits.cracked, 'Cage stays locked till the inspector sign. No exceptions for content.'),
    line('OG Uncle', portraits.uncle, 'And no more “vision” until the paper got ink on it.'),
    line('Ganger Blue', portraits.blue, 'Aight. Tools first. Narrative later. I heard y’all.'),
  ]},
  { chapterId: 's2-unlicensed-improvements', nodeId: 's2-tool-cage-rules', section: 'post', lines: [
    line('Cracked Head', portraits.cracked, 'Cage rules hold. You want a tool, you sign the sheet.'),
    line('Ganger Blue', portraits.blue, 'I signed. No camera. Just the sheet.'),
    line('Wifey', portraits.wifey, 'Progress. Keep it boring.'),
    line('Cornball', portraits.cornball, 'Boring is the new majestic. I’m updating the archive.'),
  ]},
  { chapterId: 's2-unlicensed-improvements', nodeId: 's2-paint-line-challenge', section: 'pre', lines: [
    line('Cornball', portraits.cornball, 'Paint line decide the safe zone. Cross it and you on the wrong side of the inspector.'),
    line('Ganger Blue', portraits.blue, 'I can paint a straight line without a livestream.'),
    line('Wifey', portraits.wifey, 'Prove it. Phone in the bucket.'),
    line('Cracked Head', portraits.cracked, 'Winner set the edge. Loser hold the roller and stay quiet.'),
    line('Cornball', portraits.cornball, 'I’m timing the quiet. Historical first.'),
  ]},
  { chapterId: 's2-unlicensed-improvements', nodeId: 's2-paint-line-challenge', section: 'post', lines: [
    line('Cracked Head', portraits.cracked, 'Edge is clean. Stay behind it till the rail pass.'),
    line('Ganger Blue', portraits.blue, 'Phone still in the bucket. Growth complete.'),
    line('Wifey', portraits.wifey, 'Growth is temporary. Bucket is permanent. Leave it there.'),
    line('Cornball', portraits.cornball, 'Bucket inventory updated. One phone, zero live streams. Perfect score.'),
  ]},
  { chapterId: 's2-unlicensed-improvements', nodeId: 's2-rail-inspection', section: 'pre', lines: [
    line('Officer Oink', portraits.oink, 'Rail either pass or it don’t. Cards don’t change the code.'),
    line('Ganger Red', portraits.red, 'Announced term: win and we get the re-inspection window without a fine.'),
    line('Wifey', portraits.wifey, 'Lose and we still fix it. Just slower and poorer.'),
    line('Cornball', portraits.cornball, 'I’m labeling the rail EVIDENCE OF COMPETENCE. Don’t make me change the font.'),
    line('Officer Oink', portraits.oink, 'Font don’t impress me. Torque does.'),
  ]},
  { chapterId: 's2-unlicensed-improvements', nodeId: 's2-rail-inspection', section: 'post', lines: [
    line('Officer Oink', portraits.oink, 'Window granted. Fix it right. I come back once.'),
    line('Ganger Blue', portraits.blue, 'We’ll be ready. No camera. Just the rail.'),
    line('Wifey', portraits.wifey, 'And the torque. He said torque.'),
    line('Cornball', portraits.cornball, 'Torque logged. Competence pending. Archive open.'),
  ]},

  // ── Ch 12 Regular Guy Behavior ──
  { chapterId: 's2-regular-guy-behavior', nodeId: 's2-regular-guy-open', section: 'pre', lines: [
    line('Regular guy named LeBron James', portraits.lebron, 'I fix appliances. That’s the whole bio. The name is a paperwork accident.'),
    line('Snitch', portraits.snitch, 'Paperwork accident currently trending. My mentions on fire.'),
    line('Cornball', portraits.cornball, 'Regular guy named LeBron James. Name tag and museum plaque already drafted.'),
    line('Wifey', portraits.wifey, 'He came to fix a fridge. Not to be content. Let the man work.'),
    line('Regular guy named LeBron James', portraits.lebron, 'Fridge first. Autographs never. I got a wrench and a boundary.'),
    line('Snitch', portraits.snitch, 'Boundary noted. Still getting the B-roll of the wrench though.'),
  ]},
  { chapterId: 's2-regular-guy-behavior', nodeId: 's2-regular-guy-open', section: 'post', lines: [
    line('Regular guy named LeBron James', portraits.lebron, 'Fridge cold. Invoice fair. I’m gone before the next caption.'),
    line('Cornball', portraits.cornball, 'Invoice filed under “regular excellence.” Plaque still pending.'),
    line('Snitch', portraits.snitch, 'Mentions cooling off. For now.'),
    line('Wifey', portraits.wifey, 'Good. Keep the man out the algorithm.'),
  ]},
  { chapterId: 's2-regular-guy-behavior', nodeId: 's2-news-van-scramble', section: 'pre', lines: [
    line('Snitch', portraits.snitch, 'News van outside. They think we got a celebrity appliance guy.'),
    line('Ganger Red', portraits.red, 'We got a regular guy and a working fridge. That’s the whole story.'),
    line('Cornball', portraits.cornball, 'I’m prepared to brief them on torque and boundaries.'),
    line('Baby Momma', portraits.babyMomma, 'Nobody brief nothing about the child or the private schedule.'),
    line('Wifey', portraits.wifey, 'Win this and the van leave with the fridge story only. Lose and they invent the rest.'),
  ]},
  { chapterId: 's2-regular-guy-behavior', nodeId: 's2-news-van-scramble', section: 'post', lines: [
    line('Snitch', portraits.snitch, 'Van left with “local repair hero” and zero family footage. Acceptable.'),
    line('Cornball', portraits.cornball, 'Hero of torque. I’m updating the plaque draft.'),
    line('Baby Momma', portraits.babyMomma, 'Update nothing that got a face on it. Text only.'),
    line('Ganger Red', portraits.red, 'Text only. Agreed. Next topic.'),
  ]},
  { chapterId: 's2-regular-guy-behavior', nodeId: 's2-noise-complaint-main-event', section: 'pre', lines: [
    line('Officer Oink', portraits.oink, 'Noise complaint from three doors down. Somebody streaming power tools at midnight.'),
    line('Ganger Blue', portraits.blue, 'That was one time. And the rail needed it.'),
    line('Wifey', portraits.wifey, 'The rail needed silence and daylight. You needed an audience.'),
    line('Cornball', portraits.cornball, 'I’m entering “one time” into the evidence log with a side-eye emoji.'),
    line('Officer Oink', portraits.oink, 'Win the table and the complaint stay a warning. Lose and I write the citation.'),
  ]},
  { chapterId: 's2-regular-guy-behavior', nodeId: 's2-noise-complaint-main-event', section: 'post', lines: [
    line('Officer Oink', portraits.oink, 'Warning only. Next midnight stream and the citation write itself.'),
    line('Ganger Blue', portraits.blue, 'No more midnight streams. Daylight and quiet. I got it.'),
    line('Wifey', portraits.wifey, 'Repeat it when the camera off.'),
    line('Cornball', portraits.cornball, 'Camera off logged. Quiet pending. Archive satisfied.'),
  ]},

  // ── Ch 13 Museum of the Block ──
  { chapterId: 's2-museum-of-the-block', nodeId: 's2-label-maker-war', section: 'pre', lines: [
    line('Cornball', portraits.cornball, 'Every object get a date or it don’t get a shelf. That’s the law of the crate.'),
    line('Inmate Crafty', portraits.crafty, 'My tiny chairs survived worse than this roof. They need secure display.'),
    line('Inmate Informant', portraits.informant, 'And a corrected glue credit. I been erased before. Not again.'),
    line('Baby Momma', portraits.babyMomma, 'No child photos in the public case. Ever. Non-negotiable.'),
    line('Ganger Red', portraits.red, 'History without the private parts. We can do both.'),
    line('Cornball', portraits.cornball, 'Both it is. Label maker locked and loaded.'),
  ]},
  { chapterId: 's2-museum-of-the-block', nodeId: 's2-label-maker-war', section: 'post', lines: [
    line('Cornball', portraits.cornball, 'Dates locked. Glue credit corrected. Tiny chairs secured.'),
    line('Inmate Crafty', portraits.crafty, 'Display approved. Respect.'),
    line('Inmate Informant', portraits.informant, 'Name back on the record. That’s all I needed.'),
    line('Baby Momma', portraits.babyMomma, 'Public case stay clean. Private stay private. Good.'),
  ]},
  { chapterId: 's2-museum-of-the-block', nodeId: 's2-memory-booth', section: 'pre', lines: [
    line('Snitch', portraits.snitch, 'Memory booth is open. People can leave a twenty-second story. No cuts, no sponsors.'),
    line('Wifey', portraits.wifey, 'And no filming kids. Sign is big. Enforce it.'),
    line('Cornball', portraits.cornball, 'I’m the bouncer of memory. Twenty seconds or the label maker come out.'),
    line('Ganger Blue', portraits.blue, 'I got a twenty-second apology ready if anybody need one.'),
    line('Cracked Head', portraits.cracked, 'Save it for the person it belong to. Not the booth.'),
  ]},
  { chapterId: 's2-museum-of-the-block', nodeId: 's2-memory-booth', section: 'post', lines: [
    line('Snitch', portraits.snitch, 'Booth full. No kid footage. Sources credited. I’m almost proud.'),
    line('Cornball', portraits.cornball, 'Pride logged. Archive growing. Milk crate still the MVP.'),
    line('Wifey', portraits.wifey, 'MVP of storage. Don’t let it go to its head.'),
  ]},
  { chapterId: 's2-museum-of-the-block', nodeId: 's2-curators-table', section: 'pre', lines: [
    line('Cornball', portraits.cornball, 'This table is the archive. Everything got a date or it don’t get a shelf.'),
    line('Inmate Crafty', portraits.crafty, 'Tiny chairs need secure display. They survived worse than this roof.'),
    line('Inmate Informant', portraits.informant, 'Corrected glue credit. I been erased before. Not again.'),
    line('Baby Momma', portraits.babyMomma, 'No child photos in the public case. Ever. That’s the only non-negotiable.'),
    line('Ganger Red', portraits.red, 'Agreed. History without the private parts. We can do both.'),
    line('Church Auntie', portraits.auntie, 'And somebody feed the people running the booth. Archive don’t run on air.'),
  ]},
  { chapterId: 's2-museum-of-the-block', nodeId: 's2-curators-table', section: 'post', lines: [
    line('Cornball', portraits.cornball, 'Shelf locked. Credits correct. Chairs safe. I’m taking a victory nap on the crate.'),
    line('Wifey', portraits.wifey, 'Nap later. Closing checklist first.'),
    line('Ganger Blue', portraits.blue, 'I’ll do the checklist. No livestream. Just the list.'),
  ]},

  // ── Ch 14 Everybody Has a Buyer ──
  { chapterId: 's2-everybody-has-a-buyer', nodeId: 's2-buyer-pitch-off', section: 'pre', lines: [
    line('Techbro Rich', portraits.techbro, 'I brought two alternate buyers. Competitive tension is healthy.'),
    line('Ganger Red', portraits.red, 'Healthy for who? Read the access terms out loud before anybody smile.'),
    line('Wifey', portraits.wifey, 'If the terms lock the community out after dark, we not interested in the smile.'),
    line('Cornball', portraits.cornball, 'I’m scoring each pitch on access, noise, and whether they try to rename the milk crate.'),
    line('Baby Momma', portraits.babyMomma, 'Rename nothing. Especially not the schedule around my child.'),
  ]},
  { chapterId: 's2-everybody-has-a-buyer', nodeId: 's2-buyer-pitch-off', section: 'post', lines: [
    line('Ganger Red', portraits.red, 'Both pitches fail the after-dark test. We keep looking.'),
    line('Techbro Rich', portraits.techbro, 'You’re leaving money on the table.'),
    line('Wifey', portraits.wifey, 'We leaving the community on the roof. Different math.'),
    line('Cornball', portraits.cornball, 'Math logged. Milk crate remains undefeated and unnamed.'),
  ]},
  { chapterId: 's2-everybody-has-a-buyer', nodeId: 's2-coop-chair-challenge', section: 'pre', lines: [
    line('Ganger Blue', portraits.blue, 'Co-op chair is rotating. I can sit in it and also leave it.'),
    line('Wifey', portraits.wifey, 'He practiced that sentence till the mirror filed minutes.'),
    line('Baby Momma', portraits.babyMomma, 'Center lane close while the childcare group cross downstairs. Schedule bend around people.'),
    line('Ganger Blue', portraits.blue, 'Schedule bends around people now. Not the other way around.'),
    line('Cornball', portraits.cornball, 'I’m notarizing that sentence. Growth exhibit A.'),
  ]},
  { chapterId: 's2-everybody-has-a-buyer', nodeId: 's2-coop-chair-challenge', section: 'post', lines: [
    line('Ganger Blue', portraits.blue, 'You host first. I set chairs and don’t stack them into government.'),
    line('Wifey', portraits.wifey, 'Two chairs maximum per hand, Mr. Growth.'),
    line('OG Uncle', portraits.uncle, 'Let him carry four. Accountability can build forearms.'),
    line('Cornball', portraits.cornball, 'Forearms and humility. Package deal.'),
  ]},
  { chapterId: 's2-everybody-has-a-buyer', nodeId: 's2-richs-option', section: 'pre', lines: [
    line('Techbro Rich', portraits.techbro, 'Last option: I match your deposit if the co-op take my branding on the stairwell.'),
    line('Ganger Red', portraits.red, 'Stairwell stay blank. Branding is how the roof got in trouble.'),
    line('Wifey', portraits.wifey, 'We already raised the deposit. Your option is late and loud.'),
    line('Cornball', portraits.cornball, 'Late, loud, and trying to put a logo on the stairs. That’s a no from the archive.'),
    line('Techbro Rich', portraits.techbro, 'You’re making this harder than it needs to be.'),
    line('Baby Momma', portraits.babyMomma, 'Hard is how we keep it. Easy is how we lose it.'),
  ]},
  { chapterId: 's2-everybody-has-a-buyer', nodeId: 's2-richs-option', section: 'post', lines: [
    line('Techbro Rich', portraits.techbro, 'Option declined. I’ll be at the premiere anyway.'),
    line('Ganger Red', portraits.red, 'Premiere is public. Your seat is not a share of the lease.'),
    line('Cornball', portraits.cornball, 'Seat logged. Share denied. Archive ruthless tonight.'),
  ]},

  // ── Ch 15 Premiere Night ──
  { chapterId: 's2-premiere-night', nodeId: 's2-overflow-open', section: 'pre', lines: [
    line('Bottle Girl', portraits.bottleGirl, 'Overflow line around the block. Same door rules. No VIP rope.'),
    line('Promoter', portraits.promoter, 'I can open a second entrance if the fire code allow.'),
    line('Wifey', portraits.wifey, 'Fire code allow one controlled entrance. We already checked.'),
    line('Cornball', portraits.cornball, 'I’m counting heads and receipts. Overflow don’t mean chaos.'),
    line('Ganger Blue', portraits.blue, 'I’ll work the line. No throne. Just the line.'),
  ]},
  { chapterId: 's2-premiere-night', nodeId: 's2-overflow-open', section: 'post', lines: [
    line('Bottle Girl', portraits.bottleGirl, 'Line moving. Nobody cut. Fire code smiling.'),
    line('Ganger Blue', portraits.blue, 'Line work is honest work. I’m good.'),
    line('Wifey', portraits.wifey, 'Honest and quiet. Keep both.'),
    line('Cornball', portraits.cornball, 'Both logged. Overflow handled. Archive proud.'),
  ]},
  { chapterId: 's2-premiere-night', nodeId: 's2-courier-cut-through', section: 'pre', lines: [
    line('Alley Runner', portraits.alley, 'Partner venues sent couriers with signed hour sheets. Three doors still open across town.'),
    line('Delivery Demon', portraits.delivery, 'I got the sheets and the seals. No conflicting addresses this time.'),
    line('Ganger Red', portraits.red, 'Good. Those doors are the backup if this roof ever need to breathe.'),
    line('Cornball', portraits.cornball, 'Backup doors logged. Network stronger than any single logo.'),
    line('Baby Momma', portraits.babyMomma, 'Network that don’t film the kids. Keep that part.'),
  ]},
  { chapterId: 's2-premiere-night', nodeId: 's2-courier-cut-through', section: 'post', lines: [
    line('Alley Runner', portraits.alley, 'Sheets filed. Seals match. Partner hours locked for the season.'),
    line('Delivery Demon', portraits.delivery, 'No inflatable letters this run. Progress.'),
    line('Cornball', portraits.cornball, 'Progress without inflatables. I’m framing the quiet.'),
  ]},
  { chapterId: 's2-premiere-night', nodeId: 's2-premiere-main-event', section: 'pre', lines: [
    line('Snitch', portraits.snitch, 'Full feed, source credits first, comments locked for public safety.'),
    line('Ganger Red', portraits.red, 'Credits before the channel name. Non-negotiable.'),
    line('Techbro Rich', portraits.techbro, 'I’ll take the back row. No pitch. Just the show.'),
    line('Wifey', portraits.wifey, 'Back row is fine. Front row is for the people who cleaned.'),
    line('Cornball', portraits.cornball, 'I made popcorn in the old fog machine. Tastes like batteries and closure.'),
  ]},
  { chapterId: 's2-premiere-night', nodeId: 's2-premiere-main-event', section: 'post', lines: [
    line('Snitch', portraits.snitch, 'Feed clean. Credits first. No crop. I’m almost a journalist.'),
    line('Ganger Red', portraits.red, 'Almost counts. Keep the source list public.'),
    line('Cornball', portraits.cornball, 'Journalist status pending. Popcorn status legendary.'),
  ]},

  // ── Ch 16 The Blockbuster ──
  { chapterId: 's2-the-blockbuster', nodeId: 's2-teardown-dash', section: 'pre', lines: [
    line('Delivery Demon', portraits.delivery, 'Loading route set. RichRoof exits through the service stairs.'),
    line('Cornball', portraits.cornball, 'The h folded into a question mark. Appropriate.'),
    line('Alley Runner', portraits.alley, 'Final crate logged. Roof is clear.'),
    line('Wifey', portraits.wifey, 'Clear means clear. No leftover ring lights in the corners.'),
    line('Ganger Blue', portraits.blue, 'I’ll sweep the corners. No throne required.'),
  ]},
  { chapterId: 's2-the-blockbuster', nodeId: 's2-teardown-dash', section: 'post', lines: [
    line('Delivery Demon', portraits.delivery, 'Last box gone. Stairs empty. I’m out.'),
    line('Cornball', portraits.cornball, 'Question-mark h is coming with me. Museum piece.'),
    line('Alley Runner', portraits.alley, 'Roof clear. Partners still open. We good.'),
  ]},
  { chapterId: 's2-the-blockbuster', nodeId: 's2-community-exhibition', section: 'pre', lines: [
    line('Ganger Blue', portraits.blue, 'This match select the first rotating host. I am eligible and removable.'),
    line('Wifey', portraits.wifey, 'He practiced that sentence in the mirror until the mirror filed minutes.'),
    line('Baby Momma', portraits.babyMomma, 'Center lane closes while the childcare group cross downstairs.'),
    line('Ganger Blue', portraits.blue, 'Schedule bends around people now, not the other way around.'),
    line('Cornball', portraits.cornball, 'I’m framing the removable part. That’s the growth.'),
  ]},
  { chapterId: 's2-the-blockbuster', nodeId: 's2-community-exhibition', section: 'post', lines: [
    line('Ganger Blue', portraits.blue, 'You host first. I set chairs and do not stack them into government.'),
    line('Wifey', portraits.wifey, 'Two chairs maximum per hand, Mr. Growth.'),
    line('OG Uncle', portraits.uncle, 'Let him carry four. Accountability can build forearms.'),
    line('Cornball', portraits.cornball, 'Forearms, humility, and a clear roof. Package deal complete.'),
  ]},
  { chapterId: 's2-the-blockbuster', nodeId: 's2-blockbuster-final', section: 'pre', lines: [
    line('Techbro Rich', portraits.techbro, 'One farewell exhibition. Winner get premiere billing on the archive.'),
    line('Ganger Red', portraits.red, 'Billing only. The lease, history, and public access settled elsewhere.'),
    line('Techbro Rich', portraits.techbro, 'Yes, counsel. I understand the nouns.'),
    line('Snitch', portraits.snitch, 'Full feed, source credits visible, comments temporarily locked for public safety.'),
    line('Cornball', portraits.cornball, 'I made popcorn in the fog machine. Tastes like batteries and ambition.'),
    line('Wifey', portraits.wifey, 'Ambition can wait. This match is for the record, not the launch.'),
  ]},
  { chapterId: 's2-the-blockbuster', nodeId: 's2-blockbuster-final', section: 'post', lines: [
    line('Techbro Rich', portraits.techbro, 'Use the title. Your cooperative outperformed my launch.'),
    line('Baby Momma', portraits.babyMomma, 'We paid the deposit while you was rehearsing your entrance. Check your phone.'),
    line('Ganger Blue', portraits.blue, 'And cause your inflatable letters had weak governance.'),
    line('Wifey', portraits.wifey, 'Let me enjoy this before you say governance again.'),
    line('Cornball', portraits.cornball, 'Governance, popcorn, and a deflated R. Peak block cinema.'),
  ]},
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
