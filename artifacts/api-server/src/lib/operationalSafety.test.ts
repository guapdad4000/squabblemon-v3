import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";
import express from "express";
import pino from "pino";
import {
  acceptedCorrelationId,
  campaignLogProps,
  requestId,
} from "./requestContext";
import { redactedLoggerPaths } from "./logger";
import {
  databaseIdentity,
  deployedEnvironmentIdentity,
} from "./deploymentIdentity";
import {
  currentDeploymentContext,
  runWithDeploymentContext,
} from "./runtimeDeploymentContext";

test("request and campaign IDs accept bounded safe values and replace hostile values", () => {
  assert.equal(
    acceptedCorrelationId("campaign-2026.09:abc"),
    "campaign-2026.09:abc",
  );
  assert.equal(
    acceptedCorrelationId("bad value\nAuthorization: secret"),
    undefined,
  );
  assert.equal(acceptedCorrelationId("x".repeat(81)), undefined);
  const headers = {
    "x-request-id": "bad value",
    "x-campaign-run-id": "run_123",
  };
  const responseHeaders = new Map<string, string>();
  const id = requestId(
    { headers } as never,
    {
      setHeader: (name: string, value: string) =>
        responseHeaders.set(name, value),
    } as never,
  );
  assert.match(id, /^[0-9a-f-]{36}$/);
  assert.equal(responseHeaders.get("x-request-id"), id);
  assert.deepEqual(campaignLogProps({ headers } as never), {
    campaignRunId: "run_123",
  });
});

