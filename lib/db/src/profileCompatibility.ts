import { getTableColumns, getTableName } from "drizzle-orm";
import {
  playerCollectionClaimsTable,
  playerMatchesTable,
  playerMissionsTable,
  playerPackOpeningsTable,
  playerProfilesTable,
} from "./schema";

const allColumns = (table: Parameters<typeof getTableColumns>[0]) =>
  Object.values(getTableColumns(table)).map((column) => column.name);

// ensurePlayer/getPlayerBootstrap select all profile, mission, and pack rows.
// Claims and matches are projected, so unrelated columns must not gate login.
export const requiredPlayerBootstrapColumns: Readonly<Record<string, readonly string[]>> = {
  [getTableName(playerProfilesTable)]: allColumns(playerProfilesTable),
  [getTableName(playerMissionsTable)]: allColumns(playerMissionsTable),
  [getTableName(playerPackOpeningsTable)]: allColumns(playerPackOpeningsTable),
  [getTableName(playerCollectionClaimsTable)]: [
    playerCollectionClaimsTable.clerkUserId.name,
    playerCollectionClaimsTable.milestoneKey.name,
  ],
  [getTableName(playerMatchesTable)]: [
    playerMatchesTable.id.name,
    playerMatchesTable.clerkUserId.name,
    playerMatchesTable.mode.name,
    playerMatchesTable.playerDeckId.name,
    playerMatchesTable.completedAt.name,
  ],
};

// Resolve names through the runtime connection's search_path, as unqualified
// Drizzle queries do. Only PostgreSQL catalog metadata is read, not player rows.
export const PLAYER_BOOTSTRAP_SCHEMA_QUERY = `
  select required.table_name,
    required.relation_oid is not null as table_exists,
    attribute.attname
  from (
    select name as table_name, pg_catalog.to_regclass(name) as relation_oid
    from unnest($1::text[]) as tables(name)
  ) as required
  left join pg_catalog.pg_attribute as attribute
    on attribute.attrelid = required.relation_oid
    and attribute.attnum > 0
    and not attribute.attisdropped
`;

export type PlayerBootstrapSchemaRow = {
  table_name: string;
  table_exists: boolean;
  attname: string | null;
};

export type MissingPlayerBootstrapSchema = {
  tables: string[];
  columns: string[];
};

export function missingPlayerBootstrapSchema(
  rows: readonly PlayerBootstrapSchemaRow[],
): MissingPlayerBootstrapSchema {
  const found = new Map<string, { exists: boolean; columns: Set<string> }>();
  for (const row of rows) {
    const entry = found.get(row.table_name) ?? { exists: false, columns: new Set<string>() };
    entry.exists ||= row.table_exists;
    if (row.attname !== null) entry.columns.add(row.attname);
    found.set(row.table_name, entry);
  }
  const missing: MissingPlayerBootstrapSchema = { tables: [], columns: [] };
  for (const [table, columns] of Object.entries(requiredPlayerBootstrapColumns)) {
    const entry = found.get(table);
    if (!entry?.exists) {
      missing.tables.push(table);
    } else {
      missing.columns.push(...columns.filter((column) => !entry.columns.has(column))
        .map((column) => `${table}.${column}`));
    }
  }
  return missing;
}

export async function checkPlayerBootstrapSchema(
  query: (
    statement: string,
    values: [string[]],
  ) => Promise<{ rows: PlayerBootstrapSchemaRow[] }>,
): Promise<MissingPlayerBootstrapSchema> {
  const result = await query(PLAYER_BOOTSTRAP_SCHEMA_QUERY, [
    Object.keys(requiredPlayerBootstrapColumns),
  ]);
  return missingPlayerBootstrapSchema(result.rows);
}