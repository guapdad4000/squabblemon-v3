import { z } from "zod/v4";
export const arcadeKind = z.enum([
  "girl-fade",
  "fade-market",
  "block-takeover",
]);
export const arcadeRunId = z.string().uuid();
export const arcadeStartInput = z
  .object({
    requestId: arcadeRunId,
    choice: z.number().int().min(0).max(2).default(0),
  })
  .strict();
export const arcadeActionInput = z
  .object({
    revision: z.number().int().nonnegative(),
    actionId: arcadeRunId,
    action: z.discriminatedUnion("type", [
      z.object({ type: z.literal("ready") }).strict(),
      z
        .object({
          type: z.literal("pattern"),
          directions: z.array(z.enum(["left", "right", "up", "down"])).max(5),
        })
        .strict(),
      z
        .object({
          type: z.literal("duty"),
          aim: z.number().int().min(0).max(4),
          stockLane: z.number().int().min(0).max(4),
        })
        .strict(),
      z
        .object({
          type: z.literal("attack"),
          tile: z.number().int().min(0).max(8),
        })
        .strict(),
      z
        .object({
          type: z.literal("defend"),
          tile: z.number().int().min(0).max(8),
        })
        .strict(),
      z.object({ type: z.literal("supply") }).strict(),
      z.object({ type: z.literal("rally") }).strict(),
      z.object({ type: z.literal("retire") }).strict(),
    ]),
  })
  .strict();
