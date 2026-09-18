# Scene — <title>

Node: <existing-node-id or explicitly proposed ID>. Status: draft / editorial complete / integrated. Canon: link to STORY_BIBLE.md.

## 1. Stage

Dramatic purpose: state what changes for the player or a character.

Location, time, entrances, props, and reaction shots. Keep stage directions outside spoken text. State whether the parallax ID exists or is proposed; neither state certifies layer art as delivered.

```yaml
parallaxSceneId: "<chapter:scene>"
venueId: "<verified venue or proposed venue>"
mood: "block"
durationMs: 6400
layers: [] # Fill proposed layer IDs, depths, motion factors, widths, and anchors.
cameraPath: [] # Fill establishing movement. Dialogue remains player-advanced.
```

## 2. Dialogue

Use a separate YAML block for each supported section. Battle sections: pre and post. Dialogue/reward section: main. The UI derives tokens from node ID, section, and index; the current engine line type has no token field. Preserve ordering deliberately when integrating saved progress.

```yaml
lines:
  - lineToken: "<node-id>:pre:0"
    speaker: "<display name>"
    portraitAssetId: "assets/characters/<verified asset>.webp"
    text: "<Spoken text only.>"
```

Write the victory consequences separately. If drafting defeat or phase cues, label them optional integration hooks; do not put them in the victory array. End with exit direction and the next dramatic question. All essential clues must occur on the required route.

## 3. Encounter or reward contract

For an existing node, incorporate its engine definition by reference and summarize relevant rules without creating a competing copy of its deck, prerequisites, or reward ledger. For a new node, write a complete proposed encounter specification and label implementation status accurately.

```yaml
nodeId: "<node-id>"
kind: "battle"
battleType: "standard"
mechanicsSource: "lib/squabblemon-engine/src/story.ts#<chapter>/<node>"
mechanicalChanges: none
```

List current rewards and any proposed changes separately. A character appearance is not a character unlock. One first perfect battle clear earns one ticket under the existing rule; explicit finale tickets are additional. Any legal win advances unless an implemented rule explicitly says otherwise.

## 4. Handoff

- Identify each setup, payoff, and continuity dependency.
- Verify speakers, portraits, and roster gaps.
- Mark proposed layers, audio hooks, and missing registry entries honestly.
- Preserve meaningful pre/victory gating and player-controlled reading pace.
- Check repeat play, optional-route order, and reward promises.
