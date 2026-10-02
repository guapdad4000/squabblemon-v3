# Season One screenplay import notes

`READTHROUGH.md` is the canonical dialogue source. The delivered standalone
chapter-by-chapter export was compared with the dialogue document in the
handoff archive before import. Both normalize to the same ordered 113 sections
and 2,765 exact speaker/text tuples across the existing 62 node IDs. The
compiler output contains the same sections and tuples; export fences and
per-section line-count annotations are intentionally not screenplay content.

## Editorial notes retained where compatible

- Keep Blue's repeated pattern of excluding Cracked Head, confessing, then
  repeating the harm in view when reviewing later seasons.
- Preserve the delivered long turns, interruptions, stage directions, and
  register. Do not add slang as decoration or trim lines to reconcile older
  cut positions.
- Let comedy surround serious scenes rather than interrupting confessions;
  preserve the recurring props and payoffs described in the handoff where the
  delivered screenplay actually plants and pays them off.
- Keep the existing PRE/POST boundaries from the delivered export. The engine
  presents only one section per node visit, so do not move a post-match reveal
  into PRE based on the handoff's obsolete line-number cut table.
- Retain the delivered ending and its Player lines. Do not invent an epilogue
  or add `crown-0730`, which has no section in either copy of the export.

## Conflicts with handoff summaries

- The measured screenplay has **330 Player lines and 9 Rae lines**, not 314
  and 7.
- The delivered final community-meal scene includes Player dialogue, although
  the guidance says the Player is absent from the ending. Preserve the delivered
  tuples; this is an editorial question, not an import correction.
- The handoff's proposed `crown-0730` scene is absent from the supplied script.
  It remains unwired and must not be fabricated from notes.
- Older line-count annotations and cut offsets describe a different draft.
  The canonical file contains no copied line counts; its authored section
  boundaries are the authority.

## Import verification

- 62 current node IDs; no `crown-0730`.
- 113 non-empty PRE/POST/main sections.
- 2,765 non-empty speaker/text tuples; longest spoken tuple is 196 characters.
- Bundled archive and standalone export were compared before implementation:
  exact match in section order, speaker, and text. The original temporary log
  was lost in a workspace restart; the measured result remains recorded here.
- The baseline `test:story:seasons` run was captured before these changes:
  all 27 tests passed with 0 failures. Its temporary output was also lost in the
  restart. Current verification and screenshots are recorded in `VERIFICATION.md`
  and the adjacent `evidence/` directory.