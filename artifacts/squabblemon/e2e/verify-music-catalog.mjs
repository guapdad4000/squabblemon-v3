import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:23293';
const originalTitle = 'Wax Killa Breaks';
const audioSelector = '[data-testid="background-music"]';
const browser = await chromium.launch();

function audioState(page) {
  return page.locator(audioSelector).evaluate(audio => ({
    currentTime: audio.currentTime,
    duration: audio.duration,
    paused: audio.paused,
    readyState: audio.readyState,
    src: audio.currentSrc,
  }));
}

async function openControls(page) {
  await page.getByRole('button', { name: 'Music controls', exact: true }).click();
  await page.getByRole('dialog', { name: 'The Fade Tapes' }).waitFor();
}

async function chooseTrack(page, title) {
  const select = page.getByRole('combobox', { name: 'Choose music track' });
  const option = select.locator('option').filter({ hasText: title });
  assert.equal(await option.count(), 1, `${title} appears once in the active queue`);
  await select.selectOption(await option.getAttribute('value'));
}

async function expectDecodedAndAdvancing(page, id) {
  await page.waitForFunction(({ selector, id }) => {
    const audio = document.querySelector(selector);
    return audio?.currentSrc.includes(id)
      && Number.isFinite(audio.duration)
      && audio.duration > 1
      && audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      && !audio.paused
      && audio.currentTime > 0.12;
  }, { selector: audioSelector, id }, { timeout: 20_000 });
  const before = await audioState(page);
  await page.waitForTimeout(250);
  const after = await audioState(page);
  assert.ok(after.currentTime > before.currentTime, `${id} playback clock advances`);
}

async function optionTitles(page) {
  return page.getByRole('combobox', { name: 'Choose music track' }).locator('option').allTextContents();
}

try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/e2e/reward-music.fixture.html#/game/online`);
  await page.locator(audioSelector).waitFor({ state: 'attached' });
  await openControls(page);

  let titles = await optionTitles(page);
  assert.equal(titles.length, 12, 'battle queue has six originals and six new battle tracks');
  assert.ok(titles.some(title => title.includes(originalTitle)));
  assert.ok(titles.some(title => title.includes('Battle Music')));

  await chooseTrack(page, originalTitle);
  await expectDecodedAndAdvancing(page, 'wax-killa-breaks');
  await page.getByRole('slider', { name: 'Music volume', exact: true }).fill('17');
  await page.getByRole('button', { name: 'Pause music', exact: true }).click();
  await chooseTrack(page, 'Battle Music');
  let media = await audioState(page);
  assert.equal(media.paused, true, 'selecting a new battle track preserves pause');
  assert.equal(await page.getByRole('slider', { name: 'Music volume', exact: true }).inputValue(), '17');
  assert.equal(await page.getByRole('combobox', { name: 'Choose music track' }).inputValue(), '0');
  await page.reload();
  await page.locator(audioSelector).waitFor({ state: 'attached' });
  await openControls(page);
  assert.equal((await audioState(page)).paused, true, 'pause survives a reload');
  assert.equal(await page.getByRole('slider', { name: 'Music volume', exact: true }).inputValue(), '17');
  assert.equal(await page.getByRole('combobox', { name: 'Choose music track' }).inputValue(), '0', 'battle selection survives a reload');
  await page.getByRole('button', { name: 'Play music', exact: true }).click();
  await expectDecodedAndAdvancing(page, 'battle-music');

  await page.getByRole('button', { name: 'Pause music', exact: true }).click();
  await page.getByRole('button', { name: 'Close music controls' }).click();
  await page.getByTestId('music-victory').click();
  await openControls(page);
  titles = await optionTitles(page);
  assert.equal(titles.length, 8, 'victory queue has six originals and two new win cues');
  assert.ok(titles.some(title => title.includes(originalTitle)));
  assert.ok(titles.some(title => title.includes('Squabblemon Win')));
  assert.ok(titles.some(title => title.includes('Win Music')));
  assert.equal(await page.getByRole('slider', { name: 'Music volume', exact: true }).inputValue(), '17');
  assert.equal((await audioState(page)).paused, true, 'victory transition preserves pause');

  await page.getByRole('button', { name: 'Close music controls' }).click();
  await page.getByTestId('music-defeat').click();
  await openControls(page);
  titles = await optionTitles(page);
  assert.equal(titles.length, 7, 'defeat queue has six originals and the new loss cue');
  assert.ok(titles.some(title => title.includes(originalTitle)));
  assert.ok(titles.some(title => title.includes('Squabblemon Loss')));
  await page.waitForFunction(() => document.querySelector('input[aria-label="Music volume"]')?.value === '17');
  assert.equal((await audioState(page)).paused, true, 'defeat transition preserves pause');
  assert.deepEqual(errors, []);
  console.log('PASS: Chromium decoded and advanced original/new battle audio; result queues and mode preferences persisted.');
  await page.close();
} finally {
  await browser.close();
}