import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = process.env.ONLINE_ORIGIN ?? "http://127.0.0.1:4196";
const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH ?? "/usr/bin/google-chrome", headless: true });
const errors = [];


const contexts = [],
  pages = [];
try {
  for (const [index, seat] of ["a", "b"].entries()) {
    const context = await browser.newContext({
      viewport: index
        ? { width: 390, height: 844 }
        : { width: 1280, height: 900 },
      reducedMotion: "reduce",
      ...(index ? { isMobile: true, hasTouch: true } : {}),
    });
    await context.addCookies([
      { name: "online_test_seat", value: seat, url: origin },
    ]);
    await context.addInitScript(() =>
      localStorage.setItem("squabblemon_e2e_user", "signed-in"),
    );
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    contexts.push(context);
    pages.push(page);
    await page.goto(`${origin}/game/online?tab=friends`);
    await page.getByRole("button", { name: "Create friend fade" }).waitFor();
  }
  const [a, b] = pages;
  await b.screenshot({
    path: "screenshots/online-lobby-phone.png",
    fullPage: true,
  });
  await a.getByRole("button", { name: "Create friend fade" }).click();
  const code = await a.getByTestId("online-room-code").innerText();
  assert.match(code, /^[A-F0-9]{12}$/);
  await b.goto(`${origin}/game/online/${code}`);
  await b.getByRole("button", { name: "Join your friend" }).click();
  await b.getByTestId("online-room").waitFor();
  await Promise.all(
    pages.map((p) =>
      p.waitForFunction(
        () => !document.querySelector('[data-testid="online-ready"]')?.disabled,
      ),
    ),
  );
  await Promise.all(pages.map((p) => p.getByTestId("online-ready").click()));
  await Promise.all(pages.map((p) => p.getByTestId("online-battle").waitFor()));
  for (const page of pages) {
    await page.getByRole('button', { name: 'Choose a reaction' }).waitFor();
    assert.equal(await page.locator('.pvp-level').count(), 2);
  }
  await a.getByRole('button', { name: 'Choose a reaction' }).click();
  await a.waitForFunction(() => !document.querySelector('[aria-label="Send Big W"]')?.disabled);
  await a.locator('.pvp-reaction-collection select').selectOption('reaction-pack:dr-fade:v1');
  assert(await a.getByRole('button', { name: 'Send Dr. Fade — Laugh', exact: true }).isDisabled());
  await a.locator('.pvp-reaction-collection select').selectOption('starters');
  await a.screenshot({ path: 'screenshots/reactions-desktop.png' });
  await a.getByRole('button', { name: 'Send Big W', exact: true }).click();
  await b.locator('.pvp-reaction-bubble--rival').waitFor();
  await b.getByRole('button', { name: 'Choose a reaction' }).click();
  await b.screenshot({ path: 'screenshots/reactions-phone.png' });
  await b.getByRole('checkbox', { name: 'Hide opponent reactions' }).check();
  assert.equal(await b.locator('.pvp-reaction-bubble--rival').count(), 0);
  await b.getByRole('button', { name: "Send Let's go", exact: true }).click();
  await a.locator('.pvp-reaction-bubble--rival').waitFor();
  await a.locator('.pvp-reaction-bubble--rival').waitFor({ state: 'detached', timeout: 8000 });
  await a.goto(origin + '/game/shop?view=reactions');
  await a.getByRole('heading', { name: 'Block Talk', exact: true }).waitFor();
  await a.screenshot({ path: 'screenshots/reactions-shop.png', fullPage: true });
  assert.equal(await a.locator('.reaction-shop-grid article').count(), 16);
  await a.getByRole('button', { name: 'Unlock Dr. Fade Reactions · 400 Clout', exact: true }).click();
  await a.getByRole('button', { name: 'Collected', exact: true }).waitFor();
  await a.reload();
  await a.getByRole('button', { name: 'Collected', exact: true }).waitFor();
  assert.match(await a.locator('.reaction-shop header').innerText(), /6 \/ 16 collected · 200 Clout/);
  await a.goto(origin + '/game/online/' + code);
  await a.getByRole('button', { name: 'Choose a reaction' }).click();
  await a.locator('.pvp-reaction-collection select').selectOption('reaction-pack:dr-fade:v1');
  await a.getByRole('button', { name: 'Send Dr. Fade — Laugh', exact: true }).click();
  await a.locator('.pvp-reaction-bubble--you img[alt="Dr. Fade — Laugh"]').waitFor();
  for (const page of pages) assert.equal(await page.locator('vite-error-overlay').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: both levels, owned picker, rival delivery, mute, expiry, desktop, phone, and shop');
} finally { await browser.close(); }
