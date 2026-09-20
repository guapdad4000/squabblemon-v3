import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

process.env.PORT = '4198';
process.env.BASE_PATH = '/squabblemon/';
const fixture = 'e2e/phase-regression-' + randomUUID() + '.tsx';
const harness = [
  "import React, { StrictMode, useEffect, useState } from 'react';",
  "import { createRoot } from 'react-dom/client';",
  "import { Battle } from '../src/components/Battle';",
  "import { decks } from '../src/data';",
  "import { createStoryMatch } from '../src/gameEngine';",
  "import { getStoryBattle } from '@workspace/squabblemon-engine/story';",
  "import '../src/index.css';",
  "const initial = createStoryMatch(getStoryBattle('cracked-head-takes-the-block').encounter, 'block');",
  "const noop = () => {};",
  "function Harness() {",
  " const [tick, setTick] = useState(0), [phase, setPhase] = useState(0), [selected, setSelected] = useState(null);",
  " useEffect(() => { const timer = setInterval(() => setTick(t => t + 1), 100); return () => clearInterval(timer); }, []);",
  " const match = { ...initial, phase: 'player', nextEventSequence: initial.nextEventSequence + tick, storyRuntime: { ...initial.storyRuntime, activePhaseIndex: phase } };",
  " return <><button id='advance-phase' onClick={() => setPhase(p => (p + 1) % 3)}>Next phase</button><output id='ticks'>{tick}</output><output id='selected'>{selected}</output><div style={{height: 'calc(100dvh - 30px)'}}><Battle match={match} deck={decks[0]} rivalDeck={decks[1]} selectedInstanceId={selected} setSelectedInstanceId={setSelected} selectedLane={null} setSelectedLane={noop} commit={noop} skipSequence={noop} presentationPhase='player-ready' phaseMessage='Your move' timerSeconds={20} timerEnabled={false} impactLane={null} stagedRival={null} stagedPlayer={null} activeEffectId={null} activeEffectLane={null} activeEffect={null} presentationScores={null} squabble={false} setSquabble={noop} setInspect={noop} archiveMatch={noop} onShowRules={noop} /></div></>;",
  "}",
  "createRoot(document.getElementById('root')).render(<StrictMode><Harness /></StrictMode>);",
].join('\n');
await writeFile(fixture, harness);
const server = await createServer({ server: { host: '127.0.0.1', port: 4198, strictPort: true } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  for (const [width, height, reducedMotion] of [[390, 844, 'reduce'], [1280, 900, 'no-preference']] as const) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/__phase-test', async route => {
      const html = await server.transformIndexHtml('/squabblemon/__phase-test', '<html><body><div id="root"></div><script type="module" src="/' + fixture + '"></script></body></html>');
      await route.fulfill({ contentType: 'text/html', body: html });
    });
    await page.goto('http://127.0.0.1:4198/squabblemon/__phase-test');
    await page.getByText('Phase 1', { exact: true }).waitFor();
    await page.getByText('Phase 1', { exact: true }).waitFor({ state: 'hidden', timeout: 4200 });
    assert(Number(await page.locator('#ticks').innerText()) >= 20, 'Board updates continued during the warning');
    await page.getByTestId('hand-tray').locator('[data-card-zone="hand"]').first().click();
    assert.notEqual(await page.locator('#selected').innerText(), '', 'Cards are selectable after the warning clears');
    await page.locator('#advance-phase').click();
    await page.getByText('Phase 2', { exact: true }).waitFor();
    await page.getByText('Phase 2', { exact: true }).waitFor({ state: 'hidden', timeout: 4200 });
    await page.waitForTimeout(400);
    assert.equal(await page.getByText('Phase 2', { exact: true }).count(), 0, 'Dismissed phase stays dismissed across board updates');
    await page.locator('#advance-phase').click();
    await page.getByText('Phase 3', { exact: true }).waitFor();
    await page.getByText('Phase 3', { exact: true }).waitFor({ state: 'hidden', timeout: 4200 });
    await page.screenshot({ path: '../../screenshots/story-phase-cleared-' + width + '.png' });
    assert.deepEqual(errors, []);
    console.log(width + 'px: StrictMode, continuous board updates, auto-dismiss, later phases and playable board passed.');
    await page.close();
  }
} finally { await browser?.close(); await server.close(); await unlink(fixture); }
