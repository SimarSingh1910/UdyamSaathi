import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.UDYAM_STORE_PATH = path.join(mkdtempSync(path.join(os.tmpdir(), "uds-test-")), "store.json");
