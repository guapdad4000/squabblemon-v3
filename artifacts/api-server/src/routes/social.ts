import { getAuth } from "@clerk/express";
import { Router, type Request, type Response } from "express";
import * as schemas from "@workspace/api-zod";
import { OnlineError } from "@workspace/squabblemon-engine/multiplayer";
import { getSocialState, lookupSocialPlayer, mutateRelationship, sendFadeInvitation, accessInvitation, socialThrottle, updateSocialUsername } from "../lib/social";
import { searchSocialPlayers, getSocialMatchOpponent } from "../lib/socialDiscovery";

const router = Router();
type Parser = { parse: (input: unknown) => unknown };
function body<T>(schema: { strict: () => { safeParse: (input: unknown) => { success: boolean; data?: T } } }, req: Request): T {
  const parsed = schema.strict().safeParse(req.body);
  if (!parsed.success) throw new OnlineError("Invalid request.", 400);
  return parsed.data!;
}
function id(req: Request) {
  const parsed = schemas.GetFadeInvitationParams.safeParse(req.params);
  if (!parsed.success) throw new OnlineError("Invalid invitation or request ID.", 400);
  return parsed.data.id;
}
const endpoint = (output: Parser, run: (req: Request, userId: string) => Promise<unknown>, throttle?: "lookup" | "mutate") =>
  async (req: Request, res: Response): Promise<void> => {
    res.setHeader("Cache-Control", "private, no-store");
    const userId = getAuth(req).userId;
    if (!userId) { res.status(401).json({ error: "Sign in to find your homies." }); return; }
    try {
      if (throttle) await socialThrottle(userId, throttle);
      res.json(output.parse(await run(req, userId)));
    } catch (error) {
      if (error instanceof OnlineError) { res.status(error.status).json({ error: error.message }); return; }
      req.log?.error({ category: "social_failure" }, "Social request failed");
      res.status(503).json({ error: "Homies are temporarily unavailable. Please retry." });
    }
  };
router.get("/social", endpoint(schemas.GetSocialStateResponse, (_req, userId) => getSocialState(userId)));
router.get("/social/search", endpoint(schemas.SearchSocialPlayersResponse, (req, userId) => {
  const parsed = schemas.SearchSocialPlayersQueryParams.safeParse(req.query);
  if (!parsed.success) throw new OnlineError("Enter a valid username search.", 400);
  return searchSocialPlayers(userId, parsed.data.query);
}, "lookup"));
router.patch("/social/username", endpoint(schemas.UpdateSocialUsernameResponse, (req, userId) =>
  updateSocialUsername(userId, body<{ username: string }>(schemas.UpdateSocialUsernameBody, req).username), "mutate"));
router.get("/social/match-opponent/:code", endpoint(schemas.GetSocialMatchOpponentResponse, (req, userId) =>
  getSocialMatchOpponent(userId, String(req.params.code)), "lookup"));
router.get("/social/lookup/:code", endpoint(schemas.LookupSocialPlayerResponse, (req, userId) => lookupSocialPlayer(userId, String(req.params.code)), "lookup"));
router.post("/social/requests", endpoint(schemas.SendHomieRequestResponse, (req, userId) => {
  const input = body<{ friendCode: string }>(schemas.SendHomieRequestBody, req);
  return mutateRelationship(userId, "send", { code: input.friendCode });
}, "mutate"));
router.post("/social/requests/:id/respond", endpoint(schemas.RespondHomieRequestResponse, (req, userId) => {
  const input = body<{ action: string }>(schemas.RespondHomieRequestBody, req);
  return mutateRelationship(userId, "respond", { id: id(req), action: input.action });
}, "mutate"));
router.post("/social/homies/:code/remove", endpoint(schemas.RemoveHomieResponse, (req, userId) =>
  mutateRelationship(userId, "remove", { code: String(req.params.code) }), "mutate"));
router.post("/social/blocks", endpoint(schemas.BlockSocialPlayerResponse, (req, userId) => {
  const input = body<{ friendCode: string }>(schemas.BlockSocialPlayerBody, req);
  return mutateRelationship(userId, "block", { code: input.friendCode });
}, "mutate"));
router.post("/social/blocks/:code/remove", endpoint(schemas.UnblockSocialPlayerResponse, (req, userId) =>
  mutateRelationship(userId, "unblock", { code: String(req.params.code) }), "mutate"));
router.post("/social/invitations", endpoint(schemas.SendFadeInvitationResponse, (req, userId) =>
  sendFadeInvitation(userId, body<{ friendCode: string; deckId: string; requestId: string }>(schemas.SendFadeInvitationBody, req)), "mutate"));
router.get("/social/invitations/:id", endpoint(schemas.GetFadeInvitationResponse, (req, userId) => accessInvitation(userId, id(req))));
router.post("/social/invitations/:id/respond", endpoint(schemas.RespondFadeInvitationResponse, (req, userId) =>
  accessInvitation(userId, id(req), body<{ action: string; deckId?: string }>(schemas.RespondFadeInvitationBody, req)), "mutate"));
export default router;