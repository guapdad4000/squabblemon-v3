import assert from 'node:assert/strict';
import { chromium, type Page } from '@playwright/test';
import { getStorySeasonForChapter, storyContent, storyDialogueToken, type StoryChapter } from '@workspace/squabblemon-engine/story';

// Run against the mounted Story and RewardReveal components, not a reimplementation
// of their prize mapping. One scene delivery per chapter keeps the release pass
// bounded while the panel loads every stop (including battle-only card awards).
const origin = process.env.UI_ORIGIN ?? 'http://localhost:80';
assert(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname), 'Story fixture must be local');
const viewports = [
  { name: 'phone', width: 375, height: 568 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

async function checkArt(page: Page, selector: string, backgroundAsset?: string) {
  const problems = await page.locator(selector).evaluate(async (root, expected) => {
    const failures: string[] = [];
    const helpers = {
      within(parent: Element, child: Element) {
        const p = parent.getBoundingClientRect(), c = child.getBoundingClientRect();
        return p.width > 0 && p.height > 0 && c.width > 0 && c.height > 0
          && c.left >= p.left - 1 && c.top >= p.top - 1 && c.right <= p.right + 1 && c.bottom <= p.bottom + 1;
      },
      async load(image: HTMLImageElement, label: string) {
        try { await image.decode(); }
        catch (error) { failures.push(`${label}: ${image.currentSrc || image.src} (${error})`); }
        if (!image.complete || !image.naturalWidth || !image.naturalHeight)
          failures.push(`${label}: missing image ${image.currentSrc || image.src}`);
      },
    };
    if (expected) {
      const background = getComputedStyle(root).backgroundImage;
      const url = [...background.matchAll(/url\(["']?([^"')]+)["']?\)/g)].at(-1)?.[1];
      if (!url || !new URL(url, location.href).pathname.endsWith(`/${expected}`))
        failures.push(`background: expected ${expected}, found ${background}`);
      else {
        const image = new Image();
        image.src = url;
        await helpers.load(image, 'background');
      }
    }
    const images = [...root.querySelectorAll('img')];
    for (const image of images) await helpers.load(image, 'art');
    for (const icon of root.querySelectorAll('.story-prize__icon, .reward-reveal__story-item-art')) {
      const artwork = [...icon.querySelectorAll('img, svg')];
      if (!artwork.length) failures.push('prize icon has no artwork');
      for (const item of artwork) if (!helpers.within(icon, item)) {
        const p = icon.getBoundingClientRect(), c = item.getBoundingClientRect();
        failures.push(`prize artwork exceeds icon: ${item instanceof HTMLImageElement ? item.currentSrc : item.tagName} icon=${JSON.stringify({x:p.x,y:p.y,w:p.width,h:p.height})} art=${JSON.stringify({x:c.x,y:c.y,w:c.width,h:c.height})}`);
      }
    }
    return failures;
  }, backgroundAsset);
  assert.deepEqual(problems, [], `${selector}: ${problems.join('; ')}`);
}

async function checkChapter(page: Page, chapter: StoryChapter, viewport: typeof viewports[number], screenshots: Set<string>) {
  const season = getStorySeasonForChapter(chapter.id);
  assert(season, `Exported chapter ${chapter.id} needs a season route`);
  const scenes = chapter.nodes.filter(node => node.kind !== 'battle' && !node.puzzle && node.rewards.length);
  assert(scenes.length, `${chapter.id} needs a deliverable scene to check its receipt`);
  const scene = scenes.find(node => node.rewards.some(reward => reward.kind === 'card' || reward.kind === 'character-unlock')) ?? scenes.at(-1)!;
  assert(scene.kind !== 'battle');
  const progress = chapter.nodes.map((node, index) => ({
    nodeId: node.id, chapterId: chapter.id, title: node.title, kind: node.kind, optional: node.optional,
    mapPosition: node.mapPosition, prerequisites: node.prerequisites,
    status: index === 0 && node.id !== scene.id ? 'cleared' : index === chapter.nodes.length - 1 && node.id !== scene.id ? 'locked' : 'available',
    cleared: index === 0 && node.id !== scene.id, stars: 0,
    dialogueSeen: node.id === scene.id ? scene.scenes.map((_, i) => storyDialogueToken(node.id, 'main', i)) : [],
  }));
  const campaign = {
    chapters: [{ id: chapter.id, title: chapter.title, status: 'available', order: chapter.order, mapAssetId: chapter.mapAssetId }],
    nodes: progress, recommendedNodeId: scene.id,
  };
  const issued = scene.rewards.map((reward, index) => ({
    ...reward, rewardKey: reward.claimKey ?? `${scene.id}:${index}:${reward.kind}:${reward.id}`,
    duplicateShards: 0, description: `+${reward.amount} ${reward.id}`,
  }));
  const clout = issued.filter(reward => reward.kind === 'currency' && reward.id === 'clout')
    .reduce((total, reward) => total + reward.amount, 0);
  const profile = { id: 'story-art-check', softCurrency: 500 + clout, packTickets: 10 };
  let completed = 0;
  await page.route('**/api/player/story**', route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: campaign });
    assert.equal(route.request().method(), 'POST');
    assert(route.request().url().includes(scene.id), `Delivered wrong scene in ${chapter.id}`);
    assert(route.request().postDataJSON().idempotencyKey);
    completed++;
    return route.fulfill({ json: { campaign, rewards: issued, alreadyCompleted: false, bootstrap: { profile } } });
  });
  try {
    await page.goto(`${origin}/e2e/story-reward-recovery.fixture.html?season=${season.id}&panel=1`);
    await page.getByRole('heading', { name: chapter.title, exact: true }).waitFor();
    await page.getByTestId('button-open-chapter-rewards').click();
    const panel = page.getByRole('dialog', { name: 'Chapter rewards' });
    await panel.waitFor();
    assert.equal(await panel.locator('.story-award-stop').count(), chapter.nodes.length, `${chapter.id}: every stop must render`);
    await checkArt(page, '.story-awards-hero', chapter.mapAssetId);
    for (const node of chapter.nodes) {
      const stop = page.getByTestId(`story-reward-stop-${node.id}`);
      await stop.scrollIntoViewIfNeeded();
      assert.equal(await stop.locator('.story-prize__icon').count(), node.rewards.length, `${chapter.id}/${node.id}: every reward must render`);
      const portrait = node.kind === 'battle' ? node.encounter.enemy.portraitAssetId : node.scenes.at(-1)?.portraitAssetId;
      if (portrait) assert((await stop.locator('.story-award-stop__art img').getAttribute('src'))?.includes(`/${portrait}`),
        `${chapter.id}/${node.id}: stop portrait must be mounted`);
      await checkArt(page, `[data-testid="story-reward-stop-${node.id}"] .story-award-stop__art`, node.cinematic.environmentAssetId);
      await checkArt(page, `[data-testid="story-reward-stop-${node.id}"] .story-award-stop__prizes`);
    }
    const snapshot = `${season.id}-${viewport.name}`;
    if (!screenshots.has(snapshot)) {
      screenshots.add(snapshot);
      await panel.locator('.story-atlas__rewards-panel__body').evaluate(element => { element.scrollTop = 0; });
      await page.screenshot({ path: `/tmp/story-rewards-${snapshot}.png` });
    }
    await page.goto(`${origin}/e2e/story-reward-recovery.fixture.html?node=${scene.id}`);
    const completion = page.locator('.story-complete-scene');
    await completion.waitFor();
    const completionPortrait = scene.scenes.at(-1)?.portraitAssetId;
    if (completionPortrait) {
      assert((await completion.locator('.story-complete-scene__character').getAttribute('src'))?.includes(`/${completionPortrait}`),
        `${chapter.id}/${scene.id}: completion portrait must use the delivered last speaker`);
      if (completionPortrait === 'assets/characters/player.webp') {
        assert.equal(await completion.locator('.story-complete-scene__character').getAttribute('data-story-player'), 'true',
          'Player completion artwork must receive the high-contrast backdrop');
        await page.screenshot({ path: `/tmp/story-player-completion-${viewport.name}.png` });
      }
    }
    await checkArt(page, '.story-complete-scene', scene.cinematic.environmentAssetId);
    await page.getByTestId('button-collect-story-rewards').click();
    const receipt = page.locator('dialog[open].reward-reveal--story');
    await receipt.waitFor();
    assert.equal(completed, 1, `${chapter.id}: scene must actually deliver a reward`);
    assert.equal(await receipt.locator('.reward-reveal__story-item').count(), issued.length);
    assert((await receipt.locator('.reward-reveal__story-backdrop').getAttribute('src'))?.endsWith(`/${chapter.mapAssetId}`));
    const portrait = scene.scenes.at(-1)?.portraitAssetId;
    if (portrait) assert((await receipt.locator('.reward-reveal__story-portrait').getAttribute('src'))?.includes(`/${portrait}`),
      `${chapter.id}/${scene.id}: receipt portrait must be mounted`);
    await checkArt(page, 'dialog[open].reward-reveal--story .reward-reveal__story-hero');
    if (portrait === 'assets/characters/player.webp') {
      assert.equal(await receipt.locator('.reward-reveal__story-portrait').getAttribute('data-story-player'), 'true',
        'Player receipt artwork must receive the high-contrast backdrop');
      await page.screenshot({ path: `/tmp/story-player-receipt-${viewport.name}.png` });
    }
    if (screenshots.has(snapshot) && !screenshots.has(`${snapshot}-receipt`)) {
      screenshots.add(`${snapshot}-receipt`);
      await page.screenshot({ path: `/tmp/story-receipt-${snapshot}.png` });
    }
    for (let index = 0; index < issued.length; index++) {
      const item = receipt.locator('.reward-reveal__story-item').nth(index);
      await item.scrollIntoViewIfNeeded();
      await checkArt(page, `dialog[open].reward-reveal--story .reward-reveal__story-item:nth-child(${index + 1})`);
      assert.equal(await item.locator('.reward-reveal__story-item-art').count(), 1, `${chapter.id}/${scene.id}: missing prize icon`);
      const expectedImage = issued[index].kind === 'card' || issued[index].kind === 'character-unlock';
      assert.equal(await item.locator('.reward-reveal__story-item-art > img').count(), Number(expectedImage),
        `${chapter.id}/${scene.id}: ${issued[index].kind} artwork`);
      const expectedGlyph = issued[index].kind === 'pack-ticket' ? 'fight-ticket'
        : issued[index].kind === 'currency' && issued[index].id === 'clout' ? 'clout-token' : null;
      if (expectedGlyph) assert((await item.locator('.reward-reveal__story-item-art .game-glyph img').getAttribute('src'))?.includes(`/assets/rewards/${expectedGlyph}.webp`),
        `${chapter.id}/${scene.id}: expected ${expectedGlyph} artwork`);
    }
    const footer = await receipt.locator('.reward-reveal__story-footer button').boundingBox();
    assert(footer && footer.y >= 0 && footer.y + footer.height <= viewport.height + 1,
      `${chapter.id}: receipt dismissal must remain on screen`);
    await receipt.getByRole('button', { name: 'Keep going' }).click();
    assert.equal(await page.locator('dialog[open]').count(), 0);
  } finally {
    await page.unrouteAll();
  }
}

const browser = await chromium.launch();
try {
  const screenshotSeasons = new Set<string>();
  const errors: string[] = [];
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    page.setDefaultTimeout(12_000);
    page.on('pageerror', error => errors.push(`${viewport.name}: ${error.message}`));
    try {
      for (const chapter of storyContent.chapters) {
        try { await checkChapter(page, chapter, viewport, screenshotSeasons); }
        catch (error) { throw new Error(`${viewport.name} / ${chapter.id}: ${error}`, { cause: error }); }
      }
    } finally { await page.close(); }
  }
  assert.deepEqual(errors, [], 'No chapter may throw a browser error');
  console.log(`Story reward art: ${storyContent.chapters.length} exported chapters × ${viewports.length} viewports; every stop, backdrop, portrait, prize icon and delivered scene receipt decoded and measured.`);
} finally { await browser.close(); }