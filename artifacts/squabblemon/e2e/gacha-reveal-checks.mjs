import assert from 'node:assert/strict';
import {expect} from '@playwright/test';

/** Inspect only the finite entrance effects, excluding the print's existing foil. */
export async function entranceAnimations(flip){
 const animations=await flip.evaluate(node=>node.getAnimations({subtree:true}).filter(animation=>animation.animationName?.startsWith('gacha-')).map(animation=>({name:animation.animationName,duration:animation.effect.getTiming().duration,delay:animation.effect.getTiming().delay,iterations:animation.effect.getTiming().iterations,state:animation.playState})));
 assert.ok(animations.some(animation=>animation.name==='gacha-card-arrival'),'The real card has an entrance');
 for(const animation of animations){assert.equal(animation.iterations,1,`${animation.name} is finite`);assert.ok(animation.duration>0&&animation.duration<=300,`${animation.name} finishes promptly`);assert.equal(animation.delay,0,'Cards never wait before appearing');}
 assert.deepEqual(animations.map(animation=>animation.name),['gacha-card-arrival'],'Only the brief card settle animates');
 return animations;
}

export async function settledEntrance(flip,{contain=false}={}){
 const animations=await entranceAnimations(flip);
 await expect.poll(()=>flip.evaluate(node=>node.getAnimations({subtree:true}).filter(animation=>animation.animationName?.startsWith('gacha-')&&animation.playState!=='finished').map(animation=>animation.animationName)),{timeout:4000}).toEqual([]);
 const state=await flip.evaluate(node=>{
  const target=node.querySelector('.gacha-reveal__card-target')??node.querySelector('.gacha-reward-print');
  const print=node.querySelector('.gacha-reward-print'),content=node.closest('.gacha-reveal__content'),impact=node.querySelector('.gacha-reveal__impact');
  const box=print.getBoundingClientRect(),bounds=content.getBoundingClientRect(),style=getComputedStyle(target);
  const caption=node.closest('.gacha-reveal__single')?.querySelector('.gacha-reveal__caption');
  return{captionOpacity:caption?getComputedStyle(caption).opacity:null,opacity:style.opacity,transform:style.transform,identity:style.transform==='none'||new DOMMatrix(style.transform).isIdentity,width:box.width,height:box.height,contained:box.left>=bounds.left-1&&box.right<=bounds.right+1&&box.top>=bounds.top-1&&box.bottom<=bounds.bottom+1,impact:impact?{opacities:[...impact.children].map(child=>getComputedStyle(child).opacity),pointerEvents:getComputedStyle(impact).pointerEvents,hidden:impact.getAttribute('aria-hidden')}:null};
 });
 assert.equal(state.opacity,'1');assert.equal(state.identity,true,'Card settles into the untransformed print');
 assert.ok(Math.abs(state.width/state.height-63/88)<.005,'The full card retains its authored aspect ratio');
 if(contain)assert.ok(state.contained,JSON.stringify(state));
 assert.equal(state.impact,null,'The removed card-impact effects never mount');assert.equal(state.captionOpacity,'1','The caption is visible immediately');
 return{animations,...state};
}
