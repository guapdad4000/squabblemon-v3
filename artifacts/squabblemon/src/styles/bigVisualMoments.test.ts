import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const safehouseStageCss = readFileSync(new URL('./safehouse-stage.css', import.meta.url), 'utf8');
const indexCss = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const battleFxAaaCss = readFileSync(new URL('../components/battle-fx-aaa.css', import.meta.url), 'utf8');

test('safehouse-stage.css applies a radial station-focus spotlight vignette when inspecting a station', () => {
  assert.match(safehouseStageCss, /\.safehouse-stage:not\(\[data-view=["']room["']\]\)\s+\.safehouse__shade/);
});

test('index.css and battle-fx-aaa.css enhance SQUABBLE armed aura and district-squabble-impact callout', () => {
  assert.match(indexCss, /\.district-squabble-impact::before[\s\S]*?repeating-linear-gradient/);
  assert.match(battleFxAaaCss, /\.battle-arena\.is-squabble-armed\s+\.battle-squabble/);
});
