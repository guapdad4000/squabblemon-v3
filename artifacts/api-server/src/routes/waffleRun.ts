import { Router } from "express";
import { getAuth } from "@clerk/express";
import {
  waffleRunId,
  waffleStartInput,
  waffleActionInput,
} from "@workspace/api-zod";
import { getWaffleRun, startWaffleRun, actWaffleRun } from "../lib/waffleRun";
import { PlayerRewardError } from "../lib/playerRewardTransactions";
const router = Router();
router.use("/player/challenges/waffle-run", async (req, res, next) => {
  if (!getAuth(req).userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
});
function failure(res: import("express").Response, error: unknown) {
  res
    .status(error instanceof PlayerRewardError ? error.status : 503)
    .json({
      error:
        error instanceof PlayerRewardError
          ? error.message
          : "Could not save the diner run. Retry; your last confirmed progress is safe.",
    });
}
router.get("/player/challenges/waffle-run", async (req, res) => {
  try {
    res.json(await getWaffleRun(getAuth(req).userId!));
  } catch (error) {
    failure(res, error);
  }
});
router.post("/player/challenges/waffle-run/start", async (req, res) => {
  const body = waffleStartInput.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "A valid run request is required." });
    return;
  }
  try {
    res.json(await startWaffleRun(getAuth(req).userId!, body.data.requestId));
  } catch (error) {
    failure(res, error);
  }
});
router.post("/player/challenges/waffle-run/:id/action", async (req, res) => {
  const id = waffleRunId.safeParse(req.params.id),
    body = waffleActionInput.safeParse(req.body);
  if (!id.success || !body.success) {
    res.status(400).json({ error: "A valid game action is required." });
    return;
  }
  try {
    res.json(
      await actWaffleRun(
        getAuth(req).userId!,
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
