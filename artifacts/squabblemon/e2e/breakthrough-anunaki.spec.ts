import { test, expect } from "@playwright/test";
for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
]) {
  test(`Anunaki Tablet placement, quote, consume and summon at ${viewport.width}x${viewport.height}`, async ({
    page,
  }, info) => {
    await page.setViewportSize(viewport);
    await page.goto(
      "/squabblemon/e2e/breakthrough-anunaki.fixture.html?reduced",
    );
    await page.getByRole("button", { name: /^Nabu, from/ }).click();
    await page.getByRole("button", { name: "Deploy Nabu in lane 1" }).click();
    const tablet = page.getByRole("img", {
      name: "Your Ancient Tablet ready in lane 1",
    });
    await expect(tablet).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Anu, from 4 Motion/ }),
    ).toBeVisible();
    await info.attach("tablet-ready", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
    await page.getByRole("button", { name: /^Inanna, from/ }).click();
    await page.getByRole("button", { name: "Deploy Inanna in lane 1" }).click();
    await expect(tablet).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /^Inanna, you, 7 Hands/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Yakub, from/ }).click();
    await expect(
      page.getByRole("button", { name: "Deploy Yakub in lane 2" }),
    ).toHaveAttribute("aria-description", "2 Motion to deploy", { timeout: 10000 });
    await page.getByRole("button", { name: "Deploy Yakub in lane 2" }).click();
    await expect(
      page.getByRole("button", { name: /^Caucus Mountaineer, you, 3 Hands/ }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect.poll(() => page.locator('.bt-unit > img:first-child').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
    await info.attach("summon", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  });
}
