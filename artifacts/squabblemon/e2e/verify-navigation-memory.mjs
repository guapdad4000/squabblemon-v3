import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
const origin = process.env.UI_ORIGIN ?? 'http://127.0.0.1:4198';
try {
  for (const [name, viewport] of [['desktop', {width:1440,height:960}], ['phone', {width:390,height:844}]]) {
    const page = await browser.newPage({ viewport });
    await page.addInitScript(() => localStorage.setItem('squabblemon_e2e_user', 'signed-in'));
    await page.routeWebSocket('**', () => {});
    await page.route('**/api/**', r => r.fulfill({ json: r.request().url().endsWith('/challenges/runs') ? [] : {} }));
    page.on('pageerror',e=>console.log('PAGE ERROR',e.message));
    page.setDefaultTimeout(15000);
    const back = page.locator('.city-header .game-back-button');
    const route = async path => { await page.waitForURL(origin + path); await page.waitForTimeout(200); console.log(name,path); };
    await page.goto(origin + '/game/inventory');
    await back.click();
    await route('/game'); // direct-entry fallback stays inside the game
    await page.locator('.safehouse-stage[data-scene-ready="true"]').waitFor({timeout:30000});
    await page.getByRole('button', {name:'Explore your inventory bag',exact:true}).click({force:true});
    await page.getByRole('link', {name:'Open your bag',exact:true}).click();
    await route('/game/inventory');
    await page.getByRole('link', {name:/Browse all collections/}).click();
    await route('/game/style');
    await page.reload();
    await back.click();
    await route('/game/inventory'); // origin survives refresh
    await back.click();
    await route('/game');
    assert.equal(await page.locator('.safehouse-stage').getAttribute('data-view'), 'room');
    await page.getByRole('button',{name:'Explore the arcade machine',exact:true}).click({force:true});
    await page.getByRole('link',{name:'Enter the Fadecade',exact:true}).click();
    await route('/game/challenges');
    assert.equal(await back.count(),1);
    assert.equal(await page.locator('.fadecade-hub__back').count(),0);
    await page.screenshot({path:`screenshots/navigation-${name}.png`});
    await back.click();
    await route('/game');
    assert.equal(await page.locator('.safehouse-stage').getAttribute('data-view'),'room');
    await page.getByRole('button',{name:'Open game navigation',exact:true}).click();
    await page.getByRole('button',{name:'Cards & gangs · Collection and decks',exact:true}).click();
    await route('/game/collection');
    await page.getByTestId('button-view-collection-road').click();
    await page.locator('.city-header__identity').click();
    await route('/game/settings');
    await back.click();
    await route('/game/collection');
    assert.equal(await page.getByTestId('button-view-collection-road').getAttribute('aria-pressed'),'true');
    console.log('PASS',name,'direct fallback, reload history, nested routes, clean Safehouse return, single Challenges back, collection tab');
    await page.close();
  }
} finally { await browser.close(); }
