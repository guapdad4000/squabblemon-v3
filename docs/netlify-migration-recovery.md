# Netlify migration recovery

The Social and username migrations completed their SQL and were recorded by the
database, but their explicit `COMMIT` ended Netlify's enclosing transaction.
Netlify then rejected the final commit with `unexpected transaction status idle`.

The migration-list API reflected the last published bundle and omitted these
versions. It was not sufficient evidence that the migrations were unapplied.
Netlify's documented migration **dry run** against the original deploy confirmed
that the database was already at the final original version and accepted the
original files. Changing those files instead produced a checksum conflict.

## Release rules

- Preserve the already-applied migration files exactly, including whitespace.
  Two historical transaction-wrapped files have narrowly pinned SHA-256
  exceptions in the release check; editing, removing, or copying them into a
  new migration is rejected.
- New native SQL must leave transaction ownership to Netlify. Standalone
  development SQL has separate transaction ownership.
- Use the additive Social schema reconciliation migration to repair missing
  objects without deleting identities, relationships, or player balances.
- Do not reset the database, delete migration history, or edit the provider's
  protected migration tables to bypass a checksum conflict.
- Confirm the deployment's commit and migration dry-run state before publishing,
  then verify the published commit and applied versions afterward.

## Verification

```sh
node --test scripts/check-netlify-migrations.test.mjs
env -u DATABASE_URL node scripts/test-events-feedback-database.mjs --migrations-only
```

The PostgreSQL test owns its disposable cluster. It seeds the already-applied
historical schema, then checks new migrations under an externally owned
transaction, including failed-batch rollback, retry, constraint enforcement,
and preservation of balances and identities.

This is an **existing-database recovery**, not proof that the two frozen legacy
files can be replayed inside a fresh Netlify runner transaction. Production and
new previews cloned from its applied history skip those files. Provisioning an
entirely empty hosted database needs a separately validated bootstrap/baseline
procedure; do not rewrite applied history to achieve that.

Official references:
- https://docs.netlify.com/build/data-and-storage/netlify-database/troubleshooting/#migration-modified-after-being-applied
- https://docs.netlify.com/build/data-and-storage/netlify-database/migrations/
- https://open-api.netlify.com/