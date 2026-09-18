import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { cardCatalog, cards } from './data';
import { getMoveClipUrl, gateSpecialMoveReplay, getMovePlayKey, keyChromaPixels, markSpecialMovePlayed, planSpecialMoveBeat, moveAssignments, moveClips, resolveSpecialMove, specialMoveForEvent } from './specialMoves';

test('media URLs carry a revision matching the actual bytes, so replacements bypass cached videos', () => {
  for (const clip of Object.values(moveClips)) {
    const bytes = readFileSync(new URL(`../public/assets/special-moves/${clip.file}`, import.meta.url));
    assert.equal(clip.revision, createHash('sha256').update(bytes).digest('hex').slice(0, 16));
    assert.ok(getMoveClipUrl(clip).endsWith(`?v=${clip.revision}`));
  }
});

test('creator Mythicals use their delivered finishers with full playback and unchanged game identities', () => {
  for (const [id, clipId, name, move] of [['simmy', 'char93', 'Simmy', 'Heartbreak'], ['foodz', 'char92', 'Foodz', "What's Crackin'!"]]) {
    const clip = resolveSpecialMove(id)!;
    assert.equal(clip.id, clipId);
    assert.equal(clip.label, name);
    assert.equal(clip.move, move);
    assert.equal(cards[id].ability, move);
    assert.equal(cardCatalog.find(card => card.engineId === id)?.rarity, 'Mythical');
    assert.equal(clip.startSeconds, 0);
    assert.equal(clip.playbackRate, 1);
    assert.equal(clip.durationMs, 6500);
    assert.equal(specialMoveForEvent({ type: 'ability', kind: 'ability', cardId: id })?.id, clipId);
    assert.equal(resolveSpecialMove(id, { [id]: null }), null);
  }
});

test('every roster card has a valid clip assignment or explicit fallback; all imported clips exist', () => {
  assert.deepEqual(Object.keys(moveAssignments).sort(), Object.keys(cards).sort());
  for (const id of Object.keys(cards)) {
    const assignment = moveAssignments[id];
    assert.ok(assignment === null || moveClips[assignment]);
    assert.deepEqual(resolveSpecialMove(id), resolveSpecialMove(cards[id]));
  }
  for (const clip of Object.values(moveClips)) {
    assert.ok(existsSync(new URL(`../public/assets/special-moves/${clip.file}`, import.meta.url)));
    assert.ok(clip.durationMs > 0 && clip.durationMs <= 7000);
    assert.ok(clip.playbackRate > 0 && clip.startSeconds >= 0);
  }
});

test('H3 refresh cards select their dedicated clips and the legendary reveal has a full normal-speed window', () => {
  for (const [card, clip] of Object.entries({ bossbabe: 'char16', roaster: 'char47', nerd: 'char48', plug: 'char49', streamer: 'char50', youngbull: 'char51', transplant: 'char52', tayaty: 'char53', edgar: 'char54' })) {
    assert.equal(resolveSpecialMove(card)?.id, clip);
  }
  const legendary = resolveSpecialMove('og')!;
  assert.equal(legendary.id, 'char45');
  assert.equal(legendary.startSeconds, 0);
  assert.equal(legendary.playbackRate, 1);
  assert.equal(legendary.durationMs, 6500);
});

test('Rastamon and Snow Bunny use the clips depicting their actual characters', () => {
  assert.equal(resolveSpecialMove('rastamon')?.id, 'char11');
  assert.equal(resolveSpecialMove('snow-bunny')?.id, 'char10');
});

