// Run against e2e/online-server.ts with HOMIES_E2E=ONLINE_E2E=1 and
// a disposable, loopback, native PostgreSQL DATABASE_URL. Never use mocks here.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = process.env.ONLINE_ORIGIN ?? "http://127.0.0.1:4196";
assert.equal(new URL(origin).hostname === "localhost" || new URL(origin).hostname === "127.0.0.1", true);
if (process.env.HOMIES_E2E !== "1") throw new Error("HOMIES_E2E=1 is required");
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}),
});
const contexts = [], pages = [], errors = [];
async function api(context, method, path, body, expected = 200) {
  const response = await context.request.fetch(`${origin}/api${path}`, {
    method,
    ...(body === undefined ? {} : { data: body }),
  });
  const data = await response.json();
  assert.equal(response.status(), expected, `${method} ${path}: ${JSON.stringify(data)}`);
  if (path.startsWith("/social")) assert.match(response.headers()["cache-control"] ?? "", /private.*no-store/);
  return data;
}
const social = index => api(contexts[index], "GET", "/social");
async function searchOnScreen(page, query) {
  await page.getByTestId("tab-fb-find").click();
  await page.getByTestId("input-search").fill(query);
  await page.getByTestId("button-search").click();
  await page.getByTestId("list-search").waitFor();
  return page.getByTestId("list-search");
}
async function assertPortraitAndName(row, name) {
  await row.waitFor();
  assert.equal(await row.locator(".sq-row__name").innerText(), name);
  await row.locator(".sq-row__portrait img").waitFor();
  assert.equal(await row.locator(".sq-row__portrait img").count(), 1);
}
async function waitForState(index, predicate, label) {
  for (let tries = 0; tries < 30; tries++) {
    const state = await social(index);
    if (predicate(state)) return state;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${label} in seat ${index}`);
}
try {
  for (const [index, seat] of ["a", "b", "c"].entries()) {
    const context = await browser.newContext({ viewport: index ? { width: 390, height: 844 } : { width: 1440, height: 900 }, reducedMotion: "reduce" });
    await context.addCookies([{ name: "online_test_seat", value: seat, url: origin }]);
    await context.addInitScript(() => localStorage.setItem("squabblemon_e2e_user", "signed-in"));
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(`${seat}: ${error.message}`));
    contexts.push(context); pages.push(page);
  }
  const [a, b, c] = pages;
  await a.goto(`${origin}/game/settings#homies`);
  await b.goto(`${origin}/game/settings#homies`);
  // Neither account has customized a username. Search by the public names
  // first; a search must discover even profiles without social identity rows.
  const bInitialResults = await searchOnScreen(b, "Vic");
  await assertPortraitAndName(bInitialResults.locator("li").filter({ hasText: "Vicky" }), "Vicky");
  const aInitialResults = await searchOnScreen(a, "The Riv");
  await assertPortraitAndName(aInitialResults.locator("li").filter({ hasText: "The Rival" }), "The Rival");
  const aState = await social(0), bState = await social(1);
  assert.match(aState.self.friendCode, /^[A-F0-9]{12}$/);
  assert.match(bState.self.friendCode, /^[A-F0-9]{12}$/);
  assert.notEqual(aState.self.friendCode, bState.self.friendCode);
  assert.deepEqual(aState.homies, []);
  assert.deepEqual(bState.homies, []);
  assert.deepEqual(Object.keys(aState.self).sort(), ["avatarKey", "displayName", "friendCode", "lastActiveAt", "username"]);
  assert.match(aState.self.username, /^[a-z0-9_]{3,24}$/);
  assert.match(bState.self.username, /^[a-z0-9_]{3,24}$/);
  await assertPortraitAndName(bInitialResults.getByTestId(`row-found-${aState.self.username}`), "Vicky");
  await assertPortraitAndName(aInitialResults.getByTestId(`row-found-${bState.self.username}`), "The Rival");
  await b.screenshot({ path: "screenshots/homies-discovery-before.png" });

  // Change the actual account handle through its visible profile editor.
  await a.getByTestId("button-edit-username").click();
  await a.getByTestId("input-username").fill("vicky_reborn");
  await a.getByRole("button", { name: "Save", exact: true }).click();
  await a.getByTestId("text-username").getByText("@vicky_reborn").waitFor();
  assert.equal((await social(0)).self.username, "vicky_reborn");
  await b.goto(`${origin}/game/settings?friend=${aState.self.friendCode}#homies`);
  await b.getByTestId("card-lookup").waitFor();
  assert.match(await b.getByTestId("card-lookup").innerText(), /Vicky/);
  assert.equal((await social(0)).incomingRequests.length, 0, "shared link cannot automatically send a request");
  assert.equal((await social(1)).outgoingRequests.length, 0);
  const lookup = await api(contexts[1], "GET", `/social/lookup/${aState.self.friendCode.toLowerCase()}`);
  assert.equal(lookup.relationship, "none");
  assert.equal(lookup.player.friendCode, aState.self.friendCode);
  assert.deepEqual(Object.keys(lookup.player).sort(), ["avatarKey", "displayName", "friendCode", "lastActiveAt", "username"]);
  assert.equal(lookup.requestId, null);
  assert.match(await b.getByTestId("card-lookup").innerText(), /@vicky_reborn\b/);
  const bUpdatedResults = await searchOnScreen(b, "@VICKY_REB");
  const found = bUpdatedResults.getByTestId("row-found-vicky_reborn");
  await assertPortraitAndName(found, "Vicky");
  assert.match(await found.innerText(), /@vicky_reborn\b/);
  await b.screenshot({ path: "screenshots/homies-discovery-after.png" });
  await found.getByTestId("button-add-vicky_reborn").click();
  const sent = await waitForState(1, state => state.outgoingRequests.length === 1, "sent request");
  assert.equal(sent.outgoingRequests.length, 1);
  const incoming = await waitForState(0, state => state.incomingRequests.length === 1, "incoming request");
  assert.equal(incoming.counts.requests, 1);
  await contexts[0].setOffline(true);
  await contexts[0].setOffline(false);
  await a.evaluate(() => window.dispatchEvent(new Event("online")));
  await a.getByTestId("homies-fadebook").waitFor();
  await a.getByTestId("tab-fb-requests").click();
  await a.getByTestId(`row-incoming-${incoming.incomingRequests[0].id}`).waitFor();
  await a.getByTestId(`button-accept-${incoming.incomingRequests[0].id}`).waitFor();
  assert.match(await a.getByTestId("tab-homies").innerText(), /1/, "incoming badge recovers after reconnect");
  await a.getByTestId(`button-accept-${incoming.incomingRequests[0].id}`).click();
  const accepted = await waitForState(0, state => state.homies.length === 1, "accepted homie");
  assert.equal(accepted.counts.requests, 0);
  await a.getByTestId("tab-homies").locator(".fighter-tab__badge").waitFor({ state: "hidden" });
  assert.equal(accepted.homies[0].friendCode, bState.self.friendCode);
  assert.equal((await social(1)).homies[0].friendCode, aState.self.friendCode);
  assert.equal((await social(1)).homies[0].username, "vicky_reborn");
  await Promise.all([a.reload(), b.reload()]);
  assert.equal((await social(0)).homies[0].friendCode, bState.self.friendCode);
  assert.equal((await social(1)).homies[0].friendCode, aState.self.friendCode);

  // The invitation and crew choices are real backend operations against two
  // separate browser-authenticated profiles. Third-party room access is denied.
  await a.getByTestId("tab-fb-homies").click();
  await a.getByTestId(`button-invite-${bState.self.username}`).click();
  await a.getByTestId(`button-target-${bState.self.friendCode}`).waitFor();
  assert.equal(await a.getByTestId(`button-target-${bState.self.friendCode}`).getAttribute("aria-checked"), "true");
  const crews = a.locator(".compact-deck-picker__deck");
  assert(await crews.count() > 1, "native test profiles own multiple legal crews");
  await crews.nth(1).click();
  const chosenCrew = await crews.nth(1).innerText();
  assert.equal(await crews.nth(1).getAttribute("aria-pressed"), "true");
  await a.setViewportSize({ width: 740, height: 360 });
  assert.equal(await a.getByTestId(`button-target-${bState.self.friendCode}`).getAttribute("aria-checked"), "true");
  assert.equal(await a.locator(".compact-deck-picker__deck").filter({ hasText: chosenCrew.trim().split("\n")[0] }).first().getAttribute("aria-pressed"), "true", "crew survives portrait-to-landscape rotation");
  await a.setViewportSize({ width: 390, height: 844 });
  assert.equal(await a.getByTestId(`button-target-${bState.self.friendCode}`).getAttribute("aria-checked"), "true");
  await a.getByTestId("button-send-invitation").click();
  const invitation = (await waitForState(0, state => state.invitations.some(item => item.status === "pending"), "sent invitation"))
    .invitations.find(item => item.status === "pending");
  assert.equal(invitation.status, "pending");
  assert.match(invitation.roomCode, /^[A-F0-9]{12}$/);
  assert.equal((await social(1)).counts.invitations, 1);
  await b.reload();
  await b.getByTestId("tab-homies").locator(".fighter-tab__badge").waitFor();
  assert.match(await b.getByTestId("tab-homies").innerText(), /1/, "incoming invitation count persists through refresh");
  await c.goto(`${origin}/game/online/${invitation.roomCode}`);
  await api(contexts[2], "GET", `/multiplayer/${invitation.roomCode}`, undefined, 404);
  await b.goto(`${origin}/game/online?tab=friends&invite=${invitation.id}`);
  await b.getByTestId("card-invitation").waitFor();
  assert.equal((await social(1)).counts.invitations, 1, "opening an invitation is not acceptance");
  await b.getByTestId("button-accept-invitation").click();
  await b.waitForURL(`**/game/online/${invitation.roomCode}`);
  await b.getByTestId("online-ready").waitFor();
  let joined;
  for (let tries = 0; tries < 20; tries++) {
    joined = await api(contexts[1], "GET", `/social/invitations/${invitation.id}`);
    if (joined.status === "accepted") break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.equal(joined.status, "accepted");
  assert.equal(joined.roomCode, invitation.roomCode);
  await Promise.all([a.goto(`${origin}/game/online/${invitation.roomCode}`), b.goto(`${origin}/game/online/${invitation.roomCode}`)]);
  await Promise.all([a.getByTestId("online-ready").waitFor(), b.getByTestId("online-ready").waitFor()]);
  await Promise.all([a.getByTestId("online-ready").click(), b.getByTestId("online-ready").click()]);
  await Promise.all([a.getByTestId("online-battle").waitFor(), b.getByTestId("online-battle").waitFor()]);
  const stateA = await api(contexts[0], "GET", `/multiplayer/${invitation.roomCode}`);
  const stateB = await api(contexts[1], "GET", `/multiplayer/${invitation.roomCode}`);
  assert.equal(stateA.status, "active");
  assert.deepEqual(stateA.scores, stateB.scores);
  await b.reload();
  await b.getByTestId("online-battle").waitFor();
  assert.deepEqual((await api(contexts[1], "GET", `/multiplayer/${invitation.roomCode}`)).scores, stateA.scores);
  let battlePolls = 0;
  b.on("request", request => { if (request.method() === "GET" && new URL(request.url()).pathname === "/api/social") battlePolls++; });
  await b.waitForTimeout(11_000);
  assert.equal(battlePolls, 0, "social state must not poll during active battle");

  // Ordinary untargeted rooms remain usable by a player who is not a homie.
  const open = await api(contexts[2], "POST", "/multiplayer", { deckId: "my-online-crew", requestId: crypto.randomUUID() }, 201);
  assert.match(open.code, /^[A-F0-9]{12}$/);
  await a.goto(`${origin}/game/online/${open.code}`);
  await a.getByRole("button", { name: "Join your friend" }).click();
  await a.getByTestId("online-room").waitFor();
  assert.equal((await api(contexts[2], "GET", `/multiplayer/${open.code}`)).status, "waiting");
  assert.equal((await social(0)).homies[0].friendCode, bState.self.friendCode);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, friendCodes: [aState.self.friendCode, bState.self.friendCode], invitationRoom: invitation.roomCode,
    checks: ["two native PostgreSQL accounts discover one another by public names before handle customization", "visible Search button returns names and portraits", "new @handle resolves updated identity", "minimal exact-code lookup", "link does not send request", "request and explicit acceptance", "mutual persistence after reload", "targeted invitation", "third-party room rejection", "recipient crew acceptance", "both ready", "active battle and reconnect", "battle social polling paused", "ordinary non-homie room join"] }, null, 2));
} catch (error) {
  for (const [index, page] of pages.entries()) await page.screenshot({ path: `screenshots/homies-failure-${index}.png`, fullPage: true }).catch(() => {});
  throw error;
} finally {
  await Promise.all(contexts.map(context => context.close()));
  await browser.close();
}