# 25-card reliability and payoff buffs

Implements the approved follow-up to the 51-card creative wave. All 25 candidates received the changes below. Costs, base Hands, rarity, ownership IDs, and upgrade IDs/effect amounts remain intact. This batch improves activation and payoff timing; it does not restore passive hand-bond scaling.

## Rules and important limits

- Coach stores failed/successful entrance outcomes in serialized card state. Presentation logs no longer control gameplay. Failed practice remains available until the original expiry; only one successful retry is allowed, and the existing safe-card whitelist remains.
- Cashier grants an immediate local discount. A qualifying final-round customer gets +2 Hands instead; After Party's actual round limit is respected.
- First Aid consumes its kit before applying up to 2 enemy damage, so it can prevent death. It does not heal or count prevented damage for damage rewards. Friendly damage, bonus-Hand trimming, and shields do not consume it; Janitor reversal takes priority. Enemy Burn is eligible.
- Watch rewards only the ward it supplied. Chair can react to either actual damage or a blocked hostile ability, with one shared once-per-match retaliation cap. Wifey's district guard cannot spend another card's revenge mark.
- Crossing ignores the target's movement Lock for one successful move, but preserves the Lock status and respects board capacity, story locks, detention, and other movement restrictions.
- Baby follows once after a successful family move; a full destination does not spend that follow. STUD protects the partner only when both members complete their escape.
- Trick assigns the next local friendly deployment before its entrance, then tracks actual damage or newly applied harmful status from that guest. Blocked or appealed status does not pay until it actually lands. Round-end settlement pays earned Tips once.
- Stoner's cleanse opens one smaller second pass to a different arrival. Busker accepts distinct visitors toward a payout, with at most one payout per round. Kingpin pays +1 per new carrier and +1 each on completion, preserving the total +6 ceiling.
- Torta includes herself in the pair and still requires the pair to remain and hold the district. Concrete pays either the blocked-move reward or the smaller expiry fallback. ATL similarly pays theft or fallback, never both.
- Mayor's key protects the next different friendly arrival in the nominated district. Lawyer's fees require a pending status to actually be dismissed; Foodz can now dismiss that pending status as well.
- New persistent support contracts use the existing once-per-instance creative training rules and do not rearm through echoed entrances. Nerd retains its existing upgrade behavior and shield/guard targeting rules; its added reward is information.
- Online rules and card-balance versions are 10. The stale story test now expects the already-authored story version 9; no story content changed.

## Final card text

### 1. Night Cashier — Closing Time

`nightcashier` · 2 Motion / 2 Hands

On Reveal: On round 4 or later, issue a Receipt here through next round. Your next other character costing 2 or less played here earns an immediate one-use local 1-Motion character discount, minimum 1. In the final round, that customer gains +2 Hands instead.

### 2. Mr. Trick — Open Tab

`mr-trick` · 3 Motion / 3 Hands

On Reveal: Open a Tab through next round. The next other friendly character played here becomes your guest. Its first successful enemy hit or new harmful status earns a Tip; cash it at round end for +2 Hands to the guest. One Tab per side.

### 3. Stoner Sr. — Pass It Around

`stonersr` · 3 Motion / 2 Hands

On Reveal: Cleanse your weakest afflicted ally here and leave a token through next round. Your next other character arriving here gains +2 Hands. If you cleansed an ally, pass a smaller +1 token once to a different arrival.

### 4. Midnight Mayor — Keys to the City

`midnightmayor` · 3 Motion / 2 Hands

On Reveal: Nominate your weakest other district through next round. The next friendly move there opens a one-use local 1-Motion character discount, minimum 1, and leaves a key: the next different friendly arrival there gets Protection. One nomination per side.

### 5. Corner Busker — Pass the Hat

`busker` · 2 Motion / 1 Hands

Ongoing: Two different other allies moving here earn two Tips for +3 Hands to your weakest other ally here. At most one payout per round; the same character cannot tip twice toward one payout.

### 6. Failed Athlete — One Last Shot

`failedathlete` · 3 Motion / 2 Hands

Ongoing: Once per match, gain +4 Hands and Protection when this district changes from tied or winning to losing. If deployed while losing, a later enemy arrival here while still losing can also trigger the comeback.

### 7. ATL Scammer — Pending Transfer

`atl-scammer` · 3 Motion / 2 Hands

On Reveal: File a claim through next round. Divert up to 1 Motion from the next enemy refund. If unused, at expiry open a one-use local 1-Motion character discount here through next round, minimum 1. Theft or fallback, never both.

### 8. Corner Coach — Run It Back

`cornercoach` · 3 Motion / 3 Hands

On Reveal: Coach your weakest eligible ally here through next round. After its entrance fails, later other friendly character placements retry it until one succeeds. At most one successful retry; copying, summoning, refunds, choices and reworked entrances are excluded.

### 9. Barber Bro — Line Up

`barber` · 4 Motion / 4 Hands

On Reveal: Trim up to 2 bonus Hands from the enemy here with the most bonus Hands. Give the amount actually trimmed to your weakest other ally here. If no enemy has bonus Hands, give that ally +1 Hand.

### 10. Tattoo Artist — Permanent Ink

