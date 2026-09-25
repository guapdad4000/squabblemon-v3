import { Router } from "express";
import { getAuth } from "@clerk/express";
import { getStockzState, startStockz, settleStockz } from "../lib/stockz";
const router = Router();
router.get("/player/stockz", async (req, res) => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    res.json(await getStockzState(userId));
  } catch {
    res.status(503).json({ error: "The market is unavailable. Try again." });
  }
});
router.post("/player/stockz/:action", async (req, res) => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    if (req.params.action === "start")
      res.json(await startStockz(userId, req.body ?? {}));
    else if (req.params.action === "settle" && typeof req.body?.id === "string")
      res.json(await settleStockz(userId, req.body.id));
    else res.status(400).json({ error: "Unknown market action." });
  } catch (error) {
    res
      .status(400)
      .json({
        error:
          error instanceof Error ? error.message : "Trade could not be saved.",
      });
  }
});
export default router;
