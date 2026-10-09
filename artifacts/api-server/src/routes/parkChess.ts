import { Router, type Response } from "express";
import { getAuth } from "@clerk/express";
import { parkChessRunId, parkChessStartInput, parkChessMoveInput, parkChessResignInput } from "@workspace/api-zod";
import { getParkChess, startParkChess, moveParkChess, resignParkChess } from "../lib/parkChess";
import { PlayerRewardError } from "../lib/playerRewardTransactions";

const router = Router();
router.use("/player/park-chess", (req, res, next) => {
  if (!getAuth(req).userId) { res.status(401).json({ error: "Authentication required" }); return; }
  next();
});
function failure(res: Response, error: unknown) {
  res.status(error instanceof PlayerRewardError ? error.status : 503).json({
    error: error instanceof PlayerRewardError ? error.message : "Could not save your chess turn. Retry safely; confirmed progress is preserved.",
  });
}
router.get("/player/park-chess", async (req, res) => {
  try { res.json(await getParkChess(getAuth(req).userId!)); } catch (error) { failure(res, error); }
});
router.post("/player/park-chess/start", async (req, res) => {
  const body = parkChessStartInput.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid chess entry" }); return; }
  try { res.json(await startParkChess(getAuth(req).userId!, body.data.requestId, undefined, body.data.tier)); } catch (error) { failure(res, error); }
});
router.post("/player/park-chess/:runId/move", async (req, res) => {
  const id = parkChessRunId.safeParse(req.params.runId), body = parkChessMoveInput.safeParse(req.body);
  if (!id.success || !body.success) { res.status(400).json({ error: "Invalid chess move" }); return; }
  try { res.json(await moveParkChess(getAuth(req).userId!, id.data, body.data.revision, body.data.actionId, body.data.move)); } catch (error) { failure(res, error); }
});
router.post("/player/park-chess/:runId/resign", async (req, res) => {
  const id = parkChessRunId.safeParse(req.params.runId), body = parkChessResignInput.safeParse(req.body);
  if (!id.success || !body.success) { res.status(400).json({ error: "Invalid resignation" }); return; }
  try { res.json(await resignParkChess(getAuth(req).userId!, id.data, body.data.revision, body.data.actionId)); } catch (error) { failure(res, error); }
});
export default router;
