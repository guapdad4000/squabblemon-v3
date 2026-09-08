import { getAuth } from "@clerk/express";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  CompletePlayerStoryNodeBody,
  CompletePlayerStoryNodeParams,
  CompletePlayerStoryNodeResponse,
  GetPlayerStoryResponse,
  SavePlayerStoryDialogueBody,
  SavePlayerStoryDialogueParams,
  SavePlayerStoryDialogueResponse,
  ResetPlayerStoryDevelopmentBody,
  ResetPlayerStoryDevelopmentResponse,
} from "@workspace/api-zod";
import { ensurePlayer } from "../lib/playerState";
import {
  getPlayerStoryCampaign,
  StoryRequestError,
} from "../lib/storyService";
import {
  completeNonBattleStoryNode,
  saveStoryDialogue,
  resetStoryDevelopment,
  isDevelopmentStoryResetEnabled,
} from "../lib/storyTransactions";

const router: IRouter = Router();

function userId(req: Request, res: Response): string | null {
  const id = getAuth(req).userId;
  if (!id) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return id;
}

router.get("/player/story", async (req, res): Promise<void> => {
  const id = userId(req, res);
  if (!id) return;
  res.json(GetPlayerStoryResponse.parse(await getPlayerStoryCampaign(id)));
});

router.post("/player/story/development/reset", async (req, res): Promise<void> => {
  if (!isDevelopmentStoryResetEnabled()) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const id = userId(req, res);
  if (!id) return;
  const body = ResetPlayerStoryDevelopmentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid story reset" });
    return;
  }
  try {
    await ensurePlayer(id);
    res.json(ResetPlayerStoryDevelopmentResponse.parse(await resetStoryDevelopment(id, body.data.selectNodeId)));
  } catch (error) {
    if (error instanceof StoryRequestError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    throw error;
  }
});

router.post(
  "/player/story/nodes/:nodeId/complete",
  async (req, res): Promise<void> => {
    const id = userId(req, res);
    if (!id) return;
    const params = CompletePlayerStoryNodeParams.safeParse(req.params);
    const body = CompletePlayerStoryNodeBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid story node completion" });
      return;
    }
    try {
      await ensurePlayer(id);
      const completion = await completeNonBattleStoryNode(
        id,
        params.data.nodeId,
        body.data.idempotencyKey,
        body.data.dialogueSeen,
      );
      res.json(CompletePlayerStoryNodeResponse.parse(completion));
    } catch (error) {
      if (error instanceof StoryRequestError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }
  },
);

router.post(
  "/player/story/nodes/:nodeId/dialogue",
  async (req, res): Promise<void> => {
    const id = userId(req, res);
    if (!id) return;
    const params = SavePlayerStoryDialogueParams.safeParse(req.params);
    const body = SavePlayerStoryDialogueBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid story dialogue progress" });
      return;
    }
    try {
      await ensurePlayer(id);
      const result = await saveStoryDialogue(
        id,
        params.data.nodeId,
        body.data.idempotencyKey,
        body.data.dialogueSeen,
      );
      res.json(SavePlayerStoryDialogueResponse.parse(result));
    } catch (error) {
      if (error instanceof StoryRequestError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }
  },
);

export default router;