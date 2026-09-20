import {createServer} from 'vite';
import {writeFile,unlink} from 'node:fs/promises';
const fixture='e2e/element-preview-harness.tsx',html='e2e/element-preview.html';
process.env.PORT='4206';process.env.BASE_PATH='/';
await writeFile(fixture,"import React, {useState} from 'react';\nimport {createRoot} from 'react-dom/client';\nimport {CardView} from '../src/components/CardView';\nimport {cards} from '../src/data';\nimport '../src/index.css';\nconst ids=['church','nightmedic','piratedj','promoter','gamer','counter','conductor','captainjigga','ashlee','foodz'];\nfunction Preview(){\n const [id,setId]=useState(new URLSearchParams(location.search).get('card') || 'church');\n return <main style={{minHeight:'100dvh',background:'#111014',padding:16,display:'grid',gap:12,placeItems:'center'}}>\n <select aria-label=\"Inspect updated card\" value={id} onChange={e=>setId(e.target.value)}>{ids.map(key=><option key={key} value={key}>{cards[key].name}</option>)}</select>\n <div style={{width:'min(86vw,360px)'}} data-testid=\"element-card\"><CardView key={id} card={cards[id]} isInspector fillContainer presentationOnly/></div>\n <output data-testid=\"element-type\">{cards[id].type}</output>\n </main>\n}createRoot(document.getElementById('root')!).render(<Preview/>);\n");
await writeFile(html,'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root"></div><script type="module" src="/'+fixture+'"></script></body></html>');
const server=await createServer({server:{host:'127.0.0.1',port:4206,strictPort:true}});
await server.listen();console.log('Element preview: http://127.0.0.1:4206/e2e/element-preview.html');
let closing=false;
async function close(){if(closing)return;closing=true;await server.close();await Promise.all([unlink(fixture),unlink(html)]);process.exit(0);}
process.on('SIGINT',close);process.on('SIGTERM',close);
