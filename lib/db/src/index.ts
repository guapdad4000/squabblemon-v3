import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { getConnectionString as getNetlifyConnectionString } from "@netlify/database";

const { Pool } = pg;

function databasePoolMaximum(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return 5;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
    throw new Error("DATABASE_POOL_MAX must be an integer from 1 through 50.");
  }
  return parsed;
}

// Local tools use an explicit URL; hosted requests use Netlify's deployment branch.
const connectionString = process.env.DATABASE_URL || getNetlifyConnectionString();

/** The exact connection already selected for this process; callers must never expose it. */
export function resolvedDatabaseConnectionString(): string {
  return connectionString;
}

export const pool = new Pool({
  connectionString,
  max: databasePoolMaximum(process.env.DATABASE_POOL_MAX),
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
  // Idle pooled sockets never hold a process open (CLI tools, tests, a
  // drained function runtime); in-flight queries and checked-out clients do.
  allowExitOnIdle: true,
});
// No caller uses Drizzle's relational `db.query` API. Passing the schema
// namespace here would retain every schema export (including the drizzle-zod
// insert validators) in each bundled function.
export const db = drizzle(pool);

export * from "./schema";
export * from "./profileCompatibility";
