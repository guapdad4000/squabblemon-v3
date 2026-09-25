export type SeasonTwoSpeech = readonly [speaker: string, text: string];

export type SeasonTwoBattleBeat = {
  readonly id: string;
  readonly title: string;
  readonly opponent: string;
  readonly before: readonly SeasonTwoSpeech[];
  readonly after: readonly SeasonTwoSpeech[];
  readonly rounds: 4 | 5 | 6;
  readonly rules?: "lock" | "reinforce" | "phase";
  readonly boss?: boolean;
};

export type SeasonTwoChapterScript = {
  readonly id: string;
  readonly order: number;
  readonly title: string;
  readonly subtitle: string;
  readonly description: string;
  readonly opening: readonly SeasonTwoSpeech[];
  readonly battles: readonly SeasonTwoBattleBeat[];
  readonly puzzle?: {
    readonly scene: readonly SeasonTwoSpeech[];
    readonly title: string;
    readonly instruction: string;
    readonly hints: readonly string[];
    readonly pieces: readonly { id: string; label: string; detail: string }[];
    readonly solution: readonly string[];
    readonly solvedText: string;
  };
  readonly closing: readonly SeasonTwoSpeech[];
};

export const seasonTwoScripts: readonly SeasonTwoChapterScript[] = [
  {
    id: "s2-the-morning-after",
    order: 9,
    title: "Chapter Nine: The Morning After",
    subtitle: "The crown schedules games. It does not own the roof.",
    description:
      "A victory cleanup becomes an emergency when Techbro Rich arrives to sell the rooftop back to its own neighborhood.",
    opening: [
      [
        "Cornball",
        "I found three trophies, one left shoe, and a crockpot still set to WARM. The Crown has consequences.",
      ],
      [
        "Ganger Blue",
        "Put my folding throne by the stairs. I am retiring it with dignity.",
      ],
      [
        "Wifey",
        "It is six chairs zip-tied together. Carry your dignity one chair at a time.",
      ],
      [
        "Cracked Head",
        "I got here early. The little one's place is set before anybody asks.",
      ],
      [
        "Baby Momma",
        "Good. Saturday at ten, library steps. Bring snacks you can identify without a logo.",
      ],
      ["Cracked Head", "Ten sharp. Apples, crackers, and no entrance music."],
      [
        "OG Uncle",
        "Look at that. Ten o’clock. I’m setting an alarm for you and a second one for your excuses.",
      ],
      [
        "Snitch",
        "Hold the tenderness. A man in white sneakers is measuring the roof with his phone.",
      ],
      [
        "Techbro Rich",
        "Great energy up here. Authentic wear patterns. You cannot manufacture this distress.",
      ],
      ["Alley Runner", "You are standing in spilled peach soda."],
      ["Techbro Rich", "Exactly. Organic patina."],
      [
        "Ganger Red",
        "State your business before Cornball catalogs you as abandoned property.",
      ],
      [
        "Techbro Rich",
        "The sale closes soon. I am converting this into RichRoof, a members-only culture platform.",
      ],
      [
        "Cornball",
        "We already have a culture platform. It is that milk crate. Sometimes it wobbles.",
      ],
      [
        "Techbro Rich",
        "Founding memberships start at ninety-nine dollars. Neighbors get a commemorative discount.",
      ],
      [
        "Wifey",
        "A discount to enter the place we cleaned for free? Blue, unfold one chair. I need to sit before I cuss professionally.",
      ],
      [
        "Baby Momma",
        "Who signed, what exactly transfers, and when do you think we leave? Three questions. No pitch deck.",
      ],
      [
        "Techbro Rich",
        "The owner's broker signed the term sheet. Final access begins after inspection.",
      ],
      ["Ganger Blue", "The Crown schedule says open play next Friday."],
      [
        "Ganger Red",
        "A schedule is not a deed. We protect Friday while we learn what was actually promised.",
      ],
      [
        "Cracked Head",
        "Then make him put tonight’s setup on the table. We need time to check his paperwork.",
      ],
      [
        "Techbro Rich",
        "Fine. Three promotional tables. Win, and my launch crew leaves tonight's setup untouched.",
      ],
      ["Wifey", "Say that on Snitch's camera, including the word tonight."],
      [
        "Snitch",
        "Already wide, already live, and for once nobody paid me to crop it.",
      ],
    ],
    battles: [
      {
        id: "s2-rooftop-demo-table",
        title: "The Demo Table",
        opponent: "Techbro Rich",
        rounds: 4,
        rules: "lock",
        before: [
          [
            "Techbro Rich",
            "Center district becomes premium inventory in round three.",
          ],
          ["Cornball", "He put a velvet rope around a chalk square."],
          [
            "Ganger Red",
            "The announced term is simple: win and his demo rig comes down tonight.",
          ],
          [
            "Wifey",
            "Do not trip on his ring light. Actually, let him trip on it.",
          ],
        ],
        after: [
          [
            "Techbro Rich",
            "The demo rig goes. The market has spoken in an inconvenient dialect.",
          ],
          [
            "Cornball",
            "His velvet rope caught his own backpack. Premium gravity.",
          ],
          ["Baby Momma", "Good. Photograph every label before anything moves."],
        ],
      },
      {
        id: "s2-launch-crew-scrimmage",
        title: "Launch Crew Scrimmage",
        opponent: "Live Streamer",
        rounds: 5,
        rules: "reinforce",
        before: [
          [
            "Live Streamer",
            "Rich promised my channel exclusive rooftop access and a fog machine.",
          ],
          ["Snitch", "Exclusive is hard with forty-seven people behind you."],
          [
            "Baby Momma",
            "Win the announced scrimmage; their sponsor crates leave the family corner.",
          ],
          [
            "Live Streamer",
            "Fine, but the fog machine is emotionally essential.",
          ],
        ],
        after: [
          [
            "Live Streamer",
            "Crates are moving. Fog machine stays off until it stops coughing.",
          ],
          ["Snitch", "It coughed glitter into Rich's sparkling water."],
          ["Ganger Blue", "Family corner is clear. Keep it clear."],
        ],
      },
      {
        id: "s2-first-night-watch",
        title: "First Night Watch",
        opponent: "Delivery Demon",
        rounds: 6,
        rules: "phase",
        boss: true,
        before: [
          [
            "Delivery Demon",
            "I have six work orders and three different addresses for this same roof.",
          ],
          [
            "Alley Runner",
            "Then our contest decides whose inventory gets staged by the stairs, not who owns anything.",
          ],
          [
            "Delivery Demon",
            "Winner picks the safe loading lane. Loser carries the inflatable R.",
          ],
          ["Cornball", "Why is there an inflatable R?"],
          [
            "Delivery Demon",
            "RichRoof branding. The second R escaped on the expressway.",
          ],
        ],
        after: [
          [
            "Delivery Demon",
            "Safe lane is yours. I am logging the conflicting orders instead of dumping boxes.",
          ],
          [
            "Alley Runner",
            "Give me copies. Routes tell the truth people forget to mention.",
          ],
          [
            "Cornball",
            "The inflatable R is now wearing Blue's crown. Nobody touch it.",
          ],
        ],
      },
    ],
    puzzle: {
      title: "The launch was already loaded",
      instruction:
        "Order the five records by real time. All are Wednesday except the owner’s Monday notice. Dispatch runs 20 minutes fast; other clocks are correct. What was already underway when Rich made his promise?",
      scene: [
        [
          "Ganger Red",
          "Five records. Correct dispatch’s clock before we accuse him.",
        ],
        [
          "Snitch",
          "My stream clock is synced. Dispatch has been twenty minutes fast all month.",
        ],
        ["Cornball", "I knew those drivers were living in the future."],
        ["Wifey", "Read the times, Doctor Strange."],
      ],
      pieces: [
        {
          id: "livestream-promise",
          label: "Public promise — Wednesday 20:00",
          detail: "Synchronized stream: “No changes before inspection.”",
        },
        {
          id: "gate-scan",
          label: "Launch crate enters — Wednesday 20:03",
          detail: "Correct gate clock. Seal matches the truck manifest.",
        },
        {
          id: "owner-notice",
          label: "Owner’s notice — Monday 10:00",
          detail: "Correct office clock. Inspection window announced.",
        },
        {
          id: "delivery-order",
          label: "Order generated — Wednesday 19:50",
          detail: "Fast dispatch clock. Equipment marked RELEASE IMMEDIATELY.",
        },
        {
          id: "truck-loaded",
          label: "Truck departs — Wednesday 20:12",
          detail: "Fast dispatch clock. Loaded with the launch crates.",
        },
      ],
      solution: [
        "owner-notice",
        "delivery-order",
        "truck-loaded",
        "livestream-promise",
        "gate-scan",
      ],
      hints: [
        "Subtract twenty minutes from both dispatch entries.",
        "The truck left at 19:52, before the 20:00 promise.",
      ],
      solvedText:
        "Order at 19:30, truck away at 19:52, promise at 20:00, crates through the gate at 20:03. The loading plan was already in motion; the matching seal connects it to Rich’s equipment.",
    },
    closing: [
      [
        "Ganger Red",
        "This does not cancel a sale. It documents a contradiction and buys us a clean inspection.",
      ],
      [
        "Baby Momma",
        "Copies go to the owner, every tenant contact, and nobody's private family thread.",
      ],
      [
        "Ganger Blue",
        "I wanted the Crown to fix this because wearing it was easier than asking for help.",
      ],
      [
        "Wifey",
        "Growth is noticing that before you build another chair throne.",
      ],
      [
        "Cracked Head",
        "Night watch is covered. I leave at nine-fifteen for Saturday's snacks.",
      ],
      [
        "OG Uncle",
        "And I am alive, awake, and taking the midnight shift with a thermos.",
      ],
      [
        "Cornball",
        "I assigned the inflatable R second watch. It has no eyelids, which is ideal.",
      ],
      ["Snitch", "Rich is gone for tonight. His paperwork is not."],
      [
        "Alley Runner",
        "Then tomorrow we raise money, fix what is ours to fix, and make leaving us harder than listening.",
      ],
      [
        "Wifey",
        "Everybody pick up something heavy. Including Blue’s expectations.",
      ],
    ],
  },
  {
    id: "s2-the-rent-party",
    order: 10,
    title: "Chapter Ten: The Rent Party",
    subtitle: "Everybody can fundraise. Nobody can agree how.",
    description:
      "The block throws three fundraisers at once and nearly spends the proceeds before collecting them.",
    opening: [
      [
        "Bottle Girl",
        "I booked a rent party, a fish fry, and a silent auction. Unfortunately they are all in the same hour.",
      ],
      ["Cornball", "The auction is not silent. Roaster is heckling a lamp."],
      ["All Jokes Roaster", "That lamp knows what it did."],
      [
        "Wifey",
        "Money has one purpose: inspection repairs and a community-use deposit if the owner agrees.",
      ],
      ["Ganger Blue", "I made wristbands."],
      [
        "Baby Momma",
        "You made colors again. Tear them in half and write RECEIPT on both sides.",
      ],
      ["Ganger Blue", "That is less majestic."],
      ["Wifey", "That is why it may work."],
    ],
    battles: [
      {
        id: "s2-fish-fry-fade",
        title: "Fish Fry Fade",
        opponent: "Bottle Girl",
        rounds: 4,
        rules: "reinforce",
        before: [
          [
            "Bottle Girl",
            "Winner runs the serving lane; loser keeps the fryer line moving.",
          ],
          ["Church Auntie", "And nobody calls grease smoke ambience."],
          [
            "All Jokes Roaster",
            "I brought premium tartar sauce in a mustard bottle.",
          ],
          ["Baby Momma", "That sentence is why we inventory everything."],
        ],
        after: [
          [
            "Bottle Girl",
            "Serving lane is yours. We cleared enough for the electrician's deposit.",
          ],
          ["Church Auntie", "Count it twice, then wash your hands twice."],
          ["All Jokes Roaster", "The lamp sold. I accept partial credit."],
        ],
      },
      {
        id: "s2-auction-interruption",
        title: "Auction Interruption",
        opponent: "Promoter",
        rounds: 5,
        rules: "lock",
        before: [
          [
            "Promoter",
            "My VIP auction can double this money if I get naming rights.",
          ],
          ["Wifey", "You may name one folding table for one evening."],
          ["Promoter", "Winner chooses the public event slot. Terms posted."],
          ["Cornball", "I nominate Table Formerly Known as Sticky."],
        ],
        after: [
          [
            "Promoter",
            "Open slot stays public. My logo gets the underside of one table.",
          ],
          ["Cornball", "Prime gum-facing placement."],
          [
            "Ganger Blue",
            "Receipts match the cash box. I checked without moving anybody's name.",
          ],
        ],
      },
      {
        id: "s2-pledge-drive-final",
        title: "Pledge Drive Final",
        opponent: "Ganger Blue",
        rounds: 6,
        rules: "phase",
        boss: true,
        before: [
          [
            "Ganger Blue",
            "Last table decides whether my livestream marathon or Wifey's repair list gets top billing.",
          ],
          [
            "Wifey",
            "The money follows the published list either way. We are playing for the microphone.",
          ],
          ["Baby Momma", "Say it again for the people trained by last season."],
          [
            "Ganger Blue",
            "Cards decide the microphone. Receipts decide the money. Damn, I heard myself grow.",
          ],
        ],
        after: [
          [
            "Ganger Blue",
            "Take the microphone. I will read the totals instead.",
          ],
          [
            "Wifey",
            "Read every expense, including your twelve-dollar metallic marker.",
          ],
          [
            "Cornball",
            "That marker signed one receipt and my forehead. Mixed value.",
          ],
        ],
      },
    ],
    closing: [
      [
        "Bottle Girl",
        "After food costs, we have the electrician's deposit and enough for safety rail materials.",
      ],
      [
        "Baby Momma",
        "Not enough for a purchase offer. Say the number without dressing it up.",
      ],
      [
        "Ganger Blue",
        "Three thousand, two hundred, eighteen dollars and a Canadian quarter.",
      ],
      ["Cornball", "The quarter is earmarked for international expansion."],
      ["Wifey", "It is earmarked for the jar."],
      [
        "Cracked Head",
        "I missed teardown once. Not tonight. Point me at the tables.",
      ],
      [
        "Baby Momma",
        "Start with the one your child covered in removable stickers.",
      ],
      ["Cracked Head", "Removable by whom? These got structural confidence."],
      [
        "OG Uncle",
        "You showed up for teardown. Keep doing that when there isn’t a camera.",
      ],
      [
        "Church Auntie",
        "Tomorrow we repair the roof. Tonight, take home the fish before Cornball auctions it again.",
      ],
    ],
  },
  {
    id: "s2-unlicensed-improvements",
    order: 11,
    title: "Chapter Eleven: Unlicensed Improvements",
    subtitle: "Measure twice. Stop Blue from livestreaming once.",
    description:
      "A repair day becomes a contest between practical work and spectacularly unsafe inspiration.",
    opening: [
      [
        "Wifey",
        "Licensed electrician at noon. Safety rail team at one. Nobody improvises load-bearing art.",
      ],
      ["Ganger Blue", "My mural concept includes a functional zip line."],
      ["Wifey", "Your concept includes you going home."],
      ["Cornball", "I am certified in holding the flashlight wrong."],
      [
        "Cracked Head",
        "Give me the loose boards. Parenting taught me every object eventually becomes a drum.",
      ],
      [
        "Baby Momma",
        "Parenting taught me to read instructions before somebody eats the screws.",
      ],
      [
        "OG Uncle",
        "I brought work gloves and the humility to remain on ground level.",
      ],
      [
        "Landlord",
        "Cute volunteer day. The owner still expects code compliance, not neighborhood vibes.",
      ],
    ],
    battles: [
      {
        id: "s2-tool-cage-rules",
        title: "Tool Cage Rules",
        opponent: "Landlord",
        rounds: 4,
        rules: "lock",
        before: [
          [
            "Landlord",
            "Win and your licensed crew gets the tool cage until three.",
          ],
          [
            "Wifey",
            "Lose and the same licensed crew works slower. Nobody unlicensed touches wiring.",
          ],
          [
            "Cornball",
            "I have labeled the extension cords by emotional availability.",
          ],
          ["Landlord", "I already regret the clause."],
        ],
        after: [
          ["Landlord", "Tool cage until three, exactly as announced."],
          ["Wifey", "Electrician first. Blue's fog machine charger never."],
          [
            "Ganger Blue",
            "I withdrew that proposal before the sentence ended.",
          ],
        ],
      },
      {
        id: "s2-paint-line-challenge",
        title: "Paint Line Challenge",
        opponent: "Nail Tech",
        rounds: 5,
        rules: "reinforce",
        before: [
          [
            "Nail Tech",
            "I mixed weatherproof colors. Scammer mixed something he calls legally adjacent primer.",
          ],
          ["Scammer", "It is eggshell-ish."],
          [
            "Baby Momma",
            "Winner chooses the mural border; the safety markings stay regulation yellow.",
          ],
          ["Cornball", "My border proposal is little receipts holding hands."],
        ],
        after: [
          [
            "Nail Tech",
            "Border selected. Safety marks remain visible and Scammer's bucket remains closed.",
          ],
          ["Scammer", "This is discrimination against entrepreneurial beige."],
          ["Baby Momma", "This is a lid. Put it on."],
        ],
      },
      {
        id: "s2-rail-inspection",
        title: "Rail Inspection",
        opponent: "Cracked Head",
        rounds: 6,
        rules: "phase",
        boss: true,
        before: [
          [
            "Cracked Head",
            "I want the last shift because I can finish it fastest.",
          ],
          [
            "Baby Momma",
            "Fast is not the commitment. Safe, documented, and leaving by nine-fifteen is.",
          ],
          [
            "Cracked Head",
            "Then this contest picks shift lead. The inspector still approves the rail.",
          ],
          [
            "OG Uncle",
            "Lose gracefully. Those bolts don’t care about your win rate.",
          ],
        ],
        after: [
          ["Cracked Head", "You lead. I log every bolt and leave on time."],
          [
            "Baby Momma",
            "Good. Your child asked if rooftop repairs mean the moon gets a fence.",
          ],
          [
            "Cracked Head",
            "Tell them only the dangerous part. The moon remains unregulated.",
          ],
        ],
      },
    ],
    closing: [
      [
        "Wifey",
        "Rail passed. Wiring passed. Drain cleared after Cornball apologized to it.",
      ],
      [
        "Cornball",
        "The drain had swallowed my auction paddle. We both needed closure.",
      ],
      [
        "Landlord",
        "I will send the compliance report to the owner. No promises beyond that.",
      ],
      [
        "Ganger Red",
        "A dated report is better than a promise. Send every page.",
      ],
      ["Ganger Blue", "The wall looks good without my zip line."],
      ["Wifey", "You may paint one tiny zip line with no people on it."],
      ["Ganger Blue", "Marriage is compromise."],
      [
        "Baby Momma",
        "Parenting pickup happened on time. Put that in the report that matters.",
      ],
      ["Cracked Head", "Already did."],
      [
        "OG Uncle",
        "The roof is safer. Next problem: make the city admit people use it.",
      ],
    ],
  },
  {
    id: "s2-regular-guy-behavior",
    order: 12,
    title: "Chapter Twelve: Regular Guy Behavior",
    subtitle: "Publicity arrives wearing somebody else's jersey.",
    description:
      "A painfully normal celebrity campaign draws attention, noise complaints, and one exact Regular guy named LeBron James.",
    opening: [
      [
        "Promoter",
        "We need public proof this roof serves people. I booked a regular neighborhood testimonial.",
      ],
      [
        "Regular guy named LeBron James",
        "Hey. I am LeBron James. Not the basketball player. Regular guy. Appliance repair.",
      ],
      [
        "Cornball",
        "Your business card says LeBRON JAMES in forty-point type and appliance repair in dust.",
      ],
      ["Regular guy named LeBron James", "Brand recognition is not a crime."],
      ["Ganger Blue", "Can you dunk?"],
      [
        "Regular guy named LeBron James",
        "A washing-machine lid, yes. A basketball, medically no.",
      ],
      [
        "Snitch",
        "The famous-name misunderstanding has tripled viewers and summoned two news vans.",
      ],
      [
        "Baby Momma",
        "Then point every camera away from children and toward the repair log.",
      ],
      ["Wifey", "And somebody unplug Blue's smoke cannons."],
    ],
    battles: [
      {
        id: "s2-regular-guy-open",
        title: "Regular Guy Open",
        opponent: "Regular guy named LeBron James",
        rounds: 4,
        rules: "reinforce",
        before: [
          [
            "Regular guy named LeBron James",
            "Winner gets the testimonial slot. Loser helps me carry a dryer belt display.",
          ],
          ["Cornball", "Is the display heavy?"],
          [
            "Regular guy named LeBron James",
            "Emotionally. Nobody respects belts until the drum stops.",
          ],
          [
            "Promoter",
            "His card says appliance repair. If the news crops that out, I’m standing in front of the lens.",
          ],
        ],
        after: [
          [
            "Regular guy named LeBron James",
            "You get the slot. I still request one sentence about lint safety.",
          ],
          ["Baby Momma", "You get six words."],
          [
            "Regular guy named LeBron James",
            "Clean your lint trap, beloved community.",
          ],
        ],
      },
      {
        id: "s2-news-van-scramble",
        title: "News Van Scramble",
        opponent: "Live Streamer",
        rounds: 5,
        rules: "lock",
        before: [
          [
            "Live Streamer",
            "My viewers want a rooftop feud, not a compliance binder.",
          ],
          [
            "Snitch",
            "Then compete for the first interview and live with the answer.",
          ],
          [
            "Ganger Red",
            "Center lane closes while the news van blocks the stairs.",
          ],
          [
            "Wifey",
            "If that van crushes my repair cones, your channel buys new ones.",
          ],
        ],
        after: [
          [
            "Live Streamer",
            "Fine. First interview is the player and the repair crew.",
          ],
          [
            "Snitch",
            "My feed caught the van rolling over RichRoof flyers instead.",
          ],
          ["Wifey", "Leave them there until the camera gets the date."],
        ],
      },
      {
        id: "s2-noise-complaint-main-event",
        title: "Noise Complaint Main Event",
        opponent: "Officer Oink",
        rounds: 6,
        rules: "phase",
        boss: true,
        before: [
          [
            "Officer Oink",
            "Complaint says amplified yelling, obstructed stairs, and one fraudulent athlete.",
          ],
          [
            "Regular guy named LeBron James",
            "I have been this LeBron James since birth. Take it up with my mother.",
          ],
          [
            "Baby Momma",
            "The announced table settles whether the event ends now or at the permitted hour.",
          ],
          [
            "Officer Oink",
            "Until the permitted hour if you win. Either way, that van moves. It’s been blinking at me for twenty minutes.",
          ],
        ],
        after: [
          [
            "Officer Oink",
            "Event continues until the permitted hour. Clear the stair landing.",
          ],
          [
            "Regular guy named LeBron James",
            "I will move the belt display. It has caused enough division.",
          ],
          [
            "Cornball",
            "History will remember where it stood. I drew chalk around it.",
          ],
        ],
      },
    ],
    closing: [
      [
        "Promoter",
        "The segment aired: repairs, open play, family programming, no fake ownership claims.",
      ],
      ["Snitch", "Also seven seconds of Cornball saluting a dryer belt."],
      ["Cornball", "Public service requires sacrifice."],
      [
        "Regular guy named LeBron James",
        "My shop got nineteen calls. Eighteen asked if I could fix a jump shot.",
      ],
      ["Ganger Blue", "Can you?"],
      [
        "Regular guy named LeBron James",
        "I can replace a squeaky bearing. Start there.",
      ],
      [
        "Baby Momma",
        "Publicity bought attention. Now attention needs a record longer than one news cycle.",
      ],
      [
        "Ganger Red",
        "An exhibit: photos, schedules, repairs, and statements from people who use the space.",
      ],
      ["Wifey", "A museum nobody can keep clean. Perfect."],
    ],
  },
  {
    id: "s2-museum-of-the-block",
    order: 13,
    title: "Chapter Thirteen: Museum of the Block",
    subtitle: "Do not laminate somebody else's memory.",
    description:
      "The block builds a living exhibit while arguing over whose version deserves the biggest frame.",
    opening: [
      [
        "Ganger Red",
        "Name, date, owner. If you don’t know whose picture it is, put it down.",
      ],
      ["Snitch", "I have footage."],
      ["Baby Momma", "You have requests to make."],
      [
        "Cracked Head",
        "Leave the memorial shirt out unless everybody harmed by that lie agrees.",
      ],
      [
        "Ganger Blue",
        "Agreed. We do not turn pain into a centerpiece because the frame is dramatic.",
      ],
      [
        "Wifey",
        "That was almost emotionally literate. Hold still while I mark the date.",
      ],
      [
        "Inmate Crafty",
        "I brought miniature folding chairs made from commissary wrappers.",
      ],
      ["Inmate Informant", "And I brought the exact time he stole my glue."],
      ["Inmate Crafty", "Borrowed. The museum will contextualize it."],
    ],
    battles: [
      {
        id: "s2-label-maker-war",
        title: "Label Maker War",
        opponent: "Inmate Crafty",
        rounds: 4,
        rules: "lock",
        before: [
          ["Inmate Crafty", "Winner writes the label for my chair sculpture."],
          [
            "Inmate Informant",
            "Label must include disputed adhesive provenance.",
          ],
          ["Ganger Red", "Source note, not an accusation in all caps."],
          ["Cornball", "I printed GLUE SITUATION before guidance arrived."],
        ],
        after: [
          [
            "Inmate Crafty",
            "Use your label. The chairs still recline if you pinch the wrapper.",
          ],
          ["Inmate Informant", "Add that the mechanism was my idea."],
          [
            "Wifey",
            "Add both names and move on before the label becomes a miniseries.",
          ],
        ],
      },
      {
        id: "s2-memory-booth",
        title: "Memory Booth",
        opponent: "Inmate Boyfriend",
        rounds: 5,
        rules: "reinforce",
        before: [
          [
            "Inmate Boyfriend",
            "My booth records dedications. Winner gets prime audio time.",
          ],
          [
            "Baby Momma",
            "Nobody records a child, a private call, or a story they cannot release.",
          ],
          [
            "Inmate Boyfriend",
            "Understood. My dedication is to Keisha and the concept of patience.",
          ],
          ["Cornball", "The concept declined comment."],
        ],
        after: [
          [
            "Inmate Boyfriend",
            "Prime slot is yours. I will record mine after the permission forms.",
          ],
          [
            "Baby Momma",
            "Ask Keisha before you play it. I am not refereeing another voicemail breakup.",
          ],
          [
            "Snitch",
            "I turned my camera off. Please note the personal growth while it cannot be verified.",
          ],
        ],
      },
      {
        id: "s2-curators-table",
        title: "Curator's Table",
        opponent: "Ganger Red",
        rounds: 6,
        rules: "phase",
        boss: true,
        before: [
          [
            "Ganger Red",
            "Winner chooses the exhibit order. Every item remains sourced.",
          ],
          [
            "Ganger Blue",
            "Put labor before leaders. The lights did not keep themselves on.",
          ],
          [
            "Wifey",
            "Name the women who organized, cooked, cleaned, and fixed your math.",
          ],
          [
            "OG Uncle",
            "And place my false story where nobody mistakes it for protection without a cost.",
          ],
        ],
        after: [
          [
            "Ganger Red",
            "Order accepted: people, work, conflict, repair, future.",
          ],
          ["Ganger Blue", "My Crown photo can go by the mop schedule."],
          ["Wifey", "At last, accurate scale."],
        ],
      },
    ],
    puzzle: {
      title: "The rail in five photographs",
      instruction:
        "Order the five repair records by what physically changed. These photographs have no reliable timestamps. Bolt holes and primer remain visible in later stages; nobody removes or repaints them.",
      scene: [
        [
          "Ganger Red",
          "Five photos. Camera clock reset, but the rail still tells us what happened.",
        ],
        [
          "Inmate Informant",
          "I can identify the drill bit by the way it disappointed me.",
        ],
        ["Cornball", "I contributed the thumb in photo two."],
        ["Wifey", "Then move it so we can see."],
      ],
      pieces: [
        {
          id: "inspection-report",
          label: "Signed inspection",
          detail:
            "Inspector’s sticker crosses dry yellow paint. All bolts fitted.",
        },
        {
          id: "drilled-rail",
          label: "Drilled rail",
          detail:
            "New bolt holes. Bare metal inside and outside them. No primer.",
        },
        {
          id: "supply-receipt",
          label: "Delivered rail",
          detail: "Unpierced bare metal. Supplier’s wrapping still attached.",
        },
        {
          id: "volunteer-photo",
          label: "Bolts and yellow paint",
          detail:
            "Primer visible under yellow edges. All bolts fitted. No sticker.",
        },
        {
          id: "primer-coat",
          label: "Primed rail",
          detail: "Primer lines the drilled holes. No bolts or yellow paint.",
        },
      ],
      solution: [
        "supply-receipt",
        "drilled-rail",
        "primer-coat",
        "volunteer-photo",
        "inspection-report",
      ],
      hints: [
        "Track irreversible changes: holes, primer, bolts and paint, sticker.",
        "Bare holes precede primed holes. The sticker crosses finished paint.",
      ],
      solvedText:
        "Delivered, drilled, primed, assembled and painted, inspected. The material record backs the repair crew’s account even with the broken camera clock.",
    },
    closing: [
      [
        "OG Uncle",
        "This museum does not make us innocent. It makes us legible.",
      ],
      ["Cracked Head", "And the parenting schedule stays off the wall."],
      ["Baby Momma", "Correct. Our child's life is not community memorabilia."],
      [
        "Ganger Blue",
        "Techbro offered to sponsor the exhibit if his portrait opens it.",
      ],
      ["Wifey", "Tell him the mop already has a sponsor slot."],
      ["Snitch", "Two new buyers contacted him after the news story."],
      [
        "Ganger Red",
        "Then the exhibit must travel. One roof cannot be the only place holding its own evidence.",
      ],
      [
        "Inmate Crafty",
        "My chairs fold flat. I designed for institutional instability.",
      ],
      ["Cornball", "Load the milk crate. The museum is going on tour."],
    ],
  },
  {
    id: "s2-everybody-has-a-buyer",
    order: 14,
    title: "Chapter Fourteen: Everybody Has a Buyer",
    subtitle: "Every solution has a logo and a catch.",
    description:
      "Competing rescue plans split the coalition until their hidden costs are read aloud.",
    opening: [
      [
        "Techbro Rich",
        "Good news. I have partners: luxury fitness, branded worship, and a content jail.",
      ],
      [
        "Inmate Contraband",
        "Content jail is just a studio with worse snacks. I consulted.",
      ],
      [
        "Church Auntie",
        "Branded worship is a phrase that should fear lightning.",
      ],
      ["Promoter", "My buyer keeps public events quarterly."],
      [
        "Bottle Girl",
        "Quarterly means four cookouts and three hundred sixty-one locked days.",
      ],
      ["Ganger Blue", "I have a community cooperative proposal."],
      [
        "Wifey",
        "It currently says CHAIRMAN BLUE in letters larger than the budget.",
      ],
      ["Ganger Blue", "I can reduce the font and the ego attached."],
      [
        "Baby Momma",
        "Read every plan's access terms. Which days can we actually get in? Read that part before you clap.",
      ],
    ],
    battles: [
      {
        id: "s2-buyer-pitch-off",
        title: "Buyer Pitch-Off",
        opponent: "Promoter",
        rounds: 4,
        rules: "reinforce",
        before: [
          [
            "Promoter",
            "Winner gets ten uninterrupted minutes before the owner.",
          ],
          [
            "Bottle Girl",
            "Ten minutes. I’ll hold the microphone and the stopwatch. Try me.",
          ],
          ["Techbro Rich", "My deck has synergies and a capitalization table."],
          ["Cornball", "My table capitalizes random Words too."],
        ],
        after: [
          [
            "Promoter",
            "Ten minutes are yours. My quarterly plan remains on the table.",
          ],
          [
            "Baby Momma",
            "Four days a year? Even my worst ex showed up more than that.",
          ],
          [
            "Cornball",
            "I confiscated Rich's laser pointer after it challenged the moon.",
          ],
        ],
      },
      {
        id: "s2-coop-chair-challenge",
        title: "Co-op Chair Challenge",
        opponent: "Ganger Blue",
        rounds: 5,
        rules: "lock",
        before: [
          ["Ganger Blue", "Winner rewrites the governance page."],
          [
            "Wifey",
            "The community already rewrote it. You are competing for who presents.",
          ],
          ["Ganger Blue", "Right. Old reflex."],
          [
            "OG Uncle",
            "You caught yourself. Don’t celebrate yet; you still made a chairman banner.",
          ],
        ],
        after: [
          [
            "Ganger Blue",
            "You present. The board has rotating seats and no permanent chairman.",
          ],
          [
            "Wifey",
            "Also childcare reimbursement, because meetings do not raise children.",
          ],
          [
            "Cracked Head",
            "Put me on setup, not leadership. I need a record of ordinary work.",
          ],
        ],
      },
      {
        id: "s2-richs-option",
        title: "Rich's Option",
        opponent: "Techbro Rich",
        rounds: 6,
        rules: "phase",
        boss: true,
        before: [
          [
            "Techbro Rich",
            "Win and I disclose my option deadline. Lose and you stop calling my plan displacement on my own livestream.",
          ],
          [
            "Ganger Red",
            "No. The match can settle disclosure because you offered it. Speech is not your wager to own.",
          ],
          ["Techbro Rich", "Fine. Deadline disclosure only."],
          ["Snitch", "Recorded with all the boring parts intact."],
        ],
        after: [
          [
            "Techbro Rich",
            "My reservation expires premiere night at ten. It is non-exclusive: the owner can accept a compliant competing offer before then.",
          ],
          ["Baby Momma", "Ten o’clock. Finally, a number we can use."],
          ["Ganger Red", "And now it is dated, witnessed, and useful."],
        ],
      },
    ],
    closing: [
      ["Wifey", "The cooperative cannot match Rich's price today."],
      [
        "Ganger Blue",
        "But it can guarantee public hours, repair funding, and resident oversight.",
      ],
      [
        "Cracked Head",
        "I know people from the cellblock who built programs out of less than this.",
      ],
      ["Inmate Contraband", "I can source folding tables."],
      ["Baby Momma", "Legally."],
      [
        "Inmate Contraband",
        "Then I can admire folding tables from a respectful distance.",
      ],
      [
        "OG Uncle",
        "The owner needs evidence the block can perform the agreement, not just desire it.",
      ],
      [
        "Ganger Red",
        "Premiere night demonstrates operations. Agreements from partner venues demonstrate continuity.",
      ],
      [
        "Church Auntie",
        "Then feed the partners before anybody calls it networking.",
      ],
    ],
  },
  {
    id: "s2-premiere-night",
    order: 15,
    title: "Chapter Fifteen: Premiere Night",
    subtitle: "Packed house. Missing signature. Nine fifty-three.",
    description:
      "On the option deadline, the block runs its largest event while a missing signature threatens the cooperative plan.",
    opening: [
      [
        "Snitch",
        "Premiere night: traveling museum, open tournament, childcare room, and no functioning ticket printer.",
      ],
      [
        "Cornball",
        "I am handwriting tickets. My wrist now has a union representative.",
      ],
      [
        "Baby Momma",
        "Childcare check-in is not content. Cameras stay outside the blue tape.",
      ],
      ["Snitch", "My lens has never respected tape this quickly."],
      [
        "Cracked Head",
        "Snack station stocked. Pickup schedule covered. I am not entering the first table.",
      ],
      ["Ganger Blue", "You sure?"],
      [
        "Cracked Head",
        "My kid’s waiting at the snack table. I’m not making them watch me choose a crowd again.",
      ],
      ["Wifey", "Somebody frame that after he finishes cutting apples."],
      [
        "Ganger Red",
        "We are missing the partner-venue signature that proves overflow access.",
      ],
      [
        "Alley Runner",
        "Courier has it, but Rich's launch barricade blocked the direct route.",
      ],
    ],
    battles: [
      {
        id: "s2-overflow-open",
        title: "Overflow Open",
        opponent: "Hooper",
        rounds: 4,
        rules: "lock",
        before: [
          [
            "Hooper",
            "Winner runs overflow seating. Loser runs the same seating under their direction.",
          ],
          ["Bottle Girl", "Good. Somebody finally made losing useful."],
          [
            "Cornball",
            "Center lane closes because I put three hundred handwritten tickets there to dry.",
          ],
          ["Hooper", "Nobody sneeze until round five."],
        ],
        after: [
          ["Hooper", "Overflow is yours. I will keep the stairs clear."],
          [
            "Cornball",
            "One ticket attached itself to Rich's shoe and gained backstage access.",
          ],
          ["Wifey", "Let it report back."],
        ],
      },
      {
        id: "s2-courier-cut-through",
        title: "Courier Cut-Through",
        opponent: "Alley Runner",
        rounds: 5,
        rules: "reinforce",
        before: [
          [
            "Alley Runner",
            "Contest picks who carries the agreement through the crowd. The route stays public either way.",
          ],
          [
            "Ganger Red",
            "No hero shortcuts. Chain of custody at every handoff.",
          ],
          ["Snitch", "I can film the route from behind the privacy line."],
          [
            "Baby Momma",
            "You can film the document. Leave families out of your background.",
          ],
        ],
        after: [
          ["Alley Runner", "You carry. I call each handoff and keep the copy."],
          [
            "Ganger Red",
            "Seal number matches. Only the owner’s countersignature remains.",
          ],
          [
            "Cornball",
            "I offered the envelope a wristband. It declined colors.",
          ],
        ],
      },
      {
        id: "s2-premiere-main-event",
        title: "Premiere Main Event",
        opponent: "Techbro Rich",
        rounds: 6,
        rules: "phase",
        boss: true,
        before: [
          [
            "Techbro Rich",
            "My launch starts at ten. Winner gets the stage until nine-fifty-five.",
          ],
          [
            "Ganger Blue",
            "Stage time only. No claim over the roof, signature, or crowd.",
          ],
          ["Techbro Rich", "You people have become exhausting about nouns."],
          ["Wifey", "Four years of consequences will do that. Shuffle."],
        ],
        after: [
          [
            "Techbro Rich",
            "Stage is yours until nine-fifty-five. My countdown continues.",
          ],
          [
            "Ganger Blue",
            "Then use our five minutes to read the access agreement, not celebrate me.",
          ],
          ["Wifey", "There he is. Annoying in a promising new direction."],
        ],
      },
    ],
    puzzle: {
      title: "Nine fifty-three, seal intact",
      instruction:
        "Rebuild the packet’s five handoffs. Match each recorded OUT custody code to the next IN code. Start at the partner’s signature and finish with the owner. A crowd photo alone does not prove a handoff.",
      scene: [
        [
          "Ganger Red",
          "Five custody marks. We need one unbroken path to the owner.",
        ],
        [
          "Alley Runner",
          "My copy has the seal number at each handoff. Match those, not whoever looks official in the photo.",
        ],
        ["Cornball", "I am wearing an EVENT NOTARY hat."],
        ["Wifey", "And holding the envelope upside down. Start over."],
      ],
      pieces: [
        {
          id: "owner-delivery",
          label: "Owner receives — 21:53",
          detail: "IN B7. Seal 41 intact; owner signs receipt.",
        },
        {
          id: "courier-receives",
          label: "Courier receives",
          detail: "IN P4 → OUT C9. Seal 41 intact.",
        },
        {
          id: "blue-receives",
          label: "Blue receives",
          detail:
            "IN W2 → OUT B7. Seal 41 intact; microphone already handed over.",
        },
        {
          id: "partner-signs",
          label: "Partner signs — 20:42",
          detail: "No incoming code. Packet sealed 41; OUT P4.",
        },
        {
          id: "stage-desk",
          label: "Stage desk receives",
          detail: "IN C9 → OUT W2. Seal 41 intact; logged at the side table.",
        },
      ],
      solution: [
        "partner-signs",
        "courier-receives",
        "stage-desk",
        "blue-receives",
        "owner-delivery",
      ],
      hints: [
        "The signed partner copy is the only record with no incoming code.",
        "Follow P4, then C9, then W2, then B7.",
      ],
      solvedText:
        "Seal 41 stays intact through every matched handoff. The owner receives the completed packet at 21:53, seven minutes before Rich’s reservation ends.",
    },
    closing: [
      [
        "Ganger Red",
        "Packet is complete. The owner is reviewing it before Rich's option expires.",
      ],
      [
        "Techbro Rich",
        "Reviewing it doesn’t mean she signed. I checked twice.",
      ],
      ["Baby Momma", "Correct. Look at us all using precise nouns."],
      [
        "Cracked Head",
        "Snack shift complete. My kid rated the apples 'too apple.' I accept the note.",
      ],
      [
        "OG Uncle",
        "The crowd stayed, the exits stayed clear, and nobody needed a miracle.",
      ],
      ["Snitch", "Nine fifty-nine. Rich's inflatable logo just lost air."],
      ["Cornball", "The R has returned to civilian life."],
      [
        "Wifey",
        "Whatever the owner decides, this operation exists in more than speeches now.",
      ],
      [
        "Alley Runner",
        "And if the roof closes, three partner spaces signed continuity hours.",
      ],
    ],
  },
  {
    id: "s2-the-blockbuster",
    order: 16,
    title: "Chapter Sixteen: The Blockbuster",
    subtitle: "Keep the place by becoming more than a place.",
    description:
      "Evidence, signed access agreements, and coordinated action give the cooperative one final chance to secure the rooftop.",
    opening: [
      [
        "Church Auntie",
        "Owner accepted the cooperative lease proposal with conditions: deposit by noon and monthly public hours.",
      ],
      [
        "Cornball",
        "We have the deposit, unless the Canadian quarter failed inspection.",
      ],
      [
        "Wifey",
        "We have the money, partner guarantees, repair reserve, and a governance agreement Blue did not crown himself inside.",
      ],
      [
        "Ganger Blue",
        "I am listed as setup coordinator, subject to removal by ordinary vote. It is humbling in twelve-point font.",
      ],
      [
        "Cracked Head",
        "I signed for maintenance shifts and no leadership seat this year.",
      ],
      [
        "Baby Momma",
        "Whole block clapping. Lovely. You still picking up Saturday?",
      ],
      ["Cracked Head", "Saturday, ten. Apples cut differently this time."],
      [
        "OG Uncle",
        "I signed the truth statement attached to the history exhibit. No heroic edit.",
      ],
      [
        "Techbro Rich",
        "My reservation may have expired, but my launch equipment remains until noon under the staging contract.",
      ],
      [
        "Ganger Red",
        "Then the final contests allocate teardown crews and closing exhibition slots. The lease stands on signatures and funds.",
      ],
    ],
    battles: [
      {
        id: "s2-teardown-dash",
        title: "Teardown Dash",
        opponent: "Delivery Demon",
        rounds: 4,
        rules: "reinforce",
        before: [
          [
            "Delivery Demon",
            "Winner directs loading. Loser carries the giant lowercase h.",
          ],
          [
            "Alley Runner",
            "Every crate scanned out. No equipment mysteriously becomes community property.",
          ],
          ["Cornball", "Can the inflatable R stay as a volunteer?"],
          ["Wifey", "Only if it pays dues."],
        ],
        after: [
          [
            "Delivery Demon",
            "Loading route set. RichRoof exits through the service stairs.",
          ],
          ["Cornball", "The h folded into a question mark. Appropriate."],
          ["Alley Runner", "Final crate logged. Roof is clear."],
        ],
      },
      {
        id: "s2-community-exhibition",
        title: "Community Exhibition",
        opponent: "Ganger Blue",
        rounds: 5,
        rules: "lock",
        before: [
          [
            "Ganger Blue",
            "This match selects the first rotating host. I am eligible and removable.",
          ],
          [
            "Wifey",
            "He practiced that sentence in the mirror until the mirror filed minutes.",
          ],
          [
            "Baby Momma",
            "Center lane closes while the childcare group crosses downstairs.",
          ],
          [
            "Ganger Blue",
            "Schedule bends around people now, not the other way around.",
          ],
        ],
        after: [
          [
            "Ganger Blue",
            "You host first. I set chairs and do not stack them into government.",
          ],
          ["Wifey", "Two chairs maximum per hand, Mr. Growth."],
          [
            "OG Uncle",
            "Let him carry four. Accountability can build forearms.",
          ],
        ],
      },
      {
        id: "s2-blockbuster-final",
        title: "The Blockbuster",
        opponent: "Techbro Rich",
        rounds: 6,
        rules: "phase",
        boss: true,
        before: [
          [
            "Techbro Rich",
            "One farewell exhibition. Winner gets premiere billing on the archive.",
          ],
          [
            "Ganger Red",
            "Billing only. The lease, history, and public access are settled elsewhere.",
          ],
          ["Techbro Rich", "Yes, counsel. I understand the nouns."],
          [
            "Snitch",
            "Full feed, source credits visible, comments temporarily locked for public safety.",
          ],
          [
            "Cornball",
            "I made popcorn in the fog machine. It tastes like batteries and ambition.",
          ],
        ],
        after: [
          [
            "Techbro Rich",
            "Use the title. Your cooperative outperformed my launch.",
          ],
          [
            "Baby Momma",
            "We paid the deposit while you were rehearsing your entrance. Check your phone.",
          ],
          [
            "Ganger Blue",
            "And because your inflatable letters had weak governance.",
          ],
          ["Wifey", "Let me enjoy this before you say governance again."],
        ],
      },
    ],
    closing: [
      [
        "Ganger Red",
        "Lease countersigned. Deposit received. Public-use schedule attached as an enforceable exhibit.",
      ],
      [
        "Church Auntie",
        "Keys go to three rotating stewards, not one loud pocket.",
      ],
      [
        "Ganger Blue",
        "I get Tuesdays for setup, supervised by Wifey and anybody with eyes.",
      ],
      ["Wifey", "Correct."],
      [
        "Cracked Head",
        "I get maintenance Saturdays after parenting time, unless Baby Momma changes our plan with me.",
      ],
      ["Baby Momma", "Ten means ten. Bring the little fork this time."],
      [
        "OG Uncle",
        "I get to sit here alive and watch both my sons carry tables without calling it a throne.",
      ],
      [
        "Cornball",
        "The museum milk crate gets permanent residency. It has contributed more than several adults.",
      ],
      ["Inmate Crafty", "My tiny chairs need a secure display."],
      ["Inmate Informant", "And a corrected glue credit."],
      [
        "Snitch",
        "Archive title: THE BLOCKBUSTER. Sources listed before my channel.",
      ],
      [
        "Alley Runner",
        "Partner venues keep their signed hours. Those three partner doors stay open. I am not making the next kid cross town for one working court.",
      ],
      [
        "Ganger Blue",
        "Player, you won the exhibition. The community won the boring paperwork.",
      ],
      ["Wifey", "We won a roof. You are still on mop duty."],
      [
        "Cornball",
        "Speaking of stupid: the old theater downstairs just mailed us a film reel with no return address.",
      ],
      ["Ganger Red", "Label says MISSING MOTION."],
      ["Snitch", "That sounds like a premiere."],
      ["Baby Momma", "It sounds like you ask permission before filming."],
      ["Snitch", "It sounds like a responsibly documented premiere."],
      [
        "Church Auntie",
        "Tomorrow. Tonight we eat under a roof the block can actually use.",
      ],
      [
        "OG Uncle",
        "Set my plate by the window. I plan to be here for the sequel.",
      ],
    ],
  },
];
