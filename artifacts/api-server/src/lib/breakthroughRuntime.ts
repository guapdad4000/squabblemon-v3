import { drizzle } from "drizzle-orm/node-postgres";
import { pool } from "@workspace/db";
import { engineIdsToCatalogIds } from "@workspace/squabblemon-engine/data";
import { loadMember } from "./onlineMatches";
import { logger } from "./logger";
import { BreakthroughOnlineService } from "./breakthroughOnline";
import { breakthroughRouter } from "../routes/breakthrough";
/** Existing profile/deck admission and Clerk app middleware, with a format-specific room engine. */
export function createBreakthroughRuntime(hostedRoomId?: string) {
  const service = new BreakthroughOnlineService({
    pool,
    hostedRoomId,
    report: (error) => logger.error({ err: error }, "Breakthrough host"),
    member: async (client, userId, deckId) => {
      const member = await loadMember(
        drizzle(client),
        userId,
        deckId,
        true,
        true,
      );
      return {
        userId: member.userId,
        name: member.name,
        avatarKey: member.avatarKey ?? member.deck.hero,
        cards: engineIdsToCatalogIds(member.deck.cards),
      };
    },
  });
  return { service, router: breakthroughRouter(service) };
}
