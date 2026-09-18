import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

let origin = process.env.BATTLE_PERF_ORIGIN;
let preview;
if (!origin) {
  const perfEnv = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: '4174',
    BASE_PATH: '/',
    PUBLIC_ORIGIN: 'http://127.0.0.1:4174',
    VITE_BATTLE_PERF: '1',
  };
  const build = spawnSync('pnpm', ['exec', 'vite', 'build', '--config', 'vite.config.ts'], { env: perfEnv, stdio: 'inherit' });
  if (build.status !== 0) throw new Error('The optimized battle performance build failed.');
  preview = spawn('pnpm', ['exec', 'vite', 'preview', '--config', 'vite.config.ts', '--host', '127.0.0.1'], {
    env: perfEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  origin = 'http://127.0.0.1:4174';
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      if ((await fetch(origin)).ok) break;
    } catch {}
    if (attempt === 99) throw new Error('The optimized battle performance preview did not become ready.');
    await delay(100);
  }
}

const chromium = process.env.CHROMIUM_PATH || '/repl/tools/bin/chromium';
const debuggingPort = 9333;
const browser = spawn(chromium, [
  '--headless=new',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  `--remote-debugging-port=${debuggingPort}`,
  '--user-data-dir=/tmp/squabblemon-battle-perf',
  'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] });

const pending = new Map();
let nextId = 1;
let socket;

async function connect() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${debuggingPort}/json`);
      const page = (await targets.json()).find((target) => target.type === 'page');
      if (page) {
        socket = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => {
          socket.addEventListener('open', resolve, { once: true });
          socket.addEventListener('error', reject, { once: true });
        });
        socket.addEventListener('message', ({ data }) => {
          const message = JSON.parse(data);
          if (!message.id) return;
          const handler = pending.get(message.id);
          if (!handler) return;
          pending.delete(message.id);
          message.error ? handler.reject(new Error(message.error.message)) : handler.resolve(message.result);
        });
        return;
      }
    } catch {}
    await delay(100);
  }
  throw new Error('Chromium DevTools endpoint did not become ready.');
}

function command(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression, awaitPromise = false) {
  const result = await command('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}

const budgets = {
  standard: { maxLongTasks: 18, maxLongTaskMs: 1800, maxP95FrameMs: 125, maxDroppedFrameRatio: 0.65, maxCommits: 105, maxRenderDurationMs: 3000 },
  reduced: { maxLongTasks: 18, maxLongTaskMs: 1800, maxP95FrameMs: 175, maxDroppedFrameRatio: 0.65, maxCommits: 105, maxRenderDurationMs: 3000 },
};

async function runMode(mode) {
  await command('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: mode === 'reduced' ? 'reduce' : 'no-preference' }],
  });
  await command('Page.navigate', { url: `${origin}/?__battle_perf=1&motion=${mode}` });
  await evaluate(`new Promise((resolve, reject) => {
    const started = performance.now();
    const poll = () => window.__battlePerf?.ready
      ? resolve(true)
      : performance.now() - started > 10000
        ? reject(new Error('Battle performance harness timed out'))
        : setTimeout(poll, 25);
    poll();
  })`, true);

  return evaluate(`(async () => {
    if (!PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
      throw new Error('This Chromium build does not support long-task observation');
    }
    const longTasks = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) longTasks.push(entry.duration);
    });
    try { observer.observe({ type: 'longtask' }); } catch {}
    const frames = [];
    let previous = performance.now();
    let collecting = true;
    const sample = (now) => {
      frames.push(now - previous);
      previous = now;
      if (collecting) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    const react = await window.__battlePerf.run();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise((resolve) => setTimeout(resolve, 0));
    collecting = false;
    observer.disconnect();
    const stableFrames = frames.filter((value) => value > 0).sort((a, b) => a - b);
    const p95FrameMs = stableFrames[Math.max(0, Math.ceil(stableFrames.length * .95) - 1)] || 0;
    const droppedFrames = stableFrames.filter((value) => value > 34).length;
    return {
      ...react,
      longTasks: longTasks.length,
      longTaskMs: longTasks.reduce((sum, value) => sum + value, 0),
      sampledFrames: stableFrames.length,
      p95FrameMs,
      droppedFrameRatio: stableFrames.length ? droppedFrames / stableFrames.length : 1,
      boardCards: document.querySelectorAll('[data-card-zone="board"]').length,
      viewport: [innerWidth, innerHeight],
    };
  })()`, true);
}

try {
  await connect();
  await command('Page.enable');
  await command('Runtime.enable');
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await command('Emulation.setCPUThrottlingRate', { rate: 4 });

  const results = {};
  for (const mode of ['standard', 'reduced']) {
    results[mode] = await runMode(mode);
    console.log(`${mode}: ${JSON.stringify(results[mode])}`);
  }
  for (const mode of ['standard', 'reduced']) {
    const metrics = results[mode];
    const budget = budgets[mode];
    assert.deepEqual(metrics.viewport, [390, 844], `${mode}: representative mobile viewport changed`);
    assert.equal(metrics.occupiedDistricts, 3, `${mode}: all three districts must be occupied`);
    assert.equal(metrics.boardCards, 12, `${mode}: six rounds must leave twelve cards on the board`);
    assert.ok(metrics.sampledFrames >= 20, `${mode}: too few animation frames were sampled`);
    assert.ok(metrics.commits > 0, `${mode}: React profiling did not record any commits`);
    assert.ok(metrics.renderDurationMs > 0, `${mode}: React profiling did not record render duration`);
    assert.ok(metrics.longTasks <= budget.maxLongTasks, `${mode}: ${metrics.longTasks} long tasks exceeds ${budget.maxLongTasks}`);
    assert.ok(metrics.longTaskMs <= budget.maxLongTaskMs, `${mode}: ${metrics.longTaskMs.toFixed(1)}ms long-task time exceeds ${budget.maxLongTaskMs}ms`);
    assert.ok(metrics.p95FrameMs <= budget.maxP95FrameMs, `${mode}: p95 frame ${metrics.p95FrameMs.toFixed(1)}ms exceeds ${budget.maxP95FrameMs}ms`);
    assert.ok(metrics.droppedFrameRatio <= budget.maxDroppedFrameRatio, `${mode}: ${(metrics.droppedFrameRatio * 100).toFixed(1)}% dropped frames exceeds ${budget.maxDroppedFrameRatio * 100}%`);
    assert.ok(metrics.commits <= budget.maxCommits, `${mode}: ${metrics.commits} React commits exceeds ${budget.maxCommits}`);
    assert.ok(metrics.renderDurationMs <= budget.maxRenderDurationMs, `${mode}: ${metrics.renderDurationMs.toFixed(1)}ms React render time exceeds ${budget.maxRenderDurationMs}ms`);
  }
} finally {
  socket?.close();
  browser.kill('SIGTERM');
  preview?.kill('SIGTERM');
}