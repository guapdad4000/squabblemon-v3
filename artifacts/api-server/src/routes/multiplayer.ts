import { getAuth } from "@clerk/express";
import { Router, type Request, type Response } from "express";
import {
  OnlineError,
  type OnlineCommand,
} from "@workspace/squabblemon-engine/multiplayer";
import {
  rankedLobby, cancelRankedSearch,
  accessFriendRoom,
  createFriendRoom,
  listFriendRooms,
} from "../lib/onlineMatches";

const router = Router();
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function bodyOf(req: Request, keys: string[]) {
  const body: unknown = req.body;
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !keys.includes(key))
  )
    throw new OnlineError("Invalid request.", 400);
  return body as Record<string, unknown>;
}
const deckId = (value: unknown) => {
  if (typeof value !== "string" || !value.length || value.length > 100)
    throw new OnlineError("Choose a gang.", 400);
  return value;
};
const requestId = (value: unknown) => {
  if (typeof value !== "string" || !uuid.test(value))
    throw new OnlineError("A valid request ID is required.", 400);
  return value;
};
function codeOf(req: Request) {
  const code = String(req.params.code ?? "").toUpperCase();
  if (!/^[A-F0-9]{12}$/.test(code))
    throw new OnlineError("Enter a valid 12-character room code.", 400);
  return code;
}
function parseCommand(value: unknown): OnlineCommand {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new OnlineError("Invalid action.", 400);
  const c = value as Record<string, unknown>;
  if (c.type === "play") {
    if (
      Object.keys(c).some(
        (k) => !["type", "instanceId", "lane", "squabble"].includes(k),
      ) ||
      typeof c.instanceId !== "string" ||
      c.instanceId.length > 200 ||
      ![0, 1, 2].includes(c.lane as number) ||
      typeof c.squabble !== "boolean"
    )
      throw new OnlineError("Invalid card play.", 400);
    return {
      type: "play",
      instanceId: c.instanceId,
      lane: c.lane as 0 | 1 | 2,
      squabble: c.squabble,
    };
  }
  if (
    !["ready", "end-turn", "surrender", "rematch"].includes(String(c.type)) ||
    Object.keys(c).length !== 1
  )
    throw new OnlineError("Invalid action.", 400);
  return { type: c.type as "ready" | "end-turn" | "surrender" | "rematch" };
}
const endpoint =
  (action: (req: Request, userId: string) => Promise<unknown>, status = 200) =>
  async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "private, no-store");
    const userId = getAuth(req).userId;
    if (!userId) {
      res.status(401).json({ error: "Sign in to play online." });
      return;
    }
    try {
      res.status(status).json(await action(req, userId));
    } catch (error) {
      if (error instanceof OnlineError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      req.log?.error({ err: error }, "Friend fade request failed");
      res
        .status(503)
        .json({
          error: "Online fades are temporarily unavailable. Please retry.",
        });
    }
  };
router.get(
  "/multiplayer",
  endpoint(async (_req, userId) => ({ rooms: await listFriendRooms(userId) })),
);
router.post(
  "/multiplayer",
  endpoint(async (req, userId) => {
    const b = bodyOf(req, ["deckId", "requestId"]);
    return createFriendRoom(userId, deckId(b.deckId), requestId(b.requestId));
  }, 201),
);
router.get('/multiplayer/ranked', endpoint((_req, userId) => rankedLobby(userId)));
router.post('/multiplayer/ranked/search', endpoint((req, userId) => {
  const b = bodyOf(req, ['deckId', 'requestId']);
  return rankedLobby(userId, { deckId: deckId(b.deckId), requestId: requestId(b.requestId) });
}));
router.post('/multiplayer/ranked/cancel', endpoint((req, userId) => {
  const b = bodyOf(req, ['code']);
  if (typeof b.code !== 'string' || !/^[A-F0-9]{12}$/.test(b.code)) throw new OnlineError('Invalid search code.', 400);
  return cancelRankedSearch(userId, b.code);
}));
router.get(
  "/multiplayer/:code",
  endpoint((req, userId) => accessFriendRoom(codeOf(req), userId)),
);
router.post(
  "/multiplayer/:code/join",
  endpoint((req, userId) => {
    const b = bodyOf(req, ["deckId"]);
    return accessFriendRoom(codeOf(req), userId, {
      kind: "join",
      deckId: deckId(b.deckId),
    });
  }),
);
router.post(
  "/multiplayer/:code/actions",
  endpoint((req, userId) => {
    const b = bodyOf(req, ["requestId", "expectedRevision", "command"]);
    if (
      !Number.isSafeInteger(b.expectedRevision) ||
      (b.expectedRevision as number) < 0
    )
      throw new OnlineError("A fade revision is required.", 400);
    return accessFriendRoom(codeOf(req), userId, {
      kind: "command",
      requestId: requestId(b.requestId),
      expectedRevision: b.expectedRevision as number,
      command: parseCommand(b.command),
    });
  }),
);
export default router;
