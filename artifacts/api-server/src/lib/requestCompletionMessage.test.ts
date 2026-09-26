import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import express from 'express';
import pino from 'pino';
import pinoHttp from 'pino-http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { requestCompletionMessage } from './requestCompletionMessage';
import { runWithDeploymentContext } from './runtimeDeploymentContext';
import { webRequestAdapter } from './webRequestAdapter';

const deploy = { context: 'production', deployId: 'deploy-test', origin: 'https://game.example' };

function captureLogger() {
  const entries: { msg?: string; res?: { statusCode?: number } }[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      entries.push(JSON.parse(chunk.toString()));
      callback();
    },
  });
  return { entries, logger: pino({ level: 'info' }, stream) };
}

test('Netlify invocations log a payment webhook 200 as completed, not aborted', async () => {
  const { entries, logger } = captureLogger();
  const app = express();
  app.use(pinoHttp({ logger, customSuccessMessage: requestCompletionMessage }));
  app.post('/api/payments/webhook', (_req, res) => res.status(200).json({ received: true }));

  const response = await runWithDeploymentContext(deploy, () =>
    webRequestAdapter(app)(
      new Request('https://game.example/api/payments/webhook', { method: 'POST', body: '{}' }),
    ));
  assert.equal(response.status, 200);
  // serverless-http resolves after the response lifecycle events; the log
  // entry must exist synchronously once the invocation returns.
  const completion = entries.find(entry => entry.msg?.startsWith('request '));
  assert.equal(completion?.msg, 'request completed');
  assert.equal(completion?.res?.statusCode, 200);
});

test('Netlify invocations still log a response that never flushed as aborted', async () => {
  const { entries, logger } = captureLogger();
  const app = express();
  app.use(pinoHttp({ logger, customSuccessMessage: requestCompletionMessage }));
  app.get('/api/hang', (_req, res) => {
    // Tear the mock response down without flushing, as a failed invocation
    // would; the invocation promise never settles, so do not await it.
    res.emit('close');
  });

  runWithDeploymentContext(deploy, () =>
    webRequestAdapter(app)(new Request('https://game.example/api/hang')),
  ).catch(() => undefined);
  let completion;
  const deadline = Date.now() + 5_000;
  while (!completion && Date.now() < deadline) {
    completion = entries.find(entry => entry.msg?.startsWith('request '));
    if (!completion) await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.equal(completion?.msg, 'request aborted');
});

test('direct HTTP path keeps the socket-lifecycle heuristic', () => {
  const req = { readableAborted: false } as IncomingMessage;
  assert.equal(
    requestCompletionMessage(req, { writableEnded: true } as ServerResponse),
    'request completed',
  );
  assert.equal(
    requestCompletionMessage(req, { writableEnded: false } as ServerResponse),
    'request aborted',
  );
  assert.equal(
    requestCompletionMessage(
      { readableAborted: true } as IncomingMessage,
      { writableEnded: true } as ServerResponse,
    ),
    'request aborted',
  );
});
