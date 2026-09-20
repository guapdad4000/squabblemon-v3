import { createHash } from "node:crypto";
import type { RuntimeDeploymentContext } from "./runtimeDeploymentContext";

export type DeploymentIdentity = {
  environment: "production" | "staging";
  context: "production" | "deploy-preview" | "branch-deploy" | "staging";
  deployId: string;
  origin: string;
  databaseFingerprint: string;
  clerkEnvironment: "live" | "test";
};

const previewContexts = new Set(["deploy-preview", "branch-deploy", "staging"]);

function exactHttpsOrigin(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is unavailable`);
  const url = new URL(value);
  if (url.protocol !== "https:" || url.origin !== value.replace(/\/$/, "")) {
    throw new Error(`${name} is not an exact HTTPS origin`);
  }
  return url.origin;
}

export function databaseIdentity(connectionString: string | undefined): string {
  if (!connectionString) throw new Error("Database identity is unavailable");
  const url = new URL(connectionString);
  const database = url.pathname.replace(/^\//, "");
  if (!database) throw new Error("Database identity is unavailable");
  return createHash("sha256")
    .update([
      `${decodeURIComponent(url.username).toLowerCase()}@${url.hostname.toLowerCase()}:${url.port || "5432"}/${decodeURIComponent(database)}`,
      ...["schema", "search_path", "options"]
        .filter(name => url.searchParams.has(name))
        .map(name => `${name}=${url.searchParams.get(name)}`),
    ].join("|"))
    .digest("hex")
    .slice(0, 16);
}

/** Returns only non-secret values that an operator can compare before writes. */
export function deployedEnvironmentIdentity(
  environment: NodeJS.ProcessEnv = process.env,
  runtime?: RuntimeDeploymentContext,
  resolvedDatabaseUrl = environment.DATABASE_URL,
): DeploymentIdentity {
  const context = runtime?.context ?? environment.CONTEXT;
  if (context !== "production" && !previewContexts.has(context ?? "")) {
    throw new Error("Netlify deployment context is unavailable");
  }
  const appEnvironment = context === "production" ? "production" : "staging";
  if (
    environment.APP_ENV !== undefined &&
    environment.APP_ENV !== appEnvironment
  ) {
    throw new Error("Deployment environment does not match its Netlify context");
  }
  if (
    runtime &&
    environment.CONTEXT !== undefined &&
    environment.CONTEXT !== runtime.context
  ) {
    throw new Error("Runtime deployment context does not match configured context");
  }

  const deployId = (runtime?.deployId ?? environment.DEPLOY_ID)?.trim();
  if (!deployId || !/^[A-Za-z0-9][A-Za-z0-9._-]{5,127}$/.test(deployId)) {
    throw new Error("Deployment identity is unavailable");
  }
  if (
    runtime &&
    environment.DEPLOY_ID !== undefined &&
    environment.DEPLOY_ID !== deployId
  ) {
    throw new Error("Runtime deployment ID does not match configured deployment");
  }

  const origin = exactHttpsOrigin(
    "Deployment origin",
    runtime?.origin ??
      (appEnvironment === "production"
        ? environment.URL
        : environment.DEPLOY_PRIME_URL ??
          (context === "staging" ? environment.URL : undefined)),
  );
  const publishableKey = environment.CLERK_PUBLISHABLE_KEY?.trim();
  const clerkEnvironment = publishableKey?.startsWith("pk_live_")
    ? "live"
    : publishableKey?.startsWith("pk_test_")
      ? "test"
      : null;
  if (
    !clerkEnvironment ||
    (appEnvironment === "production") !== (clerkEnvironment === "live")
  ) {
    throw new Error("Clerk environment does not match deployment environment");
  }

  return {
    environment: appEnvironment,
    context: context as DeploymentIdentity["context"],
    deployId,
    origin,
    databaseFingerprint: databaseIdentity(resolvedDatabaseUrl),
    clerkEnvironment,
  };
}
