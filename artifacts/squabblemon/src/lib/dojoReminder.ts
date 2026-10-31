import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useMenuRefreshAllowed } from "./menuRefresh";
import type { BossStatus } from "@workspace/squabblemon-engine/bossRaid";
/** Query typings do not validate an HTTP response. Ignore malformed or partial
 * status data here so an unavailable reminder cannot take down the game shell. */
export function dojoReminderNotice(status?: unknown) {
  if (!status || typeof status !== "object" || Array.isArray(status)) return null;
  const { day, attemptsRemaining, campaign } = status as Partial<
    Pick<BossStatus, "day" | "attemptsRemaining" | "campaign">
  >;
  if (
    typeof day !== "string" || !day.trim() ||
    typeof attemptsRemaining !== "number" || !Number.isSafeInteger(attemptsRemaining) || attemptsRemaining <= 0 ||
    !campaign || typeof campaign !== "object" || Array.isArray(campaign) ||
    typeof campaign.completed !== "boolean" || campaign.completed
  ) return null;
  return {
    id: `dojo:daily:${day}`,
    dismissalKey: `dojo:daily:${day}:${attemptsRemaining}`,
    section: "challenges" as const,
    title: `DOJO BOSS RAID · ${attemptsRemaining} DAILY ${attemptsRemaining === 1 ? "ENTRY" : "ENTRIES"} READY`,
    href: "/game/challenges?game=punch-on-patrol&raid=kumite",
  };
}

export function useDojoReminder(playerId: string) {
  const allowed = useMenuRefreshAllowed();
  return useQuery({
    queryKey: ["boss-raid", playerId, "kumite"],
    queryFn: ({ signal }) =>
      customFetch<BossStatus>("/api/player/boss-raid?mode=kumite", { signal }),
    enabled: allowed,
    staleTime: 30000,
    refetchInterval: allowed ? 60000 : false,
    retry: 1,
  });
}
