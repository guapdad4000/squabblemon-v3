import { Router, type Response } from "express";
import { getAuth } from "@clerk/express";
import {
  arcadeKind,
  arcadeRunId,
  arcadeStartInput,
  arcadeActionInput,
} from "@workspace/api-zod";
import {
  getArcadeGame,
  startArcadeGame,
  actArcadeGame,
} from "../lib/arcadeGames";
import { PlayerRewardError } from "../lib/playerRewardTransactions";
const router = Router();
router.use("/player/arcade", (req, res, next) => {
  if (!getAuth(req).userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
});
function failure(res: Response, error: unknown) {
  res
    .status(error instanceof PlayerRewardError ? error.status : 503)
    .json({
      error:
        error instanceof PlayerRewardError
          ? error.message
          : "Could not save your turn. Retry safely; confirmed progress is preserved.",
    });
}
router.get("/player/arcade/:kind", async (req, res) => {
  const kind = arcadeKind.safeParse(req.params.kind);
  if (!kind.success) {
    res.status(404).json({ error: "Game not found" });
    return;
  }
  try {
    res.json(await getArcadeGame(getAuth(req).userId!, kind.data));
  } catch (error) {
    failure(res, error);
  }
});
router.post("/player/arcade/:kind/start", async (req, res) => {
  const kind = arcadeKind.safeParse(req.params.kind),
    body = arcadeStartInput.safeParse(req.body);
  if (!kind.success || !body.success) {
    res.status(400).json({ error: "Invalid game entry" });
    return;
  }
  try {
    res.json(
      await startArcadeGame(
        getAuth(req).userId!,
        kind.data,
        body.data.requestId,
        body.data.choice,
      ),
    );
  } catch (error) {
    failure(res, error);
  }
});
router.post("/player/arcade/:kind/:id/action", async (req, res) => {
  const kind = arcadeKind.safeParse(req.params.kind),
    id = arcadeRunId.safeParse(req.params.id),
    body = arcadeActionInput.safeParse(req.body);
  if (!kind.success || !id.success || !body.success) {
    res.status(400).json({ error: "Invalid arcade action" });
    return;
  }
  try {
    res.json(
      await actArcadeGame(
        getAuth(req).userId!,
        kind.data,
        id.data,
        body.data.revision,
        body.data.actionId,
        body.data.action,
      ),
    );
  } catch (error) {
    failure(res, error);
  }
});
export default router;
