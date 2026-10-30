import { expect, test } from '@playwright/test';

test('V2 collectible and inspector preserve Normal fist and unrelated Normal plate', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/squabblemon/e2e/anunaki-v2.fixture.html');
  const inanna=page.locator('[data-card-id="inanna"]'), cornball=page.locator('[data-card-id="cornball"]');
  await expect(inanna).toHaveAttribute('data-layered-card','true');
  await expect(inanna.locator('.layered-print img')).toHaveAttribute('src',/anunaki-plate\.webp/);
  await expect(inanna.locator('[data-anunaki-scene] img')).toHaveAttribute('src',/anunaki-temple\.webp/);
  await expect(inanna.locator('.layered-element img')).toHaveAttribute('src',/normal-fist\.webp/);
  await expect(cornball.locator('.layered-print img')).toHaveAttribute('src',/normal-plate\.webp/);
  await expect(cornball.locator('[data-anunaki-scene]')).toHaveCount(0);
  await expect(page.locator('[data-card-id="anu"]')).toHaveAttribute('data-card-rarity','Mythical');
  await expect(inanna).toHaveAttribute('data-card-rarity','Epic');
  await expect(page.locator('[data-card-id="utu"]')).toHaveAttribute('data-card-rarity','Legendary');
  await page.getByRole('button',{name:'Inspect Inanna'}).click();
  await expect(page.getByRole('dialog',{name:'Inanna card details'}).locator('[data-anunaki-scene]')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('every Anunaki inspector carries the scene down to its readable rules', async ({ page }) => {
  await page.goto('/squabblemon/e2e/anunaki-v2.fixture.html');
  const cards = page.locator('main [data-anunaki-scene]');
  await expect(cards).toHaveCount(10);
  const inspectButtons = page.locator('main button');
  for (let index = 0; index < 10; index++) {
    await inspectButtons.nth(index).click();
    const dialog = page.getByRole('dialog');
    const hero = dialog.locator('.polaroid__photo .collector-card');
    await expect(hero.locator('[data-anunaki-scene]')).toHaveCount(1);
    const geometry = await hero.evaluate(card => {
      const scene = card.querySelector<HTMLElement>('.layered-anunaki-scene')!.getBoundingClientRect();
      const rules = card.querySelector<HTMLElement>('.layered-rules')!.getBoundingClientRect();
      const text = card.querySelector<HTMLElement>('.layered-rules p')!;
      return { sceneBottom: scene.bottom, rulesTop: rules.top, clipped: text.scrollHeight > text.clientHeight + 1 };
    });
    expect(geometry.sceneBottom).toBeGreaterThan(geometry.rulesTop);
    expect(geometry.clipped).toBe(false);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('six tablet artwork previews keep the collectible finish and never enter battle', async ({ page }) => {
  await page.goto('/squabblemon/e2e/anunaki-v2.fixture.html');
  const fighters = [
    ['anu', 'Anu'], ['caucus-mountaineer', 'Caucus Mountaineer'],
    ['enlil', 'Enlil'], ['ereshkigal', 'Ereshkigal'], ['inanna', 'Inanna'], ['utu', 'Utu'],
  ];
  for (const [id, name] of fighters) {
    await page.getByRole('button', { name: `Inspect ${name}`, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: `${name} card details` });
    const image = dialog.locator('.polaroid__photo img.collector-portrait');
    await expect(image).toHaveAttribute('src', new RegExp(`/characters/${id}\\.webp`));
    await dialog.getByRole('button', { name: 'Tablet art', exact: true }).click();
    await expect(image).toHaveAttribute('src', new RegExp(`/characters/tablet-previews/${id}\\.webp`));
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(dialog.locator('.layered-rarity-rim')).toHaveCount(1);
    await expect(dialog.locator('.layered-reflection')).toHaveCount(1);
    await expect(dialog.getByText(/artwork preview only/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Original art', exact: true }).click();
    await expect(image).toHaveAttribute('src', new RegExp(`/characters/${id}\\.webp`));
    await dialog.getByRole('button', { name: 'Close card details' }).click();
  }
  await page.getByRole('button', { name: 'Battle', exact: true }).click();
  await expect(page.locator('img[src*="/tablet-previews/"]')).toHaveCount(0);
});

test('V2 combat omits collectible layers while showing tablet consumption', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/squabblemon/e2e/anunaki-v2.fixture.html?consume');
  await page.getByRole('button',{name:'Battle',exact:true}).click();
  await expect(page.getByTestId('tablet-consume-0')).toBeAttached();
  const card=page.locator('[data-card-id="inanna"]');
  await expect(card).toBeVisible();
  await expect(card.locator('[data-anunaki-scene]')).toHaveCount(0);
  await expect(card).not.toHaveAttribute('data-layered-card','true');
  expect(errors).toEqual([]);
});


test('tablet and crowded fighter summons remain separate and inspectable', async ({ page }) => {
  await page.goto('/squabblemon/e2e/anunaki-v2.fixture.html?crowded');
  await page.getByRole('button', { name: 'Battle', exact: true }).click();
  const zone = page.getByTestId('lane-0-player-zone');
  const cards = zone.locator('.battle-formation-stack > .battle-board-card');
  await expect(cards).toHaveCount(8);
  const tablet = page.getByTestId('lane-container-0').getByTestId('ancient-tablet-badge');
  await expect(tablet).toBeVisible();
  const overlap = await tablet.evaluate(element => {
    const item = element.getBoundingClientRect();
    const stack = element.closest('.district-lane')!.querySelector('.battle-side-player .battle-formation-stack')!.getBoundingClientRect();
    return item.right > stack.left && item.left < stack.right && item.bottom > stack.top && item.top < stack.bottom;
  });
  expect(overlap).toBe(false);
  await zone.getByRole('button', { name: /Inspect all 8 cards/ }).click();
  const district = page.getByRole('dialog', { name: /district view/i });
  const crew = district.getByRole('region', { name: 'Your fighters' });
  await expect(crew.locator('.district-fighter')).toHaveCount(8);
  await expect(crew.locator('[data-card-kind="token"]')).toHaveCount(4);
  for (const fighter of await crew.locator('.district-fighter').all()) {
    const button = fighter.locator('button').first();
    await expect(button).toBeEnabled();
    await button.click();
    const inspector = page.locator('.card-inspector-shell');
    await expect(inspector).toBeVisible();
    await inspector.getByRole('button', { name: 'Close card details' }).click();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