test('replacement, disabled selection, missing cards and blocked events use safe resolution', () => {
  assert.equal(resolveSpecialMove('barber', { barber: 'char08' })?.id, 'char08');
  assert.equal(resolveSpecialMove('barber', { barber: null }), null);
  assert.equal(resolveSpecialMove('barber', { barber: 'missing' }), null);
  assert.equal(resolveSpecialMove('future-card'), null);
  assert.equal(specialMoveForEvent({ type: 'play', kind: 'ability', cardId: 'barber' }), null);
  assert.equal(specialMoveForEvent({ type: 'ability', kind: 'blocked', cardId: 'barber' }), null);
  assert.equal(specialMoveForEvent({ type: 'ability', kind: 'ability', cardId: 'barber' })?.id, 'char37');
});

test('Wave 3 fills its nine card gaps and resolves the correct ability video', () => {
  const wave = { nguyen: 'char55', manman: 'char56', pinaynurse: 'char57', honestthot: 'char58', earthy: 'char59', abuela: 'char60', icecream: 'char61', scammer: 'char62', vibe: 'char63' };
  for (const [id, clipId] of Object.entries(wave)) {
    const clip = resolveSpecialMove(id);
    assert.equal(clip?.id, clipId);
    assert.equal(clip?.move, cards[id].ability);
    assert.equal(specialMoveForEvent({ type: 'ability', kind: 'ability', cardId: id })?.id, clipId);
    assert.equal(resolveSpecialMove(cards[id].id)?.id, clipId);
    assert.equal(resolveSpecialMove(id, { [id]: null }), null, 'manual disable remains available');
  }
});

test('Wave 4 covers the seven Super Commons while preserving printed moves, rarity and manual overrides', () => {
  const wave = { shiesty: 'char64', torta: 'char65', waterboy: 'char66', buspass: 'char67', cognac: 'char68', bustdown: 'char69', soulfood: 'char70' };
  for (const [id, clipId] of Object.entries(wave)) {
    const clip = resolveSpecialMove(id);
    assert.equal(clip?.id, clipId);
    assert.equal(clip?.move, cards[id].ability);
    assert.equal(cardCatalog.find(card => card.engineId === id)?.rarity, 'SuperCommon');
    assert.equal(specialMoveForEvent({ type: 'ability', kind: 'ability', cardId: id })?.id, clipId);
    assert.equal(resolveSpecialMove(cards[id].id)?.id, clipId);
    assert.equal(resolveSpecialMove(id, { [id]: null }), null);
  }
});

test('chroma removal makes cyan transparent while preserving white, skin and black', () => {
  const pixels = new Uint8ClampedArray([0,255,255,255, 255,255,255,255, 170,110,80,255, 0,0,0,255]);
  keyChromaPixels(pixels, 'cyan');
  assert.deepEqual([pixels[3], pixels[7], pixels[11], pixels[15]], [0,255,255,255]);
  const green = new Uint8ClampedArray([0,255,0,255]);
  keyChromaPixels(green, 'green'); assert.equal(green[3], 0);
});

test('Wave 5 covers all twenty expansion characters with their printed moves and original rarity split', () => {
  const wave = { bodegacat: 'char71', crossingguard: 'char72', laundry: 'char73', busker: 'char74', cornercoach: 'char75', nightcashier: 'char76', dogwalker: 'char77', mural: 'char78', chessregular: 'char79', gardener: 'char80', piratedj: 'char81', dancecaptain: 'char82', nightmedic: 'char83', subwaymagician: 'char84', ogdominican: 'char85', conductor: 'char86', midnightmayor: 'char87', bigzoey: 'char88', leroy: 'char89', partytitan: 'char90' };
  const rarities: Record<string, number> = {};
  for (const [id, clipId] of Object.entries(wave)) {
    const clip = resolveSpecialMove(id);
    assert.equal(clip?.id, clipId);
    assert.equal(clip?.label, cards[id].name);
    assert.equal(clip?.move, cards[id].ability);
    assert.equal(specialMoveForEvent({ type: 'ability', kind: 'ability', cardId: id })?.id, clipId);
    assert.equal(resolveSpecialMove(cards[id].id)?.id, clipId);
    assert.equal(resolveSpecialMove(id, { [id]: null }), null);
    assert.equal(resolveSpecialMove(id, { [id]: 'char08' })?.id, 'char08');
    const rarity = cardCatalog.find(card => card.engineId === id)!.rarity;
    rarities[rarity] = (rarities[rarity] ?? 0) + 1;
  }
  assert.deepEqual(rarities, { Common: 10, Rare: 5, Mythical: 5 });
});

