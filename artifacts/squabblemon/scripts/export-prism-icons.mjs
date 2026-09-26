import sharp from 'sharp';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
const root='public/brand/prismatic/';
const mark=root+'marks/impact-standard-gold.webp';
for(const [name,size,padding] of [['favicon-16',16,0],['favicon-32',32,1],['apple-touch-icon',180,18],['icon-192',192,16],['icon-512',512,42],['icon-maskable-512',512,96]]) {
 await sharp(mark).resize(size-padding*2,size-padding*2,{fit:'contain',background:'#080a11'}).flatten({background:'#080a11'}).extend({top:padding,bottom:padding,left:padding,right:padding,background:'#080a11'}).png().toFile('public/icons/'+name+'.png');
 // New URLs refresh browser/install caches; conventional names remain compatible.
 const freshName=name==='apple-touch-icon' ? name+'-gold' : name.replace(/^(favicon|icon)-/,'$1-gold-');
 await copyFile('public/icons/'+name+'.png','public/icons/'+freshName+'.png');
}
const png=await readFile('public/icons/favicon-32.png');const ico=Buffer.alloc(22);
ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);ico[6]=32;ico[7]=32;ico.writeUInt16LE(1,10);ico.writeUInt16LE(32,12);ico.writeUInt32LE(png.length,14);ico.writeUInt32LE(22,18);
await writeFile('public/favicon.ico',Buffer.concat([ico,png]));
await sharp(root+'logos/squabblemon-lockup-standard-gold.webp').resize(1100,550,{fit:'contain',background:'#070707'}).flatten({background:'#070707'}).extend({top:40,bottom:40,left:50,right:50,background:'#070707'}).jpeg({quality:92}).toFile('public/brand/squabblemon-standard-gold-share.jpg');
await copyFile('public/brand/squabblemon-standard-gold-share.jpg','public/brand/squabblemon-share.jpg');
await copyFile(mark,'public/brand/squabblemon-crest.webp');
// A self-contained legacy logo URL also works when embedded as an <img>.
const wordmark=await readFile(root+'logos/squabblemon-wordmark-standard-gold.webp');
const {width,height}=await sharp(wordmark).metadata();
await writeFile('public/logo.svg',`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title"><title id="title">Squabblemon — standard gold</title><image width="${width}" height="${height}" href="data:image/webp;base64,${wordmark.toString('base64')}"/></svg>\n`);
