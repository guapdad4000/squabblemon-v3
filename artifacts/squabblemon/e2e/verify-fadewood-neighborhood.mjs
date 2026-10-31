import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

// Run only after the runtime owner publishes and freezes the named bundle.
// Example: FADEWOOD_EXPECT_BUNDLE=integrated-<hash>.js node e2e/verify-fadewood-neighborhood.mjs
const expectedBundle = process.env.FADEWOOD_EXPECT_BUNDLE;
assert.match(expectedBundle ?? '', /^integrated-[\w-]+\.js$/, 'Name the final published bundle with FADEWOOD_EXPECT_BUNDLE before launching WebGL.');
const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:4288';
const output = process.env.WORLD_OUTPUT ?? '/tmp/fadewood-neighborhood';
const testDpr = Number(process.env.WORLD_DPR ?? 1);
assert(Number.isFinite(testDpr) && testDpr >= .5 && testDpr <= 2, 'WORLD_DPR must be between .5 and 2; this only changes the test renderer pixel workload.');
const viewports = [['desktop', 1440, 960], ['phone', 390, 844]].filter(([name]) => !process.env.WORLD_VIEWPORT || process.env.WORLD_VIEWPORT === name);
assert(viewports.length, 'WORLD_VIEWPORT must be desktop or phone.');
await mkdir(output, { recursive: true });
const results = [];
const nightPattern = /\/fadewood-night-(?:panorama|neighborhood)\.webp$/;
const hostModelPattern = /\/assets\/curb-details\/(?:demario|luigion)\.glb$/;
const oldScenePortraitPattern = /\/scenes\/fadewood\/assets\/curb-details\/(?:demario|luigion)\.webp$/;
const woodPattern = /\/assets\/curb-details\/booth-wood\.webp$/;
const ambientPattern = /\/assets\/ambient\/(?:og-blue|og-red|cornball|ganger-blue|ganger-red)\.glb$/;

function observeNeighborhood() {
  if (window !== window.top) return;
  const proof = { events: [], presentations: [], latestState: null, mounts: [] };
  window.__neighborhoodProof = proof;
  const seen = new WeakSet();
  addEventListener('message', event => {
    const frame = [...document.querySelectorAll('iframe')].find(candidate => candidate.contentWindow === event.source);
    if (event.origin !== location.origin || !frame || event.data?.channel !== 'squabblemon-fadewood' || event.data.version !== 1) return;
    const data = event.data;
    if (data.type === 'state') { proof.latestState = { ...data, t: performance.now() }; return; }
    if (data.type !== 'progress') proof.events.push({ ...data, t: performance.now() });
  });
  addEventListener('DOMContentLoaded', () => {
    let previous = '';
    const record = () => {
      for (const frame of document.querySelectorAll('iframe')) {
        if (!seen.has(frame) && /scenes\/(fadewood|safehouse)\//.test(frame.src)) {
          seen.add(frame); proof.mounts.push({ title: frame.title, src: frame.src, t: performance.now() });
        }
      }
      const dialog = document.querySelector('.fadewood-world__dialog[open]');
      const title = dialog?.querySelector('#fadewood-menu-title')?.textContent ?? '';
      const type = document.querySelector('.story-stage') ? 'story' : dialog ? 'panel' : '';
      const current = `${type}:${title}`;
      if (type && current !== previous) proof.presentations.push({ type, title, t: performance.now(), lastFocus: proof.events.filter(event => event.type === 'focusComplete').at(-1) ?? null });
      previous = current;
    };
    new MutationObserver(record).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
    record();
  });
}

