import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useMenuRefreshAllowed } from "./menuRefresh";
import type { BossStatus } from "@workspace/squabblemon-engine/bossRaid";
export function dojoReminderNotice(
  status?: Pick<BossStatus, "day" | "attemptsRemaining" | "campaign">,
) {
  if (!status || status.attemptsRemaining <= 0 || status.campaign.completed)
    return null;
  return {
    id: `dojo:daily:${status.day}`,
    dismissalKey: `dojo:daily:${status.day}:${status.attemptsRemaining}`,
    section: "challenges" as const,
    title: `DOJO BOSS RAID · ${status.attemptsRemaining} DAILY ${status.attemptsRemaining === 1 ? "ENTRY" : "ENTRIES"} READY`,
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
