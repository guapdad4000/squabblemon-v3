# Squabblemon human balance playtest

**Gate status: PENDING.** No human findings are recorded until real sessions are completed. The deterministic lab identifies candidates for observation; it does not replace players.

The current redacted automated aggregate is recorded in [BALANCE_BASELINE.md](./BALANCE_BASELINE.md). Raw JSON and human row-level notes remain in ignored or access-controlled storage.

## Minimum sessions

| Session | Minimum sample | Build and account | Target time |
| --- | ---: | --- | ---: |
| New-account Chapters 1–2 | 8 players, at least 6 unfamiliar with the game | Production-like build, fresh account and empty progression | 45–60 min |
| Full campaign | 6 players who completed the first session | Fresh account against the production-like database; split across two sittings if needed | 90–150 min total |

Use anonymized participant IDs. Do not teach a mechanic unless the player is blocked for two minutes; record that intervention as facilitator help. Ask players to think aloud, while avoiding leading questions.

## Session procedure

### New-account Chapters 1–2

1. Start from signup and record any account, save, or load failure.
2. Let the player complete Chapters 1–2 in the intended order.
3. For every taught mechanic, record the first unaided correct use, incorrect attempts, hint use, and facilitator help.
4. For every battle, record first-attempt outcome, retries, duration, rounds, deck, cards played, crash or soft lock, and whether the objective was understood before the final round.
5. After each major fight, ask the four questions below before discussing the design.

### Full campaign

1. Use a separate fresh account and the production-like database configuration.
2. Record every encounter, optional route taken, reward claimed, deck change, retry, resume, and persistence failure.
3. After every third battle, ask for a 1–5 repetition rating and which encounter felt most distinct.
4. At each chapter boundary, verify saved progression by signing out, signing back in, and resuming.
5. End with the same four questions plus the three campaign questions below.

## Questions

After a chapter or major fight:

1. What did the game just teach or ask you to do?
2. What caused your win or loss?
3. What changed after the fight, and which reward mattered?
4. What was confusing, slow, or repetitive?

After the campaign:

1. Which three battles felt most different from one another, and why?
2. Which card, combo, or enemy plan felt unfair?
3. Where would you stop playing or skip dialogue?

## Metrics and decision gates

| Area | Measure | Pass gate |
| --- | --- | --- |
| Onboarding | Chapter 1–2 completion without facilitator help | At least 80% |
| Teaching | Players correctly use and explain each taught mechanic | At least 75% per mechanic |
| Reliability | Crash or soft lock | 0 release blockers; at least 99% crash-free encounters |
| Campaign persistence | Resume restores chapter, rewards, deck, and progression | 100% of tested resumes |
| Battle difficulty | First-attempt win rate per standard encounter | 40–80%; bosses reviewed separately |
| Retry pressure | Median retries on required encounters | At most 1; no required encounter above 3 for more than one player |
| Variety | Repetition rating, where 1 is repetitive and 5 is distinct | Median at least 4 after Chapter 2 |
| Reactions | Player can name the consequence or reward after a major fight | At least 80% |
| Balance | A card-swap delta after the full automated run | Review above 5 percentage points; block above 8 |

## Interpreting automated flags

The deterministic lab uses a transparent one-ply greedy policy. Treat its flags as candidates for investigation, not direct release decisions.

- A paired card swap measures one replacement in one authored shell against controlled opponents. It does not estimate a card's universal win rate.
- The player/CPU seat split includes turn-order and reveal behavior. Use the mirrored logical-deck result for card comparisons, and investigate the seat flag separately.
- Do not change a card from one policy signal alone. Corroborate it with a second deterministic policy or fixture, direct effect math, and the human sessions above.
- If an alternate policy reverses the sign or materially changes the rank of a swap, record it as model-sensitive and test the actual play pattern with players.
- Automated blockers remain open until the underlying case is explained, fixed, or accepted with evidence. They do not change the human gate from `PENDING` to `PASS`.
## Severity rubric

| Severity | Meaning | Action |
| --- | --- | --- |
| P0 | Data loss, account corruption, security issue, or campaign cannot continue | Stop the session and block release |
| P1 | Repeatable crash, soft lock, required encounter cannot be completed, or core mechanic is misunderstood by most players | Fix before the next external build |
| P2 | Material balance, pacing, clarity, dialogue, or reward problem with a workaround | Schedule in the current polish pass |
| P3 | Cosmetic issue or isolated preference with no gameplay impact | Backlog with evidence |

## Per-session result template

```text
Session ID:
Participant ID:
Session type: Chapters 1–2 / Full campaign
Build commit:
Database environment:
Start/end time:
Completed: yes / no
Facilitator help count:
Crashes / soft locks:
Required battle first-attempt wins / total:
Total retries:
Mechanics used and explained correctly:
Mechanics missed:
Median repetition rating:
Major rewards recalled:
P0/P1/P2/P3 findings:
Most distinct battle and why:
Unfair card/combo/enemy and why:
Stopping or dialogue-skip point:
Notes:
```

## Aggregate result template

```text
Gate status: PENDING / PASS / FAIL
Build commit:
Session dates:
Chapters 1–2 participants / completed unaided:
Full-campaign participants / completed:
Crash-free encounters / total encounters:
Successful resume checks / total checks:
Mechanic comprehension by mechanic:
First-attempt win rate by encounter:
Median retries by encounter:
Median repetition rating by chapter:
Reward recall rate by major fight:
Severity counts: P0 / P1 / P2 / P3
Automated report fingerprint:
Automated blockers requiring human confirmation:
Decision and owner:
```

## Exporting results

1. Keep row-level notes in an access-controlled sheet with one row per participant and encounter. Use anonymized IDs and the metric names above.
2. Export the sheet as CSV into `tmp/balance-lab/`; this directory is ignored by Git.
3. Copy only aggregate counts, rates, medians, and severity totals into the aggregate template. Omit names, email addresses, free-form personal information, and raw quotes.
4. Run `pnpm balance:full` and record the generated fingerprint from `tmp/balance-lab/full.json` beside the human aggregate.
5. Save the completed aggregate as `tmp/balance-lab/playtest-summary-YYYY-MM-DD.md` for review. Commit a redacted aggregate only when the team wants a durable benchmark.

Do not mark the human gate passed from automated matches, internal QA alone, or an incomplete sample.