async function getProof(page) { return page.evaluate(() => window.__neighborhoodProof); }
async function worldChild(page) {
  await page.locator('.fadewood-world[data-world-state="ready"]').waitFor({ timeout: 90_000 });
  const child = page.frames().find(frame => /\/scenes\/fadewood\/index\.html/.test(frame.url()));
  assert(child, 'The actual Fadewood iframe mounted.');
  const scripts = await child.locator('script[src]').evaluateAll(elements => elements.map(element => new URL(element.src).pathname));
  assert(scripts.some(path => path.endsWith(`/${expectedBundle}`)), `Loaded final bundle ${expectedBundle}: ${scripts.join(', ')}`);
  await child.locator('canvas').first().waitFor();
  await page.waitForFunction(() => {
    const proof = window.__neighborhoodProof;
    const ready = proof.events.findLast(event => event.type === 'ready');
    return ready && proof.latestState?.instanceId === ready.instanceId;
  });
  return child;
}
async function sceneSnapshot(child) {
  return child.locator('#game').evaluate(element => Object.fromEntries(['ready', 'playing', 'night', 'lightingStatus', 'focusState', 'focusSource', 'courierPhase', 'courierPosition', 'cameraPosition'].map(key => [key, element.dataset[key] ?? null])));
}
async function settlePanel(page) {
  await page.locator('.fadewood-world__dialog[open] > .fadewood-panel').evaluate(async element => {
    await Promise.all(element.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
  });
}
async function settleFrame(child) {
  await child.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function capture(page, name, step) {
  await page.screenshot({ path: `${output}/${name}-${step}.png`, timeout: 20_000 });
}

// The runtime exposes these bounded DOM observations only for the explicit
// localhost /e2e fixture with motionProof=1. The observer never changes scene
// objects, playback clocks, inputs or application state.
async function observeNpcMotion(child) {
  await child.waitForFunction(() => document.querySelector('#game')?.dataset.npcMotion, null, { timeout: 20_000 });
  const instanceId = (await getProof(child.page())).events.findLast(event => event.type === 'ready')?.instanceId;
  assert(instanceId, 'The motion collector is scoped to one genuine ready instance.');
  await child.evaluate(readyInstanceId => {
    if (window.__neighborhoodNpcProof) return;
    const proof = { instanceId: readyInstanceId, samples: [], stages: [], lastKeys: {}, lastTime: -1 };
    window.__neighborhoodNpcProof = proof;
    const game = document.querySelector('#game');
    const parse = value => { try { return JSON.parse(value ?? '[]'); } catch { return []; } };
    const record = () => {
      const time = Number(game.dataset.npcTime);
      if (!Number.isFinite(time) || time === proof.lastTime) return;
      proof.lastTime = time;
      const motion = parse(game.dataset.npcMotion).map(({ id, clip, animated, playhead, duration, boneChecksum, activity, footHeight, rootOffset }) => ({ id, clip, animated, playhead, duration, boneChecksum, activity, footHeight, rootOffset }));
      const ambient = parse(game.dataset.npcAmbient);
      const routes = parse(game.dataset.npcRoutes).filter(route => route.id === 'nova' || route.id === 'golden-doberman')
        .map(({ id, position, yaw, phase, routeTime, turnVelocity, gaitWeight, groundSpeed, animationSpeed, procedural }) => ({ id, position, yaw, phase, routeTime, turnVelocity, gaitWeight, groundSpeed, animationSpeed, procedural }));
      for (const actor of ambient) {
        const key = `${actor.clip}:${actor.phase}:${actor.quiet}:${actor.settling ?? false}`;
        if (proof.lastKeys[actor.id] !== key) {
          proof.stages.push({ time, ...actor }); proof.lastKeys[actor.id] = key;
        }
      }
      proof.samples.push({ time, wallTime: Number(game.dataset.npcWallTime), motion, routes });
      if (proof.samples.length > 1200) proof.samples.shift();
      if (proof.stages.length > 2400) proof.stages.shift();
    };
    new MutationObserver(record).observe(game, { attributes: true, attributeFilter: ['data-npc-time'] });
    record();
  }, instanceId);
}

async function readNpcMotion(child) {
  return child.locator('#game').evaluate(element => ({
    time: Number(element.dataset.npcTime),
    motion: JSON.parse(element.dataset.npcMotion ?? '[]'),
    ambient: JSON.parse(element.dataset.npcAmbient ?? '[]'),
    routes: JSON.parse(element.dataset.npcRoutes ?? '[]'),
    curbStats: JSON.parse(element.dataset.curbStats ?? 'null'),
  }));
}

async function measureRelaxedIdle(child, ids) {
  await child.waitForFunction(expected => {
    const rows = JSON.parse(document.querySelector('#game')?.dataset.npcMotion ?? '[]');
    return expected.every(id => rows.some(row => row.id === id && row.clip === 'Fadewood_Relaxed_Idle' && row.animated));
  }, ids, { timeout: 30_000 });
  const before = await readNpcMotion(child);
  await child.waitForFunction(({ expected, initialTime, initial }) => {
    const game = document.querySelector('#game');
    if (Number(game?.dataset.npcTime) - initialTime < .6) return false;
    const rows = JSON.parse(game.dataset.npcMotion ?? '[]');
    return expected.every(id => {
      const row = rows.find(value => value.id === id);
      const first = initial.find(value => value.id === id);
      return row?.clip === 'Fadewood_Relaxed_Idle' && row.animated && Math.abs(row.boneChecksum - first.boneChecksum) > .00001 && Math.abs(row.playhead - first.playhead) > .01;
    });
  }, { expected: ids, initialTime: before.time, initial: before.motion }, { timeout: 20_000 });
  const after = await readNpcMotion(child);
  for (const id of ids) {
    for (const sample of [before, after]) {
      const actor = sample.motion.find(row => row.id === id);
      assert(actor?.animated && Number.isFinite(actor.boneChecksum));
      assert(actor.rootOffset.every(value => Number.isFinite(value) && Math.abs(value) < .05), `${id} remains anchored during its actual idle.`);
    }
  }
  return { before: { time: before.time, actors: before.motion.filter(row => ids.includes(row.id)) }, after: { time: after.time, actors: after.motion.filter(row => ids.includes(row.id)) } };
}

async function requireAmbientExercise(child, requireExercise = true) {
  const complete = () => {
    const proof = window.__neighborhoodNpcProof;
    return proof && ['og-blue', 'og-red'].every(id => {
      const stages = proof.stages.filter(stage => stage.id === id);
      const down = stages.findIndex(stage => stage.clip === 'idle_to_push_up');
      const push = stages.findIndex((stage, index) => index > down && stage.clip === 'push_up');
      const up = stages.findIndex((stage, index) => index > push && stage.clip === 'push_up_to_idle');
      const quiet = stages.findIndex((stage, index) => index > up && stage.clip === 'Fadewood_Relaxed_Idle');
      const samples = proof.samples.flatMap(sample => sample.motion.filter(row => row.id === id && row.clip === 'push_up' && row.animated));
      return down >= 0 && push > down && up > push && quiet > up && samples.length > 1 && samples.some(row => Math.abs(row.boneChecksum - samples[0].boneChecksum) > .00001);
    });
  };
  let completed = false;
  for (let attempt = 0; requireExercise && attempt < 18; attempt++) {
    try {
      await child.waitForFunction(complete, null, { timeout: 20_000 });
      completed = true; break;
    } catch (error) {
      if (error.name !== 'TimeoutError') throw error;
      const current = await readNpcMotion(child);
      console.log(`Ambient observation: ${current.time.toFixed(1)} real NPC seconds; ${current.ambient.filter(row => row.id === 'og-blue' || row.id === 'og-red').map(row => `${row.id}=${row.clip}/${row.phase}`).join(', ')}.`);
    }
  }
  if (requireExercise) assert(completed, 'Both real OG exercise-to-idle cycles must finish within the bounded observation.');
  const proof = await child.evaluate(() => window.__neighborhoodNpcProof);
  const dogs = {};
  for (const id of ['nova', 'golden-doberman']) {
    const rows = proof.samples.flatMap(sample => sample.routes.filter(route => route.id === id).map(route => ({ time: sample.time, ...route })));
    assert(rows.length > 5, `Real ${id} route samples were observed.`);
    const velocities = rows.map(row => Math.abs(row.turnVelocity));
    assert(velocities.every(value => Number.isFinite(value) && value <= 1.001), `${id} keeps its turn velocity below one radian per second.`);
    assert(velocities.some(value => value > .05), `${id} actually turned during observation.`);
    let maxObservedTurnRate = 0;
    for (let index = 1; index < rows.length; index++) {
      const delta = rows[index].time - rows[index - 1].time;
      if (delta <= 0) continue;
      const angle = Math.atan2(Math.sin(rows[index].yaw - rows[index - 1].yaw), Math.cos(rows[index].yaw - rows[index - 1].yaw));
      maxObservedTurnRate = Math.max(maxObservedTurnRate, Math.abs(angle) / delta);
    }
    assert(maxObservedTurnRate <= 1.05, `${id} has no heading snap in the real sampled scene.`);
    assert(rows.some(row => Math.abs(row.turnVelocity) > .05 && row.gaitWeight > .05), `${id} steps while it turns.`);
    dogs[id] = { samples: rows.length, maxObservedTurnRate, maxTurnVelocity: Math.max(...velocities) };
  }
  return { ...proof, exerciseCoverage: requireExercise ? 'Both OGs completed down/push-up/stand/idle in this one child instance.' : 'Passive phase observation; full cycles are covered by the desktop run.', dogTurnSummary: dogs };
}
async function expectFocusedPanel(page, child, sourceId, title, afterIndex) {
  const dialog = page.locator('.fadewood-world__dialog[open]');
  await dialog.getByRole('heading', { name: title, exact: true }).waitFor({ timeout: 15_000 });
  await settlePanel(page);
  const proof = await getProof(page);
  const receipt = proof.events.slice(afterIndex).findLast(event => event.type === 'focusComplete' && event.sourceId === sourceId);
  assert(receipt, `A genuine new ${sourceId} camera receipt precedes the panel.`);
  const presentation = proof.presentations.findLast(item => item.type === 'panel' && item.title === title);
  assert.equal(presentation?.lastFocus?.requestId, receipt.requestId);
  assert(receipt.t <= presentation.t);
  await child.waitForFunction(source => {
    const data = document.querySelector('#game')?.dataset;
    return data?.focusState === 'held' && data.focusSource === source;
  }, sourceId);
  assert.equal(await page.locator('.story-stage').count(), 0, 'Inspecting a source never starts Story by itself.');
  return { receipt, presentation, scene: await sceneSnapshot(child) };
}
async function arriveAtStoryHost(page, child) {
  const before = (await getProof(page)).events.length;
  await page.getByTestId('button-continue-story').click();
  const result = await expectFocusedPanel(page, child, 'cornball', 'Cornball', before);
  const events = (await getProof(page)).events.slice(before);
  assert(events.some(event => event.type === 'travelComplete' && event.destinationId === 'fade-market'));
  assert.equal(await page.locator('.fadewood-character-panel').getByRole('button', { name: 'Continue The Block Crown', exact: true }).count(), 1);
  assert.equal(await page.locator('.fadewood-character-panel').getByRole('button', { name: 'Keep exploring', exact: true }).count(), 1);
  return result;
}
async function revealLine(page) {
  const next = page.locator('.story-stage__next');
  await next.waitFor();
  await next.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(next).toBeEnabled();
  if ((await next.innerText()).includes('Complete line')) await next.click();
  await expect(next).not.toHaveText('Complete line', { timeout: 10_000 });
  await expect(page.locator('.story-stage__caret')).toHaveText('', { timeout: 20_000 });
  return {
    counter: await page.locator('.story-stage__speaker small').innerText(),
    speaker: await page.locator('.story-stage__speaker-name').innerText(),
    line: await page.locator('.story-stage__line').innerText(),
  };
}
async function closeStory(page) {
  await page.locator('.story-stage__header').getByRole('button', { name: /Back/ }).click();
  await page.locator('.story-stage').waitFor({ state: 'detached' });
  await page.getByTestId('button-continue-story').waitFor();
}
async function fastTravel(page, destinationId, label) {
  const before = (await getProof(page)).events.length;
  await page.getByRole('button', { name: 'Open map and fast travel' }).click();
  const stop = page.getByRole('button', { name: `Fast travel to ${label}`, exact: true });
  if (!await stop.count()) await page.getByRole('button', { name: 'Back streets', exact: true }).click();
  for (let pageIndex = 0; !await stop.count() && pageIndex < 5; pageIndex++) {
    await page.getByRole('button', { name: 'More stops', exact: true }).click();
  }
  await stop.click();
  await page.waitForFunction(({ before, destinationId }) => window.__neighborhoodProof.events.slice(before).some(event => event.type === 'travelComplete' && event.destinationId === destinationId), { before, destinationId }, { timeout: 25_000 });
  await page.getByTestId('button-continue-story').waitFor();
  assert.equal(await page.locator('.fadewood-world__dialog[open]').count(), 0, 'Ordinary fast travel leaves inspection to the player.');
  assert.equal(await page.locator('.story-stage').count(), 0);
  return (await getProof(page)).events.slice(before).findLast(event => event.type === 'travelComplete');
}
async function setStreetNight(page, child, night, captureName) {
  const beforeMenu = await page.evaluate(() => performance.now());
  await page.getByRole('button', { name: 'World controls and Story archive' }).click();
  await page.waitForFunction(time => {
    const state = window.__neighborhoodProof.latestState;
    return state?.playing === false && state.t > time;
  }, beforeMenu);
  await child.waitForFunction(() => document.querySelector('#game')?.dataset.playing === 'false');
  const control = page.getByRole('button', { name: night ? 'Switch streets to late night' : 'Switch streets to daylight', exact: true });
  await control.click();
  await expect(page.locator('.fadewood-world')).toHaveAttribute('data-lighting', night ? 'night' : 'day', { timeout: 30_000 });
  await expect(page.locator('.fadewood-world')).toHaveAttribute('data-lighting-status', 'ready');
  await child.waitForFunction(expected => document.querySelector('#game')?.dataset.night === String(expected) && document.querySelector('#game')?.dataset.lightingStatus === 'ready', night, { timeout: 30_000 });
  await settleFrame(child);
  const appliedWhilePaused = await sceneSnapshot(child);
  assert.equal(appliedWhilePaused.playing, 'false', 'The Menu holds gameplay while the selected lighting applies.');
  if (captureName) await capture(page, captureName, 'night-menu');
  await page.getByRole('button', { name: 'Close world menu', exact: true }).click();
  await settleFrame(child);
  assert.equal(await page.evaluate(() => localStorage.getItem('squabblemon_safehouse_lighting')), night ? 'night' : 'day');
  return { ...await sceneSnapshot(child), appliedWhilePaused };
}

// This navigates through the real input controller using observed public state.
// It never teleports the avatar, invokes a debug API, or fabricates an inspect event.
async function inspectNova(page, child) {
  const checkpoints = [[12.8, -21], [16.3, -22], [17, -24], [17, -26.5]];
  const held = new Set();
  const applyKeys = async keys => {
    for (const key of [...held]) if (!keys.includes(key)) { await page.keyboard.up(key); held.delete(key); }
    for (const key of keys) if (!held.has(key)) { await page.keyboard.down(key); held.add(key); }
  };
  const nearby = page.getByRole('button', { name: 'Remember Nova', exact: true });
  const path = [];
  await child.locator('canvas').first().focus();
  const deadline = performance.now() + 75_000;
  try {
    for (const [targetX, targetZ] of checkpoints) {
      while (performance.now() < deadline) {
        if (await nearby.isVisible()) break;
        const state = (await getProof(page)).latestState;
        assert(state?.checkpoint, 'Player position comes from the genuine scene state event.');
        const [x, , z] = state.checkpoint.position;
        const dx = targetX - x, dz = targetZ - z;
        if (Math.hypot(dx, dz) < .75) break;
        const yaw = state.checkpoint.yaw;
        const forward = -Math.sin(yaw) * dx - Math.cos(yaw) * dz;
        const side = Math.cos(yaw) * dx - Math.sin(yaw) * dz;
        const remaining = Math.hypot(dx, dz);
        const keys = remaining > 2.5 ? ['Shift'] : [];
        if (Math.abs(forward) / remaining > .4) keys.push(forward > 0 ? 'w' : 's');
        if (Math.abs(side) / remaining > .4) keys.push(side > 0 ? 'd' : 'a');
        await applyKeys(keys);
        path.push({ position: [x, z], target: [targetX, targetZ], keys });
        await page.waitForTimeout(200);
      }
      await applyKeys([]);
      if (await nearby.isVisible()) break;
      if (performance.now() >= deadline) break;
      // Let a roaming resident pass the current point before walking onward.
      await nearby.waitFor({ state: 'visible', timeout: 1500 }).catch(() => {});
      if (await nearby.isVisible()) break;
    }
  } finally { await applyKeys([]); }
  await nearby.waitFor({ timeout: 10_000 });
  const before = (await getProof(page)).events.length;
  await nearby.click();
  const result = await expectFocusedPanel(page, child, 'nova', 'Nova', before);
  const dialog = page.locator('.fadewood-world__dialog[open]');
  assert.equal(await dialog.getByText('Always part of the block.', { exact: true }).count(), 1);
  assert.equal(await dialog.getByRole('button').count(), 2);
  assert.equal(await dialog.getByRole('link').count(), 0);
  assert.equal(await dialog.getByRole('button', { name: 'Keep exploring', exact: true }).count(), 1);
  const heldBefore = await readNpcMotion(child);
  // The modal deliberately pauses NPC scene time. Observe the held pose across
  // wall time instead of requiring that paused playback clock to advance.
  await page.waitForTimeout(800);
  const heldAfter = await readNpcMotion(child);
  const firstNova = heldBefore.routes.find(route => route.id === 'nova');
  const lastNova = heldAfter.routes.find(route => route.id === 'nova');
  assert(firstNova && lastNova);
  assert(Math.hypot(...lastNova.position.map((value, index) => value - firstNova.position[index])) < .03, 'Nova holds its route during the memorial.');
  assert(Math.abs(Math.atan2(Math.sin(lastNova.yaw - firstNova.yaw), Math.cos(lastNova.yaw - firstNova.yaw))) < .02, 'The memorial does not turn Nova toward the player.');
  return { ...result, inputPath: path, heldBefore: firstNova, heldAfter: lastNova };
}

for (const [name, width, height] of viewports) {
  let browser;
  let page;
  let intentionallyClosing = false;
  const entry = { name, viewport: { width, height, deviceScaleFactor: testDpr }, expectedBundle, evidence: 'Actual local Fadewood and Safehouse renderers plus real Story/Home components; bounded synthetic fixture account/API. Passive motion observations use the explicit localhost/e2e-only motionProof DOM surface. The reported deviceScaleFactor is a test-only pixel workload setting. Chrome software GPU, not a physical-device or production check.', errors: [], crashes: [], navigations: [], frameDetaches: [], hmr: [], nightRequests: [], nightResponses: [], hostModelResponses: [], woodResponses: [], ambientResponses: [], oldScenePortraitRequests: [], steps: {} };
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE ?? '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
    browser.on('disconnected', () => { if (!intentionallyClosing) entry.crashes.push('browser disconnected before cleanup'); });
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: testDpr, hasTouch: name === 'phone', reducedMotion: 'no-preference' });
    page = await context.newPage(); page.setDefaultTimeout(20_000);
    page.on('pageerror', error => entry.errors.push(error.message));
    page.on('crash', () => entry.crashes.push('page crash'));
    page.on('framedetached', frame => entry.frameDetaches.push({ url: frame.url(), t: performance.now() }));
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) entry.navigations.push({ url: frame.url(), t: performance.now() }); });
    page.on('console', message => { if (/\[vite\].*(reload|hot updated)|ErrorBoundary caught|TypeError:/.test(message.text())) entry.hmr.push(message.text()); });
    page.on('request', request => {
      const path = new URL(request.url()).pathname;
      if (nightPattern.test(path)) entry.nightRequests.push({ url: request.url(), t: performance.now() });
      if (oldScenePortraitPattern.test(path)) entry.oldScenePortraitRequests.push(request.url());
    });
    page.on('response', response => {
      const path = new URL(response.url()).pathname;
      if (nightPattern.test(path)) entry.nightResponses.push({ url: response.url(), status: response.status(), t: performance.now() });
      if (hostModelPattern.test(path)) entry.hostModelResponses.push({ url: response.url(), status: response.status(), t: performance.now() });
      if (woodPattern.test(path)) entry.woodResponses.push({ url: response.url(), status: response.status(), t: performance.now() });
      if (ambientPattern.test(path)) entry.ambientResponses.push({ url: response.url(), status: response.status(), t: performance.now() });
    });
    await page.addInitScript(observeNeighborhood);
    await page.addInitScript(() => {
      if (window !== window.top) return;
      localStorage.setItem('squabblemon_safehouse_lighting', 'day'); localStorage.setItem('squabblemon-gpu-tier-v2', 'low');
    });
    await context.routeWebSocket('**', socket => socket.close());
    const started = performance.now();
    await page.goto(`${origin}/e2e/season-theater.fixture.html?scenario=world-existing-save&gpuTier=low&motionProof=1`, { waitUntil: 'domcontentloaded' });
    const child = await worldChild(page);
    entry.readyMs = performance.now() - started;
    assert.deepEqual(entry.hostModelResponses.map(response => new URL(response.url).pathname.split('/').at(-1)).sort(), ['demario.glb', 'luigion.glb']);
    assert(entry.hostModelResponses.every(response => response.status === 200), 'Both supplied host models load successfully.');
    assert.deepEqual(entry.oldScenePortraitRequests, [], 'The renderer does not fetch retired host portrait planes.');
    assert.equal(entry.woodResponses.length, 1);
    assert.equal(entry.woodResponses[0].status, 200, 'The approved wood derivative loads successfully.');
    assert.deepEqual(entry.ambientResponses.map(response => new URL(response.url).pathname.split('/').at(-1)).sort(), ['cornball.glb', 'ganger-blue.glb', 'ganger-red.glb', 'og-blue.glb', 'og-red.glb']);
    assert(entry.ambientResponses.every(response => response.status === 200), 'Every authored animation-only pack loads successfully.');
    await observeNpcMotion(child);
    console.log(`${name}: final world ready in ${Math.round(entry.readyMs)}ms.`);
    const frameElement = await page.locator('iframe[title="Explore Fadewood"]').elementHandle();
    const initialSrc = await frameElement.getAttribute('src');
    const retained = async () => {
      assert.equal(await frameElement.evaluate(element => element.isConnected && element === document.querySelector('iframe[title="Explore Fadewood"]')), true, 'The world iframe survives Story and lighting changes.');
      assert.equal(await frameElement.getAttribute('src'), initialSrc);
      const instances = new Set((await getProof(page)).events.filter(event => event.type === 'ready').map(event => event.instanceId));
      assert.equal(instances.size, 1, 'Lighting and Story must retain the same running child instance.');
    };
    assert.equal(entry.nightRequests.length, 0, 'Day startup does not request the optional night pair.');
    await capture(page, name, 'day');
    await child.waitForFunction(() => document.querySelector('#game')?.dataset.courierPhase === 'delivery-waiting', null, { timeout: 45_000 });
    entry.steps.mailmanWaitingIdle = await measureRelaxedIdle(child, ['mailman']);
    assert.equal(await page.locator('.fadewood-world__dialog[open]').count(), 0, 'The landed courier remains available without opening a popup.');
    await capture(page, name, 'mailman-waiting-idle');
    console.log(`${name}: landed Mailman has actual advancing relaxed-idle bone motion.`);

    entry.steps.arrivalChoice = await arriveAtStoryHost(page, child);
    await capture(page, name, 'host-choice');
    await page.mouse.click(2, height / 2);
    await page.locator('.fadewood-character-panel').waitFor({ state: 'detached' });
    assert.equal(await page.locator('.story-stage').count(), 0);
    entry.steps.reopenedChoice = await arriveAtStoryHost(page, child);
    await page.getByRole('button', { name: 'Continue The Block Crown', exact: true }).click();
    await page.locator('.story-stage').waitFor();
    const firstLine = await revealLine(page);
    await page.locator('.story-stage__next').click();
    await expect.poll(() => page.locator('.story-stage__speaker small').innerText()).not.toBe(firstLine.counter);
    const savedLine = await revealLine(page);
    await capture(page, name, 'story-saved-line');
    await closeStory(page); await retained();
    await arriveAtStoryHost(page, child);
    await page.getByRole('button', { name: 'Continue The Block Crown', exact: true }).click();
    await page.locator('.story-stage').waitFor();
    const reopenedLine = await revealLine(page);
    assert.deepEqual(reopenedLine, savedLine, 'The existing Story controller resumes the saved dialogue line.');
    entry.steps.savedStory = { firstLine, savedLine, reopenedLine };
    await closeStory(page); await retained();
    console.log(`${name}: explicit Story choice, dismissal and saved-line reopening passed.`);

    entry.steps.boothTravel = await fastTravel(page, 'demario-luigion-booth', 'DeMario & Luigion');
    entry.steps.boothIdle = await measureRelaxedIdle(child, ['demario', 'luigion']);
    entry.steps.wood = { responses: entry.woodResponses, stats: (await readNpcMotion(child)).curbStats };
    await settleFrame(child);
    await capture(page, name, 'booth-exterior');
    const boothBefore = (await getProof(page)).events.length;
    await page.getByRole('button', { name: 'Open DeMario & Luigion', exact: true }).click();
    entry.steps.booth = await expectFocusedPanel(page, child, 'demario-luigion-booth', 'DeMario & Luigion', boothBefore);
    const portraits = page.locator('.fadewood-character-panel__photo img');
    await portraits.evaluateAll(images => Promise.all(images.map(image => image.decode())));
    assert.deepEqual(await portraits.evaluateAll(images => images.map(image => new URL(image.src).pathname)), ['/assets/characters/demario.webp', '/assets/characters/luigion.webp']);
    assert.equal(await page.locator('.fadewood-world__dialog[open]').getByText('Their story is coming to this corner.', { exact: true }).count(), 1);
    assert.equal(await page.locator('.fadewood-world__dialog[open]').getByRole('button', { name: /^Continue|Claim|Buy/ }).count(), 0);
    await capture(page, name, 'booth');
    await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();
    console.log(`${name}: physical booth arrival and canonical contextual panel passed.`);

    assert.equal(entry.nightRequests.length, 0);
    const nightIntent = performance.now();
    entry.steps.night = await setStreetNight(page, child, true, name); await retained();
    assert.equal(entry.nightRequests.length, 2, 'One lazy request per approved night image.');
    assert(entry.nightRequests.every(request => request.t >= nightIntent));
    assert.equal(new Set(entry.nightRequests.map(request => new URL(request.url).pathname)).size, 2);
    assert(entry.nightResponses.every(response => response.status === 200));
    await capture(page, name, 'night');
    entry.steps.restoredDay = await setStreetNight(page, child, false); await retained();
    await capture(page, name, 'day-restored');
    console.log(`${name}: lazy night pair, paused application and Day restore passed without remount.`);
    entry.steps.nightForSafehouse = await setStreetNight(page, child, true); await retained();
    console.log(`${name}: ${name === 'desktop' ? 'collecting real OG exercise-to-idle cycles' : 'recording passive ambient phases'} and smooth dog turns without seeking clocks.`);
    entry.steps.ambientAndDogs = await requireAmbientExercise(child, name === 'desktop');
    console.log(`${name}: ${name === 'desktop' ? 'both OGs completed authored down/push-up/stand/idle cycles' : 'passive ambient phases observed'}; dog headings stayed smooth.`);

    const safehouseTravel = await fastTravel(page, 'safehouse', 'Safehouse');
    assert(safehouseTravel.checkpoint, 'The real arrival includes its saved outside checkpoint.');
    entry.steps.safehouseApproach = safehouseTravel.checkpoint;
    await settleFrame(child);
    await capture(page, name, 'safehouse-exterior-night');
    const beforeEntry = (await getProof(page)).presentations.length;
    await page.getByRole('button', { name: 'Enter Safehouse', exact: true }).click();
    await expect(page.locator('[data-fixture-route]')).toHaveAttribute('data-fixture-route', '/game');
    await page.locator('.safehouse-stage[data-scene-ready="true"]').waitFor({ timeout: 60_000 });
    assert.equal(await page.locator('.fadewood-world').count(), 0, 'Safehouse entry mounts actual Home, not another character sheet.');
    assert(!(await getProof(page)).presentations.slice(beforeEntry).some(item => item.type === 'panel' && item.title === 'Safehouse'));
    const room = page.frames().find(frame => /\/scenes\/safehouse\/index\.html/.test(frame.url()));
    assert(room, 'Actual Safehouse renderer mounted in the explicit local fixture.');
    await expect(page.locator('.safehouse-stage')).toHaveAttribute('data-lighting', 'night');
    await room.waitForFunction(() => window.Squabblemon?.getSceneStatus().night === true);
    await capture(page, name, 'safehouse-night');
    entry.steps.safehouseNight = await room.evaluate(() => window.Squabblemon.getSceneStatus());
    await page.getByRole('button', { name: 'Switch to daylight', exact: true }).click();
    await room.waitForFunction(() => window.Squabblemon?.getSceneStatus().night === false);
    await expect(page.locator('.safehouse-stage')).toHaveAttribute('data-lighting', 'day');
    await page.getByRole('button', { name: 'Explore the television', exact: true }).click();
    await page.getByRole('link', { name: 'Hit the streets', exact: true }).click();
    const requestsBeforeReturn = entry.nightRequests.length;
    const returnedChild = await worldChild(page);
    await observeNpcMotion(returnedChild);
    await expect(page.locator('.fadewood-world')).toHaveAttribute('data-lighting', 'day');
    await returnedChild.waitForFunction(() => document.querySelector('#game')?.dataset.night === 'false');
    assert.equal(entry.nightRequests.length, requestsBeforeReturn, 'Returning in daylight does not fetch the night pair.');
    await capture(page, name, 'returned-world-day');
    entry.steps.returnedDay = await sceneSnapshot(returnedChild);
    entry.proof = await getProof(page);
    const restored = entry.proof.latestState?.checkpoint;
    assert(restored && entry.steps.safehouseApproach);
    assert(Math.hypot(restored.position[0] - entry.steps.safehouseApproach.position[0], restored.position[2] - entry.steps.safehouseApproach.position[2]) < 1, 'Returning from Safehouse restores the saved outside position.');
    assert.equal(await page.locator('.story-stage').count(), 0);
    console.log(`${name}: actual Safehouse Night, shared Day preference and restored World checkpoint passed.`);
    await fastTravel(page, 'fade-park', 'Fade Park');
    entry.steps.nova = await inspectNova(page, returnedChild);
    await capture(page, name, 'nova-memorial');
    await page.getByRole('button', { name: 'Keep exploring', exact: true }).click();
    entry.proof = await getProof(page);
    assert.equal(entry.proof.mounts.filter(mount => mount.title === 'Explore Fadewood').length, 2, 'Only leaving for Safehouse remounts Fadewood.');
    assert.equal(entry.proof.mounts.filter(mount => mount.title === 'Interactive safehouse').length, 1);
    assert.equal(entry.navigations.length, 1, 'Memory-router journeys never leave the explicit local fixture.');
    assert.deepEqual(entry.errors, []); assert.deepEqual(entry.crashes, []); assert.deepEqual(entry.hmr, []);
    assert.deepEqual(entry.oldScenePortraitRequests, []);
    entry.status = 'passed';
    console.log(`${name}: actual wood/idle/exercise/dog motion, Story choice/save, booth, Nova, night pair and shared Safehouse lighting passed.`);
  } catch (error) {
    entry.status = 'failed'; entry.failure = String(error);
    if (page && !page.isClosed()) {
      await page.screenshot({ path: `${output}/${name}-failure.png`, timeout: 10_000 }).catch(() => {});
      entry.proof = await getProof(page).catch(() => null);
      entry.visibleText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => null);
      const child = page.frames().find(frame => /\/scenes\/fadewood\//.test(frame.url()));
      entry.lastScene = child ? await sceneSnapshot(child).catch(() => null) : null;
      entry.lastMotion = child ? await child.evaluate(() => window.__neighborhoodNpcProof).catch(() => null) : null;
    }
    throw error;
  } finally {
    intentionallyClosing = true;
    await browser?.close();
    results.push(entry);
    await writeFile(`${output}/neighborhood-${process.env.WORLD_VIEWPORT ?? 'all'}.json`, JSON.stringify(results, null, 2));
  }
}
