import { runStoreSmokeCheck } from '../lib/payments/storeSmokeCheck';

// Operator CLI for the post-deploy store smoke check. The deploy-succeeded
// Netlify event function runs this automatically after every deploy; this
// entry point lets the release worker re-run it on demand against the deployed
// origin (see docs/corner-store-payments-verification.md).
try {
  const catalog = await runStoreSmokeCheck(process.env);
  console.log(`Store smoke check passed: checkout is ${catalog.mode} and enabled with ${catalog.offers?.length ?? 0} offers.`);
} catch (error) {
  console.error(`STORE SMOKE CHECK FAILED — the deployed store may have disabled checkout. ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
