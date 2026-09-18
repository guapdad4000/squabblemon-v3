import { defineConfig } from 'drizzle-kit';
export default defineConfig({schema:'./lib/db/src/schema/index.ts',dialect:'postgresql',dbCredentials:{url:'postgresql://postgres:postgres@127.0.0.1:55439/postgres'}});
