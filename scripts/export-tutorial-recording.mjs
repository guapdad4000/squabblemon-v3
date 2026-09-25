import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const recordings = JSON.parse(await readFile(new URL('artifacts/squabblemon/src/lib/tutorialVoiceClips.json', root), 'utf8'));
const tour = JSON.parse(await readFile(new URL('artifacts/squabblemon/src/lib/safehouseTour.json', root), 'utf8'));
const clip = id => { const found = recordings.find(item => item.id === id); if (!found) throw new Error(`Missing cue ${id}`); return { id, text: found.text }; };
const sequence = [
  ...['welcome', 'welcome-reassurance'].map(clip),
  ...tour.map(step => ({ id: step.id, text: step.body })),
  ...['legendary-catchphrase', 'legendary-explanation', 'legendary-squabble', 'deck-1', 'deck-2', 'deck-3',
    'r1_choose_card', 'r1_choose_district', 'r1_play_card', 'r1_end_turn', 'r2_choose_card', 'r2_choose_district', 'r2_play_card', 'r2_end_turn',
    'r3_bank_motion', 'r4_choose_card', 'r4_arm_squabble', 'r4_choose_district', 'r4_play_squabble', 'r4_end_turn',
    'result-default', 'lesson-complete', 'lesson-complete-encouragement'].map(clip),
];
// Raw export is intentionally narration only, with repeated cues in playback order.
await writeFile(new URL('artifacts/deliverables/dr-fade-tutorial-v2-raw.txt', root), sequence.map(cue => cue.text).join('\n\n') + '\n');
await writeFile(new URL('artifacts/squabblemon/reference/dr-fade-tutorial-v2-cues.json', root), JSON.stringify(sequence.map((cue, index) => ({ order: index + 1, ...cue, existingRecording: recordings.find(item => item.text === cue.text)?.id ?? null })), null, 2) + '\n');
console.log(`Exported ${sequence.length} ordered narration paragraphs; ${sequence.filter(cue => !recordings.some(item => item.text === cue.text)).length} need new recordings.`);
