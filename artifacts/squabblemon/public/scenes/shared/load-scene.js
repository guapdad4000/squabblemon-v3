import { detectGPUQuality } from './gpu-quality.js';

const quality=await detectGPUQuality();
if(quality.tier==='static'){
  const stage=document.querySelector('#stage, #webgl-container');
  if(stage){
    stage.replaceChildren();
    stage.setAttribute('aria-label','Static scene preview');
    if(location.pathname.includes('/safehouse/')){
      const poster=new Image();
      poster.src='concept.webp';
      poster.alt='Safehouse concept art';
      Object.assign(poster.style,{width:'100%',height:'100%',objectFit:'cover'});
      stage.append(poster);
    } else {
      Object.assign(stage.style,{background:'linear-gradient(145deg,#131e26,#574027 65%,#15171b)'});
      const label=document.createElement('p');
      label.textContent='THE GYM · HEAVY BAG';
      Object.assign(label.style,{color:'#f1d18b',position:'absolute',left:'24px',bottom:'24px',font:'bold 22px sans-serif'});
      stage.append(label);
    }
  }
}else{
  if(location.pathname.includes('/safehouse/')){
    // Fetch the required renderer alongside scene.js, rather than waiting for
    // its import graph. Static/reduced-motion previews never request it.
    const rendererHint=document.createElement('link');
    rendererHint.rel='modulepreload';
    rendererHint.href=new URL('./three.module.js',import.meta.url).href;
    document.head.append(rendererHint);
  }
  await import(location.pathname.includes('/safehouse/')?'../safehouse/scene.js':'../gym/scene.js');
}