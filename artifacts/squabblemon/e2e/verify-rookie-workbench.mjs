import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

// Real-click (and real-tap) proof that the rookie deck lesson's coach steps
// actually advance — especially the sixth slot, which is Rastamon for new crews.
const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:23307';
const browser = await chromium.launch();

async function playthrough(context, label, useTap) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/e2e/rookie-workbench.fixture.html');
  const spotlight = page.locator('[data-testid="fade-spotlight"]');
  await spotlight.waitFor({ timeout: 15_000 });

  const hit = async (step, expectNext) => {
    const target = await spotlight.getAttribute('data-coach-target');
    assert.ok(target, `${label}: coach lost its target at ${step}`);
    const title = await page.locator('.fade-tip h2').textContent().catch(() => '?');
    console.log(`${label} ${step}: ${target} — "${title}"`);
    const locator = page.locator(target).first();
    try {
      if (useTap) await locator.tap({ timeout: 4_000 });
      else await locator.click({ timeout: 4_000 });
    } catch (error) {
      throw new Error(`${label}: STUCK at ${step} — cannot hit ${target}: ${String(error.message).split('\n').slice(0, 8).join(' | ')}`);
    }
    const advanced = await page.waitForFunction(
      expected => document.querySelector('[data-testid="fade-spotlight"]')?.getAttribute('data-coach-target') === expected,
      expectNext, { timeout: 3_000 },
    ).then(() => true).catch(() => false);
    if (!advanced) throw new Error(`${label}: NO PROGRESS after hitting ${target} at ${step} — spotlight still on ${await spotlight.getAttribute('data-coach-target')}`);
    return target;
  };

  const slot = await hit('guideStep 0 (sixth slot)', null); // recruit selector is dynamic; assert below instead
  await page.reload(); // unreachable guard against accidental pass; replaced by explicit flow below
  await page.close();
  return slot;
}

async function flow(context, label, useTap) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/e2e/rookie-workbench.fixture.html');
  const spotlight = page.locator('[data-testid="fade-spotlight"]');
  await spotlight.waitFor({ timeout: 15_000 });

  // Step 0: the sixth slot must be Rastamon, and hitting it must move the coach on.
  let target = await spotlight.getAttribute('data-coach-target');
  assert.equal(target, '[data-guide-slot="5"]', `${label}: unexpected first coach target ${target}`);
  const slotName = await page.locator('[data-guide-slot="5"]').first().getAttribute('aria-label');
  console.log(`${label} step 0: ${target} (${slotName})`);
  assert.match(slotName ?? '', /Rastamon/i, `${label}: sixth slot should be Rastamon, got ${slotName}`);
  const act = async sel => (useTap ? page.locator(sel).first().tap({ timeout: 4_000 }) : page.locator(sel).first().click({ timeout: 4_000 }));
  const expectTarget = async (check, step) => {
    const ok = await page.waitForFunction(() => true, null, { timeout: 0 }).then(() => true); // placeholder replaced below
    return ok;
  };
  try { await act(target); } catch (error) {
    throw new Error(`${label}: STUCK at step 0 — cannot hit ${target}: ${String(error.message).split('\n').slice(0, 8).join(' | ')}`);
  }
  const step1 = await page.waitForFunction(
    () => document.querySelector('[data-testid="fade-spotlight"]')?.getAttribute('data-coach-target')?.startsWith('[data-guide-recruit='),
    null, { timeout: 3_000 },
  ).then(() => true).catch(() => false);
  if (!step1) throw new Error(`${label}: NO PROGRESS after hitting the Rastamon slot — coach still on ${await spotlight.getAttribute('data-coach-target')}`);

  // Step 1: tap the recruit the coach names.
  target = await spotlight.getAttribute('data-coach-target');
  console.log(`${label} step 1: ${target}`);
  try { await act(target); } catch (error) {
    throw new Error(`${label}: STUCK at step 1 — cannot hit ${target}: ${String(error.message).split('\n').slice(0, 8).join(' | ')}`);
  }
  const step2 = await page.waitForFunction(
    () => document.querySelector('[data-testid="fade-spotlight"]')?.getAttribute('data-coach-target') === '[data-guide-save="true"]',
    null, { timeout: 3_000 },
  ).then(() => true).catch(() => false);
  if (!step2) throw new Error(`${label}: NO PROGRESS after hitting the recruit — coach still on ${await spotlight.getAttribute('data-coach-target')}`);

  // Step 2: the save control must be genuinely hittable (trial run does not submit).
  target = await spotlight.getAttribute('data-coach-target');
  console.log(`${label} step 2: ${target}`);
  try {
    if (useTap) await page.locator(target).first().tap({ timeout: 4_000, trial: true });
    else await page.locator(target).first().click({ timeout: 4_000, trial: true });
  } catch (error) {
    throw new Error(`${label}: STUCK at step 2 — cannot hit ${target}: ${String(error.message).split('\n').slice(0, 8).join(' | ')}`);
  }
  assert.deepEqual(errors, [], `${label}: page errors`);
  console.log(`${label}: deck lesson fully clickable (Rastamon slot -> recruit -> save)`);
  await page.close();
}

try {
  await flow(await browser.newContext({ viewport: { width: 1440, height: 900 } }), 'desktop', false);
  await flow(await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), 'phone-touch', true);
  await flow(await browser.newContext({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true }), 'small-touch', true);
} finally {
  await browser.close();
}
console.log('Rookie deck lesson: every coach step is hittable and advances on mouse and touch.');