`tattoo-artist` · 3 Motion / 2 Hands

On Reveal: Tattoo your weakest uninked other ally here and give it +1 Hand. Its next successful move grants Protection and +1 Hand. Each character can receive this tattoo only once per match.

### 11. Juneteenth Chair Guy — Fold-Out Justice

`juneteenth-chair-guy` · 5 Motion / 5 Hands

Ongoing: Once per match, after an enemy damages another ally here or its Protection blocks an enemy ability, hit the attacker for 3 and give your weakest surviving other ally here Protection.

### 12. Lawyer — Objection

`lawyer` · 3 Motion / 2 Hands

On Reveal: Cleanse your weakest other ally here and give it an Appeal through next round. Its next harmful status waits until round end; moving or cleansing the client dismisses it and earns one local 1-Motion character discount at the client, minimum 1.

### 13. First Aid Kit — Emergency Kit

`firstaid` · 2 Motion / 0 Hands

On Reveal: Cleanse your weakest afflicted character here, or your weakest character if none is afflicted. Store one emergency kit: prevent up to 2 Hands of its next enemy damage before lethal resolution. One kit per target.

### 14. Hair Stylist — Blowout

`hair-stylist` · 2 Motion / 2 Hands

On Reveal: Cleanse your weakest other ally here and give it +1 Hand. If cleansed, its next successful move grants another +1 Hand, once.

### 15. Crossing Guard — Safe Crossing

`crossingguard` · 2 Motion / 2 Hands

On Reveal: Protect your weakest unprotected other ally here. Give it one Safe Crossing: its next successful move ignores movement Lock. Capacity and district restrictions still apply.

### 16. Bust-Down Watch — Wrist Check

`bustdown` · 1 Motion / 0 Hands

On Reveal: Protect your weakest friendly character here. If this ward blocks a hostile ability, its wearer gains +2 Hands once. Other shields do not cash this watch.

### 17. Boombox — Turn It Up

`boombox` · 2 Motion / 0 Hands

On Reveal: Give every friendly character here +1 Hand. Leave one Encore through next round: the next friendly movement arrival here gains +1 Hand.

### 18. Torta — Hold Our Ground

`torta` · 2 Motion / 2 Hands

On Reveal: Pair yourself with your weakest other Earth ally here. At next round end, if both remain here and you are not losing this district, each gains +2 Hands. One pair per side.

### 19. Concrete — Set in Stone

`concrete` · 1 Motion / 1 Hands

On Reveal: Anchor your weakest other Earth ally here through next round. Its next hostile forced move is blocked and it gains +2 Hands. If unused at expiry, it gains +1 Hand instead. One anchor per ally.

### 20. Abuela — Eat Something

`abuela` · 4 Motion / 4 Hands

On Reveal: Restore up to 3 Hands actually lost to damage to your weakest injured ally anywhere and Protect it. If nobody is injured, Protect your weakest other ally here and pack one lunch: heal up to 2 Hands of its first later enemy damage if it survives.

### 21. STUD — Hold You Down

`stud` · 3 Motion / 3 Hands

On Reveal: Bond to your weakest other ally here. Once per match while together, intercept its next targeted hostile ability, then move the surviving pair to your weakest other district with two spaces. Protect your partner if both escape.

### 22. Inmate Kingpin — Run the Yard

`inmate-kingpin` · 5 Motion / 5 Hands

On Reveal: Give Contraband and +1 Hand to your weakest other Inmate anywhere. Later Inmate deployments or moves pass it on; each of the first three distinct carriers gains +1 Hand. After three carriers, each survivor gains another +1. Once per Kingpin per match.

### 23. Nigerian Father — High Expectations

`nigerian-father` · 4 Motion / 4 Hands

On Reveal: Tutor your weakest other ally here with 3 or fewer Hands for +1 Hand. If it gains another net +2 Hands by the end of next round, it gains Protection and +2 Hands. One goal per side.

### 24. Closet Nerd — Unaware

`nerd` · 4 Motion / 3 Hands

On Reveal: Silence the highest-Hands enemy here, bypassing Wifey's Side Eye. Protection still blocks this. If you newly Silence an active Ongoing ability, reveal one enemy hand card.

### 25. Baby Momma — Mama Bear

`baby` · 4 Motion / 5 Hands

On Reveal: Name your weakest other ally here as family. Once, follow its successful move if there is room. Once per match when an enemy damages it, hit the attacker for 2; if family was destroyed, also gain +2 Hands.

## Verification and balance

The targeted regression suite covers both owners, log-free Coach retries, final-round and extended-round Cashier, blocked and deferred Trick statuses, partial-progress rewards, once-only reactions, incoming damage versus trimming/friendly damage, movement capacity, and shield attribution. Online authority checks cover the full creative registry plus Nerd at tiers 0–3 for both owners.

See [the balance report](../scripts/results/buff25/README.md) for the paired deterministic results and their limits. These remain fixed-deck bot samples, not live win rates. Changes are not represented as a blanket improvement for every old list.

The follow-up [review of another 25 cards](NEXT_25_AFTER_BUFFS.md) identifies six candidates for targeted testing, eight to watch, and eleven to hold. It does not apply another buff wave.
