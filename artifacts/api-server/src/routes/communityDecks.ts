import { Router } from "express";
import { getAuth } from "@clerk/express";
import { OnlineError } from "@workspace/squabblemon-engine/multiplayer";
import {
  communityDeckFeed,
  communityDeckArchive,
  submitCommunityDeck,
  voteCommunityDeck,
} from "../lib/communityDecks";
const router = Router();
router.use("/player/community-decks", (req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store");
  if (!getAuth(req).userId) {
    res.status(401).json({ error: "Sign in to share your crew." });
    return;
  }
  next();
});
const endpoint =
  (
    action: (
      userId: string,
      req: import("express").Request,
    ) => Promise<unknown>,
  ) =>
  async (req: import("express").Request, res: import("express").Response) => {
    try {
      res.json(await action(getAuth(req).userId!, req));
    } catch (error) {
      if (error instanceof OnlineError)
        res.status(error.status).json({ error: error.message });
      else {
        req.log?.error({ err: error }, "Community decks request failed");
        res.status(503).json({
          error: "The crew board is temporarily unavailable. Try again.",
        });
      }
    }
  };
function offsetOf(req: import("express").Request) {
  const raw = req.query.offset;
  if (raw === undefined) return 0;
  if (typeof raw !== "string" || !/^\d{1,6}$/.test(raw) || Number(raw) > 100000)
    throw new OnlineError("Choose a valid crew-board page.");
  return Number(raw);
}
router.get(
  "/player/community-decks/archive",
  endpoint((userId) => communityDeckArchive(userId)),
);
router.get(
  "/player/community-decks",
  endpoint((userId, req) =>
    communityDeckFeed(userId, new Date(), offsetOf(req)),
  ),
);
router.post(
  "/player/community-decks",
  endpoint((userId, req) => {
    const b = req.body;
    if (
      !b ||
      typeof b.deckId !== "string" ||
      b.deckId.length > 100 ||
      typeof b.strategy !== "string" ||
      Object.keys(b).some((key) => !["deckId", "strategy"].includes(key))
    )
      throw new OnlineError("Choose a saved crew and explain its plan.");
    return submitCommunityDeck(userId, b, new Date(), offsetOf(req));
  }),
);
router.post(
  "/player/community-decks/:id/vote",
  endpoint((userId, req) => {
    const id = String(req.params.id);
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      ) ||
      (req.body && Object.keys(req.body).length)
    )
      throw new OnlineError("Choose a crew on this week’s board.");
    return voteCommunityDeck(userId, id, new Date(), offsetOf(req));
  }),
);
export default router;
