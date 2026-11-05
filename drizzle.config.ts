import { defineConfig } from "drizzle-kit";

// `npm run db:generate` writes SQL migrations to ./drizzle after a schema change.
// The app applies them itself on start (lib/db/index.ts).
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
});
