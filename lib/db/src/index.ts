import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { getConnectionString as getNetlifyConnectionString } from "@netlify/database";
import * as schema from "./schema";

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
});
export const db = drizzle(pool, { schema });

export * from "./schema";
