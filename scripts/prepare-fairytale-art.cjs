// Local, deterministic cleanup of explicitly supplied artwork. Original PNGs remain untouched.
const fs = require('fs');
const path = require('path');
const sharp = require('../artifacts/squabblemon/node_modules/sharp');
const sources = require('./fairytale-art-sources.json');
const out = 'artifacts/squabblemon/public/assets/characters';
const audit = 'screenshots/fairytale-art';
// Interior regions selected from the numbered source audit. Clothing and highlights are retained.
const interior = {
  powerhouse: [1,2,3,4,5,6,8,13,16,17,18,19,20,22,25,26,31,33,34,35,36,37,38,39,40,41,42,43,44,45,46],
  'sherlock-alternate': [4,5,12],
  'queen-of-hearts': [1,3,4,5],
  alice: [2,3,4,5],
  oz: Array.from({length:21},(_,i)=>i+1),
};
async function main() {
  fs.mkdirSync(audit, { recursive: true });
  const tiles = [], report = [];
  for (const [id, file, mode] of sources) {
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width: w, height: h } = info, n = w * h;
    const rgba = Buffer.from(data), seen = new Uint8Array(n), queue = new Int32Array(n);
    const parts = [];
    const background = p => {
      const k = p * 4, low = Math.min(data[k], data[k+1], data[k+2]), high = Math.max(data[k], data[k+1], data[k+2]);
      return data[k+3] > 0 && low >= (mode === 'checker' ? 180 : 226) && high-low <= (mode === 'checker' ? 14 : 24);
    };
    if (mode === 'white' || mode === 'checker') {
      for (let p = 0; p < n; p++) {
        if (seen[p] || !background(p)) continue;
        let head = 0, tail = 1, edge = false, gray = 0, white = 0;
        queue[0] = p; seen[p] = 1;
        while (head < tail) {
          const q = queue[head++], x = q % w, y = Math.floor(q / w);
          if (!x || !y || x === w-1 || y === h-1) edge = true;
          if (data[q*4] < 224) gray++; else white++;
          for (const r of [x ? q-1 : -1, x < w-1 ? q+1 : -1, y ? q-w : -1, y < h-1 ? q+w : -1]) {
            if (r >= 0 && !seen[r] && background(r)) { seen[r]=1; queue[tail++]=r; }
          }
        }
        // Only border-connected regions are removed automatically. Interior white clothing stays intact.
        if (edge || (tail > 60 && (interior[id] ?? []).includes(parts.length))) for (let q=0; q<tail; q++) rgba[queue[q]*4+3]=0;
        if (tail > 60) parts.push({ seed: [p%w,Math.floor(p/w)], pixels: tail, edge, gray, white });
      }
    }
    let left=w, top=h, right=0, bottom=0;
    for(let p=0;p<n;p++) if(rgba[p*4+3] > 12) { const x=p%w,y=Math.floor(p/w);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y); }
    left=Math.max(0,left-6);top=Math.max(0,top-6);right=Math.min(w-1,right+6);bottom=Math.min(h-1,bottom+6);
    const output = path.join(out,id+'.webp');
    const sized = await sharp(rgba,{raw:{width:w,height:h,channels:4}}).extract({left,top,width:right-left+1,height:bottom-top+1})
      .resize({width:1000,height:1200,fit:'inside',withoutEnlargement:true}).png().toBuffer({resolveWithObject:true});
    const padX = Math.max(0,512-sized.info.width), padY = Math.max(0,512-sized.info.height);
    await sharp(sized.data).extend({left:Math.floor(padX/2),right:Math.ceil(padX/2),top:Math.floor(padY/2),bottom:Math.ceil(padY/2),background:{r:0,g:0,b:0,alpha:0}})
      .webp({quality:87,alphaQuality:100,effort:6}).toFile(output);
    const thumbnail=await sharp(output).resize(235,305,{fit:'contain',background:'#25434e'}).png().toBuffer();
    const label=Buffer.from('<svg width="235" height="30"><rect width="235" height="30" fill="#142832"/><text x="7" y="20" fill="white" font-size="13">'+id+'</text></svg>');
    tiles.push({ input:thumbnail,left:(tiles.length%6)*235,top:Math.floor(tiles.length/6)*335 });
    // Label placement uses the source index, independent of the composite count.
    const index=sources.findIndex(row=>row[0]===id);
    tiles[tiles.length-1].left=(index%6)*235;tiles[tiles.length-1].top=Math.floor(index/6)*335;
    tiles.push({input:label,left:(index%6)*235,top:Math.floor(index/6)*335+305});
    report.push({id,mode,width:w,height:h,parts,bytes:fs.statSync(output).size});
    console.log('Prepared '+id);
  }
  await sharp({create:{width:1410,height:Math.ceil(sources.length/6)*335,channels:4,background:'#25434e'}}).composite(tiles).png().toFile(audit+'/contact.png');
  fs.writeFileSync(audit+'/regions.json',JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
