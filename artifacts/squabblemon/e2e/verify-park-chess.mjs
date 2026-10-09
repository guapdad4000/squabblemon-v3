import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
const origin = process.env.ARCADE_BASE_URL ?? "http://127.0.0.1:4298";
const out = process.env.REVIEW_OUTPUT ?? "/tmp/park-chess-proof";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? "/usr/bin/google-chrome", headless: true });
const results = [];
async function scene(page, query = "") {
  await page.goto(`${origin}/e2e/park-chess.fixture.html?reset=1&${query}`);
  await page.getByRole("grid", { name: "Chess board, White at bottom" }).waitFor();
}
const square = (page, name) => page.locator(`[data-square="${name}"]`);
async function play(page, from, to) { await square(page, from).click(); await square(page, to).click(); }
try {
  for (const [name, width, height] of [["small-phone", 320, 700], ["phone", 390, 844], ["tablet", 768, 1024], ["desktop", 1440, 960]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await scene(page, "tier=5");
    assert.equal(await page.locator('[role="gridcell"]').count(), 64);
    assert.equal(await page.locator('.park-chess__board .park-chess__piece').count(), 32);
    await page.getByRole("button", { name: "New match", exact: true }).click();
    await page.waitForFunction(() => window.__parkChess.run?.phase === "active");
    await page.locator('.park-chess__board .park-chess__piece-art img').first().waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('.park-chess__piece-art img')].every(img => img.complete && img.naturalWidth === 2172));
    assert.equal(await page.locator('.park-chess__piece-fallback').count(), 0);
    for (const [name, color] of [["e1", "White"], ["e8", "Black"]]) assert.equal(await square(page, name).getAttribute("aria-label"), `${name}, ${color} king, GUAP`);
    for (const [name, color] of [["d1", "White"], ["d8", "Black"]]) assert.equal(await square(page, name).getAttribute("aria-label"), `${name}, ${color} queen, Ashlee`);
    assert.match(await page.locator('.park-chess__player').first().innerText(), /Block Master/);
    const grid = await page.getByRole("grid").boundingBox();
    assert(grid.width >= 288, `board at ${width}px is ${grid.width}px`);
    assert(Math.abs(grid.width - grid.height) < 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await square(page, "e2").focus();
    await page.keyboard.press("ArrowUp");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("data-square")), "e3");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    assert.equal(await square(page, "e4").getAttribute("data-legal"), "true");
    assert.equal(await square(page, "e5").getAttribute("data-legal"), "false");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.__parkChess.run?.revision === 1);
    assert.equal(await square(page, "e4").getAttribute("aria-label"), "e4, White pawn");
    assert.equal(await page.evaluate(() => window.__parkChess.run.moves.length), 2);
    const before = await page.evaluate(() => window.__parkChess.run.fen);
    await page.reload();
    await page.getByRole("grid").waitFor();
    assert.equal(await page.evaluate(() => window.__parkChess.run.fen), before);
    await page.getByRole("button", { name: "How to play" }).click();
    await page.getByRole("dialog", { name: "Check the Block", exact: true }).waitFor();
    assert.equal(await page.getByText("GUAP · king", { exact: true }).count(), 1);
    assert.equal(await page.getByText("Ashlee · queen", { exact: true }).count(), 1);
    await page.getByRole("button", { name: "Close", exact: true }).click();
    assert.equal(await page.getByRole("button", { name: "How to play" }).evaluate(el => el === document.activeElement), true);
    await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
    assert.deepEqual(errors, []);
    results.push({ name, board: grid.width, passed: true });
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await scene(page, "scene=promotion");
  await play(page, "a7", "a8");
  await page.getByRole("dialog", { name: "Choose your promotion" }).waitFor();
  await page.setViewportSize({ width: 320, height: 700 });
  for (const crop of await page.locator('.park-chess__promotion .park-chess__piece').all()) {
    const bounds = await crop.boundingBox();
    assert(Math.abs(bounds.width - bounds.height) < 1, "promotion atlas cells stay square");
  }
  await page.screenshot({ path: `${out}/promotion-dialog.png`, fullPage: true });
  for (const name of ["queen", "rook", "bishop", "knight"]) assert.equal(await page.getByRole("button", { name, exact: true }).count(), 1);
  assert.equal(await page.getByRole("button", { name: "queen", exact: true }).getByText("Ashlee", { exact: true }).count(), 1);
  await page.getByRole("button", { name: "knight", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__parkChess.run.revision === 1);
  assert.match(await square(page, "a8").getAttribute("aria-label"), /White knight/);
  assert.equal(await page.evaluate(() => window.__parkChess.requests.at(-1).body.move.promotion), "n");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await scene(page, "scene=check");
  assert.equal(await square(page, "e1").getAttribute("data-check"), "true");
  assert.match(await page.locator('.park-chess__status').innerText(), /PROTECT YOUR LEADER/);
  await scene(page, "scene=capture");
  await play(page, "e4", "d5");
  await page.waitForFunction(() => window.__parkChess.run.revision === 1);
  assert.equal(await page.getByLabel("Pieces you captured").locator('[data-type="p"][data-color="b"]').count(), 1);
  results.push({ name: "promotion-keyboard-check-captures", passed: true });

  await scene(page, "retry=start");
  await page.getByRole("button", { name: "New match", exact: true }).click();
  await page.getByRole("button", { name: "Retry saved action" }).click();
  await page.waitForFunction(() => window.__parkChess.requests.length === 2 && document.querySelector('[data-square="e2"]').getAttribute('aria-disabled') === 'false');
  assert.deepEqual(await page.evaluate(() => window.__parkChess.requests.map(r => r.body)), await page.evaluate(() => [window.__parkChess.requests[0].body, window.__parkChess.requests[0].body]));
  await scene(page, "retry=move");
  await page.getByRole("button", { name: "New match", exact: true }).click();
  await play(page, "e2", "e4");
  await page.getByRole("alert").waitFor();
  assert.equal(await square(page, "e2").getAttribute("aria-disabled"), "true");
  assert.match(await square(page, "e2").getAttribute("aria-label"), /White pawn/);
  const pendingMatch = await page.evaluate(() => JSON.stringify(window.__parkChess.run));
  await page.getByRole("button", { name: "Learn chess", exact: true }).click();
  await page.getByRole("button", { name: "Start Move & Capture" }).click();
  await play(page, "e2", "e4");
  await page.getByRole("button", { name: "Next step", exact: true }).waitFor();
  await page.getByRole("button", { name: "Return to match", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Learn chess", exact: true }).evaluate(el => el === document.activeElement), true);
  assert.equal(await page.evaluate(() => JSON.stringify(window.__parkChess.run)), pendingMatch);
  assert.equal(await page.getByRole("button", { name: "Retry saved action" }).count(), 1);
  await page.getByRole("button", { name: "Retry saved action" }).click();
  await page.waitForFunction(() => document.querySelector('[data-square="e4"]').getAttribute('aria-label') === 'e4, White pawn');
  const retries = await page.evaluate(() => window.__parkChess.requests.slice(1));
  assert.deepEqual(retries[0], retries[1]);
  assert.equal(await page.evaluate(() => window.__parkChess.run.revision), 1);
  results.push({ name: "start-and-move-idempotent-retry", passed: true });

  await scene(page, "scene=mate&retry=move");
  await play(page, "g6", "g7");
  await page.getByRole("button", { name: "Retry saved action" }).click();
  await page.getByText("+1 PACK TICKET BANKED", { exact: true }).waitFor();
  await page.waitForFunction(() => window.__parkChess.bootstrapRefreshes === 1);
  assert.equal(await page.evaluate(() => window.__parkChess.banked), 1);
  assert.equal(await page.evaluate(() => window.__parkChess.campaign.tier), 2);
  assert.equal(await square(page, "g7").getAttribute("aria-disabled"), "true");
  await page.screenshot({ path: `${out}/checkmate-ticket.png`, fullPage: true });
  await page.getByRole("button", { name: "Play tier 2" }).click();
  await page.waitForFunction(() => window.__parkChess.run.tier === 2 && window.__parkChess.run.phase === 'active');
  await page.getByRole("button", { name: "Resign", exact: true }).click();
  await page.getByRole("dialog", { name: "Resign this match?" }).waitFor();
  assert.equal(await page.evaluate(() => window.__parkChess.run.phase), "active");
  await page.getByRole("button", { name: "Confirm resignation" }).click();
  await page.waitForFunction(() => window.__parkChess.run.phase === 'resigned');
  assert.equal(await page.evaluate(() => window.__parkChess.banked), 1);
  assert.equal(await page.evaluate(() => window.__parkChess.earned.packTickets), 0);
  results.push({ name: "saved-mate-one-ticket-next-tier-confirmed-resign", passed: true });

  await scene(page, "delay=5000");
  await page.getByRole("button", { name: "New match", exact: true }).click();
  await page.waitForFunction(() => window.__parkChess.requests.length === 1);
  assert.equal(await square(page, "e2").getAttribute("aria-disabled"), "true");
  await page.getByRole("button", { name: "Learn chess", exact: true }).click();
  await page.getByRole("button", { name: "Start Protect GUAP", exact: true }).click();
  assert.equal(await page.evaluate(() => window.__parkChess.aborted.length), 0, "entering lessons keeps the ranked save mounted");
  await page.evaluate(() => window.__parkChessUnmount());
  await page.waitForFunction(() => window.__parkChess.aborted.length === 1);
  assert.equal(await page.evaluate(() => window.__parkChess.requests.length), 1);
  results.push({ name: "pending-unmount-aborts-request", passed: true });
  await scene(page, "reduced=1");
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await page.locator('.park-chess').getAttribute('data-reduced-motion'), 'true');
  assert.equal(await page.locator('.park-chess__square').first().evaluate(el => getComputedStyle(el).animationName), 'none');
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "How to play" }).click();
  assert.equal(await page.getByRole("dialog").evaluate(el => getComputedStyle(el).animationName), 'none');
  results.push({ name: "profile-and-system-reduced-motion", passed: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await scene(page);
  await page.getByRole("button", { name: "New match", exact: true }).click();
  await page.waitForFunction(() => window.__parkChess.run?.phase === 'active');
  const beforeAcademy = await page.evaluate(() => { const { serverNow, ...saved } = window.__parkChess; return JSON.stringify(saved); });
  await page.getByRole("button", { name: "Learn chess", exact: true }).click();
  await page.getByRole("button", { name: "Chess for beginners", exact: true }).click();
  await page.getByRole("dialog", { name: "Chess for beginners" }).waitFor();
  assert.equal(await page.getByText("GUAP · king", { exact: true }).count(), 1);
  assert.equal(await page.getByText("Ashlee · queen", { exact: true }).count(), 1);
  for (const name of ["Check, checkmate & stalemate", "Castling", "Promotion", "En passant"]) assert.equal(await page.getByText(name, { exact: true }).count(), 1);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: "Chess for beginners", exact: true }).evaluate(el => el === document.activeElement), true);
  const lessons = await page.evaluate(() => window.__parkChessLessons);
  assert.equal(lessons.reduce((total, lesson) => total + lesson.steps.length, 0), 14);
  for (const lesson of lessons) {
    await page.getByRole("button", { name: `Start ${lesson.title}`, exact: true }).click();
    for (let i = 0; i < lesson.steps.length; i++) {
      assert.equal(await page.locator('.park-chess-academy').getAttribute('data-lesson-step'), String(i));
      const step = lesson.steps[i];
      if (i === 0) {
        await page.getByRole("button", { name: "Show hint", exact: true }).click();
        assert.equal(await square(page, step.expectedMove.from).getAttribute('data-hint'), 'true');
        assert.equal(await square(page, step.expectedMove.to).getAttribute('data-hint'), 'true');
      }
      await play(page, step.expectedMove.from, step.expectedMove.to);
      await page.waitForFunction(() => document.querySelector('.park-chess-academy')?.getAttribute('data-lesson-status') === 'success');
      assert.equal(await square(page, step.expectedMove.to).getAttribute('aria-disabled'), 'true');
      if (step.reply) assert.match(await page.locator('.park-chess__status').innerText(), /RIVAL REPLIED/);
      if (i < lesson.steps.length - 1) await page.getByRole("button", { name: "Next step", exact: true }).click();
    }
    assert.equal(await page.locator('.park-chess-academy').getAttribute('data-lesson-phase'), 'complete');
    await page.getByText('LESSON COMPLETE', { exact: true }).waitFor();
    await page.screenshot({ path: `${out}/lesson-${lesson.id}-complete.png`, fullPage: true });
    await page.getByRole("button", { name: "Replay lesson", exact: true }).click();
    assert.equal(await page.locator('.park-chess-academy').getAttribute('data-lesson-step'), '0');
    assert.equal(await page.locator('.park-chess-academy').getAttribute('data-lesson-status'), 'ready');
    await page.getByRole("button", { name: "Restart lesson", exact: true }).click();
    await page.getByRole("button", { name: "Choose lesson", exact: true }).click();
  }
  const afterAcademy = await page.evaluate(() => { const { serverNow, ...saved } = window.__parkChess; return JSON.stringify(saved); });
  assert.equal(afterAcademy, beforeAcademy, "lessons do not write API run, campaign, tickets or requests");
  await page.getByRole("button", { name: "Return to match", exact: true }).click();
  await page.getByRole("grid").waitFor();
  results.push({ name: "three-local-lessons-fourteen-steps-guide-replay-no-ranked-writes", passed: true });

  await page.getByRole("button", { name: "Learn chess", exact: true }).click();
  await page.getByRole("button", { name: "Start Move & Capture", exact: true }).click();
  await square(page, 'e2').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter'); // e3 is legal, but this guided task is the two-square e4 move.
  await page.getByRole('alert').waitFor();
  assert.equal(await page.locator('.park-chess-academy').getAttribute('data-lesson-status'), 'ready');
  assert.equal(await square(page, 'e2').getAttribute('data-hint'), 'true');
  await square(page, 'e2').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await page.getByRole("button", { name: "Next step", exact: true }).waitFor();
  await page.getByRole("button", { name: "Next step", exact: true }).click();
  await page.getByRole("button", { name: "Restart lesson", exact: true }).click();
  assert.equal(await page.locator('.park-chess-academy').getAttribute('data-lesson-step'), '0');
  results.push({ name: "guided-wrong-legal-move-hint-keyboard-correction-restart", passed: true });

  for (const mode of ['restore-delay=2500', 'restore-error=1']) {
    await page.goto(`${origin}/e2e/park-chess.fixture.html?reset=1&${mode}`);
    await page.getByRole("button", { name: "Learn chess", exact: true }).click();
    await page.getByRole("button", { name: "Start Move & Capture", exact: true }).click();
    await play(page, 'e2', 'e4');
    await page.getByRole("button", { name: "Next step", exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__parkChess.requests.length), 0);
    await page.getByRole("button", { name: "Return to match", exact: true }).click();
    if (mode.includes('error')) await page.getByText('Could not restore your table.', { exact: true }).waitFor();
    else await page.getByRole('grid').waitFor();
    assert.equal(await page.getByRole("button", { name: "Learn chess", exact: true }).count(), 1);
  }
  results.push({ name: "academy-during-loading-or-failed-match-restore", passed: true });
  await page.close();
  await writeFile(`${out}/report.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
