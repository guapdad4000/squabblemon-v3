import type { Config } from "@netlify/functions";

/** Durable resumable worker; each transaction processes at most 25 accounts. */
export default async function patchDelivery(): Promise<void> {
  const { processOutstandingPatchBatches } = await import("../../lib/patches");
  await processOutstandingPatchBatches(5);
}

export const config: Config = { schedule: "* * * * *" };