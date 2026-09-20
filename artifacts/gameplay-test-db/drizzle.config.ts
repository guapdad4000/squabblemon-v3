const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for the isolated gameplay test schema.");
}
const target = new URL(databaseUrl);
if (!["127.0.0.1", "localhost", "::1"].includes(target.hostname.toLowerCase())) {
  throw new Error("The gameplay test schema can only be pushed to a loopback database.");
}

export default {
  schema: "./lib/db/src/schema/*.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
};