import { AsyncLocalStorage } from "node:async_hooks";

export type RuntimeDeploymentContext = {
  context: string;
  deployId: string;
  origin: string;
};

const deploymentStorage = new AsyncLocalStorage<RuntimeDeploymentContext>();

export function runWithDeploymentContext<T>(
  runtime: RuntimeDeploymentContext,
  task: () => T,
): T {
  return deploymentStorage.run(runtime, task);
}

export function currentDeploymentContext(): RuntimeDeploymentContext | undefined {
  return deploymentStorage.getStore();
}