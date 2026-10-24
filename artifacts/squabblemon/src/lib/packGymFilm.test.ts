import assert from 'node:assert/strict';
import test from 'node:test';
import { startPackGymFilm, type PackGymFilmState } from './packGymFilm';
function fakeFilm(readyState = 2) {
  const events = new EventTarget(); let callback: (() => void) | undefined;
  const video = Object.assign(events, { readyState, muted:false, error:null, currentTime:0, playbackRate:1, paused:true, plays:0,
    play() { this.paused=false; this.plays++; return Promise.resolve(); }, pause() { this.paused=true; },
    requestVideoFrameCallback(cb: () => void) { callback=cb; return 1; }, cancelVideoFrameCallback() { callback=undefined; },
  });
  const states: PackGymFilmState[]=[]; let now=1850;
  const begin=(active=true,paused=false)=>startPackGymFilm({video:video as unknown as HTMLVideoElement,active,paused,speed:1,elapsed:()=>now,start:1850,duration:1.4,onState:s=>states.push(s)});
  return {video, states, begin, at(t:number){now=t;}, event(name:string){events.dispatchEvent(new Event(name));}, frame(){const cb=callback;callback=undefined;cb?.();}};
}
test('armed video loads silently at zero without playing; decoded frame owns visibility', async()=>{
  const f=fakeFilm();const stop=f.begin(false);assert.equal(f.video.plays,0);assert.equal(f.video.currentTime,0);assert.equal(f.video.muted,true);stop();
  const finish=f.begin();assert.equal(f.video.plays,1);assert.equal(f.states.at(-1),'poster');await Promise.resolve();f.frame();assert.equal(f.states.at(-1),'playing');finish();assert.equal(f.video.paused,true);
});
test('late data joins visible time; an expired shot never starts',()=>{
  const f=fakeFilm(0);const stop=f.begin();f.at(2350);f.video.readyState=2;f.event('loadeddata');assert.equal(f.video.currentTime,.5);assert.equal(f.video.plays,1);stop();
  f.at(3300);const expired=f.begin();f.event('canplay');assert.equal(f.video.plays,1);expired();
});
test('hidden pause freezes playback and resume seeks only visible elapsed time',()=>{
  const f=fakeFilm();f.at(2150);const stop=f.begin();assert.equal(f.video.currentTime,.3);stop();const hidden=f.begin(true,true);assert.equal(f.video.paused,true);assert.equal(f.video.plays,1);hidden();const resumed=f.begin();assert.equal(f.video.currentTime,.3);assert.equal(f.video.plays,2);resumed();
});
test('rejected play falls back; stale rejection after cleanup cannot corrupt a resumed video',async()=>{
  const f=fakeFilm();let reject!: (error:Error)=>void;
  f.video.play=()=>new Promise<void>((_,r)=>{reject=r;});const stop=f.begin();stop();const before=f.states.length;reject(new Error('aborted by cleanup'));await Promise.resolve();await Promise.resolve();assert.equal(f.states.length,before);
  const done=f.begin();reject(new Error('autoplay denied'));await Promise.resolve();await Promise.resolve();assert.equal(f.states.at(-1),'failed');assert.equal(f.video.paused,true);done();
});
test('failed decoding stays on poster and cleanup prevents all later callbacks',async()=>{
  const f=fakeFilm();const stop=f.begin();f.event('error');assert.equal(f.states.at(-1),'failed');await Promise.resolve();f.frame();assert.equal(f.states.at(-1),'failed');stop();const before=f.states.length;f.event('loadeddata');f.event('playing');f.frame();assert.equal(f.states.length,before);
});

test('buffer recovery retains the last good frame and rejoins the current shot time',async()=>{
  const f=fakeFilm();const stop=f.begin();await Promise.resolve();f.frame();f.video.currentTime=.2;
  f.event('waiting');assert.equal(f.states.at(-1),'playing');f.at(2650);f.event('canplay');
  assert.equal(f.video.currentTime,.8);assert.equal(f.video.plays,2);await Promise.resolve();f.frame();assert.equal(f.states.at(-1),'playing');stop();
});


test('buffering before any presented frame keeps the poster until a real frame arrives', async () => {
  const f=fakeFilm();const stop=f.begin();await Promise.resolve();
  f.event('waiting');f.frame();assert.equal(f.states.at(-1),'poster');
  f.at(2200);f.event('canplay');await Promise.resolve();f.frame();
  assert.equal(f.states.at(-1),'playing');stop();
});
test('late buffering keeps the last frame until the shot expires without replay or delayed callbacks', async () => {
  const f=fakeFilm();const stop=f.begin();await Promise.resolve();f.frame();
  f.at(3249);f.video.currentTime=1.39;f.event('waiting');
  assert.equal(f.states.at(-1),'playing');assert.equal(f.video.currentTime,1.39);
  const plays=f.video.plays;f.at(3251);f.event('canplay');
  assert.equal(f.video.plays,plays,'an expired shot never restarts');
  assert.equal(f.states.at(-1),'playing','its last visible frame is not replaced by the poster');
  stop();const states=f.states.length;f.event('canplay');f.event('playing');f.frame();assert.equal(f.states.length,states);
});
