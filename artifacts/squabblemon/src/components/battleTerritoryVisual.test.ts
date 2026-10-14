import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const battleBoardCss = readFileSync(new URL('./battle-board.css', import.meta.url), 'utf8');

test('battle-board.css styles player/cpu territory control, contested lanes, and rival interest telegraphs', () => {
  assert.match(battleBoardCss, /\.battle-arena\.battle-hud\s+\.district-lane\[data-control=['"]player['"]\]/);
  assert.match(battleBoardCss, /\.battle-arena\.battle-hud\s+\.district-lane\[data-control=['"]cpu['"]\]/);
  assert.match(battleBoardCss, /\.battle-arena\.battle-hud\s+\.district-lane\[data-contested=['"]true['"]\]/);
  assert.match(battleBoardCss, /\.battle-arena\.battle-hud\s+\.district-lane\[data-rival-interest=['"]true['"]\]/);
});
