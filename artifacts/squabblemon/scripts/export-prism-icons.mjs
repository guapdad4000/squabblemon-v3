import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
const root='public/brand/prismatic/';
const mark=root+'marks/monogram-gold.webp';
for(const [name,size,padding] of [['favicon-16',16,0],['favicon-32',32,1],['apple-touch-icon',180,18],['icon-192',192,16],['icon-512',512,42],['icon-maskable-512',512,96]]) {
 await sharp(mark).resize(size-padding*2,size-padding*2,{fit:'contain',background:'#080a11'}).flatten({background:'#080a11'}).extend({top:padding,bottom:padding,left:padding,right:padding,background:'#080a11'}).png().toFile('public/icons/'+name+'.png');
}
const png=await readFile('public/icons/favicon-32.png');const ico=Buffer.alloc(22);
ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);ico[6]=32;ico[7]=32;ico.writeUInt16LE(1,10);ico.writeUInt16LE(32,12);ico.writeUInt32LE(png.length,14);ico.writeUInt32LE(22,18);
await writeFile('public/favicon.ico',Buffer.concat([ico,png]));
await sharp(root+'logos/squabblemon-lockup-gold.webp').resize(1200,630,{fit:'contain',background:'#070707'}).flatten({background:'#070707'}).jpeg({quality:92}).toFile('public/brand/squabblemon-share.jpg');
