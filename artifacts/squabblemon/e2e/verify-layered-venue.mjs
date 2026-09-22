import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

const port = process.env.VENUE_PORT ?? '4187';
const origin = `http://127.0.0.1:${port}`;
// Ensure it runs via Vite
const server = spawn(process.execPath, ['../../node_modules/vite/bin/vite.js', '--config', 'vite.config.ts', '--host', '127.0.0.1', '--port', port], {
  env: { ...process.env, PORT: port, BASE_PATH: '/', VITE_E2E_AUTH: 'true' }, stdio: 'ignore', windowsHide: true,
});

const report = { checks: [], errors: [], complete: false };
let browser, activePage;

try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(origin + '/')).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'Preview server starts');
  
  await mkdir('/tmp/replit-screenshots', { recursive: true }).catch(()=>{});
  browser = await chromium.launch({ headless: true });
  
  // Test Desktop
  const contextDesktop = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'no-preference' });
  await contextDesktop.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
  const page = activePage = await contextDesktop.newPage();
  
  page.on('pageerror', error => report.errors.push(`Desktop error: ${error.message}`));
  
  await page.goto(origin + '/game/shop');
  
  // Wait for LayeredVenue to appear
  const venue = page.locator('.layered-venue').first();
  await venue.waitFor();
  report.checks.push('LayeredVenue is present on /game/shop');

  // Check CSS is imported
  const hasEnhancedCss = await page.evaluate(() => {
    for (let sheet of document.styleSheets) {
      try {
        for (let rule of sheet.cssRules) {
          if (rule.selectorText && rule.selectorText.includes('.layered-venue--enhanced')) return true;
        }
      } catch (e) {}
    }
    return false;
  });
  assert.ok(hasEnhancedCss, 'LayeredVenue.css is imported and applied');
  report.checks.push('LayeredVenue.css rules detected');

  // Let ambient motion run a bit
  await page.waitForTimeout(300);
  const getTransforms = async () => await venue.evaluate(el => {
    return {
      x: parseFloat(el.style.getPropertyValue('--scene-x') || '0'),
      y: parseFloat(el.style.getPropertyValue('--scene-y') || '0')
    };
  });
  
  const idle1 = await getTransforms();
  await page.waitForTimeout(300);
  const idle2 = await getTransforms();
  
  assert.ok(idle1.x !== idle2.x || idle1.y !== idle2.y, 'Ambient idle transforms change over time');
  report.checks.push('Ambient idle transforms animate smoothly');

  // Pointer tracking
  const bounds = await venue.boundingBox();
  await page.mouse.move(bounds.x + 10, bounds.y + 10);
  await page.waitForTimeout(200);
  const pointer1 = await getTransforms();
  
  await page.mouse.move(bounds.x + bounds.width - 10, bounds.y + bounds.height - 10);
  await page.waitForTimeout(200);
  const pointer2 = await getTransforms();
  
  assert.ok(Math.abs(pointer1.x - pointer2.x) > 10, 'Pointer transforms change significantly based on mouse position');
  report.checks.push('Mouse movement correctly applies strong parallax');

  // Bounds and overflow check
  const hasOverflow = await page.evaluate(() => {
    const el = document.querySelector('.layered-venue');
    const style = window.getComputedStyle(el);
    // As long as it has overflow: hidden, it won't leak onto the page
    return style.overflow !== 'hidden' && (el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight);
  });
  assert.ok(!hasOverflow, 'LayeredVenue does not overflow its container bounds');
  report.checks.push('Layer bounds contained, no overflow');
  
  await page.screenshot({ path: `/tmp/replit-screenshots/layered-venue-desktop.jpg`, type: 'jpeg', quality: 85 });

  // Test Offscreen rAF pause
  await page.evaluate(() => {
    window.rafCount = 0;
    const originalRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb) => { window.rafCount++; return originalRaf(cb); };
    
    // Hide the element (simulating offscreen/IntersectionObserver)
    const el = document.querySelector('.layered-venue');
    if (el) el.style.display = 'none';
  });
  
  await page.waitForTimeout(500); // Give IO time to fire and one frame to exit
  const rafStart = await page.evaluate(() => window.rafCount);
  await page.waitForTimeout(500); // Wait another half second
  const rafEnd = await page.evaluate(() => window.rafCount);
  
  // Playwright might be doing some internal rAF, but the main loop is 60fps.
  // In 500ms, it would do 30 frames. If it stops, it will be 0 or 1.
  // Playwright actually doesn't stop window.requestAnimationFrame natively, but we only patched the window one.
  assert.ok(rafEnd - rafStart <= 5, `rAF loop stops when offscreen (start: ${rafStart}, end: ${rafEnd})`);
  report.checks.push('IntersectionObserver successfully stops rAF infinite loop when offscreen');
  
  // Test Document hidden state pauses rAF loop
  await page.evaluate(() => {
    window.rafCount = 0;
    const originalRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb) => { window.rafCount++; return originalRaf(cb); };
    
    // Fake document.hidden and dispatch visibilitychange
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  
  await page.waitForTimeout(500);
  const rafStartVis = await page.evaluate(() => window.rafCount);
  await page.waitForTimeout(500);
  const rafEndVis = await page.evaluate(() => window.rafCount);
  
  assert.ok(rafEndVis - rafStartVis <= 5, `rAF loop stops when document is hidden (start: ${rafStartVis}, end: ${rafEndVis})`);
  report.checks.push('document.hidden successfully stops rAF infinite loop');
  
  // Bring it back for reduced motion test
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
    
    const el = document.querySelector('.layered-venue');
    if (el) el.style.display = '';
  });
  await page.waitForTimeout(300);

  // App-level data-reduce-motion
  await page.evaluate(() => document.documentElement.setAttribute('data-reduce-motion', 'true'));
  await page.waitForTimeout(300);
  let reduced = await getTransforms();
  assert.equal(reduced.x, 0, 'data-reduce-motion sets --scene-x to 0');
  assert.equal(reduced.y, 0, 'data-reduce-motion sets --scene-y to 0');
  report.checks.push('App data-reduce-motion stops motion immediately');

  await contextDesktop.close();

  // Test Mobile & OS-level prefers-reduced-motion
  const contextMobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await contextMobile.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
  const pageMobile = activePage = await contextMobile.newPage();
  
  await pageMobile.goto(origin + '/game/shop?tab=corner'); // Fade market
  await pageMobile.locator('.layered-venue').first().waitFor();
  
  await pageMobile.waitForTimeout(300);
  const mobileTransforms = await pageMobile.evaluate(() => {
    const el = document.querySelector('.layered-venue');
    return {
      x: parseFloat(el.style.getPropertyValue('--scene-x') || '0'),
      y: parseFloat(el.style.getPropertyValue('--scene-y') || '0')
    };
  });
  
  assert.equal(mobileTransforms.x, 0, 'OS prefers-reduced-motion sets --scene-x to 0');
  report.checks.push('OS prefers-reduced-motion respected on mobile');

  await pageMobile.screenshot({ path: `/tmp/replit-screenshots/layered-venue-mobile.jpg`, type: 'jpeg', quality: 85 });
  await contextMobile.close();

  // Test Mobile Ambient bounds (without reduced motion)
  const contextMobileAnim = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await contextMobileAnim.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
  const pageMobileAnim = activePage = await contextMobileAnim.newPage();
  
  await pageMobileAnim.goto(origin + '/game/shop?tab=corner');
  await pageMobileAnim.locator('.layered-venue').first().waitFor();
  
  // Record max ambient excursion over 2 seconds
  let maxX = 0;
  for (let i = 0; i < 10; i++) {
    await pageMobileAnim.waitForTimeout(200);
    const pos = await pageMobileAnim.evaluate(() => {
      const el = document.querySelector('.layered-venue');
      return Math.abs(parseFloat(el.style.getPropertyValue('--scene-x') || '0'));
    });
    if (pos > maxX) maxX = pos;
  }
  
  assert.ok(maxX > 0, 'Mobile ambient motion is active');
  assert.ok(maxX <= 15, `Mobile ambient motion is subtle (max recorded X: ${maxX}px, expected <= 15px)`);
  report.checks.push('Mobile ambient motion is present but subtle (<= 15px excursion)');

  await contextMobileAnim.close();

  report.complete = true;
  console.log('ALL CHECKS PASSED:\n' + report.checks.join('\n'));
} catch (error) {
  report.failure = String(error.stack ?? error);
  console.error('TEST FAILED:', report.failure);
  if (report.errors.length) console.error('Page errors:', report.errors);
  process.exitCode = 1;
} finally {
  await browser?.close(); 
  server.kill();
}
