/** Isolated browser delivery evidence: real Story surface, synthetic authoritative progress. */
import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { storyContent, storySeasons } from '../../../lib/squabblemon-engine/src/story';
process.env.PORT = '4193';
process.env.BASE_PATH = '/';
const fixture = 'e2e/story-delivery-runtime.fixture.tsx';
const first = storyContent.chapters[0];
const second = storyContent.chapters[1];
const deep = storyContent.chapters.find(chapter => chapter.nodes.some(node => node.puzzle))!;
const deepNode = deep.nodes.find(node => node.puzzle)!;
const nodes = storyContent.chapters.flatMap(chapter => chapter.nodes.map(node => ({
  chapterId: chapter.id, nodeId: node.id, title: node.title, kind: node.kind, optional: node.optional,
  status: 'available', mapPosition: node.mapPosition, prerequisites: node.prerequisites, rewards: node.rewards,
  cleared: false, stars: 0, attempts: 0, wins: 0, lastOutcome: null, dialogueSeen: [], bossHighestPhase: 0,
  firstClearedAt: null, lastPlayedAt: null,
})));
const campaign = {
  contentVersion: storyContent.version, nodes,
  chapters: storyContent.chapters.map(chapter => ({ ...chapter, nodes: undefined, prerequisites: undefined, status: 'available', completedNodes: 0, totalNodes: chapter.nodes.length, completedRequiredNodes: 0, totalRequiredNodes: chapter.nodes.filter(node => !node.optional).length, stars: 0, bossStatus: 'available' })),
  recommendedNodeId: first.nodes[0].id, totalStars: 0, completedNodes: 0, bossStatus: 'in-progress',
  seasons: storySeasons.map(season => ({ ...season, status: 'available', recommendedNodeId: nodes.find(node => season.chapterIds.includes(node.chapterId))?.nodeId, starsEarned: 0, starsAvailable: nodes.filter(node => node.kind === 'battle' && season.chapterIds.includes(node.chapterId)).length * 3, clearedNodes: 0, totalNodes: nodes.filter(node => season.chapterIds.includes(node.chapterId)).length })),
};
const existing = await readFile('e2e/season-theater.fixture.tsx', 'utf8');
const bootstrapFunction = existing.slice(existing.indexOf('function createBootstrap()'), existing.indexOf('function createCampaign()'));
const source = `import React from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {getGetPlayerBootstrapQueryKey,getGetPlayerStoryQueryKey,type PlayerBootstrap} from '@workspace/api-client-react';
import {Router} from 'wouter';
import {CosmeticProvider} from '../src/components/CosmeticContext';
import {Story} from '../src/pages/game/Story';
import '../src/index.css';
const scenario='theater';
${bootstrapFunction}
const bootstrap=createBootstrap();
const campaign=${JSON.stringify(campaign)};
const client=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false,staleTime:Infinity}}});
client.setQueryData(getGetPlayerBootstrapQueryKey(),bootstrap);
client.setQueryData(getGetPlayerStoryQueryKey(),campaign);
createRoot(document.getElementById('root')!).render(<Router><QueryClientProvider client={client}><CosmeticProvider profile={bootstrap.profile}><div style={{height:'100dvh'}}><Story bootstrap={bootstrap}/></div></CosmeticProvider></QueryClientProvider></Router>);`;
await writeFile(fixture, source);
const server = await createServer({ server: { host: '127.0.0.1', port: 4193, strictPort: true } });
let browser;
const results: unknown[] = [];
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
  for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    const errors: string[] = [];
    const chapters: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      const match = new URL(request.url()).pathname.match(/\/generated\/([^/]+)\.json$/);
      if (match && match[1] !== 'index' && !new URL(request.url()).searchParams.has('url')) chapters.push(match[1]);
    });
    await page.route('**/__story-delivery**', async route => {
      const html = await server.transformIndexHtml('/__story-delivery', '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/' + fixture + '"></script>');
      await route.fulfill({ contentType: 'text/html', body: html });
    });
    const navigate = async (query: string) => page.evaluate(query => { history.pushState({}, '', '/game/story' + query); dispatchEvent(new PopStateEvent('popstate')); }, query);
    await page.goto('http://127.0.0.1:4193/__story-delivery');
    await page.getByTestId('region-story-theater').waitFor();
    assert.deepEqual(chapters, [], 'Poster theater does not download chapter dialogue');
    await navigate('?season=' + storySeasons[0].id);
    await page.locator('.story-atlas__terrain').waitFor();
    assert.deepEqual(chapters, [first.id], 'Only current chapter loads on season entry');
    await page.locator('.chapter-pass').filter({ hasText: second.title.replace(/^chapter\s+[^:]+:\s*/i, '') }).click();
    await page.locator('.story-title').filter({ hasText: second.title }).waitFor();
    assert.deepEqual(chapters, [first.id, second.id], 'Chapter selection loads exactly requested chapter');
    await page.locator('.chapter-pass').first().click();
    await page.locator('.story-title').filter({ hasText: first.title }).waitFor();
    assert.equal(chapters.length, 2, 'Previously visited chapter reuses authoring cache');
    await page.screenshot({ path: '/tmp/story-delivery-' + viewport.width + '.png' });
    assert.deepEqual(errors, []);
    results.push({ viewport, initialChapterRequests: 0, visitedChapters: [...chapters], errors });
    await page.close();
  }
  const deepPage = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const deepRequests: string[] = [];
  deepPage.on('request', request => { const match = new URL(request.url()).pathname.match(/\/generated\/([^/]+)\.json$/); if(match && match[1] !== 'index' && !new URL(request.url()).searchParams.has('url')) deepRequests.push(match[1]); });
  await deepPage.route('**/__story-delivery**', async route => {
    const html = await server.transformIndexHtml('/__story-delivery', '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/' + fixture + '"></script>');
    await route.fulfill({contentType:'text/html',body:html});
  });
  await deepPage.goto('http://127.0.0.1:4193/__story-delivery?node=' + deepNode.id);
  await deepPage.locator('.story-stage').waitFor();
  assert.deepEqual(deepRequests, [deep.id], 'Cold direct node requests load its chapter only');
  results.push({ coldNode: deepNode.id, chapters: deepRequests });
  await deepPage.close();
  const retryPage = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await retryPage.route('**/__story-delivery**', async route => {
    const html = await server.transformIndexHtml('/__story-delivery', '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/' + fixture + '"></script>');
    await route.fulfill({contentType:'text/html',body:html});
  });
  let failRequests = 0;
  await retryPage.route('**/generated/' + first.id + '.json*', async route => { if (new URL(route.request().url()).searchParams.has('url')) return route.continue(); failRequests++; await route.abort('failed'); });
  await retryPage.goto('http://127.0.0.1:4193/__story-delivery?season=' + storySeasons[0].id);
  await retryPage.getByRole('button', {name:'Retry chapter', exact:true}).waitFor();
  await retryPage.unroute('**/generated/' + first.id + '.json*');
  await retryPage.getByRole('button', {name:'Retry chapter', exact:true}).click();
  const retryRecovered = await retryPage.locator('.story-atlas__terrain').waitFor({timeout:3000}).then(() => true, () => false);
  assert(retryRecovered, 'Retry must recover from an interrupted chapter request without reloading the app');
  if (!retryRecovered) {
    await retryPage.getByRole('button', {name:'Reload current story', exact:true}).click();
    await retryPage.locator('.story-atlas__terrain').waitFor();
  }
  results.push({ networkFailureRequests: failRequests, retryRecovered, reloadRecovery: !retryRecovered });
  await retryPage.close();
  const stalePage = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await stalePage.route('**/__story-delivery**', async route => {
    const html = await server.transformIndexHtml('/__story-delivery', '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/' + fixture + '"></script>');
    await route.fulfill({contentType:'text/html',body:html});
  });
  const staleArtifact = JSON.parse(await readFile('src/lib/story/generated/' + first.id + '.json', 'utf8'));
  staleArtifact.revision = 'old-cached-deployment';
  await stalePage.route('**/generated/' + first.id + '.json*', async route => {
    if (new URL(route.request().url()).searchParams.has('url')) return route.continue();
    await route.fulfill({contentType:'application/json',body:JSON.stringify(staleArtifact)});
  });
  await stalePage.goto('http://127.0.0.1:4193/__story-delivery?season=' + storySeasons[0].id);
  await stalePage.getByText('Story content changed. Reload to get the current chapter.', {exact:true}).waitFor();
  assert.equal(await stalePage.locator('.story-atlas__terrain').count(), 0, 'Stale artifact never renders');
  await stalePage.unroute('**/generated/' + first.id + '.json*');
  await stalePage.getByRole('button', {name:'Reload current story',exact:true}).click();
  await stalePage.locator('.story-atlas__terrain').waitFor();
  results.push({ staleArtifactRejected:true, reloadRecovery:true });
  await stalePage.close();

  const cancelPage = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await cancelPage.route('**/__story-delivery**', async route => {
    const html = await server.transformIndexHtml('/__story-delivery', '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/' + fixture + '"></script>');
    await route.fulfill({contentType:'text/html',body:html});
  });
  let markRequested!: () => void;
  const requested = new Promise<void>(resolve => { markRequested = resolve; });
  let releaseRequest!: () => void;
  const holdRequest = new Promise<void>(resolve => { releaseRequest = resolve; });
  await cancelPage.route('**/generated/' + first.id + '.json*', async route => {
    if (new URL(route.request().url()).searchParams.has('url')) return route.continue();
    markRequested(); await holdRequest; await route.continue();
  });
  await cancelPage.goto('http://127.0.0.1:4193/__story-delivery?season=' + storySeasons[0].id);
  await requested;
  await cancelPage.evaluate(() => { history.pushState({}, '', '/game/story'); dispatchEvent(new PopStateEvent('popstate')); });
  await cancelPage.getByTestId('region-story-theater').waitFor();
  const completedResponse = cancelPage.waitForResponse(response => new URL(response.url()).pathname.endsWith('/generated/' + first.id + '.json') && !new URL(response.url()).searchParams.has('url'));
  releaseRequest(); await completedResponse;
  await cancelPage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await cancelPage.getByTestId('region-story-theater').count(), 1, 'A completed obsolete request cannot replace the current route');
  assert.equal(await cancelPage.locator('.story-atlas__terrain').count(), 0);
  results.push({ navigationCancellationPreserved:true });
  await cancelPage.close();
  await writeFile('/tmp/story-delivery-browser.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser?.close();
  await server.close();
  await unlink(fixture);
}
