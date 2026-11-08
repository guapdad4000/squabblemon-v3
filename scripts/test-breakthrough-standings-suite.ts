import assert from 'node:assert/strict';
import { breakthroughStandings } from '../artifacts/api-server/src/lib/breakthroughStandings';
import type { BreakthroughRuntimeOptions } from '../artifacts/api-server/src/lib/breakthroughOnline';
import { BREAKTHROUGH_SEASON } from '../lib/squabblemon-engine/src/breakthroughOnline';
import { BREAKTHROUGH_RIVALS } from '../lib/squabblemon-engine/src/breakthroughRivals';
export async function verifyStandings(pool: BreakthroughRuntimeOptions['pool']) {
  // Disposable runner database only: production already owns this profile table.
  await pool.query('CREATE TABLE IF NOT EXISTS player_profiles(clerk_user_id text PRIMARY KEY, display_name text, avatar_key text, onboarding_step text)');
  assert.deepEqual((await breakthroughStandings(pool, 'rank-missing')).leaders, []);
  try {
    for (let i = 0; i < 25; i++) {
      await pool.query('INSERT INTO player_profiles VALUES($1,$2,$3,$4)', [`rank-${i}`, `Fighter ${String(i).padStart(2,'0')}`, 'nabu', 'complete']);
      await pool.query('INSERT INTO breakthrough_records(user_id,season,trophies,wins) VALUES($1,$2,$3,1)', [`rank-${i}`, BREAKTHROUGH_SEASON, i < 2 ? 500 : 400-i]);
    }
    await pool.query("INSERT INTO player_profiles VALUES('rank-zero','No games','nabu','complete'),('rank-old','Old season','nabu','complete'),('rank-incomplete','Onboarding','nabu','name')");
    for (const [id, season, games] of [['rank-zero',BREAKTHROUGH_SEASON,0],['rank-old','previous-season',1],['rank-incomplete',BREAKTHROUGH_SEASON,1],['rank-orphan',BREAKTHROUGH_SEASON,1]] as const)
      await pool.query('INSERT INTO breakthrough_records(user_id,season,trophies,wins) VALUES($1,$2,999,$3)',[id,season,games]);
    await pool.query('INSERT INTO breakthrough_records(user_id,season,trophies,wins) VALUES($1,$2,450,2)', [BREAKTHROUGH_RIVALS[0].userId, BREAKTHROUGH_SEASON]);
    const outside = await breakthroughStandings(pool, 'rank-24');
    assert.equal(outside.total, 26); assert.equal(outside.leaders.length,20);
    assert.equal(outside.leaders[0].position,1); assert.equal(outside.leaders[1].position,1);
    assert.equal(outside.leaders[2].name, BREAKTHROUGH_RIVALS[0].name);
    assert.equal(outside.leaders[2].automated,true); assert.equal(outside.leaders[2].position,2);
    assert.equal(outside.you?.position,25); assert(outside.you?.isYou);
    assert(!outside.leaders.some(p=>p.isYou));
    const first = await breakthroughStandings(pool, 'rank-0');
    assert(first.leaders[0].isYou); assert.equal(first.you?.name,'Fighter 00');
    assert(!JSON.stringify(first).includes('user_id')); assert(!JSON.stringify(first).includes('rank-0'));
    assert.equal((await breakthroughStandings(pool,'rank-zero')).you,null);
    console.log('Native Kumite standings: ties, top 20 + own rank, real rivals, season/eligibility, account isolation passed');
  } finally {
    await pool.query("DELETE FROM breakthrough_records WHERE user_id LIKE 'rank-%' OR user_id=$1",[BREAKTHROUGH_RIVALS[0].userId]);
    await pool.query("DELETE FROM player_profiles WHERE clerk_user_id LIKE 'rank-%'");
  }
}
