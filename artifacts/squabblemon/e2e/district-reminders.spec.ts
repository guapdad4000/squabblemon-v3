import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DISTRICT_CATALOG } from '@workspace/squabblemon-engine/districts';

const output = resolve(import.meta.dirname, '../../deliverables/district-reminders/screenshots');
mkdirSync(output, { recursive: true });
const fixture = '/squabblemon/e2e/battle-mobile.fixture.html';

async function ready(page: Page) {
  await expect(page.getByTestId('district-rule-0')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.locator('.battle-board-card img.collector-portrait').evaluateAll(images =>
    images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
}
async function geometry(page: Page) {
  return page.locator('.district-target').evaluateAll(nodes => nodes.map(node => {
    const rect = node.getBoundingClientRect();
    const marker = node.querySelector('.district-marker')!.getBoundingClientRect();
    const rule = node.querySelector('.district-rule') as HTMLElement;
    return { height: rect.height, width: rect.width, markerTop: marker.top - rect.top,
      markerBottom: marker.bottom - rect.bottom, ruleHeight: rule.offsetHeight,
      ruleScrollHeight: rule.scrollHeight };
  }));
}

for (const [name, width, height] of [
  ['mobile', 390, 844], ['short-phone', 320, 640], ['desktop', 1440, 1000],
  ['ipad-portrait', 820, 1180], ['ipad-landscape', 1180, 820], ['phone-landscape', 844, 390],
] as const) {
  test(`${name}: reminders stay bounded through selection and the full popup stays intact`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(fixture); await ready(page);
    for (const [lane, text] of ['Fire + Dark cards gain +2 Hands.', 'Disruption cards gain +2 Hands.', 'Electric cards gain +3 Hands.'].entries()) {
      await expect(page.getByTestId(`district-rule-${lane}`)).toHaveText(text);
    }
    const before = await geometry(page);
    for (const lane of before) expect(lane.ruleHeight).toBeLessThanOrEqual(36);
    await page.screenshot({ path: `${output}/${name}-board.png` });
    await page.locator('.battle-hand-card').first().click();
    await page.getByTestId('lane-0').click();
    await expect(page.getByTestId('preview-lane-0')).toBeVisible();
    const after = await geometry(page);
    if (width <= 600) {
      expect(after.map(lane => lane.height)).toEqual(before.map(lane => lane.height));
      for (const lane of after) {
        expect(lane.markerTop).toBeGreaterThanOrEqual(-1);
        expect(lane.markerBottom).toBeLessThanOrEqual(1);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `${output}/${name}-selected.png` });
    await page.getByTestId('district-details-0').click();
    const popup = page.getByRole('dialog', { name: 'THE TOWN district view' });
    await expect(popup).toBeVisible();
    await expect(popup.getByTestId('location-rule').locator('p')).toHaveText('Fire + Dark cards gain +2 Hands.');
    await expect(popup.getByTestId('location-description')).toBeVisible();
    await expect(popup.getByTestId('location-strategy')).toBeVisible();
    await expect(popup.getByRole('navigation', { name: 'District scores' })).toHaveCount(0);
    if (name === 'mobile') await page.screenshot({ path: `${output}/mobile-district-popup.png` });
    await popup.getByRole('button', { name: 'Back to board' }).click();
    await expect(page.getByTestId('district-rule-0')).toBeVisible();
    expect(errors).toEqual([]);
  });
}

for (let index = 0; index < DISTRICT_CATALOG.length; index += 3) {
  const districts = DISTRICT_CATALOG.slice(index, index + 3);
  test(`short phone: ${districts.map(district => district.name).join(', ')} reminders fit and popup keeps full rules`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${fixture}?locations=${districts.map(district => district.id).join(',')}`); await ready(page);
    for (const lane of await geometry(page)) {
      expect(lane.ruleHeight).toBe(36);
      expect(lane.ruleScrollHeight).toBeLessThanOrEqual(36);
    }
    for (const [lane, district] of districts.entries()) {
      await page.getByTestId(`district-details-${lane}`).click();
      const popup = page.getByRole('dialog'); await expect(popup).toBeVisible();
      await expect(popup.getByTestId('location-rule').locator('p')).toHaveText(district.rule);
      await popup.getByRole('button', { name: 'Back to board' }).click();
    }
    expect(errors).toEqual([]);
  });
}

test('PvP uses compact reminders and modified issued rules never receive a stale summary', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${fixture}?pvp&locations=bodega,pirate-radio,construction-site`); await ready(page);
  await expect(page.getByTestId('district-rule-0')).toHaveText('First play: −1 Motion (min 1).');
  await expect(page.getByTestId('district-rule-1')).toHaveText('Exactly 2 allies: +3 Hands in other lanes.');
  await page.screenshot({ path: `${output}/mobile-pvp-locations.png` });
  const issued = 'Issued match: the first play costs 2 less Motion, minimum 1.';
  const fallback = await page.evaluate(async rule => {
    const module = await import(/* @vite-ignore */ '/squabblemon/src/districtRuleSummary.ts');
    return module.getDistrictRuleSummary({ id: 'bodega', rule });
  }, issued);
  expect(fallback).toBe(issued);
});