test("logger paths redact credentials and cookies", async () => {
  const destination = new PassThrough();
  let output = "";
  destination.on("data", chunk => {
    output += chunk.toString();
  });
  const log = pino({ redact: redactedLoggerPaths }, destination);
  log.info({
    req: {
      headers: {
        authorization: "Bearer private",
        cookie: "session=private",
      },
    },
    res: { headers: { "set-cookie": "session=private" } },
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.doesNotMatch(output, /Bearer private|session=private/);
  assert.match(output, /\[Redacted\]/);
});

test("readiness reports only availability and never returns connection errors", async t => {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@127.0.0.1:55439/postgres";
  const { createHealthRouter } = await import("../routes/health");
  const app = express();
  app.use((req, _res, next) => {
    (req as any).log = { error() {} };
    next();
  });
  app.use("/api", createHealthRouter(async () => {}));
  app.use(
    "/failed",
    createHealthRouter(async () => {
      throw new Error(
        "postgresql://user:password@secret.internal/database",
      );
    }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(
    () => new Promise<void>(resolve => server.close(() => resolve())),
  );
  const address = server.address();
  assert(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const ready = await fetch(`${origin}/api/readyz`);
  assert.equal(ready.status, 200);
  assert.deepEqual(await ready.json(), { status: "ok" });
  const failed = await fetch(`${origin}/failed/readyz`);
  const body = await failed.text();
  assert.equal(failed.status, 503);
  assert.equal(body, '{"status":"unavailable"}');
  assert.doesNotMatch(body, /postgres|password|secret|internal/i);
});

test("deployment identity uses trusted runtime deploy values and request origin", () => {
  const databaseUrl =
    "postgresql://user:secret@stage-db.example:5432/campaign";
  const runtime = {
    context: "deploy-preview",
    deployId: "deploy-123",
    origin: "https://deploy-123.example.netlify.app",
  };
  const environment = {
    CLERK_PUBLISHABLE_KEY: "pk_test_stage",
    DATABASE_URL: databaseUrl,
  };
  assert.deepEqual(deployedEnvironmentIdentity(environment, runtime), {
    environment: "staging",
    context: "deploy-preview",
    deployId: "deploy-123",
    origin: "https://deploy-123.example.netlify.app",
    databaseFingerprint: databaseIdentity(databaseUrl),
    clerkEnvironment: "test",
  });
  assert.deepEqual(
    deployedEnvironmentIdentity(
      { ...environment, DATABASE_URL: undefined },
      runtime,
      databaseUrl,
    ),
    {
      environment: "staging",
      context: "deploy-preview",
      deployId: "deploy-123",
      origin: "https://deploy-123.example.netlify.app",
      databaseFingerprint: databaseIdentity(databaseUrl),
      clerkEnvironment: "test",
    },
  );
  assert.throws(
    () =>
      deployedEnvironmentIdentity(
        { ...environment, APP_ENV: "production" },
        runtime,
      ),
    /does not match/,
  );
  assert.throws(
    () =>
      deployedEnvironmentIdentity(
        { ...environment, CONTEXT: "production" },
        runtime,
      ),
    /Runtime deployment context/,
  );
  assert.throws(
    () =>
      deployedEnvironmentIdentity(
        { ...environment, DEPLOY_ID: "deploy-other" },
        runtime,
      ),
    /Runtime deployment ID/,
  );
  assert.throws(
    () =>
      deployedEnvironmentIdentity(environment, {
        ...runtime,
        origin: "http://deploy-123.example.netlify.app",
      }),
    /HTTPS origin/,
  );
});

test("deployment identity retains an explicit local and test fallback", () => {
  const databaseUrl =
    "postgresql://user:secret@stage-db.example:5432/campaign";
  assert.deepEqual(
    deployedEnvironmentIdentity({
      APP_ENV: "staging",
      CONTEXT: "branch-deploy",
      DEPLOY_ID: "deploy-456",
      DEPLOY_PRIME_URL:
        "https://deploy-456.example.netlify.app",
      CLERK_PUBLISHABLE_KEY: "pk_test_stage",
      DATABASE_URL: databaseUrl,
    }),
    {
      environment: "staging",
      context: "branch-deploy",
      deployId: "deploy-456",
      origin: "https://deploy-456.example.netlify.app",
      databaseFingerprint: databaseIdentity(databaseUrl),
      clerkEnvironment: "test",
    },
  );
});

test("Netlify runtime identity remains isolated across asynchronous requests", async () => {
  const runtime = {
    context: "deploy-preview",
    deployId: "deploy-123",
    origin: "https://deploy-123.example.netlify.app",
  };
  assert.equal(currentDeploymentContext(), undefined);
  await runWithDeploymentContext(runtime, async () => {
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(currentDeploymentContext(), runtime);
  });
  assert.equal(currentDeploymentContext(), undefined);
});

test("readiness times out and deployment identity returns only attested non-secret fields", async t => {
  const { createHealthRouter } = await import("../routes/health");
  const app = express();
  app.use((req, _res, next) => {
    (req as any).log = { error() {} };
    next();
  });
  app.use(
    "/api",
    createHealthRouter(
      () => new Promise<void>(() => {}),
      () => ({
        environment: "staging",
        context: "deploy-preview",
        deployId: "deploy-123",
        origin: "https://deploy-123.example.netlify.app",
        databaseFingerprint: "0123456789abcdef",
        clerkEnvironment: "test",
      }),
      20,
    ),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  t.after(
    () => new Promise<void>(resolve => server.close(() => resolve())),
  );
  const address = server.address();
  assert(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const started = Date.now();
  const readiness = await fetch(`${origin}/api/readyz`);
  assert.equal(readiness.status, 503);
  assert(Date.now() - started < 1_000);
  const deployment = await fetch(`${origin}/api/deploymentz`);
  assert.equal(deployment.status, 200);
  const body = await deployment.text();
  assert.deepEqual(JSON.parse(body), {
    environment: "staging",
    context: "deploy-preview",
    deployId: "deploy-123",
    origin: "https://deploy-123.example.netlify.app",
    databaseFingerprint: "0123456789abcdef",
    clerkEnvironment: "test",
  });
  assert.doesNotMatch(
    body,
    /password|postgresql|secret|DATABASE_URL/i,
  );
});