test('Wave 6 covers the six creator Mythicals with their printed moves and refreshed rarity split', () => {
  const wave: Record<string, { clipId: string; rarity: string }> = {
    johnhenry: { clipId: 'char94', rarity: 'Rare' },
    yasuke: { clipId: 'char95', rarity: 'Rare' },
    dragonflyjones: { clipId: 'char96', rarity: 'Common' },
    tron: { clipId: 'char97', rarity: 'Uncommon' },
    mansamusa: { clipId: 'char98', rarity: 'Legendary' },
    shonuff: { clipId: 'char99', rarity: 'Rare' },
  };
  const rarities: Record<string, number> = {};
  for (const [id, expected] of Object.entries(wave)) {
    const clip = resolveSpecialMove(id);
    assert.equal(clip?.id, expected.clipId);
    assert.equal(clip?.label, cards[id].name);
    assert.equal(specialMoveForEvent({ type: 'ability', kind: 'ability', cardId: id })?.id, expected.clipId);
    assert.equal(resolveSpecialMove(cards[id].id)?.id, expected.clipId);
    assert.equal(resolveSpecialMove(id, { [id]: null }), null, 'manual disable remains available');
    const rarity = cardCatalog.find(card => card.engineId === id)!.rarity;
    assert.equal(rarity, expected.rarity, `${id} rarity should be ${expected.rarity}`);
    rarities[rarity] = (rarities[rarity] ?? 0) + 1;
  }
  assert.deepEqual(rarities, { Common: 1, Uncommon: 1, Rare: 3, Legendary: 1 });
});

test('play-once gate suppresses repeated chroma playback per fighter while keeping the procedural effect', () => {
  const clip = resolveSpecialMove('johnhenry');
  assert.ok(clip, 'johnhenry must resolve to a clip');
  const key = { owner: 'player' as const, sourceInstanceId: 'inst-1', moveId: clip!.id };
  const played = new Set<string>();

  // First trigger: full move duration, video renders.
  const firstPlan = planSpecialMoveBeat(clip, key, played, 650);
  assert.equal(firstPlan.durationMs, clip!.durationMs);
  assert.equal(firstPlan.playKey, getMovePlayKey(key));
  assert.equal(gateSpecialMoveReplay(clip, key, played)?.id, clip!.id);
  markSpecialMovePlayed(played, key);

  // Second trigger from the same fighter: standard beat, no video render.
  const secondPlan = planSpecialMoveBeat(clip, key, played, 650);
  assert.equal(secondPlan.durationMs, 650, 'replay should fall back to standard beat');
  assert.equal(gateSpecialMoveReplay(clip, key, played), null);

  // Different fighter, same move id: still gets the full duration.
  const otherKey = { owner: 'cpu' as const, sourceInstanceId: 'inst-2', moveId: clip!.id };
  assert.equal(gateSpecialMoveReplay(clip, otherKey, played)?.id, clip!.id);
  const otherPlan = planSpecialMoveBeat(clip, otherKey, played, 650);
  assert.equal(otherPlan.durationMs, clip!.durationMs);

  // No played set: gate stays open and the move always uses its own duration.
  assert.equal(gateSpecialMoveReplay(clip, key, null)?.id, clip!.id);
  assert.equal(planSpecialMoveBeat(clip, key, null, 650).durationMs, clip!.durationMs);

  // beginMatch equivalent: clearing the set reopens playback for the next match.
  played.clear();
  assert.equal(planSpecialMoveBeat(clip, key, played, 650).durationMs, clip!.durationMs);
});
