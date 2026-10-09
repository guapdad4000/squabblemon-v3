import { z } from "zod/v4";
export const bossRaidRunId = z.string().uuid();
export const bossRaidStartInput = z
  .object({
    requestId: bossRaidRunId,
    cardIds: z.array(z.string().min(1).max(100)).length(10),
  })
  .strict();
export const bossRaidActionInput = z
  .object({
    revision: z.number().int().nonnegative(),
    actionId: bossRaidRunId,
    action: z.discriminatedUnion("type", [
      z
        .object({
          type: z.literal("play"),
          instanceId: z.string().min(1).max(240),
          lane: z.union([z.literal(0), z.literal(1), z.literal(2)]),
          squabble: z.boolean().optional(),
          investment: z.number().int().min(0).max(9).optional(),
        })
        .strict(),
      z.object({ type: z.literal("blast") }).strict(),
      z.object({ type: z.literal("retire") }).strict(),
    ]),
  })
  .strict();
