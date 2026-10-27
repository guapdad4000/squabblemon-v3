import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getKumite } from "./kumite";
import { kumiteBracketClock } from "./kumiteClock";
import { useMenuRefreshAllowed } from "./menuRefresh";
/** Shared by the illustrated shortcut and the actual 3D Arcade hotspot. Fetch only on intent. */
export function useKumiteHotspotClock(enabled: boolean) {
  const [now, setNow] = useState(Date.now());
  const menu = useMenuRefreshAllowed();
  const bracket = useQuery({
    queryKey: ["kumite-hotspot-clock"],
    queryFn: ({ signal }) => getKumite(signal),
    enabled: enabled && menu,
    staleTime: 60000,
    retry: 1,
  });
  useEffect(() => {
    if (!enabled || !menu) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, [enabled, menu]);
  const display = kumiteBracketClock(bracket.data, now, bracket.dataUpdatedAt);
  const clock = bracket.data
    ? `${display.label === 'BRACKET LOCK' ? 'NEXT BRACKET LOCK' : display.label} · ${display.value}`
    : bracket.isError ? 'BRACKET CLOCK OFFLINE' : 'CHECK BRACKET CLOCK';
  return clock;
}
