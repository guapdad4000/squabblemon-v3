type Job = { src: string; resolve: (ready: boolean) => void };
const pending: Job[] = [];
const requests = new Map<string, Promise<boolean>>();
const completed: string[] = [];
let active = 0;
const CONCURRENCY = 3;
const HISTORY_LIMIT = 96;
const QUEUE_LIMIT = 64;

function drain() {
  while (active < CONCURRENCY && pending.length) {
    const job = pending.shift()!;
    active++;
    const image = new Image();
    image.decoding = 'async';
    image.fetchPriority = 'low';
    let settled = false;
    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      image.onload = image.onerror = null;
      // Keep request history bounded, without retaining decoded full-size images.
      if (ready) {
        completed.push(job.src);
        if (completed.length > HISTORY_LIMIT) requests.delete(completed.shift()!);
      } else requests.delete(job.src);
      active--;
      job.resolve(ready);
      drain();
    };
    const timeout = setTimeout(() => { image.removeAttribute('src'); finish(false); }, 8000);
    image.onload = () => {
      if (image.decode) void image.decode().then(() => finish(true), () => finish(false));
      else finish(true);
    };
    image.onerror = () => finish(false);
    image.src = job.src;
  }
}

/** Fetch and decode upcoming art without blocking input or flooding the network. */
export function warmImages(sources: readonly string[]): Promise<boolean[]> {
  if (typeof Image === 'undefined') return Promise.resolve([]);
  return Promise.all([...new Set(sources)].map(src => {
    const existing = requests.get(src);
    if (existing) return existing;
    // Rapidly browsing decks must not enqueue the entire collection.
    if (pending.length >= QUEUE_LIMIT) return Promise.resolve(false);
    let resolve!: Job['resolve'];
    const promise = new Promise<boolean>(done => { resolve = done; });
    requests.set(src, promise);
    pending.push({ src, resolve });
    drain();
    return promise;
  }));
}
