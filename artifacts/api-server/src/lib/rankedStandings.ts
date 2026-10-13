import { db, playerProfilesTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import {
  RANKED_SEASON,
  rankProgress,
} from "@workspace/squabblemon-engine/ranked";
export async function rankedStandings(userId: string) {
  const result = await db.execute(sql`
    WITH ranked AS (
      SELECT clerk_user_id, display_name, avatar_key,
        CASE WHEN jsonb_typeof(story_progress->'fadePark'->'points')='number' THEN greatest(0,(story_progress->'fadePark'->>'points')::numeric) ELSE 0 END AS points,
        CASE WHEN jsonb_typeof(story_progress->'fadePark'->'wins')='number' THEN greatest(0,(story_progress->'fadePark'->>'wins')::numeric) ELSE 0 END AS wins,
        CASE WHEN jsonb_typeof(story_progress->'fadePark'->'games')='number' THEN greatest(0,(story_progress->'fadePark'->>'games')::numeric) ELSE 0 END AS games
      FROM ${playerProfilesTable} WHERE onboarding_step='complete' AND story_progress ? 'fadePark'
        AND coalesce(story_progress->'fadePark'->>'season',${RANKED_SEASON})=${RANKED_SEASON}
    ), standings AS (SELECT *, dense_rank() OVER(ORDER BY points DESC) AS position FROM ranked WHERE games>0),
    leaders AS (SELECT * FROM standings ORDER BY points DESC, wins DESC, display_name ASC, clerk_user_id ASC LIMIT 20),
    selected AS (SELECT * FROM leaders UNION SELECT * FROM standings WHERE clerk_user_id=${userId})
    SELECT display_name AS name, avatar_key AS "avatarKey", points, wins, games, position,
      clerk_user_id=${userId} AS "isYou", (SELECT count(*)::int FROM standings) AS total
    FROM selected ORDER BY points DESC, wins DESC, display_name ASC, clerk_user_id ASC
  `);
  const rows = result.rows.map((row) => ({
    name: String(row.name),
    avatarKey: String(row.avatarKey),
    points: Number(row.points),
    wins: Number(row.wins),
    games: Number(row.games),
    position: Number(row.position),
    isYou: Boolean(row.isYou),
    tier: rankProgress(Number(row.points)).tier,
  }));
  return {
    season: RANKED_SEASON,
    updatedAt: new Date().toISOString(),
    total: Number(result.rows[0]?.total ?? 0),
    leaders: rows.filter((row) => row.position <= 20).slice(0, 20),
    you: rows.find((row) => row.isYou) ?? null,
  };
}
