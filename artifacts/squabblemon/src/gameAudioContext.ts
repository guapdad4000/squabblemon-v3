// Music and synthesized battle feedback share one output clock on mobile browsers.
// Neither channel owns this context: its gain and source nodes remain independent.
let context: AudioContext | undefined;

export function getGameAudioContext(): AudioContext | undefined {
  if (context && context.state !== 'closed') return context;
  const Context = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return undefined;
  try { return context = new Context(); } catch { return undefined; }
}