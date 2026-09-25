import { Router } from "express";
import { getAuth } from "@clerk/express";
import { claimAccountRewards, getAccountRewards, waterGrowthLab } from "../lib/accountRewards";
import { getPlayerBootstrap } from "../lib/playerState";

const router = Router();
router.get("/player/rewards/account", async (req, res) => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    res.json(await getAccountRewards(userId));
  } catch {
    res
      .status(503)
      .json({ error: "Check-in rewards are unavailable. Try again." });
  }
});
router.post("/player/rewards/account/claim", async (req, res) => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const rewards = await claimAccountRewards(userId);
    res.json({
      rewards,
      status: await getAccountRewards(userId),
      bootstrap: await getPlayerBootstrap(userId),
    });
  } catch {
    res
      .status(503)
      .json({
        error:
          "Rewards could not be confirmed. Retry to check your saved claim.",
      });
  }
});
router.post('/player/rewards/account/growth/water', async (req, res) => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: 'Authentication required' }); return; }
  try {
    const rewards = await waterGrowthLab(userId);
    res.json({ rewards, status: await getAccountRewards(userId), bootstrap: await getPlayerBootstrap(userId) });
  } catch {
    res.status(503).json({ error: 'Your garden could not be confirmed. Try watering again.' });
  }
});
export default router;
