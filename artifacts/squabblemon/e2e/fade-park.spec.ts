import { expect, test } from '@playwright/test';

test.describe('Fade Park Responsive Layout', () => {
  const checkOverflow = async (page: any) => {
    // Check if the scrollWidth exceeds the clientWidth of the document element
    const hasHorizontalOverflow = await page.evaluate(() => {
      const docW = document.documentElement.clientWidth;
      if (document.documentElement.scrollWidth > docW) {
        // Find the culprits
        const all = document.querySelectorAll('*');
        const culprits = [];
        for (let i = 0; i < all.length; i++) {
          if (all[i].scrollWidth > docW || all[i].getBoundingClientRect().right > docW) {
            culprits.push(all[i].className || all[i].tagName);
          }
        }
        console.error('Culprits:', culprits.join(', '));
        return true;
      }
      return false;
    });
    expect(hasHorizontalOverflow).toBeFalsy();
  };

  test('320px mobile viewport', async ({ page }) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto('/squabblemon/e2e/park.fixture.html');
    await page.waitForLoadState('networkidle');
    await checkOverflow(page);
    await page.screenshot({ path: 'screenshots/park-fixture-320px.png', fullPage: true });
  });

  test('390px mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/squabblemon/e2e/park.fixture.html');
    await page.waitForLoadState('networkidle');
    await checkOverflow(page);
    await page.screenshot({ path: 'screenshots/park-fixture-390px.png', fullPage: true });
  });

  test('519px mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 519, height: 900 });
    await page.goto('/squabblemon/e2e/park.fixture.html');
    await page.waitForLoadState('networkidle');
    await checkOverflow(page);
    await page.screenshot({ path: 'screenshots/park-fixture-519px.png', fullPage: true });
  });

  test('1440px desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/squabblemon/e2e/park.fixture.html');
    await page.waitForLoadState('networkidle');
    await checkOverflow(page);
    await page.screenshot({ path: 'screenshots/park-fixture-1440px.png', fullPage: true });
  });

  test('short landscape viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 519 });
    await page.goto('/squabblemon/e2e/park.fixture.html');
    await page.waitForLoadState('networkidle');
    
    // Check scrolling behavior for short viewports
    const isScrollable = await page.evaluate(() => {
      return document.documentElement.scrollHeight > document.documentElement.clientHeight;
    });
    // The page should be vertically scrollable to reach the bottom controls
    expect(isScrollable).toBeTruthy();
    
    await checkOverflow(page);
    await page.screenshot({ path: 'screenshots/park-fixture-short-landscape.png', fullPage: true });
  });
});
