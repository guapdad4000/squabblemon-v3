// Shared scene protocol; the React timing mirror is asserted by packGymFinale.test.ts.
export const PACK_GYM_FINALE_TIMING = Object.freeze({ compression: 0, contact: 90, release: 230, flight: 350, pov: 1250, impact: 2650, settle: 5317, single: 5317, ten: 5317, reduced: 220 });
// The crash film extends the screen hold, not the original mesh recoil/debris motion.
export const PACK_GYM_FINALE_EFFECTS = Object.freeze({ recoil: 450, debris: 1350 });
export const PACK_GYM_RARITY_FLIGHT = Object.freeze({
  SuperCommon: { distance: 16, color: '#cbb99c', label: 'Super Common' },
  Common: { distance: 20, color: '#a8ada9', label: 'Common' },
  Uncommon: { distance: 23, color: '#4ade80', label: 'Uncommon' },
  Rare: { distance: 26, color: '#3b82f6', label: 'Rare' },
  Epic: { distance: 30, color: '#a855f7', label: 'Super Rare' },
  Legendary: { distance: 34, color: '#eab308', label: 'Legendary' },
  Mythical: { distance: 38, color: '#ef4444', label: 'Mythical' },
});
export function normalizePackGymRarity(value) {
  return typeof value === 'string' && Object.hasOwn(PACK_GYM_RARITY_FLIGHT, value) ? value : 'Common';
}
const clamp = value => Math.max(0, Math.min(1, value));
export function packGymFinaleSpeed(speed) { return Number.isFinite(speed) ? Math.max(.5, Math.min(1.25, speed)) : 1; }
const hermite = (t, startSlope, endSlope) => (t*t*t-2*t*t+t)*startSlope + (-2*t*t*t+3*t*t) + (t*t*t-t*t)*endSlope;
/** A strong impulse covers 75% in 900ms; both monotonic segments meet with the same velocity. */
export function packGymFlightProgress(elapsed) {
  const { flight, pov, impact } = PACK_GYM_FINALE_TIMING;
  if (elapsed <= flight) return 0;
  if (elapsed < pov) return .75 * hermite(clamp((elapsed-flight)/(pov-flight)), 1.35, .75);
  return .75 + .25 * hermite(clamp((elapsed-pov)/(impact-pov)), 3.5, .25);
}
/** Absolute animation time keeps mesh travel, camera recoil and debris independent of frame rate. */
export function bagFinaleFrame(elapsed, ten = false, rarity = 'Common') {
  const t = Math.max(0, elapsed), { flight, pov, impact } = PACK_GYM_FINALE_TIMING;
  const travel = packGymFlightProgress(t);
  const profile = PACK_GYM_RARITY_FLIGHT[normalizePackGymRarity(rarity)];
  const burst = clamp((t - impact) / PACK_GYM_FINALE_EFFECTS.debris);
  const launchRecoil = 1 - clamp((t - flight) / 600);
  const following = t >= flight && t < impact;
  const follow = following ? travel * .20 : 0;
  const impactRecoil = t >= impact ? 1 - clamp((t - impact) / PACK_GYM_FINALE_EFFECTS.recoil) : 0;
  const heldContact = t < flight;
  const cameraZ = heldContact ? -1.4 : t < impact ? 1.1 * launchRecoil * launchRecoil - profile.distance * follow : .85 * impactRecoil * impactRecoil;
  const cameraFov = heldContact ? 41 : 45 + (t < impact ? 4 * launchRecoil - 2 * clamp((t-flight)/(pov-flight)) : 2.5 * impactRecoil);
  const kick = heldContact ? 0 : t < impact ? launchRecoil : impactRecoil;
  return { x: .3 * travel, y: 1.35 * travel, z: -profile.distance * travel, scale: 1 - .18 * travel,
    rotate: .72 * travel, impact: t >= impact,
    visible: !ten || t < impact, burst,
    distance: profile.distance, color: profile.color,
    cameraZ, cameraFov, cameraX: (following ? .3 * travel * .65 : 0) + Math.sin(t * .047) * .09 * kick,
    cameraY: (following ? 1.35 * travel * .65 : 0) + Math.sin(t * .061) * .055 * kick, cameraRoll: Math.sin(t * .036) * .016 * kick,
    done: t >= (ten ? PACK_GYM_FINALE_TIMING.ten : PACK_GYM_FINALE_TIMING.single) };
}


// The supplied trims are finite and played once against the visible-time finale clock.
export const PACK_GYM_FINALE_SOUNDS = Object.freeze([
  { at: PACK_GYM_FINALE_TIMING.contact, name: 'bag-impact', duration: 420, gain: .8 },
  { at: PACK_GYM_FINALE_TIMING.release, name: 'travel-wind-launch-v3', duration: 2420, gain: .66 },
  { at: PACK_GYM_FINALE_TIMING.release, name: 'chain-rattle', duration: 360, gain: .38 },
  { at: PACK_GYM_FINALE_TIMING.impact, name: 'impact-cels', duration: 320, gain: .9 },
]);
export function takePackGymFinaleSounds(elapsed, played) {
  const due = [];
  for (const cue of PACK_GYM_FINALE_SOUNDS) {
    if (elapsed < cue.at || played.has(cue.name)) continue;
    played.add(cue.name);
    // Never dump expired cues after a stalled frame or while unmuting.
    if (elapsed < cue.at + cue.duration) due.push(cue);
  }
  return due;
}
/** Injectable audio lifecycle keeps mute, speed, clipping and cleanup independently testable. */
export function createPackGymAudio({ source, createAudio, blocked = () => false }) {
  let enabled = false, volume = 1, speed = 1, disposed = false;
  const clips = new Set(), warm = new Map();
  const names = new Set(PACK_GYM_FINALE_SOUNDS.map(cue => cue.name));
  const clampVolume = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
  const clampSpeed = value => Number.isFinite(value) ? Math.max(.5, Math.min(2, value)) : 1;
  const stop = () => { for (const audio of clips) { audio.pause(); audio.onended = audio.onerror = null; } clips.clear(); };
  const engine = {
    clips,
    configure(settings) {
      if (disposed) return;
      enabled = Boolean(settings.enabled);
      if (settings.volume !== undefined) volume = clampVolume(settings.volume);
      if (settings.speed !== undefined) speed = clampSpeed(settings.speed);
      if (!enabled || volume === 0) stop();
      else for (const audio of clips) audio.volume = volume * audio._packGain;
    },
    init() {
      if (!enabled || disposed || blocked()) return;
      for (const name of names) if (!warm.has(name)) { const audio = createAudio(source(name)); audio.preload = 'auto'; warm.set(name, audio); }
    },
    sample(name, gain = .82, rate = speed) {
      if (!enabled || volume === 0 || disposed || blocked() || !names.has(name)) return;
      const audio = createAudio(source(name));
      audio._packGain = clampVolume(gain); audio.volume = volume * audio._packGain;
      audio.playbackRate = clampSpeed(rate); clips.add(audio);
      const release = () => { clips.delete(audio); audio.onended = audio.onerror = null; };
      audio.onended = release; audio.onerror = release;
      // Autoplay rejection stays silent; no synthetic replacement overlaps later cues.
      try { Promise.resolve(audio.play()).catch(release); } catch { release(); }
    },
    playPunch() { this.sample('bag-impact', .62); this.sample('chain-rattle', .3); },
    stop,
    dispose() {
      disposed = true; stop();
      for (const audio of warm.values()) { audio.pause(); audio.removeAttribute?.('src'); audio.load?.(); }
      warm.clear();
    },
  };
  return engine;
}
