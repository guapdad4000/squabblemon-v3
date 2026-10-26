import { checkPlayerBootstrapSchema, pool, type MissingPlayerBootstrapSchema, type PlayerBootstrapSchemaRow } from "@workspace/db";

type SchemaQuery = (statement: string, values: [string[]]) => Promise<{ rows: PlayerBootstrapSchemaRow[] }>;

/** Narrow lazy entry: retain only the database exports this check uses. */
export function inspectDeployedProfileSchema(query?: SchemaQuery): Promise<MissingPlayerBootstrapSchema> {
  return checkPlayerBootstrapSchema(query ?? ((statement, values) =>
    pool.query<PlayerBootstrapSchemaRow>(statement, values)));
}
