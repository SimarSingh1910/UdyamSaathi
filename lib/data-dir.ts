import os from "node:os";
import path from "node:path";

/** Folder for runtime files: the embedded database, translation caches, an old store.json. */
export function dataDir(): string {
  if (process.env.UDYAM_RUNTIME_DIR) return process.env.UDYAM_RUNTIME_DIR;
  // Older setups point at the JSON store file; its folder is the data folder.
  if (process.env.UDYAM_STORE_PATH) return path.dirname(process.env.UDYAM_STORE_PATH);
  // Serverless file systems are read-only except the temp dir.
  return process.env.VERCEL ? os.tmpdir() : path.join(process.cwd(), ".data");
}
