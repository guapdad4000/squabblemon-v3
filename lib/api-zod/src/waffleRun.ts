import { z } from "zod/v4";
const move = z.enum([
  "peck",
  "wing-slap",
  "crumb-guard",
  "syrup-spit",
  "double-peck",
  "dine-dash",
  "coffee-rush",
  "waffle-heal",
  "beak-breaker",
]);
export const waffleRunId = z.string().uuid();
export const waffleStartInput = z.object({ requestId: waffleRunId }).strict();
export const waffleActionInput = z
  .object({
    revision: z.number().int().nonnegative(),
    actionId: waffleRunId,
    action: z.discriminatedUnion("type", [
      z
        .object({
          type: z.literal("hop"),
          plate: z.number().int().min(0).max(5),
        })
        .strict(),
      z
        .object({
          type: z.literal("learn"),
          move,
          replace: z.number().int().min(1).max(3).optional(),
        })
        .strict(),
      z.object({ type: z.literal("move"), move }).strict(),
      z.object({ type: z.literal("retire") }).strict(),
    ]),
  })
  .strict();
