# CHARACTER — `<character.id>`

> One file per roster character. Living in `scripts/story/character-bible/`.
> The engine reads `CHARACTER_ROSTER` for the runtime view; this file is
> the writer's view. Update both when the character changes.

---

## Identity

```yaml
id: ganger-blue                       # must match CHARACTER_ROSTER
name: Ganger Blue                     # display name
archetype: Blue Side lieutenant
crew: blue-side                       # block | blue-side | red-side | compound | function | city | side-show | old-heads | independent
role: rival                           # lead | rival | boss | support | cameo
portraitAssetId: assets/characters/ganger-blue.webp
unlockHint: "Survive the Blue Side pressure in Chapter One."
```

---

## One-line pitch

> Ganger Blue is the first test. He talks like a man who's been on the
> block for fifteen minutes longer than everyone else and uses that
> fifteen minutes as a weapon.

---

## Public persona

- **Age:** late 20s, but acts like 40.
- **Look:** blue-side windbreaker, gold chain, single AirPod in.
- **Voice cadence:** always one beat ahead of the other person, never
  finishes a sentence.
- **Catch phrase:** "Two districts. Don't make me say it twice."
- **Tell:** he taps the side of his face when he's about to escalate.

---

## Private truth

- He is **OG Uncle's youngest son**. Cracked Head is his older brother.
- He doesn't know his brother is alive — Cracked Head "died" in a
  witness-protection setup four years ago.
- His loyalty to the Blue Side is real, but he covers up the fact that
  he was the one who snitched to the feds about Cracked Head's last job.
  (This is why Snitch keeps showing up at his matches. Snitch knows.)

---

## Crew relationships

- **OG Uncle (father):** Tense, no contact in two years. Thinks the old
  man is washed up.
- **Cracked Head (brother):** Publicly dead. Privately the boss of the
  Red Side.
- **Ganger Red:** Best friend and worst enemy. They grew up on the
  same block.
- **Snitch:** Mutual blackmail; Snitch keeps Ganger Blue's secret in
  exchange for exclusive content.
- **Cornball:** Looks down on him as comic relief. ("Cornball is
  hilarious to me and everyone in earshot.")

---

## Arc through the season

| Chapter | Beat | Payoff |
| --- | --- | --- |
| 1 | Tests the new player; loses once, wins once. | First crack in the "unbeatable" persona. |
| 3 | Hears a rumor Cracked Head is alive. | Starts drinking more. |
| 5 | Confronts OG Uncle about Cracked Head. | Learns his father is dying. |
| 7 | Cracked Head shows up. | "You set me up." — first public showdown. |
| 9 | Sacrifices his chance at the Block Crown to save Cracked Head. | Heartbreak moment; the player has to choose. |
| 11 | Last chapter cameo. | Either a redemption shot or a betrayal. The writer picks. |

---

## Voice samples (use verbatim or vary)

- "You want the block? The block wants receipts. Bring receipts."
- "Two districts. Don't make me say it twice."
- "Snitch keeps his mouth shut because I keep his lights on."
- (Quietly, to himself) "He didn't die for you to lose in round three."

---

## Engine handoff

- `CHARACTER_ROSTER` row id: `ganger-blue`
- Portrait path: `assets/characters/ganger-blue.webp`
- Deck assignment (story rival): `blueDeck = ["cornball", "snow", "roaster", "rastamon", "wifey", "oink", "baby"]`
- Unlock trigger: `grantStoryTicketAward` in chapter 1 + `character-unlock` reward on
  `welcome-to-the-block` first-clear
