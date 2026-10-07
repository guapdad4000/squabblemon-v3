import assert from 'node:assert/strict';
import type { Page } from '@playwright/test';
/** SVG is only a viewport for generated raster art; verify the actual fetched atlas. */
export async function assertSpriteArt(page: Page, selector = '.motion-sprite') {
 const failures = await page.locator(selector).evaluateAll(async sprites => {
  const images = new Map<string, Promise<HTMLImageElement>>();
  const failures: string[] = [];
  for (const sprite of sprites) {
   const sheet = sprite.querySelector('image');
   if (!sheet && sprite.getAttribute('data-motion-ready') === 'false' && sprite.getAttribute('data-motion-visible') === 'false') continue;
   if (!sheet) { failures.push(`${sprite.getAttribute('data-sprite')}: missing atlas`); continue; }
   const url = sheet.getAttribute('href')!;
   if (!images.has(url)) images.set(url, new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=url;}));
   try {
    const img=await images.get(url)!;
    const svg=sprite.querySelector('svg')!;
    const {width,height}=svg.viewBox.baseVal;
    const box=sprite.getBoundingClientRect(), viewport=svg.getBoundingClientRect();
    if(box.width<=0||box.height<=0||viewport.width<box.width*.9||viewport.height<box.height*.9) failures.push(`${sprite.getAttribute('data-sprite')}: missing or shrunken sprite viewport`);
    if(img.naturalWidth!==Number(sheet.getAttribute('width')) || img.naturalHeight!==Number(sheet.getAttribute('height')))failures.push(`${url}: wrong atlas dimensions`);
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d')!;
    ctx.drawImage(img,0,-Number(sheet.getAttribute('y')),width,height,0,0,width,height);
    const pixels=ctx.getImageData(0,0,width,height).data;
    let body=0,border=0;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(pixels[(y*width+x)*4+3]>32){body++;if(x<2||y<2||x>=width-2||y>=height-2)border++;}
    if(body<width*height*.02) failures.push(`${url}: empty pose row`);
    if(border) failures.push(`${url}: silhouette clipped at cell boundary`);
   } catch { failures.push(`${url}: atlas failed to load`); }
  }
  return failures;
 });
 assert.deepEqual(failures, [], 'All generated sprite art loaded with intact silhouettes');
}
