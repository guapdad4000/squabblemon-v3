import { computeBattleJob, type BattleJob } from './battleComputation';
export type WorkerPort = Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror' | 'onmessageerror'>;
type Task = { id: number; job: BattleJob; resolve: (value: ReturnType<typeof computeBattleJob>) => void; reject: (error: Error) => void };
const aborted = () => new DOMException('Battle computation cancelled', 'AbortError');
/** One running task and one latest pending task: rapid selection never grows a queue. */
export class BattleWorkerClient {
  private worker: WorkerPort | null = null;
  private running: Task | null = null;
  private queued: Task | null = null;
  private sequence = 0;
  private watchdog: ReturnType<typeof setTimeout> | undefined;
  private closed = false;
  constructor(private factory: () => WorkerPort = () => new Worker(new URL('./battleComputation.worker.ts', import.meta.url), { type: 'module' })) { this.initialize(); }
  private initialize() {
    try {
      this.worker = this.factory();
      this.worker.onmessage = event => {
        const task = this.running;
        if (!task || event.data.id !== task.id) return;
        this.running = null; clearTimeout(this.watchdog);
        if (event.data.error) this.fallback(task); else task.resolve(event.data.result);
        this.drain();
      };
      this.worker.onerror = this.worker.onmessageerror = () => this.fail();
    } catch { this.worker = null; }
  }
  private fail() {
    clearTimeout(this.watchdog);
    this.worker?.terminate(); this.worker = null;
    const task = this.running; this.running = null;
    if (task) this.fallback(task);
    this.drain();
  }
  private fallback(task: Task) {
    // Same deterministic implementation on platforms without module workers.
    try { task.resolve(computeBattleJob(task.job)); } catch (error) { task.reject(error as Error); }
  }
  private drain() {
    if (this.closed || this.running || !this.queued) return;
    const task = this.queued; this.queued = null;
    if (!this.worker) { this.fallback(task); return; }
    this.running = task;
    // Recovery for an evicted/hung worker; no delay is added to successful jobs.
    this.watchdog = setTimeout(() => this.fail(), 15000);
    try { this.worker.postMessage({ id: task.id, job: task.job }); } catch { this.fail(); }
  }
  request(job: BattleJob) {
    if (this.closed) return Promise.reject(aborted());
    // A late selection forecast cannot cancel an authoritative local rival turn.
    if (job.kind === 'previews' && this.queued?.job.kind === 'rival') return Promise.reject(aborted());
    this.queued?.reject(aborted());
    const result = new Promise<ReturnType<typeof computeBattleJob>>((resolve, reject) => {
      this.queued = { id: ++this.sequence, job, resolve, reject };
    });
    this.drain(); return result;
  }
  cancel() {
    if (!this.running && !this.queued) return;
    clearTimeout(this.watchdog);
    this.worker?.terminate(); this.worker = null;
    this.running?.reject(aborted()); this.queued?.reject(aborted()); this.running = this.queued = null;
    if (!this.closed) this.initialize();
  }
  dispose() {
    clearTimeout(this.watchdog);
    this.closed = true; this.worker?.terminate(); this.worker = null;
    this.running?.reject(aborted()); this.queued?.reject(aborted()); this.running = this.queued = null;
  }
}
