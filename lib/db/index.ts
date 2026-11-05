import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { dataDir } from "../data-dir";
import * as schema from "./schema";

/**
 * The database. With DATABASE_URL set it is that PostgreSQL server; without it, an
 * embedded PostgreSQL (PGlite) in the data folder, so the app and tests run with
 * no setup. Same schema and migrations either way; migrations run on first use.
 */

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

interface Handle {
  db: Db;
  close: () => Promise<void>;
}

const MIGRATIONS = path.join(process.cwd(), "drizzle");

// One connection pool per process, kept across hot reloads in development.
const g = globalThis as typeof globalThis & { __udyamDb?: Promise<Handle> };

async function open(): Promise<Handle> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const client = postgres(url, {
      max: Number(process.env.DATABASE_POOL_MAX) || 10,
      ssl: /sslmode=(require|verify)/.test(url) ? "require" : undefined,
      onnotice: () => {},
    });
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: MIGRATIONS });
    return { db: db as unknown as Db, close: () => client.end() };
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = process.env.PGLITE_DIR || path.join(dataDir(), "pglite");
  const client = dir === "memory" ? new PGlite() : new PGlite(dir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return { db: db as unknown as Db, close: () => client.close() };
}

export function getDb(): Promise<Db> {
  if (!g.__udyamDb) {
    g.__udyamDb = open();
    // A failed start (server down, bad URL) should not stick: try again next time.
    g.__udyamDb.catch(() => (g.__udyamDb = undefined));
  }
  return g.__udyamDb.then((h) => h.db);
}

/** Close the connection (scripts and tests). */
export async function closeDb(): Promise<void> {
  const h = await g.__udyamDb?.catch(() => undefined);
  g.__udyamDb = undefined;
  await h?.close();
}

/** Which database is in use, for logs and health checks. */
export const dbKind = () => (process.env.DATABASE_URL ? "postgres" : "pglite");
