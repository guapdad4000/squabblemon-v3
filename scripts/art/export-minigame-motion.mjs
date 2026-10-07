const {default:sharp}=await import(process.env.SPRITE_SHARP_MODULE ?? 'sharp');
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const manifest=JSON.parse(await fs.readFile('design/minigame-motion/generation.json','utf8'));
const selectedKeys=new Set((process.env.MINIGAME_SPRITE_KEYS??'').split(',').filter(Boolean));
const reports=selectedKeys.size?JSON.parse(await fs.readFile('design/minigame-motion/atlas-report.json','utf8')).filter(a=>!selectedKeys.has(a.key)&&manifest.assets.some(m=>m.key===a.key)):[];
for (const asset of manifest.assets.filter(a=>!selectedKeys.size||selectedKeys.has(a.key))) {
 const source=await fs.readFile(asset.source);
 if(asset.key.endsWith('banner')) {
  await sharp(source).resize({width:1800,withoutEnlargement:true}).webp({quality:92,effort:6}).toFile(`artifacts/squabblemon/public/assets/minigames/motion-v1/${asset.key}.webp`);
  reports.push({key:asset.key,sourceSha256:crypto.createHash('sha256').update(source).digest('hex')}); continue;
 }
 const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const W=info.width,H=info.height,labels=new Int32Array(W*H),queue=new Int32Array(W*H),components=[];
 let label=0;
 for(let p=0;p<W*H;p++) {
  if(labels[p]||data[p*4+3]<16)continue;
  label++;let head=0,tail=1;queue[0]=p;labels[p]=label;
  let minX=W,minY=H,maxX=0,maxY=0,sumX=0,sumY=0;
  while(head<tail){const q=queue[head++],x=q%W,y=Math.floor(q/W);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);sumX+=x;sumY+=y;
   for(const n of [x>0?q-1:-1,x<W-1?q+1:-1,y>0?q-W:-1,y<H-1?q+W:-1])if(n>=0&&!labels[n]&&data[n*4+3]>=16){labels[n]=label;queue[tail++]=n;}
  }
  components.push({label,size:tail,minX,minY,maxX,maxY,cx:sumX/tail,cy:sumY/tail});
 }
 const count=asset.columns*asset.rows,sw=W/asset.columns,sh=H/asset.rows;
 const primary=Array(count).fill(null);
 for(const c of components){const cell=Math.min(asset.rows-1,Math.floor(c.cy/sh))*asset.columns+Math.min(asset.columns-1,Math.floor(c.cx/sw));if(!primary[cell]||primary[cell].size<c.size)primary[cell]=c;}
 if(primary.some(c=>!c||c.size<W*H/count*.04))throw Error(asset.key+' missing primary frame');
 const cellForLabel=new Int32Array(label+1).fill(-1);
 for(const c of components){if(c.size<12)continue;let nearest=0,dist=Infinity;for(let i=0;i<count;i++){const target=primary[i];const d=((c.cx-target.cx)/sw)**2+((c.cy-target.cy)/sh)**2;if(d<dist){nearest=i;dist=d;}}cellForLabel[c.label]=nearest;}
 const bounds=primary.map(c=>({minX:c.minX,minY:c.minY,maxX:c.maxX,maxY:c.maxY}));
 for(const c of components){const i=cellForLabel[c.label];if(i<0)continue;const b=bounds[i];b.minX=Math.min(b.minX,c.minX);b.maxX=Math.max(b.maxX,c.maxX);b.minY=Math.min(b.minY,c.minY);b.maxY=Math.max(b.maxY,c.maxY);}
 const cw=asset.cell,ch=asset.cellHeight??cw,pad=asset.key.startsWith('girl-')?14:8;
 const maxRadius=Math.max(...bounds.map((b,i)=>Math.max((i%4+.5)*sw-b.minX,b.maxX-(i%4+.5)*sw)));
 const maxHeight=Math.max(...bounds.map(b=>b.maxY-b.minY+1));
 const scale=Math.min((cw-2*pad)/(2*maxRadius),(ch-2*pad)/maxHeight);
 const composites=[],frameReport=[];
 for(let i=0;i<count;i++){
  const b=bounds[i],w=b.maxX-b.minX+1,h=b.maxY-b.minY+1,buf=Buffer.alloc(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=(b.minY+y)*W+b.minX+x;if(cellForLabel[labels[p]]===i)data.copy(buf,(y*w+x)*4,p*4,p*4+4);}
  const nw=Math.max(1,Math.round(w*scale)),nh=Math.max(1,Math.round(h*scale));
  const input=await sharp(buf,{raw:{width:w,height:h,channels:4}}).resize(nw,nh,{kernel:asset.key.startsWith('waffle')?'nearest':'lanczos3'}).png().toBuffer();
  const x=Math.round(cw/2+(b.minX-(i%4+.5)*sw)*scale),y=ch-pad-nh;
  if(x<pad-2||x+nw>cw-pad+2||y<pad-2)throw Error(asset.key+' unsafe frame '+i);
  composites.push({input,left:i%4*cw+x,top:Math.floor(i/4)*ch+y});frameReport.push({frame:i,sourceBounds:b,x,y,width:nw,height:nh});
 }
 const destination=`artifacts/squabblemon/public/assets/minigames/motion-v1/${asset.key}.webp`;
 await sharp({create:{width:cw*4,height:ch*asset.rows,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(composites).webp(asset.key.startsWith('waffle')?{lossless:true,effort:6}:{quality:92,alphaQuality:100,effort:6}).toFile(destination);
 const stat=await fs.stat(destination);reports.push({key:asset.key,columns:4,rows:asset.rows,cellWidth:cw,cellHeight:ch,bytes:stat.size,sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),frames:frameReport});
 console.log(asset.key,count+' frames',stat.size+' bytes');
}
await fs.writeFile('design/minigame-motion/atlas-report.json',JSON.stringify(reports,null,2)+'\n');
