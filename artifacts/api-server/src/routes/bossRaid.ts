import { Router, type Response } from "express";
import { getAuth } from "@clerk/express";
import {
  bossRaidRunId,
  bossRaidStartInput,
  bossRaidActionInput,
} from "@workspace/api-zod";
import { getBossRaid, startBossRaid, actBossRaid } from "../lib/bossRaid";
import { PlayerRewardError } from "../lib/playerRewardTransactions";
const router = Router();
router.use("/player/boss-raid", (req, res, next) => {
  if (!getAuth(req).userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
});
function failure(res: Response, e: unknown) {
  res
    .status(e instanceof PlayerRewardError ? e.status : 503)
    .json({
      error:
        e instanceof PlayerRewardError
          ? e.message
          : "Could not save the raid. Retry safely; confirmed progress is preserved.",
    });
}
router.get("/player/boss-raid", async (req, res) => {
  try {
    res.json(await getBossRaid(getAuth(req).userId!));
  } catch (e) {
    failure(res, e);
  }
});
router.post("/player/boss-raid/start", async (req, res) => {
  const body = bossRaidStartInput.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid raid entry" });
    return;
  }
  try {
    res.json(
      await startBossRaid(
        getAuth(req).userId!,
        body.data.requestId,
        body.data.cardIds,
      ),
    );
  } catch (e) {
    failure(res, e);
  }
});
router.post("/player/boss-raid/:id/action", async (req, res) => {
  const body = bossRaidActionInput.safeParse(req.body),
    id = bossRaidRunId.safeParse(req.params.id);
  if (!body.success || !id.success) {
    res.status(400).json({ error: "Invalid raid action" });
    return;
  }
  try {
    res.json(
      await actBossRaid(
        getAuth(req).userId!,
        id.data,
        body.data.revision,
        body.data.actionId,
        body.data.action,
      ),
    );
  } catch (e) {
    failure(res, e);
  }
});
export default router;
