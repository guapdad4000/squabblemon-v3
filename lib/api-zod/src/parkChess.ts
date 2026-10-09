import { z } from "zod/v4";

export const parkChessRunId = z.string().uuid();
export const parkChessStartInput = z.object({
  requestId: parkChessRunId,
  tier: z.number().int().min(1).max(5).optional(),
}).strict();
export const parkChessMove = z.object({
  from: z.string().regex(/^[a-h][1-8]$/),
  to: z.string().regex(/^[a-h][1-8]$/),
  promotion: z.enum(["q", "r", "b", "n"]).optional(),
}).strict();
export const parkChessMoveInput = z.object({
  revision: z.number().int().nonnegative(),
  actionId: parkChessRunId,
  move: parkChessMove,
}).strict();
export const parkChessResignInput = z.object({
  revision: z.number().int().nonnegative(),
  actionId: parkChessRunId,
}).strict();
