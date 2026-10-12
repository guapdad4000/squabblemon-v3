# Elemental balance — retained v60 patch

## Kept changes

- **Matcha Freak:** low-Motion support now reaches any district. Cleanse an afflicted ally and give +3 Hands; otherwise give the weakest other Plant ally +3, or gain +2 if there is no other Plant ally. High-Motion self +2 is unchanged.
- **Performative Male:** initial help is +2 for a Plant target (otherwise +1). The fulfilled promise gives a Plant target +3 (otherwise +2). Existing two-round expiry and one-use limit remain.
- **Baby Crying on an Airplane:** a successfully moved ally gains +2 instead of +1. Blocked moves give nothing.
- **Airheaded Model:** 4 → 3 Motion, still 2 printed Hands. A successful move gives the Model +1 and the weakest ally left behind +2 (+3 if Air), with Protection.

No printed Hands increases. Earlier v59 Music and Ashlee/Gus changes remain. All tested Dark changes were reverted.

## Paired results

Each cell contains 96 bot matches: six opponents, four training tiers, both seats and two policies. Draws count as half a win. A/B informed tuning; C is a separate opponent/draw check, subsequently reused to reject Dark candidates and verify the retained patch. These are diagnostic simulation scores, not current full-league rankings or live player win rates.

| Deck | Set A | Set B | Set C: strong-deck check | Equal-weight average |
|---|---|---|---|---|
| Plant | 54.7% → 60.4% | 66.1% → 79.2% | 40.1% → 55.2% | 53.6% → 64.9% |
| Air | 24.0% → 34.9% | 20.8% → 13.5% | 57.8% → 69.8% | 34.2% → 39.4% |

Plant improved across all three sets. Air improved in A and C but regressed in B; its aggregate gain does not mean every matchup improved. Dark cost cuts improved A/B but hurt C badly; the effect-only alternative averaged less than one percentage point improvement. Neither Dark candidate was retained.

## All nine elemental decks screened

These baseline scores use different opponent/draw sets. Water and Fire self-matches occur in set A, so this is not a comparable league table. High variation is a reason to avoid blanket buffs. Existing broader league evidence also did not identify Water as broadly weak.

| Element | A | B |
|---|---:|---:|
| Light | 62.0% | 52.1% |
| Water | 63.0% | 19.8% |
| Plant | 54.7% | 66.1% |
| Electric | 57.8% | 42.2% |
| Dark | 28.1% | 35.9% |
| Earth | 55.2% | 34.4% |
| Fire | 54.2% | 87.0% |
| Air | 24.0% | 20.8% |
| Poison | 51.6% | 50.0% |

## Final shared-card checks (C)

| Deck | Before | Retained patch |
|---|---:|---:|
| Dark | 53.6% | 53.6% |
| Mushroom Garden | 39.1% | 42.7% |
| Wave 7 Tempo | 60.9% | 60.9% |
| Counterplay — Dark Control | 40.6% | 40.6% |

## Matchup details — retained Plant and Air

### Plant — set A

- RECEIPTS: 87.5% → 84.4% (16 paired matches).
- Water: 59.4% → 65.6% (16 paired matches).
- Fire: 62.5% → 65.6% (16 paired matches).
- NO EQUIPMENT NEEDED: 50.0% → 50.0% (16 paired matches).
- Earth Tax and Finishers: 21.9% → 31.2% (16 paired matches).
- WHO YOU KNOW: 46.9% → 65.6% (16 paired matches).

### Plant — set B

- Blood / Red Set: 78.1% → 84.4% (16 paired matches).
- Crip / Blue Set: 68.8% → 81.2% (16 paired matches).
- Cellblock Pressure: 50.0% → 81.2% (16 paired matches).
- RECEIPTS: 59.4% → 71.9% (16 paired matches).
- TOUR MONEY: 59.4% → 62.5% (16 paired matches).
- NO EQUIPMENT NEEDED: 81.2% → 93.8% (16 paired matches).

### Plant — set C

- Blood / Red Set: 15.6% → 50.0% (16 paired matches).
- Crip / Blue Set: 71.9% → 78.1% (16 paired matches).
- Electric: 68.8% → 81.2% (16 paired matches).
- WHO YOU KNOW: 34.4% → 50.0% (16 paired matches).
- SQUABBLEHOUSE SHIFT: 37.5% → 40.6% (16 paired matches).
- Cellblock Pressure: 12.5% → 31.2% (16 paired matches).

### Air — set A

- RECEIPTS: 37.5% → 68.8% (16 paired matches).
- Water: 9.4% → 18.8% (16 paired matches).
- Fire: 62.5% → 68.8% (16 paired matches).
- NO EQUIPMENT NEEDED: 15.6% → 3.1% (16 paired matches).
- Earth Tax and Finishers: 6.2% → 21.9% (16 paired matches).
- WHO YOU KNOW: 12.5% → 28.1% (16 paired matches).

### Air — set B

- Blood / Red Set: 53.1% → 25.0% (16 paired matches).
- Crip / Blue Set: 3.1% → 9.4% (16 paired matches).
- Cellblock Pressure: 18.8% → 6.2% (16 paired matches).
- RECEIPTS: 21.9% → 25.0% (16 paired matches).
- TOUR MONEY: 9.4% → 3.1% (16 paired matches).
- NO EQUIPMENT NEEDED: 18.8% → 12.5% (16 paired matches).

### Air — set C

- Blood / Red Set: 50.0% → 62.5% (16 paired matches).
- Crip / Blue Set: 50.0% → 68.8% (16 paired matches).
- Electric: 68.8% → 81.2% (16 paired matches).
- WHO YOU KNOW: 75.0% → 81.2% (16 paired matches).
- SQUABBLEHOUSE SHIFT: 68.8% → 68.8% (16 paired matches).
- Cellblock Pressure: 34.4% → 56.2% (16 paired matches).

## Scope and evidence

Source snapshots and the retained diff are included. Intermediate JSON files are rejected experiments unless named in the table above. Changes are local; nothing was committed or pushed. See VALIDATION.md for test results.
