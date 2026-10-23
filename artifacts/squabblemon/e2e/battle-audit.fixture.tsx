import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BattlePerfHarness } from '../src/components/BattlePerfHarness';
import '../src/index.css';
import './battle-audit.fixture.css';

const presets = { '320×568':[320,568], '390×844':[390,844], '430×932':[430,932], '820×1180':[820,1180], '1180×820':[1180,820], '1280×800':[1280,800], '1920×1080':[1920,1080], '844×390':[844,390] } as const;
function layoutSnapshot(doc: Document, win: Window) {
  const rect = (e: Element) => { const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; };
  const cards=[...doc.querySelectorAll('[data-card-zone="board"]')];
  const hands=[...doc.querySelectorAll('#hand-tray [data-card-zone="hand"]')];
  const stacks=[...doc.querySelectorAll<HTMLElement>('.battle-formation-stack')];
  const action=doc.querySelector('.battle-primary-action');
  const r=action?.getBoundingClientRect();
  const hit=r?doc.elementFromPoint(r.x+r.width/2,r.y+r.height/2):null;
  const dialogs=[...doc.querySelectorAll('dialog[open]')];
  const sizes=cards.map(rect);
  return {viewport:[win.innerWidth,win.innerHeight],mode:doc.querySelector('.battle-header')?.getAttribute('data-header-mode'),
    pageOverflowX:doc.documentElement.scrollWidth-win.innerWidth,
    boardCards:cards.length,handCards:hands.length,minimumBoardCardWidth:Math.min(...sizes.map(s=>s.width)),minimumBoardCardHeight:Math.min(...sizes.map(s=>s.height)),
    action:r?{...rect(action!),hitTarget:!!hit&&(hit===action||action!.contains(hit))}:null,
    regions:[...doc.querySelectorAll('.battle-command-header,.battlefield-grid,.battle-command-deck,.battle-actions')].map(e=>({class:e.className,...rect(e)})),
    formations:stacks.map(e=>({count:e.dataset.count,rendered:e.querySelectorAll('[data-card-zone="board"]').length,scrollable:e.dataset.scrollable,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight,scrollTop:e.scrollTop,hasInspector:!!e.parentElement?.querySelector('.battle-formation-inspect')})),
    formationControls:[...doc.querySelectorAll<HTMLElement>('.battle-formation-continuation,.battle-formation-inspect')].map(e=>{const r=e.getBoundingClientRect(); const hit=doc.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{label:e.getAttribute('aria-label')??e.textContent,...rect(e),hitTarget:!!hit&&(e===hit||e.contains(hit))};}),
    dialogs:dialogs.map(e=>({...rect(e),label:e.getAttribute('aria-label')})),
    animatedImages:doc.querySelectorAll('[data-media-animated="true"]').length,
    liveFoils:doc.querySelectorAll('[data-foil-renderer="webgl"] canvas').length,
    failedImages:[...doc.images].filter(e=>e.complete&&!e.naturalWidth).map(e=>e.currentSrc),
  };
}
function Audit() {
  const [size,setSize]=useState<keyof typeof presets>('390×844');
  const [scene,setScene]=useState('layout');
  const [report,setReport]=useState('Choose a battle view inside the frame, then capture layout. The frame has its own CSS viewport.');
  const frame=useRef<HTMLIFrameElement>(null);
  const [width,height]=presets[size];
  return <div className="audit-page"><header><strong>Sizing & performance audit</strong><label>Viewport<select aria-label="Audit viewport" value={size} onChange={e=>setSize(e.target.value as keyof typeof presets)}>{Object.keys(presets).map(key=><option key={key}>{key}</option>)}</select></label><label>Scene<select aria-label="Audit scene" value={scene} onChange={e=>setScene(e.target.value)}><option value="layout">Current audition</option><option value="benchmark">Six-round benchmark</option></select></label><button onClick={()=>{const f=frame.current;if(f?.contentDocument&&f.contentWindow)setReport(JSON.stringify(layoutSnapshot(f.contentDocument,f.contentWindow),null,2));}}>Capture layout</button><details><summary>Latest result</summary><pre id="audit-result">{report}</pre></details></header><main><iframe ref={frame} title="Isolated audit viewport" width={width} height={height} src={scene==='layout'?'./card-type-auditions.fixture.html':'./battle-audit.fixture.html?benchmark=1'}/></main></div>;
}
function Benchmark() {
  const [reduced,setReduced]=useState(false);
  useEffect(()=>{document.documentElement.dataset.reduceMotion=String(reduced);return()=>{delete document.documentElement.dataset.reduceMotion;};},[reduced]);
  const [running,setRunning]=useState(false),[report,setReport]=useState('Ready: real engine, six rounds, local browser, no CPU throttling.');
  const run=async()=>{
    if(running||!window.__battlePerf?.ready)return;
    setRunning(true);
    const longTasks:number[]=[],frames:number[]=[];
    let previous=0,raf=0,collect=true;
    const observer=new PerformanceObserver(list=>list.getEntries().forEach(e=>longTasks.push(e.duration)));
    if(PerformanceObserver.supportedEntryTypes.includes('longtask'))observer.observe({type:'longtask'});
    const tick=(now:number)=>{if(previous)frames.push(now-previous);previous=now;if(collect)raf=requestAnimationFrame(tick);};
    raf=requestAnimationFrame(tick);
    try {
      const started=performance.now();
      const react=await window.__battlePerf.run();
      collect=false;cancelAnimationFrame(raf);observer.disconnect();
      const sorted=frames.filter(x=>x>0).sort((a,b)=>a-b);
      const resources=performance.getEntriesByType('resource').map(item=>{const entry=item as PerformanceResourceTiming;return{url:entry.name,kind:entry.initiatorType,transferBytes:entry.transferSize,encodedBytes:entry.encodedBodySize,decodedBytes:entry.decodedBodySize,durationMs:entry.duration};});
      const result={motion:reduced?'app-reduced':'standard',resources,environment:import.meta.env.PROD?'production profiling build':'development build',throttle:'none',elapsedMs:performance.now()-started,...react,
        longTasks:longTasks.length,longTaskMs:longTasks.reduce((a,b)=>a+b,0),sampledFrames:sorted.length,p95FrameMs:sorted[Math.max(0,Math.ceil(sorted.length*.95)-1)]??0,droppedFrameRatio:sorted.filter(x=>x>34).length/Math.max(1,sorted.length),
        layout:layoutSnapshot(document,window)};
      setReport(JSON.stringify(result,null,2));
    } catch(error) {setReport(String(error));} finally {collect=false;cancelAnimationFrame(raf);observer.disconnect();setRunning(false);}
  };
  return <><BattlePerfHarness/><aside className="audit-benchmark"><label><input type="checkbox" aria-label="Reduced motion" checked={reduced} disabled={running} onChange={e=>setReduced(e.target.checked)}/>Reduced motion</label><button disabled={running} onClick={()=>void run()}>{running?'Running six rounds…':'Run six rounds'}</button><details><summary>Benchmark result</summary><pre id="benchmark-result">{report}</pre></details></aside></>;
}
const queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});
createRoot(document.getElementById('root')!).render(new URLSearchParams(location.search).has('benchmark')?<QueryClientProvider client={queryClient}><Benchmark/></QueryClientProvider>:<Audit/>);
