import { readFile } from 'node:fs/promises';
import { deliverMail } from '../lib/mail';
import { pool } from '@workspace/db';
const [file, audience, ...flags] = process.argv.slice(2);
try {
  if (!file || !audience || flags.some(f => f !== '--apply')) throw new Error('Usage: tsx src/tools/mail-ops.ts message.json all|USER_ID[,USER_ID] [--apply]');
  console.log(JSON.stringify(await deliverMail(JSON.parse(await readFile(file, 'utf8')), audience === 'all' ? 'all' : audience.split(','), flags.includes('--apply')), null, 2));
} catch (error) { console.error(error instanceof Error ? error.message : 'Mail delivery failed'); process.exitCode = 1; }
finally { await pool.end(); }
