// The display accepts game state without claiming the environment has a campaign engine.
export const demoStory = Object.freeze({demo:true,chapter:3,totalChapters:7,title:'EARN YOUR RESPECT',completedChapters:2,objective:'Win the corner-store showdown',wins:4,targetWins:10});
export function normalizeStory(value={}) {
  const integer=(v,fallback,min,max)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Math.floor(Number(v)))):fallback;
  const totalChapters=integer(value.totalChapters,7,1,50);
  const chapter=integer(value.chapter,1,1,totalChapters);
  const targetWins=integer(value.targetWins,1,1,999);
  return {demo:value.demo===true,chapter,totalChapters,title:String(value.title??'THE BLOCK IS HOT').slice(0,48),completedChapters:integer(value.completedChapters,0,0,totalChapters),objective:String(value.objective??'Your next chapter starts here').slice(0,100),wins:integer(value.wins,0,0,targetWins),targetWins};
}
export function campaignPercent(s){return Math.round(s.completedChapters/s.totalChapters*100);}
