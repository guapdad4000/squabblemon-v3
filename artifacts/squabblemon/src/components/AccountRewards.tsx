import { useRef, useEffect } from "react";
import type { PlayerBootstrap } from "@workspace/api-client-react";
import { rewardReceipts } from "../lib/rewardReceipts";
export { BuddyGrowthLab as AccountRewards } from "./BuddyGrowthLab";

export function PlayerLevelCelebration({
  profile,
}: {
  profile: PlayerBootstrap["profile"];
}) {
  const previous = useRef<{ id: string; level: number } | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      let seen =
        previous.current?.id === profile.id
          ? previous.current.level
          : profile.level;
      if (!previous.current || previous.current.id !== profile.id) {
        try {
          const saved = Number(
            localStorage.getItem(`squabblemon:level-seen:${profile.id}`),
          );
          if (saved > 0) seen = saved;
        } catch {
          /* Cosmetic history is optional. */
        }
      }
      previous.current = { id: profile.id, level: profile.level };
      const remember = () => {
        try {
          localStorage.setItem(
            `squabblemon:level-seen:${profile.id}`,
            String(profile.level),
          );
        } catch {
          /* Cosmetic history is optional. */
        }
      };
      if (profile.level > seen)
        rewardReceipts.deferLevel({
          id: `${profile.id}:level:${profile.level}`,
          title: "A level above.",
          level: profile.level,
          items: [{ label: `Player level ${profile.level}`, glyph: "xp" }],
        }, remember);
      else if (seen === profile.level) remember();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [profile.id, profile.level]);
  return null;
}
