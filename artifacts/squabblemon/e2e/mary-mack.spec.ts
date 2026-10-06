import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const output=resolve(import.meta.dirname,'../../deliverables/mary-mack-15-cents/screenshots');mkdirSync(output,{recursive:true});
for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844],['ipad-portrait',820,1180],['ipad-landscape',1180,820]] as const) {
  test(`${name}: Mary charges then stays visible as a 4/4 elephant after the slam`, async({page})=>{
    await page.setViewportSize({width,height});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('/squabblemon/e2e/mary-mack.fixture.html');
    const human=page.locator('[data-card-zone="board"][data-mary-form="human"]');await expect(human).toBeVisible();
    await expect(human.getByTestId('card-charge')).toHaveText('0¢ / 15¢');
    await expect.poll(()=>human.locator('img.collector-portrait').evaluate((im:HTMLImageElement)=>im.complete&&im.naturalWidth>0)).toBe(true);
    await page.screenshot({path:`${output}/${name}-human.png`});
    await page.getByRole('button',{name:/end turn/i}).click();await expect(human.getByTestId('card-charge')).toHaveText('9¢ / 15¢');
    await page.getByRole('button',{name:/end turn/i}).click();const elephant=page.locator('[data-card-zone="board"][data-mary-form="elephant"]');
    await expect(elephant).toBeVisible();await expect(human).toHaveCount(0);await expect(elephant.getByTestId('card-charge')).toHaveText('ELEPHANT · 15¢');
    await expect.poll(()=>elephant.locator('img.collector-portrait').evaluate((im:HTMLImageElement)=>im.complete&&im.naturalWidth===1086)).toBe(true);
    await expect(page.locator('[data-testid="character-attack"]')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({path:`${output}/${name}-elephant.png`});
    if(name==='desktop'||name==='mobile') {
      await elephant.click();const dossier=page.getByRole('dialog');await expect(dossier).toBeVisible();
      await expect(dossier.locator('.dossier-sticky__title')).toHaveText('15 Cents');
      await expect(dossier.getByTestId('card-inspector').first()).toHaveAttribute('data-card-cost','4');
      await expect(dossier.getByTestId('card-inspector').first()).toHaveAttribute('data-card-power','4');
      await page.screenshot({path:`${output}/${name}-dossier.png`});
    }
    expect(errors).toEqual([]);
  });
}
