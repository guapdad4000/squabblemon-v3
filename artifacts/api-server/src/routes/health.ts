import { Router, type IRouter } from "express";
import { GetDeploymentIdentityResponse, HealthCheckResponse } from "@workspace/api-zod";
import { db, resolvedDatabaseConnectionString } from "@workspace/db";
import { sql } from "drizzle-orm";
import {
  deployedEnvironmentIdentity,
  type DeploymentIdentity,
} from "../lib/deploymentIdentity";
import { currentDeploymentContext } from "../lib/runtimeDeploymentContext";

export type ReadinessProbe = () => Promise<void>;
export type DeploymentIdentityProbe = () => DeploymentIdentity;

const databaseReadiness: ReadinessProbe = async () => {
  await db.execute(sql`select 1`);
};

const runtimeDeploymentIdentity: DeploymentIdentityProbe = () =>
  deployedEnvironmentIdentity(
    process.env,
    currentDeploymentContext(),
    resolvedDatabaseConnectionString(),
  );

async function boundedProbe(
  probe: ReadinessProbe,
  timeoutMs: number,
): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      probe(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("readiness timeout")),
          timeoutMs,
        );
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function createHealthRouter(
  probe: ReadinessProbe = databaseReadiness,
  identityProbe: DeploymentIdentityProbe = runtimeDeploymentIdentity,
  readinessTimeoutMs = 2_500,
): IRouter {
  const router: IRouter = Router();

  router.get("/healthz", (_req, res) => {
    res.json(HealthCheckResponse.parse({ status: "ok" }));
  });

  router.get("/readyz", async (req, res) => {
    try {
      await boundedProbe(probe, readinessTimeoutMs);
      res.json(HealthCheckResponse.parse({ status: "ok" }));
    } catch {
      req.log.error("Database readiness probe failed");
      res.status(503).json({ status: "unavailable" });
    }
  });

  router.get("/deploymentz", (req, res) => {
    try {
      res.json(GetDeploymentIdentityResponse.parse(identityProbe()));
    } catch {
      req.log.error("Deployment identity probe failed");
      res.status(503).json({ status: "unavailable" });
    }
  });

  return router;
}

export default createHealthRouter();
