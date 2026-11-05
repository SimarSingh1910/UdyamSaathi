import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.UDYAM_ENCRYPTION_KEY ??= "0".repeat(64);
// A throwaway data folder, so a real .data/store.json is never imported.
const dir = mkdtempSync(path.join(os.tmpdir(), "uds-test-"));
process.env.UDYAM_RUNTIME_DIR = dir;
process.env.UDYAM_STORE_PATH = path.join(dir, "store.json");
// Each test worker gets its own in-memory PostgreSQL (PGlite), migrated and seeded
// from the CSVs, never a server from the environment.
delete process.env.DATABASE_URL;
process.env.PGLITE_DIR = "memory";
