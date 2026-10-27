# Kumite final media pass — October 27, 2026

Local release candidate; not a deployment claim.

All nine approved anime treatments are baked into the eight `story-v2` chapter cuts in both orientations. K04 (the first Glo counter) and U03 (the phone showcase) complete the previous seven. The 0.4–0.6 second held drawings and the live K06 pressure accent retain their approved entry/contact/return clocks. No runtime is inserted. A separate 136-frame solo Dragonfly reaction repair covers the invented-glasses shot at chapter 02 86.000–90.533s. Six distinct generated belt-contact and recoil drawings replace the three print-treated holds, two drawings per belt hit. The approved anticipation, natural dazed release, belt Foley, and overall scene timing stay intact; the earlier approved K01 belt-at-waist sequence remains unchanged.

| Delivery | Bytes |
| --- | ---: |
| Full chapters and sixteen unchanged posters | 596,882,757 |
| Original 131 approved art files | 20,495,790 |
| 32 small responsive portrait variants | 2,340,444 |
| Total new media | 619,718,991 |

Compared with the previous 724,718,070-byte media package, this saves 104,999,079 bytes (14.49%) while including both missing inserts, responsive variants, six new belt-contact drawings and the approved 45-cue Roger mix. Each movie is below 100 MB; the largest is 94,735,211 bytes.

## Encoding and verification

Landscape retains 1920×1080, portrait retains 720×1280 with the whole original picture, and both stay at 30 fps. H.264 slow/animation CRF 21 uses a 4 Mbps landscape ceiling and 1.5 Mbps portrait ceiling. The five-minute chapter retains a 2.35 Mbps landscape bound. Faststart remains enabled. The user-approved Roger recording now replaces 45 host cues in chapters 01–05 and 08. These six new AAC stereo 160k tracks are copied identically into landscape and portrait; previous AAC packet-identity claims do not apply to them. Chapters 06/07 retain their previous files/audio. Existing fighter dialogue, party passage and added belt snaps are preserved in the decoded mix before the new AAC encode; audio outside affected regions is not globally remastered. No new music or combat sound was generated. See `kumite-announcer-20261027.md` for timing, separation and preservation limits.

All twelve movies with replaced audio were decoded completely and checked for exact unchanged video frame counts, duration, dimensions, stereo audio and hashes; their compressed picture payloads are identical to the previous approved versions. The other four movies remain hash-identical. Each of the nine treatments was compared at entry, held/live frames and source return against its approved render; both orientations were sampled. This is a lossy delivery encode, not a claim of pixel identity with the full-resolution master. The 6.86 GB LaCie master is untouched and not shipped.

The original artwork files are hash-identical. Width-based image candidates let small cards use a 320px portrait, while larger/high-density inspections retain the original. The 32 small variants total 75.13% fewer bytes than their corresponding 9,408,946-byte original set. Actual transfer depends on rendered size, pixel density and cache state. Missing responsive files fall back to the original artwork.

## Public asset audit

The complete public directory has 20 exact duplicate groups, totaling 3,766,659 potentially redundant bytes, mainly legacy portrait aliases and installation icons. There are no duplicate new chapter movies or raw video/project masters in public. Existing paths remain for manifest, dynamic-catalog and saved-client compatibility; they were not deleted on a filename-only guess.

## Local review

- `/e2e/kumite-impact-review.fixture.html` plays the actual final chapter files with entry/held/return and portrait controls for all nine treatments plus the solo reaction repair; it opens directly on that repair.
- `/e2e/kumite-story-audit.fixture.html` exercises the real Story route and player.
- Delivery hashes, cue clocks and audio receipts: `kumite-story-cinema-20261027.json`.
- Responsive artwork provenance: `kumite-responsive-art-20261027.json`.

Evidence and source-preserving encode/validation commands are retained in the task's `output/kumite-expansion-20261027-audit/impact-final-optimization/` folder. Source/frame counters, not old survey timestamps, own the edit.

## Solo reaction repair verification

The chapter remains 3073 frames / 102.433333 seconds. The revised 136-frame scene uses six generated belt-contact and recoil drawings, with two drawings staggered through each of the three approved hit windows. During that earlier solo-repair pass, both chapter 02 movies fully decoded and the other 14 movies plus all 16 posters remained hash-identical. The current Roger pass changes 12 audio tracks while retaining every picture payload. The current Roger AAC payload is identical between both orientations; the previous solo-repair belt Foley is preserved before the new AAC encode. The previous repaired AAC bitstream is retained as historical evidence, not reused in this announcer revision. The full-resolution master remains untouched. New art, editable source, snapshots and conform receipts are retained in `output/kumite-expansion-20261027-audit/belt-six-impacts/`; the original audio/sample audit remains in `output/kumite-expansion-20261027-audit/belt-comedy-repair/`. Generated source plates and the large local intermediate are not shipped separately.

## Approved consistent announcer

All 45 Roger cues are installed in both orientations for chapters 01–05/08. Introductions play at 1×; dense ending blocks use pitch-preserving 1.12×/1.08× tempo. ANN08 plays whole in chapter 05, with the old boundary-crossing host removed from both04/05. ANN22/ANN43 move earlier by 3.917s/2.028s; the approved picture runtime is unchanged. The user approved the audition. Generic source separation can affect overlapping voices or tonal effects inside host masks, and burned-in source captions retain previous errors. Protected/outside-region PCM checks apply before lossy AAC encoding, not after. Full per-cue/media evidence is in `kumite-announcer-20261027.json`.
