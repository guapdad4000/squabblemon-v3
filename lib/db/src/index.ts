import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { getConnectionString } from "@netlify/database";
import * as schema from "./schema";

const { Pool } = pg;

// Local tools use an explicit URL; hosted requests use Netlify's deployment branch.
const connectionString = process.env.DATABASE_URL || getConnectionString();
export const pool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
