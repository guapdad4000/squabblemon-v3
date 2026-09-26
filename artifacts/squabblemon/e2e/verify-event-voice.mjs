import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { fadecadeBootstrap } from "./fadecade.fixture.ts";
import {
  rankProgress,
  rankedStats,
} from "../../../lib/squabblemon-engine/src/ranked.ts";
const origin = process.env.UI_ORIGIN ?? "http://127.0.0.1:4198";
assert(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE ?? "/usr/bin/google-chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const names = ["level-good-money", "level-hands", "level-pressure"];
try {
  for (const [label, width, aac] of [
    ["desktop", 1440, false],
    ["phone-aac", 390, true],
  ]) {
    for (const [index, name] of names.entries()) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        isMobile: aac,
        hasTouch: aac,
        reducedMotion: "reduce",
      });
      const bootstrap = fadecadeBootstrap();
      bootstrap.profile.level = 2;
      bootstrap.profile.xp = 250;
      await context.addInitScript(
        ({ id, value, aac }) => {
          localStorage.setItem("squabblemon_e2e_user", "signed-in");
          if (!localStorage.getItem(`squabblemon:level-seen:${id}`))
            localStorage.setItem(`squabblemon:level-seen:${id}`, "1");
          Math.random = () => value;
          window.__eventVoices = [];
          window.__eventErrors = [];
          window.__eventOverlap = false;
          if (aac) {
            const canPlayType = HTMLMediaElement.prototype.canPlayType;
            HTMLMediaElement.prototype.canPlayType = function (type) {
              return type.includes("vorbis")
                ? ""
                : canPlayType.call(this, type);
            };
          }
          const NativeAudio = window.Audio;
          window.Audio = class extends NativeAudio {
            constructor(src) {
              super(src);
              if (!src?.includes("/dr-fade/events/")) return;
              const record = { audio: this, src, plays: 0 };
              window.__eventVoices.push(record);
              this.addEventListener("playing", () => {
                record.plays++;
                if (
                  window.__eventVoices.filter(
                    (v) => !v.audio.paused && !v.audio.ended,
                  ).length > 1
                )
                  window.__eventOverlap = true;
              });
              this.addEventListener("error", () =>
                window.__eventErrors.push(src),
              );
            }
          };
        },
        { id: bootstrap.profile.id, value: (index + 0.2) / 3, aac },
      );
      const page = await context.newPage(),
        errors = [];
      page.setDefaultTimeout(15000);
      page.on("pageerror", (error) => errors.push(error.message));
      await page.route("**/api/**", (route) => {
        const path = new URL(route.request().url()).pathname;
        return route.fulfill({
          json: path.endsWith("/bootstrap")
            ? bootstrap
            : path.endsWith("/ranked")
              ? {
                  stats: rankedStats(null),
                  progress: rankProgress(0),
                  room: null,
                }
              : path.endsWith("/rewards/account")
                ? {
                    date: "2026-09-25",
                    streak: 1,
                    claimedToday: true,
                    pending: [],
                  }
                : { rooms: [] },
        });
      });
      const played = async (expected) => {
        await page
          .waitForFunction(
            (name) =>
              window.__eventVoices.some(
                (v) => v.src.endsWith(name) && v.plays === 1,
              ),
            `${expected}.${aac ? "m4a" : "ogg"}`,
          )
          .catch(async (error) => {
            console.log(
              "VOICE FAILURE",
              expected,
              await page.evaluate(() => ({
                voices: window.__eventVoices.map((v) => ({
                  src: v.src,
                  plays: v.plays,
                  paused: v.audio.paused,
                  ready: v.audio.readyState,
                  error: v.audio.error?.code,
                })),
                hidden: document.hidden,
                errors: window.__eventErrors,
              })),
              errors,
            );
            throw error;
          });
      };
      await page.goto(origin + "/e2e/level-up.fixture.html");
      await page.getByTestId("profile-level").filter({ hasText: "2" }).waitFor();
      await page.waitForTimeout(100);
      assert.equal(await page.locator(".level-moment").count(), 0);
      await page.getByTestId("button-restart-match").click();
      await page.locator(".level-moment").waitFor();
      await played(name);
      await page.waitForTimeout(2600);
      assert.equal(
        await page.evaluate(() => window.__eventVoices.length),
        1,
        "one level-up creates only one of the three clips",
      );
      assert.equal(
        await page.evaluate(() => window.__eventVoices[0].plays),
        1,
        "unrelated renders and completion do not replay the cue",
      );
      await page
        .getByRole("button", { name: "Keep applying pressure" })
        .click();
      assert.equal(
        await page.evaluate(() =>
          window.__eventVoices.every((v) => v.audio.paused),
        ),
        true,
      );
      if (index === 0) {
        await page.goto(origin + "/game/collection");
        // Navigate through real tabs and confirm cleanup without reloading the document.
        await page
          .getByRole("button", { name: "Open game navigation", exact: true })
          .click();
        await page
          .getByRole("button", { name: /Shop.*Train|Shop/ })
          .last()
          .click();
        await page
          .getByRole("navigation", { name: "Shop departments" })
          .getByRole("button", { name: "Training", exact: true })
          .click();
        await played("training-welcome");
        const count = await page.evaluate(() => window.__eventVoices.length);
        await page
          .getByRole("navigation", { name: "Shop departments" })
          .getByRole("button", { name: "Training", exact: true })
          .click();
        await page.waitForTimeout(100);
        assert.equal(
          await page.evaluate(() => window.__eventVoices.length),
          count,
        );
        await page
          .getByRole("navigation", { name: "Shop departments" })
          .getByRole("button", { name: "Recruit", exact: true })
          .click();
        assert.equal(
          await page.evaluate(() =>
            window.__eventVoices.every((v) => v.audio.paused),
          ),
          true,
        );
        await page.goto(origin + "/game/online?tab=friends");
        await played("friendly-fade");
        await page
          .getByRole("link", { name: /^Fade Park/ })
          .click();
        assert.equal(
          await page.evaluate(() =>
            window.__eventVoices.every((v) => v.audio.paused),
          ),
          true,
        );
        await page.getByRole("link", { name: /Friendly Fade/ }).click();
        await page.waitForFunction(
          () =>
            window.__eventVoices.length === 2 &&
            window.__eventVoices[1].plays === 1,
        );
        await page.evaluate(() => {
          localStorage.setItem(
            "squabblemon_battle_feedback",
            JSON.stringify({ audioEnabled: false, hapticsEnabled: false }),
          );
          window.dispatchEvent(
            new CustomEvent("squabblemon:feedback-change", {
              detail: { audioEnabled: false, hapticsEnabled: false },
            }),
          );
        });
        assert.equal(
          await page.evaluate(() =>
            window.__eventVoices.every((v) => v.audio.paused),
          ),
          true,
        );
        await page
          .getByRole("link", { name: /^Fade Park/ })
          .click();
        await page.getByRole("link", { name: /Friendly Fade/ }).click();
        await page.waitForTimeout(200);
        assert.equal(
          await page.evaluate(() => window.__eventVoices.length),
          2,
          "muted navigation does not create a cue",
        );
      }
      assert.deepEqual(await page.evaluate(() => window.__eventErrors), []);
      assert.equal(await page.evaluate(() => window.__eventOverlap), false);
      assert.deepEqual(errors, []);
      console.log(
        "PASS",
        label,
        name,
        index === 0
          ? "+ shop training, friendly tabs, mute, navigation cleanup"
          : "single level-up cue",
      );
      await context.close();
    }
  }
} finally {
  await browser.close();
}
