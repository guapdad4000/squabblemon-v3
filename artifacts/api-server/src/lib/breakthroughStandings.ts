import type { BreakthroughRuntimeOptions } from './breakthroughOnline';
import type { BreakthroughStanding, BreakthroughStandings } from '@workspace/api-zod';
import { BREAKTHROUGH_SEASON } from '@workspace/squabblemon-engine/breakthroughOnline';
import { BREAKTHROUGH_RIVALS } from '@workspace/squabblemon-engine/breakthroughRivals';
const rivals = JSON.stringify(BREAKTHROUGH_RIVALS.map(({userId, name, avatarKey}) => ({userId, name, avatarKey})));
/** One read snapshot, no worker wake or synthetic scores. Account IDs never leave this module. */
export async function breakthroughStandings(pool: BreakthroughRuntimeOptions['pool'], userId: string): Promise<BreakthroughStandings> {
  const result = await pool.query(`
    WITH rivals AS (SELECT * FROM jsonb_to_recordset($3::jsonb) AS r("userId" text, name text, "avatarKey" text)),
    eligible AS (
      SELECT r.user_id, coalesce(p.display_name,b.name) AS name, coalesce(p.avatar_key,b."avatarKey") AS "avatarKey",
        r.trophies,r.wins,r.wins+r.losses+r.draws AS games, b."userId" IS NOT NULL AS automated
      FROM breakthrough_records r
      LEFT JOIN player_profiles p ON p.clerk_user_id=r.user_id AND p.onboarding_step='complete'
      LEFT JOIN rivals b ON b."userId"=r.user_id
      WHERE r.season=$1 AND r.wins+r.losses+r.draws>0 AND (p.clerk_user_id IS NOT NULL OR b."userId" IS NOT NULL)
    ), ranked AS (
      SELECT *, dense_rank() OVER(ORDER BY trophies DESC)::int AS position, user_id=$2 AS "isYou" FROM eligible
    ), leaders AS (SELECT * FROM ranked ORDER BY trophies DESC,wins DESC,name ASC,user_id ASC LIMIT 20)
    SELECT coalesce((SELECT jsonb_agg(to_jsonb(l)-'user_id' ORDER BY trophies DESC,wins DESC,name ASC,user_id ASC) FROM leaders l),'[]'::jsonb) AS leaders,
      (SELECT to_jsonb(r)-'user_id' FROM ranked r WHERE user_id=$2) AS you,
      (SELECT count(*)::int FROM ranked) AS total
  `, [BREAKTHROUGH_SEASON, userId, rivals]);
  const row = result.rows[0];
  return { season: BREAKTHROUGH_SEASON, updatedAt: new Date().toISOString(), total: row.total,
    leaders: row.leaders as BreakthroughStanding[], you: row.you as BreakthroughStanding | null };
}
