import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cardCatalog } from '../../../lib/squabblemon-engine/src/data.ts';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..');
const repoRoot = resolve(appRoot, '../..');
const outputPath = resolve(appRoot, 'reference/common-rare-pose-refresh.json');

const poses = [
  ['low-guard', 'Low defensive crouch with the prop shielding the torso.'],
  ['forward-vault', 'One hand low, torso driving forward, trailing leg lifted.'],
  ['turning-kick', 'Side-on pivot with a broad circular silhouette.'],
  ['over-shoulder', 'Torso turned away while the face and prop snap back to camera.'],
  ['grounded-lunge', 'One knee low with the opposite leg forming a strong diagonal.'],
  ['airborne-reach', 'Compressed jump with one limb reaching through the frame.'],
  ['side-step', 'Lateral dodge with clothing and accessories trailing behind.'],
  ['prop-swing', 'Character-specific prop drives a wide asymmetrical arc.'],
  ['calm-counter', 'Relaxed upper body over a braced counter-fighting stance.'],
  ['back-foot-lean', 'Weight shifted far back with the lead hand or prop foreshortened.'],
  ['kneeling-ready', 'Compact kneel with a clear triangular silhouette.'],
  ['mid-spin', 'Hips and shoulders rotate in opposite directions.'],
] as const;

// These already break the standing-template pattern through a strong prop,
// vehicle, creature, floor pose, or airborne silhouette. Preserve them.
const retainIds = new Set([
  'corner-busker', 'demario', 'luigion', 'alice', 'squabble-house-male',
  'yn-gokarter', 'squabble-house-manager', 'riptide-bruiser', 'monsoon-anchor',
  'wiretap', 'sprout', 'canopy-keeper', 'gust', 'slipstream', 'miami-surgeon',
  'roommate', 'mr-trick', 'teacher', 'tattoo-artist', 'og-skater',
  'live-streamer-male', 'bouncer',
]);

const cards = cardCatalog
  .filter((card) => (card.rarity === 'Common' || card.rarity === 'Rare') && card.kind === 'character')
  .map((card, index) => {
    const source = resolve(appRoot, `public/assets/characters/${card.id}.webp`);
    const [poseId, direction] = poses[index % poses.length];
    const target = resolve(repoRoot, `artifacts/deliverables/common-rare-pose-refresh/new/${card.id}-pose-02.webp`);
    const generated = existsSync(target) && statSync(target).size > 0;
    const digest = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
    const integrated = generated && digest(source) === digest(target);
    return {
      engineId: card.engineId,
      artworkId: card.id,
      name: card.name,
      rarity: card.rarity,
      faction: card.faction,
      source: source.slice(repoRoot.length + 1),
      sourceBytes: statSync(source).size,
      target: target.slice(repoRoot.length + 1),
      poseId,
      direction,
      status: integrated ? 'integrated' : generated ? 'generated' : retainIds.has(card.id) ? 'retained' : 'queued',
    };
  });

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify({
  schemaVersion: 1,
  rules: {
    preserve: ['identity', 'face', 'age', 'body type', 'wardrobe', 'props', 'palette', 'cel-shaded linework'],
    change: ['gesture', 'weight distribution', 'camera angle', 'limb rhythm', 'silhouette'],
    forbid: ['generic standing pose', 'new costume', 'new character', 'scenery', 'typography', 'UI', 'opaque background'],
  },
  totals: {
    all: cards.length,
    Common: cards.filter((card) => card.rarity === 'Common').length,
    Rare: cards.filter((card) => card.rarity === 'Rare').length,
  },
  cards,
}, null, 2)}\n`);

console.log(`Wrote ${cards.length} pose assignments to ${outputPath}`);
